/**
 * Internal Investigations Module for Security Department
 * Excel-like editable table interface
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

// Main Excel-like page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all investigations with store names
        const investigations = await pool.request().query(`
            SELECT ii.*, 
                   s.StoreName,
                   u.DisplayName as CreatedByName
            FROM InternalInvestigations ii
            LEFT JOIN Stores s ON ii.StoreId = s.Id
            LEFT JOIN Users u ON ii.CreatedBy = u.Id
            ORDER BY ii.Id DESC
        `);
        
        // Get stores for dropdown
        const stores = await pool.request().query(`
            SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        // Get Security Team users (Program Lead, Security Compliance Inspector, Regional Security Manager)
        const securityInspectors = await pool.request().query(`
            SELECT DISTINCT u.Id, u.DisplayName
            FROM Users u
            INNER JOIN UserRoleAssignments ura ON u.Id = ura.UserId
            INNER JOIN UserRoles ur ON ura.RoleId = ur.Id
            WHERE ur.RoleName IN ('Program Lead', 'Security Compliance Inspector', 'Regional Security Manager')
            AND u.IsActive = 1
            ORDER BY u.DisplayName
        `);
        
        // Get stats
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as Total,
                SUM(CASE WHEN Status = 'New' THEN 1 ELSE 0 END) as NewCount,
                SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) as InProgressCount,
                SUM(CASE WHEN Status = 'Closed' THEN 1 ELSE 0 END) as ClosedCount,
                SUM(CASE WHEN Currency = 'USD' THEN ISNULL(AmountStolen, 0) ELSE 0 END) as TotalStolenUSD,
                SUM(CASE WHEN Currency = 'LBP' THEN ISNULL(AmountStolen, 0) ELSE 0 END) as TotalStolenLBP,
                SUM(CASE WHEN Currency = 'USD' THEN ISNULL(AmountCollected, 0) ELSE 0 END) as TotalCollectedUSD,
                SUM(CASE WHEN Currency = 'LBP' THEN ISNULL(AmountCollected, 0) ELSE 0 END) as TotalCollectedLBP
            FROM InternalInvestigations
        `);
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        
        // Build data as JSON for JavaScript
        const investigationsJson = JSON.stringify(investigations.recordset.map(inv => ({
            id: inv.Id,
            securityTeamReps: inv.SecurityTeamReps ? JSON.parse(inv.SecurityTeamReps) : [],
            hrReps: inv.HRReps || '',
            storeId: inv.StoreId,
            storeName: inv.StoreName || '',
            caseTopic: inv.CaseTopic || '',
            employeeNames: inv.EmployeeNames || '',
            currency: inv.Currency || 'LBP',
            amountStolen: inv.AmountStolen || '',
            amountCollected: inv.AmountCollected || '',
            actionTaken: inv.ActionTaken || '',
            status: inv.Status || 'New',
            createdBy: inv.CreatedByName || ''
        })));
        
        const storesJson = JSON.stringify(stores.recordset);
        const inspectorsJson = JSON.stringify(securityInspectors.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Internal Investigations - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f0f0f0; }
                    
                    .header {
                        background: linear-gradient(135deg, #343a40 0%, #495057 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { margin: 0; font-size: 22px; }
                    .header-nav { display: flex; gap: 10px; align-items: center; }
                    .header-nav a, .header-nav button {
                        color: white;
                        text-decoration: none;
                        padding: 8px 16px;
                        border-radius: 5px;
                        background: rgba(255,255,255,0.1);
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .header-nav a:hover, .header-nav button:hover { background: rgba(255,255,255,0.2); }
                    .btn-success { background: #28a745 !important; }
                    
                    .stats-bar {
                        background: white;
                        padding: 15px 30px;
                        display: flex;
                        gap: 30px;
                        border-bottom: 1px solid #ddd;
                        flex-wrap: wrap;
                    }
                    .stat-item { text-align: center; }
                    .stat-item .number { font-size: 24px; font-weight: bold; }
                    .stat-item .label { font-size: 12px; color: #666; }
                    .stat-new .number { color: #17a2b8; }
                    .stat-progress .number { color: #ffc107; }
                    .stat-closed .number { color: #28a745; }
                    .stat-stolen .number { color: #dc3545; }
                    .stat-collected .number { color: #28a745; }
                    
                    .table-container {
                        padding: 20px;
                        overflow-x: auto;
                    }
                    
                    .excel-table {
                        width: 100%;
                        border-collapse: collapse;
                        background: white;
                        font-size: 13px;
                        min-width: 1800px;
                    }
                    .excel-table th {
                        background: #343a40;
                        color: white;
                        padding: 12px 8px;
                        text-align: left;
                        font-weight: 600;
                        white-space: nowrap;
                    }
                    .excel-table td {
                        padding: 4px;
                        border: 1px solid #ddd;
                        vertical-align: top;
                    }
                    .excel-table tr:nth-child(even) { background: #f9f9f9; }
                    .excel-table tr:hover { background: #e8f4fc; }
                    .excel-table tr.dirty { background: #fff3cd !important; }
                    .excel-table tr.new-row { background: #d4edda !important; }
                    
                    .excel-table input, .excel-table select, .excel-table textarea {
                        width: 100%;
                        padding: 6px;
                        border: 1px solid transparent;
                        background: transparent;
                        font-size: 13px;
                        font-family: inherit;
                    }
                    .excel-table input:focus, .excel-table select:focus, .excel-table textarea:focus {
                        border-color: #007bff;
                        background: white;
                        outline: none;
                    }
                    .excel-table textarea {
                        min-height: 60px;
                        resize: vertical;
                    }
                    
                    .row-number {
                        text-align: center;
                        background: #e9ecef;
                        font-weight: bold;
                        color: #666;
                        min-width: 40px;
                    }
                    
                    .action-btns {
                        display: flex;
                        gap: 5px;
                        justify-content: center;
                    }
                    .action-btns button {
                        padding: 4px 8px;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .btn-save { background: #28a745; color: white; }
                    .btn-delete { background: #dc3545; color: white; }
                    
                    .save-indicator {
                        position: fixed;
                        top: 80px;
                        right: 20px;
                        padding: 12px 20px;
                        border-radius: 8px;
                        font-weight: bold;
                        z-index: 1000;
                        display: none;
                    }
                    .save-indicator.success { background: #d4edda; color: #155724; display: block; }
                    .save-indicator.error { background: #f8d7da; color: #721c24; display: block; }
                    
                    /* Multi-select dropdown */
                    .multi-select-container {
                        position: relative;
                        min-width: 200px;
                    }
                    .multi-select-display {
                        padding: 6px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        min-height: 32px;
                        cursor: pointer;
                        background: white;
                        font-size: 12px;
                    }
                    .multi-select-dropdown {
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        max-height: 200px;
                        overflow-y: auto;
                        z-index: 1000;
                        display: none;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    }
                    .multi-select-dropdown.open { display: block; }
                    .multi-select-option {
                        padding: 8px 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .multi-select-option:hover { background: #f0f0f0; }
                    .multi-select-option input { margin: 0; }
                    
                    .currency-cell {
                        min-width: 80px;
                    }
                    .amount-cell {
                        min-width: 120px;
                    }
                    .amount-cell input {
                        text-align: right;
                    }
                    
                    @media (max-width: 768px) {
                        .header { flex-direction: column; gap: 10px; }
                        .stats-bar { justify-content: center; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔍 Internal Investigations</h1>
                    <div class="header-nav">
                        <button onclick="addNewRow()" class="btn-success">➕ Add Row</button>
                        <button onclick="saveAllDirty()">💾 Save All</button>
                        <a href="/dashboard">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="stats-bar">
                    <div class="stat-item">
                        <div class="number">${statsData.Total || 0}</div>
                        <div class="label">Total Cases</div>
                    </div>
                    <div class="stat-item stat-new">
                        <div class="number">${statsData.NewCount || 0}</div>
                        <div class="label">New</div>
                    </div>
                    <div class="stat-item stat-progress">
                        <div class="number">${statsData.InProgressCount || 0}</div>
                        <div class="label">In Progress</div>
                    </div>
                    <div class="stat-item stat-closed">
                        <div class="number">${statsData.ClosedCount || 0}</div>
                        <div class="label">Closed</div>
                    </div>
                    <div class="stat-item stat-stolen">
                        <div class="number">$${(statsData.TotalStolenUSD || 0).toLocaleString()}</div>
                        <div class="label">Stolen (USD)</div>
                    </div>
                    <div class="stat-item stat-stolen">
                        <div class="number">LBP ${(statsData.TotalStolenLBP || 0).toLocaleString()}</div>
                        <div class="label">Stolen (LBP)</div>
                    </div>
                    <div class="stat-item stat-collected">
                        <div class="number">$${(statsData.TotalCollectedUSD || 0).toLocaleString()}</div>
                        <div class="label">Collected (USD)</div>
                    </div>
                    <div class="stat-item stat-collected">
                        <div class="number">LBP ${(statsData.TotalCollectedLBP || 0).toLocaleString()}</div>
                        <div class="label">Collected (LBP)</div>
                    </div>
                </div>
                
                <div id="saveIndicator" class="save-indicator"></div>
                
                <div class="table-container">
                    <table class="excel-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Security Team Rep/s</th>
                                <th>HR Representative/s</th>
                                <th>Location</th>
                                <th>Case Topic</th>
                                <th>Employees' Names</th>
                                <th>Currency</th>
                                <th>Amount Stolen</th>
                                <th>Amount Collected</th>
                                <th>Action Taken</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="investigationsBody">
                        </tbody>
                    </table>
                </div>
                
                <script>
                    const investigations = ${investigationsJson};
                    const stores = ${storesJson};
                    const inspectors = ${inspectorsJson};
                    
                    function renderTable() {
                        const tbody = document.getElementById('investigationsBody');
                        tbody.innerHTML = '';
                        
                        investigations.forEach((inv, idx) => {
                            const row = document.createElement('tr');
                            row.dataset.id = inv.id || 'new_' + idx;
                            row.dataset.idx = idx;
                            if (!inv.id) row.classList.add('new-row');
                            
                            // Store options
                            const storeOptions = '<option value="">Select Store</option>' + 
                                stores.map(s => '<option value="' + s.Id + '"' + (inv.storeId == s.Id ? ' selected' : '') + '>' + s.StoreName + '</option>').join('');
                            
                            // Get selected inspector names
                            const selectedInspectorNames = (inv.securityTeamReps || []).map(id => {
                                const insp = inspectors.find(i => i.Id == id);
                                return insp ? insp.DisplayName : '';
                            }).filter(n => n).join(', ');
                            
                            row.innerHTML = \`
                                <td class="row-number">\${inv.id || 'NEW'}</td>
                                <td>
                                    <div class="multi-select-container" data-field="securityTeamReps">
                                        <div class="multi-select-display" onclick="toggleMultiSelect(this)">\${selectedInspectorNames || 'Select...'}</div>
                                        <div class="multi-select-dropdown">
                                            \${inspectors.map(insp => \`
                                                <label class="multi-select-option">
                                                    <input type="checkbox" value="\${insp.Id}" \${(inv.securityTeamReps || []).includes(insp.Id) ? 'checked' : ''} onchange="updateMultiSelect(this)">
                                                    \${insp.DisplayName}
                                                </label>
                                            \`).join('')}
                                        </div>
                                    </div>
                                </td>
                                <td><input type="text" value="\${escapeHtml(inv.hrReps || '')}" data-field="hrReps" onchange="markDirty(this)" placeholder="HR Rep names..."></td>
                                <td><select data-field="storeId" onchange="markDirty(this)">\${storeOptions}</select></td>
                                <td><input type="text" value="\${escapeHtml(inv.caseTopic || '')}" data-field="caseTopic" onchange="markDirty(this)" placeholder="Case topic..."></td>
                                <td><textarea data-field="employeeNames" onchange="markDirty(this)" placeholder="Employee names...">\${escapeHtml(inv.employeeNames || '')}</textarea></td>
                                <td class="currency-cell">
                                    <select data-field="currency" onchange="markDirty(this); updateCurrencyLabel(this)">
                                        <option value="LBP" \${inv.currency === 'LBP' ? 'selected' : ''}>LBP</option>
                                        <option value="USD" \${inv.currency === 'USD' ? 'selected' : ''}>USD</option>
                                    </select>
                                </td>
                                <td class="amount-cell"><input type="number" step="0.01" value="\${inv.amountStolen || ''}" data-field="amountStolen" onchange="markDirty(this)" placeholder="0.00"></td>
                                <td class="amount-cell"><input type="number" step="0.01" value="\${inv.amountCollected || ''}" data-field="amountCollected" onchange="markDirty(this)" placeholder="0.00"></td>
                                <td><textarea data-field="actionTaken" onchange="markDirty(this)" placeholder="Action taken...">\${escapeHtml(inv.actionTaken || '')}</textarea></td>
                                <td>
                                    <select data-field="status" onchange="markDirty(this)">
                                        <option value="New" \${inv.status === 'New' ? 'selected' : ''}>New</option>
                                        <option value="In Progress" \${inv.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="Closed" \${inv.status === 'Closed' ? 'selected' : ''}>Closed</option>
                                    </select>
                                </td>
                                <td>
                                    <div class="action-btns">
                                        <button class="btn-save" onclick="saveRow(this)" title="Save">💾</button>
                                        <button class="btn-delete" onclick="deleteRow(this)" title="Delete">🗑️</button>
                                    </div>
                                </td>
                            \`;
                            
                            tbody.appendChild(row);
                        });
                    }
                    
                    function escapeHtml(text) {
                        const div = document.createElement('div');
                        div.textContent = text;
                        return div.innerHTML;
                    }
                    
                    function toggleMultiSelect(display) {
                        const dropdown = display.nextElementSibling;
                        // Close all other dropdowns
                        document.querySelectorAll('.multi-select-dropdown.open').forEach(d => {
                            if (d !== dropdown) d.classList.remove('open');
                        });
                        dropdown.classList.toggle('open');
                    }
                    
                    function updateMultiSelect(checkbox) {
                        const container = checkbox.closest('.multi-select-container');
                        const display = container.querySelector('.multi-select-display');
                        const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
                        const names = Array.from(checkboxes).map(cb => cb.parentElement.textContent.trim());
                        display.textContent = names.length > 0 ? names.join(', ') : 'Select...';
                        markDirty(checkbox);
                    }
                    
                    // Close dropdowns when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!e.target.closest('.multi-select-container')) {
                            document.querySelectorAll('.multi-select-dropdown.open').forEach(d => d.classList.remove('open'));
                        }
                    });
                    
                    function markDirty(el) {
                        const row = el.closest('tr');
                        row.classList.add('dirty');
                    }
                    
                    function addNewRow() {
                        investigations.unshift({
                            id: null,
                            securityTeamReps: [],
                            hrReps: '',
                            storeId: null,
                            caseTopic: '',
                            employeeNames: '',
                            currency: 'LBP',
                            amountStolen: '',
                            amountCollected: '',
                            actionTaken: '',
                            status: 'New'
                        });
                        renderTable();
                    }
                    
                    function showSaveIndicator(message, isSuccess) {
                        const indicator = document.getElementById('saveIndicator');
                        indicator.textContent = message;
                        indicator.className = 'save-indicator ' + (isSuccess ? 'success' : 'error');
                        setTimeout(() => { indicator.className = 'save-indicator'; }, 3000);
                    }
                    
                    function getRowData(row) {
                        const data = { id: row.dataset.id.startsWith('new_') ? null : parseInt(row.dataset.id) };
                        
                        // Get multi-select values for security team reps
                        const multiSelectContainer = row.querySelector('[data-field="securityTeamReps"]');
                        const checkboxes = multiSelectContainer.querySelectorAll('input[type="checkbox"]:checked');
                        data.securityTeamReps = Array.from(checkboxes).map(cb => parseInt(cb.value));
                        
                        // Get other fields
                        row.querySelectorAll('input[data-field], select[data-field], textarea[data-field]').forEach(el => {
                            data[el.dataset.field] = el.value;
                        });
                        
                        return data;
                    }
                    
                    async function saveRow(btn) {
                        const row = btn.closest('tr');
                        const data = getRowData(row);
                        
                        if (!data.caseTopic) {
                            alert('Please enter a case topic');
                            return;
                        }
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/internal-investigations/api/save', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showSaveIndicator('✅ Saved!', true);
                                row.classList.remove('dirty', 'new-row');
                                if (!data.id) {
                                    row.dataset.id = result.id;
                                    row.querySelector('.row-number').textContent = result.id;
                                    const idx = parseInt(row.dataset.idx);
                                    if (investigations[idx]) investigations[idx].id = result.id;
                                }
                                btn.textContent = '💾';
                            } else {
                                showSaveIndicator('❌ Error: ' + result.error, false);
                                btn.textContent = '💾';
                            }
                        } catch (err) {
                            showSaveIndicator('❌ Error: ' + err.message, false);
                            btn.textContent = '💾';
                        }
                        
                        btn.disabled = false;
                    }
                    
                    async function saveAllDirty() {
                        const dirtyRows = document.querySelectorAll('#investigationsBody tr.dirty, #investigationsBody tr.new-row');
                        if (dirtyRows.length === 0) {
                            showSaveIndicator('ℹ️ No changes to save', true);
                            return;
                        }
                        
                        for (const row of dirtyRows) {
                            const saveBtn = row.querySelector('.btn-save');
                            await saveRow(saveBtn);
                        }
                    }
                    
                    async function deleteRow(btn) {
                        const row = btn.closest('tr');
                        const id = row.dataset.id;
                        
                        if (id.startsWith('new_')) {
                            const idx = parseInt(row.dataset.idx);
                            investigations.splice(idx, 1);
                            renderTable();
                            return;
                        }
                        
                        if (!confirm('Are you sure you want to delete this investigation? This action cannot be undone.')) return;
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/internal-investigations/api/delete/' + id, {
                                method: 'DELETE'
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showSaveIndicator('🗑️ Deleted!', true);
                                row.remove();
                                setTimeout(() => location.reload(), 500);
                            } else {
                                showSaveIndicator('❌ Error: ' + result.error, false);
                                btn.textContent = '🗑️';
                            }
                        } catch (err) {
                            showSaveIndicator('❌ Error: ' + err.message, false);
                            btn.textContent = '🗑️';
                        }
                        
                        btn.disabled = false;
                    }
                    
                    function updateCurrencyLabel(select) {
                        // Optional: could update labels or placeholders based on currency
                    }
                    
                    // Initialize table
                    renderTable();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading internal investigations:', err);
        res.status(500).send('Error loading internal investigations: ' + err.message);
    }
});

// API: Save investigation
router.post('/api/save', async (req, res) => {
    try {
        const { id, securityTeamReps, hrReps, storeId, caseTopic, employeeNames, currency, amountStolen, amountCollected, actionTaken, status } = req.body;
        const userId = req.currentUser ? req.currentUser.userId : null;
        
        const pool = await sql.connect(dbConfig);
        
        let investigationId = id;
        const securityTeamRepsJson = JSON.stringify(securityTeamReps || []);
        
        if (id) {
            // Update existing
            await pool.request()
                .input('id', sql.Int, id)
                .input('securityTeamReps', sql.NVarChar(sql.MAX), securityTeamRepsJson)
                .input('hrReps', sql.NVarChar(500), hrReps || null)
                .input('storeId', sql.Int, storeId || null)
                .input('caseTopic', sql.NVarChar(500), caseTopic || null)
                .input('employeeNames', sql.NVarChar(sql.MAX), employeeNames || null)
                .input('currency', sql.NVarChar(10), currency || 'LBP')
                .input('amountStolen', sql.Decimal(18, 2), amountStolen || null)
                .input('amountCollected', sql.Decimal(18, 2), amountCollected || null)
                .input('actionTaken', sql.NVarChar(sql.MAX), actionTaken || null)
                .input('status', sql.NVarChar(50), status || 'New')
                .query(`
                    UPDATE InternalInvestigations SET 
                        SecurityTeamReps = @securityTeamReps,
                        HRReps = @hrReps,
                        StoreId = @storeId,
                        CaseTopic = @caseTopic,
                        EmployeeNames = @employeeNames,
                        Currency = @currency,
                        AmountStolen = @amountStolen,
                        AmountCollected = @amountCollected,
                        ActionTaken = @actionTaken,
                        Status = @status,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            // Insert new
            const result = await pool.request()
                .input('securityTeamReps', sql.NVarChar(sql.MAX), securityTeamRepsJson)
                .input('hrReps', sql.NVarChar(500), hrReps || null)
                .input('storeId', sql.Int, storeId || null)
                .input('caseTopic', sql.NVarChar(500), caseTopic || null)
                .input('employeeNames', sql.NVarChar(sql.MAX), employeeNames || null)
                .input('currency', sql.NVarChar(10), currency || 'LBP')
                .input('amountStolen', sql.Decimal(18, 2), amountStolen || null)
                .input('amountCollected', sql.Decimal(18, 2), amountCollected || null)
                .input('actionTaken', sql.NVarChar(sql.MAX), actionTaken || null)
                .input('status', sql.NVarChar(50), status || 'New')
                .input('createdBy', sql.Int, userId)
                .query(`
                    INSERT INTO InternalInvestigations (SecurityTeamReps, HRReps, StoreId, CaseTopic, EmployeeNames, Currency, AmountStolen, AmountCollected, ActionTaken, Status, CreatedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@securityTeamReps, @hrReps, @storeId, @caseTopic, @employeeNames, @currency, @amountStolen, @amountCollected, @actionTaken, @status, @createdBy)
                `);
            investigationId = result.recordset[0].Id;
            
            // Trigger workflow engine for new investigations (non-blocking)
            workflowEngine.start({
                formCode: 'INTERNAL_INVESTIGATIONS',
                recordId: investigationId,
                recordTable: 'InternalInvestigations',
                submitter: { userId, email: req.currentUser?.email || req.currentUser?.mail, name: req.currentUser?.displayName },
                store: { storeId: storeId ? parseInt(storeId) : null, storeName: null },
                metaData: { caseTopic },
                accessToken: req.currentUser?.accessToken
            }).catch(err => console.error('[WORKFLOW] Internal investigation error:', err));
        }
        
        await pool.close();
        
        res.json({ success: true, id: investigationId });
    } catch (err) {
        console.error('Error saving investigation:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Delete investigation
router.delete('/api/delete/:id', async (req, res) => {
    try {
        const investigationId = parseInt(req.params.id);
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, investigationId)
            .query('DELETE FROM InternalInvestigations WHERE Id = @id');
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting investigation:', err);
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;
