/**
 * Schedule and Attendance Routes - Excel-like Interface
 * Manage employees with weekly schedules in an Excel-like grid
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREV = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Get Monday of current week
function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Main page - Excel-like grid
router.get('/', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get date range from query or default to current week
        let weekStart;
        if (req.query.from) {
            weekStart = new Date(req.query.from);
        } else if (req.query.week) {
            weekStart = new Date(req.query.week);
        } else {
            weekStart = getMonday(new Date());
        }
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Calculate week end (default 6 days after start, or use 'to' param)
        let weekEnd;
        if (req.query.to) {
            weekEnd = new Date(req.query.to);
        } else {
            weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
        }
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        
        // Get all employees (including inactive)
        const employees = await pool.request()
            .query(`SELECT * FROM Personnel_Employees ORDER BY IsActive DESC, Company, Store, Name`);
        
        // Get schedules for the selected week
        const schedules = await pool.request()
            .input('weekStart', sql.Date, weekStartStr)
            .query(`SELECT * FROM Personnel_EmployeeSchedule WHERE WeekStartDate = @weekStart`);
        
        // Get stores for dropdown
        const stores = await pool.request()
            .query(`SELECT StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName`);
        
        // Check if week has been submitted
        const weekStatus = schedules.recordset.length > 0 && schedules.recordset[0].Status === 'Submitted' ? 'Submitted' : 'Draft';
        
        await pool.close();
        
        // Create lookup for schedules
        const scheduleMap = {};
        schedules.recordset.forEach(s => {
            scheduleMap[s.EmployeeId] = s;
        });
        
        // Build stores options
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        // Build employee data rows
        const employeeData = employees.recordset.map((emp, idx) => {
            const schedule = scheduleMap[emp.Id] || {};
            return {
                id: emp.Id,
                company: emp.Company || '',
                store: emp.Store || '',
                employeeId: emp.EmployeeId || '',
                phone: emp.PhoneNumber || '',
                name: emp.Name || '',
                position: emp.Position || '',
                isActive: emp.IsActive === true || emp.IsActive === 1,
                schedule: DAYS.reduce((acc, day) => {
                    acc[day] = {
                        from: schedule[`${day}From1`] || '',
                        to: schedule[`${day}To1`] || '',
                        actualIn: schedule[`${day}ActualIn`] || '',
                        actualOut: schedule[`${day}ActualOut`] || '',
                        off: schedule[`${day}Off`] === true || schedule[`${day}Off`] === 1
                    };
                    return acc;
                }, {})
            };
        });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Schedule & Attendance - ${process.env.APP_NAME}</title>
                <link href="https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css" rel="stylesheet">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f0f2f5;
                        font-size: 13px;
                    }
                    
                    .header {
                        background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
                        color: white;
                        padding: 12px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                    }
                    .header h1 { font-size: 18px; display: flex; align-items: center; gap: 8px; }
                    .header-actions { display: flex; gap: 10px; align-items: center; }
                    .header-actions a, .header-actions button {
                        color: white;
                        text-decoration: none;
                        padding: 6px 14px;
                        border-radius: 4px;
                        background: rgba(255,255,255,0.15);
                        border: none;
                        cursor: pointer;
                        font-size: 13px;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .header-actions a:hover, .header-actions button:hover { background: rgba(255,255,255,0.25); }
                    .btn-save { background: #38a169 !important; }
                    .btn-submit { background: #3182ce !important; }
                    
                    .toolbar {
                        background: white;
                        padding: 10px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid #e2e8f0;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .week-nav {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .week-nav button {
                        padding: 6px 12px;
                        border: 1px solid #cbd5e0;
                        background: white;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .week-nav button:hover { background: #f7fafc; }
                    .week-nav input[type="date"] {
                        padding: 6px 10px;
                        border: 1px solid #cbd5e0;
                        border-radius: 4px;
                    }
                    .week-info {
                        font-weight: 600;
                        color: #2d3748;
                    }
                    .status-badge {
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .status-draft { background: #fef3c7; color: #92400e; }
                    .status-submitted { background: #c6f6d5; color: #22543d; }
                    
                    .toolbar-actions {
                        display: flex;
                        gap: 8px;
                    }
                    .toolbar-actions button {
                        padding: 6px 12px;
                        border: 1px solid #cbd5e0;
                        background: white;
                        border-radius: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .toolbar-actions button:hover { background: #f7fafc; }
                    .btn-add-row { background: #ebf8ff !important; border-color: #3182ce !important; color: #3182ce; }
                    
                    .table-container {
                        overflow: auto;
                        max-height: calc(100vh - 140px);
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        min-width: 2000px;
                    }
                    
                    thead {
                        position: sticky;
                        top: 0;
                        z-index: 10;
                    }
                    
                    th {
                        background: #2d3748;
                        color: white;
                        padding: 8px 4px;
                        text-align: center;
                        font-weight: 600;
                        font-size: 11px;
                        text-transform: uppercase;
                        border: 1px solid #1a202c;
                        white-space: nowrap;
                    }
                    th.emp-col { background: #1e3a5f; min-width: 100px; }
                    th.day-col { background: #2c5282; }
                    th.day-col.weekend { background: #744210; }
                    
                    .day-header {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                    }
                    .day-date {
                        font-size: 10px;
                        opacity: 0.8;
                    }
                    
                    td {
                        border: 1px solid #e2e8f0;
                        padding: 0;
                        background: white;
                        vertical-align: top;
                    }
                    td.emp-cell {
                        padding: 2px;
                        background: #f7fafc;
                    }
                    td.row-num {
                        background: #edf2f7;
                        text-align: center;
                        font-weight: 600;
                        color: #718096;
                        width: 30px;
                        padding: 4px;
                    }
                    td.actions-cell {
                        background: #f7fafc;
                        text-align: center;
                        padding: 4px;
                    }
                    
                    tr:hover td { background: #fffaf0; }
                    tr:hover td.emp-cell { background: #fef3c7; }
                    tr.new-row td { background: #ebf8ff; }
                    tr.new-row td.emp-cell { background: #bee3f8; }
                    
                    /* Excel-like input cells */
                    .cell-input {
                        width: 100%;
                        border: none;
                        padding: 6px 4px;
                        font-size: 12px;
                        background: transparent;
                        outline: none;
                    }
                    .cell-input:focus {
                        background: #fffaf0;
                        box-shadow: inset 0 0 0 2px #3182ce;
                    }
                    .cell-input.time-input {
                        text-align: center;
                        font-family: 'Consolas', monospace;
                    }
                    .cell-input.invalid {
                        background: #fed7d7;
                    }
                    
                    select.cell-input {
                        cursor: pointer;
                    }
                    
                    /* Day schedule cell */
                    .day-cell {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        grid-template-rows: auto auto;
                        gap: 1px;
                        min-width: 120px;
                    }
                    .day-cell.is-off {
                        background: #e2e8f0;
                    }
                    .day-cell.is-off .time-group { display: none; }
                    
                    .off-toggle {
                        grid-column: 1 / -1;
                        display: flex;
                        justify-content: center;
                        padding: 2px;
                        background: #f7fafc;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .off-toggle label {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        cursor: pointer;
                        font-size: 10px;
                        color: #718096;
                    }
                    .off-toggle input:checked + span {
                        color: #e53e3e;
                        font-weight: 600;
                    }
                    
                    .time-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .time-label {
                        font-size: 9px;
                        text-align: center;
                        padding: 2px;
                        color: white;
                        font-weight: 600;
                    }
                    .time-label.sched { background: #3182ce; }
                    .time-label.actual { background: #38a169; }
                    
                    .time-inputs {
                        display: flex;
                        flex-direction: column;
                    }
                    .time-inputs input {
                        border: none;
                        border-bottom: 1px solid #e2e8f0;
                        padding: 4px 2px;
                        text-align: center;
                        font-size: 11px;
                        font-family: 'Consolas', monospace;
                        width: 100%;
                        outline: none;
                    }
                    .time-inputs input:focus {
                        background: #fffaf0;
                        border-color: #3182ce;
                    }
                    .time-inputs input:last-child {
                        border-bottom: none;
                    }
                    
                    /* Action buttons */
                    .row-actions {
                        display: flex;
                        gap: 2px;
                        justify-content: center;
                    }
                    .row-actions button {
                        padding: 4px 6px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        border-radius: 3px;
                        font-size: 14px;
                    }
                    .row-actions button:hover { background: #e2e8f0; }
                    .row-actions .btn-delete:hover { background: #fed7d7; color: #c53030; }
                    .row-actions .btn-toggle-active { color: #38a169; }
                    .row-actions .btn-toggle-active.inactive { color: #a0aec0; }
                    .row-actions .btn-toggle-active:hover { background: #c6f6d5; }
                    .row-actions .btn-toggle-active.inactive:hover { background: #e2e8f0; }
                    tr.row-inactive { opacity: 0.5; background: #f7fafc; }
                    tr.row-inactive td { color: #a0aec0; }
                    tr.row-inactive .cell-input, tr.row-inactive .time-input { color: #a0aec0; }
                    .show-inactive-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4a5568; cursor: pointer; margin-left: 15px; }
                    .show-inactive-toggle input { cursor: pointer; }
                    
                    /* Alert */
                    .alert {
                        position: fixed;
                        top: 60px;
                        right: 20px;
                        padding: 12px 20px;
                        border-radius: 6px;
                        font-weight: 500;
                        z-index: 1000;
                        display: none;
                        animation: slideIn 0.3s ease;
                    }
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    .alert-success { background: #c6f6d5; color: #22543d; }
                    .alert-error { background: #fed7d7; color: #c53030; }
                    .alert-info { background: #bee3f8; color: #2c5282; }
                    
                    /* Saving indicator */
                    .saving-indicator {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        padding: 8px 16px;
                        background: #2d3748;
                        color: white;
                        border-radius: 4px;
                        display: none;
                        align-items: center;
                        gap: 8px;
                        font-size: 12px;
                    }
                    .saving-indicator.active { display: flex; }
                    .saving-indicator i { animation: spin 1s linear infinite; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    
                    /* Copy feedback */
                    .copied-feedback {
                        position: fixed;
                        padding: 6px 12px;
                        background: #2d3748;
                        color: white;
                        border-radius: 4px;
                        font-size: 11px;
                        pointer-events: none;
                        z-index: 1000;
                        display: none;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1><i class="mdi mdi-calendar-clock"></i> Schedule & Attendance</h1>
                    <div class="header-actions">
                        <button onclick="saveAll()" class="btn-save"><i class="mdi mdi-content-save"></i> Save All</button>
                        <button onclick="submitWeek()" class="btn-submit"><i class="mdi mdi-send"></i> Submit Week</button>
                        <a href="/personnel"><i class="mdi mdi-arrow-left"></i> Back</a>
                        <a href="/dashboard"><i class="mdi mdi-home"></i> Home</a>
                    </div>
                </div>
                
                <div class="toolbar">
                    <div class="week-nav">
                        <label style="font-size: 12px; color: #4a5568; font-weight: 600;">From:</label>
                        <input type="date" id="dateFrom" value="${weekStartStr}" style="padding: 6px 10px; border: 1px solid #cbd5e0; border-radius: 4px;">
                        <label style="font-size: 12px; color: #4a5568; font-weight: 600; margin-left: 10px;">To:</label>
                        <input type="date" id="dateTo" value="${weekEndStr}" style="padding: 6px 10px; border: 1px solid #cbd5e0; border-radius: 4px;">
                        <button onclick="loadDateRange()" style="padding: 6px 14px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;"><i class="mdi mdi-reload"></i> Load</button>
                        <button onclick="setThisWeek()" style="padding: 6px 12px; background: #718096; color: white; border: none; border-radius: 4px; cursor: pointer;">This Week</button>
                        <span class="status-badge ${weekStatus === 'Submitted' ? 'status-submitted' : 'status-draft'}" style="margin-left: 15px;">${weekStatus}</span>
                    </div>
                    <div class="toolbar-actions">
                        <label class="show-inactive-toggle">
                            <input type="checkbox" id="showInactive" onchange="renderTable()">
                            <span>Show Inactive</span>
                        </label>
                        <button onclick="addNewRow()" class="btn-add-row"><i class="mdi mdi-plus"></i> Add Employee</button>
                        <button onclick="location.href='/personnel/schedule-attendance/history'"><i class="mdi mdi-history"></i> History</button>
                    </div>
                </div>
                
                <div class="table-container">
                    <table id="scheduleTable">
                        <thead>
                            <tr>
                                <th class="emp-col">#</th>
                                <th class="emp-col">Company</th>
                                <th class="emp-col">Store</th>
                                <th class="emp-col">Emp ID</th>
                                <th class="emp-col">Phone</th>
                                <th class="emp-col">Name</th>
                                <th class="emp-col">Position</th>
                                ${DAY_ABBREV.map((d, i) => {
                                    const date = new Date(weekStart);
                                    date.setDate(date.getDate() + i);
                                    const isWeekend = i >= 5;
                                    return `<th class="day-col ${isWeekend ? 'weekend' : ''}">
                                        <div class="day-header">
                                            <span>${d}</span>
                                            <span class="day-date">${date.getDate()}/${date.getMonth() + 1}</span>
                                        </div>
                                    </th>`;
                                }).join('')}
                                <th class="emp-col">Actions</th>
                            </tr>
                            <tr>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th></th>
                                <th></th>
                                ${DAY_ABBREV.map(() => `
                                    <th style="padding: 0; background: #4a5568;">
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; font-size: 9px; font-weight: normal;">
                                            <span style="padding: 2px; background: #3182ce;">Sched</span>
                                            <span style="padding: 2px; background: #38a169;">Actual</span>
                                        </div>
                                    </th>
                                `).join('')}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="tableBody">
                        </tbody>
                    </table>
                </div>
                
                <div class="alert" id="alert"></div>
                <div class="saving-indicator" id="savingIndicator">
                    <i class="mdi mdi-loading"></i> Saving...
                </div>
                <div class="copied-feedback" id="copiedFeedback">Copied!</div>
                
                <script>
                    const weekStart = '${weekStartStr}';
                    const storeOptions = '<option value="">-</option>${storeOptions}';
                    let employees = ${JSON.stringify(employeeData)};
                    let pendingChanges = {};
                    let saveTimeout = null;
                    let newRowCounter = 0;
                    
                    // Initialize
                    document.addEventListener('DOMContentLoaded', () => {
                        renderTable();
                        setupKeyboardNav();
                    });
                    
                    function renderTable() {
                        const showInactive = document.getElementById('showInactive') && document.getElementById('showInactive').checked;
                        const filtered = showInactive ? employees : employees.filter(e => e.isActive !== false);
                        const tbody = document.getElementById('tableBody');
                        tbody.innerHTML = filtered.map((emp, idx) => createRow(emp, idx)).join('');
                    }
                    
                    function createRow(emp, idx) {
                        const isNew = emp.id.toString().startsWith('new_');
                        const inactiveClass = emp.isActive === false ? 'row-inactive' : '';
                        return \`
                            <tr data-id="\${emp.id}" class="\${isNew ? 'new-row' : ''} \${inactiveClass}">
                                <td class="row-num">\${idx + 1}</td>
                                <td class="emp-cell">
                                    <input type="text" class="cell-input" data-field="company" value="\${escapeHtml(emp.company)}" 
                                           onchange="updateEmpField('\${emp.id}', 'company', this.value)" \${isNew ? 'required' : ''}>
                                </td>
                                <td class="emp-cell">
                                    <select class="cell-input" data-field="store" onchange="updateEmpField('\${emp.id}', 'store', this.value)">
                                        \${storeOptions.replace('value="' + emp.store + '"', 'value="' + emp.store + '" selected')}
                                    </select>
                                </td>
                                <td class="emp-cell">
                                    <input type="text" class="cell-input" data-field="employeeId" value="\${escapeHtml(emp.employeeId)}" 
                                           onchange="updateEmpField('\${emp.id}', 'employeeId', this.value)">
                                </td>
                                <td class="emp-cell">
                                    <input type="text" class="cell-input" data-field="phone" value="\${escapeHtml(emp.phone)}" 
                                           onchange="updateEmpField('\${emp.id}', 'phone', this.value)">
                                </td>
                                <td class="emp-cell">
                                    <input type="text" class="cell-input" data-field="name" value="\${escapeHtml(emp.name)}" 
                                           onchange="updateEmpField('\${emp.id}', 'name', this.value)" \${isNew ? 'required' : ''}>
                                </td>
                                <td class="emp-cell">
                                    <input type="text" class="cell-input" data-field="position" value="\${escapeHtml(emp.position)}" 
                                           onchange="updateEmpField('\${emp.id}', 'position', this.value)">
                                </td>
                                \${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => {
                                    const sched = emp.schedule[day] || {};
                                    return \`
                                        <td>
                                            <div class="day-cell \${sched.off ? 'is-off' : ''}" data-emp="\${emp.id}" data-day="\${day}">
                                                <div class="off-toggle">
                                                    <label>
                                                        <input type="checkbox" \${sched.off ? 'checked' : ''} 
                                                               onchange="toggleOff('\${emp.id}', '\${day}', this.checked)">
                                                        <span>OFF</span>
                                                    </label>
                                                </div>
                                                <div class="time-group">
                                                    <div class="time-inputs" style="border-right: 1px solid #e2e8f0;">
                                                        <input type="text" class="time-input" placeholder="In" 
                                                               value="\${formatTime(sched.from)}" maxlength="5"
                                                               data-emp="\${emp.id}" data-day="\${day}" data-field="from"
                                                               oninput="formatTimeInput(this)" onchange="updateSchedule('\${emp.id}', '\${day}', 'from', this.value)">
                                                        <input type="text" class="time-input" placeholder="Out" 
                                                               value="\${formatTime(sched.to)}" maxlength="5"
                                                               data-emp="\${emp.id}" data-day="\${day}" data-field="to"
                                                               oninput="formatTimeInput(this)" onchange="updateSchedule('\${emp.id}', '\${day}', 'to', this.value)">
                                                    </div>
                                                </div>
                                                <div class="time-group">
                                                    <div class="time-inputs">
                                                        <input type="text" class="time-input" placeholder="In" 
                                                               value="\${formatTime(sched.actualIn)}" maxlength="5"
                                                               data-emp="\${emp.id}" data-day="\${day}" data-field="actualIn"
                                                               oninput="formatTimeInput(this)" onchange="updateSchedule('\${emp.id}', '\${day}', 'actualIn', this.value)"
                                                               style="background: #f0fff4;">
                                                        <input type="text" class="time-input" placeholder="Out" 
                                                               value="\${formatTime(sched.actualOut)}" maxlength="5"
                                                               data-emp="\${emp.id}" data-day="\${day}" data-field="actualOut"
                                                               oninput="formatTimeInput(this)" onchange="updateSchedule('\${emp.id}', '\${day}', 'actualOut', this.value)"
                                                               style="background: #f0fff4;">
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    \`;
                                }).join('')}
                                <td class="actions-cell">
                                    <div class="row-actions">
                                        <button onclick="duplicateRow('\${emp.id}')" title="Duplicate"><i class="mdi mdi-content-copy"></i></button>
                                        <button class="btn-toggle-active \${emp.isActive === false ? 'inactive' : ''}" onclick="toggleActive('\${emp.id}')" title="\${emp.isActive === false ? 'Activate' : 'Deactivate'}">
                                            <i class="mdi \${emp.isActive === false ? 'mdi-account-off' : 'mdi-account-check'}"></i>
                                        </button>
                                        <button class="btn-delete" onclick="deleteRow('\${emp.id}')" title="Delete"><i class="mdi mdi-delete"></i></button>
                                    </div>
                                </td>
                            </tr>
                        \`;
                    }
                    
                    function escapeHtml(text) {
                        if (!text) return '';
                        const div = document.createElement('div');
                        div.textContent = text;
                        return div.innerHTML;
                    }
                    
                    function formatTime(time) {
                        if (!time) return '';
                        // Convert HH:MM:SS to HH:MM
                        const match = time.toString().match(/^(\\d{1,2}):(\\d{2})/);
                        if (match) {
                            return match[1].padStart(2, '0') + ':' + match[2];
                        }
                        return time;
                    }
                    
                    function formatTimeInput(input) {
                        let val = input.value.replace(/[^0-9]/g, '');
                        if (val.length >= 3) {
                            val = val.slice(0, 2) + ':' + val.slice(2, 4);
                        }
                        input.value = val;
                        
                        // Validate
                        if (val.length === 5) {
                            const [h, m] = val.split(':').map(Number);
                            if (h > 23 || m > 59) {
                                input.classList.add('invalid');
                            } else {
                                input.classList.remove('invalid');
                            }
                        }
                    }
                    
                    function updateEmpField(empId, field, value) {
                        const emp = employees.find(e => e.id.toString() === empId.toString());
                        if (emp) {
                            emp[field] = value;
                            scheduleAutoSave();
                        }
                    }
                    
                    function updateSchedule(empId, day, field, value) {
                        const emp = employees.find(e => e.id.toString() === empId.toString());
                        if (emp) {
                            if (!emp.schedule[day]) {
                                emp.schedule[day] = { from: '', to: '', actualIn: '', actualOut: '', off: false };
                            }
                            emp.schedule[day][field] = value;
                            scheduleAutoSave();
                        }
                    }
                    
                    function toggleOff(empId, day, isOff) {
                        const emp = employees.find(e => e.id.toString() === empId.toString());
                        if (emp) {
                            if (!emp.schedule[day]) {
                                emp.schedule[day] = { from: '', to: '', actualIn: '', actualOut: '', off: false };
                            }
                            emp.schedule[day].off = isOff;
                            
                            // Update UI
                            const cell = document.querySelector(\`.day-cell[data-emp="\${empId}"][data-day="\${day}"]\`);
                            if (cell) {
                                cell.classList.toggle('is-off', isOff);
                            }
                            scheduleAutoSave();
                        }
                    }
                    
                    function addNewRow() {
                        newRowCounter++;
                        const newEmp = {
                            id: 'new_' + newRowCounter,
                            company: '',
                            store: '',
                            employeeId: '',
                            phone: '',
                            name: '',
                            position: '',
                            schedule: {}
                        };
                        employees.push(newEmp);
                        renderTable();
                        
                        // Focus on company field of new row
                        const newRow = document.querySelector(\`tr[data-id="new_\${newRowCounter}"]\`);
                        if (newRow) {
                            const companyInput = newRow.querySelector('input[data-field="company"]');
                            if (companyInput) companyInput.focus();
                        }
                    }
                    
                    function duplicateRow(empId) {
                        const emp = employees.find(e => e.id.toString() === empId.toString());
                        if (emp) {
                            newRowCounter++;
                            const duplicate = {
                                ...JSON.parse(JSON.stringify(emp)),
                                id: 'new_' + newRowCounter
                            };
                            employees.push(duplicate);
                            renderTable();
                            showAlert('Row duplicated', 'info');
                        }
                    }
                    
                    function toggleActive(empId) {
                        const emp = employees.find(e => e.id.toString() === empId.toString());
                        if (!emp) return;
                        const isNew = empId.toString().startsWith('new_');
                        if (isNew) {
                            emp.isActive = emp.isActive === false ? true : false;
                            renderTable();
                            return;
                        }
                        const newStatus = emp.isActive === false ? true : false;
                        const action = newStatus ? 'activate' : 'deactivate';
                        if (!confirm('Are you sure you want to ' + action + ' this employee?')) return;
                        
                        fetch('/personnel/schedule-attendance/api/employee/' + empId + '/toggle', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ isActive: newStatus })
                        })
                        .then(res => res.json())
                        .then(result => {
                            if (result.success) {
                                emp.isActive = newStatus;
                                renderTable();
                                showAlert('Employee ' + (newStatus ? 'activated' : 'deactivated'), 'success');
                            } else {
                                showAlert('Error: ' + result.message, 'error');
                            }
                        });
                    }

                    function deleteRow(empId) {
                        if (!confirm('Are you sure you want to delete this employee?')) return;
                        
                        const isNew = empId.toString().startsWith('new_');
                        if (isNew) {
                            // Just remove from array
                            employees = employees.filter(e => e.id.toString() !== empId.toString());
                            renderTable();
                        } else {
                            // Deactivate in database
                            fetch('/personnel/schedule-attendance/api/employee/' + empId + '/toggle', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isActive: false })
                            })
                            .then(res => res.json())
                            .then(result => {
                                if (result.success) {
                                    employees = employees.filter(e => e.id.toString() !== empId.toString());
                                    renderTable();
                                    showAlert('Employee deleted', 'success');
                                } else {
                                    showAlert('Error: ' + result.message, 'error');
                                }
                            });
                        }
                    }
                    
                    function scheduleAutoSave() {
                        if (saveTimeout) clearTimeout(saveTimeout);
                        saveTimeout = setTimeout(saveAll, 2000);
                    }
                    
                    async function saveAll() {
                        if (saveTimeout) clearTimeout(saveTimeout);
                        
                        const indicator = document.getElementById('savingIndicator');
                        indicator.classList.add('active');
                        
                        try {
                            // Save new employees first
                            const newEmps = employees.filter(e => e.id.toString().startsWith('new_'));
                            for (const emp of newEmps) {
                                if (!emp.company || !emp.name) continue;
                                
                                const res = await fetch('/personnel/schedule-attendance/api/employee', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        company: emp.company,
                                        store: emp.store,
                                        employeeId: emp.employeeId,
                                        phoneNumber: emp.phone,
                                        name: emp.name,
                                        position: emp.position
                                    })
                                });
                                const result = await res.json();
                                if (result.success && result.id) {
                                    emp.id = result.id;
                                }
                            }
                            
                            // Save existing employees
                            const existingEmps = employees.filter(e => !e.id.toString().startsWith('new_'));
                            for (const emp of existingEmps) {
                                await fetch('/personnel/schedule-attendance/api/employee/' + emp.id, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        company: emp.company,
                                        store: emp.store,
                                        employeeId: emp.employeeId,
                                        phoneNumber: emp.phone,
                                        name: emp.name,
                                        position: emp.position
                                    })
                                });
                            }
                            
                            // Save schedules
                            const scheduleData = {};
                            for (const emp of employees) {
                                if (emp.id.toString().startsWith('new_')) continue;
                                scheduleData[emp.id] = {};
                                for (const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) {
                                    const sched = emp.schedule[day] || {};
                                    scheduleData[emp.id][day + 'From1'] = sched.from || null;
                                    scheduleData[emp.id][day + 'To1'] = sched.to || null;
                                    scheduleData[emp.id][day + 'ActualIn'] = sched.actualIn || null;
                                    scheduleData[emp.id][day + 'ActualOut'] = sched.actualOut || null;
                                    scheduleData[emp.id][day + 'Off'] = sched.off ? 1 : 0;
                                }
                            }
                            
                            await fetch('/personnel/schedule-attendance/api/schedules/save', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ weekStart, schedules: scheduleData })
                            });
                            
                            showAlert('Saved successfully', 'success');
                        } catch (err) {
                            showAlert('Error saving: ' + err.message, 'error');
                        } finally {
                            indicator.classList.remove('active');
                        }
                    }
                    
                    async function submitWeek() {
                        if (!confirm('Submit this week? This will mark all schedules as submitted.')) return;
                        
                        await saveAll();
                        
                        try {
                            const res = await fetch('/personnel/schedule-attendance/api/schedules/submit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ weekStart })
                            });
                            const result = await res.json();
                            if (result.success) {
                                showAlert('Week submitted!', 'success');
                                setTimeout(() => location.reload(), 1000);
                            } else {
                                showAlert(result.message || 'Error', 'error');
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message, 'error');
                        }
                    }
                    
                    function loadDateRange() {
                        const from = document.getElementById('dateFrom').value;
                        const to = document.getElementById('dateTo').value;
                        
                        if (!from || !to) {
                            showAlert('Please select both From and To dates', 'error');
                            return;
                        }
                        
                        if (new Date(from) > new Date(to)) {
                            showAlert('From date must be before To date', 'error');
                            return;
                        }
                        
                        window.location.href = '?from=' + from + '&to=' + to;
                    }
                    
                    function setThisWeek() {
                        const today = new Date();
                        const day = today.getDay();
                        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(today.setDate(diff));
                        const sunday = new Date(monday);
                        sunday.setDate(sunday.getDate() + 6);
                        
                        document.getElementById('dateFrom').value = monday.toISOString().split('T')[0];
                        document.getElementById('dateTo').value = sunday.toISOString().split('T')[0];
                        loadDateRange();
                    }
                    
                    function showAlert(message, type) {
                        const alert = document.getElementById('alert');
                        alert.textContent = message;
                        alert.className = 'alert alert-' + type;
                        alert.style.display = 'block';
                        setTimeout(() => alert.style.display = 'none', 3000);
                    }
                    
                    // Keyboard navigation
                    function setupKeyboardNav() {
                        document.addEventListener('keydown', (e) => {
                            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') return;
                            
                            const cell = e.target.closest('td');
                            if (!cell) return;
                            
                            let nextCell = null;
                            
                            if (e.key === 'Tab' && !e.shiftKey) {
                                nextCell = cell.nextElementSibling;
                            } else if (e.key === 'Tab' && e.shiftKey) {
                                nextCell = cell.previousElementSibling;
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                const row = cell.closest('tr');
                                const nextRow = row.nextElementSibling;
                                if (nextRow) {
                                    const cellIndex = Array.from(row.cells).indexOf(cell);
                                    nextCell = nextRow.cells[cellIndex];
                                }
                            } else if (e.key === 'ArrowDown') {
                                const row = cell.closest('tr');
                                const nextRow = row.nextElementSibling;
                                if (nextRow) {
                                    const cellIndex = Array.from(row.cells).indexOf(cell);
                                    nextCell = nextRow.cells[cellIndex];
                                }
                            } else if (e.key === 'ArrowUp') {
                                const row = cell.closest('tr');
                                const prevRow = row.previousElementSibling;
                                if (prevRow) {
                                    const cellIndex = Array.from(row.cells).indexOf(cell);
                                    nextCell = prevRow.cells[cellIndex];
                                }
                            }
                            
                            if (nextCell) {
                                const input = nextCell.querySelector('input, select');
                                if (input) {
                                    if (e.key !== 'Tab') e.preventDefault();
                                    input.focus();
                                    if (input.select) input.select();
                                }
                            }
                        });
                        
                        // Copy-paste support
                        document.addEventListener('paste', (e) => {
                            const target = e.target;
                            if (target.tagName !== 'INPUT') return;
                            
                            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
                            const rows = pastedData.split('\\n').map(row => row.split('\\t'));
                            
                            if (rows.length > 1 || rows[0].length > 1) {
                                e.preventDefault();
                                
                                const startCell = target.closest('td');
                                const startRow = startCell.closest('tr');
                                let currentRow = startRow;
                                
                                rows.forEach((rowData, rowIdx) => {
                                    if (!currentRow) return;
                                    
                                    let currentCell = rowIdx === 0 ? startCell : currentRow.cells[Array.from(startRow.cells).indexOf(startCell)];
                                    
                                    rowData.forEach((cellData, colIdx) => {
                                        if (!currentCell) return;
                                        
                                        const input = currentCell.querySelector('input:not([type="checkbox"])');
                                        if (input) {
                                            input.value = cellData.trim();
                                            input.dispatchEvent(new Event('change', { bubbles: true }));
                                        }
                                        
                                        currentCell = currentCell.nextElementSibling;
                                    });
                                    
                                    currentRow = currentRow.nextElementSibling;
                                });
                                
                                showAlert('Pasted ' + rows.length + ' rows', 'info');
                            }
                        });
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading schedule:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Get employee by ID
router.get('/api/employee/:id', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Personnel_Employees WHERE Id = @id');
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        if (pool) await pool.close();
        res.status(500).json({ error: err.message });
    }
});

// API: Add employee (returns ID)
router.post('/api/employee', async (req, res) => {
    const user = req.currentUser;
    const { company, store, employeeId, phoneNumber, name, position } = req.body;
    
    if (!company || !name) {
        return res.json({ success: false, message: 'Company and Name are required' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('company', sql.NVarChar, company)
            .input('store', sql.NVarChar, store || null)
            .input('employeeId', sql.NVarChar, employeeId || null)
            .input('phoneNumber', sql.NVarChar, phoneNumber || null)
            .input('name', sql.NVarChar, name)
            .input('position', sql.NVarChar, position || null)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.NVarChar, user.id)
            .query(`
                INSERT INTO Personnel_Employees (Company, Store, EmployeeId, PhoneNumber, Name, Position, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@company, @store, @employeeId, @phoneNumber, @name, @position, @createdBy, @createdById)
            `);
        await pool.close();
        res.json({ success: true, id: result.recordset[0].Id });
    } catch (err) {
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// API: Update employee
router.put('/api/employee/:id', async (req, res) => {
    const { company, store, employeeId, phoneNumber, name, position } = req.body;
    
    if (!company || !name) {
        return res.json({ success: false, message: 'Company and Name are required' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('company', sql.NVarChar, company)
            .input('store', sql.NVarChar, store || null)
            .input('employeeId', sql.NVarChar, employeeId || null)
            .input('phoneNumber', sql.NVarChar, phoneNumber || null)
            .input('name', sql.NVarChar, name)
            .input('position', sql.NVarChar, position || null)
            .query(`
                UPDATE Personnel_Employees 
                SET Company = @company, Store = @store, EmployeeId = @employeeId, PhoneNumber = @phoneNumber, 
                    Name = @name, Position = @position, UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// API: Toggle employee active status
router.post('/api/employee/:id/toggle', async (req, res) => {
    const { isActive } = req.body;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('isActive', sql.Bit, isActive ? 1 : 0)
            .query('UPDATE Personnel_Employees SET IsActive = @isActive, UpdatedAt = GETDATE() WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// API: Save schedules
router.post('/api/schedules/save', async (req, res) => {
    const { weekStart, schedules } = req.body;
    
    if (!weekStart || !schedules) {
        return res.json({ success: false, message: 'Missing data' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        for (const [empId, schedule] of Object.entries(schedules)) {
            // Check if schedule exists for this week
            const existing = await pool.request()
                .input('empId', sql.Int, empId)
                .input('weekStart', sql.Date, weekStart)
                .query('SELECT Id FROM Personnel_EmployeeSchedule WHERE EmployeeId = @empId AND WeekStartDate = @weekStart');
            
            const request = pool.request()
                .input('empId', sql.Int, empId)
                .input('weekStart', sql.Date, weekStart);
            
            // Add all day fields
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const setClauses = [];
            const insertCols = ['EmployeeId', 'WeekStartDate'];
            const insertVals = ['@empId', '@weekStart'];
            
            days.forEach(day => {
                ['From1', 'To1', 'ActualIn', 'ActualOut'].forEach(field => {
                    const col = day + field;
                    const val = schedule[col] || null;
                    request.input(col, sql.NVarChar, val);
                    setClauses.push(`${col} = @${col}`);
                    insertCols.push(col);
                    insertVals.push(`@${col}`);
                });
                
                const offCol = day + 'Off';
                const offVal = schedule[offCol] ? 1 : 0;
                request.input(offCol, sql.Bit, offVal);
                setClauses.push(`${offCol} = @${offCol}`);
                insertCols.push(offCol);
                insertVals.push(`@${offCol}`);
            });
            
            if (existing.recordset.length > 0) {
                await request.query(`UPDATE Personnel_EmployeeSchedule SET ${setClauses.join(', ')}, UpdatedAt = GETDATE() WHERE EmployeeId = @empId AND WeekStartDate = @weekStart`);
            } else {
                await request.query(`INSERT INTO Personnel_EmployeeSchedule (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`);
            }
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving schedules:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// API: Submit week
router.post('/api/schedules/submit', async (req, res) => {
    const user = req.currentUser;
    const { weekStart } = req.body;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('weekStart', sql.Date, weekStart)
            .input('submittedBy', sql.NVarChar, user.displayName)
            .query(`
                UPDATE Personnel_EmployeeSchedule 
                SET Status = 'Submitted', SubmittedAt = GETDATE(), SubmittedBy = @submittedBy 
                WHERE WeekStartDate = @weekStart
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// History page
router.get('/history', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const weeks = await pool.request().query(`
            SELECT DISTINCT 
                WeekStartDate, 
                Status,
                SubmittedAt,
                SubmittedBy,
                COUNT(*) as EmployeeCount
            FROM Personnel_EmployeeSchedule
            GROUP BY WeekStartDate, Status, SubmittedAt, SubmittedBy
            ORDER BY WeekStartDate DESC
        `);
        
        await pool.close();
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Schedule History - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; }
                    .header {
                        background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
                        color: white; padding: 15px 25px;
                        display: flex; justify-content: space-between; align-items: center;
                    }
                    .header h1 { font-size: 20px; }
                    .header a { color: white; text-decoration: none; padding: 8px 16px; background: rgba(255,255,255,0.15); border-radius: 4px; }
                    .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #2d3748; color: white; padding: 12px; text-align: left; }
                    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
                    tr:hover { background: #f7fafc; }
                    .status-draft { color: #d69e2e; }
                    .status-submitted { color: #38a169; }
                    a.view-link { color: #3182ce; text-decoration: none; }
                    a.view-link:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Schedule History</h1>
                    <a href="/personnel/schedule-attendance">← Back to Schedule</a>
                </div>
                <div class="container">
                    <div class="card">
                        <table>
                            <thead>
                                <tr>
                                    <th>Week Starting</th>
                                    <th>Employees</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${weeks.recordset.length === 0 ? `
                                    <tr><td colspan="5" style="text-align: center; padding: 30px; color: #718096;">No schedules saved yet</td></tr>
                                ` : weeks.recordset.map(w => {
                                    const weekDate = new Date(w.WeekStartDate);
                                    const weekEnd = new Date(weekDate);
                                    weekEnd.setDate(weekEnd.getDate() + 6);
                                    const fromStr = weekDate.toISOString().split('T')[0];
                                    const toStr = weekEnd.toISOString().split('T')[0];
                                    return `
                                    <tr>
                                        <td>${weekDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td>${w.EmployeeCount}</td>
                                        <td class="status-${(w.Status || 'draft').toLowerCase()}">${w.Status || 'Draft'}</td>
                                        <td>${w.SubmittedAt ? new Date(w.SubmittedAt).toLocaleString('en-GB') + ' by ' + (w.SubmittedBy || '-') : '-'}</td>
                                        <td><a href="/personnel/schedule-attendance?from=${fromStr}&to=${toStr}" class="view-link">View</a></td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
