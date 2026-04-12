/**
 * Workflow Engine Service
 * Centralized engine for managing form submission workflows,
 * approval chains, email notifications, and status transitions.
 */

const sql = require('mssql');
const crypto = require('crypto');
const config = require('../config/default');
const emailService = require('./email-service');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

class WorkflowEngine {
    // Create an independent connection pool (not the shared global one)
    // This prevents "Connection is closed" errors when routes close the global pool
    async _getPool() {
        const pool = new sql.ConnectionPool(dbConfig);
        await pool.connect();
        return pool;
    }
    constructor() {
        this.appUrl = process.env.NODE_ENV === 'live' || process.env.NODE_ENV === 'production'
            ? 'https://oeapp.gmrlapps.com'
            : 'https://oeapp-uat.gmrlapps.com';
        console.log('[WORKFLOW] Engine initialized, appUrl:', this.appUrl);
    }

    // =============================================
    // CORE: Start a workflow for a form submission
    // =============================================
    /**
     * Start a workflow for a submitted form
     * @param {Object} params
     * @param {string} params.formCode - e.g. 'THEFT_INCIDENT'
     * @param {number} params.recordId - ID of the submitted record
     * @param {string} params.recordTable - Source table name e.g. 'TheftIncidents'
     * @param {Object} params.submitter - { userId, email, name }
     * @param {Object} params.store - { storeId, storeName } (nullable)
     * @param {Object} params.metaData - Extra form data for email placeholders
     * @param {string} params.accessToken - User's OAuth token (nullable, falls back to app token)
     * @param {string} params.ipAddress - Request IP for audit log
     * @returns {Object} { success, instanceId, message }
     */
    async start({ formCode, recordId, recordTable, submitter, store = {}, metaData = {}, accessToken = null, ipAddress = null }) {
        let pool;
        try {
            pool = await this._getPool();

            // 1. Get workflow definition
            const defResult = await pool.request()
                .input('formCode', sql.NVarChar, formCode)
                .query(`
                    SELECT Id, FormCode, FormName, WorkflowType, IsActive
                    FROM WorkflowDefinitions
                    WHERE FormCode = @formCode
                `);

            if (defResult.recordset.length === 0) {
                console.log(`[WORKFLOW] No workflow defined for ${formCode}, skipping`);
                return { success: true, skipped: true, message: 'No workflow defined' };
            }

            const workflow = defResult.recordset[0];

            if (!workflow.IsActive || workflow.WorkflowType === 'NONE') {
                console.log(`[WORKFLOW] Workflow for ${formCode} is inactive/NONE, skipping`);
                return { success: true, skipped: true, message: 'Workflow inactive' };
            }

            // 2. Get workflow steps (active, ordered)
            const stepsResult = await pool.request()
                .input('workflowId', sql.Int, workflow.Id)
                .query(`
                    SELECT Id, StepOrder, StepName, StepType, ApprovalMethod,
                           AllowedActions, EmailTemplateKey, TargetStatus, IsActive
                    FROM WorkflowSteps
                    WHERE WorkflowId = @workflowId AND IsActive = 1
                    ORDER BY StepOrder ASC
                `);

            const steps = stepsResult.recordset;
            if (steps.length === 0) {
                console.log(`[WORKFLOW] No steps configured for ${formCode}`);
                return { success: true, skipped: true, message: 'No steps configured' };
            }

            // 3. Evaluate conditions to filter steps
            const activeSteps = await this._evaluateConditions(pool, steps, metaData);

            if (activeSteps.length === 0) {
                console.log(`[WORKFLOW] All steps skipped by conditions for ${formCode}`);
                return { success: true, skipped: true, message: 'All steps skipped by conditions' };
            }

            // 4. Get default status
            const statusResult = await pool.request()
                .input('workflowId', sql.Int, workflow.Id)
                .query(`
                    SELECT StatusLabel FROM WorkflowStatusMappings
                    WHERE WorkflowId = @workflowId AND IsDefault = 1
                `);
            const defaultStatus = statusResult.recordset.length > 0
                ? statusResult.recordset[0].StatusLabel
                : 'Initiated';

            // 5. Resolve storeName from DB if storeId is present but name is missing
            let resolvedStoreName = store.storeName || null;
            if (!resolvedStoreName && store.storeId) {
                const storeResult = await pool.request()
                    .input('sid', sql.Int, parseInt(store.storeId))
                    .query('SELECT StoreName FROM Stores WHERE Id = @sid');
                if (storeResult.recordset.length > 0) {
                    resolvedStoreName = storeResult.recordset[0].StoreName;
                }
            }

            // 6. Create workflow instance
            const instanceResult = await pool.request()
                .input('workflowId', sql.Int, workflow.Id)
                .input('formCode', sql.NVarChar, formCode)
                .input('recordId', sql.Int, recordId)
                .input('recordTable', sql.NVarChar, recordTable)
                .input('currentStepId', sql.Int, activeSteps[0].Id)
                .input('currentStatus', sql.NVarChar, defaultStatus)
                .input('submittedBy', sql.NVarChar, submitter.userId ? String(submitter.userId) : null)
                .input('submittedByEmail', sql.NVarChar, submitter.email)
                .input('submittedByName', sql.NVarChar, submitter.name || null)
                .input('storeId', sql.Int, store.storeId ? parseInt(store.storeId) || null : null)
                .input('storeName', sql.NVarChar, resolvedStoreName)
                .input('metaData', sql.NVarChar, JSON.stringify(metaData))
                .query(`
                    INSERT INTO WorkflowInstances
                        (WorkflowId, FormCode, RecordId, RecordTable, CurrentStepId, CurrentStatus,
                         SubmittedBy, SubmittedByEmail, SubmittedByName, StoreId, StoreName, MetaData)
                    OUTPUT INSERTED.Id
                    VALUES
                        (@workflowId, @formCode, @recordId, @recordTable, @currentStepId, @currentStatus,
                         @submittedBy, @submittedByEmail, @submittedByName, @storeId, @storeName, @metaData)
                `);

            const instanceId = instanceResult.recordset[0].Id;

            // 6. Create instance steps
            for (const step of activeSteps) {
                await pool.request()
                    .input('instanceId', sql.Int, instanceId)
                    .input('stepId', sql.Int, step.Id)
                    .input('stepOrder', sql.Int, step.StepOrder)
                    .input('stepName', sql.NVarChar, step.StepName)
                    .input('stepType', sql.NVarChar, step.StepType)
                    .query(`
                        INSERT INTO WorkflowInstanceSteps
                            (InstanceId, StepId, StepOrder, StepName, StepType, Status)
                        VALUES
                            (@instanceId, @stepId, @stepOrder, @stepName, @stepType, 'Pending')
                    `);
            }

            // 7. Audit log: workflow started
            await this._logAudit(pool, {
                instanceId,
                action: 'WORKFLOW_STARTED',
                actionBy: submitter.email,
                actionByName: submitter.name,
                details: { formCode, recordId, recordTable, workflowType: workflow.WorkflowType },
                newStatus: defaultStatus,
                ipAddress
            });

            console.log(`[WORKFLOW] Started instance #${instanceId} for ${formCode} record #${recordId}`);

            // 8. Execute the first step
            await this._executeStep(pool, instanceId, activeSteps[0], {
                submitter, store, metaData, accessToken, ipAddress
            });

            await pool.close();
            return { success: true, instanceId, message: `Workflow started (${activeSteps.length} steps)` };

        } catch (error) {
            console.error('[WORKFLOW] Error starting workflow:', error);
            if (pool) await pool.close().catch(() => {});
            return { success: false, error: error.message };
        }
    }

