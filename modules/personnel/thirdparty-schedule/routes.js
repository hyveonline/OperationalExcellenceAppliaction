/**
 * Thirdparty Schedule Routes
 * Personnel fills weekly schedule for thirdparty employees
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const workflowEngine = require('../../../services/workflow-engine');

// Configure multer for CSV upload
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

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

// Main page - shows list of schedules and button to create new
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const userId = req.currentUser.userId;
        
        // Get user's schedules
        const schedules = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT s.*, 
                       (SELECT COUNT(*) FROM ThirdpartyScheduleEmployees WHERE ScheduleId = s.Id) as EmployeeCount,
                       u.DisplayName as CreatedByName
                FROM ThirdpartySchedules s
                LEFT JOIN Users u ON s.CreatedBy = u.Id
                WHERE s.CreatedBy = @userId
                ORDER BY s.CreatedAt DESC
            `);
        
        await pool.close();
        
        const tableRows = schedules.recordset.map(s => {
            const fromDate = new Date(s.FromDate).toLocaleDateString('en-GB');
            const toDate = new Date(s.ToDate).toLocaleDateString('en-GB');
            const createdAt = new Date(s.CreatedAt).toLocaleDateString('en-GB');
            
            return `
                <tr onclick="viewSchedule(${s.Id})" style="cursor:pointer;">
                    <td>#${s.Id}</td>
                    <td>${s.StoreName || '-'}</td>
                    <td>${fromDate} - ${toDate}</td>
                    <td>${s.EmployeeCount} employees</td>
                    <td><span class="status-badge status-${s.Status.toLowerCase()}">${s.Status}</span></td>
                    <td>${createdAt}</td>
                    <td>
                        <a href="/personnel/thirdparty-schedule/view/${s.Id}" class="btn btn-sm btn-primary" onclick="event.stopPropagation();">View</a>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>Thirdparty Schedule - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1200px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    }
                    .card-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid #eee;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-primary { background: #8e44ad; color: white; }
                    .btn-primary:hover { background: #7d3c98; }
                    .btn-sm { padding: 6px 12px; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #555; }
                    tr:hover { background: #f8f9fa; }
                    .status-badge {
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-submitted { background: #e8f5e9; color: #28a745; }
                    .status-draft { background: #fff3cd; color: #856404; }
                    .empty-state {
                        text-align: center;
                        padding: 50px;
                        color: #666;
                    }
                    .empty-icon { font-size: 50px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏢 Employees Schedule - Thirdparty</h1>
                    <div class="header-nav">
                        <a href="/personnel/thirdparty-schedule/new">+ New Schedule</a>
                        <a href="/personnel">← Back to Personnel</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header">
                            <h2 style="margin:0;">My Schedules</h2>
                        </div>
                        ${schedules.recordset.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-icon">📋</div>
                                <h3>No Schedules Yet</h3>
                                <p>Create your first thirdparty employee schedule.</p>
                                <a href="/personnel/thirdparty-schedule/new" class="btn btn-primary" style="margin-top:15px;">+ Create New Schedule</a>
                            </div>
                        ` : `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Period</th>
                                        <th>Employees</th>
                                        <th>Status</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        `}
                    </div>
                </div>
                <script>
                    function viewSchedule(id) {
                        window.location.href = '/personnel/thirdparty-schedule/view/' + id;
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading schedules:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Download CSV template
router.get('/template', (req, res) => {
    const headers = 'Company Name,Employee ID,Employee Name,Position,Mon Off,Mon From,Mon To,Tue Off,Tue From,Tue To,Wed Off,Wed From,Wed To,Thu Off,Thu From,Thu To,Fri Off,Fri From,Fri To,Sat Off,Sat From,Sat To,Sun Off,Sun From,Sun To';
    const sampleRow = 'Bright,TP001,John Doe,Cleaner,,08:00,17:00,,08:00,17:00,,08:00,17:00,,08:00,17:00,,08:00,17:00,Yes,,,Yes,,';
    const csvContent = headers + '\n' + sampleRow;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="thirdparty-schedule-template.csv"');
    res.send(csvContent);
});

// New schedule form
router.get('/new', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores for dropdown
        const stores = await pool.request().query('SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        
        await pool.close();
        
        const storeOptions = stores.recordset.map(s => 
            `<option value="${s.Id}" data-name="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>New Thirdparty Schedule - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    .form-row { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
                    .form-group { flex: 1; min-width: 200px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #555; }
                    .form-group input, .form-group select {
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    }
                    .form-group input:focus, .form-group select:focus {
                        outline: none;
                        border-color: #8e44ad;
                    }
                    .btn {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    }
                    .btn-primary { background: #8e44ad; color: white; }
                    .btn-primary:hover { background: #7d3c98; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-success:hover { background: #218838; }
                    .btn-danger { background: #dc3545; color: white; }
                    .btn-danger:hover { background: #c82333; }
                    .btn-secondary { background: #6c757d; color: white; }
                    
                    /* Schedule table styles */
                    .schedule-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .schedule-table th, .schedule-table td { 
                        padding: 8px; 
                        border: 1px solid #ddd; 
                        text-align: center;
                        font-size: 13px;
                    }
                    .schedule-table th { background: #8e44ad; color: white; }
                    .schedule-table th.day-header { font-size: 12px; }
                    .schedule-table input { 
                        width: 100%; 
                        padding: 6px; 
                        border: 1px solid #ddd; 
                        border-radius: 4px; 
                        font-size: 12px;
                        text-align: center;
                    }
                    .schedule-table input[type="time"] { width: 85px; }
                    .schedule-table .employee-info input { text-align: left; }
                    .schedule-table .day-off-cell { background: #f8f9fa; }
                    .schedule-table .day-off-cell input[type="checkbox"] {
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                    }
                    .schedule-table .remove-btn {
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .add-row-btn {
                        margin-top: 15px;
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .add-row-btn:hover { background: #218838; }
                    
                    .actions { margin-top: 25px; display: flex; gap: 15px; }
                    
                    .date-range-section {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    
                    #employeeSection { display: none; }
                    #employeeSection.active { display: block; }
                    
                    .csv-upload-section {
                        background: #f3e5f5;
                        border: 2px dashed #8e44ad;
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 20px;
                        text-align: center;
                    }
                    .csv-upload-section:hover {
                        background: #e8d5eb;
                        border-color: #7d3c98;
                    }
                    .csv-upload-section h4 { margin: 0 0 10px 0; color: #8e44ad; }
                    .csv-upload-section p { color: #666; font-size: 13px; margin-bottom: 15px; }
                    .csv-upload-section input[type="file"] { display: none; }
                    .btn-outline {
                        background: white;
                        border: 2px solid #8e44ad;
                        color: #8e44ad;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        margin: 0 5px;
                    }
                    .btn-outline:hover { background: #8e44ad; color: white; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏢 New Thirdparty Schedule</h1>
                    <div class="header-nav">
                        <a href="/personnel/thirdparty-schedule">← Back to Schedules</a>
                    </div>
                </div>
                <div class="container">
                    <form id="scheduleForm" action="/personnel/thirdparty-schedule/submit" method="POST">
                        <!-- Step 1: Date Range -->
                        <div class="card">
                            <div class="card-title">📅 Schedule Period & Store</div>
                            <div class="date-range-section">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Store *</label>
                                        <select name="storeId" id="storeSelect" required onchange="updateStoreName()">
                                            <option value="">-- Select Store --</option>
                                            ${storeOptions}
                                        </select>
                                        <input type="hidden" name="storeName" id="storeName">
                                    </div>
                                    <div class="form-group">
                                        <label>From Date *</label>
                                        <input type="date" name="fromDate" id="fromDate" required>
                                    </div>
                                    <div class="form-group">
                                        <label>To Date *</label>
                                        <input type="date" name="toDate" id="toDate" required>
                                    </div>
                                    <div class="form-group" style="align-self: flex-end;">
                                        <button type="button" class="btn btn-primary" onclick="startSchedule()">Start Adding Employees →</button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- CSV Import Section -->
                            <div class="csv-upload-section">
                                <h4>📥 Or Import from CSV</h4>
                                <p>Download the template, fill in employee schedules, then upload.</p>
                                <a href="/personnel/thirdparty-schedule/template" class="btn-outline">⬇ Download Template</a>
                                <button type="button" class="btn-outline" onclick="document.getElementById('csvFile').click();">📁 Upload CSV</button>
                                <input type="file" id="csvFile" accept=".csv" onchange="handleCSVUpload(this)">
                                <div id="csvFileName" style="margin-top:10px; color:#28a745; font-weight:600;"></div>
                            </div>
                        </div>
                        
                        <!-- Step 2: Employee List -->
                        <div class="card" id="employeeSection">
                            <div class="card-title">👥 Thirdparty Employees Schedule</div>
                            <p style="color:#666; margin-bottom:15px;">Add thirdparty employees and their weekly schedule below. Check "Off" to mark a day off.</p>
                            
                            <div style="overflow-x: auto;">
                                <table class="schedule-table" id="scheduleTable">
                                    <thead>
                                        <tr>
                                            <th rowspan="2" style="min-width:120px;">Company Name</th>
                                            <th rowspan="2" style="min-width:80px;">Employee ID</th>
                                            <th rowspan="2" style="min-width:120px;">Employee Name</th>
                                            <th rowspan="2" style="min-width:100px;">Position</th>
                                            <th colspan="3" class="day-header">Monday</th>
                                            <th colspan="3" class="day-header">Tuesday</th>
                                            <th colspan="3" class="day-header">Wednesday</th>
                                            <th colspan="3" class="day-header">Thursday</th>
                                            <th colspan="3" class="day-header">Friday</th>
                                            <th colspan="3" class="day-header">Saturday</th>
                                            <th colspan="3" class="day-header">Sunday</th>
                                            <th rowspan="2">Action</th>
                                        </tr>
                                        <tr>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                            <th class="day-header">Off</th><th class="day-header">From</th><th class="day-header">To</th>
                                        </tr>
                                    </thead>
                                    <tbody id="employeeRows">
                                        <!-- Employee rows will be added here -->
                                    </tbody>
                                </table>
                            </div>
                            
                            <button type="button" class="add-row-btn" onclick="addEmployeeRow()">+ Add Employee</button>
                            
                            <div class="actions">
                                <button type="submit" class="btn btn-success">✓ Submit Schedule</button>
                                <a href="/personnel/thirdparty-schedule" class="btn btn-secondary">Cancel</a>
                            </div>
                        </div>
                        
                        <input type="hidden" name="employees" id="employeesData">
                    </form>
                </div>
                
                <script>
                    let rowCounter = 0;
                    
                    function updateStoreName() {
                        const store = document.getElementById('storeSelect');
                        if (store.selectedIndex > 0) {
                            document.getElementById('storeName').value = store.options[store.selectedIndex].dataset.name;
                        }
                    }
                    
                    function startSchedule() {
                        const store = document.getElementById('storeSelect');
                        const fromDate = document.getElementById('fromDate').value;
                        const toDate = document.getElementById('toDate').value;
                        
                        if (!store.value || !fromDate || !toDate) {
                            alert('Please select store and date range');
                            return;
                        }
                        
                        // Set store name
                        updateStoreName();
                        
                        // Show employee section
                        document.getElementById('employeeSection').classList.add('active');
                        
                        // Add first row if empty
                        if (document.getElementById('employeeRows').children.length === 0) {
                            addEmployeeRow();
                        }
                    }
                    
                    function addEmployeeRow(data = {}) {
                        rowCounter++;
                        const tbody = document.getElementById('employeeRows');
                        const row = document.createElement('tr');
                        row.id = 'row_' + rowCounter;
                        
                        row.innerHTML = \`
                            <td class="employee-info"><input type="text" name="company_\${rowCounter}" placeholder="Company" value="\${data.company || ''}"></td>
                            <td class="employee-info"><input type="text" name="empId_\${rowCounter}" placeholder="ID" value="\${data.empId || ''}"></td>
                            <td class="employee-info"><input type="text" name="empName_\${rowCounter}" placeholder="Name" value="\${data.name || ''}"></td>
                            <td class="employee-info"><input type="text" name="position_\${rowCounter}" placeholder="Position" value="\${data.position || ''}"></td>
                            <td class="day-off-cell"><input type="checkbox" name="monOff_\${rowCounter}" \${data.monOff ? 'checked' : ''} onchange="toggleDayOff(this, 'mon', \${rowCounter})"></td>
                            <td><input type="time" name="monFrom_\${rowCounter}" value="\${data.monFrom || ''}" \${data.monOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="monTo_\${rowCounter}" value="\${data.monTo || ''}" \${data.monOff ? 'disabled' : ''}></td>
                            <td class="day-off-cell"><input type="checkbox" name="tueOff_\${rowCounter}" \${data.tueOff ? 'checked' : ''} onchange="toggleDayOff(this, 'tue', \${rowCounter})"></td>
                            <td><input type="time" name="tueFrom_\${rowCounter}" value="\${data.tueFrom || ''}" \${data.tueOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="tueTo_\${rowCounter}" value="\${data.tueTo || ''}" \${data.tueOff ? 'disabled' : ''}></td>
                            <td class="day-off-cell"><input type="checkbox" name="wedOff_\${rowCounter}" \${data.wedOff ? 'checked' : ''} onchange="toggleDayOff(this, 'wed', \${rowCounter})"></td>
                            <td><input type="time" name="wedFrom_\${rowCounter}" value="\${data.wedFrom || ''}" \${data.wedOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="wedTo_\${rowCounter}" value="\${data.wedTo || ''}" \${data.wedOff ? 'disabled' : ''}></td>
                            <td class="day-off-cell"><input type="checkbox" name="thuOff_\${rowCounter}" \${data.thuOff ? 'checked' : ''} onchange="toggleDayOff(this, 'thu', \${rowCounter})"></td>
                            <td><input type="time" name="thuFrom_\${rowCounter}" value="\${data.thuFrom || ''}" \${data.thuOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="thuTo_\${rowCounter}" value="\${data.thuTo || ''}" \${data.thuOff ? 'disabled' : ''}></td>
                            <td class="day-off-cell"><input type="checkbox" name="friOff_\${rowCounter}" \${data.friOff ? 'checked' : ''} onchange="toggleDayOff(this, 'fri', \${rowCounter})"></td>
                            <td><input type="time" name="friFrom_\${rowCounter}" value="\${data.friFrom || ''}" \${data.friOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="friTo_\${rowCounter}" value="\${data.friTo || ''}" \${data.friOff ? 'disabled' : ''}></td>
                            <td class="day-off-cell"><input type="checkbox" name="satOff_\${rowCounter}" \${data.satOff ? 'checked' : ''} onchange="toggleDayOff(this, 'sat', \${rowCounter})"></td>
                            <td><input type="time" name="satFrom_\${rowCounter}" value="\${data.satFrom || ''}" \${data.satOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="satTo_\${rowCounter}" value="\${data.satTo || ''}" \${data.satOff ? 'disabled' : ''}></td>
                            <td class="day-off-cell"><input type="checkbox" name="sunOff_\${rowCounter}" \${data.sunOff ? 'checked' : ''} onchange="toggleDayOff(this, 'sun', \${rowCounter})"></td>
                            <td><input type="time" name="sunFrom_\${rowCounter}" value="\${data.sunFrom || ''}" \${data.sunOff ? 'disabled' : ''}></td>
                            <td><input type="time" name="sunTo_\${rowCounter}" value="\${data.sunTo || ''}" \${data.sunOff ? 'disabled' : ''}></td>
                            <td><button type="button" class="remove-btn" onclick="removeRow(\${rowCounter})">✕</button></td>
                        \`;
                        
                        tbody.appendChild(row);
                    }
                    
                    function toggleDayOff(checkbox, day, rowId) {
                        const fromInput = document.querySelector(\`input[name="\${day}From_\${rowId}"]\`);
                        const toInput = document.querySelector(\`input[name="\${day}To_\${rowId}"]\`);
                        if (checkbox.checked) {
                            fromInput.disabled = true;
                            toInput.disabled = true;
                            fromInput.value = '';
                            toInput.value = '';
                        } else {
                            fromInput.disabled = false;
                            toInput.disabled = false;
                        }
                    }
                    
                    function handleCSVUpload(input) {
                        const file = input.files[0];
                        if (!file) return;
                        
                        document.getElementById('csvFileName').textContent = '✓ ' + file.name;
                        
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const text = e.target.result;
                            const lines = text.split('\\n');
                            
                            // Clear existing rows
                            document.getElementById('employeeRows').innerHTML = '';
                            rowCounter = 0;
                            
                            // Skip header row
                            for (let i = 1; i < lines.length; i++) {
                                const line = lines[i].trim();
                                if (!line) continue;
                                
                                const cols = parseCSVLine(line);
                                if (cols.length >= 4) {
                                    addEmployeeRow({
                                        company: cols[0] || '',
                                        empId: cols[1] || '',
                                        name: cols[2] || '',
                                        position: cols[3] || '',
                                        monOff: (cols[4] || '').toLowerCase() === 'yes',
                                        monFrom: cols[5] || '',
                                        monTo: cols[6] || '',
                                        tueOff: (cols[7] || '').toLowerCase() === 'yes',
                                        tueFrom: cols[8] || '',
                                        tueTo: cols[9] || '',
                                        wedOff: (cols[10] || '').toLowerCase() === 'yes',
                                        wedFrom: cols[11] || '',
                                        wedTo: cols[12] || '',
                                        thuOff: (cols[13] || '').toLowerCase() === 'yes',
                                        thuFrom: cols[14] || '',
                                        thuTo: cols[15] || '',
                                        friOff: (cols[16] || '').toLowerCase() === 'yes',
                                        friFrom: cols[17] || '',
                                        friTo: cols[18] || '',
                                        satOff: (cols[19] || '').toLowerCase() === 'yes',
                                        satFrom: cols[20] || '',
                                        satTo: cols[21] || '',
                                        sunOff: (cols[22] || '').toLowerCase() === 'yes',
                                        sunFrom: cols[23] || '',
                                        sunTo: cols[24] || ''
                                    });
                                }
                            }
                            
                            // Show employee section
                            document.getElementById('employeeSection').style.display = 'block';
                        };
                        reader.readAsText(file);
                    }
                    
                    function parseCSVLine(line) {
                        const result = [];
                        let current = '';
                        let inQuotes = false;
                        
                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                result.push(current.trim());
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        result.push(current.trim());
                        return result;
                    }
                    
                    function removeRow(id) {
                        const row = document.getElementById('row_' + id);
                        if (row) row.remove();
                    }
                    
                    // Form submission
                    document.getElementById('scheduleForm').addEventListener('submit', function(e) {
                        // Ensure store name is set
                        updateStoreName();
                        
                        const rows = document.querySelectorAll('#employeeRows tr');
                        if (rows.length === 0) {
                            e.preventDefault();
                            alert('Please add at least one employee');
                            return;
                        }
                        
                        // Collect employee data
                        const employees = [];
                        rows.forEach(row => {
                            const textInputs = row.querySelectorAll('input[type="text"]');
                            const checkboxes = row.querySelectorAll('input[type="checkbox"]');
                            const timeInputs = row.querySelectorAll('input[type="time"]');
                            
                            const emp = {
                                company: textInputs[0].value,
                                empId: textInputs[1].value,
                                name: textInputs[2].value,
                                position: textInputs[3].value,
                                monOff: checkboxes[0].checked,
                                monFrom: timeInputs[0].value,
                                monTo: timeInputs[1].value,
                                tueOff: checkboxes[1].checked,
                                tueFrom: timeInputs[2].value,
                                tueTo: timeInputs[3].value,
                                wedOff: checkboxes[2].checked,
                                wedFrom: timeInputs[4].value,
                                wedTo: timeInputs[5].value,
                                thuOff: checkboxes[3].checked,
                                thuFrom: timeInputs[6].value,
                                thuTo: timeInputs[7].value,
                                friOff: checkboxes[4].checked,
                                friFrom: timeInputs[8].value,
                                friTo: timeInputs[9].value,
                                satOff: checkboxes[5].checked,
                                satFrom: timeInputs[10].value,
                                satTo: timeInputs[11].value,
                                sunOff: checkboxes[6].checked,
                                sunFrom: timeInputs[12].value,
                                sunTo: timeInputs[13].value
                            };
                            employees.push(emp);
                        });
                        
                        document.getElementById('employeesData').value = JSON.stringify(employees);
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading form:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Submit schedule
router.post('/submit', async (req, res) => {
    try {
        const { storeId, storeName, fromDate, toDate, employees } = req.body;
        const userId = req.currentUser.userId;
        
        const employeeList = JSON.parse(employees || '[]');
        
        if (employeeList.length === 0) {
            return res.status(400).send('Please add at least one employee');
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Insert main schedule
        const scheduleResult = await pool.request()
            .input('fromDate', sql.Date, fromDate)
            .input('toDate', sql.Date, toDate)
            .input('storeId', sql.Int, storeId)
            .input('storeName', sql.NVarChar, storeName)
            .input('createdBy', sql.Int, userId)
            .query(`
                INSERT INTO ThirdpartySchedules (FromDate, ToDate, StoreId, StoreName, Status, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES (@fromDate, @toDate, @storeId, @storeName, 'Submitted', @createdBy)
            `);
        
        const scheduleId = scheduleResult.recordset[0].Id;
        
        // Insert employees
        for (const emp of employeeList) {
            await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .input('companyName', sql.NVarChar, emp.company)
                .input('employeeId', sql.NVarChar, emp.empId)
                .input('employeeName', sql.NVarChar, emp.name)
                .input('employeePosition', sql.NVarChar, emp.position)
                .input('monOff', sql.Bit, emp.monOff ? 1 : 0)
                .input('monFrom', sql.NVarChar, emp.monFrom)
                .input('monTo', sql.NVarChar, emp.monTo)
                .input('tueOff', sql.Bit, emp.tueOff ? 1 : 0)
                .input('tueFrom', sql.NVarChar, emp.tueFrom)
                .input('tueTo', sql.NVarChar, emp.tueTo)
                .input('wedOff', sql.Bit, emp.wedOff ? 1 : 0)
                .input('wedFrom', sql.NVarChar, emp.wedFrom)
                .input('wedTo', sql.NVarChar, emp.wedTo)
                .input('thuOff', sql.Bit, emp.thuOff ? 1 : 0)
                .input('thuFrom', sql.NVarChar, emp.thuFrom)
                .input('thuTo', sql.NVarChar, emp.thuTo)
                .input('friOff', sql.Bit, emp.friOff ? 1 : 0)
                .input('friFrom', sql.NVarChar, emp.friFrom)
                .input('friTo', sql.NVarChar, emp.friTo)
                .input('satOff', sql.Bit, emp.satOff ? 1 : 0)
                .input('satFrom', sql.NVarChar, emp.satFrom)
                .input('satTo', sql.NVarChar, emp.satTo)
                .input('sunOff', sql.Bit, emp.sunOff ? 1 : 0)
                .input('sunFrom', sql.NVarChar, emp.sunFrom)
                .input('sunTo', sql.NVarChar, emp.sunTo)
                .query(`
                    INSERT INTO ThirdpartyScheduleEmployees 
                    (ScheduleId, CompanyName, EmployeeId, EmployeeName, EmployeePosition,
                     MonOff, MonFrom, MonTo, TueOff, TueFrom, TueTo, WedOff, WedFrom, WedTo, 
                     ThuOff, ThuFrom, ThuTo, FriOff, FriFrom, FriTo, SatOff, SatFrom, SatTo, 
                     SunOff, SunFrom, SunTo)
                    VALUES 
                    (@scheduleId, @companyName, @employeeId, @employeeName, @employeePosition,
                     @monOff, @monFrom, @monTo, @tueOff, @tueFrom, @tueTo, @wedOff, @wedFrom, @wedTo,
                     @thuOff, @thuFrom, @thuTo, @friOff, @friFrom, @friTo, @satOff, @satFrom, @satTo,
                     @sunOff, @sunFrom, @sunTo)
                `);
        }
        
        await pool.close();
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'THIRDPARTY_SCHEDULE',
            recordId: scheduleId,
            recordTable: 'ThirdpartySchedules',
            submitter: { userId: req.currentUser.userId, email: req.currentUser.email || req.currentUser.mail, name: req.currentUser.displayName },
            store: { storeId: storeId ? parseInt(storeId) : null, storeName: storeName || null },
            metaData: { fromDate, toDate, storeName },
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Thirdparty schedule error:', err));

        res.redirect('/personnel/thirdparty-schedule/view/' + scheduleId + '?success=1');
    } catch (err) {
        console.error('Error submitting schedule:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// View schedule
router.get('/view/:id', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        // Get schedule details
        const scheduleResult = await pool.request()
            .input('id', sql.Int, scheduleId)
            .query(`
                SELECT s.*, u.DisplayName as CreatedByName
                FROM ThirdpartySchedules s
                LEFT JOIN Users u ON s.CreatedBy = u.Id
                WHERE s.Id = @id
            `);
        
        if (scheduleResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Schedule not found');
        }
        
        const schedule = scheduleResult.recordset[0];
        
        // Get employees
        const employeesResult = await pool.request()
            .input('scheduleId', sql.Int, scheduleId)
            .query(`
                SELECT * FROM ThirdpartyScheduleEmployees
                WHERE ScheduleId = @scheduleId
                ORDER BY Id
            `);
        
        await pool.close();
        
        const fromDate = new Date(schedule.FromDate).toLocaleDateString('en-GB');
        const toDate = new Date(schedule.ToDate).toLocaleDateString('en-GB');
        const createdAt = new Date(schedule.CreatedAt).toLocaleDateString('en-GB');
        
        // Helper function to format day display with 2 cells (From and To)
        const formatDayCells = (from, to, isOff) => {
            if (isOff) return '<td colspan="2" style="color:#dc3545; font-weight:600; text-align:center;">Off</td>';
            return `<td>${from || '-'}</td><td>${to || '-'}</td>`;
        };
        
        const employeeRows = employeesResult.recordset.map((emp, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${emp.CompanyName || '-'}</td>
                <td>${emp.EmployeeId || '-'}</td>
                <td>${emp.EmployeeName || '-'}</td>
                <td>${emp.EmployeePosition || '-'}</td>
                ${formatDayCells(emp.MonFrom, emp.MonTo, emp.MonOff)}
                ${formatDayCells(emp.TueFrom, emp.TueTo, emp.TueOff)}
                ${formatDayCells(emp.WedFrom, emp.WedTo, emp.WedOff)}
                ${formatDayCells(emp.ThuFrom, emp.ThuTo, emp.ThuOff)}
                ${formatDayCells(emp.FriFrom, emp.FriTo, emp.FriOff)}
                ${formatDayCells(emp.SatFrom, emp.SatTo, emp.SatOff)}
                ${formatDayCells(emp.SunFrom, emp.SunTo, emp.SunOff)}
            </tr>
        `).join('');
        
        const successMsg = req.query.success ? `
            <div style="background:#d4edda; color:#155724; padding:15px; border-radius:8px; margin-bottom:20px;">
                ✓ Schedule submitted successfully!
            </div>
        ` : '';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Schedule #${scheduleId} - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
                        color: white;
                        padding: 20px 40px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        margin-left: 15px;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .card {
                        background: white;
                        border-radius: 10px;
                        padding: 25px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                        margin-bottom: 20px;
                    }
                    .card-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }
                    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
                    .info-item label { color: #666; font-size: 13px; display: block; margin-bottom: 5px; }
                    .info-item span { font-weight: 600; color: #333; }
                    .status-badge {
                        display: inline-block;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .status-submitted { background: #e8f5e9; color: #28a745; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; text-align: center; border: 1px solid #ddd; font-size: 13px; }
                    th { background: #8e44ad; color: white; }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .print-btn {
                        padding: 10px 20px;
                        background: #8e44ad;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    @media print {
                        .header, .print-btn { display: none; }
                        .container { padding: 0; }
                        .card { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏢 Thirdparty Schedule #${scheduleId}</h1>
                    <div class="header-nav">
                        <a href="javascript:window.print()">🖨️ Print</a>
                        <a href="/personnel/thirdparty-schedule">← Back to Schedules</a>
                    </div>
                </div>
                <div class="container">
                    ${successMsg}
                    
                    <div class="card">
                        <div class="card-title">📋 Schedule Details</div>
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Store</label>
                                <span>${schedule.StoreName || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Period</label>
                                <span>${fromDate} - ${toDate}</span>
                            </div>
                            <div class="info-item">
                                <label>Status</label>
                                <span class="status-badge status-${schedule.Status.toLowerCase()}">${schedule.Status}</span>
                            </div>
                            <div class="info-item">
                                <label>Created By</label>
                                <span>${schedule.CreatedByName || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Created At</label>
                                <span>${createdAt}</span>
                            </div>
                            <div class="info-item">
                                <label>Employees</label>
                                <span>${employeesResult.recordset.length}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-title">👥 Employee Schedule</div>
                        <div style="overflow-x:auto;">
                            <table>
                                <thead>
                                    <tr>
                                        <th rowspan="2">#</th>
                                        <th rowspan="2">Company</th>
                                        <th rowspan="2">Emp ID</th>
                                        <th rowspan="2">Name</th>
                                        <th rowspan="2">Position</th>
                                        <th colspan="2">Monday</th>
                                        <th colspan="2">Tuesday</th>
                                        <th colspan="2">Wednesday</th>
                                        <th colspan="2">Thursday</th>
                                        <th colspan="2">Friday</th>
                                        <th colspan="2">Saturday</th>
                                        <th colspan="2">Sunday</th>
                                    </tr>
                                    <tr>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                        <th>From</th><th>To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${employeeRows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing schedule:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

module.exports = router;
