/**
 * Schedule and Attendance Routes
 * Manage employees with weekly schedules and attendance tracking
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

// Get Monday of current week
function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Main page - Employee list with schedule
router.get('/', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get week start date from query or default to current week
        let weekStart = req.query.week ? new Date(req.query.week) : getMonday(new Date());
        const weekStartStr = weekStart.toISOString().split('T')[0];
        
        // Get all employees (saved permanently)
        const employees = await pool.request()
            .query(`SELECT * FROM Personnel_Employees ORDER BY Company, Name`);
        
        // Get schedules for the selected week (each week has its own schedule)
        const schedules = await pool.request()
            .input('weekStart', sql.Date, weekStartStr)
            .query(`SELECT * FROM Personnel_EmployeeSchedule WHERE WeekStartDate = @weekStart`);
        
        // Check if week has been submitted
        const weekStatus = schedules.recordset.length > 0 && schedules.recordset[0].Status === 'Submitted' ? 'Submitted' : 'Draft';
        const submittedInfo = weekStatus === 'Submitted' && schedules.recordset[0].SubmittedAt 
            ? `Submitted on ${new Date(schedules.recordset[0].SubmittedAt).toLocaleString('en-GB')} by ${schedules.recordset[0].SubmittedBy || 'Unknown'}`
            : '';
        
        await pool.close();
        
        // Create lookup for schedules
        const scheduleMap = {};
        schedules.recordset.forEach(s => {
            scheduleMap[s.EmployeeId] = s;
        });
        
        // Build employee rows
        const employeeRows = employees.recordset.map((emp, idx) => {
            const schedule = scheduleMap[emp.Id] || {};
            
            // Build day cells
            const dayCells = DAYS.map(day => {
                const from1 = schedule[`${day}From1`] || '';
                const to1 = schedule[`${day}To1`] || '';
                const from2 = schedule[`${day}From2`] || '';
                const to2 = schedule[`${day}To2`] || '';
                const actualIn = schedule[`${day}ActualIn`] || '';
                const actualOut = schedule[`${day}ActualOut`] || '';
                const isOff = schedule[`${day}Off`] === true || schedule[`${day}Off`] === 1;
                
                return `
                    <td class="schedule-cell ${isOff ? 'day-off' : ''}" data-emp="${emp.Id}" data-day="${day}">
                        <div class="off-toggle">
                            <label class="off-checkbox">
                                <input type="checkbox" class="off-input" data-emp="${emp.Id}" data-day="${day}" ${isOff ? 'checked' : ''} onchange="toggleDayOff(this)">
                                <span>OFF</span>
                            </label>
                        </div>
                        <div class="time-inputs ${isOff ? 'hidden' : ''}">
                            <div class="time-section scheduled-section">
                                <div class="section-label">📅 Scheduled</div>
                                <div class="time-row">
                                    <input type="time" class="time-input" data-emp="${emp.Id}" data-day="${day}" data-field="From1" value="${from1}" placeholder="From">
                                    <span class="time-separator">→</span>
                                    <input type="time" class="time-input" data-emp="${emp.Id}" data-day="${day}" data-field="To1" value="${to1}" placeholder="To">
                                </div>
                            </div>
                            <div class="time-section actual-section">
                                <div class="section-label actual-label">✓ Actual</div>
                                <div class="time-row">
                                    <input type="time" class="time-input actual" data-emp="${emp.Id}" data-day="${day}" data-field="ActualIn" value="${actualIn}" title="Actual In">
                                    <span class="time-separator">→</span>
                                    <input type="time" class="time-input actual" data-emp="${emp.Id}" data-day="${day}" data-field="ActualOut" value="${actualOut}" title="Actual Out">
                                </div>
                            </div>
                        </div>
                    </td>
                `;
            }).join('');
            
            return `
                <tr class="${emp.IsActive ? '' : 'inactive-row'}">
                    <td>${idx + 1}</td>
                    <td>${emp.Company}</td>
                    <td>${emp.Store || '-'}</td>
                    <td>${emp.EmployeeId || '-'}</td>
                    <td>${emp.PhoneNumber || '-'}</td>
                    <td><strong>${emp.Name}</strong></td>
                    <td>${emp.Position || '-'}</td>
                    ${dayCells}
                    <td class="actions-cell">
                        <label class="toggle-switch">
                            <input type="checkbox" ${emp.IsActive ? 'checked' : ''} onchange="toggleActive(${emp.Id}, this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                        <button class="btn-icon" onclick="editEmployee(${emp.Id})" title="Edit">✏️</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Calculate week display range
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekDisplay = `${weekStart.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - ${weekEnd.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
        
        // Previous and next week
        const prevWeek = new Date(weekStart);
        prevWeek.setDate(prevWeek.getDate() - 7);
        const nextWeek = new Date(weekStart);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        // Status badge color
        const statusClass = weekStatus === 'Submitted' ? 'status-submitted' : 'status-draft';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Schedule & Attendance - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; }
                    .header {
                        background: linear-gradient(135deg, #0984e3 0%, #74b9ff 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .header h1 { font-size: 22px; }
                    .header-nav { display: flex; gap: 10px; flex-wrap: wrap; }
                    .header-nav a, .header-nav button {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        background: rgba(255,255,255,0.15);
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .header-nav a:hover, .header-nav button:hover { background: rgba(255,255,255,0.25); }
                    .container { padding: 20px; overflow-x: auto; }
                    .week-nav {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        margin-bottom: 20px;
                        background: white;
                        padding: 15px 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        flex-wrap: wrap;
                    }
                    .week-nav a {
                        padding: 8px 15px;
                        background: #0984e3;
                        color: white;
                        border-radius: 5px;
                        text-decoration: none;
                        font-size: 14px;
                    }
                    .week-nav span { font-weight: 600; font-size: 16px; }
                    .status-badge {
                        padding: 6px 14px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-draft { background: #fff3cd; color: #856404; }
                    .status-submitted { background: #d4edda; color: #155724; }
                    .submitted-info { font-size: 12px; color: #666; margin-left: 10px; }
                    .table-wrapper {
                        background: white;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                        overflow-x: auto;
                    }
                    table { border-collapse: collapse; width: 100%; min-width: 1800px; }
                    th, td { border: 1px solid #e0e0e0; padding: 8px; text-align: center; font-size: 13px; }
                    th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; z-index: 10; }
                    .day-header { background: #0984e3; color: white; }
                    .sub-header { background: #e8f4fd; font-size: 11px; color: #666; }
                    .schedule-cell { padding: 8px; vertical-align: top; min-width: 180px; }
                    .schedule-cell.day-off { background: #ffe6e6; }
                    .off-toggle { margin-bottom: 8px; }
                    .off-checkbox {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 5px;
                        cursor: pointer;
                        font-size: 11px;
                        font-weight: 600;
                        color: #d63031;
                    }
                    .off-checkbox input { width: 16px; height: 16px; cursor: pointer; }
                    .time-inputs.hidden { display: none; }
                    .time-section {
                        background: #f8f9fa;
                        border-radius: 6px;
                        padding: 8px;
                        margin-bottom: 8px;
                    }
                    .scheduled-section {
                        background: #e3f2fd;
                        border: 1px solid #90caf9;
                    }
                    .actual-section {
                        background: #fff8e1;
                        border: 1px solid #ffcc02;
                    }
                    .section-label {
                        font-size: 10px;
                        font-weight: 700;
                        color: #1565c0;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                        text-align: left;
                    }
                    .actual-label {
                        color: #f57c00;
                    }
                    .time-row {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                    }
                    .time-separator {
                        color: #999;
                        font-size: 10px;
                    }
                    .time-input {
                        width: 70px;
                        padding: 5px 3px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                        font-size: 12px;
                        text-align: center;
                    }
                    .time-input:focus {
                        outline: none;
                        border-color: #0984e3;
                        box-shadow: 0 0 0 2px rgba(9,132,227,0.2);
                    }
                    .time-input.actual {
                        background: #fff;
                        border-color: #ffb300;
                    }
                    .time-input.actual:focus {
                        border-color: #f57c00;
                        box-shadow: 0 0 0 2px rgba(245,124,0,0.2);
                    }
                    .inactive-row { background: #f8f8f8; opacity: 0.6; }
                    .toggle-switch {
                        position: relative;
                        display: inline-block;
                        width: 40px;
                        height: 22px;
                    }
                    .toggle-switch input { opacity: 0; width: 0; height: 0; }
                    .toggle-slider {
                        position: absolute;
                        cursor: pointer;
                        inset: 0;
                        background: #ccc;
                        border-radius: 22px;
                        transition: 0.3s;
                    }
                    .toggle-slider:before {
                        content: "";
                        position: absolute;
                        height: 16px;
                        width: 16px;
                        left: 3px;
                        bottom: 3px;
                        background: white;
                        border-radius: 50%;
                        transition: 0.3s;
                    }
                    .toggle-switch input:checked + .toggle-slider { background: #00b894; }
                    .toggle-switch input:checked + .toggle-slider:before { transform: translateX(18px); }
                    .actions-cell { white-space: nowrap; }
                    .btn-icon {
                        background: none;
                        border: none;
                        cursor: pointer;
                        font-size: 16px;
                        padding: 5px;
                        margin-left: 5px;
                    }
                    .btn-save {
                        background: #00b894;
                        color: white;
                        border: none;
                        padding: 10px 25px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    .btn-submit {
                        background: #6c5ce7;
                        color: white;
                        border: none;
                        padding: 10px 25px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    .btn-submit:hover { background: #5b4cdb; }
                    .alert {
                        position: fixed;
                        top: 80px;
                        right: 20px;
                        padding: 15px 25px;
                        border-radius: 8px;
                        color: white;
                        font-weight: 500;
                        z-index: 1000;
                        display: none;
                    }
                    .alert-success { background: #00b894; }
                    .alert-error { background: #d63031; }
                    /* Modal styles */
                    .modal {
                        display: none;
                        position: fixed;
                        inset: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .modal.active { display: flex; }
                    .modal-content {
                        background: white;
                        padding: 30px;
                        border-radius: 12px;
                        width: 500px;
                        max-width: 95%;
                        max-height: 90vh;
                        overflow-y: auto;
                    }
                    .modal-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .modal-header h2 { font-size: 20px; color: #333; }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #666;
                    }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #e0e0e0;
                        border-radius: 8px;
                        font-size: 15px;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: #0984e3;
                    }
                    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .btn-submit {
                        background: #0984e3;
                        color: white;
                        border: none;
                        padding: 14px 30px;
                        border-radius: 8px;
                        font-size: 15px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                        margin-top: 10px;
                    }
                    .btn-submit:hover { background: #0875cc; }
                    .empty-state {
                        text-align: center;
                        padding: 60px;
                        color: #666;
                    }
                    .empty-state .icon { font-size: 60px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📅 Schedule & Attendance</h1>
                    <div class="header-nav">
                        <button onclick="openAddModal()">➕ Add Employee</button>
                        <button onclick="saveAllSchedules()" class="btn-save">💾 Save Changes</button>
                        <button onclick="submitWeek()" class="btn-submit">📤 Submit Week</button>
                        <a href="/personnel/schedule-attendance/history">📜 History</a>
                        <a href="/personnel">← Back to Personnel</a>
                    </div>
                </div>
                
                <div id="alert" class="alert"></div>
                
                <div class="container">
                    <div class="week-nav">
                        <a href="?week=${prevWeek.toISOString().split('T')[0]}">◀ Previous</a>
                        <span>Week: ${weekDisplay}</span>
                        <a href="?week=${nextWeek.toISOString().split('T')[0]}">Next ▶</a>
                        <input type="date" id="weekPicker" value="${weekStartStr}" onchange="goToWeek(this.value)" style="margin-left: 20px; padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
                        <span class="status-badge ${statusClass}">${weekStatus}</span>
                        ${submittedInfo ? `<span class="submitted-info">${submittedInfo}</span>` : ''}
                    </div>
                    
                    <div class="table-wrapper">
                        ${employees.recordset.length === 0 ? `
                            <div class="empty-state">
                                <div class="icon">👥</div>
                                <h3>No Employees Added Yet</h3>
                                <p>Click "Add Employee" to get started.</p>
                            </div>
                        ` : `
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Company</th>
                                        <th>Store</th>
                                        <th>Emp ID</th>
                                        <th>Phone</th>
                                        <th>Name</th>
                                        <th>Position</th>
                                        ${DAYS.map(d => `<th class="day-header">${d}</th>`).join('')}
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${employeeRows}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
                
                <!-- Add/Edit Employee Modal -->
                <div class="modal" id="employeeModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 id="modalTitle">Add Employee</h2>
                            <button class="modal-close" onclick="closeModal()">×</button>
                        </div>
                        <form id="employeeForm">
                            <input type="hidden" id="empId" value="">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Company *</label>
                                    <input type="text" id="empCompany" required placeholder="Enter company name">
                                </div>
                                <div class="form-group">
                                    <label>Store</label>
                                    <select id="empStore">
                                        <option value="">Select Store</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Employee ID</label>
                                    <input type="text" id="empEmployeeId" placeholder="Employee ID">
                                </div>
                                <div class="form-group">
                                    <label>Phone Number</label>
                                    <input type="tel" id="empPhone" placeholder="Phone number">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Name *</label>
                                <input type="text" id="empName" required placeholder="Full name">
                            </div>
                            <div class="form-group">
                                <label>Position</label>
                                <input type="text" id="empPosition" placeholder="Job position">
                            </div>
                            <button type="submit" class="btn-submit" id="submitBtn">Add Employee</button>
                        </form>
                    </div>
                </div>
                
                <script>
                    const weekStart = '${weekStartStr}';
                    let storesList = [];
                    
                    // Load stores from system settings
                    async function loadStores() {
                        try {
                            const res = await fetch('/operational-excellence/system-settings/api/stores');
                            const stores = await res.json();
                            storesList = stores.filter(s => s.IsActive !== false);
                            
                            const select = document.getElementById('empStore');
                            select.innerHTML = '<option value="">Select Store</option>';
                            storesList.forEach(store => {
                                const opt = document.createElement('option');
                                opt.value = store.StoreName;
                                opt.textContent = store.StoreName;
                                select.appendChild(opt);
                            });
                        } catch (err) {
                            console.error('Error loading stores:', err);
                        }
                    }
                    
                    // Initialize stores on page load
                    document.addEventListener('DOMContentLoaded', loadStores);
                    
                    function showAlert(message, type) {
                        const alert = document.getElementById('alert');
                        alert.textContent = message;
                        alert.className = 'alert alert-' + type;
                        alert.style.display = 'block';
                        setTimeout(() => alert.style.display = 'none', 3000);
                    }
                    
                    function goToWeek(date) {
                        // Adjust to Monday of that week
                        const d = new Date(date);
                        const day = d.getDay();
                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(d.setDate(diff));
                        window.location.href = '?week=' + monday.toISOString().split('T')[0];
                    }
                    
                    function openAddModal() {
                        document.getElementById('modalTitle').textContent = 'Add Employee';
                        document.getElementById('submitBtn').textContent = 'Add Employee';
                        document.getElementById('employeeForm').reset();
                        document.getElementById('empId').value = '';
                        document.getElementById('employeeModal').classList.add('active');
                    }
                    
                    function closeModal() {
                        document.getElementById('employeeModal').classList.remove('active');
                    }
                    
                    async function editEmployee(id) {
                        try {
                            const res = await fetch('/personnel/schedule-attendance/api/employee/' + id);
                            const emp = await res.json();
                            
                            document.getElementById('modalTitle').textContent = 'Edit Employee';
                            document.getElementById('submitBtn').textContent = 'Save Changes';
                            document.getElementById('empId').value = emp.Id;
                            document.getElementById('empCompany').value = emp.Company;
                            document.getElementById('empStore').value = emp.Store || '';
                            document.getElementById('empEmployeeId').value = emp.EmployeeId || '';
                            document.getElementById('empPhone').value = emp.PhoneNumber || '';
                            document.getElementById('empName').value = emp.Name;
                            document.getElementById('empPosition').value = emp.Position || '';
                            
                            document.getElementById('employeeModal').classList.add('active');
                        } catch (err) {
                            showAlert('Error loading employee data', 'error');
                        }
                    }
                    
                    document.getElementById('employeeForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const id = document.getElementById('empId').value;
                        const data = {
                            company: document.getElementById('empCompany').value,
                            store: document.getElementById('empStore').value,
                            employeeId: document.getElementById('empEmployeeId').value,
                            phoneNumber: document.getElementById('empPhone').value,
                            name: document.getElementById('empName').value,
                            position: document.getElementById('empPosition').value
                        };
                        
                        try {
                            const res = await fetch('/personnel/schedule-attendance/api/employee' + (id ? '/' + id : ''), {
                                method: id ? 'PUT' : 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            const result = await res.json();
                            if (result.success) {
                                showAlert(id ? 'Employee updated!' : 'Employee added!', 'success');
                                setTimeout(() => location.reload(), 1000);
                            } else {
                                showAlert(result.message || 'Error saving employee', 'error');
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message, 'error');
                        }
                    });
                    
                    async function toggleActive(id, isActive) {
                        try {
                            const res = await fetch('/personnel/schedule-attendance/api/employee/' + id + '/toggle', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isActive })
                            });
                            const result = await res.json();
                            if (result.success) {
                                showAlert('Status updated!', 'success');
                                setTimeout(() => location.reload(), 500);
                            }
                        } catch (err) {
                            showAlert('Error updating status', 'error');
                        }
                    }
                    
                    function toggleDayOff(checkbox) {
                        const empId = checkbox.dataset.emp;
                        const day = checkbox.dataset.day;
                        const cell = checkbox.closest('.schedule-cell');
                        const timeInputs = cell.querySelector('.time-inputs');
                        
                        if (checkbox.checked) {
                            cell.classList.add('day-off');
                            timeInputs.classList.add('hidden');
                        } else {
                            cell.classList.remove('day-off');
                            timeInputs.classList.remove('hidden');
                        }
                    }
                    
                    async function saveAllSchedules() {
                        const timeInputs = document.querySelectorAll('.time-input');
                        const offInputs = document.querySelectorAll('.off-input');
                        const schedules = {};
                        
                        // Collect time values
                        timeInputs.forEach(input => {
                            const empId = input.dataset.emp;
                            const day = input.dataset.day;
                            const field = input.dataset.field;
                            
                            if (!schedules[empId]) schedules[empId] = {};
                            schedules[empId][day + field] = input.value;
                        });
                        
                        // Collect Off values
                        offInputs.forEach(input => {
                            const empId = input.dataset.emp;
                            const day = input.dataset.day;
                            
                            if (!schedules[empId]) schedules[empId] = {};
                            schedules[empId][day + 'Off'] = input.checked;
                        });
                        
                        try {
                            const res = await fetch('/personnel/schedule-attendance/api/schedules/save', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ weekStart, schedules })
                            });
                            
                            const result = await res.json();
                            if (result.success) {
                                showAlert('Schedules saved successfully!', 'success');
                            } else {
                                showAlert(result.message || 'Error saving schedules', 'error');
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message, 'error');
                        }
                    }
                    
                    async function submitWeek() {
                        if (!confirm('Are you sure you want to submit this week\\'s schedule? This will mark it as finalized.')) {
                            return;
                        }
                        
                        // First save, then submit
                        const timeInputs = document.querySelectorAll('.time-input');
                        const offInputs = document.querySelectorAll('.off-input');
                        const schedules = {};
                        
                        timeInputs.forEach(input => {
                            const empId = input.dataset.emp;
                            const day = input.dataset.day;
                            const field = input.dataset.field;
                            if (!schedules[empId]) schedules[empId] = {};
                            schedules[empId][day + field] = input.value;
                        });
                        
                        offInputs.forEach(input => {
                            const empId = input.dataset.emp;
                            const day = input.dataset.day;
                            if (!schedules[empId]) schedules[empId] = {};
                            schedules[empId][day + 'Off'] = input.checked;
                        });
                        
                        try {
                            // Save first
                            await fetch('/personnel/schedule-attendance/api/schedules/save', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ weekStart, schedules })
                            });
                            
                            // Then submit
                            const res = await fetch('/personnel/schedule-attendance/api/schedules/submit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ weekStart })
                            });
                            
                            const result = await res.json();
                            if (result.success) {
                                showAlert('Week submitted successfully!', 'success');
                                setTimeout(() => location.reload(), 1000);
                            } else {
                                showAlert(result.message || 'Error submitting week', 'error');
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message, 'error');
                        }
                    }
                    
                    // Close modal on outside click
                    document.getElementById('employeeModal').addEventListener('click', (e) => {
                        if (e.target === document.getElementById('employeeModal')) {
                            closeModal();
                        }
                    });
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

// API: Add employee
router.post('/api/employee', async (req, res) => {
    const user = req.currentUser;
    const { company, store, employeeId, phoneNumber, name, position } = req.body;
    
    if (!company || !name) {
        return res.json({ success: false, message: 'Company and Name are required' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
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
                VALUES (@company, @store, @employeeId, @phoneNumber, @name, @position, @createdBy, @createdById)
            `);
        await pool.close();
        res.json({ success: true });
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
            
            if (existing.recordset.length > 0) {
                // Update existing
                await pool.request()
                    .input('id', sql.Int, existing.recordset[0].Id)
                    .input('mondayFrom1', sql.NVarChar, schedule.MondayFrom1 || null)
                    .input('mondayTo1', sql.NVarChar, schedule.MondayTo1 || null)
                    .input('mondayFrom2', sql.NVarChar, schedule.MondayFrom2 || null)
                    .input('mondayTo2', sql.NVarChar, schedule.MondayTo2 || null)
                    .input('mondayActualIn', sql.NVarChar, schedule.MondayActualIn || null)
                    .input('mondayActualOut', sql.NVarChar, schedule.MondayActualOut || null)
                    .input('mondayOff', sql.Bit, schedule.MondayOff ? 1 : 0)
                    .input('tuesdayFrom1', sql.NVarChar, schedule.TuesdayFrom1 || null)
                    .input('tuesdayTo1', sql.NVarChar, schedule.TuesdayTo1 || null)
                    .input('tuesdayFrom2', sql.NVarChar, schedule.TuesdayFrom2 || null)
                    .input('tuesdayTo2', sql.NVarChar, schedule.TuesdayTo2 || null)
                    .input('tuesdayActualIn', sql.NVarChar, schedule.TuesdayActualIn || null)
                    .input('tuesdayActualOut', sql.NVarChar, schedule.TuesdayActualOut || null)
                    .input('tuesdayOff', sql.Bit, schedule.TuesdayOff ? 1 : 0)
                    .input('wednesdayFrom1', sql.NVarChar, schedule.WednesdayFrom1 || null)
                    .input('wednesdayTo1', sql.NVarChar, schedule.WednesdayTo1 || null)
                    .input('wednesdayFrom2', sql.NVarChar, schedule.WednesdayFrom2 || null)
                    .input('wednesdayTo2', sql.NVarChar, schedule.WednesdayTo2 || null)
                    .input('wednesdayActualIn', sql.NVarChar, schedule.WednesdayActualIn || null)
                    .input('wednesdayActualOut', sql.NVarChar, schedule.WednesdayActualOut || null)
                    .input('wednesdayOff', sql.Bit, schedule.WednesdayOff ? 1 : 0)
                    .input('thursdayFrom1', sql.NVarChar, schedule.ThursdayFrom1 || null)
                    .input('thursdayTo1', sql.NVarChar, schedule.ThursdayTo1 || null)
                    .input('thursdayFrom2', sql.NVarChar, schedule.ThursdayFrom2 || null)
                    .input('thursdayTo2', sql.NVarChar, schedule.ThursdayTo2 || null)
                    .input('thursdayActualIn', sql.NVarChar, schedule.ThursdayActualIn || null)
                    .input('thursdayActualOut', sql.NVarChar, schedule.ThursdayActualOut || null)
                    .input('thursdayOff', sql.Bit, schedule.ThursdayOff ? 1 : 0)
                    .input('fridayFrom1', sql.NVarChar, schedule.FridayFrom1 || null)
                    .input('fridayTo1', sql.NVarChar, schedule.FridayTo1 || null)
                    .input('fridayFrom2', sql.NVarChar, schedule.FridayFrom2 || null)
                    .input('fridayTo2', sql.NVarChar, schedule.FridayTo2 || null)
                    .input('fridayActualIn', sql.NVarChar, schedule.FridayActualIn || null)
                    .input('fridayActualOut', sql.NVarChar, schedule.FridayActualOut || null)
                    .input('fridayOff', sql.Bit, schedule.FridayOff ? 1 : 0)
                    .input('saturdayFrom1', sql.NVarChar, schedule.SaturdayFrom1 || null)
                    .input('saturdayTo1', sql.NVarChar, schedule.SaturdayTo1 || null)
                    .input('saturdayFrom2', sql.NVarChar, schedule.SaturdayFrom2 || null)
                    .input('saturdayTo2', sql.NVarChar, schedule.SaturdayTo2 || null)
                    .input('saturdayActualIn', sql.NVarChar, schedule.SaturdayActualIn || null)
                    .input('saturdayActualOut', sql.NVarChar, schedule.SaturdayActualOut || null)
                    .input('saturdayOff', sql.Bit, schedule.SaturdayOff ? 1 : 0)
                    .input('sundayFrom1', sql.NVarChar, schedule.SundayFrom1 || null)
                    .input('sundayTo1', sql.NVarChar, schedule.SundayTo1 || null)
                    .input('sundayFrom2', sql.NVarChar, schedule.SundayFrom2 || null)
                    .input('sundayTo2', sql.NVarChar, schedule.SundayTo2 || null)
                    .input('sundayActualIn', sql.NVarChar, schedule.SundayActualIn || null)
                    .input('sundayActualOut', sql.NVarChar, schedule.SundayActualOut || null)
                    .input('sundayOff', sql.Bit, schedule.SundayOff ? 1 : 0)
                    .query(`
                        UPDATE Personnel_EmployeeSchedule SET
                            MondayFrom1 = @mondayFrom1, MondayTo1 = @mondayTo1, MondayFrom2 = @mondayFrom2, MondayTo2 = @mondayTo2, MondayActualIn = @mondayActualIn, MondayActualOut = @mondayActualOut,
                            TuesdayFrom1 = @tuesdayFrom1, TuesdayTo1 = @tuesdayTo1, TuesdayFrom2 = @tuesdayFrom2, TuesdayTo2 = @tuesdayTo2, TuesdayActualIn = @tuesdayActualIn, TuesdayActualOut = @tuesdayActualOut,
                            WednesdayFrom1 = @wednesdayFrom1, WednesdayTo1 = @wednesdayTo1, WednesdayFrom2 = @wednesdayFrom2, WednesdayTo2 = @wednesdayTo2, WednesdayActualIn = @wednesdayActualIn, WednesdayActualOut = @wednesdayActualOut,
                            ThursdayFrom1 = @thursdayFrom1, ThursdayTo1 = @thursdayTo1, ThursdayFrom2 = @thursdayFrom2, ThursdayTo2 = @thursdayTo2, ThursdayActualIn = @thursdayActualIn, ThursdayActualOut = @thursdayActualOut,
                            FridayFrom1 = @fridayFrom1, FridayTo1 = @fridayTo1, FridayFrom2 = @fridayFrom2, FridayTo2 = @fridayTo2, FridayActualIn = @fridayActualIn, FridayActualOut = @fridayActualOut,
                            SaturdayFrom1 = @saturdayFrom1, SaturdayTo1 = @saturdayTo1, SaturdayFrom2 = @saturdayFrom2, SaturdayTo2 = @saturdayTo2, SaturdayActualIn = @saturdayActualIn, SaturdayActualOut = @saturdayActualOut,
                            SundayFrom1 = @sundayFrom1, SundayTo1 = @sundayTo1, SundayFrom2 = @sundayFrom2, SundayTo2 = @sundayTo2, SundayActualIn = @sundayActualIn, SundayActualOut = @sundayActualOut,
                            MondayOff = @mondayOff, TuesdayOff = @tuesdayOff, WednesdayOff = @wednesdayOff, ThursdayOff = @thursdayOff, FridayOff = @fridayOff, SaturdayOff = @saturdayOff, SundayOff = @sundayOff,
                            UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
            } else {
                // Insert new
                await pool.request()
                    .input('empId', sql.Int, empId)
                    .input('weekStart', sql.Date, weekStart)
                    .input('mondayFrom1', sql.NVarChar, schedule.MondayFrom1 || null)
                    .input('mondayTo1', sql.NVarChar, schedule.MondayTo1 || null)
                    .input('mondayFrom2', sql.NVarChar, schedule.MondayFrom2 || null)
                    .input('mondayTo2', sql.NVarChar, schedule.MondayTo2 || null)
                    .input('mondayActualIn', sql.NVarChar, schedule.MondayActualIn || null)
                    .input('mondayActualOut', sql.NVarChar, schedule.MondayActualOut || null)
                    .input('mondayOff', sql.Bit, schedule.MondayOff ? 1 : 0)
                    .input('tuesdayFrom1', sql.NVarChar, schedule.TuesdayFrom1 || null)
                    .input('tuesdayTo1', sql.NVarChar, schedule.TuesdayTo1 || null)
                    .input('tuesdayFrom2', sql.NVarChar, schedule.TuesdayFrom2 || null)
                    .input('tuesdayTo2', sql.NVarChar, schedule.TuesdayTo2 || null)
                    .input('tuesdayActualIn', sql.NVarChar, schedule.TuesdayActualIn || null)
                    .input('tuesdayActualOut', sql.NVarChar, schedule.TuesdayActualOut || null)
                    .input('tuesdayOff', sql.Bit, schedule.TuesdayOff ? 1 : 0)
                    .input('wednesdayFrom1', sql.NVarChar, schedule.WednesdayFrom1 || null)
                    .input('wednesdayTo1', sql.NVarChar, schedule.WednesdayTo1 || null)
                    .input('wednesdayFrom2', sql.NVarChar, schedule.WednesdayFrom2 || null)
                    .input('wednesdayTo2', sql.NVarChar, schedule.WednesdayTo2 || null)
                    .input('wednesdayActualIn', sql.NVarChar, schedule.WednesdayActualIn || null)
                    .input('wednesdayActualOut', sql.NVarChar, schedule.WednesdayActualOut || null)
                    .input('wednesdayOff', sql.Bit, schedule.WednesdayOff ? 1 : 0)
                    .input('thursdayFrom1', sql.NVarChar, schedule.ThursdayFrom1 || null)
                    .input('thursdayTo1', sql.NVarChar, schedule.ThursdayTo1 || null)
                    .input('thursdayFrom2', sql.NVarChar, schedule.ThursdayFrom2 || null)
                    .input('thursdayTo2', sql.NVarChar, schedule.ThursdayTo2 || null)
                    .input('thursdayActualIn', sql.NVarChar, schedule.ThursdayActualIn || null)
                    .input('thursdayActualOut', sql.NVarChar, schedule.ThursdayActualOut || null)
                    .input('thursdayOff', sql.Bit, schedule.ThursdayOff ? 1 : 0)
                    .input('fridayFrom1', sql.NVarChar, schedule.FridayFrom1 || null)
                    .input('fridayTo1', sql.NVarChar, schedule.FridayTo1 || null)
                    .input('fridayFrom2', sql.NVarChar, schedule.FridayFrom2 || null)
                    .input('fridayTo2', sql.NVarChar, schedule.FridayTo2 || null)
                    .input('fridayActualIn', sql.NVarChar, schedule.FridayActualIn || null)
                    .input('fridayActualOut', sql.NVarChar, schedule.FridayActualOut || null)
                    .input('fridayOff', sql.Bit, schedule.FridayOff ? 1 : 0)
                    .input('saturdayFrom1', sql.NVarChar, schedule.SaturdayFrom1 || null)
                    .input('saturdayTo1', sql.NVarChar, schedule.SaturdayTo1 || null)
                    .input('saturdayFrom2', sql.NVarChar, schedule.SaturdayFrom2 || null)
                    .input('saturdayTo2', sql.NVarChar, schedule.SaturdayTo2 || null)
                    .input('saturdayActualIn', sql.NVarChar, schedule.SaturdayActualIn || null)
                    .input('saturdayActualOut', sql.NVarChar, schedule.SaturdayActualOut || null)
                    .input('saturdayOff', sql.Bit, schedule.SaturdayOff ? 1 : 0)
                    .input('sundayFrom1', sql.NVarChar, schedule.SundayFrom1 || null)
                    .input('sundayTo1', sql.NVarChar, schedule.SundayTo1 || null)
                    .input('sundayFrom2', sql.NVarChar, schedule.SundayFrom2 || null)
                    .input('sundayTo2', sql.NVarChar, schedule.SundayTo2 || null)
                    .input('sundayActualIn', sql.NVarChar, schedule.SundayActualIn || null)
                    .input('sundayActualOut', sql.NVarChar, schedule.SundayActualOut || null)
                    .input('sundayOff', sql.Bit, schedule.SundayOff ? 1 : 0)
                    .query(`
                        INSERT INTO Personnel_EmployeeSchedule (EmployeeId, WeekStartDate,
                            MondayFrom1, MondayTo1, MondayFrom2, MondayTo2, MondayActualIn, MondayActualOut, MondayOff,
                            TuesdayFrom1, TuesdayTo1, TuesdayFrom2, TuesdayTo2, TuesdayActualIn, TuesdayActualOut, TuesdayOff,
                            WednesdayFrom1, WednesdayTo1, WednesdayFrom2, WednesdayTo2, WednesdayActualIn, WednesdayActualOut, WednesdayOff,
                            ThursdayFrom1, ThursdayTo1, ThursdayFrom2, ThursdayTo2, ThursdayActualIn, ThursdayActualOut, ThursdayOff,
                            FridayFrom1, FridayTo1, FridayFrom2, FridayTo2, FridayActualIn, FridayActualOut, FridayOff,
                            SaturdayFrom1, SaturdayTo1, SaturdayFrom2, SaturdayTo2, SaturdayActualIn, SaturdayActualOut, SaturdayOff,
                            SundayFrom1, SundayTo1, SundayFrom2, SundayTo2, SundayActualIn, SundayActualOut, SundayOff)
                        VALUES (@empId, @weekStart,
                            @mondayFrom1, @mondayTo1, @mondayFrom2, @mondayTo2, @mondayActualIn, @mondayActualOut, @mondayOff,
                            @tuesdayFrom1, @tuesdayTo1, @tuesdayFrom2, @tuesdayTo2, @tuesdayActualIn, @tuesdayActualOut, @tuesdayOff,
                            @wednesdayFrom1, @wednesdayTo1, @wednesdayFrom2, @wednesdayTo2, @wednesdayActualIn, @wednesdayActualOut, @wednesdayOff,
                            @thursdayFrom1, @thursdayTo1, @thursdayFrom2, @thursdayTo2, @thursdayActualIn, @thursdayActualOut, @thursdayOff,
                            @fridayFrom1, @fridayTo1, @fridayFrom2, @fridayTo2, @fridayActualIn, @fridayActualOut, @fridayOff,
                            @saturdayFrom1, @saturdayTo1, @saturdayFrom2, @saturdayTo2, @saturdayActualIn, @saturdayActualOut, @saturdayOff,
                            @sundayFrom1, @sundayTo1, @sundayFrom2, @sundayTo2, @sundayActualIn, @sundayActualOut, @sundayOff)
                    `);
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

// API: Submit week schedules
router.post('/api/schedules/submit', async (req, res) => {
    const user = req.currentUser;
    const { weekStart } = req.body;
    
    if (!weekStart) {
        return res.json({ success: false, message: 'Missing week start date' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Update all schedules for this week to Submitted status
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
        console.error('Error submitting schedules:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// History - List of all submitted weeks
router.get('/history', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get all unique weeks with their status
        const result = await pool.request()
            .query(`
                SELECT 
                    WeekStartDate,
                    Status,
                    MAX(SubmittedAt) as SubmittedAt,
                    MAX(SubmittedBy) as SubmittedBy,
                    COUNT(DISTINCT EmployeeId) as EmployeeCount
                FROM Personnel_EmployeeSchedule
                GROUP BY WeekStartDate, Status
                ORDER BY WeekStartDate DESC
            `);
        
        await pool.close();
        
        const tableRows = result.recordset.map(w => {
            const weekStart = new Date(w.WeekStartDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const weekDisplay = `${weekStart.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})} - ${weekEnd.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}`;
            const submittedDate = w.SubmittedAt ? new Date(w.SubmittedAt).toLocaleString('en-GB') : '-';
            const statusClass = w.Status === 'Submitted' ? 'status-submitted' : 'status-draft';
            
            return `
                <tr onclick="window.location='/personnel/schedule-attendance?week=${weekStart.toISOString().split('T')[0]}'" style="cursor: pointer;">
                    <td><strong>${weekDisplay}</strong></td>
                    <td>${w.EmployeeCount} employees</td>
                    <td><span class="status-badge ${statusClass}">${w.Status || 'Draft'}</span></td>
                    <td>${w.SubmittedBy || '-'}</td>
                    <td>${submittedDate}</td>
                    <td>
                        <a href="/personnel/schedule-attendance?week=${weekStart.toISOString().split('T')[0]}" class="btn-view">View</a>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Schedule History - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #0984e3 0%, #74b9ff 100%);
                        color: white;
                        padding: 20px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 10px;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; flex-wrap: wrap; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        background: rgba(255,255,255,0.15);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    .table-container {
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 2px 15px rgba(0,0,0,0.08);
                        overflow-x: auto;
                    }
                    table { width: 100%; border-collapse: collapse; min-width: 700px; }
                    th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 12px;
                        text-transform: uppercase;
                        color: #666;
                        border-bottom: 2px solid #dee2e6;
                    }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                    tr:hover { background: #f0f7ff; }
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-submitted { background: #d4edda; color: #155724; }
                    .status-draft { background: #fff3cd; color: #856404; }
                    .btn-view {
                        color: #0984e3;
                        text-decoration: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        border: 1px solid #0984e3;
                        font-size: 13px;
                    }
                    .btn-view:hover {
                        background: #0984e3;
                        color: white;
                    }
                    .empty-state {
                        text-align: center;
                        padding: 60px 20px;
                        color: #666;
                    }
                    .empty-state .icon { font-size: 64px; margin-bottom: 20px; }
                    .empty-state a {
                        display: inline-block;
                        margin-top: 20px;
                        background: #0984e3;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 8px;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📜 Schedule History</h1>
                    <div class="header-nav">
                        <a href="/personnel/schedule-attendance">📅 Current Week</a>
                        <a href="/personnel">← Back to Personnel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>Week</th>
                                        <th>Employees</th>
                                        <th>Status</th>
                                        <th>Submitted By</th>
                                        <th>Submitted At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">📋</div>
                                <h3>No schedules recorded yet</h3>
                                <p>Start by creating a schedule for the current week.</p>
                                <a href="/personnel/schedule-attendance">📅 Go to Current Week</a>
                            </div>
                        `}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading history:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
