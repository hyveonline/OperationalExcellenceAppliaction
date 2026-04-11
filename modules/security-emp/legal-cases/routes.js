/**
 * Legal Cases Module for Security Department
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
        
        // Get all cases with store names
        const cases = await pool.request().query(`
            SELECT lc.*, 
                   u.DisplayName as CreatedByName,
                   (SELECT STRING_AGG(CAST(s.Id AS VARCHAR), ',') FROM LegalCaseStores lcs 
                    JOIN Stores s ON lcs.StoreId = s.Id WHERE lcs.LegalCaseId = lc.Id) as StoreIds,
                   (SELECT STRING_AGG(s.StoreName, ', ') FROM LegalCaseStores lcs 
                    JOIN Stores s ON lcs.StoreId = s.Id WHERE lcs.LegalCaseId = lc.Id) as StoreNames,
                   (SELECT COUNT(*) FROM LegalCaseUpdates WHERE LegalCaseId = lc.Id) as UpdateCount
            FROM LegalCases lc
            LEFT JOIN Users u ON lc.CreatedBy = u.Id
            ORDER BY lc.Id DESC
        `);
        
        // Get stores for dropdown
        const stores = await pool.request().query(`
            SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        // Get updates for each case
        const updates = await pool.request().query(`
            SELECT lcu.*, u.DisplayName as CreatedByName
            FROM LegalCaseUpdates lcu
            LEFT JOIN Users u ON lcu.CreatedBy = u.Id
            ORDER BY lcu.LegalCaseId, lcu.CreatedAt DESC
        `);
        
        // Get stats
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as Total,
                SUM(CASE WHEN Status = 'New' THEN 1 ELSE 0 END) as NewCount,
                SUM(CASE WHEN Status = 'In Progress' THEN 1 ELSE 0 END) as InProgressCount,
                SUM(CASE WHEN Status = 'Closed' THEN 1 ELSE 0 END) as ClosedCount,
                SUM(ISNULL(AmountStolen, 0)) as TotalStolen,
                SUM(ISNULL(AmountReturned, 0)) as TotalReturned
            FROM LegalCases
        `);
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        
        // Build updates map
        const updatesMap = {};
        updates.recordset.forEach(u => {
            if (!updatesMap[u.LegalCaseId]) updatesMap[u.LegalCaseId] = [];
            updatesMap[u.LegalCaseId].push(u);
        });
        
        // Build case data as JSON for JavaScript
        const casesJson = JSON.stringify(cases.recordset.map(c => ({
            id: c.Id,
            caseType: c.CaseType,
            description: c.Description || '',
            dateOfIssue: c.DateOfIssue ? new Date(c.DateOfIssue).toISOString().split('T')[0] : '',
            storeIds: c.StoreIds ? c.StoreIds.split(',').map(Number) : [],
            storeNames: c.StoreNames || '',
            amountStolen: c.AmountStolen || '',
            amountReturned: c.AmountReturned || '',
            verdict: c.Verdict || '',
            status: c.Status,
            updateCount: c.UpdateCount,
            updates: (updatesMap[c.Id] || []).map(u => ({
                text: u.Comment,
                by: u.CreatedByName || 'Unknown',
                at: new Date(u.CreatedAt).toLocaleString('en-GB')
            }))
        })));
        
        const storesJson = JSON.stringify(stores.recordset);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Legal Cases - ${process.env.APP_NAME}</title>
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
                    .stat-returned .number { color: #28a745; }
                    
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
                        min-width: 1320px;
                    }
                    .excel-table th {
                        background: #343a40;
                        color: white;
                        padding: 10px 8px;
                        text-align: left;
                        font-weight: 600;
                        white-space: nowrap;
                        border: 1px solid #495057;
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
                        min-height: 50px;
                        max-height: 80px;
                        resize: none;
                        display: block;
                    }
                    .excel-table select {
                        cursor: pointer;
                    }
                    
                    .cell-id { 
                        background: #f8f9fa; 
                        text-align: center; 
                        font-weight: 600;
                        color: #666;
                        padding: 8px !important;
                        width: 60px;
                    }
                    .cell-actions {
                        text-align: center;
                        padding: 5px !important;
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
                    .btn-updates { background: #17a2b8; color: white; }
                    
                    .status-select { font-weight: 600; }
                    .status-select option[value="New"] { color: #17a2b8; }
                    .status-select option[value="In Progress"] { color: #f57c00; }
                    .status-select option[value="Closed"] { color: #28a745; }
                    
                    .store-btn {
                        width: 100%;
                        text-align: left;
                        padding: 8px;
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        font-size: 13px;
                        color: #333;
                        min-height: 40px;
                    }
                    .store-btn:hover { background: #e3f2fd; }
                    
                    .amount-input { text-align: right; }
                    
                    /* Modal Styles */
                    .modal-overlay {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .modal {
                        background: white;
                        border-radius: 10px;
                        width: 500px;
                        max-height: 80vh;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    .modal-header {
                        padding: 15px 20px;
                        background: #343a40;
                        color: white;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .modal-header h3 { margin: 0; }
                    .modal-close {
                        background: none;
                        border: none;
                        color: white;
                        font-size: 24px;
                        cursor: pointer;
                    }
                    .modal-body {
                        padding: 20px;
                        overflow-y: auto;
                        flex: 1;
                    }
                    .modal-footer {
                        padding: 15px 20px;
                        border-top: 1px solid #ddd;
                        text-align: right;
                    }
                    .modal-footer button {
                        padding: 8px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-left: 10px;
                    }
                    
                    .store-search {
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        margin-bottom: 15px;
                    }
                    .store-list {
                        max-height: 300px;
                        overflow-y: auto;
                    }
                    .store-item {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 8px;
                        border-bottom: 1px solid #eee;
                        cursor: pointer;
                    }
                    .store-item:hover { background: #f5f5f5; }
                    .store-item input { width: auto; }
                    
                    /* Updates Modal */
                    .update-item {
                        border-left: 3px solid #343a40;
                        padding: 10px;
                        margin-bottom: 10px;
                        background: #f8f9fa;
                    }
                    .update-header {
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 5px;
                    }
                    .update-text { color: #333; }
                    .new-update-input {
                        width: 100%;
                        min-height: 80px;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        margin-top: 15px;
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
                    
                    .row-number {
                        width: 60px;
                        text-align: center;
                        background: #e9ecef !important;
                        color: #666;
                        font-weight: 600;
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
                    .toolbar-btn.primary { background: #28a745; color: white; border-color: #28a745; }
                    
                    .help-text {
                        color: #666;
                        font-size: 12px;
                        margin-left: auto;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>⚖️ Legal Cases</h1>
                    <div class="header-nav">
                        <a href="/security">← Security</a>
                        <a href="/dashboard">Dashboard</a>
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
                        <div class="number">$${Number(statsData.TotalStolen || 0).toLocaleString()}</div>
                        <div class="label">Total Stolen</div>
                    </div>
                    <div class="stat-item stat-returned">
                        <div class="number">$${Number(statsData.TotalReturned || 0).toLocaleString()}</div>
                        <div class="label">Returned</div>
                    </div>
                </div>
                
                <div class="toolbar">
                    <button class="toolbar-btn primary" onclick="addNewRow()">➕ Add New Row</button>
                    <button class="toolbar-btn" onclick="saveAllDirty()">💾 Save All Changes</button>
                    <span class="help-text">💡 Click any cell to edit • Yellow rows have unsaved changes • Click 💾 to save individual rows</span>
                </div>
                
                <div class="table-container">
                    <table class="excel-table" id="casesTable">
                        <thead>
                            <tr>
                                <th style="width:50px;">#</th>
                                <th style="width:110px;">Type</th>
                                <th style="width:220px;">Description</th>
                                <th style="width:110px;">Date</th>
                                <th style="width:180px;">Stores</th>
                                <th style="width:100px;">Stolen</th>
                                <th style="width:70px;">Notes</th>
                                <th style="width:100px;">Returned</th>
                                <th style="width:180px;">Verdict</th>
                                <th style="width:110px;">Status</th>
                                <th style="width:90px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="casesBody">
                            <!-- Rows will be generated by JavaScript -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Store Selection Modal -->
                <div class="modal-overlay" id="storeModal">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>🏪 Select Stores</h3>
                            <button class="modal-close" onclick="closeStoreModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <input type="text" class="store-search" id="storeSearch" placeholder="🔍 Search stores..." oninput="filterStores()">
                            <div class="store-list" id="storeList">
                                ${stores.recordset.map(s => `
                                    <label class="store-item">
                                        <input type="checkbox" value="${s.Id}" data-name="${s.StoreName}">
                                        <span>${s.StoreName}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button onclick="closeStoreModal()" style="background:#6c757d;color:white;">Cancel</button>
                            <button onclick="applyStores()" style="background:#28a745;color:white;">Apply</button>
                        </div>
                    </div>
                </div>
                
                <!-- Updates Modal -->
                <div class="modal-overlay" id="updatesModal">
                    <div class="modal" style="width:600px;">
                        <div class="modal-header">
                            <h3>💬 Case Updates</h3>
                            <button class="modal-close" onclick="closeUpdatesModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div id="updatesList"></div>
                            <textarea class="new-update-input" id="newUpdateText" placeholder="Add a new update..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button onclick="closeUpdatesModal()" style="background:#6c757d;color:white;">Close</button>
                            <button onclick="addUpdate()" style="background:#28a745;color:white;">Add Update</button>
                        </div>
                    </div>
                </div>
                
                <div class="save-indicator" id="saveIndicator"></div>
                
                <script>
                    const cases = ${casesJson};
                    const stores = ${storesJson};
                    let currentEditingRow = null;
                    let currentUpdatesRow = null;
                    
                    // Render all rows
                    function renderTable() {
                        const tbody = document.getElementById('casesBody');
                        tbody.innerHTML = cases.map((c, idx) => createRowHtml(c, idx)).join('');
                    }
                    
                    function createRowHtml(c, idx) {
                        const isNew = !c.id;
                        return \`
                            <tr data-id="\${c.id || 'new_' + idx}" data-idx="\${idx}" class="\${isNew ? 'new-row' : ''}">
                                <td class="row-number">\${c.id || 'NEW'}</td>
                                <td>
                                    <select class="type-select" onchange="markDirty(this)">
                                        <option value="">-- Select --</option>
                                        <option value="Theft" \${c.caseType === 'Theft' ? 'selected' : ''}>🔴 Theft</option>
                                        <option value="Assault" \${c.caseType === 'Assault' ? 'selected' : ''}>🟣 Assault</option>
                                        <option value="Vandalism" \${c.caseType === 'Vandalism' ? 'selected' : ''}>🟠 Vandalism</option>
                                        <option value="Harassment" \${c.caseType === 'Harassment' ? 'selected' : ''}>🔵 Harassment</option>
                                        <option value="Other" \${c.caseType === 'Other' ? 'selected' : ''}>⚪ Other</option>
                                    </select>
                                </td>
                                <td><textarea onchange="markDirty(this)" placeholder="Enter description...">\${escapeHtml(c.description)}</textarea></td>
                                <td><input type="date" value="\${c.dateOfIssue}" onchange="markDirty(this)"></td>
                                <td>
                                    <button class="store-btn" onclick="openStoreModal(this)" data-stores="\${(c.storeIds || []).join(',')}">\${c.storeNames || '📍 Click to select stores...'}</button>
                                </td>
                                <td><input type="number" class="amount-input" step="0.01" min="0" value="\${c.amountStolen}" placeholder="0.00" onchange="markDirty(this)"></td>
                                <td class="cell-actions">
                                    <button class="btn-updates" onclick="openUpdatesModal(this)" data-id="\${c.id}" data-idx="\${idx}">\${c.updateCount || 0} 💬</button>
                                </td>
                                <td><input type="number" class="amount-input" step="0.01" min="0" value="\${c.amountReturned}" placeholder="0.00" onchange="markDirty(this)"></td>
                                <td><textarea onchange="markDirty(this)" placeholder="Enter verdict...">\${escapeHtml(c.verdict)}</textarea></td>
                                <td>
                                    <select class="status-select" onchange="markDirty(this)">
                                        <option value="New" \${c.status === 'New' ? 'selected' : ''}>🆕 New</option>
                                        <option value="In Progress" \${c.status === 'In Progress' ? 'selected' : ''}>⏳ In Progress</option>
                                        <option value="Closed" \${c.status === 'Closed' ? 'selected' : ''}>✅ Closed</option>
                                    </select>
                                </td>
                                <td class="cell-actions">
                                    <button class="btn-save" onclick="saveRow(this)" title="Save">💾</button>
                                    <button class="btn-delete" onclick="deleteRow(this)" title="Delete">🗑️</button>
                                </td>
                            </tr>
                        \`;
                    }
                    
                    function escapeHtml(text) {
                        if (!text) return '';
                        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    }
                    
                    function addNewRow() {
                        cases.unshift({
                            id: null,
                            caseType: '',
                            description: '',
                            dateOfIssue: new Date().toISOString().split('T')[0],
                            storeIds: [],
                            storeNames: '',
                            amountStolen: '',
                            amountReturned: '',
                            verdict: '',
                            status: 'New',
                            updateCount: 0,
                            updates: []
                        });
                        renderTable();
                        // Focus on the first input
                        const firstSelect = document.querySelector('#casesBody tr:first-child select');
                        if (firstSelect) firstSelect.focus();
                    }
                    
                    function markDirty(el) {
                        const row = el.closest('tr');
                        row.classList.add('dirty');
                    }
                    
                    function getRowData(row) {
                        const cells = row.querySelectorAll('td');
                        const id = row.dataset.id;
                        
                        return {
                            id: id.startsWith('new_') ? null : parseInt(id),
                            caseType: cells[1].querySelector('select').value,
                            description: cells[2].querySelector('textarea').value,
                            dateOfIssue: cells[3].querySelector('input').value,
                            storeIds: cells[4].querySelector('button').dataset.stores.split(',').filter(s => s),
                            amountStolen: cells[5].querySelector('input').value || null,
                            amountReturned: cells[7].querySelector('input').value || null,
                            verdict: cells[8].querySelector('textarea').value,
                            status: cells[9].querySelector('select').value
                        };
                    }
                    
                    async function saveRow(btn) {
                        const row = btn.closest('tr');
                        const data = getRowData(row);
                        
                        if (!data.caseType) {
                            alert('Please select a case type');
                            return;
                        }
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/legal-cases/api/save', {
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
                                    // Update the cases array
                                    const idx = parseInt(row.dataset.idx);
                                    if (cases[idx]) cases[idx].id = result.id;
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
                        const dirtyRows = document.querySelectorAll('#casesBody tr.dirty, #casesBody tr.new-row');
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
                            cases.splice(idx, 1);
                            renderTable();
                            return;
                        }
                        
                        if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) return;
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/legal-cases/api/delete/' + id, {
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
                    
                    // Store Modal
                    function openStoreModal(btn) {
                        currentEditingRow = btn;
                        const selectedIds = btn.dataset.stores.split(',').filter(s => s).map(Number);
                        
                        document.querySelectorAll('#storeList input').forEach(cb => {
                            cb.checked = selectedIds.includes(parseInt(cb.value));
                        });
                        
                        document.getElementById('storeSearch').value = '';
                        filterStores();
                        document.getElementById('storeModal').style.display = 'flex';
                    }
                    
                    function closeStoreModal() {
                        document.getElementById('storeModal').style.display = 'none';
                        currentEditingRow = null;
                    }
                    
                    function filterStores() {
                        const search = document.getElementById('storeSearch').value.toLowerCase();
                        document.querySelectorAll('#storeList .store-item').forEach(item => {
                            const text = item.textContent.toLowerCase();
                            item.style.display = text.includes(search) ? 'flex' : 'none';
                        });
                    }
                    
                    function applyStores() {
                        const selected = [];
                        const names = [];
                        document.querySelectorAll('#storeList input:checked').forEach(cb => {
                            selected.push(cb.value);
                            names.push(cb.dataset.name);
                        });
                        
                        currentEditingRow.dataset.stores = selected.join(',');
                        currentEditingRow.textContent = names.join(', ') || '📍 Click to select stores...';
                        markDirty(currentEditingRow);
                        closeStoreModal();
                    }
                    
                    // Updates Modal
                    function openUpdatesModal(btn) {
                        const id = btn.dataset.id;
                        const idx = parseInt(btn.dataset.idx);
                        currentUpdatesRow = { id, idx, btn };
                        
                        const caseData = cases[idx];
                        const updates = caseData ? caseData.updates || [] : [];
                        
                        const updatesHtml = updates.length > 0 
                            ? updates.map(u => \`
                                <div class="update-item">
                                    <div class="update-header">
                                        <span>👤 \${u.by}</span>
                                        <span>📅 \${u.at}</span>
                                    </div>
                                    <div class="update-text">\${u.text}</div>
                                </div>
                            \`).join('')
                            : '<div style="color:#666;font-style:italic;padding:20px;text-align:center;">No updates yet. Add the first update below.</div>';
                        
                        document.getElementById('updatesList').innerHTML = updatesHtml;
                        document.getElementById('newUpdateText').value = '';
                        document.getElementById('updatesModal').style.display = 'flex';
                    }
                    
                    function closeUpdatesModal() {
                        document.getElementById('updatesModal').style.display = 'none';
                        currentUpdatesRow = null;
                    }
                    
                    async function addUpdate() {
                        const text = document.getElementById('newUpdateText').value.trim();
                        if (!text) {
                            alert('Please enter an update message');
                            return;
                        }
                        
                        const id = currentUpdatesRow.id;
                        if (!id || id === 'null' || id === 'undefined') {
                            alert('Please save the case first before adding updates');
                            return;
                        }
                        
                        try {
                            const response = await fetch('/security-emp/legal-cases/api/add-update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ caseId: id, comment: text })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showSaveIndicator('✅ Update added!', true);
                                closeUpdatesModal();
                                setTimeout(() => location.reload(), 500);
                            } else {
                                showSaveIndicator('❌ Error: ' + result.error, false);
                            }
                        } catch (err) {
                            showSaveIndicator('❌ Error: ' + err.message, false);
                        }
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
                    
                    // Close modals on escape
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') {
                            closeStoreModal();
                            closeUpdatesModal();
                        }
                    });
                    
                    // Close modals when clicking outside
                    document.querySelectorAll('.modal-overlay').forEach(overlay => {
                        overlay.addEventListener('click', (e) => {
                            if (e.target === overlay) {
                                closeStoreModal();
                                closeUpdatesModal();
                            }
                        });
                    });
                    
                    // Initialize
                    renderTable();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading legal cases:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Save case
router.post('/api/save', async (req, res) => {
    try {
        const { id, caseType, description, dateOfIssue, storeIds, amountStolen, amountReturned, verdict, status } = req.body;
        const userId = req.currentUser.userId;
        
        const pool = await sql.connect(dbConfig);
        
        let caseId = id;
        
        if (id) {
            // Update existing
            await pool.request()
                .input('id', sql.Int, id)
                .input('caseType', sql.NVarChar, caseType)
                .input('description', sql.NVarChar, description || null)
                .input('dateOfIssue', sql.Date, dateOfIssue || null)
                .input('amountStolen', sql.Decimal(18, 2), amountStolen || null)
                .input('amountReturned', sql.Decimal(18, 2), amountReturned || null)
                .input('verdict', sql.NVarChar, verdict || null)
                .input('status', sql.NVarChar, status || 'New')
                .query(`
                    UPDATE LegalCases SET 
                        CaseType = @caseType,
                        Description = @description,
                        DateOfIssue = @dateOfIssue,
                        AmountStolen = @amountStolen,
                        AmountReturned = @amountReturned,
                        Verdict = @verdict,
                        Status = @status,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            // Insert new
            const result = await pool.request()
                .input('caseType', sql.NVarChar, caseType)
                .input('description', sql.NVarChar, description || null)
                .input('dateOfIssue', sql.Date, dateOfIssue || null)
                .input('amountStolen', sql.Decimal(18, 2), amountStolen || null)
                .input('amountReturned', sql.Decimal(18, 2), amountReturned || null)
                .input('verdict', sql.NVarChar, verdict || null)
                .input('status', sql.NVarChar, status || 'New')
                .input('createdBy', sql.Int, userId)
                .query(`
                    INSERT INTO LegalCases (CaseType, Description, DateOfIssue, AmountStolen, AmountReturned, Verdict, Status, CreatedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@caseType, @description, @dateOfIssue, @amountStolen, @amountReturned, @verdict, @status, @createdBy)
                `);
            caseId = result.recordset[0].Id;
            
            // Trigger workflow engine for new cases (non-blocking)
            workflowEngine.start({
                formCode: 'LEGAL_CASES',
                recordId: caseId,
                recordTable: 'LegalCases',
                submitter: { userId, email: req.currentUser?.email || req.currentUser?.mail, name: req.currentUser?.displayName },
                store: { storeId: storeIdList[0] ? parseInt(storeIdList[0]) : null, storeName: null },
                metaData: { caseType, description, dateOfIssue, amountStolen, amountReturned, verdict, status },
                accessToken: req.currentUser?.accessToken
            }).catch(err => console.error('[WORKFLOW] Legal cases error:', err));
        }
        
        // Update stores
        await pool.request()
            .input('caseId', sql.Int, caseId)
            .query('DELETE FROM LegalCaseStores WHERE LegalCaseId = @caseId');
        
        const storeIdList = Array.isArray(storeIds) ? storeIds : (storeIds ? [storeIds] : []);
        for (const storeId of storeIdList) {
            if (storeId) {
                await pool.request()
                    .input('caseId', sql.Int, caseId)
                    .input('storeId', sql.Int, parseInt(storeId))
                    .query('INSERT INTO LegalCaseStores (LegalCaseId, StoreId) VALUES (@caseId, @storeId)');
            }
        }
        
        await pool.close();
        
        res.json({ success: true, id: caseId });
    } catch (err) {
        console.error('Error saving case:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Delete case
router.delete('/api/delete/:id', async (req, res) => {
    try {
        const caseId = parseInt(req.params.id);
        
        const pool = await sql.connect(dbConfig);
        
        // Delete related records first
        await pool.request()
            .input('id', sql.Int, caseId)
            .query('DELETE FROM LegalCaseStores WHERE LegalCaseId = @id');
        
        await pool.request()
            .input('id', sql.Int, caseId)
            .query('DELETE FROM LegalCaseUpdates WHERE LegalCaseId = @id');
        
        await pool.request()
            .input('id', sql.Int, caseId)
            .query('DELETE FROM LegalCases WHERE Id = @id');
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting case:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Add update
router.post('/api/add-update', async (req, res) => {
    try {
        const { caseId, comment } = req.body;
        const userId = req.currentUser.userId;
        
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('caseId', sql.Int, caseId)
            .input('comment', sql.NVarChar, comment)
            .input('createdBy', sql.Int, userId)
            .query('INSERT INTO LegalCaseUpdates (LegalCaseId, Comment, CreatedBy) VALUES (@caseId, @comment, @createdBy)');
        
        await pool.request()
            .input('caseId', sql.Int, caseId)
            .query('UPDATE LegalCases SET UpdatedAt = GETDATE() WHERE Id = @caseId');
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding update:', err);
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;
