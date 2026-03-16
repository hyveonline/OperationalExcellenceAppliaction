/**
 * Department Escalation Service
 * Handles escalation of inspection items to departments
 * Created: 2026-03-15
 */

const sql = require('mssql');
const emailService = require('./email-service');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

const BASE_URL = process.env.BASE_URL || 'https://oeapp-uat.gmrlapps.com';

// ============================================================================
// STATUS TRACKING
// ============================================================================
const serviceStatus = {
    lastRunTime: null,
    lastRunStatus: null,
    stats: {
        escalationsCreated: 0,
        notificationsSent: 0,
        remindersSent: 0,
        errors: 0
    }
};

function getServiceStatus() {
    return { ...serviceStatus };
}

// ============================================================================
// ESCALATE ITEM TO DEPARTMENT
// ============================================================================

/**
 * Create a department escalation for an inspection response item
 * @param {string} module - 'OE' or 'OHS'
 * @param {number} responseId - The response ID from OE_InspectionResponses or OHS_InspectionResponses
 * @param {string} department - Department name
 * @param {object} escalatedBy - { id, name, email } of the user escalating
 * @param {Date} deadline - Optional deadline for the department action
 */
async function escalateToDepepartment(module, responseId, department, escalatedBy, deadline = null) {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // OE uses OE_InspectionItems, OHS uses OHS_InspectionResponses
        const responseTable = module === 'OHS' ? 'OHS_InspectionResponses' : 'OE_InspectionItems';
        const inspectionTable = module === 'OHS' ? 'OHS_Inspections' : 'OE_Inspections';
        const itemsTable = module === 'OHS' ? 'OHS_TemplateItems' : 'OE_InspectionTemplateItems';
        const inspectionPath = module === 'OHS' ? 'ohs-inspection' : 'oe-inspection';
        
        // Get response details with inspection info
        const responseResult = await pool.request()
            .input('responseId', sql.Int, responseId)
            .query(`
                SELECT 
                    r.Id as ResponseId,
                    r.InspectionId,
                    ${module === 'OHS' ? 'r.ItemId' : 'r.TemplateItemId as ItemId'},
                    r.Finding,
                    ${module === 'OHS' ? 'r.CR' : 'r.CorrectedAction'} as CorrectiveAction,
                    r.Priority,
                    r.Department,
                    r.Deadline,
                    i.StoreId,
                    i.DocumentNumber,
                    i.ActionPlanDeadline,
                    s.StoreName,
                    ti.Title as QuestionTitle,
                    ti.ReferenceValue
                FROM ${responseTable} r
                INNER JOIN ${inspectionTable} i ON r.InspectionId = i.Id
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN ${itemsTable} ti ON ${module === 'OHS' ? 'r.ItemId = ti.Id' : 'r.TemplateItemId = ti.Id'}
                WHERE r.Id = @responseId
            `);
        
        if (responseResult.recordset.length === 0) {
            throw new Error(`Response ${responseId} not found`);
        }
        
        const response = responseResult.recordset[0];
        const itemDeadline = deadline || response.Deadline || response.ActionPlanDeadline;
        
        // Check if already escalated
        const existingResult = await pool.request()
            .input('module', sql.NVarChar, module)
            .input('responseId', sql.Int, responseId)
            .query(`
                SELECT Id, Status FROM DepartmentEscalations 
                WHERE Module = @module AND ResponseId = @responseId
            `);
        
        let escalationId;
        let isNew = false;
        
        if (existingResult.recordset.length > 0) {
            // Update existing escalation
            escalationId = existingResult.recordset[0].Id;
            await pool.request()
                .input('id', sql.Int, escalationId)
                .input('department', sql.NVarChar, department)
                .input('deadline', sql.Date, itemDeadline)
                .input('finding', sql.NVarChar, response.Finding)
                .input('correctiveAction', sql.NVarChar, response.CorrectiveAction)
                .input('priority', sql.NVarChar, response.Priority)
                .query(`
                    UPDATE DepartmentEscalations 
                    SET Department = @department,
                        Deadline = @deadline,
                        Finding = @finding,
                        CorrectiveAction = @correctiveAction,
                        Priority = @priority,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
            console.log(`[Dept Escalation] Updated escalation ${escalationId} for ${module} response ${responseId}`);
        } else {
            // Create new escalation
            isNew = true;
            const insertResult = await pool.request()
                .input('module', sql.NVarChar, module)
                .input('inspectionId', sql.Int, response.InspectionId)
                .input('responseId', sql.Int, responseId)
                .input('itemId', sql.Int, response.ItemId)
                .input('storeId', sql.Int, response.StoreId)
                .input('storeName', sql.NVarChar, response.StoreName)
                .input('documentNumber', sql.NVarChar, response.DocumentNumber)
                .input('referenceValue', sql.NVarChar, response.ReferenceValue)
                .input('questionTitle', sql.NVarChar, response.QuestionTitle)
                .input('finding', sql.NVarChar, response.Finding)
                .input('correctiveAction', sql.NVarChar, response.CorrectiveAction)
                .input('priority', sql.NVarChar, response.Priority)
                .input('department', sql.NVarChar, department)
                .input('deadline', sql.Date, itemDeadline)
                .input('escalatedBy', sql.Int, escalatedBy?.id)
                .input('escalatedByName', sql.NVarChar, escalatedBy?.name)
                .input('escalatedByEmail', sql.NVarChar, escalatedBy?.email)
                .query(`
                    INSERT INTO DepartmentEscalations (
                        Module, InspectionId, ResponseId, ItemId, StoreId, StoreName, DocumentNumber,
                        ReferenceValue, QuestionTitle, Finding, CorrectiveAction, Priority,
                        Department, Deadline, EscalatedBy, EscalatedByName, EscalatedByEmail
                    )
                    OUTPUT INSERTED.Id
                    VALUES (
                        @module, @inspectionId, @responseId, @itemId, @storeId, @storeName, @documentNumber,
                        @referenceValue, @questionTitle, @finding, @correctiveAction, @priority,
                        @department, @deadline, @escalatedBy, @escalatedByName, @escalatedByEmail
                    )
                `);
            
            escalationId = insertResult.recordset[0].Id;
            serviceStatus.stats.escalationsCreated++;
            console.log(`[Dept Escalation] Created escalation ${escalationId} for ${module} response ${responseId} to ${department}`);
        }
        
        // Send notification to department contacts (only for new escalations)
        if (isNew) {
            try {
                await sendDepartmentNotification(pool, escalationId, module, inspectionPath);
            } catch (emailErr) {
                console.error(`[Dept Escalation] Failed to send notification:`, emailErr.message);
            }
        }
        
        return { success: true, escalationId, isNew };
        
    } catch (err) {
        console.error('[Dept Escalation] Error:', err);
        serviceStatus.stats.errors++;
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Remove department escalation when checkbox is unchecked
 */
async function removeEscalation(module, responseId) {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('module', sql.NVarChar, module)
            .input('responseId', sql.Int, responseId)
            .query(`
                DELETE FROM DepartmentEscalations 
                WHERE Module = @module AND ResponseId = @responseId AND Status = 'Pending'
            `);
        
        console.log(`[Dept Escalation] Removed escalation for ${module} response ${responseId}`);
        return { success: true };
        
    } catch (err) {
        console.error('[Dept Escalation] Error removing escalation:', err);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

// ============================================================================
// SEND NOTIFICATIONS
// ============================================================================

/**
 * Send notification email to department contacts
 */
async function sendDepartmentNotification(pool, escalationId, module, inspectionPath) {
    // Get escalation details
    const escResult = await pool.request()
        .input('id', sql.Int, escalationId)
        .query(`SELECT * FROM DepartmentEscalations WHERE Id = @id`);
    
    if (escResult.recordset.length === 0) return;
    const esc = escResult.recordset[0];
    
    // Get department contacts
    const contactsResult = await pool.request()
        .input('department', sql.NVarChar, esc.Department)
        .query(`
            SELECT ContactEmail, ContactName, ContactRole 
            FROM DepartmentContacts 
            WHERE DepartmentName = @department AND IsActive = 1 AND ReceiveEscalationAlerts = 1
        `);
    
    if (contactsResult.recordset.length === 0) {
        console.log(`[Dept Escalation] No contacts found for department ${esc.Department}`);
        return;
    }
    
    // Get email template
    const templateResult = await pool.request()
        .input('key', sql.NVarChar, 'DEPARTMENT_ESCALATION')
        .query(`
            SELECT SubjectTemplate, BodyTemplate 
            FROM EmailTemplates 
            WHERE TemplateKey = @key AND IsActive = 1
        `);
    
    if (templateResult.recordset.length === 0) {
        console.log('[Dept Escalation] Email template not found');
        return;
    }
    
    const template = templateResult.recordset[0];
    
    // Template data
    const templateData = {
        module: module,
        department: esc.Department,
        departmentName: esc.Department,
        storeName: esc.StoreName,
        documentNumber: esc.DocumentNumber,
        referenceValue: esc.ReferenceValue || '-',
        questionTitle: esc.QuestionTitle || '-',
        finding: esc.Finding || 'No finding specified',
        correctiveAction: esc.CorrectiveAction || 'No action specified',
        priority: esc.Priority || 'Medium',
        deadline: esc.Deadline ? new Date(esc.Deadline).toLocaleDateString() : 'Not set',
        escalatedByName: esc.EscalatedByName || 'System',
        escalatedAt: new Date(esc.EscalatedAt).toLocaleString(),
        actionPlanUrl: `${BASE_URL}/${inspectionPath}/action-plan/${esc.InspectionId}`
    };
    
    // Replace template variables
    let subject = template.SubjectTemplate;
    let body = template.BodyTemplate;
    for (const [key, value] of Object.entries(templateData)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value || '');
        body = body.replace(regex, value || '');
    }
    
    // Send to all contacts
    for (const contact of contactsResult.recordset) {
        try {
            if (emailService && emailService.sendEmail) {
                await emailService.sendEmail({
                    to: contact.ContactEmail,
                    subject: subject,
                    html: body
                });
                console.log(`[Dept Escalation] Sent notification to ${contact.ContactEmail}`);
                serviceStatus.stats.notificationsSent++;
            }
        } catch (emailErr) {
            console.error(`[Dept Escalation] Failed to send to ${contact.ContactEmail}:`, emailErr.message);
        }
    }
    
    // Update notification sent timestamp
    await pool.request()
        .input('id', sql.Int, escalationId)
        .query(`UPDATE DepartmentEscalations SET NotificationSentAt = GETDATE() WHERE Id = @id`);
}

// ============================================================================
// SCHEDULER - CHECK FOR OVERDUE/PENDING ESCALATIONS
// ============================================================================

/**
 * Check for pending department escalations and send reminders
 * Called by the main escalation scheduler
 */
async function checkDepartmentEscalations() {
    let pool;
    const startTime = Date.now();
    
    try {
        pool = await sql.connect(dbConfig);
        
        console.log('[Dept Escalation] Checking for pending department escalations...');
        
        let remindersSent = 0;
        
        // Find pending escalations that need reminders
        // - Status is Pending
        // - Either deadline passed or 3+ days since escalation with no reminder in last 3 days
        const pendingResult = await pool.request().query(`
            SELECT de.*, 
                   DATEDIFF(day, de.Deadline, GETDATE()) as DaysOverdue,
                   DATEDIFF(day, de.EscalatedAt, GETDATE()) as DaysSinceEscalation,
                   DATEDIFF(day, ISNULL(de.LastReminderSentAt, de.EscalatedAt), GETDATE()) as DaysSinceLastReminder
            FROM DepartmentEscalations de
            WHERE de.Status IN ('Pending', 'Acknowledged', 'InProgress')
              AND (
                  -- Overdue items
                  (de.Deadline IS NOT NULL AND de.Deadline < GETDATE())
                  OR
                  -- Pending for more than 3 days without reminder in last 3 days
                  (DATEDIFF(day, ISNULL(de.LastReminderSentAt, de.EscalatedAt), GETDATE()) >= 3)
              )
        `);
        
        console.log(`[Dept Escalation] Found ${pendingResult.recordset.length} escalations needing reminders`);
        
        for (const esc of pendingResult.recordset) {
            try {
                const inspectionPath = esc.Module === 'OHS' ? 'ohs-inspection' : 'oe-inspection';
                
                // Get department contacts
                const contactsResult = await pool.request()
                    .input('department', sql.NVarChar, esc.Department)
                    .query(`
                        SELECT ContactEmail, ContactName 
                        FROM DepartmentContacts 
                        WHERE DepartmentName = @department AND IsActive = 1 AND ReceiveOverdueAlerts = 1
                    `);
                
                if (contactsResult.recordset.length === 0) continue;
                
                // Get reminder template
                const templateResult = await pool.request()
                    .input('key', sql.NVarChar, 'DEPARTMENT_REMINDER')
                    .query(`
                        SELECT SubjectTemplate, BodyTemplate 
                        FROM EmailTemplates 
                        WHERE TemplateKey = @key AND IsActive = 1
                    `);
                
                if (templateResult.recordset.length === 0) continue;
                const template = templateResult.recordset[0];
                
                // Determine status message
                let daysStatus = '';
                if (esc.DaysOverdue > 0) {
                    daysStatus = `${esc.DaysOverdue} day(s) overdue`;
                } else if (esc.DaysOverdue === 0) {
                    daysStatus = 'due today';
                } else {
                    daysStatus = `${Math.abs(esc.DaysOverdue)} day(s) remaining`;
                }
                
                let statusText = esc.DaysOverdue > 0 ? 'is overdue' : 'requires action';
                
                const templateData = {
                    module: esc.Module,
                    department: esc.Department,
                    departmentName: esc.Department,
                    storeName: esc.StoreName,
                    documentNumber: esc.DocumentNumber,
                    finding: esc.Finding || 'No finding specified',
                    deadline: esc.Deadline ? new Date(esc.Deadline).toLocaleDateString() : 'Not set',
                    daysStatus: daysStatus,
                    status: statusText,
                    escalatedAt: new Date(esc.EscalatedAt).toLocaleDateString(),
                    reminderCount: esc.ReminderCount + 1,
                    actionPlanUrl: `${BASE_URL}/${inspectionPath}/action-plan/${esc.InspectionId}`
                };
                
                // Replace template variables
                let subject = template.SubjectTemplate;
                let body = template.BodyTemplate;
                for (const [key, value] of Object.entries(templateData)) {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    subject = subject.replace(regex, value || '');
                    body = body.replace(regex, value || '');
                }
                
                // Send to all contacts
                for (const contact of contactsResult.recordset) {
                    try {
                        if (emailService && emailService.sendEmail) {
                            await emailService.sendEmail({
                                to: contact.ContactEmail,
                                subject: subject,
                                html: body
                            });
                            remindersSent++;
                        }
                    } catch (emailErr) {
                        console.error(`[Dept Escalation] Failed to send reminder to ${contact.ContactEmail}:`, emailErr.message);
                    }
                }
                
                // Update reminder tracking
                await pool.request()
                    .input('id', sql.Int, esc.Id)
                    .query(`
                        UPDATE DepartmentEscalations 
                        SET LastReminderSentAt = GETDATE(), 
                            ReminderCount = ReminderCount + 1,
                            UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
                
                console.log(`[Dept Escalation] Sent reminder for escalation ${esc.Id} (${esc.Department})`);
                
            } catch (err) {
                console.error(`[Dept Escalation] Error processing escalation ${esc.Id}:`, err.message);
            }
        }
        
        serviceStatus.stats.remindersSent += remindersSent;
        serviceStatus.lastRunTime = new Date().toISOString();
        serviceStatus.lastRunStatus = 'success';
        
        console.log(`[Dept Escalation] Sent ${remindersSent} reminders in ${Date.now() - startTime}ms`);
        
        return { remindersSent, duration: Date.now() - startTime };
        
    } catch (err) {
        console.error('[Dept Escalation] Error checking escalations:', err);
        serviceStatus.lastRunStatus = 'error';
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

// ============================================================================
// GET STATISTICS FOR JOB MONITOR
// ============================================================================

/**
 * Get department escalation statistics for Job Monitor
 */
async function getDepartmentEscalationStats() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                Module,
                Department,
                Status,
                COUNT(*) as Count,
                SUM(CASE WHEN Deadline < GETDATE() AND Status IN ('Pending', 'Acknowledged', 'InProgress') THEN 1 ELSE 0 END) as OverdueCount
            FROM DepartmentEscalations
            GROUP BY Module, Department, Status
            
            UNION ALL
            
            SELECT 
                Module,
                'ALL' as Department,
                Status,
                COUNT(*) as Count,
                SUM(CASE WHEN Deadline < GETDATE() AND Status IN ('Pending', 'Acknowledged', 'InProgress') THEN 1 ELSE 0 END) as OverdueCount
            FROM DepartmentEscalations
            GROUP BY Module, Status
            
            ORDER BY Module, Department, Status
        `);
        
        // Aggregate results
        const stats = {
            OE: { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0, byDepartment: {} },
            OHS: { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0, byDepartment: {} },
            total: { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0 }
        };
        
        for (const row of result.recordset) {
            const module = row.Module;
            const dept = row.Department;
            const status = row.Status?.toLowerCase() || 'pending';
            const count = row.Count;
            const overdue = row.OverdueCount;
            
            if (dept === 'ALL') {
                // Module-level stats
                if (stats[module]) {
                    if (status === 'pending') stats[module].pending = count;
                    else if (status === 'acknowledged') stats[module].acknowledged = count;
                    else if (status === 'inprogress') stats[module].inProgress = count;
                    else if (status === 'resolved' || status === 'closed') stats[module].resolved += count;
                    stats[module].overdue += overdue;
                }
            } else {
                // Department-level stats
                if (stats[module]) {
                    if (!stats[module].byDepartment[dept]) {
                        stats[module].byDepartment[dept] = { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0 };
                    }
                    if (status === 'pending') stats[module].byDepartment[dept].pending = count;
                    else if (status === 'acknowledged') stats[module].byDepartment[dept].acknowledged = count;
                    else if (status === 'inprogress') stats[module].byDepartment[dept].inProgress = count;
                    else if (status === 'resolved' || status === 'closed') stats[module].byDepartment[dept].resolved += count;
                    stats[module].byDepartment[dept].overdue += overdue;
                }
            }
        }
        
        // Calculate totals
        stats.total.pending = stats.OE.pending + stats.OHS.pending;
        stats.total.acknowledged = stats.OE.acknowledged + stats.OHS.acknowledged;
        stats.total.inProgress = stats.OE.inProgress + stats.OHS.inProgress;
        stats.total.resolved = stats.OE.resolved + stats.OHS.resolved;
        stats.total.overdue = stats.OE.overdue + stats.OHS.overdue;
        
        return stats;
        
    } catch (err) {
        console.error('[Dept Escalation] Error getting stats:', err);
        return {
            OE: { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0, byDepartment: {} },
            OHS: { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0, byDepartment: {} },
            total: { pending: 0, acknowledged: 0, inProgress: 0, resolved: 0, overdue: 0 }
        };
    } finally {
        if (pool) await pool.close();
    }
}

/**
 * Get list of pending department escalations for Job Monitor
 */
async function getPendingDepartmentEscalations(module = null, limit = 50) {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        let query = `
            SELECT TOP (@limit)
                de.*,
                DATEDIFF(day, de.Deadline, GETDATE()) as DaysOverdue
            FROM DepartmentEscalations de
            WHERE de.Status IN ('Pending', 'Acknowledged', 'InProgress')
        `;
        
        if (module) {
            query += ` AND de.Module = @module`;
        }
        
        query += ` ORDER BY de.Deadline ASC, de.EscalatedAt ASC`;
        
        const request = pool.request().input('limit', sql.Int, limit);
        if (module) {
            request.input('module', sql.NVarChar, module);
        }
        
        const result = await request.query(query);
        return result.recordset;
        
    } catch (err) {
        console.error('[Dept Escalation] Error getting pending escalations:', err);
        return [];
    } finally {
        if (pool) await pool.close();
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    escalateToDepepartment,
    removeEscalation,
    checkDepartmentEscalations,
    getDepartmentEscalationStats,
    getPendingDepartmentEscalations,
    getServiceStatus
};