    // =============================================
    // CORE: Handle an approval action
    // =============================================
    /**
     * Process an approval action (approve, reject, request info, delegate)
     * @param {Object} params
     * @param {number} params.instanceId - Workflow instance ID
     * @param {string} params.action - 'Approved', 'Rejected', 'RequestedInfo', 'Delegated'
     * @param {string} params.actionBy - Email of person taking action
     * @param {string} params.actionByName - Name of person taking action
     * @param {string} params.comments - Optional comments
     * @param {string} params.delegateTo - Email to delegate to (if action is Delegated)
     * @param {string} params.accessToken - OAuth token (nullable)
     * @param {string} params.ipAddress - Request IP
     * @returns {Object} { success, message, newStatus }
     */
    async handleApproval({ instanceId, action, actionBy, actionByName, comments, delegateTo, accessToken = null, ipAddress = null }) {
        let pool;
        try {
            pool = await this._getPool();

            // 1. Get instance with current step
            const instance = await this._getInstance(pool, instanceId);
            if (!instance) {
                return { success: false, error: 'Workflow instance not found' };
            }

            // 2. Get current active step
            const currentStep = await this._getCurrentInstanceStep(pool, instanceId);
            if (!currentStep) {
                return { success: false, error: 'No active step found' };
            }

            if (currentStep.StepType !== 'APPROVAL') {
                return { success: false, error: 'Current step is not an approval step' };
            }

            // 3. Verify the actor is the assigned approver
            if (currentStep.AssignedTo && currentStep.AssignedTo.toLowerCase() !== actionBy.toLowerCase()) {
                return { success: false, error: 'You are not the assigned approver for this step' };
            }

            const previousStatus = instance.CurrentStatus;

            // 4. Handle delegation
            if (action === 'Delegated' && delegateTo) {
                await pool.request()
                    .input('id', sql.Int, currentStep.Id)
                    .input('delegatedTo', sql.NVarChar, delegateTo)
                    .input('comments', sql.NVarChar, comments || null)
                    .input('actionBy', sql.NVarChar, actionBy)
                    .input('actionByName', sql.NVarChar, actionByName || null)
                    .query(`
                        UPDATE WorkflowInstanceSteps
                        SET DelegatedTo = @delegatedTo, AssignedTo = @delegatedTo,
                            Comments = @comments, ActionBy = @actionBy, ActionByName = @actionByName
                        WHERE Id = @id
                    `);

                await this._logAudit(pool, {
                    instanceId, stepId: currentStep.StepId,
                    action: 'DELEGATED',
                    actionBy, actionByName,
                    details: { delegatedTo, comments },
                    previousStatus, newStatus: previousStatus,
                    ipAddress
                });

                // Send notification to new assignee
                await this._sendDelegationNotification(pool, instance, currentStep, delegateTo, actionByName, accessToken);

                await pool.close();
                return { success: true, message: `Delegated to ${delegateTo}`, newStatus: previousStatus };
            }

            // 5. Handle RequestedInfo
            if (action === 'RequestedInfo') {
                await pool.request()
                    .input('id', sql.Int, currentStep.Id)
                    .input('action', sql.NVarChar, 'RequestedInfo')
                    .input('actionBy', sql.NVarChar, actionBy)
                    .input('actionByName', sql.NVarChar, actionByName || null)
                    .input('comments', sql.NVarChar, comments || null)
                    .query(`
                        UPDATE WorkflowInstanceSteps
                        SET Action = @action, ActionBy = @actionBy, ActionByName = @actionByName,
                            Comments = @comments, Status = 'InfoRequested'
                        WHERE Id = @id
                    `);

                await this._logAudit(pool, {
                    instanceId, stepId: currentStep.StepId,
                    action: 'INFO_REQUESTED',
                    actionBy, actionByName,
                    details: { comments },
                    previousStatus, newStatus: 'Info Requested',
                    ipAddress
                });

                // Notify the submitter
                await this._createNotification(pool, {
                    userId: instance.SubmittedBy,
                    userEmail: instance.SubmittedByEmail,
                    type: 'approval',
                    title: `More Info Requested - ${instance.FormCode}`,
                    message: `${actionByName || actionBy} has requested more information on your submission. ${comments ? 'Comment: ' + comments : ''}`,
                    link: instance.ModulePath ? `${instance.ModulePath}/view/${instance.RecordId}` : null
                });

                await pool.close();
                return { success: true, message: 'More info requested', newStatus: 'Info Requested' };
            }

            // 6. Handle Approved / Rejected
            const stepStatus = action === 'Approved' ? 'Completed' : 'Rejected';

            await pool.request()
                .input('id', sql.Int, currentStep.Id)
                .input('action', sql.NVarChar, action)
                .input('actionBy', sql.NVarChar, actionBy)
                .input('actionByName', sql.NVarChar, actionByName || null)
                .input('comments', sql.NVarChar, comments || null)
                .input('status', sql.NVarChar, stepStatus)
                .query(`
                    UPDATE WorkflowInstanceSteps
                    SET Action = @action, ActionBy = @actionBy, ActionByName = @actionByName,
                        Comments = @comments, Status = @status, CompletedAt = GETDATE()
                    WHERE Id = @id
                `);

            await this._logAudit(pool, {
                instanceId, stepId: currentStep.StepId,
                action: action === 'Approved' ? 'APPROVED' : 'REJECTED',
                actionBy, actionByName,
                details: { comments, stepName: currentStep.StepName },
                previousStatus,
                newStatus: action === 'Approved' ? previousStatus : 'Rejected',
                ipAddress
            });

            if (action === 'Rejected') {
                // Rejection: update instance, notify submitter, stop workflow
                const rejectStatus = await this._getStatusForAction(pool, instance.WorkflowId, 'Rejected') || 'Rejected';

                await pool.request()
                    .input('id', sql.Int, instanceId)
                    .input('status', sql.NVarChar, rejectStatus)
                    .query(`
                        UPDATE WorkflowInstances
                        SET CurrentStatus = @status, CompletedAt = GETDATE(), UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);

                // Update source record status
                await this._updateRecordStatus(pool, instance.RecordTable, instance.RecordId, rejectStatus);

                // Notify submitter
                await this._createNotification(pool, {
                    userId: instance.SubmittedBy,
                    userEmail: instance.SubmittedByEmail,
                    type: 'approval',
                    title: `${instance.FormCode.replace(/_/g, ' ')} - Rejected`,
                    message: `Your submission was rejected by ${actionByName || actionBy}. ${comments ? 'Reason: ' + comments : ''}`,
                    link: instance.ModulePath ? `${instance.ModulePath}/view/${instance.RecordId}` : null
                });

                await pool.close();
                return { success: true, message: 'Rejected', newStatus: rejectStatus };
            }

            // 7. Approved: advance to next step
            const nextStep = await this._getNextStep(pool, instanceId, currentStep.StepOrder);

            if (nextStep) {
                // More steps remain — execute next
                const stepDef = await this._getStepDefinition(pool, nextStep.StepId);

                await pool.request()
                    .input('id', sql.Int, instanceId)
                    .input('stepId', sql.Int, nextStep.StepId)
                    .query(`
                        UPDATE WorkflowInstances
                        SET CurrentStepId = @stepId, UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);

                await this._executeStep(pool, instanceId, stepDef, {
                    submitter: { userId: instance.SubmittedBy, email: instance.SubmittedByEmail, name: instance.SubmittedByName },
                    store: { storeId: instance.StoreId, storeName: instance.StoreName },
                    metaData: instance.MetaData ? JSON.parse(instance.MetaData) : {},
                    accessToken,
                    ipAddress
                });

                await pool.close();
                return { success: true, message: `Approved. Next: ${nextStep.StepName}`, newStatus: instance.CurrentStatus };
            } else {
                // Final step approved — workflow complete
                const completeStatus = await this._getStatusForAction(pool, instance.WorkflowId, 'Completed') || 'Completed';

                await pool.request()
                    .input('id', sql.Int, instanceId)
                    .input('status', sql.NVarChar, completeStatus)
                    .query(`
                        UPDATE WorkflowInstances
                        SET CurrentStatus = @status, CurrentStepId = NULL, CompletedAt = GETDATE(), UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);

                await this._updateRecordStatus(pool, instance.RecordTable, instance.RecordId, completeStatus);

                await this._logAudit(pool, {
                    instanceId, action: 'WORKFLOW_COMPLETED',
                    actionBy, actionByName,
                    details: { finalAction: 'Approved' },
                    previousStatus, newStatus: completeStatus,
                    ipAddress
                });

                // Notify submitter of completion
                await this._createNotification(pool, {
                    userId: instance.SubmittedBy,
                    userEmail: instance.SubmittedByEmail,
                    type: 'approval',
                    title: `${instance.FormCode.replace(/_/g, ' ')} - Approved`,
                    message: `Your submission has been fully approved!`,
                    link: instance.ModulePath ? `${instance.ModulePath}/view/${instance.RecordId}` : null
                });

                await pool.close();
                return { success: true, message: 'Workflow completed', newStatus: completeStatus };
            }

        } catch (error) {
            console.error('[WORKFLOW] Error handling approval:', error);
            if (pool) await pool.close().catch(() => {});
            return { success: false, error: error.message };
        }
    }

    // =============================================
    // PUBLIC APPROVAL: Token generation & verification
    // =============================================

    generateApprovalToken(instanceId, stepId, approverEmail) {
        const secret = process.env.SESSION_SECRET || 'oe-app-secret';
        return crypto.createHmac('sha256', secret)
            .update(`wf-${instanceId}-${stepId}-${approverEmail}`)
            .digest('hex')
            .substring(0, 32);
    }

    verifyApprovalToken(instanceId, stepId, approverEmail, token) {
        const expected = this.generateApprovalToken(instanceId, stepId, approverEmail);
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    }

    // =============================================
    // QUERY: Get workflow status for a record
    // =============================================

    async getInstanceByRecord(formCode, recordId) {
        let pool;
        try {
            pool = await this._getPool();
            const result = await pool.request()
                .input('formCode', sql.NVarChar, formCode)
                .input('recordId', sql.Int, recordId)
                .query(`
                    SELECT wi.*, wd.FormName, wd.WorkflowType
                    FROM WorkflowInstances wi
                    JOIN WorkflowDefinitions wd ON wi.WorkflowId = wd.Id
                    WHERE wi.FormCode = @formCode AND wi.RecordId = @recordId
                    ORDER BY wi.CreatedAt DESC
                `);
            await pool.close();
            return result.recordset.length > 0 ? result.recordset[0] : null;
        } catch (error) {
            if (pool) await pool.close().catch(() => {});
            console.error('[WORKFLOW] Error getting instance:', error);
            return null;
        }
    }

    async getInstanceSteps(instanceId) {
        let pool;
        try {
            pool = await this._getPool();
            const result = await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .query(`
                    SELECT * FROM WorkflowInstanceSteps
                    WHERE InstanceId = @instanceId
                    ORDER BY StepOrder ASC
                `);
            await pool.close();
            return result.recordset;
        } catch (error) {
            if (pool) await pool.close().catch(() => {});
            console.error('[WORKFLOW] Error getting steps:', error);
            return [];
        }
    }

    async getAuditLog(instanceId) {
        let pool;
        try {
            pool = await this._getPool();
            const result = await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .query(`
                    SELECT * FROM WorkflowAuditLog
                    WHERE InstanceId = @instanceId
                    ORDER BY CreatedAt ASC
                `);
            await pool.close();
            return result.recordset;
        } catch (error) {
            if (pool) await pool.close().catch(() => {});
            console.error('[WORKFLOW] Error getting audit log:', error);
            return [];
        }
    }

    // =============================================
    // QUERY: Check if a workflow is active for a form
    // =============================================

    async isWorkflowActive(formCode) {
        let pool;
        try {
            pool = await this._getPool();
            const result = await pool.request()
                .input('formCode', sql.NVarChar, formCode)
                .query(`
                    SELECT IsActive, WorkflowType FROM WorkflowDefinitions
                    WHERE FormCode = @formCode
                `);
            await pool.close();
            if (result.recordset.length === 0) return false;
            return result.recordset[0].IsActive && result.recordset[0].WorkflowType !== 'NONE';
        } catch (error) {
            if (pool) await pool.close().catch(() => {});
            return false;
        }
    }

    // =============================================
    // QUERY: Get configured recipients for a formCode
    // Returns { to: [emails], cc: [emails] }
    // =============================================

    async getConfiguredRecipients(formCode) {
        let pool;
        try {
            pool = await this._getPool();
            const result = await pool.request()
                .input('formCode', sql.NVarChar, formCode)
                .query(`
                    SELECT r.UserEmail, r.RoleName, r.RecipientType, r.EmailTarget
                    FROM WorkflowStepRecipients r
                    JOIN WorkflowSteps s ON r.StepId = s.Id
                    JOIN WorkflowDefinitions wd ON s.WorkflowId = wd.Id
                    WHERE wd.FormCode = @formCode AND r.IsActive = 1 AND s.IsActive = 1
                    ORDER BY s.StepOrder, r.EmailTarget
                `);

            const to = [];
            const cc = [];

            for (const rec of result.recordset) {
                let email = null;

                if (rec.RecipientType === 'USER' && rec.UserEmail) {
                    email = rec.UserEmail;
                } else if (rec.RecipientType === 'ROLE' && rec.RoleName) {
                    // Look up users with this role
                    const roleUsers = await pool.request()
                        .input('roleName', sql.NVarChar, rec.RoleName)
                        .query(`
                            SELECT u.Email FROM Users u
                            JOIN UserRoleAssignments ura ON u.Id = ura.UserId
                            JOIN UserRoles ur ON ura.RoleId = ur.Id
                            WHERE ur.RoleName = @roleName AND u.IsActive = 1
                        `);
                    for (const ru of roleUsers.recordset) {
                        if (ru.Email) {
                            if (rec.EmailTarget === 'CC') cc.push(ru.Email);
                            else to.push(ru.Email);
                        }
                    }
                    continue;
                }

                if (email) {
                    if (rec.EmailTarget === 'CC') cc.push(email);
                    else to.push(email);
                }
            }

            await pool.close();
            return { to: [...new Set(to)], cc: [...new Set(cc)] };
        } catch (error) {
            if (pool) await pool.close().catch(() => {});
            console.error('[WORKFLOW] Error getting configured recipients:', error);
            return { to: [], cc: [] };
        }
    }

    // =============================================
    // PRIVATE: Execute a workflow step
    // =============================================

    async _executeStep(pool, instanceId, stepDef, context) {
        console.log(`[WORKFLOW] Executing step: ${stepDef.StepName} (${stepDef.StepType})`);

        // Mark instance step as InProgress
        await pool.request()
            .input('instanceId', sql.Int, instanceId)
            .input('stepId', sql.Int, stepDef.Id)
            .query(`
                UPDATE WorkflowInstanceSteps
                SET Status = 'InProgress', StartedAt = GETDATE()
                WHERE InstanceId = @instanceId AND StepId = @stepId
            `);

        switch (stepDef.StepType) {
            case 'EMAIL':
                await this._executeEmailStep(pool, instanceId, stepDef, context);
                break;
            case 'APPROVAL':
                await this._executeApprovalStep(pool, instanceId, stepDef, context);
                break;
            case 'STATUS_CHANGE':
                await this._executeStatusChangeStep(pool, instanceId, stepDef, context);
                break;
            case 'NOTIFICATION':
                await this._executeNotificationStep(pool, instanceId, stepDef, context);
                break;
            default:
                console.warn(`[WORKFLOW] Unknown step type: ${stepDef.StepType}`);
        }
    }

    // =============================================
    // PRIVATE: Email step execution
    // =============================================

    async _executeEmailStep(pool, instanceId, stepDef, context) {
        try {
            const instance = await this._getInstance(pool, instanceId);
            const recipients = await this._resolveRecipients(pool, stepDef.Id, instance, context);

            // Build email from template
            let subject = '';
            let body = '';

            if (stepDef.EmailTemplateKey) {
                const template = await this._getEmailTemplate(pool, stepDef.EmailTemplateKey);
                if (template) {
                    const templateData = this._buildTemplateData(instance, context);
                    subject = this._replaceVariables(template.SubjectTemplate, templateData);
                    body = this._replaceVariables(template.BodyTemplate, templateData);
                }
            }

            if (!subject) {
                subject = `${instance.FormCode.replace(/_/g, ' ')} - Notification`;
            }

            // Send to each TO recipient
            const toRecipients = recipients.filter(r => r.emailTarget === 'TO');
            const ccRecipients = recipients.filter(r => r.emailTarget === 'CC');
            const ccList = ccRecipients.map(r => r.email).join(';');
            const sentTo = [];

            for (const recipient of toRecipients) {
                const result = await this._sendEmail({
                    to: recipient.email,
                    subject,
                    body,
                    cc: ccList || null,
                    accessToken: context.accessToken
                });
                if (result.success) sentTo.push(recipient.email);
            }

            // If no TO recipients but have CC, send to first CC
            if (toRecipients.length === 0 && ccRecipients.length > 0) {
                const result = await this._sendEmail({
                    to: ccRecipients[0].email,
                    subject,
                    body,
                    cc: ccRecipients.slice(1).map(r => r.email).join(';') || null,
                    accessToken: context.accessToken
                });
                if (result.success) sentTo.push(ccRecipients[0].email);
            }

            // Update instance step
            await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .input('stepId', sql.Int, stepDef.Id)
                .input('emailSentTo', sql.NVarChar, JSON.stringify(sentTo))
                .query(`
                    UPDATE WorkflowInstanceSteps
                    SET Status = 'Completed', EmailSentTo = @emailSentTo, EmailSentAt = GETDATE(), CompletedAt = GETDATE()
                    WHERE InstanceId = @instanceId AND StepId = @stepId
                `);

            await this._logAudit(pool, {
                instanceId, stepId: stepDef.Id,
                action: 'EMAIL_SENT',
                details: { sentTo, template: stepDef.EmailTemplateKey },
                newStatus: instance.CurrentStatus
            });

            // Auto-advance to next step
            await this._advanceToNext(pool, instanceId, stepDef, context);

        } catch (error) {
            console.error('[WORKFLOW] Email step error:', error);
            await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .input('stepId', sql.Int, stepDef.Id)
                .input('error', sql.NVarChar, error.message)
                .query(`
                    UPDATE WorkflowInstanceSteps
                    SET EmailError = @error
                    WHERE InstanceId = @instanceId AND StepId = @stepId
                `);
        }
    }

    // =============================================
    // PRIVATE: Approval step execution
    // =============================================

    async _executeApprovalStep(pool, instanceId, stepDef, context) {
        try {
            const instance = await this._getInstance(pool, instanceId);
            const recipients = await this._resolveRecipients(pool, stepDef.Id, instance, context);

            // First TO recipient is the approver
            const approver = recipients.find(r => r.emailTarget === 'TO');
            if (!approver) {
                console.error('[WORKFLOW] No approver found for approval step');
                // Skip this step and advance
                await this._advanceToNext(pool, instanceId, stepDef, context);
                return;
            }

            // Assign the approver
            await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .input('stepId', sql.Int, stepDef.Id)
                .input('assignedTo', sql.NVarChar, approver.email)
                .input('assignedToName', sql.NVarChar, approver.name || null)
                .query(`
                    UPDATE WorkflowInstanceSteps
                    SET AssignedTo = @assignedTo, AssignedToName = @assignedToName
                    WHERE InstanceId = @instanceId AND StepId = @stepId
                `);

            // Update instance status
            const pendingStatus = `Pending ${stepDef.StepName}`;
            await pool.request()
                .input('id', sql.Int, instanceId)
                .input('status', sql.NVarChar, pendingStatus)
                .query(`UPDATE WorkflowInstances SET CurrentStatus = @status, UpdatedAt = GETDATE() WHERE Id = @id`);

            // Send approval email based on method
            if (stepDef.ApprovalMethod === 'PUBLIC_LINK' || stepDef.ApprovalMethod === 'BOTH') {
                await this._sendPublicApprovalEmail(pool, instance, stepDef, approver, context);
            }

            if (stepDef.ApprovalMethod === 'IN_APP' || stepDef.ApprovalMethod === 'BOTH') {
                // Create in-app notification
                await this._createNotification(pool, {
                    userEmail: approver.email,
                    type: 'approval',
                    title: `Approval Required - ${instance.FormCode.replace(/_/g, ' ')}`,
                    message: `${context.submitter.name || context.submitter.email} submitted a ${instance.FormCode.replace(/_/g, ' ').toLowerCase()} that needs your approval.`,
                    link: `/admin/workflow-approval/${instanceId}`
                });
            }

            await this._logAudit(pool, {
                instanceId, stepId: stepDef.Id,
                action: 'APPROVAL_REQUESTED',
                details: { approver: approver.email, method: stepDef.ApprovalMethod },
                newStatus: pendingStatus
            });

            // Do NOT auto-advance — wait for approval action

        } catch (error) {
            console.error('[WORKFLOW] Approval step error:', error);
        }
    }

    // =============================================
    // PRIVATE: Status change step execution
    // =============================================

    async _executeStatusChangeStep(pool, instanceId, stepDef, context) {
        try {
            const instance = await this._getInstance(pool, instanceId);
            const previousStatus = instance.CurrentStatus;
            const newStatus = stepDef.TargetStatus;

            // Update workflow instance
            await pool.request()
                .input('id', sql.Int, instanceId)
                .input('status', sql.NVarChar, newStatus)
                .query(`UPDATE WorkflowInstances SET CurrentStatus = @status, UpdatedAt = GETDATE() WHERE Id = @id`);

            // Update source record
            await this._updateRecordStatus(pool, instance.RecordTable, instance.RecordId, newStatus);

            // Mark step completed
            await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .input('stepId', sql.Int, stepDef.Id)
                .query(`
                    UPDATE WorkflowInstanceSteps
                    SET Status = 'Completed', CompletedAt = GETDATE()
                    WHERE InstanceId = @instanceId AND StepId = @stepId
                `);

            await this._logAudit(pool, {
                instanceId, stepId: stepDef.Id,
                action: 'STATUS_CHANGED',
                previousStatus, newStatus
            });

            // Auto-advance
            await this._advanceToNext(pool, instanceId, stepDef, context);

        } catch (error) {
            console.error('[WORKFLOW] Status change step error:', error);
        }
    }

    // =============================================
    // PRIVATE: Notification step execution
    // =============================================

    async _executeNotificationStep(pool, instanceId, stepDef, context) {
        try {
            const instance = await this._getInstance(pool, instanceId);
            const recipients = await this._resolveRecipients(pool, stepDef.Id, instance, context);

            for (const recipient of recipients) {
                await this._createNotification(pool, {
                    userEmail: recipient.email,
                    type: 'info',
                    title: `${instance.FormCode.replace(/_/g, ' ')} - ${stepDef.StepName}`,
                    message: `A ${instance.FormCode.replace(/_/g, ' ').toLowerCase()} was submitted by ${instance.SubmittedByName || instance.SubmittedByEmail} for ${instance.StoreName || 'N/A'}.`,
                    link: instance.ModulePath ? `${instance.ModulePath}/view/${instance.RecordId}` : null
                });
            }

            // Mark completed
            await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .input('stepId', sql.Int, stepDef.Id)
                .query(`
                    UPDATE WorkflowInstanceSteps
                    SET Status = 'Completed', CompletedAt = GETDATE()
                    WHERE InstanceId = @instanceId AND StepId = @stepId
                `);

            await this._advanceToNext(pool, instanceId, stepDef, context);

        } catch (error) {
            console.error('[WORKFLOW] Notification step error:', error);
        }
    }

    // =============================================
    // PRIVATE: Resolve dynamic recipients
    // =============================================

    async _resolveRecipients(pool, stepId, instance, context) {
        const result = await pool.request()
            .input('stepId', sql.Int, stepId)
            .query(`
                SELECT RecipientType, UserId, UserEmail, RoleId, RoleName,
                       AssignmentRole, FieldName, EmailTarget
                FROM WorkflowStepRecipients
                WHERE StepId = @stepId AND IsActive = 1
            `);

        const recipients = [];

        for (const rec of result.recordset) {
            switch (rec.RecipientType) {
                case 'USER':
                    if (rec.UserEmail) {
                        recipients.push({ email: rec.UserEmail, name: null, emailTarget: rec.EmailTarget });
                    }
                    break;

                case 'ROLE': {
                    const roleUsers = await pool.request()
                        .input('roleName', sql.NVarChar, rec.RoleName)
                        .query(`
                            SELECT u.Email, u.DisplayName
                            FROM Users u
                            JOIN UserRoleAssignments ura ON u.Id = ura.UserId
                            JOIN UserRoles ur ON ura.RoleId = ur.Id
                            WHERE ur.RoleName = @roleName AND u.IsActive = 1
                        `);
                    for (const ru of roleUsers.recordset) {
                        recipients.push({ email: ru.Email, name: ru.DisplayName, emailTarget: rec.EmailTarget });
                    }
                    break;
                }

                case 'STORE_ASSIGNMENT': {
                    const assignment = await this._getStoreAssignment(pool, instance.StoreId, rec.AssignmentRole);
                    if (assignment) {
                        recipients.push({ email: assignment.email, name: assignment.name, emailTarget: rec.EmailTarget });
                    }
                    break;
                }

                case 'SUBMITTER':
                    recipients.push({
                        email: instance.SubmittedByEmail,
                        name: instance.SubmittedByName,
                        emailTarget: rec.EmailTarget
                    });
                    break;

                case 'SUBMITTER_MANAGER': {
                    const manager = await this._getSubmitterManager(pool, instance.SubmittedBy);
                    if (manager) {
                        recipients.push({ email: manager.email, name: manager.name, emailTarget: rec.EmailTarget });
                    }
                    break;
                }

                case 'FORM_FIELD': {
                    const metaData = context.metaData || {};
                    const fieldEmail = metaData[rec.FieldName];
                    if (fieldEmail) {
                        recipients.push({ email: fieldEmail, name: null, emailTarget: rec.EmailTarget });
                    }
                    break;
                }
            }
        }

        // Deduplicate by email
        const seen = new Set();
        return recipients.filter(r => {
            const key = `${r.email}-${r.emailTarget}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // =============================================
    // PRIVATE: Store assignment lookup
    // =============================================

    async _getStoreAssignment(pool, storeId, role) {
        if (!storeId) return null;
        try {
            const result = await pool.request()
                .input('storeId', sql.Int, storeId)
                .input('role', sql.NVarChar, role)
                .query(`
                    SELECT u.Email, u.DisplayName
                    FROM StoreManagerAssignments sma
                    JOIN Users u ON sma.UserId = u.Id
                    WHERE sma.StoreId = @storeId AND sma.Role = @role AND u.IsActive = 1
                `);
            if (result.recordset.length > 0) {
                return { email: result.recordset[0].Email, name: result.recordset[0].DisplayName };
            }
            return null;
        } catch {
            return null;
        }
    }

    async _getSubmitterManager(pool, userId) {
        if (!userId) return null;
        try {
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT m.Email, m.DisplayName
                    FROM Users u
                    JOIN Users m ON u.ManagerId = m.Id
                    WHERE u.Id = @userId AND m.IsActive = 1
                `);
            if (result.recordset.length > 0) {
                return { email: result.recordset[0].Email, name: result.recordset[0].DisplayName };
            }
            return null;
        } catch {
            return null;
        }
    }

    // =============================================
    // PRIVATE: Evaluate conditions to skip/include steps
    // =============================================

    async _evaluateConditions(pool, steps, metaData) {
        const active = [];

        for (const step of steps) {
            const conditions = await pool.request()
                .input('stepId', sql.Int, step.Id)
                .query(`
                    SELECT FieldName, Operator, Value, ActionOnMatch
                    FROM WorkflowConditions
                    WHERE StepId = @stepId AND IsActive = 1
                    ORDER BY Priority ASC
                `);

            if (conditions.recordset.length === 0) {
                // No conditions → always include
                active.push(step);
                continue;
            }

            let include = true;
            for (const cond of conditions.recordset) {
                const fieldValue = String(metaData[cond.FieldName] || '');
                const condValue = String(cond.Value);
                let matched = false;

                switch (cond.Operator) {
                    case 'equals':
                        matched = fieldValue.toLowerCase() === condValue.toLowerCase();
                        break;
                    case 'not_equals':
                        matched = fieldValue.toLowerCase() !== condValue.toLowerCase();
                        break;
                    case 'contains':
                        matched = fieldValue.toLowerCase().includes(condValue.toLowerCase());
                        break;
                    case 'greater_than':
                        matched = parseFloat(fieldValue) > parseFloat(condValue);
                        break;
                    case 'less_than':
                        matched = parseFloat(fieldValue) < parseFloat(condValue);
                        break;
                    case 'in':
                        matched = condValue.split(',').map(v => v.trim().toLowerCase()).includes(fieldValue.toLowerCase());
                        break;
                }

                if (matched) {
                    if (cond.ActionOnMatch === 'SKIP') { include = false; break; }
                    if (cond.ActionOnMatch === 'EXECUTE') { include = true; }
                }
            }

            if (include) active.push(step);
        }

        return active;
    }

    // =============================================
    // PRIVATE: Auto-advance to next step
    // =============================================

    async _advanceToNext(pool, instanceId, currentStepDef, context) {
        const nextStep = await this._getNextStep(pool, instanceId, currentStepDef.StepOrder);

        if (nextStep) {
            const stepDef = await this._getStepDefinition(pool, nextStep.StepId);

            await pool.request()
                .input('id', sql.Int, instanceId)
                .input('stepId', sql.Int, nextStep.StepId)
                .query(`UPDATE WorkflowInstances SET CurrentStepId = @stepId, UpdatedAt = GETDATE() WHERE Id = @id`);

            await this._executeStep(pool, instanceId, stepDef, context);
        } else {
            // No more steps — workflow complete
            const instance = await this._getInstance(pool, instanceId);
            const completeStatus = await this._getStatusForAction(pool, instance.WorkflowId, 'Completed') || 'Completed';

            await pool.request()
                .input('id', sql.Int, instanceId)
                .input('status', sql.NVarChar, completeStatus)
                .query(`
                    UPDATE WorkflowInstances
                    SET CurrentStatus = @status, CurrentStepId = NULL, CompletedAt = GETDATE(), UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);

            await this._updateRecordStatus(pool, instance.RecordTable, instance.RecordId, completeStatus);

            await this._logAudit(pool, {
                instanceId, action: 'WORKFLOW_COMPLETED',
                details: { autoCompleted: true },
                newStatus: completeStatus
            });

            console.log(`[WORKFLOW] Instance #${instanceId} completed`);
        }
    }

    // =============================================
    // PRIVATE: Send public approval email
    // =============================================

    async _sendPublicApprovalEmail(pool, instance, stepDef, approver, context) {
        const token = this.generateApprovalToken(instance.Id, stepDef.Id, approver.email);
        const approveUrl = `${this.appUrl}/public/approve/workflow/${instance.Id}?stepId=${stepDef.Id}&email=${encodeURIComponent(approver.email)}&token=${token}&action=approve`;
        const rejectUrl = `${this.appUrl}/public/approve/workflow/${instance.Id}?stepId=${stepDef.Id}&email=${encodeURIComponent(approver.email)}&token=${token}&action=reject`;

        // Try to use the step's email template for subject/context
        let formName = instance.FormCode.replace(/_/g, ' ');
        let storeName = instance.StoreName || 'N/A';
        let submitterName = instance.SubmittedByName || instance.SubmittedByEmail;

        const subject = `🔔 ${formName} - Pending Your Approval - ${storeName}`;

        const allowedActions = stepDef.AllowedActions ? JSON.parse(stepDef.AllowedActions) : ['Approve', 'Reject'];
        const hasDelegate = allowedActions.includes('Delegate');
        const hasRequestInfo = allowedActions.includes('RequestInfo');

        let extraButtons = '';
        if (hasRequestInfo) {
            extraButtons += `<a href="${approveUrl.replace('action=approve', 'action=requestinfo')}" style="display: inline-block; padding: 14px 25px; background: #ffc107; color: #333; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 5px;">❓ Request Info</a>`;
        }

        const body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">📋 ${formName}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Pending your approval as ${stepDef.StepName}</p>
        </div>
        <div style="padding: 25px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666; width: 140px;">Form</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>${formName}</strong></td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Store</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;">${storeName}</td></tr>
                <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Submitted By</td><td style="padding: 10px 0; border-bottom: 1px solid #eee;">${submitterName}</td></tr>
                <tr><td style="padding: 10px 0; color: #666;">Date</td><td style="padding: 10px 0;">${new Date().toLocaleDateString('en-GB')}</td></tr>
            </table>
            <div style="margin-top: 25px; text-align: center;">
                <a href="${approveUrl}" style="display: inline-block; padding: 14px 35px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 5px;">✅ Approve</a>
                <a href="${rejectUrl}" style="display: inline-block; padding: 14px 35px; background: #dc3545; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 5px;">❌ Reject</a>
                ${extraButtons}
            </div>
        </div>
        <div style="padding: 15px; text-align: center; color: #999; font-size: 12px; background: #f8f9fa;">
            This is an automated message from the Operational Excellence Application.
        </div>
    </div>
</body>
</html>`;

        await this._sendEmail({
            to: approver.email,
            subject,
            body,
            accessToken: context.accessToken
        });
    }

    // =============================================
    // PRIVATE: Send delegation notification
    // =============================================

    async _sendDelegationNotification(pool, instance, step, delegateTo, delegatedByName, accessToken) {
        const formName = instance.FormCode.replace(/_/g, ' ');
        await this._createNotification(pool, {
            userEmail: delegateTo,
            type: 'approval',
            title: `Approval Delegated to You - ${formName}`,
            message: `${delegatedByName || 'Someone'} has delegated an approval to you for a ${formName.toLowerCase()}.`,
            link: `/admin/workflow-approval/${instance.Id}`
        });
    }

    // =============================================
    // PRIVATE: Helper methods
    // =============================================

    async _getInstance(pool, instanceId) {
        const result = await pool.request()
            .input('id', sql.Int, instanceId)
            .query(`
                SELECT wi.*, wd.FormName, wd.ModulePath, wd.WorkflowType
                FROM WorkflowInstances wi
                JOIN WorkflowDefinitions wd ON wi.WorkflowId = wd.Id
                WHERE wi.Id = @id
            `);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    async _getCurrentInstanceStep(pool, instanceId) {
        const result = await pool.request()
            .input('instanceId', sql.Int, instanceId)
            .query(`
                SELECT TOP 1 * FROM WorkflowInstanceSteps
                WHERE InstanceId = @instanceId AND Status IN ('InProgress', 'Pending', 'InfoRequested')
                ORDER BY StepOrder ASC
            `);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    async _getNextStep(pool, instanceId, currentOrder) {
        const result = await pool.request()
            .input('instanceId', sql.Int, instanceId)
            .input('currentOrder', sql.Int, currentOrder)
            .query(`
                SELECT TOP 1 * FROM WorkflowInstanceSteps
                WHERE InstanceId = @instanceId AND StepOrder > @currentOrder AND Status = 'Pending'
                ORDER BY StepOrder ASC
            `);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    async _getStepDefinition(pool, stepId) {
        const result = await pool.request()
            .input('id', sql.Int, stepId)
            .query(`SELECT * FROM WorkflowSteps WHERE Id = @id`);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    async _getEmailTemplate(pool, templateKey) {
        const result = await pool.request()
            .input('key', sql.NVarChar, templateKey)
            .query(`SELECT SubjectTemplate, BodyTemplate FROM EmailTemplates WHERE TemplateKey = @key AND IsActive = 1`);
        return result.recordset.length > 0 ? result.recordset[0] : null;
    }

    async _getStatusForAction(pool, workflowId, label) {
        const result = await pool.request()
            .input('workflowId', sql.Int, workflowId)
            .input('label', sql.NVarChar, `%${label}%`)
            .query(`
                SELECT StatusLabel FROM WorkflowStatusMappings
                WHERE WorkflowId = @workflowId
                AND (StatusLabel LIKE @label OR (IsFinal = 1 AND @label LIKE '%Completed%'))
            `);
        return result.recordset.length > 0 ? result.recordset[0].StatusLabel : null;
    }

    async _updateRecordStatus(pool, tableName, recordId, status) {
        // Safety: only allow known table names to prevent SQL injection
        const allowedTables = [
            'TheftIncidents', 'ExtraCleaningRequests', 'ProductionExtrasRequests',
            'OHSIncidents', 'Complaints', 'PostEvacuationDrills', 'WeeklyThirdPartyFeedback',
            'FireEquipmentInspections', 'ORAAssessments', 'CameraRequests',
            'SecurityPostVisitReports', 'LegalCases', 'InternalInvestigations',
            'LostAndFoundItems', 'SecurityDailyReporting',
            'ThirdPartyBlacklist', 'Security_AttendanceReports', 'Security_CleaningChecklists',
            'DailyTask_Entries', 'Security_DeliveryLogs', 'Security_EntranceForms',
            'Security_ParkingViolations', 'Security_PatrolSheets', 'Security_Checklist_Entries',
            'Security_VisitorCars', 'WeeklySchedule_Entries', 'FiveDaysEntries'
        ];

        if (!allowedTables.includes(tableName)) {
            console.warn(`[WORKFLOW] Table ${tableName} not in allowed list, skipping status update`);
            return;
        }

        // Some tables use a different column name for status
        const statusColumnMap = {
            'ExtraCleaningRequests': 'OverallStatus'
        };
        const statusColumn = statusColumnMap[tableName] || 'Status';

        try {
            await pool.request()
                .input('status', sql.NVarChar, status)
                .input('id', sql.Int, recordId)
                .query(`UPDATE [${tableName}] SET [${statusColumn}] = @status WHERE Id = @id`);
            console.log(`[WORKFLOW] Updated ${tableName} #${recordId} ${statusColumn} to: ${status}`);
        } catch (error) {
            console.warn(`[WORKFLOW] Could not update ${tableName} status:`, error.message);
        }
    }

    _buildTemplateData(instance, context) {
        const meta = context.metaData || {};
        // Build a viewUrl from the module path if available
        const formCode = instance.FormCode;
        const recordId = instance.RecordId;
        
        // Map form codes to their module URL paths
        const urlMap = {
            'THEFT_INCIDENT': '/stores/theft-incident/reports/',
            'EXTRA_CLEANING': '/stores/extra-cleaning/history',
            'COMPLAINT': '/stores/complaint/history',
            'EVACUATION_DRILL': '/stores/evacuation-drill/history',
            'LOST_AND_FOUND': '/stores/lost-and-found/history',
            'OHS_INCIDENT': '/stores/ohs-incident/history',
            'PRODUCTION_EXTRAS': '/stores/production-extras/history',
            'WEEKLY_FEEDBACK': '/stores/weekly-feedback/history',
            'PARKING_VIOLATION': '/security-services/parking-violation/history',
            'DELIVERY_LOG': '/security-services/delivery-log/history',
            'PATROL_SHEET': '/security-services/patrol-sheet/history',
            'ENTRANCE_FORM': '/security-services/entrance-form/history',
            'ATTENDANCE_REPORT': '/security-services/attendance-report/history',
            'VISITOR_CARS': '/security-services/visitor-cars/history',
            'SECURITY_CHECKLIST': '/security-services/security-checklist/history',
            'CLEANING_CHECKLIST': '/security-services/cleaning-checklist/history',
            'DAILY_TASKS': '/security-services/daily-tasks/history',
            'WEEKLY_SCHEDULE': '/security-services/weekly-schedule/history',
            'INTERNAL_INVESTIGATIONS': '/security-emp/internal-investigations/history',
            'LEGAL_CASES': '/security-emp/legal-cases/history',
            'BLACKLIST': '/security-emp/blacklist/history',
            'CAMERA_REQUEST': '/security-emp/camera-request/history',
            'POST_VISIT_REPORT': '/security-emp/post-visit-report/history',
            'SECURITY_DAILY_REPORT': '/security-emp/daily-reporting/history',
            'DAILY_REPORTING': '/security-emp/daily-reporting/history',
            'VISIT_SCHEDULE': '/security-emp/calendar',
            'FIVE_DAYS': '/stores/five-days',
            'THEFT_INCIDENT': '/stores/theft-incident',
            'ORA_ASSESSMENT': '/ohs/ora',
            'FIRE_EQUIPMENT': '/ohs/fire-equipment',
            'SEC_DAILY_TASKS': '/security/daily-tasks/history',
            'EMPLOYEE_SCHEDULE': '/personnel/schedule-attendance/history',
            'SECURITY_SCHEDULE': '/personnel/security-schedule/history',
            'THIRDPARTY_SCHEDULE': '/personnel/thirdparty-schedule/history',
            'THIRDPARTY_ATTENDANCE': '/personnel/thirdparty-attendance'
        };
        const path = urlMap[formCode] || '';
        const viewUrl = path ? `${this.appUrl}${path}` : this.appUrl;

        return {
            formCode,
            formName: formCode.replace(/_/g, ' '),
            storeName: instance.StoreName || meta.storeName || 'N/A',
            storeId: instance.StoreId || '',
            submittedBy: instance.SubmittedByName || instance.SubmittedByEmail,
            submittedByEmail: instance.SubmittedByEmail,
            submittedDate: new Date().toLocaleDateString('en-GB'),
            recordId: instance.RecordId,
            appUrl: this.appUrl,
            viewUrl,
            year: new Date().getFullYear(),
            recipientName: 'Team',
            reportedBy: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            loggedBy: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            requestedBy: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            inspector: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            assignedBy: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            publishedBy: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            updatedBy: instance.SubmittedByName || instance.SubmittedByEmail || 'N/A',
            ...meta
        };
    }

    _replaceVariables(template, data) {
        if (!template) return '';
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value != null ? String(value) : '');
        }
        return result;
    }

