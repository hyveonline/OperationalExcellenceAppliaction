/**
 * Security Daily Reporting Module
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

// Company options (same as blacklist)
const COMPANIES = ['Assiyana', 'Bright', 'C-Plus', 'Tandeef', 'Protectron', 'I-Secure', 'Middle East', 'Forearms', 'Valet Peak', 'VPS', 'Uptown'];

// Main Excel-like page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all reports with store names
        const records = await pool.request().query(`
            SELECT r.*, 
                   s.StoreName,
                   u.DisplayName as SubmittedByName
            FROM SecurityDailyReporting r
            LEFT JOIN Stores s ON r.StoreId = s.Id
            LEFT JOIN Users u ON r.SubmittedBy = u.Id
            ORDER BY r.ReportDate DESC, r.Id DESC
        `);
        
        // Get stores for dropdown
        const stores = await pool.request().query(`
            SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        // Get stats
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as Total,
                COUNT(DISTINCT ReportDate) as DaysReported,
                COUNT(DISTINCT Company) as CompanyCount,
                COUNT(DISTINCT StoreId) as StoreCount
            FROM SecurityDailyReporting
        `);
        
        // Get today's count
        const todayStats = await pool.request().query(`
            SELECT COUNT(*) as TodayCount
            FROM SecurityDailyReporting
            WHERE ReportDate = CAST(GETDATE() AS DATE)
        `);
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        const todayCount = todayStats.recordset[0].TodayCount;
        
        // Build record data as JSON for JavaScript
        const recordsJson = JSON.stringify(records.recordset.map(r => ({
            id: r.Id,
            reportDate: r.ReportDate ? new Date(r.ReportDate).toISOString().split('T')[0] : '',
            company: r.Company || '',
            storeId: r.StoreId || '',
            storeName: r.StoreName || '',
            guardName: r.GuardName || '',
            dailyNotes: r.DailyNotes || '',
            submittedBy: r.SubmittedByName || ''
        })));
        
        const storesJson = JSON.stringify(stores.recordset);
        const companiesJson = JSON.stringify(COMPANIES);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Daily Reporting - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f0f0f0; }
                    
                    .header {
                        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: sticky;
                        top: 0;
                        z-index: 100;
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
                    
                    .stats-bar {
                        background: white;
                        padding: 15px 30px;
                        display: flex;
                        gap: 30px;
                        border-bottom: 1px solid #ddd;
                        flex-wrap: wrap;
                    }
                    .stat-item { text-align: center; }
                    .stat-item .number { font-size: 24px; font-weight: bold; color: #2c3e50; }
                    .stat-item .label { font-size: 12px; color: #666; }
                    .stat-today .number { color: #27ae60; }
                    
                    .table-container {
                        padding: 20px;
                        overflow-x: auto;
                    }
                    
                    .excel-table {
                        width: 100%;
                        border-collapse: collapse;
                        background: white;
                        font-size: 13px;
                        table-layout: fixed;
                        min-width: 1200px;
                    }
                    .excel-table th {
                        background: #2c3e50;
                        color: white;
                        padding: 10px 8px;
                        text-align: left;
                        font-weight: 600;
                        white-space: nowrap;
                        border: 1px solid #1a252f;
                    }
                    .excel-table td {
                        border: 1px solid #ddd;
                        padding: 0;
                        vertical-align: middle;
                        overflow: hidden;
                    }
                    .excel-table tr:hover td { background: #f8f9fa; }
                    .excel-table tr.new-row td { background: #e8f5e9; }
                    .excel-table tr.dirty td { background: #fff3cd; }
                    
                    .excel-table input, .excel-table select, .excel-table textarea {
                        width: 100%;
                        border: none;
                        padding: 8px;
                        font-size: 13px;
                        background: transparent;
                        font-family: inherit;
                        box-sizing: border-box;
                    }
                    .excel-table input:focus, .excel-table select:focus, .excel-table textarea:focus {
                        outline: 2px solid #0078d4;
                        background: white;
                    }
                    .excel-table textarea {
                        min-height: 60px;
                        max-height: 100px;
                        resize: none;
                        display: block;
                    }
                    .excel-table select {
                        cursor: pointer;
                    }
                    
                    .cell-actions {
                        text-align: center;
                        padding: 4px !important;
                        white-space: nowrap;
                    }
                    .cell-actions button {
                        padding: 4px 8px;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 12px;
                        margin: 2px;
                    }
                    .btn-save { background: #28a745; color: white; }
                    .btn-delete { background: #dc3545; color: white; }
                    
                    .row-number {
                        width: 50px;
                        text-align: center;
                        background: #e9ecef !important;
                        color: #666;
                        font-weight: 600;
                        padding: 8px !important;
                    }
                    
                    .toolbar {
                        padding: 10px 20px;
                        background: white;
                        border-bottom: 1px solid #ddd;
                        display: flex;
                        gap: 15px;
                        align-items: center;
                    }
                    .toolbar-btn {
                        padding: 8px 16px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        background: white;
                        cursor: pointer;
                        font-size: 13px;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .toolbar-btn:hover { background: #f5f5f5; }
                    .toolbar-btn.primary { background: #2c3e50; color: white; border-color: #2c3e50; }
                    
                    .help-text {
                        color: #666;
                        font-size: 12px;
                        margin-left: auto;
                    }
                    
                    .save-indicator {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        padding: 10px 20px;
                        border-radius: 5px;
                        font-weight: 600;
                        display: none;
                        z-index: 1000;
                    }
                    .save-success { background: #d4edda; color: #155724; }
                    .save-error { background: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Security Daily Reporting</h1>
                    <div class="header-nav">
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="stats-bar">
                    <div class="stat-item stat-today">
                        <div class="number">${todayCount}</div>
                        <div class="label">Today's Reports</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${statsData.Total || 0}</div>
                        <div class="label">Total Reports</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${statsData.DaysReported || 0}</div>
                        <div class="label">Days Reported</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${statsData.CompanyCount || 0}</div>
                        <div class="label">Companies</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${statsData.StoreCount || 0}</div>
                        <div class="label">Stores</div>
                    </div>
                </div>
                
                <div class="toolbar">
                    <button class="toolbar-btn primary" onclick="addNewRow()">➕ Add New Report</button>
                    <button class="toolbar-btn" onclick="saveAllDirty()">💾 Save All Changes</button>
                    <span class="help-text">💡 Click any cell to edit • Yellow rows = unsaved changes • Ctrl+S to save all</span>
                </div>
                
                <div class="table-container">
                    <table class="excel-table" id="reportingTable">
                        <thead>
                            <tr>
                                <th style="width:50px;">#</th>
                                <th style="width:120px;">Date</th>
                                <th style="width:140px;">Company</th>
                                <th style="width:180px;">Store</th>
                                <th style="width:180px;">On-Site Reporting Guard</th>
                                <th style="width:350px;">Daily Notes</th>
                                <th style="width:150px;">Submitted By</th>
                                <th style="width:90px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="reportingBody">
                            <!-- Rows will be generated by JavaScript -->
                        </tbody>
                    </table>
                </div>
                
                <div class="save-indicator" id="saveIndicator"></div>
                
                <script>
                    const records = ${recordsJson};
                    const stores = ${storesJson};
                    const companies = ${companiesJson};
                    const currentUser = '${req.currentUser.displayName || req.currentUser.email || 'Unknown'}';
                    
                    // Build store options HTML
                    const storeOptionsHtml = '<option value="">-- Select Store --</option>' + 
                        stores.map(s => '<option value="' + s.Id + '">' + s.StoreName + '</option>').join('');
                    
                    // Build company options HTML
                    const companyOptionsHtml = '<option value="">-- Select --</option>' + 
                        companies.map(c => '<option value="' + c + '">' + c + '</option>').join('');
                    
                    function renderTable() {
                        const tbody = document.getElementById('reportingBody');
                        tbody.innerHTML = records.map((r, idx) => createRowHtml(r, idx)).join('');
                    }
                    
                    function createRowHtml(r, idx) {
                        const isNew = !r.id;
                        
                        return \`
                            <tr data-id="\${r.id || 'new_' + idx}" data-idx="\${idx}" class="\${isNew ? 'new-row' : ''}">
                                <td class="row-number">\${r.id || 'NEW'}</td>
                                <td><input type="date" value="\${r.reportDate}" onchange="markDirty(this)"></td>
                                <td>
                                    <select onchange="markDirty(this)">
                                        \${companyOptionsHtml.replace('value="' + r.company + '"', 'value="' + r.company + '" selected')}
                                    </select>
                                </td>
                                <td>
                                    <select onchange="markDirty(this)">
                                        \${storeOptionsHtml.replace('value="' + r.storeId + '"', 'value="' + r.storeId + '" selected')}
                                    </select>
                                </td>
                                <td><input type="text" value="\${escapeHtml(r.guardName)}" placeholder="Guard name..." onchange="markDirty(this)"></td>
                                <td><textarea onchange="markDirty(this)" placeholder="Daily notes...">\${escapeHtml(r.dailyNotes)}</textarea></td>
                                <td style="padding:8px;color:#666;font-size:12px;">\${r.submittedBy || (isNew ? currentUser : '')}</td>
                                <td class="cell-actions">
                                    <button class="btn-save" onclick="saveRow(this)" title="Save">💾</button>
                                    <button class="btn-delete" onclick="deleteRow(this)" title="Delete">🗑️</button>
                                </td>
                            </tr>
                        \`;
                    }
                    
                    function escapeHtml(text) {
                        if (!text) return '';
                        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    }
                    
                    function addNewRow() {
                        records.unshift({
                            id: null,
                            reportDate: new Date().toISOString().split('T')[0],
                            company: '',
                            storeId: '',
                            storeName: '',
                            guardName: '',
                            dailyNotes: '',
                            submittedBy: currentUser
                        });
                        renderTable();
                        const firstInput = document.querySelector('#reportingBody tr:first-child input[type="date"]');
                        if (firstInput) firstInput.focus();
                    }
                    
                    function markDirty(el) {
                        el.closest('tr').classList.add('dirty');
                    }
                    
                    function getRowData(row) {
                        const cells = row.querySelectorAll('td');
                        const id = row.dataset.id;
                        
                        return {
                            id: id.startsWith('new_') ? null : parseInt(id),
                            reportDate: cells[1].querySelector('input').value,
                            company: cells[2].querySelector('select').value,
                            storeId: cells[3].querySelector('select').value || null,
                            guardName: cells[4].querySelector('input').value,
                            dailyNotes: cells[5].querySelector('textarea').value
                        };
                    }
                    
                    async function saveRow(btn) {
                        const row = btn.closest('tr');
                        const data = getRowData(row);
                        
                        if (!data.reportDate) {
                            alert('Please enter the report date');
                            return;
                        }
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/daily-reporting/api/save', {
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
                                    if (records[idx]) records[idx].id = result.id;
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
                        const dirtyRows = document.querySelectorAll('#reportingBody tr.dirty, #reportingBody tr.new-row');
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
                            records.splice(idx, 1);
                            renderTable();
                            return;
                        }
                        
                        if (!confirm('Are you sure you want to delete this report?')) return;
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/daily-reporting/api/delete/' + id, {
                                method: 'DELETE'
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showSaveIndicator('🗑️ Deleted!', true);
                                row.remove();
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
                    
                    function showSaveIndicator(msg, success) {
                        const el = document.getElementById('saveIndicator');
                        el.textContent = msg;
                        el.className = 'save-indicator ' + (success ? 'save-success' : 'save-error');
                        el.style.display = 'block';
                        setTimeout(() => el.style.display = 'none', 3000);
                    }
                    
                    // Keyboard shortcuts
                    document.addEventListener('keydown', (e) => {
                        if (e.ctrlKey && e.key === 's') {
                            e.preventDefault();
                            saveAllDirty();
                        }
                        if (e.ctrlKey && e.key === 'n') {
                            e.preventDefault();
                            addNewRow();
                        }
                    });
                    
                    // Initialize
                    renderTable();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading daily reporting:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Save record
router.post('/api/save', async (req, res) => {
    try {
        const { id, reportDate, company, storeId, guardName, dailyNotes } = req.body;
        const userId = req.currentUser.userId;
        
        const pool = await sql.connect(dbConfig);
        
        let recordId = id;
        
        if (id) {
            // Update existing
            await pool.request()
                .input('id', sql.Int, id)
                .input('reportDate', sql.Date, reportDate)
                .input('company', sql.NVarChar, company || null)
                .input('storeId', sql.Int, storeId || null)
                .input('guardName', sql.NVarChar, guardName || null)
                .input('dailyNotes', sql.NVarChar, dailyNotes || null)
                .query(`
                    UPDATE SecurityDailyReporting SET 
                        ReportDate = @reportDate,
                        Company = @company,
                        StoreId = @storeId,
                        GuardName = @guardName,
                        DailyNotes = @dailyNotes,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            // Insert new
            const result = await pool.request()
                .input('reportDate', sql.Date, reportDate)
                .input('company', sql.NVarChar, company || null)
                .input('storeId', sql.Int, storeId || null)
                .input('guardName', sql.NVarChar, guardName || null)
                .input('dailyNotes', sql.NVarChar, dailyNotes || null)
                .input('submittedBy', sql.Int, userId)
                .query(`
                    INSERT INTO SecurityDailyReporting (ReportDate, Company, StoreId, GuardName, DailyNotes, SubmittedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@reportDate, @company, @storeId, @guardName, @dailyNotes, @submittedBy)
                `);
            recordId = result.recordset[0].Id;
            
            // Trigger workflow engine for new reports (non-blocking)
            workflowEngine.start({
                formCode: 'DAILY_REPORTING',
                recordId: recordId,
                recordTable: 'SecurityDailyReporting',
                submitter: { userId, email: req.currentUser?.email || req.currentUser?.mail, name: req.currentUser?.displayName },
                store: { storeId: storeId ? parseInt(storeId) : null, storeName: null },
                metaData: { guardName, reportDate, company, dailyNotes },
                accessToken: req.currentUser?.accessToken
            }).catch(err => console.error('[WORKFLOW] Daily reporting error:', err));
        }
        
        await pool.close();
        
        res.json({ success: true, id: recordId });
    } catch (err) {
        console.error('Error saving daily report:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Delete record
router.delete('/api/delete/:id', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, recordId)
            .query('DELETE FROM SecurityDailyReporting WHERE Id = @id');
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting daily report:', err);
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;
