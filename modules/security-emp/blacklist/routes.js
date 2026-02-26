/**
 * Third Party Blacklisted Staff Module for Security Department
 * Excel-like editable table interface
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Configure multer for picture uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads/blacklist');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'blacklist-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Role options
const ROLES = ['Security', 'Cleaner', 'Helper', 'Porter', 'Valet'];

// Company options
const COMPANIES = ['Assiyana', 'Bright', 'C-Plus', 'Tandeef', 'Protectron', 'I-Secure', 'Middle East', 'Forearms', 'Valet Peak', 'VPS', 'Uptown'];

// Main Excel-like page
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all blacklist records with store names
        const records = await pool.request().query(`
            SELECT b.*, 
                   s.StoreName,
                   u.DisplayName as ReportedByName
            FROM ThirdPartyBlacklist b
            LEFT JOIN Stores s ON b.StoreId = s.Id
            LEFT JOIN Users u ON b.ReportedBy = u.Id
            ORDER BY b.Id DESC
        `);
        
        // Get stores for dropdown
        const stores = await pool.request().query(`
            SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        
        // Get stats
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as Total,
                COUNT(DISTINCT Company) as CompanyCount,
                COUNT(DISTINCT StoreId) as StoreCount
            FROM ThirdPartyBlacklist
        `);
        
        // Get stats by role
        const roleStats = await pool.request().query(`
            SELECT Role, COUNT(*) as Count
            FROM ThirdPartyBlacklist
            GROUP BY Role
        `);
        
        await pool.close();
        
        const statsData = stats.recordset[0];
        const roleStatsMap = {};
        roleStats.recordset.forEach(r => { roleStatsMap[r.Role] = r.Count; });
        
        // Build record data as JSON for JavaScript
        const recordsJson = JSON.stringify(records.recordset.map(r => ({
            id: r.Id,
            role: r.Role || '',
            storeId: r.StoreId || '',
            storeName: r.StoreName || '',
            company: r.Company || '',
            employeeName: r.EmployeeName || '',
            phoneNumber: r.PhoneNumber || '',
            incidentDate: r.IncidentDate ? new Date(r.IncidentDate).toISOString().split('T')[0] : '',
            incidentDetails: r.IncidentDetails || '',
            punchingMachineId: r.PunchingMachineId || '',
            picturePath: r.PicturePath || '',
            reportedBy: r.ReportedByName || ''
        })));
        
        const storesJson = JSON.stringify(stores.recordset);
        const rolesJson = JSON.stringify(ROLES);
        const companiesJson = JSON.stringify(COMPANIES);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Third Party Blacklist - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f0f0f0; }
                    
                    .header {
                        background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%);
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
                    .stat-item .number { font-size: 24px; font-weight: bold; color: #c0392b; }
                    .stat-item .label { font-size: 12px; color: #666; }
                    
                    .table-container {
                        padding: 20px;
                        overflow-x: auto;
                    }
                    
                    .excel-table {
                        width: 100%;
                        border-collapse: collapse;
                        background: white;
                        font-size: 12px;
                        table-layout: fixed;
                        min-width: 1600px;
                    }
                    .excel-table th {
                        background: #c0392b;
                        color: white;
                        padding: 10px 6px;
                        text-align: left;
                        font-weight: 600;
                        white-space: nowrap;
                        border: 1px solid #a93226;
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
                        padding: 6px;
                        font-size: 12px;
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
                    
                    .cell-actions {
                        text-align: center;
                        padding: 4px !important;
                        white-space: nowrap;
                    }
                    .cell-actions button {
                        padding: 3px 6px;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 11px;
                        margin: 1px;
                    }
                    .btn-save { background: #28a745; color: white; }
                    .btn-delete { background: #dc3545; color: white; }
                    .btn-upload { background: #17a2b8; color: white; }
                    
                    .row-number {
                        width: 50px;
                        text-align: center;
                        background: #e9ecef !important;
                        color: #666;
                        font-weight: 600;
                        padding: 6px !important;
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
                    .toolbar-btn.primary { background: #c0392b; color: white; border-color: #c0392b; }
                    
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
                    
                    .picture-cell {
                        text-align: center;
                        padding: 4px !important;
                    }
                    .picture-cell img {
                        max-width: 50px;
                        max-height: 50px;
                        cursor: pointer;
                        border-radius: 3px;
                    }
                    .picture-cell .no-pic {
                        color: #999;
                        font-size: 11px;
                    }
                    
                    /* Image Modal */
                    .modal-overlay {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.8);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .modal-overlay img {
                        max-width: 90%;
                        max-height: 90%;
                        border-radius: 5px;
                    }
                    .modal-close {
                        position: absolute;
                        top: 20px;
                        right: 30px;
                        color: white;
                        font-size: 40px;
                        cursor: pointer;
                    }
                    
                    /* Hidden file input */
                    .file-input { display: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚫 Third Party Blacklisted Staff</h1>
                    <div class="header-nav">
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="stats-bar">
                    <div class="stat-item">
                        <div class="number">${statsData.Total || 0}</div>
                        <div class="label">Total Blacklisted</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${statsData.CompanyCount || 0}</div>
                        <div class="label">Companies</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${statsData.StoreCount || 0}</div>
                        <div class="label">Stores Affected</div>
                    </div>
                    ${ROLES.map(role => `
                        <div class="stat-item">
                            <div class="number" style="color: #666;">${roleStatsMap[role] || 0}</div>
                            <div class="label">${role}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="toolbar">
                    <button class="toolbar-btn primary" onclick="addNewRow()">➕ Add New Row</button>
                    <button class="toolbar-btn" onclick="saveAllDirty()">💾 Save All Changes</button>
                    <span class="help-text">💡 Click any cell to edit • Yellow rows = unsaved changes • Ctrl+S to save all</span>
                </div>
                
                <div class="table-container">
                    <table class="excel-table" id="blacklistTable">
                        <thead>
                            <tr>
                                <th style="width:50px;">#</th>
                                <th style="width:90px;">Role</th>
                                <th style="width:150px;">Store</th>
                                <th style="width:110px;">Company</th>
                                <th style="width:150px;">Employee Name</th>
                                <th style="width:110px;">Phone</th>
                                <th style="width:100px;">Incident Date</th>
                                <th style="width:200px;">Incident Details</th>
                                <th style="width:100px;">Punching ID</th>
                                <th style="width:70px;">Picture</th>
                                <th style="width:120px;">Reported By</th>
                                <th style="width:80px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="blacklistBody">
                            <!-- Rows will be generated by JavaScript -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Image Preview Modal -->
                <div class="modal-overlay" id="imageModal" onclick="closeImageModal()">
                    <span class="modal-close">&times;</span>
                    <img id="modalImage" src="" alt="Full size image">
                </div>
                
                <div class="save-indicator" id="saveIndicator"></div>
                
                <script>
                    const records = ${recordsJson};
                    const stores = ${storesJson};
                    const roles = ${rolesJson};
                    const companies = ${companiesJson};
                    const currentUser = '${req.currentUser.displayName || req.currentUser.email || 'Unknown'}';
                    
                    // Build store options HTML
                    const storeOptionsHtml = '<option value="">-- Select Store --</option>' + 
                        stores.map(s => '<option value="' + s.Id + '">' + s.StoreName + '</option>').join('');
                    
                    // Build role options HTML
                    const roleOptionsHtml = '<option value="">-- Select --</option>' + 
                        roles.map(r => '<option value="' + r + '">' + r + '</option>').join('');
                    
                    // Build company options HTML
                    const companyOptionsHtml = '<option value="">-- Select --</option>' + 
                        companies.map(c => '<option value="' + c + '">' + c + '</option>').join('');
                    
                    function renderTable() {
                        const tbody = document.getElementById('blacklistBody');
                        tbody.innerHTML = records.map((r, idx) => createRowHtml(r, idx)).join('');
                    }
                    
                    function createRowHtml(r, idx) {
                        const isNew = !r.id;
                        const pictureHtml = r.picturePath 
                            ? '<img src="/uploads/blacklist/' + r.picturePath.split('/').pop() + '" onclick="showImage(this.src)" title="Click to enlarge">'
                            : '<span class="no-pic">No pic</span>';
                        
                        return \`
                            <tr data-id="\${r.id || 'new_' + idx}" data-idx="\${idx}" class="\${isNew ? 'new-row' : ''}">
                                <td class="row-number">\${r.id || 'NEW'}</td>
                                <td>
                                    <select onchange="markDirty(this)">
                                        \${roleOptionsHtml.replace('value="' + r.role + '"', 'value="' + r.role + '" selected')}
                                    </select>
                                </td>
                                <td>
                                    <select onchange="markDirty(this)">
                                        \${storeOptionsHtml.replace('value="' + r.storeId + '"', 'value="' + r.storeId + '" selected')}
                                    </select>
                                </td>
                                <td>
                                    <select onchange="markDirty(this)">
                                        \${companyOptionsHtml.replace('value="' + r.company + '"', 'value="' + r.company + '" selected')}
                                    </select>
                                </td>
                                <td><input type="text" value="\${escapeHtml(r.employeeName)}" placeholder="Employee name..." onchange="markDirty(this)"></td>
                                <td><input type="text" value="\${escapeHtml(r.phoneNumber)}" placeholder="Phone..." onchange="markDirty(this)"></td>
                                <td><input type="date" value="\${r.incidentDate}" onchange="markDirty(this)"></td>
                                <td><textarea onchange="markDirty(this)" placeholder="Details...">\${escapeHtml(r.incidentDetails)}</textarea></td>
                                <td><input type="text" value="\${escapeHtml(r.punchingMachineId)}" placeholder="ID..." onchange="markDirty(this)"></td>
                                <td class="picture-cell">
                                    \${pictureHtml}
                                    <input type="file" class="file-input" accept="image/*" onchange="uploadPicture(this)">
                                    <button class="btn-upload" onclick="this.previousElementSibling.click()" title="Upload">📷</button>
                                </td>
                                <td style="padding:6px;color:#666;font-size:11px;">\${r.reportedBy || (isNew ? currentUser : '')}</td>
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
                            role: '',
                            storeId: '',
                            storeName: '',
                            company: '',
                            employeeName: '',
                            phoneNumber: '',
                            incidentDate: new Date().toISOString().split('T')[0],
                            incidentDetails: '',
                            punchingMachineId: '',
                            picturePath: '',
                            reportedBy: currentUser
                        });
                        renderTable();
                        const firstSelect = document.querySelector('#blacklistBody tr:first-child select');
                        if (firstSelect) firstSelect.focus();
                    }
                    
                    function markDirty(el) {
                        el.closest('tr').classList.add('dirty');
                    }
                    
                    function getRowData(row) {
                        const cells = row.querySelectorAll('td');
                        const id = row.dataset.id;
                        
                        return {
                            id: id.startsWith('new_') ? null : parseInt(id),
                            role: cells[1].querySelector('select').value,
                            storeId: cells[2].querySelector('select').value || null,
                            company: cells[3].querySelector('select').value,
                            employeeName: cells[4].querySelector('input').value,
                            phoneNumber: cells[5].querySelector('input').value,
                            incidentDate: cells[6].querySelector('input').value || null,
                            incidentDetails: cells[7].querySelector('textarea').value,
                            punchingMachineId: cells[8].querySelector('input').value
                        };
                    }
                    
                    async function saveRow(btn) {
                        const row = btn.closest('tr');
                        const data = getRowData(row);
                        
                        if (!data.employeeName) {
                            alert('Please enter the employee name');
                            return;
                        }
                        if (!data.role) {
                            alert('Please select a role');
                            return;
                        }
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/blacklist/api/save', {
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
                        const dirtyRows = document.querySelectorAll('#blacklistBody tr.dirty, #blacklistBody tr.new-row');
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
                        
                        if (!confirm('Are you sure you want to delete this record?')) return;
                        
                        btn.disabled = true;
                        btn.textContent = '⏳';
                        
                        try {
                            const response = await fetch('/security-emp/blacklist/api/delete/' + id, {
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
                    
                    async function uploadPicture(input) {
                        const file = input.files[0];
                        if (!file) return;
                        
                        const row = input.closest('tr');
                        const id = row.dataset.id;
                        
                        if (id.startsWith('new_')) {
                            alert('Please save the record first before uploading a picture');
                            input.value = '';
                            return;
                        }
                        
                        const formData = new FormData();
                        formData.append('picture', file);
                        formData.append('id', id);
                        
                        try {
                            const response = await fetch('/security-emp/blacklist/api/upload-picture', {
                                method: 'POST',
                                body: formData
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showSaveIndicator('✅ Picture uploaded!', true);
                                setTimeout(() => location.reload(), 500);
                            } else {
                                showSaveIndicator('❌ Error: ' + result.error, false);
                            }
                        } catch (err) {
                            showSaveIndicator('❌ Error: ' + err.message, false);
                        }
                        
                        input.value = '';
                    }
                    
                    function showImage(src) {
                        document.getElementById('modalImage').src = src;
                        document.getElementById('imageModal').style.display = 'flex';
                    }
                    
                    function closeImageModal() {
                        document.getElementById('imageModal').style.display = 'none';
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
                        if (e.key === 'Escape') {
                            closeImageModal();
                        }
                    });
                    
                    // Initialize
                    renderTable();
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading blacklist:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Save record
router.post('/api/save', async (req, res) => {
    try {
        const { id, role, storeId, company, employeeName, phoneNumber, incidentDate, incidentDetails, punchingMachineId } = req.body;
        const userId = req.currentUser.userId;
        
        const pool = await sql.connect(dbConfig);
        
        let recordId = id;
        
        if (id) {
            // Update existing
            await pool.request()
                .input('id', sql.Int, id)
                .input('role', sql.NVarChar, role)
                .input('storeId', sql.Int, storeId || null)
                .input('company', sql.NVarChar, company || null)
                .input('employeeName', sql.NVarChar, employeeName)
                .input('phoneNumber', sql.NVarChar, phoneNumber || null)
                .input('incidentDate', sql.Date, incidentDate || null)
                .input('incidentDetails', sql.NVarChar, incidentDetails || null)
                .input('punchingMachineId', sql.NVarChar, punchingMachineId || null)
                .query(`
                    UPDATE ThirdPartyBlacklist SET 
                        Role = @role,
                        StoreId = @storeId,
                        Company = @company,
                        EmployeeName = @employeeName,
                        PhoneNumber = @phoneNumber,
                        IncidentDate = @incidentDate,
                        IncidentDetails = @incidentDetails,
                        PunchingMachineId = @punchingMachineId,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        } else {
            // Insert new
            const result = await pool.request()
                .input('role', sql.NVarChar, role)
                .input('storeId', sql.Int, storeId || null)
                .input('company', sql.NVarChar, company || null)
                .input('employeeName', sql.NVarChar, employeeName)
                .input('phoneNumber', sql.NVarChar, phoneNumber || null)
                .input('incidentDate', sql.Date, incidentDate || null)
                .input('incidentDetails', sql.NVarChar, incidentDetails || null)
                .input('punchingMachineId', sql.NVarChar, punchingMachineId || null)
                .input('reportedBy', sql.Int, userId)
                .query(`
                    INSERT INTO ThirdPartyBlacklist (Role, StoreId, Company, EmployeeName, PhoneNumber, IncidentDate, IncidentDetails, PunchingMachineId, ReportedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@role, @storeId, @company, @employeeName, @phoneNumber, @incidentDate, @incidentDetails, @punchingMachineId, @reportedBy)
                `);
            recordId = result.recordset[0].Id;
        }
        
        await pool.close();
        
        res.json({ success: true, id: recordId });
    } catch (err) {
        console.error('Error saving blacklist record:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Delete record
router.delete('/api/delete/:id', async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        
        const pool = await sql.connect(dbConfig);
        
        // Get picture path to delete file
        const record = await pool.request()
            .input('id', sql.Int, recordId)
            .query('SELECT PicturePath FROM ThirdPartyBlacklist WHERE Id = @id');
        
        if (record.recordset.length > 0 && record.recordset[0].PicturePath) {
            const picPath = path.join(__dirname, '../../../uploads/blacklist', record.recordset[0].PicturePath.split('/').pop());
            if (fs.existsSync(picPath)) {
                fs.unlinkSync(picPath);
            }
        }
        
        await pool.request()
            .input('id', sql.Int, recordId)
            .query('DELETE FROM ThirdPartyBlacklist WHERE Id = @id');
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting blacklist record:', err);
        res.json({ success: false, error: err.message });
    }
});

// API: Upload picture
router.post('/api/upload-picture', upload.single('picture'), async (req, res) => {
    try {
        const { id } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.json({ success: false, error: 'No file uploaded' });
        }
        
        const pool = await sql.connect(dbConfig);
        
        // Get old picture to delete
        const record = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT PicturePath FROM ThirdPartyBlacklist WHERE Id = @id');
        
        if (record.recordset.length > 0 && record.recordset[0].PicturePath) {
            const oldPath = path.join(__dirname, '../../../uploads/blacklist', record.recordset[0].PicturePath.split('/').pop());
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        // Update with new picture
        await pool.request()
            .input('id', sql.Int, id)
            .input('picturePath', sql.NVarChar, '/uploads/blacklist/' + file.filename)
            .query('UPDATE ThirdPartyBlacklist SET PicturePath = @picturePath, UpdatedAt = GETDATE() WHERE Id = @id');
        
        await pool.close();
        
        res.json({ success: true, path: '/uploads/blacklist/' + file.filename });
    } catch (err) {
        console.error('Error uploading picture:', err);
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;
