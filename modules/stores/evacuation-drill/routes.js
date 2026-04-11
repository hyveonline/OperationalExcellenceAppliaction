/**
 * Post Evacuation Drill Routes
 * Allows store management to submit post evacuation drill reports
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const workflowEngine = require('../../../services/workflow-engine');

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

// Generate drill number
async function generateDrillNumber(pool) {
    const result = await pool.request().query(`
        SELECT COUNT(*) + 1 as nextNum FROM PostEvacuationDrills
    `);
    const num = result.recordset[0].nextNum;
    const year = new Date().getFullYear();
    return `EVD-${year}-${String(num).padStart(5, '0')}`;
}

// Post Evacuation Drill Form Page
router.get('/', async (req, res) => {
    try {
        const user = req.currentUser;
        const pool = await sql.connect(dbConfig);
        
        // Load stores from OHS stores table (shared with OHS module)
        const stores = await pool.request().query(`
            SELECT Id, StoreId, StoreName, StoreCode FROM OHSStores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        // Load shifts
        let shifts = [];
        try {
            const shiftsResult = await pool.request().query(`
                SELECT Id, ShiftName FROM EvacuationDrillShifts WHERE IsActive = 1 ORDER BY DisplayOrder
            `);
            shifts = shiftsResult.recordset;
        } catch (e) {
            // If table doesn't exist, use defaults
            shifts = [
                { Id: 1, ShiftName: 'Morning Shift' },
                { Id: 2, ShiftName: 'Afternoon Shift' },
                { Id: 3, ShiftName: 'Evening Shift' },
                { Id: 4, ShiftName: 'Night Shift' },
                { Id: 5, ShiftName: 'Full Day' }
            ];
        }
        
        await pool.close();
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Post Evacuation Drill - ${process.env.APP_NAME || 'OE App'}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #f5f5f5;
                        min-height: 100vh;
                    }
                    .header {
                        background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        z-index: 100;
                    }
                    .header h1 { font-size: 22px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                        transition: background 0.2s;
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    
                    .container {
                        max-width: 950px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .form-card {
                        background: white;
                        border-radius: 12px;
                        padding: 30px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        margin-bottom: 20px;
                    }
                    
                    .form-title {
                        color: #00b894;
                        margin-bottom: 10px;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .form-desc {
                        color: #666;
                        margin-bottom: 25px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    
                    .section {
                        margin-bottom: 30px;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        border-left: 4px solid #00b894;
                    }
                    
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .form-row {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    
                    .form-group {
                        margin-bottom: 20px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 8px;
                        font-weight: 500;
                        color: #333;
                    }
                    .form-group label .required {
                        color: #e17055;
                    }
                    .form-group input, 
                    .form-group select, 
                    .form-group textarea {
                        width: 100%;
                        padding: 12px 15px;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        font-size: 14px;
                        transition: border-color 0.2s, box-shadow 0.2s;
                    }
                    .form-group input:focus, 
                    .form-group select:focus, 
                    .form-group textarea:focus {
                        outline: none;
                        border-color: #00b894;
                        box-shadow: 0 0 0 3px rgba(0, 184, 148, 0.1);
                    }
                    .form-group input:read-only {
                        background: #f0f0f0;
                    }
                    .form-group textarea {
                        min-height: 100px;
                        resize: vertical;
                    }
                    
                    /* Statistics Card */
                    .stats-row {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .stat-box {
                        background: white;
                        border-radius: 10px;
                        padding: 20px;
                        text-align: center;
                        border: 2px solid #e0e0e0;
                    }
                    .stat-box.highlight {
                        border-color: #00b894;
                        background: linear-gradient(135deg, #f0fff4 0%, #e8f8f5 100%);
                    }
                    .stat-label {
                        font-size: 14px;
                        color: #666;
                        margin-bottom: 10px;
                    }
                    .stat-value {
                        font-size: 32px;
                        font-weight: bold;
                        color: #00b894;
                    }
                    .stat-value.percentage {
                        font-size: 36px;
                    }
                    
                    /* Action Plan Table */
                    .action-plan-section {
                        margin-top: 30px;
                    }
                    .action-plan-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                    }
                    .action-plan-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }
                    .action-plan-table th,
                    .action-plan-table td {
                        padding: 12px;
                        text-align: left;
                        border: 1px solid #ddd;
                    }
                    .action-plan-table th {
                        background: #00b894;
                        color: white;
                        font-weight: 500;
                    }
                    .action-plan-table tbody tr:nth-child(even) {
                        background: #f8f9fa;
                    }
                    .action-plan-table input,
                    .action-plan-table textarea {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 13px;
                    }
                    .action-plan-table textarea {
                        min-height: 60px;
                        resize: vertical;
                    }
                    .btn-remove-row {
                        background: #d63031;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .btn-remove-row:hover {
                        background: #c0392b;
                    }
                    .btn-add-row {
                        background: #00b894;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .btn-add-row:hover {
                        background: #00a085;
                    }
                    
                    .btn {
                        padding: 14px 30px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
                        color: white;
                    }
                    .btn-primary:hover { 
                        transform: translateY(-2px);
                        box-shadow: 0 4px 15px rgba(0, 184, 148, 0.3);
                    }
                    .btn-primary:disabled {
                        background: #ccc;
                        cursor: not-allowed;
                        transform: none;
                    }
                    
                    .form-actions {
                        display: flex;
                        gap: 15px;
                        justify-content: flex-end;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    
                    .alert {
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                    
                    .loading-overlay {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .loading-overlay.active {
                        display: flex;
                    }
                    .loading-spinner {
                        background: white;
                        padding: 30px 50px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .spinner {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #00b894;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @media (max-width: 768px) {
                        .container { padding: 15px; }
                        .form-card { padding: 20px; }
                        .stats-row { grid-template-columns: 1fr; }
                        .form-row { grid-template-columns: 1fr; }
                        .header { flex-direction: column; gap: 10px; padding: 15px; }
                        .header-nav { flex-wrap: wrap; justify-content: center; }
                        .action-plan-table { font-size: 12px; }
                        .action-plan-table th, .action-plan-table td { padding: 8px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚨 Post Evacuation Drill</h1>
                    <div class="header-nav">
                        <a href="/stores/evacuation-drill/history">📋 History</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div id="alertContainer"></div>
                    
                    <form id="evacuationForm">
                        <div class="form-card">
                            <h2 class="form-title">🚨 Post Evacuation Drill Report</h2>
                            <p class="form-desc">Submit post-evacuation drill assessment. All fields marked with <span style="color: #e17055;">*</span> are required.</p>
                            
                            <!-- Section 1: Drill Details -->
                            <div class="section">
                                <h3 class="section-title">📅 Drill Details</h3>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Date of Evacuation <span class="required">*</span></label>
                                        <input type="date" name="drillDate" id="drillDate" required max="${new Date().toISOString().split('T')[0]}" value="${new Date().toISOString().split('T')[0]}">
                                    </div>
                                    <div class="form-group">
                                        <label>Time of Drill</label>
                                        <input type="time" name="drillTime" id="drillTime">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Store <span class="required">*</span></label>
                                        <select name="storeId" id="storeId" required>
                                            <option value="">-- Select Store --</option>
                                            ${stores.recordset.map(s => `
                                                <option value="${s.StoreId}" data-name="${s.StoreName}">${s.StoreName} ${s.StoreCode ? '(' + s.StoreCode + ')' : ''}</option>
                                            `).join('')}
                                        </select>
                                        ${stores.recordset.length === 0 ? '<small style="color: #d63031;">No stores configured. Please contact admin.</small>' : ''}
                                    </div>
                                    <div class="form-group">
                                        <label>Shift <span class="required">*</span></label>
                                        <select name="shift" id="shift" required>
                                            <option value="">-- Select Shift --</option>
                                            ${shifts.map(s => `<option value="${s.ShiftName}">${s.ShiftName}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Name (Person Conducting Drill) <span class="required">*</span></label>
                                    <input type="text" name="conductedBy" id="conductedBy" required value="${user?.displayName || ''}" ${user?.displayName ? 'readonly' : ''}>
                                </div>
                            </div>
                            
                            <!-- Section 2: Drill Statistics -->
                            <div class="section">
                                <h3 class="section-title">📊 Drill Statistics</h3>
                                
                                <div class="stats-row">
                                    <div class="stat-box">
                                        <div class="stat-label">Total Employees in Assembly Area</div>
                                        <input type="number" name="totalEmployeesInAssembly" id="totalEmployeesInAssembly" 
                                            min="0" value="0" required style="text-align: center; font-size: 24px; font-weight: bold; color: #00b894; border: 2px solid #00b894; padding: 15px;"
                                            onchange="calculatePercentage()" oninput="calculatePercentage()">
                                    </div>
                                    <div class="stat-box">
                                        <div class="stat-label">Actual Employees Count (Punched In)</div>
                                        <input type="number" name="actualEmployeesCount" id="actualEmployeesCount" 
                                            min="0" value="0" required style="text-align: center; font-size: 24px; font-weight: bold; color: #0984e3; border: 2px solid #0984e3; padding: 15px;"
                                            onchange="calculatePercentage()" oninput="calculatePercentage()">
                                    </div>
                                    <div class="stat-box highlight">
                                        <div class="stat-label">Drill Percentage</div>
                                        <div class="stat-value percentage" id="drillPercentageDisplay">0%</div>
                                        <input type="hidden" name="drillPercentage" id="drillPercentage" value="0">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Section 3: Action Plan -->
                            <div class="section action-plan-section">
                                <div class="action-plan-header">
                                    <h3 class="section-title" style="margin-bottom: 0;">📋 Action Plan</h3>
                                    <button type="button" class="btn-add-row" onclick="addActionRow()">
                                        ➕ Add Issue
                                    </button>
                                </div>
                                
                                <table class="action-plan-table" id="actionPlanTable">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%;">#</th>
                                            <th style="width: 25%;">Issue</th>
                                            <th style="width: 30%;">Action</th>
                                            <th style="width: 15%;">Responsible</th>
                                            <th style="width: 15%;">Due Date</th>
                                            <th style="width: 10%;">Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody id="actionPlanBody">
                                        <!-- Rows will be added dynamically -->
                                    </tbody>
                                </table>
                                <p style="color: #666; font-size: 13px;">💡 Click "Add Issue" to add action items for any issues identified during the drill.</p>
                            </div>
                            
                            <!-- Section 4: Additional Remarks -->
                            <div class="section">
                                <h3 class="section-title">💬 Additional Remarks</h3>
                                
                                <div class="form-group">
                                    <label>Remarks / Observations</label>
                                    <textarea name="remarks" id="remarks" placeholder="Enter any additional remarks or observations about the evacuation drill..."></textarea>
                                </div>
                            </div>
                            
                            <!-- Form Actions -->
                            <div class="form-actions">
                                <button type="button" class="btn" style="background: #74b9ff; color: white;" onclick="window.location.href='/stores'">Cancel</button>
                                <button type="submit" class="btn btn-primary" id="submitBtn">
                                    📤 Submit Report
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- Loading Overlay -->
                <div class="loading-overlay" id="loadingOverlay">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Submitting report...</p>
                    </div>
                </div>
                
                <script>
                    let actionRowCount = 0;
                    
                    // Calculate drill percentage
                    function calculatePercentage() {
                        const assembly = parseInt(document.getElementById('totalEmployeesInAssembly').value) || 0;
                        const actual = parseInt(document.getElementById('actualEmployeesCount').value) || 0;
                        
                        let percentage = 0;
                        if (actual > 0) {
                            percentage = (assembly / actual) * 100;
                        }
                        
                        document.getElementById('drillPercentage').value = percentage.toFixed(2);
                        document.getElementById('drillPercentageDisplay').textContent = percentage.toFixed(1) + '%';
                        
                        // Color code based on percentage
                        const display = document.getElementById('drillPercentageDisplay');
                        if (percentage >= 90) {
                            display.style.color = '#00b894';
                        } else if (percentage >= 70) {
                            display.style.color = '#fdcb6e';
                        } else {
                            display.style.color = '#d63031';
                        }
                    }
                    
                    // Add action plan row
                    function addActionRow() {
                        actionRowCount++;
                        const tbody = document.getElementById('actionPlanBody');
                        const minDate = new Date().toISOString().split('T')[0];
                        
                        const row = document.createElement('tr');
                        row.id = 'actionRow_' + actionRowCount;
                        row.innerHTML = \`
                            <td style="text-align: center; font-weight: bold;">\${actionRowCount}</td>
                            <td><textarea name="actions[\${actionRowCount}][issue]" placeholder="Describe the issue..." required></textarea></td>
                            <td><textarea name="actions[\${actionRowCount}][action]" placeholder="Action to be taken..." required></textarea></td>
                            <td><input type="text" name="actions[\${actionRowCount}][responsible]" placeholder="Person name" required></td>
                            <td><input type="date" name="actions[\${actionRowCount}][dueDate]" min="\${minDate}" required></td>
                            <td style="text-align: center;"><button type="button" class="btn-remove-row" onclick="removeActionRow(\${actionRowCount})">🗑️</button></td>
                        \`;
                        tbody.appendChild(row);
                        renumberRows();
                    }
                    
                    // Remove action plan row
                    function removeActionRow(id) {
                        const row = document.getElementById('actionRow_' + id);
                        if (row) {
                            row.remove();
                            renumberRows();
                        }
                    }
                    
                    // Renumber rows
                    function renumberRows() {
                        const rows = document.querySelectorAll('#actionPlanBody tr');
                        rows.forEach((row, index) => {
                            row.querySelector('td:first-child').textContent = index + 1;
                        });
                    }
                    
                    // Show alert
                    function showAlert(type, message) {
                        const container = document.getElementById('alertContainer');
                        container.innerHTML = \`<div class="alert alert-\${type}">\${message}</div>\`;
                        container.scrollIntoView({ behavior: 'smooth' });
                    }
                    
                    // Form submission
                    document.getElementById('evacuationForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const submitBtn = document.getElementById('submitBtn');
                        const loadingOverlay = document.getElementById('loadingOverlay');
                        
                        submitBtn.disabled = true;
                        loadingOverlay.classList.add('active');
                        
                        try {
                            // Gather form data
                            const formData = {
                                drillDate: document.getElementById('drillDate').value,
                                drillTime: document.getElementById('drillTime').value,
                                storeId: document.getElementById('storeId').value,
                                storeName: document.getElementById('storeId').selectedOptions[0]?.dataset.name || '',
                                shift: document.getElementById('shift').value,
                                conductedBy: document.getElementById('conductedBy').value,
                                totalEmployeesInAssembly: parseInt(document.getElementById('totalEmployeesInAssembly').value) || 0,
                                actualEmployeesCount: parseInt(document.getElementById('actualEmployeesCount').value) || 0,
                                remarks: document.getElementById('remarks').value,
                                actionPlans: []
                            };
                            
                            // Gather action plan items
                            const actionRows = document.querySelectorAll('#actionPlanBody tr');
                            actionRows.forEach(row => {
                                const issue = row.querySelector('textarea[name*="[issue]"]')?.value;
                                const action = row.querySelector('textarea[name*="[action]"]')?.value;
                                const responsible = row.querySelector('input[name*="[responsible]"]')?.value;
                                const dueDate = row.querySelector('input[name*="[dueDate]"]')?.value;
                                
                                if (issue && action && responsible && dueDate) {
                                    formData.actionPlans.push({ issue, action, responsible, dueDate });
                                }
                            });
                            
                            const response = await fetch('/stores/evacuation-drill/submit', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(formData)
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showAlert('success', \`✅ Report submitted successfully! Reference: \${result.drillNumber}\`);
                                setTimeout(() => {
                                    window.location.href = '/stores/evacuation-drill/history';
                                }, 2000);
                            } else {
                                showAlert('error', '❌ ' + (result.message || 'Failed to submit report'));
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            showAlert('error', '❌ An error occurred while submitting the report');
                        } finally {
                            submitBtn.disabled = false;
                            loadingOverlay.classList.remove('active');
                        }
                    });
                    
                    // Initialize percentage calculation
                    calculatePercentage();
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading evacuation drill form:', error);
        res.status(500).send('Error loading form: ' + error.message);
    }
});

// Submit evacuation drill report
router.post('/submit', async (req, res) => {
    let pool;
    try {
        const user = req.currentUser;
        const data = req.body;
        
        pool = await sql.connect(dbConfig);
        
        // Generate drill number
        const drillNumber = await generateDrillNumber(pool);
        
        // Handle empty time value - convert empty string to null
        const drillTime = data.drillTime && data.drillTime.trim() !== '' ? data.drillTime : null;
        
        // Build the query dynamically based on whether time is provided
        const request = pool.request()
            .input('DrillNumber', sql.NVarChar, drillNumber)
            .input('DrillDate', sql.Date, data.drillDate)
            .input('StoreId', sql.NVarChar, data.storeId)
            .input('StoreName', sql.NVarChar, data.storeName)
            .input('Shift', sql.NVarChar, data.shift)
            .input('TotalEmployeesInAssembly', sql.Int, data.totalEmployeesInAssembly)
            .input('ActualEmployeesCount', sql.Int, data.actualEmployeesCount)
            .input('ConductedBy', sql.NVarChar, data.conductedBy)
            .input('ConductedByEmail', sql.NVarChar, user?.email || null)
            .input('Remarks', sql.NVarChar, data.remarks || null)
            .input('CreatedBy', sql.NVarChar, user?.displayName || 'System')
            .input('CreatedByEmail', sql.NVarChar, user?.email || null);
        
        // Add DrillTime only if it has a value (as string, SQL will convert)
        if (drillTime) {
            request.input('DrillTime', sql.NVarChar(10), drillTime);
        }
        
        // Insert main drill record
        const result = await request.query(`
            INSERT INTO PostEvacuationDrills (
                DrillNumber, DrillDate, DrillTime, StoreId, StoreName, Shift,
                TotalEmployeesInAssembly, ActualEmployeesCount,
                ConductedBy, ConductedByEmail, Remarks, CreatedBy, CreatedByEmail
            )
            OUTPUT INSERTED.Id
            VALUES (
                @DrillNumber, @DrillDate, ${drillTime ? '@DrillTime' : 'NULL'}, @StoreId, @StoreName, @Shift,
                @TotalEmployeesInAssembly, @ActualEmployeesCount,
                @ConductedBy, @ConductedByEmail, @Remarks, @CreatedBy, @CreatedByEmail
            )
        `);
        
        const drillId = result.recordset[0].Id;
        
        // Insert action plans
        if (data.actionPlans && data.actionPlans.length > 0) {
            for (const action of data.actionPlans) {
                await pool.request()
                    .input('DrillId', sql.Int, drillId)
                    .input('IssueDescription', sql.NVarChar, action.issue)
                    .input('ActionRequired', sql.NVarChar, action.action)
                    .input('ResponsiblePerson', sql.NVarChar, action.responsible)
                    .input('DueDate', sql.Date, action.dueDate)
                    .query(`
                        INSERT INTO PostEvacuationActionPlans (
                            DrillId, IssueDescription, ActionRequired, ResponsiblePerson, DueDate
                        )
                        VALUES (
                            @DrillId, @IssueDescription, @ActionRequired, @ResponsiblePerson, @DueDate
                        )
                    `);
            }
        }
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'EVACUATION_DRILL',
            recordId: drillId,
            recordTable: 'PostEvacuationDrills',
            submitter: { userId: null, email: user?.email, name: user?.displayName || 'System' },
            store: { storeId: data.storeId, storeName: data.storeName },
            metaData: { drillNumber, drillDate: data.drillDate, drillTime: data.drillTime, shift: data.shift, conductedBy: data.conductedBy, totalEmployeesInAssembly: data.totalEmployeesInAssembly, actualEmployeesCount: data.actualEmployeesCount, remarks: data.remarks },
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Evacuation drill error:', err));
        
        await pool.close();
        
        res.json({
            success: true,
            message: 'Report submitted successfully',
            drillNumber: drillNumber,
            drillId: drillId
        });
        
    } catch (error) {
        console.error('Error submitting evacuation drill:', error);
        if (pool) await pool.close();
        res.status(500).json({
            success: false,
            message: 'Failed to submit report: ' + error.message
        });
    }
});

// History page
router.get('/history', async (req, res) => {
    try {
        const user = req.currentUser;
        const pool = await sql.connect(dbConfig);
        
        // Get drills - show all for admins, or filter by user
        const drills = await pool.request().query(`
            SELECT TOP 100
                d.*,
                (SELECT COUNT(*) FROM PostEvacuationActionPlans WHERE DrillId = d.Id) as ActionCount,
                (SELECT COUNT(*) FROM PostEvacuationActionPlans WHERE DrillId = d.Id AND Status = 'Completed') as CompletedActions
            FROM PostEvacuationDrills d
            WHERE d.IsActive = 1
            ORDER BY d.CreatedAt DESC
        `);
        
        await pool.close();
        
        const drillsHtml = drills.recordset.map(d => `
            <tr>
                <td><a href="/stores/evacuation-drill/view/${d.Id}" style="color: #00b894; font-weight: 600;">${d.DrillNumber}</a></td>
                <td>${new Date(d.DrillDate).toLocaleDateString('en-GB')}</td>
                <td>${d.StoreName}</td>
                <td>${d.Shift}</td>
                <td>${d.TotalEmployeesInAssembly}</td>
                <td>${d.ActualEmployeesCount}</td>
                <td style="font-weight: bold; color: ${d.DrillPercentage >= 90 ? '#00b894' : d.DrillPercentage >= 70 ? '#fdcb6e' : '#d63031'}">
                    ${d.DrillPercentage?.toFixed(1) || 0}%
                </td>
                <td>${d.ActionCount > 0 ? `${d.CompletedActions}/${d.ActionCount}` : '-'}</td>
                <td>${d.ConductedBy}</td>
                <td><a href="/stores/evacuation-drill/view/${d.Id}" class="btn-view">View</a></td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Evacuation Drill History - ${process.env.APP_NAME || 'OE App'}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 22px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1400px; margin: 0 auto; padding: 30px; }
                    .card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .card-title { color: #00b894; margin-bottom: 20px; font-size: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; color: #333; }
                    tr:hover { background: #f8f9fa; }
                    .btn-view {
                        background: #00b894;
                        color: white;
                        padding: 6px 12px;
                        border-radius: 4px;
                        text-decoration: none;
                        font-size: 13px;
                    }
                    .btn-view:hover { background: #00a085; }
                    .empty-state { text-align: center; padding: 50px; color: #666; }
                    @media (max-width: 1000px) {
                        .container { padding: 15px; overflow-x: auto; }
                        table { min-width: 900px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Evacuation Drill History</h1>
                    <div class="header-nav">
                        <a href="/stores/evacuation-drill">➕ New Report</a>
                        <a href="/stores">← Back to Stores</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <h2 class="card-title">🚨 Post Evacuation Drill Reports</h2>
                        ${drills.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>Reference</th>
                                        <th>Date</th>
                                        <th>Store</th>
                                        <th>Shift</th>
                                        <th>Assembly</th>
                                        <th>Actual</th>
                                        <th>Percentage</th>
                                        <th>Actions</th>
                                        <th>Conducted By</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${drillsHtml}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <p style="font-size: 48px;">📭</p>
                                <p style="margin-top: 15px;">No evacuation drill reports found.</p>
                                <a href="/stores/evacuation-drill" style="display: inline-block; margin-top: 20px; background: #00b894; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Submit First Report</a>
                            </div>
                        `}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading history:', error);
        res.status(500).send('Error loading history: ' + error.message);
    }
});

// View single drill report
router.get('/view/:id', async (req, res) => {
    try {
        const drillId = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        // Get drill details
        const drillResult = await pool.request()
            .input('Id', sql.Int, drillId)
            .query('SELECT * FROM PostEvacuationDrills WHERE Id = @Id');
        
        if (drillResult.recordset.length === 0) {
            return res.status(404).send('Drill report not found');
        }
        
        const drill = drillResult.recordset[0];
        
        // Get action plans
        const actionsResult = await pool.request()
            .input('DrillId', sql.Int, drillId)
            .query('SELECT * FROM PostEvacuationActionPlans WHERE DrillId = @DrillId ORDER BY Id');
        
        const actions = actionsResult.recordset;
        
        await pool.close();
        
        const actionsHtml = actions.map((a, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${a.IssueDescription}</td>
                <td>${a.ActionRequired}</td>
                <td>${a.ResponsiblePerson}</td>
                <td>${new Date(a.DueDate).toLocaleDateString('en-GB')}</td>
                <td>
                    <span style="padding: 4px 10px; border-radius: 12px; font-size: 12px; background: ${a.Status === 'Completed' ? '#d4edda' : a.Status === 'In Progress' ? '#fff3cd' : '#e3f2fd'}; color: ${a.Status === 'Completed' ? '#155724' : a.Status === 'In Progress' ? '#856404' : '#0d47a1'}">
                        ${a.Status}
                    </span>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${drill.DrillNumber} - Evacuation Drill</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; }
                    .header {
                        background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 22px; }
                    .header-nav { display: flex; gap: 15px; }
                    .header-nav a {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.2); }
                    .container { max-width: 1000px; margin: 0 auto; padding: 30px; }
                    .card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
                    .card-title { color: #00b894; margin-bottom: 20px; font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
                    .detail-item label { display: block; color: #666; font-size: 13px; margin-bottom: 5px; }
                    .detail-item .value { font-weight: 600; color: #333; font-size: 16px; }
                    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
                    .stat-box { background: #f8f9fa; border-radius: 10px; padding: 20px; text-align: center; }
                    .stat-box.highlight { background: linear-gradient(135deg, #f0fff4 0%, #e8f8f5 100%); border: 2px solid #00b894; }
                    .stat-label { font-size: 14px; color: #666; margin-bottom: 8px; }
                    .stat-value { font-size: 28px; font-weight: bold; color: #00b894; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 12px; text-align: left; border: 1px solid #eee; }
                    th { background: #00b894; color: white; }
                    tr:nth-child(even) { background: #f8f9fa; }
                    .remarks-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚨 ${drill.DrillNumber}</h1>
                    <div class="header-nav">
                        <a href="/stores/evacuation-drill/history">📋 History</a>
                        <a href="/stores/evacuation-drill">➕ New Report</a>
                        <a href="/stores">← Stores</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <h2 class="card-title">📅 Drill Details</h2>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Reference Number</label>
                                <div class="value">${drill.DrillNumber}</div>
                            </div>
                            <div class="detail-item">
                                <label>Date of Evacuation</label>
                                <div class="value">${new Date(drill.DrillDate).toLocaleDateString('en-GB')}</div>
                            </div>
                            <div class="detail-item">
                                <label>Time</label>
                                <div class="value">${drill.DrillTime || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label>Store</label>
                                <div class="value">${drill.StoreName}</div>
                            </div>
                            <div class="detail-item">
                                <label>Shift</label>
                                <div class="value">${drill.Shift}</div>
                            </div>
                            <div class="detail-item">
                                <label>Conducted By</label>
                                <div class="value">${drill.ConductedBy}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h2 class="card-title">📊 Drill Statistics</h2>
                        <div class="stats-row">
                            <div class="stat-box">
                                <div class="stat-label">Total in Assembly Area</div>
                                <div class="stat-value">${drill.TotalEmployeesInAssembly}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Actual Count (Punched In)</div>
                                <div class="stat-value" style="color: #0984e3;">${drill.ActualEmployeesCount}</div>
                            </div>
                            <div class="stat-box highlight">
                                <div class="stat-label">Drill Percentage</div>
                                <div class="stat-value" style="color: ${drill.DrillPercentage >= 90 ? '#00b894' : drill.DrillPercentage >= 70 ? '#fdcb6e' : '#d63031'}">
                                    ${drill.DrillPercentage?.toFixed(1) || 0}%
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${actions.length > 0 ? `
                    <div class="card">
                        <h2 class="card-title">📋 Action Plan (${actions.length} items)</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Issue</th>
                                    <th>Action</th>
                                    <th>Responsible</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${actionsHtml}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                    
                    ${drill.Remarks ? `
                    <div class="card">
                        <h2 class="card-title">💬 Remarks</h2>
                        <div class="remarks-box">${drill.Remarks}</div>
                    </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error viewing drill:', error);
        res.status(500).send('Error loading report: ' + error.message);
    }
});

module.exports = router;
