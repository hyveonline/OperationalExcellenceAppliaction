/**
 * Workflow Engine Admin Routes
 * Admin UI for configuring workflow definitions, steps, recipients, statuses, and conditions
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const config = require('../../config/default');

const dbConfig = {
    server: config.database.server,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

// =============================================
// GET: Main workflow list page
// =============================================
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);

        const workflows = await pool.request().query(`
            SELECT wd.*,
                (SELECT COUNT(*) FROM WorkflowSteps ws WHERE ws.WorkflowId = wd.Id AND ws.IsActive = 1) as StepCount,
                (SELECT COUNT(*) FROM WorkflowInstances wi WHERE wi.WorkflowId = wd.Id) as InstanceCount
            FROM WorkflowDefinitions wd
            ORDER BY wd.FormName ASC
        `);

        const templates = await pool.request().query(`
            SELECT TemplateKey, SubjectTemplate FROM EmailTemplates WHERE IsActive = 1 ORDER BY TemplateKey
        `);

        const roles = await pool.request().query(`SELECT Id, RoleName FROM UserRoles ORDER BY RoleName`);

        await pool.close();

        const workflowRows = workflows.recordset.map(w => `
            <tr data-id="${w.Id}" class="${w.IsActive && w.WorkflowType !== 'NONE' ? '' : 'inactive-row'}">
                <td><strong>${w.FormName}</strong><br><small style="color:#888">${w.FormCode}</small></td>
                <td><span class="type-badge type-${w.WorkflowType}">${w.WorkflowType.replace(/_/g, ' ')}</span></td>
                <td style="text-align:center">${w.StepCount}</td>
                <td style="text-align:center">${w.InstanceCount}</td>
                <td>
                    <label class="switch">
                        <input type="checkbox" ${w.IsActive && w.WorkflowType !== 'NONE' ? 'checked' : ''} onchange="toggleWorkflow(${w.Id}, this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="actions-cell">
                    <a href="/admin/workflow-engine/configure/${w.Id}" class="btn btn-sm btn-primary">⚙️ Configure</a>
                </td>
            </tr>
        `).join('');

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Engine - Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 20px 40px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .header h1 { font-size: 24px; }
        .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; }
        .header-nav a:hover { opacity: 1; }
        .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 25px; }
        .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: #667eea; }
        .stat-label { font-size: 13px; color: #888; margin-top: 5px; }
        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
        .card-title { font-size: 20px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #555; font-size: 13px; text-transform: uppercase; }
        tr:hover { background: #f8f9fa; }
        .inactive-row { opacity: 0.5; }
        .type-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .type-NONE { background: #f5f5f5; color: #999; }
        .type-EMAIL_ONLY { background: #e3f2fd; color: #1565c0; }
        .type-APPROVAL { background: #fff3e0; color: #e65100; }
        .type-EMAIL_AND_APPROVAL { background: #e8f5e9; color: #2e7d32; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; display: inline-block; text-decoration: none; }
        .btn-sm { padding: 6px 12px; }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5a67d8; }
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: .3s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
        .switch input:checked + .slider { background: #4caf50; }
        .switch input:checked + .slider:before { transform: translateX(20px); }
        .actions-cell { white-space: nowrap; }
        @media (max-width: 768px) {
            .stats-row { grid-template-columns: repeat(2, 1fr); }
            .header { padding: 15px 20px; flex-direction: column; gap: 10px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚙️ Workflow Engine</h1>
        <div class="header-nav">
            <a href="/admin">← Admin Panel</a>
        </div>
    </div>
    <div class="container">
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value">${workflows.recordset.length}</div>
                <div class="stat-label">Total Modules</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${workflows.recordset.filter(w => w.IsActive && w.WorkflowType !== 'NONE').length}</div>
                <div class="stat-label">Active Workflows</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${workflows.recordset.reduce((sum, w) => sum + w.StepCount, 0)}</div>
                <div class="stat-label">Total Steps</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${workflows.recordset.reduce((sum, w) => sum + w.InstanceCount, 0)}</div>
                <div class="stat-label">Total Executions</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <div class="card-title">📋 Module Workflows</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Workflow Type</th>
                        <th style="text-align:center">Steps</th>
                        <th style="text-align:center">Executions</th>
                        <th>Active</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${workflowRows}
                </tbody>
            </table>
        </div>
    </div>
    <script>
        async function toggleWorkflow(id, active) {
            try {
                const res = await fetch('/admin/workflow-engine/api/toggle/' + id, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: active })
                });
                const data = await res.json();
                if (!data.success) { alert('Error: ' + data.error); return; }
                window.location.reload();
            } catch (err) { alert('Error: ' + err.message); }
        }
    </script>
</body>
</html>
        `);
    } catch (err) {
        console.error('[WORKFLOW ADMIN] Error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// =============================================
// GET: Configure a specific workflow
// =============================================
router.get('/configure/:id', async (req, res) => {
    try {
        const workflowId = parseInt(req.params.id);
        const pool = await sql.connect(dbConfig);

        const wfResult = await pool.request()
            .input('id', sql.Int, workflowId)
            .query(`SELECT * FROM WorkflowDefinitions WHERE Id = @id`);

        if (wfResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Workflow not found');
        }
        const wf = wfResult.recordset[0];

        const stepsResult = await pool.request()
            .input('workflowId', sql.Int, workflowId)
            .query(`
                SELECT ws.*,
                    (SELECT COUNT(*) FROM WorkflowStepRecipients r WHERE r.StepId = ws.Id) as RecipientCount,
                    (SELECT COUNT(*) FROM WorkflowConditions c WHERE c.StepId = ws.Id) as ConditionCount
                FROM WorkflowSteps ws
                WHERE ws.WorkflowId = @workflowId
                ORDER BY ws.StepOrder ASC
            `);

        const statusesResult = await pool.request()
            .input('workflowId', sql.Int, workflowId)
            .query(`SELECT * FROM WorkflowStatusMappings WHERE WorkflowId = @workflowId ORDER BY StatusOrder ASC`);

        const templateResult = await pool.request()
            .query(`SELECT TemplateKey, SubjectTemplate FROM EmailTemplates WHERE IsActive = 1 ORDER BY TemplateKey`);

        const rolesResult = await pool.request().query(`SELECT Id, RoleName FROM UserRoles ORDER BY RoleName`);

        await pool.close();

        const templateOptions = templateResult.recordset.map(t =>
            `<option value="${t.TemplateKey}">${t.TemplateKey} - ${t.SubjectTemplate.substring(0, 60)}</option>`
        ).join('');

        const roleOptions = rolesResult.recordset.map(r =>
            `<option value="${r.Id}" data-name="${r.RoleName}">${r.RoleName}</option>`
        ).join('');

        const stepRows = stepsResult.recordset.map(s => `
            <tr data-step-id="${s.Id}">
                <td style="text-align:center;cursor:grab">☰ ${s.StepOrder}</td>
                <td><strong>${s.StepName}</strong></td>
                <td><span class="step-type-badge step-${s.StepType}">${s.StepType.replace(/_/g, ' ')}</span></td>
                <td>${s.StepType === 'EMAIL' ? (s.EmailTemplateKey || '<em style="color:#999">None</em>') : s.StepType === 'APPROVAL' ? (s.ApprovalMethod || 'N/A') : s.StepType === 'STATUS_CHANGE' ? (s.TargetStatus || 'N/A') : '-'}</td>
                <td style="text-align:center">${s.RecipientCount}</td>
                <td style="text-align:center">${s.ConditionCount}</td>
                <td>
                    <label class="switch switch-sm">
                        <input type="checkbox" ${s.IsActive ? 'checked' : ''} onchange="toggleStep(${s.Id}, this.checked)">
                        <span class="slider"></span>
                    </label>
                </td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-primary" onclick="editStep(${s.Id})">✏️</button>
                    <button class="btn btn-sm" style="background:#e3f2fd;color:#1565c0" onclick="editRecipients(${s.Id}, '${s.StepName}')">👥</button>
                    <button class="btn btn-sm" style="background:#fff3e0;color:#e65100" onclick="editConditions(${s.Id}, '${s.StepName}')">🔀</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStep(${s.Id})">🗑️</button>
                </td>
            </tr>
        `).join('');

        const statusRows = statusesResult.recordset.map(s => `
            <tr>
                <td>${s.StatusOrder}</td>
                <td>
                    <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${s.StatusColor || '#ccc'};vertical-align:middle;margin-right:8px"></span>
                    ${s.StatusLabel}
                </td>
                <td>${s.IsDefault ? '✅ Default' : ''}</td>
                <td>${s.IsFinal ? '🏁 Final' : ''}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-danger" onclick="deleteStatus(${s.Id})">🗑️</button>
                </td>
            </tr>
        `).join('');

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure: ${wf.FormName} - Workflow Engine</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 22px; }
        .header-sub { opacity: 0.8; font-size: 14px; margin-top: 4px; }
        .header-nav a { color: white; text-decoration: none; margin-left: 20px; opacity: 0.8; }
        .header-nav a:hover { opacity: 1; }
        .container { max-width: 1200px; margin: 0 auto; padding: 30px 20px; }

        /* Workflow type selector */
        .type-selector { display: flex; gap: 15px; margin-bottom: 25px; }
        .type-option { flex: 1; background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .type-option:hover { border-color: #667eea; }
        .type-option.selected { border-color: #667eea; background: #f0f2ff; }
        .type-option .type-icon { font-size: 28px; margin-bottom: 8px; }
        .type-option .type-label { font-weight: 600; font-size: 14px; }
        .type-option .type-desc { font-size: 12px; color: #888; margin-top: 4px; }

        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); margin-bottom: 25px; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
        .card-title { font-size: 18px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #555; font-size: 12px; text-transform: uppercase; }
        tr:hover { background: #f8f9fa; }

        .step-type-badge { padding: 3px 10px; border-radius: 15px; font-size: 11px; font-weight: 600; }
        .step-EMAIL { background: #e3f2fd; color: #1565c0; }
        .step-APPROVAL { background: #fff3e0; color: #e65100; }
        .step-STATUS_CHANGE { background: #e8f5e9; color: #2e7d32; }
        .step-NOTIFICATION { background: #f3e5f5; color: #7b1fa2; }

        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; display: inline-block; text-decoration: none; }
        .btn-sm { padding: 6px 10px; font-size: 12px; }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5a67d8; }
        .btn-success { background: #28a745; color: white; }
        .btn-success:hover { background: #218838; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn-outline { background: white; color: #667eea; border: 1px solid #667eea; }
        .btn-outline:hover { background: #f0f2ff; }

        .switch { position: relative; display: inline-block; width: 38px; height: 20px; }
        .switch-sm { width: 34px; height: 18px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 20px; transition: .3s; }
        .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
        .switch-sm .slider:before { height: 12px; width: 12px; left: 3px; bottom: 3px; }
        .switch input:checked + .slider { background: #4caf50; }
        .switch input:checked + .slider:before { transform: translateX(18px); }
        .switch-sm input:checked + .slider:before { transform: translateX(16px); }

        /* Modals */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: flex-start; padding-top: 50px; z-index: 1000; overflow-y: auto; }
        .modal.show { display: flex; }
        .modal-content { background: white; border-radius: 15px; width: 600px; max-width: 95%; margin-bottom: 50px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 25px; border-bottom: 1px solid #eee; }
        .modal-header h3 { font-size: 18px; }
        .modal-body { padding: 25px; }
        .modal-footer { padding: 15px 25px; border-top: 1px solid #eee; display: flex; gap: 10px; justify-content: flex-end; }
        .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }
        .close-btn:hover { color: #333; }
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px; color: #444; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .form-hint { font-size: 12px; color: #999; margin-top: 4px; }

        .actions-cell { white-space: nowrap; }
        .empty-state { text-align: center; padding: 40px; color: #888; }
        .empty-state .empty-icon { font-size: 40px; margin-bottom: 10px; }

        /* Recipient tags */
        .recipient-list { margin-top: 10px; }
        .recipient-tag { display: inline-flex; align-items: center; background: #e8eaf6; color: #3f51b5; padding: 4px 10px; border-radius: 15px; font-size: 12px; margin: 3px; }
        .recipient-tag .tag-remove { margin-left: 6px; cursor: pointer; font-weight: bold; }

        @media (max-width: 768px) {
            .type-selector { flex-direction: column; }
            .form-row { grid-template-columns: 1fr; }
            .header { flex-direction: column; gap: 10px; padding: 15px 20px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>⚙️ ${wf.FormName}</h1>
            <div class="header-sub">Configure workflow for ${wf.FormCode} · ${wf.ModulePath}</div>
        </div>
        <div class="header-nav">
            <a href="/admin/workflow-engine">← All Workflows</a>
            <a href="/admin">Admin Panel</a>
        </div>
    </div>
    <div class="container">

        <!-- Workflow Type Selector -->
        <div class="type-selector">
            <div class="type-option ${wf.WorkflowType === 'NONE' ? 'selected' : ''}" onclick="setWorkflowType('NONE')">
                <div class="type-icon">🚫</div>
                <div class="type-label">None</div>
                <div class="type-desc">No workflow</div>
            </div>
            <div class="type-option ${wf.WorkflowType === 'EMAIL_ONLY' ? 'selected' : ''}" onclick="setWorkflowType('EMAIL_ONLY')">
                <div class="type-icon">📧</div>
                <div class="type-label">Email Only</div>
                <div class="type-desc">Send emails on submit</div>
            </div>
            <div class="type-option ${wf.WorkflowType === 'APPROVAL' ? 'selected' : ''}" onclick="setWorkflowType('APPROVAL')">
                <div class="type-icon">✅</div>
                <div class="type-label">Approval</div>
                <div class="type-desc">Approval chain</div>
            </div>
            <div class="type-option ${wf.WorkflowType === 'EMAIL_AND_APPROVAL' ? 'selected' : ''}" onclick="setWorkflowType('EMAIL_AND_APPROVAL')">
                <div class="type-icon">📧✅</div>
                <div class="type-label">Email + Approval</div>
                <div class="type-desc">Both email & approval</div>
            </div>
        </div>

        <!-- Steps Card -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">📋 Workflow Steps</div>
                <button class="btn btn-primary" onclick="openAddStep()">➕ Add Step</button>
            </div>
            ${stepsResult.recordset.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th style="width:60px;text-align:center">Order</th>
                        <th>Step Name</th>
                        <th>Type</th>
                        <th>Config</th>
                        <th style="text-align:center">Recipients</th>
                        <th style="text-align:center">Conditions</th>
                        <th>Active</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${stepRows}</tbody>
            </table>
            ` : `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>No steps configured yet. Click "Add Step" to create your first workflow step.</p>
            </div>
            `}
        </div>

        <!-- Status Mappings Card -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">🏷️ Status Mappings</div>
                <button class="btn btn-outline" onclick="openAddStatus()">➕ Add Status</button>
            </div>
            ${statusesResult.recordset.length > 0 ? `
            <table>
                <thead><tr><th style="width:60px">Order</th><th>Status Label</th><th>Default</th><th>Final</th><th>Actions</th></tr></thead>
                <tbody>${statusRows}</tbody>
            </table>
            ` : `
            <div class="empty-state">
                <div class="empty-icon">🏷️</div>
                <p>No status mappings. Add statuses to control record state transitions.</p>
            </div>
            `}
        </div>
    </div>

    <!-- Add/Edit Step Modal -->
    <div class="modal" id="stepModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="stepModalTitle">Add Step</h3>
                <button class="close-btn" onclick="closeModal('stepModal')">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="stepId">
                <div class="form-row">
                    <div class="form-group">
                        <label>Step Name *</label>
                        <input type="text" id="stepName" placeholder="e.g. Send Email to Manager">
                    </div>
                    <div class="form-group">
                        <label>Order *</label>
                        <input type="number" id="stepOrder" min="1" value="${stepsResult.recordset.length + 1}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Step Type *</label>
                    <select id="stepType" onchange="onStepTypeChange()">
                        <option value="">-- Select --</option>
                        <option value="EMAIL">📧 Email</option>
                        <option value="APPROVAL">✅ Approval</option>
                        <option value="STATUS_CHANGE">🔄 Status Change</option>
                        <option value="NOTIFICATION">🔔 Notification</option>
                    </select>
                </div>

                <!-- EMAIL fields -->
                <div id="emailFields" style="display:none">
                    <div class="form-group">
                        <label>Email Template</label>
                        <select id="emailTemplateKey">
                            <option value="">-- Select Template --</option>
                            ${templateOptions}
                        </select>
                        <div class="form-hint">Pick from existing EmailTemplates table</div>
                    </div>
                </div>

                <!-- APPROVAL fields -->
                <div id="approvalFields" style="display:none">
                    <div class="form-group">
                        <label>Approval Method</label>
                        <select id="approvalMethod">
                            <option value="PUBLIC_LINK">📧 Public Link (no login)</option>
                            <option value="IN_APP">🖥️ In-App (must log in)</option>
                            <option value="BOTH">📧🖥️ Both</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Allowed Actions</label>
                        <div style="display:flex;gap:15px;flex-wrap:wrap;margin-top:5px">
                            <label><input type="checkbox" class="action-cb" value="Approve" checked> Approve</label>
                            <label><input type="checkbox" class="action-cb" value="Reject" checked> Reject</label>
                            <label><input type="checkbox" class="action-cb" value="RequestInfo"> Request Info</label>
                            <label><input type="checkbox" class="action-cb" value="Delegate"> Delegate</label>
                        </div>
                    </div>
                </div>

                <!-- STATUS_CHANGE fields -->
                <div id="statusFields" style="display:none">
                    <div class="form-group">
                        <label>Target Status *</label>
                        <input type="text" id="targetStatus" placeholder="e.g. Under Review, Approved, Closed">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('stepModal')">Cancel</button>
                <button class="btn btn-success" onclick="saveStep()">💾 Save Step</button>
            </div>
        </div>
    </div>

    <!-- Recipients Modal -->
    <div class="modal" id="recipientsModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="recipientsTitle">Recipients</h3>
                <button class="close-btn" onclick="closeModal('recipientsModal')">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="recipientStepId">
                <div id="recipientsList"></div>
                <hr style="margin:20px 0">
                <h4 style="margin-bottom:15px">Add Recipient</h4>
                <div class="form-group">
                    <label>Recipient Type</label>
                    <select id="recipientType" onchange="onRecipientTypeChange()">
                        <option value="">-- Select --</option>
                        <option value="USER">👤 Specific User (email)</option>
                        <option value="ROLE">👥 By Role</option>
                        <option value="STORE_ASSIGNMENT">🏪 Store Assignment</option>
                        <option value="SUBMITTER">📝 Submitter</option>
                        <option value="SUBMITTER_MANAGER">👔 Submitter's Manager</option>
                        <option value="FORM_FIELD">📋 Form Field Value</option>
                    </select>
                </div>
                <div id="recipientUserField" style="display:none">
                    <div class="form-group">
                        <label>User Email</label>
                        <input type="email" id="recipientUserEmail" placeholder="user@domain.com">
                    </div>
                </div>
                <div id="recipientRoleField" style="display:none">
                    <div class="form-group">
                        <label>Role</label>
                        <select id="recipientRoleId">${roleOptions}</select>
                    </div>
                </div>
                <div id="recipientStoreField" style="display:none">
                    <div class="form-group">
                        <label>Assignment Role</label>
                        <select id="recipientAssignmentRole">
                            <option value="AreaManager">Area Manager</option>
                            <option value="HeadOfOps">Head of Operations</option>
                            <option value="StoreManager">Store Manager</option>
                        </select>
                    </div>
                </div>
                <div id="recipientFormField" style="display:none">
                    <div class="form-group">
                        <label>Field Name</label>
                        <input type="text" id="recipientFieldName" placeholder="e.g. approverEmail">
                        <div class="form-hint">The form field that contains the email address</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Email Target</label>
                    <select id="recipientEmailTarget">
                        <option value="TO">TO</option>
                        <option value="CC">CC</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('recipientsModal')">Close</button>
                <button class="btn btn-success" onclick="addRecipient()">➕ Add</button>
            </div>
        </div>
    </div>

    <!-- Conditions Modal -->
    <div class="modal" id="conditionsModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="conditionsTitle">Conditions</h3>
                <button class="close-btn" onclick="closeModal('conditionsModal')">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="conditionStepId">
                <div id="conditionsList"></div>
                <hr style="margin:20px 0">
                <h4 style="margin-bottom:15px">Add Condition</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Field Name</label>
                        <input type="text" id="condFieldName" placeholder="e.g. Category">
                    </div>
                    <div class="form-group">
                        <label>Operator</label>
                        <select id="condOperator">
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="contains">Contains</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                            <option value="in">In (comma-separated)</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Value</label>
                        <input type="text" id="condValue" placeholder="e.g. Happy">
                    </div>
                    <div class="form-group">
                        <label>Action on Match</label>
                        <select id="condAction">
                            <option value="SKIP">Skip this step</option>
                            <option value="EXECUTE">Execute this step</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('conditionsModal')">Close</button>
                <button class="btn btn-success" onclick="addCondition()">➕ Add</button>
            </div>
        </div>
    </div>

    <!-- Add Status Modal -->
    <div class="modal" id="statusModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Status</h3>
                <button class="close-btn" onclick="closeModal('statusModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <div class="form-group">
                        <label>Status Label *</label>
                        <input type="text" id="statusLabel" placeholder="e.g. Pending, Approved, Rejected">
                    </div>
                    <div class="form-group">
                        <label>Order *</label>
                        <input type="number" id="statusOrder" min="1" value="${statusesResult.recordset.length + 1}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Color</label>
                        <input type="color" id="statusColor" value="#667eea">
                    </div>
                    <div class="form-group" style="padding-top:25px">
                        <label><input type="checkbox" id="statusIsDefault"> Default (initial status)</label>
                        <label style="margin-left:15px"><input type="checkbox" id="statusIsFinal"> Final (terminal status)</label>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal('statusModal')">Cancel</button>
                <button class="btn btn-success" onclick="saveStatus()">💾 Save</button>
            </div>
        </div>
    </div>

    <script>
        const WORKFLOW_ID = ${workflowId};
        const API = '/admin/workflow-engine/api';

        // Modal helpers
        function openModal(id) { document.getElementById(id).classList.add('show'); }
        function closeModal(id) { document.getElementById(id).classList.remove('show'); }
        document.querySelectorAll('.modal').forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
        });

        // ==========================================
        // Workflow Type
        // ==========================================
        async function setWorkflowType(type) {
            try {
                const res = await fetch(API + '/type/' + WORKFLOW_ID, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workflowType: type })
                });
                const data = await res.json();
                if (data.success) window.location.reload();
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        // ==========================================
        // Steps CRUD
        // ==========================================
        function onStepTypeChange() {
            const type = document.getElementById('stepType').value;
            document.getElementById('emailFields').style.display = type === 'EMAIL' ? 'block' : 'none';
            document.getElementById('approvalFields').style.display = type === 'APPROVAL' ? 'block' : 'none';
            document.getElementById('statusFields').style.display = type === 'STATUS_CHANGE' ? 'block' : 'none';
        }

        function openAddStep() {
            document.getElementById('stepId').value = '';
            document.getElementById('stepName').value = '';
            document.getElementById('stepType').value = '';
            document.getElementById('stepOrder').value = ${stepsResult.recordset.length + 1};
            document.getElementById('emailTemplateKey').value = '';
            document.getElementById('targetStatus').value = '';
            document.getElementById('stepModalTitle').textContent = 'Add Step';
            onStepTypeChange();
            openModal('stepModal');
        }

        async function editStep(id) {
            try {
                const res = await fetch(API + '/step/' + id);
                const data = await res.json();
                if (!data.success) { alert('Error: ' + data.error); return; }
                const s = data.step;
                document.getElementById('stepId').value = s.Id;
                document.getElementById('stepName').value = s.StepName;
                document.getElementById('stepType').value = s.StepType;
                document.getElementById('stepOrder').value = s.StepOrder;
                document.getElementById('emailTemplateKey').value = s.EmailTemplateKey || '';
                document.getElementById('targetStatus').value = s.TargetStatus || '';
                if (s.ApprovalMethod) document.getElementById('approvalMethod').value = s.ApprovalMethod;
                if (s.AllowedActions) {
                    const actions = JSON.parse(s.AllowedActions);
                    document.querySelectorAll('.action-cb').forEach(cb => {
                        cb.checked = actions.includes(cb.value);
                    });
                }
                document.getElementById('stepModalTitle').textContent = 'Edit Step';
                onStepTypeChange();
                openModal('stepModal');
            } catch (err) { alert('Error: ' + err.message); }
        }

        async function saveStep() {
            const stepId = document.getElementById('stepId').value;
            const body = {
                workflowId: WORKFLOW_ID,
                stepName: document.getElementById('stepName').value,
                stepType: document.getElementById('stepType').value,
                stepOrder: parseInt(document.getElementById('stepOrder').value),
                emailTemplateKey: document.getElementById('emailTemplateKey').value || null,
                approvalMethod: document.getElementById('approvalMethod').value || null,
                allowedActions: JSON.stringify([...document.querySelectorAll('.action-cb:checked')].map(cb => cb.value)),
                targetStatus: document.getElementById('targetStatus').value || null
            };
            if (!body.stepName || !body.stepType) { alert('Step Name and Type are required'); return; }

            try {
                const url = stepId ? API + '/step/' + stepId : API + '/step';
                const res = await fetch(url, {
                    method: stepId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) window.location.reload();
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        async function deleteStep(id) {
            if (!confirm('Delete this step?')) return;
            try {
                const res = await fetch(API + '/step/' + id, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) window.location.reload();
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        async function toggleStep(id, active) {
            try {
                const res = await fetch(API + '/step/' + id + '/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: active })
                });
                const data = await res.json();
                if (!data.success) alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        // ==========================================
        // Recipients
        // ==========================================
        function onRecipientTypeChange() {
            const type = document.getElementById('recipientType').value;
            document.getElementById('recipientUserField').style.display = type === 'USER' ? 'block' : 'none';
            document.getElementById('recipientRoleField').style.display = type === 'ROLE' ? 'block' : 'none';
            document.getElementById('recipientStoreField').style.display = type === 'STORE_ASSIGNMENT' ? 'block' : 'none';
            document.getElementById('recipientFormField').style.display = type === 'FORM_FIELD' ? 'block' : 'none';
        }

        async function editRecipients(stepId, stepName) {
            document.getElementById('recipientStepId').value = stepId;
            document.getElementById('recipientsTitle').textContent = 'Recipients - ' + stepName;
            document.getElementById('recipientType').value = '';
            onRecipientTypeChange();
            await loadRecipients(stepId);
            openModal('recipientsModal');
        }

        async function loadRecipients(stepId) {
            try {
                const res = await fetch(API + '/step/' + stepId + '/recipients');
                const data = await res.json();
                const list = document.getElementById('recipientsList');
                if (!data.recipients || data.recipients.length === 0) {
                    list.innerHTML = '<p style="color:#888;text-align:center">No recipients yet</p>';
                    return;
                }
                list.innerHTML = data.recipients.map(r => {
                    let label = '';
                    switch(r.RecipientType) {
                        case 'USER': label = '👤 ' + r.UserEmail; break;
                        case 'ROLE': label = '👥 Role: ' + r.RoleName; break;
                        case 'STORE_ASSIGNMENT': label = '🏪 Store: ' + r.AssignmentRole; break;
                        case 'SUBMITTER': label = '📝 Submitter'; break;
                        case 'SUBMITTER_MANAGER': label = '👔 Submitter Manager'; break;
                        case 'FORM_FIELD': label = '📋 Field: ' + r.FieldName; break;
                    }
                    return '<div class="recipient-tag">' + label + ' (' + r.EmailTarget + ') <span class="tag-remove" onclick="removeRecipient(' + r.Id + ',' + stepId + ')">✕</span></div>';
                }).join('');
            } catch (err) { console.error(err); }
        }

        async function addRecipient() {
            const stepId = document.getElementById('recipientStepId').value;
            const type = document.getElementById('recipientType').value;
            if (!type) { alert('Select a recipient type'); return; }

            const roleSelect = document.getElementById('recipientRoleId');
            const body = {
                stepId: parseInt(stepId),
                recipientType: type,
                userEmail: document.getElementById('recipientUserEmail').value || null,
                roleId: type === 'ROLE' ? parseInt(roleSelect.value) : null,
                roleName: type === 'ROLE' ? roleSelect.options[roleSelect.selectedIndex].dataset.name : null,
                assignmentRole: document.getElementById('recipientAssignmentRole').value || null,
                fieldName: document.getElementById('recipientFieldName').value || null,
                emailTarget: document.getElementById('recipientEmailTarget').value
            };

            try {
                const res = await fetch(API + '/recipient', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) {
                    await loadRecipients(stepId);
                    document.getElementById('recipientType').value = '';
                    onRecipientTypeChange();
                } else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        async function removeRecipient(id, stepId) {
            try {
                const res = await fetch(API + '/recipient/' + id, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) await loadRecipients(stepId);
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        // ==========================================
        // Conditions
        // ==========================================
        async function editConditions(stepId, stepName) {
            document.getElementById('conditionStepId').value = stepId;
            document.getElementById('conditionsTitle').textContent = 'Conditions - ' + stepName;
            await loadConditions(stepId);
            openModal('conditionsModal');
        }

        async function loadConditions(stepId) {
            try {
                const res = await fetch(API + '/step/' + stepId + '/conditions');
                const data = await res.json();
                const list = document.getElementById('conditionsList');
                if (!data.conditions || data.conditions.length === 0) {
                    list.innerHTML = '<p style="color:#888;text-align:center">No conditions (step always executes)</p>';
                    return;
                }
                list.innerHTML = data.conditions.map(c =>
                    '<div class="recipient-tag" style="background:#fff3e0;color:#e65100">'
                    + c.FieldName + ' ' + c.Operator + ' "' + c.Value + '" → ' + c.ActionOnMatch
                    + ' <span class="tag-remove" onclick="removeCondition(' + c.Id + ',' + stepId + ')">✕</span></div>'
                ).join('');
            } catch (err) { console.error(err); }
        }

        async function addCondition() {
            const stepId = document.getElementById('conditionStepId').value;
            const body = {
                stepId: parseInt(stepId),
                fieldName: document.getElementById('condFieldName').value,
                operator: document.getElementById('condOperator').value,
                value: document.getElementById('condValue').value,
                actionOnMatch: document.getElementById('condAction').value
            };
            if (!body.fieldName || !body.value) { alert('Field and Value are required'); return; }

            try {
                const res = await fetch(API + '/condition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) {
                    await loadConditions(stepId);
                    document.getElementById('condFieldName').value = '';
                    document.getElementById('condValue').value = '';
                } else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        async function removeCondition(id, stepId) {
            try {
                const res = await fetch(API + '/condition/' + id, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) await loadConditions(stepId);
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        // ==========================================
        // Statuses
        // ==========================================
        function openAddStatus() { openModal('statusModal'); }

        async function saveStatus() {
            const body = {
                workflowId: WORKFLOW_ID,
                statusLabel: document.getElementById('statusLabel').value,
                statusOrder: parseInt(document.getElementById('statusOrder').value),
                statusColor: document.getElementById('statusColor').value,
                isDefault: document.getElementById('statusIsDefault').checked,
                isFinal: document.getElementById('statusIsFinal').checked
            };
            if (!body.statusLabel) { alert('Status Label is required'); return; }

            try {
                const res = await fetch(API + '/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (data.success) window.location.reload();
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }

        async function deleteStatus(id) {
            if (!confirm('Delete this status?')) return;
            try {
                const res = await fetch(API + '/status/' + id, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) window.location.reload();
                else alert('Error: ' + data.error);
            } catch (err) { alert('Error: ' + err.message); }
        }
    </script>
</body>
</html>
        `);
    } catch (err) {
        console.error('[WORKFLOW ADMIN] Configure error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// =============================================
// API Routes
// =============================================

// Toggle workflow active
router.post('/api/toggle/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { isActive } = req.body;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('isActive', sql.Bit, isActive ? 1 : 0)
            .input('updatedBy', sql.Int, req.currentUser.userId)
            .query(`UPDATE WorkflowDefinitions SET IsActive = @isActive, UpdatedBy = @updatedBy, UpdatedAt = GETDATE() WHERE Id = @id`);
        // If activating but type is NONE, set to EMAIL_ONLY
        if (isActive) {
            await pool.request()
                .input('id', sql.Int, req.params.id)
                .query(`UPDATE WorkflowDefinitions SET WorkflowType = 'EMAIL_ONLY' WHERE Id = @id AND WorkflowType = 'NONE'`);
        }
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Set workflow type
router.post('/api/type/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { workflowType } = req.body;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('type', sql.NVarChar, workflowType)
            .input('isActive', sql.Bit, workflowType !== 'NONE' ? 1 : 0)
            .input('updatedBy', sql.Int, req.currentUser.userId)
            .query(`UPDATE WorkflowDefinitions SET WorkflowType = @type, IsActive = @isActive, UpdatedBy = @updatedBy, UpdatedAt = GETDATE() WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Get step
router.get('/api/step/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`SELECT * FROM WorkflowSteps WHERE Id = @id`);
        await pool.close();
        res.json({ success: true, step: result.recordset[0] || null });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Create step
router.post('/api/step', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { workflowId, stepName, stepType, stepOrder, emailTemplateKey, approvalMethod, allowedActions, targetStatus } = req.body;
        await pool.request()
            .input('workflowId', sql.Int, workflowId)
            .input('stepName', sql.NVarChar, stepName)
            .input('stepType', sql.NVarChar, stepType)
            .input('stepOrder', sql.Int, stepOrder)
            .input('emailTemplateKey', sql.NVarChar, emailTemplateKey || null)
            .input('approvalMethod', sql.NVarChar, approvalMethod || null)
            .input('allowedActions', sql.NVarChar, allowedActions || null)
            .input('targetStatus', sql.NVarChar, targetStatus || null)
            .query(`
                INSERT INTO WorkflowSteps (WorkflowId, StepOrder, StepName, StepType, ApprovalMethod, AllowedActions, EmailTemplateKey, TargetStatus)
                VALUES (@workflowId, @stepOrder, @stepName, @stepType, @approvalMethod, @allowedActions, @emailTemplateKey, @targetStatus)
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Update step
router.put('/api/step/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { stepName, stepType, stepOrder, emailTemplateKey, approvalMethod, allowedActions, targetStatus } = req.body;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('stepName', sql.NVarChar, stepName)
            .input('stepType', sql.NVarChar, stepType)
            .input('stepOrder', sql.Int, stepOrder)
            .input('emailTemplateKey', sql.NVarChar, emailTemplateKey || null)
            .input('approvalMethod', sql.NVarChar, approvalMethod || null)
            .input('allowedActions', sql.NVarChar, allowedActions || null)
            .input('targetStatus', sql.NVarChar, targetStatus || null)
            .query(`
                UPDATE WorkflowSteps SET StepName=@stepName, StepType=@stepType, StepOrder=@stepOrder,
                    EmailTemplateKey=@emailTemplateKey, ApprovalMethod=@approvalMethod, AllowedActions=@allowedActions,
                    TargetStatus=@targetStatus, UpdatedAt=GETDATE()
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Delete step
router.delete('/api/step/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`DELETE FROM WorkflowSteps WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Toggle step active
router.post('/api/step/:id/toggle', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('isActive', sql.Bit, req.body.isActive ? 1 : 0)
            .query(`UPDATE WorkflowSteps SET IsActive = @isActive, UpdatedAt = GETDATE() WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Get recipients for step
router.get('/api/step/:id/recipients', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('stepId', sql.Int, req.params.id)
            .query(`SELECT * FROM WorkflowStepRecipients WHERE StepId = @stepId AND IsActive = 1 ORDER BY Id`);
        await pool.close();
        res.json({ success: true, recipients: result.recordset });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Add recipient
router.post('/api/recipient', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { stepId, recipientType, userEmail, roleId, roleName, assignmentRole, fieldName, emailTarget } = req.body;
        await pool.request()
            .input('stepId', sql.Int, stepId)
            .input('recipientType', sql.NVarChar, recipientType)
            .input('userEmail', sql.NVarChar, userEmail || null)
            .input('roleId', sql.Int, roleId || null)
            .input('roleName', sql.NVarChar, roleName || null)
            .input('assignmentRole', sql.NVarChar, assignmentRole || null)
            .input('fieldName', sql.NVarChar, fieldName || null)
            .input('emailTarget', sql.NVarChar, emailTarget || 'TO')
            .query(`
                INSERT INTO WorkflowStepRecipients (StepId, RecipientType, UserEmail, RoleId, RoleName, AssignmentRole, FieldName, EmailTarget)
                VALUES (@stepId, @recipientType, @userEmail, @roleId, @roleName, @assignmentRole, @fieldName, @emailTarget)
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Delete recipient
router.delete('/api/recipient/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`DELETE FROM WorkflowStepRecipients WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Get conditions for step
router.get('/api/step/:id/conditions', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('stepId', sql.Int, req.params.id)
            .query(`SELECT * FROM WorkflowConditions WHERE StepId = @stepId AND IsActive = 1 ORDER BY Priority`);
        await pool.close();
        res.json({ success: true, conditions: result.recordset });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Add condition
router.post('/api/condition', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { stepId, fieldName, operator, value, actionOnMatch } = req.body;
        await pool.request()
            .input('stepId', sql.Int, stepId)
            .input('fieldName', sql.NVarChar, fieldName)
            .input('operator', sql.NVarChar, operator)
            .input('value', sql.NVarChar, value)
            .input('actionOnMatch', sql.NVarChar, actionOnMatch)
            .query(`
                INSERT INTO WorkflowConditions (StepId, FieldName, Operator, Value, ActionOnMatch)
                VALUES (@stepId, @fieldName, @operator, @value, @actionOnMatch)
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Delete condition
router.delete('/api/condition/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`DELETE FROM WorkflowConditions WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Add status mapping
router.post('/api/status', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const { workflowId, statusLabel, statusOrder, statusColor, isDefault, isFinal } = req.body;

        // If setting as default, unset other defaults first
        if (isDefault) {
            await pool.request()
                .input('workflowId', sql.Int, workflowId)
                .query(`UPDATE WorkflowStatusMappings SET IsDefault = 0 WHERE WorkflowId = @workflowId`);
        }

        await pool.request()
            .input('workflowId', sql.Int, workflowId)
            .input('statusLabel', sql.NVarChar, statusLabel)
            .input('statusOrder', sql.Int, statusOrder)
            .input('statusColor', sql.NVarChar, statusColor)
            .input('isDefault', sql.Bit, isDefault ? 1 : 0)
            .input('isFinal', sql.Bit, isFinal ? 1 : 0)
            .query(`
                INSERT INTO WorkflowStatusMappings (WorkflowId, StatusLabel, StatusOrder, StatusColor, IsDefault, IsFinal)
                VALUES (@workflowId, @statusLabel, @statusOrder, @statusColor, @isDefault, @isFinal)
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// Delete status
router.delete('/api/status/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.id)
            .query(`DELETE FROM WorkflowStatusMappings WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

module.exports = router;