    async _sendEmail({ to, subject, body, cc, accessToken }) {
        if (accessToken) {
            return emailService.sendEmail({ to, subject, body, cc, accessToken });
        } else {
            return emailService.sendEmailWithAppToken({ to, subject, body, cc });
        }
    }

    async _createNotification(pool, { userId, userEmail, type, title, message, link }) {
        try {
            await pool.request()
                .input('userId', sql.Int, userId || null)
                .input('userEmail', sql.NVarChar, userEmail)
                .input('type', sql.NVarChar, type)
                .input('title', sql.NVarChar, title)
                .input('message', sql.NVarChar, message)
                .input('link', sql.NVarChar, link || null)
                .query(`
                    INSERT INTO Notifications (UserId, UserEmail, Type, Title, Message, Link, IsRead, CreatedAt)
                    VALUES (@userId, @userEmail, @type, @title, @message, @link, 0, GETDATE())
                `);
        } catch (error) {
            console.error('[WORKFLOW] Error creating notification:', error.message);
        }
    }

    async _logAudit(pool, { instanceId, stepId, action, actionBy, actionByName, details, previousStatus, newStatus, ipAddress }) {
        try {
            await pool.request()
                .input('instanceId', sql.Int, instanceId)
                .input('stepId', sql.Int, stepId || null)
                .input('action', sql.NVarChar, action)
                .input('actionBy', sql.NVarChar, actionBy || null)
                .input('actionByName', sql.NVarChar, actionByName || null)
                .input('details', sql.NVarChar, details ? JSON.stringify(details) : null)
                .input('previousStatus', sql.NVarChar, previousStatus || null)
                .input('newStatus', sql.NVarChar, newStatus || null)
                .input('ipAddress', sql.NVarChar, ipAddress || null)
                .query(`
                    INSERT INTO WorkflowAuditLog
                        (InstanceId, StepId, Action, ActionBy, ActionByName, Details, PreviousStatus, NewStatus, IpAddress)
                    VALUES
                        (@instanceId, @stepId, @action, @actionBy, @actionByName, @details, @previousStatus, @newStatus, @ipAddress)
                `);
        } catch (error) {
            console.error('[WORKFLOW] Audit log error:', error.message);
        }
    }
}

// Export singleton
module.exports = new WorkflowEngine();
