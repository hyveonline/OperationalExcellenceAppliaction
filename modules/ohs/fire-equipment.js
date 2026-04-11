/**
 * Fire Fighting Equipment Register
 * Part of OHS Module - Equipment inspection and compliance tracking
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const workflowEngine = require('../../services/workflow-engine');

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

// Shared connection pool
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

// Get brands for tabs
function getBrands() {
    return [
        { id: 'spinneys', name: 'Spinneys', icon: '🛒', color: '#e74c3c' },
        { id: 'happy', name: 'Happy', icon: '😊', color: '#f39c12' },
        { id: 'gng', name: 'GNG', icon: '🏪', color: '#27ae60' },
        { id: 'noknok', name: 'NokNok', icon: '📦', color: '#9b59b6' },
        { id: 'other', name: 'Other', icon: '🏢', color: '#3498db' }
    ];
}

// Common styles
const commonStyles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Segoe UI', Arial, sans-serif; 
        background: #f0f2f5;
        min-height: 100vh;
    }
    .header {
        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
        color: white;
        padding: 15px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 22px; display: flex; align-items: center; gap: 10px; }
    .header-nav { display: flex; gap: 15px; align-items: center; }
    .header-nav a, .header-nav button {
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 6px;
        background: rgba(255,255,255,0.15);
        border: none;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
    }
    .header-nav a:hover, .header-nav button:hover { background: rgba(255,255,255,0.25); }
    .container { padding: 20px; max-width: 100%; }
    
    /* Tabs */
    .tabs {
        display: flex;
        gap: 5px;
        margin-bottom: 0;
        background: white;
        padding: 10px 15px 0;
        border-radius: 8px 8px 0 0;
        border-bottom: 2px solid #e0e0e0;
        flex-wrap: wrap;
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
        transition: all 0.2s;
        margin-bottom: -2px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .tab:hover { background: #e8e8e8; }
    .tab.active {
        background: white;
        color: #d63031;
        border-color: #e0e0e0;
        border-bottom: 2px solid white;
    }
    
    .tab-content {
        display: none;
        background: white;
        padding: 20px;
        border-radius: 0 0 8px 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .tab-content.active { display: block; }
    
    /* Toolbar */
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
        transition: all 0.2s;
    }
    .btn-primary { background: #d63031; color: white; }
    .btn-primary:hover { background: #c0392b; }
    .btn-success { background: #27ae60; color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-secondary { background: #95a5a6; color: white; }
    .btn-secondary:hover { background: #7f8c8d; }
    
    /* Table */
    .table-wrapper {
        overflow-x: auto;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
    }
    table {
        border-collapse: collapse;
        width: 100%;
        min-width: 1000px;
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
        color: #333;
        position: sticky;
        top: 0;
        z-index: 10;
    }
    th.check-col { 
        text-align: center; 
        background: #e8f5e9;
        min-width: 80px;
    }
    tr:hover { background: #f5f8ff; }
    
    /* Inspection cells */
    .check-cell {
        text-align: center;
    }
    .check-cell select {
        padding: 5px 8px;
        border-radius: 4px;
        border: 1px solid #ddd;
        font-size: 13px;
        width: 60px;
        text-align: center;
    }
    .check-cell select.yes { background: #d4edda; border-color: #28a745; }
    .check-cell select.no { background: #f8d7da; border-color: #dc3545; }
    .check-cell select.na { background: #e2e3e5; border-color: #6c757d; }
    
    /* Status badges */
    .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
    }
    .status-draft { background: #fff3cd; color: #856404; }
    .status-submitted { background: #cce5ff; color: #004085; }
    .status-approved { background: #d4edda; color: #155724; }
    
    /* Cards */
    .stats-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }
    .stat-card {
        background: white;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        border-left: 4px solid #d63031;
    }
    .stat-card .number { font-size: 28px; font-weight: 700; color: #333; }
    .stat-card .label { color: #666; font-size: 13px; margin-top: 5px; }
    
    /* Modal */
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
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .modal h3 { margin-bottom: 20px; color: #333; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #333; }
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
    
    /* Toast */
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
    
    /* Empty state */
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #666;
    }
    .empty-state .icon { font-size: 60px; margin-bottom: 20px; opacity: 0.5; }
`;

// ==========================================
// MAIN LANDING PAGE - List Inspections
// ==========================================
router.get('/', async (req, res) => {
    const user = req.currentUser;
    const brands = getBrands();
    
    let pool;
    try {
        pool = await getPool();
        
        // Get recent inspections
        const inspectionsResult = await pool.request().query(`
            SELECT TOP 50 
                i.Id, i.InspectionDate, i.Status, i.InspectorName, i.CreatedAt,
                s.StoreName, ISNULL(b.BrandName, 'Other') as Brand
            FROM FireEquipmentInspections i
            JOIN Stores s ON i.StoreId = s.Id
            LEFT JOIN Brands b ON s.BrandId = b.Id
            ORDER BY i.CreatedAt DESC
        `);
        
        // Get stores for dropdown
        const storesResult = await pool.request().query(`
            SELECT s.Id, s.StoreName, ISNULL(b.BrandName, 'Other') as Brand 
            FROM Stores s 
            LEFT JOIN Brands b ON s.BrandId = b.Id 
            WHERE s.IsActive = 1 
            ORDER BY b.BrandName, s.StoreName
        `);
        
        // Group stores by brand
        const storesByBrand = {};
        storesResult.recordset.forEach(store => {
            const brand = store.Brand || 'Other';
            if (!storesByBrand[brand]) storesByBrand[brand] = [];
            storesByBrand[brand].push(store);
        });
        
        // Stats
        const statsResult = await pool.request().query(`
            SELECT 
                COUNT(*) as TotalInspections,
                SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as Drafts,
                SUM(CASE WHEN Status = 'Submitted' THEN 1 ELSE 0 END) as Submitted,
                SUM(CASE WHEN CAST(InspectionDate as DATE) >= DATEADD(month, -1, GETDATE()) THEN 1 ELSE 0 END) as LastMonth
            FROM FireEquipmentInspections
        `);
        const stats = statsResult.recordset[0] || { TotalInspections: 0, Drafts: 0, Submitted: 0, LastMonth: 0 };
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Fire Equipment Register - ${process.env.APP_NAME || 'OE App'}</title>
                <style>${commonStyles}</style>
            </head>
            <body>
                <div class="header">
                    <h1>🧯 Fire Fighting Equipment Register</h1>
                    <div class="header-nav">
                        <a href="/ohs">🦺 OHS Home</a>
                        <a href="/">🏠 Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="stats-row">
                        <div class="stat-card" style="border-color: #3498db;">
                            <div class="number">${stats.TotalInspections}</div>
                            <div class="label">Total Inspections</div>
                        </div>
                        <div class="stat-card" style="border-color: #f39c12;">
                            <div class="number">${stats.Drafts}</div>
                            <div class="label">Draft Inspections</div>
                        </div>
                        <div class="stat-card" style="border-color: #27ae60;">
                            <div class="number">${stats.Submitted}</div>
                            <div class="label">Submitted</div>
                        </div>
                        <div class="stat-card" style="border-color: #9b59b6;">
                            <div class="number">${stats.LastMonth}</div>
                            <div class="label">Last 30 Days</div>
                        </div>
                    </div>
                    
                    <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <div class="toolbar">
                            <button class="btn-primary" onclick="showNewInspectionModal()">➕ New Inspection</button>
                            <select id="filterBrand" onchange="filterInspections()" style="min-width: 150px;">
                                <option value="">All Brands</option>
                                ${brands.map(b => `<option value="${b.name}">${b.icon} ${b.name}</option>`).join('')}
                            </select>
                            <select id="filterStatus" onchange="filterInspections()" style="min-width: 150px;">
                                <option value="">All Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Approved">Approved</option>
                            </select>
                        </div>
                        
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Brand</th>
                                        <th>Store</th>
                                        <th>Inspector</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="inspectionsTable">
                                    ${inspectionsResult.recordset.length === 0 ? `
                                        <tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                                            No inspections yet. Click "New Inspection" to create one.
                                        </td></tr>
                                    ` : inspectionsResult.recordset.map(insp => `
                                        <tr data-brand="${insp.Brand || ''}" data-status="${insp.Status}">
                                            <td>${new Date(insp.InspectionDate).toLocaleDateString('en-GB')}</td>
                                            <td>${insp.Brand || '-'}</td>
                                            <td>${insp.StoreName}</td>
                                            <td>${insp.InspectorName || '-'}</td>
                                            <td><span class="status-badge status-${insp.Status.toLowerCase()}">${insp.Status}</span></td>
                                            <td>
                                                <a href="/ohs/fire-equipment/inspection/${insp.Id}" class="btn-primary" style="padding: 5px 10px; text-decoration: none; display: inline-block; font-size: 12px;">
                                                    ${insp.Status === 'Draft' ? '✏️ Edit' : '👁️ View'}
                                                </a>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- New Inspection Modal -->
                <div class="modal" id="newInspectionModal">
                    <div class="modal-content">
                        <h3>🧯 New Fire Equipment Inspection</h3>
                        <form id="newInspectionForm" onsubmit="createInspection(event)">
                            <div class="form-group">
                                <label>Brand *</label>
                                <select id="newBrand" required onchange="loadStoresForBrand(this.value)">
                                    <option value="">Select Brand</option>
                                    ${brands.map(b => `<option value="${b.name}">${b.icon} ${b.name}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Store *</label>
                                <select id="newStore" required disabled>
                                    <option value="">Select Brand First</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Inspection Date *</label>
                                <input type="date" id="newDate" required value="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label>Inspector Name</label>
                                <input type="text" id="newInspector" value="${user?.displayName || ''}">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" onclick="closeModal('newInspectionModal')">Cancel</button>
                                <button type="submit" class="btn-primary">Create & Start Inspection</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    const storesByBrand = ${JSON.stringify(storesByBrand)};
                    
                    function showNewInspectionModal() {
                        document.getElementById('newInspectionModal').classList.add('active');
                    }
                    
                    function closeModal(id) {
                        document.getElementById(id).classList.remove('active');
                    }
                    
                    function loadStoresForBrand(brand) {
                        const storeSelect = document.getElementById('newStore');
                        const stores = storesByBrand[brand] || [];
                        
                        if (stores.length === 0) {
                            storeSelect.innerHTML = '<option value="">No stores found</option>';
                            storeSelect.disabled = true;
                            return;
                        }
                        
                        storeSelect.innerHTML = '<option value="">Select Store</option>' + 
                            stores.map(s => '<option value="' + s.Id + '">' + s.StoreName + '</option>').join('');
                        storeSelect.disabled = false;
                    }
                    
                    async function createInspection(e) {
                        e.preventDefault();
                        
                        const data = {
                            storeId: document.getElementById('newStore').value,
                            inspectionDate: document.getElementById('newDate').value,
                            inspectorName: document.getElementById('newInspector').value
                        };
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/api/inspection', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                window.location.href = '/ohs/fire-equipment/inspection/' + result.inspectionId;
                            } else {
                                showToast(result.error || 'Failed to create inspection', 'error');
                            }
                        } catch (err) {
                            showToast('Error creating inspection', 'error');
                        }
                    }
                    
                    function filterInspections() {
                        const brand = document.getElementById('filterBrand').value;
                        const status = document.getElementById('filterStatus').value;
                        
                        document.querySelectorAll('#inspectionsTable tr').forEach(row => {
                            const rowBrand = row.dataset.brand || '';
                            const rowStatus = row.dataset.status || '';
                            
                            const matchBrand = !brand || rowBrand === brand;
                            const matchStatus = !status || rowStatus === status;
                            
                            row.style.display = (matchBrand && matchStatus) ? '' : 'none';
                        });
                    }
                    
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
        console.error('Fire Equipment error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// API: Create new inspection
// ==========================================
router.post('/api/inspection', async (req, res) => {
    const user = req.currentUser;
    const { storeId, inspectionDate, inspectorName } = req.body;
    
    let pool;
    try {
        pool = await getPool();
        
        // Create inspection header
        const result = await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('inspectionDate', sql.Date, inspectionDate)
            .input('inspectedBy', sql.Int, user?.userId || 1)
            .input('inspectorName', sql.NVarChar, inspectorName || user?.displayName)
            .query(`
                INSERT INTO FireEquipmentInspections (StoreId, InspectionDate, InspectedBy, InspectorName, Status)
                OUTPUT INSERTED.Id
                VALUES (@storeId, @inspectionDate, @inspectedBy, @inspectorName, 'Draft')
            `);
        
        const inspectionId = result.recordset[0].Id;
        
        // Copy predefined equipment from registry to inspection details
        await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .input('storeId', sql.Int, storeId)
            .query(`
                INSERT INTO FireEquipmentInspectionDetails 
                    (InspectionId, RegistryId, EquipmentType, Location, Weight, SortOrder)
                SELECT 
                    @inspectionId,
                    r.Id,
                    COALESCE(t.TypeName, r.CustomTypeName),
                    r.Location,
                    COALESCE(r.Weight, t.DefaultWeight),
                    r.SortOrder
                FROM FireEquipmentRegistry r
                LEFT JOIN FireEquipmentTypes t ON r.EquipmentTypeId = t.Id
                WHERE r.StoreId = @storeId AND r.IsActive = 1
                ORDER BY r.SortOrder
            `);
        
        res.json({ success: true, inspectionId });
    } catch (err) {
        console.error('Create inspection error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// INSPECTION FORM PAGE - Excel-like grid
// ==========================================
router.get('/inspection/:id', async (req, res) => {
    const user = req.currentUser;
    const inspectionId = req.params.id;
    
    let pool;
    try {
        pool = await getPool();
        
        // Get inspection header
        const inspResult = await pool.request()
            .input('id', sql.Int, inspectionId)
            .query(`
                SELECT i.*, s.StoreName, ISNULL(b.BrandName, 'Other') as Brand
                FROM FireEquipmentInspections i
                JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @id
            `);
        
        if (inspResult.recordset.length === 0) {
            return res.status(404).send('Inspection not found');
        }
        
        const inspection = inspResult.recordset[0];
        const isEditable = inspection.Status === 'Draft';
        
        // Get inspection details
        const detailsResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query(`
                SELECT * FROM FireEquipmentInspectionDetails
                WHERE InspectionId = @inspectionId
                ORDER BY SortOrder, Id
            `);
        
        // Get equipment types for adding new
        const typesResult = await pool.request().query(`
            SELECT Id, TypeName, DefaultWeight FROM FireEquipmentTypes WHERE IsActive = 1 ORDER BY SortOrder
        `);
        
        const details = detailsResult.recordset;
        const equipmentTypes = typesResult.recordset;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Inspection - ${inspection.StoreName} - Fire Equipment</title>
                <style>
                    ${commonStyles}
                    
                    .inspection-header {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                    }
                    .inspection-header .field {
                        display: flex;
                        flex-direction: column;
                    }
                    .inspection-header .field label {
                        font-size: 12px;
                        color: #666;
                        margin-bottom: 4px;
                    }
                    .inspection-header .field .value {
                        font-size: 16px;
                        font-weight: 500;
                        color: #333;
                    }
                    
                    .legend {
                        background: white;
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        display: flex;
                        gap: 30px;
                        flex-wrap: wrap;
                        align-items: center;
                    }
                    .legend-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 13px;
                    }
                    .legend-box {
                        width: 30px;
                        height: 24px;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 600;
                        font-size: 12px;
                    }
                    .legend-box.yes { background: #d4edda; color: #155724; }
                    .legend-box.no { background: #f8d7da; color: #721c24; }
                    .legend-box.na { background: #e2e3e5; color: #383d41; }
                    
                    .row-number {
                        background: #f0f0f0;
                        text-align: center;
                        font-weight: 500;
                        color: #666;
                        width: 40px;
                    }
                    
                    td input[type="text"], td input[type="date"] {
                        width: 100%;
                        padding: 6px 8px;
                        border: 1px solid transparent;
                        background: transparent;
                        font-size: 13px;
                        border-radius: 4px;
                    }
                    td input:focus {
                        border-color: #d63031;
                        outline: none;
                        background: white;
                    }
                    td input:hover {
                        border-color: #ddd;
                    }
                    
                    .action-buttons {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        display: flex;
                        gap: 10px;
                        z-index: 100;
                    }
                    .action-buttons button {
                        padding: 12px 24px;
                        font-size: 14px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧯 Fire Equipment Inspection</h1>
                    <div class="header-nav">
                        <a href="/ohs/fire-equipment">← Back to List</a>
                        <a href="/ohs">🦺 OHS</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="inspection-header">
                        <div class="field">
                            <label>Store</label>
                            <div class="value">${inspection.StoreName}</div>
                        </div>
                        <div class="field">
                            <label>Brand</label>
                            <div class="value">${inspection.Brand || '-'}</div>
                        </div>
                        <div class="field">
                            <label>Inspection Date</label>
                            <div class="value">${new Date(inspection.InspectionDate).toLocaleDateString('en-GB', { dateStyle: 'long' })}</div>
                        </div>
                        <div class="field">
                            <label>Inspector</label>
                            <div class="value">${inspection.InspectorName || '-'}</div>
                        </div>
                        <div class="field">
                            <label>Status</label>
                            <div class="value"><span class="status-badge status-${inspection.Status.toLowerCase()}">${inspection.Status}</span></div>
                        </div>
                    </div>
                    
                    <div class="legend">
                        <strong>Legend:</strong>
                        <div class="legend-item">
                            <div class="legend-box yes">Y</div>
                            <span>Checked and in good condition</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-box no">N</div>
                            <span>Needs maintenance</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-box na">N/A</div>
                            <span>Not Applicable</span>
                        </div>
                    </div>
                    
                    ${isEditable ? `
                    <div class="toolbar" style="background: white; padding: 15px; border-radius: 8px 8px 0 0;">
                        <button class="btn-success" onclick="showAddEquipmentModal()">➕ Add Equipment</button>
                        <span style="color: #666; font-size: 13px;">Click on cells to edit values</span>
                    </div>
                    ` : ''}
                    
                    <div class="table-wrapper" style="border-radius: ${isEditable ? '0 0 8px 8px' : '8px'};">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 40px;">#</th>
                                    <th style="min-width: 200px;">Fire Prevention Equipment</th>
                                    <th style="min-width: 180px;">Location</th>
                                    <th style="width: 80px;">Weight</th>
                                    <th class="check-col">Cleanliness</th>
                                    <th class="check-col">Cylinder Integrity</th>
                                    <th class="check-col">Pressure Gauge</th>
                                    <th class="check-col">Hose Condition</th>
                                    <th style="width: 120px;">Last Inspection</th>
                                    <th style="min-width: 150px;">Remarks</th>
                                    ${isEditable ? '<th style="width: 60px;">Actions</th>' : ''}
                                </tr>
                            </thead>
                            <tbody id="equipmentTable">
                                ${details.length === 0 ? `
                                    <tr id="emptyRow"><td colspan="${isEditable ? 11 : 10}" style="text-align: center; padding: 40px; color: #666;">
                                        No equipment defined for this store. ${isEditable ? 'Click "Add Equipment" to add items.' : ''}
                                    </td></tr>
                                ` : details.map((item, idx) => `
                                    <tr data-id="${item.Id}">
                                        <td class="row-number">${idx + 1}</td>
                                        <td>${isEditable ? `<input type="text" value="${item.EquipmentType || ''}" onchange="updateField(${item.Id}, 'EquipmentType', this.value)">` : (item.EquipmentType || '-')}</td>
                                        <td>${isEditable ? `<input type="text" value="${item.Location || ''}" onchange="updateField(${item.Id}, 'Location', this.value)">` : (item.Location || '-')}</td>
                                        <td>${isEditable ? `<input type="text" value="${item.Weight || ''}" onchange="updateField(${item.Id}, 'Weight', this.value)" style="width: 60px;">` : (item.Weight || '-')}</td>
                                        <td class="check-cell">${createCheckSelect(item.Id, 'Cleanliness', item.Cleanliness, isEditable)}</td>
                                        <td class="check-cell">${createCheckSelect(item.Id, 'CylinderIntegrity', item.CylinderIntegrity, isEditable)}</td>
                                        <td class="check-cell">${createCheckSelect(item.Id, 'PressureGauge', item.PressureGauge, isEditable)}</td>
                                        <td class="check-cell">${createCheckSelect(item.Id, 'HoseCondition', item.HoseCondition, isEditable)}</td>
                                        <td>${isEditable ? `<input type="date" value="${item.LastInspectionDate ? new Date(item.LastInspectionDate).toISOString().split('T')[0] : ''}" onchange="updateField(${item.Id}, 'LastInspectionDate', this.value)">` : (item.LastInspectionDate ? new Date(item.LastInspectionDate).toLocaleDateString('en-GB') : '-')}</td>
                                        <td>${isEditable ? `<input type="text" value="${item.Remarks || ''}" onchange="updateField(${item.Id}, 'Remarks', this.value)">` : (item.Remarks || '-')}</td>
                                        ${isEditable ? `<td style="text-align: center;"><button onclick="deleteRow(${item.Id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">🗑️</button></td>` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    ${isEditable ? `
                    <div class="action-buttons">
                        <button class="btn-secondary" onclick="saveDraft()">💾 Save Draft</button>
                        <button class="btn-primary" onclick="submitInspection()">✅ Submit Inspection</button>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Add Equipment Modal -->
                <div class="modal" id="addEquipmentModal">
                    <div class="modal-content">
                        <h3>➕ Add Equipment</h3>
                        <form id="addEquipmentForm" onsubmit="addEquipment(event)">
                            <div class="form-group">
                                <label>Equipment Type *</label>
                                <select id="eqType" required>
                                    <option value="">Select Type</option>
                                    ${equipmentTypes.map(t => `<option value="${t.TypeName}" data-weight="${t.DefaultWeight}">${t.TypeName}</option>`).join('')}
                                    <option value="__custom__">-- Custom Type --</option>
                                </select>
                            </div>
                            <div class="form-group" id="customTypeGroup" style="display: none;">
                                <label>Custom Type Name *</label>
                                <input type="text" id="eqCustomType">
                            </div>
                            <div class="form-group">
                                <label>Location *</label>
                                <input type="text" id="eqLocation" required placeholder="e.g., Backdoor, Store entrance">
                            </div>
                            <div class="form-group">
                                <label>Weight</label>
                                <input type="text" id="eqWeight" placeholder="e.g., 6kg">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn-secondary" onclick="closeModal('addEquipmentModal')">Cancel</button>
                                <button type="submit" class="btn-success">Add Equipment</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    const inspectionId = ${inspectionId};
                    let rowCount = ${details.length};
                    
                    // Show/hide custom type input
                    document.getElementById('eqType').addEventListener('change', function() {
                        const customGroup = document.getElementById('customTypeGroup');
                        const weightInput = document.getElementById('eqWeight');
                        
                        if (this.value === '__custom__') {
                            customGroup.style.display = 'block';
                            document.getElementById('eqCustomType').required = true;
                        } else {
                            customGroup.style.display = 'none';
                            document.getElementById('eqCustomType').required = false;
                            // Auto-fill weight
                            const option = this.options[this.selectedIndex];
                            if (option.dataset.weight) {
                                weightInput.value = option.dataset.weight;
                            }
                        }
                    });
                    
                    function showAddEquipmentModal() {
                        document.getElementById('addEquipmentModal').classList.add('active');
                    }
                    
                    function closeModal(id) {
                        document.getElementById(id).classList.remove('active');
                    }
                    
                    async function addEquipment(e) {
                        e.preventDefault();
                        
                        const typeSelect = document.getElementById('eqType');
                        const equipmentType = typeSelect.value === '__custom__' 
                            ? document.getElementById('eqCustomType').value 
                            : typeSelect.value;
                        
                        const data = {
                            inspectionId: inspectionId,
                            equipmentType: equipmentType,
                            location: document.getElementById('eqLocation').value,
                            weight: document.getElementById('eqWeight').value
                        };
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/api/inspection/detail', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                showToast('Equipment added', 'success');
                                setTimeout(() => location.reload(), 500);
                            } else {
                                showToast(result.error || 'Failed to add', 'error');
                            }
                        } catch (err) {
                            showToast('Error adding equipment', 'error');
                        }
                    }
                    
                    async function updateField(detailId, field, value) {
                        try {
                            const res = await fetch('/ohs/fire-equipment/api/inspection/detail/' + detailId, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ field, value })
                            });
                            const result = await res.json();
                            
                            if (!result.success) {
                                showToast('Failed to update', 'error');
                            }
                        } catch (err) {
                            showToast('Error updating', 'error');
                        }
                    }
                    
                    function updateCheckStyle(selectEl) {
                        selectEl.className = '';
                        if (selectEl.value === 'Y') selectEl.className = 'yes';
                        else if (selectEl.value === 'N') selectEl.className = 'no';
                        else if (selectEl.value === 'N/A') selectEl.className = 'na';
                    }
                    
                    async function deleteRow(detailId) {
                        if (!confirm('Delete this equipment row?')) return;
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/api/inspection/detail/' + detailId, {
                                method: 'DELETE'
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                document.querySelector('tr[data-id="' + detailId + '"]').remove();
                                showToast('Deleted', 'success');
                            }
                        } catch (err) {
                            showToast('Error deleting', 'error');
                        }
                    }
                    
                    async function saveDraft() {
                        showToast('Draft saved', 'success');
                    }
                    
                    async function submitInspection() {
                        if (!confirm('Submit this inspection? Once submitted, it cannot be edited.')) return;
                        
                        try {
                            const res = await fetch('/ohs/fire-equipment/api/inspection/' + inspectionId + '/submit', {
                                method: 'POST'
                            });
                            const result = await res.json();
                            
                            if (result.success) {
                                showToast('Inspection submitted!', 'success');
                                setTimeout(() => location.reload(), 1000);
                            } else {
                                showToast(result.error || 'Failed to submit', 'error');
                            }
                        } catch (err) {
                            showToast('Error submitting', 'error');
                        }
                    }
                    
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
        
        function createCheckSelect(id, field, value, editable) {
            if (!editable) {
                if (value === 'Y') return '<span style="color: #155724; font-weight: 600;">Y</span>';
                if (value === 'N') return '<span style="color: #721c24; font-weight: 600;">N</span>';
                if (value === 'N/A') return '<span style="color: #383d41;">N/A</span>';
                return '-';
            }
            
            const cls = value === 'Y' ? 'yes' : value === 'N' ? 'no' : value === 'N/A' ? 'na' : '';
            return `
                <select class="${cls}" onchange="updateField(${id}, '${field}', this.value); updateCheckStyle(this);">
                    <option value="">-</option>
                    <option value="Y" ${value === 'Y' ? 'selected' : ''}>Y</option>
                    <option value="N" ${value === 'N' ? 'selected' : ''}>N</option>
                    <option value="N/A" ${value === 'N/A' ? 'selected' : ''}>N/A</option>
                </select>
            `;
        }
        
    } catch (err) {
        console.error('Inspection page error:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// ==========================================
// API: Add detail to inspection
// ==========================================
router.post('/api/inspection/detail', async (req, res) => {
    const { inspectionId, equipmentType, location, weight } = req.body;
    
    let pool;
    try {
        pool = await getPool();
        
        // Get max sort order
        const maxResult = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .query('SELECT ISNULL(MAX(SortOrder), 0) + 1 as NextOrder FROM FireEquipmentInspectionDetails WHERE InspectionId = @inspectionId');
        
        const sortOrder = maxResult.recordset[0].NextOrder;
        
        const result = await pool.request()
            .input('inspectionId', sql.Int, inspectionId)
            .input('equipmentType', sql.NVarChar, equipmentType)
            .input('location', sql.NVarChar, location)
            .input('weight', sql.NVarChar, weight)
            .input('sortOrder', sql.Int, sortOrder)
            .query(`
                INSERT INTO FireEquipmentInspectionDetails (InspectionId, EquipmentType, Location, Weight, SortOrder)
                OUTPUT INSERTED.Id
                VALUES (@inspectionId, @equipmentType, @location, @weight, @sortOrder)
            `);
        
        res.json({ success: true, detailId: result.recordset[0].Id });
    } catch (err) {
        console.error('Add detail error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Update detail field
// ==========================================
router.put('/api/inspection/detail/:id', async (req, res) => {
    const detailId = req.params.id;
    const { field, value } = req.body;
    
    // Whitelist allowed fields
    const allowedFields = ['EquipmentType', 'Location', 'Weight', 'Cleanliness', 'CylinderIntegrity', 'PressureGauge', 'HoseCondition', 'LastInspectionDate', 'Remarks'];
    
    if (!allowedFields.includes(field)) {
        return res.status(400).json({ success: false, error: 'Invalid field' });
    }
    
    let pool;
    try {
        pool = await getPool();
        
        const sqlType = field === 'LastInspectionDate' ? sql.Date : sql.NVarChar;
        const sqlValue = field === 'LastInspectionDate' && value ? new Date(value) : value;
        
        await pool.request()
            .input('id', sql.Int, detailId)
            .input('value', sqlType, sqlValue || null)
            .query(`UPDATE FireEquipmentInspectionDetails SET ${field} = @value WHERE Id = @id`);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Update detail error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Delete detail
// ==========================================
router.delete('/api/inspection/detail/:id', async (req, res) => {
    const detailId = req.params.id;
    
    let pool;
    try {
        pool = await getPool();
        
        await pool.request()
            .input('id', sql.Int, detailId)
            .query('DELETE FROM FireEquipmentInspectionDetails WHERE Id = @id');
        
        res.json({ success: true });
    } catch (err) {
        console.error('Delete detail error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// API: Submit inspection
// ==========================================
router.post('/api/inspection/:id/submit', async (req, res) => {
    const inspectionId = req.params.id;
    
    let pool;
    try {
        pool = await getPool();
        
        await pool.request()
            .input('id', sql.Int, inspectionId)
            .query(`
                UPDATE FireEquipmentInspections 
                SET Status = 'Submitted', SubmittedAt = GETDATE()
                WHERE Id = @id
            `);
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'FIRE_EQUIPMENT',
            recordId: parseInt(inspectionId),
            recordTable: 'FireEquipmentInspections',
            submitter: { userId: req.currentUser?.userId, email: req.currentUser?.email || req.currentUser?.mail, name: req.currentUser?.displayName },
            store: {},
            metaData: {},
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Fire equipment error:', err));
        
        res.json({ success: true });
    } catch (err) {
        console.error('Submit inspection error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
