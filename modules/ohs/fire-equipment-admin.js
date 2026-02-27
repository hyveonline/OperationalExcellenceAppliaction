/**
 * Fire Equipment Admin Setup
 * Configure equipment types and predefined equipment per store
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    },
    pool: {
        max: 50,
        min: 5,
        idleTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000
    }
};

let poolPromise = null;
let pool = null;

async function getPool() {
    if (pool && pool.connected) return pool;
    if (pool && !pool.connected) { poolPromise = null; pool = null; }
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            pool = newPool;
            pool.on('error', () => { poolPromise = null; pool = null; });
            return pool;
        }).catch(err => {
            poolPromise = null; pool = null;
            throw err;
        });
    }
    return poolPromise;
}

function getBrands() {
    return [
        { id: 'spinneys', name: 'Spinneys', icon: '🛒', color: '#e74c3c' },
        { id: 'happy', name: 'Happy', icon: '😊', color: '#f39c12' },
        { id: 'gng', name: 'GNG', icon: '🏪', color: '#27ae60' },
        { id: 'noknok', name: 'NokNok', icon: '📦', color: '#9b59b6' },
        { id: 'other', name: 'Other', icon: '🏢', color: '#3498db' }
    ];
}

const commonStyles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Segoe UI', Arial, sans-serif; 
        background: #f0f2f5;
        min-height: 100vh;
    }
    .header {
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
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
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
    }
    .header-nav a:hover { background: rgba(255,255,255,0.2); }
    
    .container { padding: 20px; max-width: 1400px; margin: 0 auto; }
    
    .tabs {
        display: flex;
        gap: 5px;
        background: white;
        padding: 10px 15px 0;
        border-radius: 8px 8px 0 0;
        border-bottom: 2px solid #e0e0e0;
    }
    .tab {
        padding: 12px 24px;
        cursor: pointer;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        font-weight: 500;
        color: #666;
        margin-bottom: -2px;
    }
    .tab:hover { background: #e8e8e8; }
    .tab.active {
        background: white;
        color: #2c3e50;
        border-color: #e0e0e0;
        border-bottom: 2px solid white;
    }
    
    .tab-content {
        display: none;
        background: white;
        padding: 20px;
        border-radius: 0 0 8px 8px;
    }
    .tab-content.active { display: block; }
    
    .toolbar {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
        align-items: center;
    }
    .toolbar select, .toolbar input {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
    }
    .toolbar button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .btn-primary { background: #3498db; color: white; }
    .btn-primary:hover { background: #2980b9; }
    .btn-success { background: #27ae60; color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-danger:hover { background: #c0392b; }
    .btn-secondary { background: #95a5a6; color: white; }
    
    .table-wrapper {
        overflow-x: auto;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        font-size: 13px;
    }
    th, td {
        border: 1px solid #e0e0e0;
        padding: 10px;
        text-align: left;
    }
    th {
        background: #f8f9fa;
        font-weight: 600;
    }
    tr:hover { background: #f5f8ff; }
    
    td input, td select {
        width: 100%;
        padding: 6px 8px;
        border: 1px solid transparent;
        background: transparent;
        font-size: 13px;
        border-radius: 4px;
    }
    td input:focus, td select:focus {
        border-color: #3498db;
        outline: none;
        background: white;
    }
    td input:hover, td select:hover {
        border-color: #ddd;
    }
    
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        justify-content: center;
        align-items: center;
        z-index: 1500;
    }
    .modal.active { display: flex; }
    .modal-content {
        background: white;
        padding: 25px;
        border-radius: 12px;
        min-width: 400px;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
    }
    .modal h3 { margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
    .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
    }
    .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }
    
    .toast {
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 2000;
        display: none;
    }
    .toast.success { background: #27ae60; }
    .toast.error { background: #e74c3c; }
    
    .info-box {
        background: #e3f2fd;
        border-left: 4px solid #2196f3;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 0 8px 8px 0;
    }
`;

// ==========================================
// MAIN ADMIN PAGE
// ==========================================
router.get('/', async (req, res) => {
    const user = req.currentUser;
    const brands = getBrands();
    
    let pool;
    try {
        pool = await getPool();
        
        // Get equipment types
        const typesResult = await pool.request().query(`
            SELECT * FROM FireEquipmentTypes ORDER BY SortOrder, TypeName
        `);
        
        // Get stores
        const storesResult = await pool.request().query(`
            SELECT s.Id, s.StoreName, ISNULL(b.BrandName, 'Other') as Brand 
            FROM Stores s 
            LEFT JOIN Brands b ON s.BrandId = b.Id 
            WHERE s.IsActive = 1 
            ORDER BY b.BrandName, s.StoreName
        `);
        
        // Get registry counts per store
        const registryCountsResult = await pool.request().query(`
            SELECT StoreId, COUNT(*) as EquipmentCount 
            FROM FireEquipmentRegistry WHERE IsActive = 1 
            GROUP BY StoreId
        `);
        
        const registryCounts = {};
        registryCountsResult.recordset.forEach(r => {
            registryCounts[r.StoreId] = r.EquipmentCount;
        });
        
        const equipmentTypes = typesResult.recordset;
        const stores = storesResult.recordset;
        
        // Group stores by brand
        const storesByBrand = {};
        stores.forEach(store => {
            const brand = store.Brand || 'Other';
            if (!storesByBrand[brand]) storesByBrand[brand] = [];
            storesByBrand[brand].push({ ...store, equipmentCount: registryCounts[store.Id] || 0 });
        });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Fire Equipment Setup - Admin</title>
                <style>${commonStyles}</style>
            </head>
            <body>
                <div class="header">
                    <h1>⚙️ Fire Equipment Admin Setup</h1>
                    <div class="header-nav">
                        <a href="/ohs/fire-equipment">🧯 Fire Equipment</a>
                        <a href="/ohs">🦺 OHS</a>
                        <a href="/admin">🔧 Admin</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="tabs">
                        <div class="tab active" onclick="showTab('types')">📋 Equipment Types</div>
                        <div class="tab" onclick="showTab('registry')">🏪 Store Equipment Registry</div>
                        <div class="tab" onclick="showTab('import')">📥 Import from Excel</div>
                    </div>
                    
                    <!-- Equipment Types Tab -->
                    <div class="tab-content active" id="tab-types">
                        <div class="info-box">
                            <strong>Equipment Types</strong> - Define the types of fire prevention equipment available. These types will be used when setting up equipment for each store.
                        </div>
                        
                        <div class="toolbar">
                            <button class="btn-success" onclick="showAddTypeModal()">➕ Add Equipment Type</button>
                        </div>
                        
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 60px;">Order</th>
                                        <th>Type Name</th>
                                        <th>Code</th>
                                        <th>Default Weight</th>
                                        <th>Description</th>
                                        <th style="width: 80px;">Active</th>
                                        <th style="width: 100px;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="typesTable">
                                    ${equipmentTypes.map(t => `
                                        <tr data-id="${t.Id}">
                                            <td><input type="number" value="${t.SortOrder}" onchange="updateType(${t.Id}, 'SortOrder', this.value)" style="width: 50px;"></td>
                                            <td><input type="text" value="${t.TypeName}" onchange="updateType(${t.Id}, 'TypeName', this.value)"></td>
                                            <td><input type="text" value="${t.TypeCode || ''}" onchange="updateType(${t.Id}, 'TypeCode', this.value)" style="width: 100px;"></td>
                                            <td><input type="text" value="${t.DefaultWeight || ''}" onchange="updateType(${t.Id}, 'DefaultWeight', this.value)" style="width: 80px;"></td>
                                            <td><input type="text" value="${t.Description || ''}" onchange="updateType(${t.Id}, 'Description', this.value)"></td>
                                            <td style="text-align: center;">
                                                <input type="checkbox" ${t.IsActive ? 'checked' : ''} onchange="updateType(${t.Id}, 'IsActive', this.checked ? 1 : 0)">
                                            </td>
                                            <td>
                                                <button class="btn-danger" onclick="deleteType(${t.Id})" style="padding: 4px 8px; font-size: 11px;">🗑️ Delete</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Store Equipment Registry Tab -->
                    <div class="tab-content" id="tab-registry">
                        <div class="info-box">
                            <strong>Store Equipment Registry</strong> - Define what fire equipment exists at each store. When users create a new inspection, these items will be pre-populated.
                        </div>
                        
                        <div class="toolbar">
                            <select id="brandFilter" onchange="loadStoreEquipment()" style="min-width: 150px;">
                                <option value="">Select Brand</option>
                                ${brands.map(b => `<option value="${b.name}">${b.icon} ${b.name}</option>`).join('')}
                            </select>
                            <select id="storeFilter" onchange="loadStoreEquipment()" style="min-width: 200px;" disabled>
                                <option value="">Select Store</option>
                            </select>
                            <button class="btn-success" onclick="showAddEquipmentModal()" id="addEquipmentBtn" disabled>➕ Add Equipment</button>
                            <button class="btn-primary" onclick="copyFromStore()" id="copyBtn" disabled>📋 Copy from Another Store</button>
                        </div>
                        
                        <div id="registryContent">
                            <div style="text-align: center; padding: 60px; color: #666;">
                                <div style="font-size: 60px; margin-bottom: 20px;">🏪</div>
                                <p>Select a brand and store to manage equipment</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Import Tab -->
                    <div class="tab-content" id="tab-import">
                        <div class="info-box">
                            <strong>Import from Excel</strong> - Import equipment data from your existing Fire Fighting Equipment Register Excel file.
                        </div>
                        
                        <div style="background: white; padding: 30px; border-radius: 8px; text-align: center;">
                            <p style="margin-bottom: 20px;">Upload your Excel file to import equipment registry for all stores.</p>
                            <input type="file" id="excelFile" accept=".xlsx,.xls" style="margin-bottom: 15px;">
                            <br>
                            <button class="btn-primary" onclick="importExcel()">📥 Import Equipment</button>
                            <div id="importProgress" style="margin-top: 20px; display: none;">
                                <div style="color: #666;">Importing...</div>
                            </div>
                            <div id="importResult" style="margin-top: 20px;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Add Type Modal -->
                <div class="modal" id="addTypeModal">
                    <div class="modal-content">
                        <h3>➕ Add Equipment Type</h3>
                        <form onsubmit="addType(event)">
                            <div class="form-group">
                                <label>Type Name *</label>
                                <input type="text" id="newTypeName" required placeholder="e.g., Powder Fire Extinguisher">
                            </div>
                            <div class="form-group">
                                <label>Type Code</label>
                                <input type="text" id="newTypeCode" placeholder="e.g., POWDER">
                            </div>
                            <div class="form-group">
                                <label>Default Weight</label>
                                <input type="text" id="newTypeWeight" placeholder="e.g., 6kg">
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea id="newTypeDesc" rows="2"></textarea>
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" onclick="closeModal('addTypeModal')">Cancel</button>
                                <button type="submit" class="btn-success">Add Type</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Add Equipment Modal -->
                <div class="modal" id="addEquipmentModal">
                    <div class="modal-content">
                        <h3>➕ Add Equipment to Store</h3>
                        <form onsubmit="addEquipment(event)">
                            <div class="form-group">
                                <label>Equipment Type *</label>
                                <select id="newEqType" required>
                                    <option value="">Select Type</option>
                                    ${equipmentTypes.filter(t => t.IsActive).map(t => `<option value="${t.Id}" data-weight="${t.DefaultWeight}">${t.TypeName}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Or Custom Type Name</label>
                                <input type="text" id="newEqCustomType" placeholder="Leave empty to use type above">
                            </div>
                            <div class="form-group">
                                <label>Location *</label>
                                <input type="text" id="newEqLocation" required placeholder="e.g., Backdoor, Store entrance">
                            </div>
                            <div class="form-group">
                                <label>Weight</label>
                                <input type="text" id="newEqWeight" placeholder="e.g., 6kg">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" onclick="closeModal('addEquipmentModal')">Cancel</button>
                                <button type="submit" class="btn-success">Add Equipment</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Copy From Store Modal -->
                <div class="modal" id="copyModal">
                    <div class="modal-content">
                        <h3>📋 Copy Equipment from Another Store</h3>
                        <form onsubmit="doCopyFromStore(event)">
                            <div class="form-group">
                                <label>Copy From Store *</label>
                                <select id="copyFromStoreId" required>
                                    <option value="">Select Source Store</option>
                                    ${stores.filter(s => registryCounts[s.Id]).map(s => `<option value="${s.Id}">${s.Brand ? s.Brand + ' - ' : ''}${s.StoreName} (${registryCounts[s.Id]} items)</option>`).join('')}
                                </select>
                            </div>
                            <p style="color: #666; font-size: 13px;">This will copy all equipment from the selected store to the current store.</p>
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" onclick="closeModal('copyModal')">Cancel</button>
                                <button type="submit" class="btn-primary">Copy Equipment</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    const storesByBrand = ${JSON.stringify(storesByBrand)};
                    const equipmentTypes = ${JSON.stringify(equipmentTypes)};
                    let currentStoreId = null;
                    
                    function showTab(tabId) {
                        document.querySelectorAll('.tab').forEach((t, i) => {
                            t.classList.toggle('active', t.textContent.includes(tabId === 'types' ? 'Types' : tabId === 'registry' ? 'Registry' : 'Import'));
                        });
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        document.getElementById('tab-' + tabId).classList.add('active');
                    }
                    
                    function showAddTypeModal() {
                        document.getElementById('addTypeModal').classList.add('active');
                    }
                    
                    function showAddEquipmentModal() {
                        if (!currentStoreId) {
                            showToast('Please select a store first', 'error');
                            return;
                        }
                        document.getElementById('addEquipmentModal').classList.add('active');
                    }
                    
                    function closeModal(id) {
                        document.getElementById(id).classList.remove('active');
                    }
                    
                    // Brand selection
                    document.getElementById('brandFilter').addEventListener('change', function() {
                        const brand = this.value;
                        const storeSelect = document.getElementById('storeFilter');
                        const stores = storesByBrand[brand] || [];
                        
                        if (stores.length === 0) {
                            storeSelect.innerHTML = '<option value="">No stores found</option>';
                            storeSelect.disabled = true;
                            return;
                        }
                        
                        storeSelect.innerHTML = '<option value="">Select Store</option>' +
                            stores.map(s => '<option value="' + s.Id + '">' + s.StoreName + ' (' + s.equipmentCount + ' items)</option>').join('');
                        storeSelect.disabled = false;
                    });
                    
                    async function loadStoreEquipment() {
                        const storeId = document.getElementById('storeFilter').value;
                        const container = document.getElementById('registryContent');
                        
                        if (!storeId) {
                            document.getElementById('addEquipmentBtn').disabled = true;
                            document.getElementById('copyBtn').disabled = true;
                            container.innerHTML = '<div style="text-align: center; padding: 60px; color: #666;"><div style="font-size: 60px; margin-bottom: 20px;">🏪</div><p>Select a store to manage equipment</p></div>';
                            return;
                        }
                        
                        currentStoreId = storeId;
                        document.getElementById('addEquipmentBtn').disabled = false;
                        document.getElementById('copyBtn').disabled = false;
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/registry/' + storeId);
                            const data = await res.json();
                            
                            if (data.success) {
                                renderRegistryTable(data.equipment);
                            }
                        } catch (err) {
                            showToast('Error loading equipment', 'error');
                        }
                    }
                    
                    function renderRegistryTable(equipment) {
                        const container = document.getElementById('registryContent');
                        
                        if (equipment.length === 0) {
                            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No equipment defined for this store. Click "Add Equipment" or "Copy from Another Store" to add items.</div>';
                            return;
                        }
                        
                        container.innerHTML = \`
                            <div class="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="width: 50px;">#</th>
                                            <th>Equipment Type</th>
                                            <th>Location</th>
                                            <th style="width: 80px;">Weight</th>
                                            <th style="width: 60px;">Order</th>
                                            <th style="width: 80px;">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        \${equipment.map((eq, idx) => \`
                                            <tr data-id="\${eq.Id}">
                                                <td style="text-align: center; color: #666;">\${idx + 1}</td>
                                                <td>\${eq.TypeName || eq.CustomTypeName || '-'}</td>
                                                <td><input type="text" value="\${eq.Location || ''}" onchange="updateRegistry(\${eq.Id}, 'Location', this.value)"></td>
                                                <td><input type="text" value="\${eq.Weight || ''}" onchange="updateRegistry(\${eq.Id}, 'Weight', this.value)" style="width: 60px;"></td>
                                                <td><input type="number" value="\${eq.SortOrder}" onchange="updateRegistry(\${eq.Id}, 'SortOrder', this.value)" style="width: 50px;"></td>
                                                <td><button class="btn-danger" onclick="deleteRegistry(\${eq.Id})" style="padding: 4px 8px; font-size: 11px;">🗑️</button></td>
                                            </tr>
                                        \`).join('')}
                                    </tbody>
                                </table>
                            </div>
                        \`;
                    }
                    
                    // Equipment Type CRUD
                    async function addType(e) {
                        e.preventDefault();
                        const data = {
                            typeName: document.getElementById('newTypeName').value,
                            typeCode: document.getElementById('newTypeCode').value,
                            defaultWeight: document.getElementById('newTypeWeight').value,
                            description: document.getElementById('newTypeDesc').value
                        };
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/types', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                showToast('Type added', 'success');
                                setTimeout(() => location.reload(), 500);
                            } else {
                                showToast(result.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error adding type', 'error');
                        }
                    }
                    
                    async function updateType(id, field, value) {
                        try {
                            await fetch('/ohs/fire-equipment/admin/api/types/' + id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ field, value })
                            });
                        } catch (err) {
                            showToast('Error updating', 'error');
                        }
                    }
                    
                    async function deleteType(id) {
                        if (!confirm('Delete this equipment type?')) return;
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/types/' + id, { method: 'DELETE' });
                            const result = await res.json();
                            
                            if (result.success) {
                                document.querySelector('#typesTable tr[data-id="' + id + '"]').remove();
                                showToast('Deleted', 'success');
                            }
                        } catch (err) {
                            showToast('Error deleting', 'error');
                        }
                    }
                    
                    // Registry CRUD
                    async function addEquipment(e) {
                        e.preventDefault();
                        const typeId = document.getElementById('newEqType').value;
                        const customType = document.getElementById('newEqCustomType').value;
                        
                        const data = {
                            storeId: currentStoreId,
                            equipmentTypeId: typeId || null,
                            customTypeName: customType || null,
                            location: document.getElementById('newEqLocation').value,
                            weight: document.getElementById('newEqWeight').value
                        };
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/registry', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                showToast('Equipment added', 'success');
                                closeModal('addEquipmentModal');
                                loadStoreEquipment();
                            } else {
                                showToast(result.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error adding equipment', 'error');
                        }
                    }
                    
                    async function updateRegistry(id, field, value) {
                        try {
                            await fetch('/ohs/fire-equipment/admin/api/registry/' + id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ field, value })
                            });
                        } catch (err) {
                            showToast('Error updating', 'error');
                        }
                    }
                    
                    async function deleteRegistry(id) {
                        if (!confirm('Delete this equipment?')) return;
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/registry/' + id, { method: 'DELETE' });
                            if (res.ok) {
                                loadStoreEquipment();
                                showToast('Deleted', 'success');
                            }
                        } catch (err) {
                            showToast('Error deleting', 'error');
                        }
                    }
                    
                    function copyFromStore() {
                        if (!currentStoreId) {
                            showToast('Please select a target store first', 'error');
                            return;
                        }
                        document.getElementById('copyModal').classList.add('active');
                    }
                    
                    async function doCopyFromStore(e) {
                        e.preventDefault();
                        const sourceStoreId = document.getElementById('copyFromStoreId').value;
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/registry/copy', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sourceStoreId, targetStoreId: currentStoreId })
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                showToast('Copied ' + result.count + ' items', 'success');
                                closeModal('copyModal');
                                loadStoreEquipment();
                            } else {
                                showToast(result.error, 'error');
                            }
                        } catch (err) {
                            showToast('Error copying', 'error');
                        }
                    }
                    
                    async function importExcel() {
                        const fileInput = document.getElementById('excelFile');
                        if (!fileInput.files.length) {
                            showToast('Please select a file', 'error');
                            return;
                        }
                        
                        const formData = new FormData();
                        formData.append('file', fileInput.files[0]);
                        
                        document.getElementById('importProgress').style.display = 'block';
                        document.getElementById('importResult').innerHTML = '';
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/admin/api/import', {
                                method: 'POST',
                                body: formData
                            });
                            const result = await res.json();
                            
                            document.getElementById('importProgress').style.display = 'none';
                            
                            if (result.success) {
                                document.getElementById('importResult').innerHTML = '<div style="color: #27ae60;">✅ Import completed! ' + result.imported + ' equipment items imported for ' + result.stores + ' stores.</div>';
                            } else {
                                document.getElementById('importResult').innerHTML = '<div style="color: #e74c3c;">❌ ' + result.error + '</div>';
                            }
                        } catch (err) {
                            document.getElementById('importProgress').style.display = 'none';
                            document.getElementById('importResult').innerHTML = '<div style="color: #e74c3c;">❌ Error importing file</div>';
                        }
                    }
                    
                    // Auto-fill weight when type selected
                    document.getElementById('newEqType').addEventListener('change', function() {
                        const option = this.options[this.selectedIndex];
                        if (option.dataset.weight) {
                            document.getElementById('newEqWeight').value = option.dataset.weight;
                        }
                    });
                    
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast ' + type;
                        toast.style.display = 'block';
                        setTimeout(() => toast.style.display = 'none', 3000);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Fire Equipment Admin error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// API: Equipment Types CRUD
// ==========================================
router.post('/api/types', async (req, res) => {
    const { typeName, typeCode, defaultWeight, description } = req.body;
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        const maxOrder = await pool.request().query('SELECT ISNULL(MAX(SortOrder), 0) + 1 as NextOrder FROM FireEquipmentTypes');
        
        await pool.request()
            .input('typeName', sql.NVarChar, typeName)
            .input('typeCode', sql.NVarChar, typeCode)
            .input('defaultWeight', sql.NVarChar, defaultWeight)
            .input('description', sql.NVarChar, description)
            .input('sortOrder', sql.Int, maxOrder.recordset[0].NextOrder)
            .input('createdBy', sql.Int, user?.userId || 1)
            .query(`
                INSERT INTO FireEquipmentTypes (TypeName, TypeCode, DefaultWeight, Description, SortOrder, CreatedBy)
                VALUES (@typeName, @typeCode, @defaultWeight, @description, @sortOrder, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/api/types/:id', async (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['TypeName', 'TypeCode', 'DefaultWeight', 'Description', 'SortOrder', 'IsActive'];
    
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ success: false, error: 'Invalid field' });
    }
    
    let pool;
    try {
        pool = await getPool();
        
        const sqlType = field === 'SortOrder' ? sql.Int : field === 'IsActive' ? sql.Bit : sql.NVarChar;
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('value', sqlType, value)
            .query(`UPDATE FireEquipmentTypes SET ${field} = @value WHERE Id = @id`);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api/types/:id', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM FireEquipmentTypes WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Store Equipment Registry CRUD
// ==========================================
router.get('/api/registry/:storeId', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        
        const result = await pool.request()
            .input('storeId', sql.Int, req.params.storeId)
            .query(`
                SELECT r.*, t.TypeName
                FROM FireEquipmentRegistry r
                LEFT JOIN FireEquipmentTypes t ON r.EquipmentTypeId = t.Id
                WHERE r.StoreId = @storeId AND r.IsActive = 1
                ORDER BY r.SortOrder, r.Id
            `);
        
        res.json({ success: true, equipment: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api/registry', async (req, res) => {
    const { storeId, equipmentTypeId, customTypeName, location, weight } = req.body;
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        const maxOrder = await pool.request()
            .input('storeId', sql.Int, storeId)
            .query('SELECT ISNULL(MAX(SortOrder), 0) + 1 as NextOrder FROM FireEquipmentRegistry WHERE StoreId = @storeId');
        
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('equipmentTypeId', sql.Int, equipmentTypeId || null)
            .input('customTypeName', sql.NVarChar, customTypeName)
            .input('location', sql.NVarChar, location)
            .input('weight', sql.NVarChar, weight)
            .input('sortOrder', sql.Int, maxOrder.recordset[0].NextOrder)
            .input('createdBy', sql.Int, user?.userId || 1)
            .query(`
                INSERT INTO FireEquipmentRegistry (StoreId, EquipmentTypeId, CustomTypeName, Location, Weight, SortOrder, CreatedBy)
                VALUES (@storeId, @equipmentTypeId, @customTypeName, @location, @weight, @sortOrder, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/api/registry/:id', async (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['Location', 'Weight', 'SortOrder'];
    
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ success: false, error: 'Invalid field' });
    }
    
    let pool;
    try {
        pool = await getPool();
        
        const sqlType = field === 'SortOrder' ? sql.Int : sql.NVarChar;
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('value', sqlType, value)
            .query(`UPDATE FireEquipmentRegistry SET ${field} = @value, UpdatedAt = GETDATE() WHERE Id = @id`);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/api/registry/:id', async (req, res) => {
    let pool;
    try {
        pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('UPDATE FireEquipmentRegistry SET IsActive = 0 WHERE Id = @id');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Copy equipment from one store to another
router.post('/api/registry/copy', async (req, res) => {
    const { sourceStoreId, targetStoreId } = req.body;
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await getPool();
        
        const result = await pool.request()
            .input('sourceStoreId', sql.Int, sourceStoreId)
            .input('targetStoreId', sql.Int, targetStoreId)
            .input('createdBy', sql.Int, user?.userId || 1)
            .query(`
                INSERT INTO FireEquipmentRegistry (StoreId, EquipmentTypeId, CustomTypeName, Location, Weight, SortOrder, CreatedBy)
                SELECT @targetStoreId, EquipmentTypeId, CustomTypeName, Location, Weight, SortOrder, @createdBy
                FROM FireEquipmentRegistry
                WHERE StoreId = @sourceStoreId AND IsActive = 1;
                
                SELECT @@ROWCOUNT as CopiedCount;
            `);
        
        res.json({ success: true, count: result.recordset[0].CopiedCount });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Import from Excel
// ==========================================
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    let pool;
    try {
        pool = await getPool();
        const user = req.currentUser;
        
        // Read Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        
        // Get all stores for matching
        const storesResult = await pool.request().query('SELECT Id, StoreName FROM Stores WHERE IsActive = 1');
        const storeMap = {};
        storesResult.recordset.forEach(s => {
            // Create variations for matching
            storeMap[s.StoreName.toLowerCase().trim()] = s.Id;
            storeMap[s.StoreName.toLowerCase().replace(/\s+/g, ' ').trim()] = s.Id;
        });
        
        // Get equipment types for matching
        const typesResult = await pool.request().query('SELECT Id, TypeName FROM FireEquipmentTypes');
        const typeMap = {};
        typesResult.recordset.forEach(t => {
            typeMap[t.TypeName.toLowerCase().trim()] = t.Id;
        });
        
        let totalImported = 0;
        let storesProcessed = 0;
        
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
            // Try to find matching store
            const cleanSheetName = sheetName.toLowerCase().replace(/spinneys\s*-?\s*/i, 'Spinneys ')
                .replace(/happy\s*-?\s*/i, 'Happy ')
                .replace(/gng\s*-?\s*/i, 'GNG ')
                .replace(/noknok\s*-?\s*/i, 'NokNok ')
                .replace(/\s+/g, ' ')
                .trim();
            
            let storeId = null;
            for (const [name, id] of Object.entries(storeMap)) {
                if (cleanSheetName.includes(name) || name.includes(cleanSheetName.replace(/^(spinneys|happy|gng|noknok)\s*-?\s*/i, ''))) {
                    storeId = id;
                    break;
                }
            }
            
            if (!storeId) {
                console.log('Could not match store for sheet:', sheetName);
                continue;
            }
            
            // Parse sheet data
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            // Find header row (contains "Fire Prevention Equipment" or "#")
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(data.length, 15); i++) {
                const row = data[i];
                if (row && row.some(cell => cell && cell.toString().toLowerCase().includes('fire prevention') || cell === '#')) {
                    headerRowIndex = i;
                    break;
                }
            }
            
            if (headerRowIndex === -1) continue;
            
            // Find column indices
            const headerRow = data[headerRowIndex];
            let colEquipment = -1, colLocation = -1, colWeight = -1;
            
            headerRow.forEach((cell, idx) => {
                const cellStr = (cell || '').toString().toLowerCase();
                if (cellStr.includes('fire prevention') || cellStr.includes('equipment type')) colEquipment = idx;
                if (cellStr.includes('location')) colLocation = idx;
                if (cellStr.includes('weight')) colWeight = idx;
            });
            
            // Default to common positions if not found
            if (colEquipment === -1) colEquipment = 1;
            if (colLocation === -1) colLocation = 2;
            if (colWeight === -1) colWeight = 3;
            
            // Delete existing registry for this store
            await pool.request()
                .input('storeId', sql.Int, storeId)
                .query('DELETE FROM FireEquipmentRegistry WHERE StoreId = @storeId');
            
            // Process equipment rows
            let sortOrder = 1;
            for (let i = headerRowIndex + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;
                
                const equipmentName = row[colEquipment]?.toString().trim();
                const location = row[colLocation]?.toString().trim();
                const weight = row[colWeight]?.toString().trim();
                
                // Skip empty rows or legend rows
                if (!equipmentName || !location) continue;
                if (equipmentName.toLowerCase().includes('checked and in good') || 
                    equipmentName.toLowerCase().includes('need maintenance') ||
                    equipmentName.toLowerCase().includes('not applicable')) continue;
                
                // Find equipment type ID
                const typeId = typeMap[equipmentName.toLowerCase().trim()] || null;
                
                await pool.request()
                    .input('storeId', sql.Int, storeId)
                    .input('equipmentTypeId', sql.Int, typeId)
                    .input('customTypeName', sql.NVarChar, typeId ? null : equipmentName)
                    .input('location', sql.NVarChar, location)
                    .input('weight', sql.NVarChar, weight || null)
                    .input('sortOrder', sql.Int, sortOrder++)
                    .input('createdBy', sql.Int, user?.userId || 1)
                    .query(`
                        INSERT INTO FireEquipmentRegistry (StoreId, EquipmentTypeId, CustomTypeName, Location, Weight, SortOrder, CreatedBy)
                        VALUES (@storeId, @equipmentTypeId, @customTypeName, @location, @weight, @sortOrder, @createdBy)
                    `);
                
                totalImported++;
            }
            
            if (sortOrder > 1) storesProcessed++;
        }
        
        res.json({ success: true, imported: totalImported, stores: storesProcessed });
    } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
