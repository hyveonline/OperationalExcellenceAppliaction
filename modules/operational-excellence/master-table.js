/**
 * Master Table - Third Party Staff Management
 * Excel-like interface with 4 tabs: Security, Valet, Cleaning, Helpers
 * Manual month addition with Count, Salary, Total Cost per month
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const XLSX = require('xlsx');
const path = require('path');

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
    if (pool && pool.connected) {
        return pool;
    }
    if (pool && !pool.connected) {
        poolPromise = null;
        pool = null;
    }
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            console.log('Master Table: Connected to SQL Server');
            pool = newPool;
            pool.on('error', err => {
                console.error('Master Table Pool Error:', err);
                poolPromise = null;
                pool = null;
            });
            return pool;
        }).catch(err => {
            console.error('Master Table: Database connection failed:', err);
            poolPromise = null;
            pool = null;
            throw err;
        });
    }
    return poolPromise;
}

// GET - Main page with Excel-like interface
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Master Table - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: #f0f2f5;
                    min-height: 100vh;
                }
                .header {
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
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
                }
                .tab:hover { background: #e8e8e8; }
                .tab.active {
                    background: white;
                    color: #1e3c72;
                    border-color: #e0e0e0;
                    border-bottom: 2px solid white;
                }
                
                /* Tab content */
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
                .btn-add { background: #4CAF50; color: white; }
                .btn-add:hover { background: #43a047; }
                .btn-month { background: #2196F3; color: white; }
                .btn-month:hover { background: #1e88e5; }
                .btn-save { background: #ff9800; color: white; }
                .btn-save:hover { background: #f57c00; }
                .btn-export { background: #9c27b0; color: white; }
                .btn-export:hover { background: #7b1fa2; }
                
                .year-select {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                }
                
                /* Table */
                .table-wrapper {
                    overflow-x: auto;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    min-width: 800px;
                    font-size: 13px;
                    table-layout: auto;
                }
                th, td {
                    border: 1px solid #e0e0e0;
                    padding: 8px 10px;
                    text-align: left;
                    white-space: nowrap;
                }
                th {
                    background: #f8f9fa;
                    font-weight: 600;
                    color: #333;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .month-header {
                    background: #e3f2fd !important;
                    text-align: center;
                    color: #1565c0;
                }
                .month-subheader {
                    background: #f5f5f5 !important;
                    font-size: 11px;
                    text-align: center;
                }
                tr:hover { background: #f5f8ff; }
                tr.new-row { background: #e8f5e9; }
                tr.modified { background: #fff8e1; }
                tr.deleted { background: #ffebee; opacity: 0.6; }
                
                /* Editable cells */
                td input, td select {
                    width: 100%;
                    padding: 4px 6px;
                    border: 1px solid transparent;
                    background: transparent;
                    font-size: 13px;
                    border-radius: 3px;
                }
                td input:focus, td select:focus {
                    border-color: #2196F3;
                    outline: none;
                    background: white;
                }
                td input:hover, td select:hover {
                    border-color: #ddd;
                }
                td input[type="number"] {
                    text-align: right;
                }
                .total-cost {
                    background: #f0f0f0;
                    font-weight: 500;
                    text-align: right;
                    color: #1565c0;
                }
                
                /* Action buttons */
                .row-actions {
                    display: flex;
                    gap: 5px;
                }
                .row-actions button {
                    padding: 4px 8px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .btn-delete-row { background: #f44336; color: white; }
                .btn-delete-row:hover { background: #d32f2f; }
                .btn-restore-row { background: #4CAF50; color: white; }
                .btn-restore-row:hover { background: #388e3c; }
                
                /* Notifications */
                .notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    padding: 15px 25px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 1000;
                    animation: slideIn 0.3s ease;
                }
                .notification.success { background: #4CAF50; }
                .notification.error { background: #f44336; }
                @keyframes slideIn {
                    from { transform: translateX(100px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                /* Loading */
                .loading {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255,255,255,0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 2000;
                }
                .loading.hidden { display: none; }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #1e3c72;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
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
                    min-width: 300px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .modal h3 { margin-bottom: 20px; color: #333; }
                .modal-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                .modal button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .btn-confirm { background: #4CAF50; color: white; }
                .btn-cancel { background: #f5f5f5; color: #333; }
                
                /* Summary row */
                .summary-row {
                    background: #e8f5e9 !important;
                    font-weight: 600;
                }
                .summary-row td {
                    border-top: 2px solid #4CAF50;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 Master Table - Third Party Staff</h1>
                <div class="header-nav">
                    <span>Welcome, ${user ? (user.displayName || user.name || user.email || 'User') : 'User'}</span>
                    <a href="/dashboard">🏠 Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="tabs">
                    <div class="tab active" data-tab="Security">🛡️ Security</div>
                    <div class="tab" data-tab="Valet">🚗 Valet</div>
                    <div class="tab" data-tab="Cleaning">🧹 Cleaning</div>
                    <div class="tab" data-tab="Helpers">👷 Helpers</div>
                </div>
                
                <!-- Security Tab -->
                <div class="tab-content active" id="tab-Security">
                    <div class="toolbar">
                        <button class="btn-add" onclick="addRow('Security')">➕ Add Row</button>
                        <button class="btn-month" onclick="addMonth('Security')">📅 Add Month</button>
                        <button class="btn-save" onclick="saveAll('Security')">💾 Save All</button>
                        <button class="btn-export" onclick="exportToExcel('Security')">📥 Export</button>
                        <button class="btn-import" onclick="importFromExcel('Security')" style="background:#e91e63;color:white;">📤 Import from Excel</button>
                        <select class="year-select" id="year-Security" onchange="loadData('Security')">
                            ${generateYearOptions()}
                        </select>
                    </div>
                    <div class="table-wrapper">
                        <table id="table-Security">
                            <thead></thead>
                            <tbody></tbody>
                            <tfoot></tfoot>
                        </table>
                    </div>
                </div>
                
                <!-- Valet Tab -->
                <div class="tab-content" id="tab-Valet">
                    <div class="toolbar">
                        <button class="btn-add" onclick="addRow('Valet')">➕ Add Row</button>
                        <button class="btn-month" onclick="addMonth('Valet')">📅 Add Month</button>
                        <button class="btn-save" onclick="saveAll('Valet')">💾 Save All</button>
                        <button class="btn-export" onclick="exportToExcel('Valet')">📥 Export</button>
                        <button class="btn-import" onclick="importFromExcel('Valet')" style="background:#e91e63;color:white;">📤 Import from Excel</button>
                        <select class="year-select" id="year-Valet" onchange="loadData('Valet')">
                            ${generateYearOptions()}
                        </select>
                    </div>
                    <div class="table-wrapper">
                        <table id="table-Valet">
                            <thead></thead>
                            <tbody></tbody>
                            <tfoot></tfoot>
                        </table>
                    </div>
                </div>
                
                <!-- Cleaning Tab -->
                <div class="tab-content" id="tab-Cleaning">
                    <div class="toolbar">
                        <button class="btn-add" onclick="addRow('Cleaning')">➕ Add Row</button>
                        <button class="btn-month" onclick="addMonth('Cleaning')">📅 Add Month</button>
                        <button class="btn-save" onclick="saveAll('Cleaning')">💾 Save All</button>
                        <button class="btn-export" onclick="exportToExcel('Cleaning')">📥 Export</button>
                        <button class="btn-import" onclick="importFromExcel('Cleaning')" style="background:#e91e63;color:white;">📤 Import from Excel</button>
                        <select class="year-select" id="year-Cleaning" onchange="loadData('Cleaning')">
                            ${generateYearOptions()}
                        </select>
                    </div>
                    <div class="table-wrapper">
                        <table id="table-Cleaning">
                            <thead></thead>
                            <tbody></tbody>
                            <tfoot></tfoot>
                        </table>
                    </div>
                </div>
                
                <!-- Helpers Tab -->
                <div class="tab-content" id="tab-Helpers">
                    <div class="toolbar">
                        <button class="btn-add" onclick="addRow('Helpers')">➕ Add Row</button>
                        <button class="btn-month" onclick="addMonth('Helpers')">📅 Add Month</button>
                        <button class="btn-save" onclick="saveAll('Helpers')">💾 Save All</button>
                        <button class="btn-export" onclick="exportToExcel('Helpers')">📥 Export</button>
                        <button class="btn-import" onclick="importFromExcel('Helpers')" style="background:#e91e63;color:white;">📤 Import from Excel</button>
                        <select class="year-select" id="year-Helpers" onchange="loadData('Helpers')">
                            ${generateYearOptions()}
                        </select>
                    </div>
                    <div class="table-wrapper">
                        <table id="table-Helpers">
                            <thead></thead>
                            <tbody></tbody>
                            <tfoot></tfoot>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="loading hidden" id="loading">
                <div class="spinner"></div>
            </div>
            
            <!-- Add Month Modal -->
            <div class="modal" id="monthModal">
                <div class="modal-content">
                    <h3>📅 Add Month</h3>
                    <p>Select the month to add:</p>
                    <select id="monthSelect" style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 6px; border: 1px solid #ddd;">
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                    </select>
                    <div class="modal-actions">
                        <button class="btn-cancel" onclick="closeMonthModal()">Cancel</button>
                        <button class="btn-confirm" onclick="confirmAddMonth()">Add Month</button>
                    </div>
                </div>
            </div>
            
            <script>
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                    'July', 'August', 'September', 'October', 'November', 'December'];
                
                // Base columns for each category
                const baseColumns = {
                    'Security': ['Code', 'Scheme', 'Branch', 'Company', 'Role', 'Shifts', 'Remarks'],
                    'Valet': ['Code', 'Scheme', 'Branch', 'Company', 'Role', 'Shifts', 'Remarks'],
                    'Cleaning': ['Code', 'Scheme', 'Branch', 'Company', 'Role', 'Shifts', 'Machines Owner', 'Machine Name'],
                    'Helpers': ['Code', 'Scheme', 'Branch', 'Company', 'Role', 'Shifts']
                };
                
                // Brands and Stores data from system-settings
                let brandsData = [];
                let storesData = [];
                
                // Store data for each category
                let categoryData = {
                    'Security': { entries: [], months: [], deletedIds: [] },
                    'Valet': { entries: [], months: [], deletedIds: [] },
                    'Cleaning': { entries: [], months: [], deletedIds: [] },
                    'Helpers': { entries: [], months: [], deletedIds: [] }
                };
                
                let currentCategory = 'Security';
                
                // Tab switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        tab.classList.add('active');
                        const category = tab.dataset.tab;
                        currentCategory = category;
                        document.getElementById('tab-' + category).classList.add('active');
                    });
                });
                
                // Load data on page load
                window.addEventListener('DOMContentLoaded', async () => {
                    // Load brands and stores first
                    await loadBrandsAndStores();
                    // Then load category data
                    ['Security', 'Valet', 'Cleaning', 'Helpers'].forEach(loadData);
                });
                
                async function loadBrandsAndStores() {
                    try {
                        const [brandsRes, storesRes] = await Promise.all([
                            fetch('/operational-excellence/system-settings/api/brands'),
                            fetch('/operational-excellence/system-settings/api/stores')
                        ]);
                        brandsData = await brandsRes.json();
                        storesData = await storesRes.json();
                    } catch (error) {
                        console.error('Error loading brands/stores:', error);
                    }
                }
                
                function showLoading() {
                    document.getElementById('loading').classList.remove('hidden');
                }
                
                function hideLoading() {
                    document.getElementById('loading').classList.add('hidden');
                }
                
                function showNotification(message, type = 'success') {
                    const notif = document.createElement('div');
                    notif.className = 'notification ' + type;
                    notif.textContent = message;
                    document.body.appendChild(notif);
                    setTimeout(() => notif.remove(), 3000);
                }
                
                async function loadData(category) {
                    showLoading();
                    const year = document.getElementById('year-' + category).value;
                    
                    try {
                        const response = await fetch('/operational-excellence/master-table/api/data?category=' + category + '&year=' + year);
                        const data = await response.json();
                        
                        categoryData[category] = {
                            entries: data.entries || [],
                            months: data.months || [],
                            deletedIds: []
                        };
                        
                        renderTable(category);
                    } catch (error) {
                        console.error('Error loading data:', error);
                        showNotification('Error loading data', 'error');
                    }
                    
                    hideLoading();
                }
                
                function renderTable(category) {
                    const table = document.getElementById('table-' + category);
                    const thead = table.querySelector('thead');
                    const tbody = table.querySelector('tbody');
                    const tfoot = table.querySelector('tfoot');
                    const columns = baseColumns[category];
                    const months = categoryData[category].months;
                    const entries = categoryData[category].entries;
                    
                    // Build header
                    let headerRow1 = '<tr><th rowspan="2">Actions</th>';
                    let headerRow2 = '<tr>';
                    
                    columns.forEach(col => {
                        headerRow1 += '<th rowspan="2">' + col + '</th>';
                    });
                    
                    months.forEach(month => {
                        headerRow1 += '<th colspan="3" class="month-header">' + monthNames[month - 1] + '</th>';
                        headerRow2 += '<th class="month-subheader">Count</th><th class="month-subheader">Salary</th><th class="month-subheader">Total</th>';
                    });
                    
                    headerRow1 += '</tr>';
                    headerRow2 += '</tr>';
                    thead.innerHTML = headerRow1 + headerRow2;
                    
                    // Build body
                    let bodyHtml = '';
                    entries.forEach((entry, idx) => {
                        const rowClass = entry.isNew ? 'new-row' : (entry.isModified ? 'modified' : '') + (entry.isDeleted ? ' deleted' : '');
                        bodyHtml += '<tr class="' + rowClass + '" data-id="' + (entry.Id || 'new-' + idx) + '" data-idx="' + idx + '">';
                        
                        // Actions
                        bodyHtml += '<td class="row-actions">';
                        if (entry.isDeleted) {
                            bodyHtml += '<button class="btn-restore-row" onclick="restoreRow(\\'' + category + '\\', ' + idx + ')">↩️</button>';
                        } else {
                            bodyHtml += '<button class="btn-delete-row" onclick="deleteRow(\\'' + category + '\\', ' + idx + ')">🗑️</button>';
                        }
                        bodyHtml += '</td>';
                        
                        // Base columns
                        columns.forEach(col => {
                            const fieldName = col.replace(/ /g, '');
                            const value = entry[fieldName] || '';
                            
                            if (col === 'Scheme') {
                                // Dropdown for Scheme (Brands)
                                bodyHtml += '<td><select onchange="markModified(\\'' + category + '\\', ' + idx + ', \\'' + fieldName + '\\', this.value); updateStoresDropdown(\\'' + category + '\\', ' + idx + ', this.value)"' +
                                            (entry.isDeleted ? ' disabled' : '') + '>';
                                bodyHtml += '<option value="">-- Select Brand --</option>';
                                brandsData.forEach(brand => {
                                    const selected = value === brand.BrandName ? 'selected' : '';
                                    bodyHtml += '<option value="' + escapeHtml(brand.BrandName) + '" ' + selected + '>' + escapeHtml(brand.BrandName) + '</option>';
                                });
                                bodyHtml += '</select></td>';
                            } else if (col === 'Branch') {
                                // Dropdown for Branch (Stores) - filtered by selected brand
                                const selectedBrand = entry['Scheme'] || '';
                                bodyHtml += '<td><select id="branch-' + category + '-' + idx + '" onchange="markModified(\\'' + category + '\\', ' + idx + ', \\'' + fieldName + '\\', this.value)"' +
                                            (entry.isDeleted ? ' disabled' : '') + '>';
                                bodyHtml += '<option value="">-- Select Store --</option>';
                                storesData.forEach(store => {
                                    // Find matching brand for this store
                                    const storeBrand = brandsData.find(b => b.Id === store.BrandId);
                                    const brandMatches = !selectedBrand || (storeBrand && storeBrand.BrandName === selectedBrand);
                                    if (brandMatches) {
                                        const selected = value === store.StoreName ? 'selected' : '';
                                        bodyHtml += '<option value="' + escapeHtml(store.StoreName) + '" ' + selected + '>' + escapeHtml(store.StoreName) + '</option>';
                                    }
                                });
                                bodyHtml += '</select></td>';
                            } else {
                                // Regular text input
                                bodyHtml += '<td><input type="text" value="' + escapeHtml(value) + '" ' + 
                                            'onchange="markModified(\\'' + category + '\\', ' + idx + ', \\'' + fieldName + '\\', this.value)"' +
                                            (entry.isDeleted ? ' disabled' : '') + '></td>';
                            }
                        });
                        
                        // Monthly data
                        months.forEach(month => {
                            const monthData = entry.monthlyData ? entry.monthlyData[month] : {};
                            const count = monthData ? (monthData.StaffCount || 0) : 0;
                            const salary = monthData ? (monthData.Salary || 0) : 0;
                            const total = count * salary;
                            
                            bodyHtml += '<td><input type="number" step="0.5" value="' + count + '" ' +
                                        'onchange="updateMonthlyData(\\'' + category + '\\', ' + idx + ', ' + month + ', \\'count\\', this.value)"' +
                                        (entry.isDeleted ? ' disabled' : '') + '></td>';
                            bodyHtml += '<td><input type="number" step="0.01" value="' + salary + '" ' +
                                        'onchange="updateMonthlyData(\\'' + category + '\\', ' + idx + ', ' + month + ', \\'salary\\', this.value)"' +
                                        (entry.isDeleted ? ' disabled' : '') + '></td>';
                            bodyHtml += '<td class="total-cost">$' + total.toLocaleString('en-US', {minimumFractionDigits: 0}) + '</td>';
                        });
                        
                        bodyHtml += '</tr>';
                    });
                    tbody.innerHTML = bodyHtml;
                    
                    // Build footer with totals
                    if (entries.length > 0 && months.length > 0) {
                        let footerHtml = '<tr class="summary-row"><td></td>';
                        columns.forEach((col, i) => {
                            footerHtml += '<td>' + (i === 0 ? 'TOTALS' : '') + '</td>';
                        });
                        
                        months.forEach(month => {
                            let totalCount = 0;
                            let totalCost = 0;
                            entries.forEach(entry => {
                                if (!entry.isDeleted && entry.monthlyData && entry.monthlyData[month]) {
                                    const count = parseFloat(entry.monthlyData[month].StaffCount) || 0;
                                    const salary = parseFloat(entry.monthlyData[month].Salary) || 0;
                                    totalCount += count;
                                    totalCost += count * salary;
                                }
                            });
                            footerHtml += '<td style="text-align:right;font-weight:600;">' + totalCount + '</td>';
                            footerHtml += '<td></td>';
                            footerHtml += '<td class="total-cost" style="font-weight:700;">$' + totalCost.toLocaleString('en-US', {minimumFractionDigits: 0}) + '</td>';
                        });
                        
                        footerHtml += '</tr>';
                        tfoot.innerHTML = footerHtml;
                    } else {
                        tfoot.innerHTML = '';
                    }
                }
                
                function escapeHtml(text) {
                    if (!text) return '';
                    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                }
                
                function addRow(category) {
                    const columns = baseColumns[category];
                    const newEntry = {
                        isNew: true,
                        isModified: false,
                        Category: category,
                        monthlyData: {}
                    };
                    
                    columns.forEach(col => {
                        const fieldName = col.replace(/ /g, '');
                        newEntry[fieldName] = '';
                    });
                    
                    // Initialize monthly data for existing months
                    categoryData[category].months.forEach(month => {
                        newEntry.monthlyData[month] = { StaffCount: 0, Salary: 0 };
                    });
                    
                    categoryData[category].entries.push(newEntry);
                    renderTable(category);
                    showNotification('New row added');
                }
                
                function updateStoresDropdown(category, idx, selectedBrand) {
                    // Update the Branch dropdown based on selected Scheme (Brand)
                    const selectEl = document.getElementById('branch-' + category + '-' + idx);
                    if (!selectEl) return;
                    
                    const currentValue = categoryData[category].entries[idx].Branch || '';
                    
                    let options = '<option value="">-- Select Store --</option>';
                    storesData.forEach(store => {
                        const storeBrand = brandsData.find(b => b.Id === store.BrandId);
                        const brandMatches = !selectedBrand || (storeBrand && storeBrand.BrandName === selectedBrand);
                        if (brandMatches) {
                            const selected = currentValue === store.StoreName ? 'selected' : '';
                            options += '<option value="' + escapeHtml(store.StoreName) + '" ' + selected + '>' + escapeHtml(store.StoreName) + '</option>';
                        }
                    });
                    selectEl.innerHTML = options;
                    
                    // Clear Branch value if current store doesn't match new brand
                    if (selectedBrand && currentValue) {
                        const currentStore = storesData.find(s => s.StoreName === currentValue);
                        if (currentStore) {
                            const storeBrand = brandsData.find(b => b.Id === currentStore.BrandId);
                            if (!storeBrand || storeBrand.BrandName !== selectedBrand) {
                                categoryData[category].entries[idx].Branch = '';
                                selectEl.value = '';
                            }
                        }
                    }
                }
                
                function deleteRow(category, idx) {
                    const entry = categoryData[category].entries[idx];
                    if (entry.isNew) {
                        categoryData[category].entries.splice(idx, 1);
                    } else {
                        entry.isDeleted = true;
                        if (entry.Id) {
                            categoryData[category].deletedIds.push(entry.Id);
                        }
                    }
                    renderTable(category);
                }
                
                function restoreRow(category, idx) {
                    const entry = categoryData[category].entries[idx];
                    entry.isDeleted = false;
                    const delIdx = categoryData[category].deletedIds.indexOf(entry.Id);
                    if (delIdx > -1) {
                        categoryData[category].deletedIds.splice(delIdx, 1);
                    }
                    renderTable(category);
                }
                
                function markModified(category, idx, field, value) {
                    const entry = categoryData[category].entries[idx];
                    entry[field] = value;
                    if (!entry.isNew) {
                        entry.isModified = true;
                    }
                    renderTable(category);
                }
                
                function updateMonthlyData(category, idx, month, type, value) {
                    const entry = categoryData[category].entries[idx];
                    if (!entry.monthlyData) entry.monthlyData = {};
                    if (!entry.monthlyData[month]) entry.monthlyData[month] = { StaffCount: 0, Salary: 0 };
                    
                    if (type === 'count') {
                        entry.monthlyData[month].StaffCount = parseFloat(value) || 0;
                    } else {
                        entry.monthlyData[month].Salary = parseFloat(value) || 0;
                    }
                    
                    if (!entry.isNew) {
                        entry.isModified = true;
                    }
                    
                    renderTable(category);
                }
                
                function addMonth(category) {
                    currentCategory = category;
                    document.getElementById('monthModal').classList.add('active');
                    
                    // Set default to next available month
                    const existingMonths = categoryData[category].months;
                    let nextMonth = 1;
                    for (let i = 1; i <= 12; i++) {
                        if (!existingMonths.includes(i)) {
                            nextMonth = i;
                            break;
                        }
                    }
                    document.getElementById('monthSelect').value = nextMonth;
                }
                
                function closeMonthModal() {
                    document.getElementById('monthModal').classList.remove('active');
                }
                
                async function confirmAddMonth() {
                    const month = parseInt(document.getElementById('monthSelect').value);
                    const year = document.getElementById('year-' + currentCategory).value;
                    
                    if (categoryData[currentCategory].months.includes(month)) {
                        showNotification(monthNames[month - 1] + ' already exists', 'error');
                        return;
                    }
                    
                    showLoading();
                    closeMonthModal();
                    
                    try {
                        const response = await fetch('/operational-excellence/master-table/api/add-month', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                category: currentCategory,
                                year: parseInt(year),
                                month: month
                            })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            categoryData[currentCategory].months.push(month);
                            categoryData[currentCategory].months.sort((a, b) => a - b);
                            
                            // Initialize monthly data for all entries
                            categoryData[currentCategory].entries.forEach(entry => {
                                if (!entry.monthlyData) entry.monthlyData = {};
                                entry.monthlyData[month] = { StaffCount: 0, Salary: 0 };
                            });
                            
                            renderTable(currentCategory);
                            showNotification(monthNames[month - 1] + ' added successfully');
                        } else {
                            showNotification(result.error || 'Error adding month', 'error');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showNotification('Error adding month', 'error');
                    }
                    
                    hideLoading();
                }
                
                async function saveAll(category) {
                    showLoading();
                    const year = document.getElementById('year-' + category).value;
                    const data = categoryData[category];
                    
                    try {
                        const response = await fetch('/operational-excellence/master-table/api/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                category: category,
                                year: parseInt(year),
                                entries: data.entries.filter(e => !e.isDeleted),
                                deletedIds: data.deletedIds
                            })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            showNotification('Saved successfully!');
                            loadData(category); // Reload to get fresh IDs
                        } else {
                            showNotification(result.error || 'Error saving', 'error');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showNotification('Error saving data', 'error');
                    }
                    
                    hideLoading();
                }
                
                function exportToExcel(category) {
                    const year = document.getElementById('year-' + category).value;
                    window.open('/operational-excellence/master-table/api/export?category=' + category + '&year=' + year, '_blank');
                }
                
                async function importFromExcel(category) {
                    if (!confirm('This will import data from the Mastertable 2026.xlsx file for ' + category + ' sheet.\\n\\nExisting data will NOT be deleted - new entries will be added.\\n\\nContinue?')) {
                        return;
                    }
                    
                    showLoading();
                    const year = document.getElementById('year-' + category).value;
                    
                    try {
                        const response = await fetch('/operational-excellence/master-table/api/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ category, year: parseInt(year) })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            showNotification('Imported ' + result.count + ' entries successfully!');
                            loadData(category);
                        } else {
                            showNotification(result.error || 'Error importing', 'error');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showNotification('Error importing data', 'error');
                    }
                    
                    hideLoading();
                }
            </script>
        </body>
        </html>
    `);
});

function generateYearOptions() {
    const currentYear = new Date().getFullYear();
    let options = '';
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
        options += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
    }
    return options;
}

// API: Get data for a category
router.get('/api/data', async (req, res) => {
    try {
        const { category, year } = req.query;
        const pool = await getPool();
        
        // Get active months
        const monthsResult = await pool.request()
            .input('category', sql.NVarChar, category)
            .input('year', sql.Int, parseInt(year))
            .query(`
                SELECT Month FROM MasterTableActiveMonths 
                WHERE Category = @category AND Year = @year 
                ORDER BY Month
            `);
        
        const months = monthsResult.recordset.map(r => r.Month);
        
        // Get entries with monthly data
        const entriesResult = await pool.request()
            .input('category', sql.NVarChar, category)
            .query(`
                SELECT * FROM MasterTableEntries 
                WHERE Category = @category AND IsActive = 1 
                ORDER BY Code, Company
            `);
        
        const entries = entriesResult.recordset;
        
        // Get monthly data for all entries
        if (entries.length > 0) {
            const entryIds = entries.map(e => e.Id);
            const monthlyResult = await pool.request()
                .input('year', sql.Int, parseInt(year))
                .query(`
                    SELECT * FROM MasterTableMonthlyData 
                    WHERE EntryId IN (${entryIds.join(',')}) AND Year = @year
                `);
            
            // Attach monthly data to entries
            entries.forEach(entry => {
                entry.monthlyData = {};
                monthlyResult.recordset
                    .filter(m => m.EntryId === entry.Id)
                    .forEach(m => {
                        entry.monthlyData[m.Month] = {
                            StaffCount: m.StaffCount,
                            Salary: m.Salary
                        };
                    });
            });
        }
        
        res.json({ entries, months });
    } catch (error) {
        console.error('Error loading master table data:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Add a month
router.post('/api/add-month', async (req, res) => {
    try {
        const { category, year, month } = req.body;
        const pool = await getPool();
        
        await pool.request()
            .input('category', sql.NVarChar, category)
            .input('year', sql.Int, year)
            .input('month', sql.Int, month)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM MasterTableActiveMonths 
                    WHERE Category = @category AND Year = @year AND Month = @month
                )
                INSERT INTO MasterTableActiveMonths (Category, Year, Month) 
                VALUES (@category, @year, @month)
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding month:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Save all data
router.post('/api/save', async (req, res) => {
    try {
        const { category, year, entries, deletedIds } = req.body;
        const pool = await getPool();
        const user = req.currentUser;
        
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            // Delete marked entries
            if (deletedIds && deletedIds.length > 0) {
                await transaction.request()
                    .query(`UPDATE MasterTableEntries SET IsActive = 0 WHERE Id IN (${deletedIds.join(',')})`);
            }
            
            // Process entries
            for (const entry of entries) {
                let entryId = entry.Id;
                
                if (entry.isNew) {
                    // Insert new entry
                    const insertResult = await transaction.request()
                        .input('category', sql.NVarChar, category)
                        .input('code', sql.NVarChar, entry.Code || '')
                        .input('scheme', sql.NVarChar, entry.Scheme || '')
                        .input('branch', sql.NVarChar, entry.Branch || '')
                        .input('company', sql.NVarChar, entry.Company || '')
                        .input('role', sql.NVarChar, entry.Role || '')
                        .input('shifts', sql.NVarChar, entry.Shifts || '')
                        .input('remarks', sql.NVarChar, entry.Remarks || '')
                        .input('machinesOwner', sql.NVarChar, entry.MachinesOwner || '')
                        .input('machineName', sql.NVarChar, entry.MachineName || '')
                        .input('createdBy', sql.NVarChar, user ? user.Username : 'System')
                        .query(`
                            INSERT INTO MasterTableEntries 
                            (Category, Code, Scheme, Branch, Company, Role, Shifts, Remarks, MachinesOwner, MachineName, CreatedBy)
                            OUTPUT INSERTED.Id
                            VALUES (@category, @code, @scheme, @branch, @company, @role, @shifts, @remarks, @machinesOwner, @machineName, @createdBy)
                        `);
                    
                    entryId = insertResult.recordset[0].Id;
                } else if (entry.isModified) {
                    // Update existing entry
                    await transaction.request()
                        .input('id', sql.Int, entry.Id)
                        .input('code', sql.NVarChar, entry.Code || '')
                        .input('scheme', sql.NVarChar, entry.Scheme || '')
                        .input('branch', sql.NVarChar, entry.Branch || '')
                        .input('company', sql.NVarChar, entry.Company || '')
                        .input('role', sql.NVarChar, entry.Role || '')
                        .input('shifts', sql.NVarChar, entry.Shifts || '')
                        .input('remarks', sql.NVarChar, entry.Remarks || '')
                        .input('machinesOwner', sql.NVarChar, entry.MachinesOwner || '')
                        .input('machineName', sql.NVarChar, entry.MachineName || '')
                        .query(`
                            UPDATE MasterTableEntries SET
                                Code = @code, Scheme = @scheme, Branch = @branch, Company = @company,
                                Role = @role, Shifts = @shifts, Remarks = @remarks,
                                MachinesOwner = @machinesOwner, MachineName = @machineName,
                                UpdatedAt = GETDATE()
                            WHERE Id = @id
                        `);
                }
                
                // Save monthly data
                if (entry.monthlyData && entryId) {
                    for (const [month, data] of Object.entries(entry.monthlyData)) {
                        await transaction.request()
                            .input('entryId', sql.Int, entryId)
                            .input('year', sql.Int, year)
                            .input('month', sql.Int, parseInt(month))
                            .input('count', sql.Decimal(10, 2), data.StaffCount || 0)
                            .input('salary', sql.Decimal(10, 2), data.Salary || 0)
                            .query(`
                                MERGE MasterTableMonthlyData AS target
                                USING (SELECT @entryId AS EntryId, @year AS Year, @month AS Month) AS source
                                ON target.EntryId = source.EntryId AND target.Year = source.Year AND target.Month = source.Month
                                WHEN MATCHED THEN
                                    UPDATE SET StaffCount = @count, Salary = @salary, UpdatedAt = GETDATE()
                                WHEN NOT MATCHED THEN
                                    INSERT (EntryId, Year, Month, StaffCount, Salary)
                                    VALUES (@entryId, @year, @month, @count, @salary);
                            `);
                    }
                }
            }
            
            await transaction.commit();
            res.json({ success: true });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error saving master table data:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Export to Excel (CSV for now)
router.get('/api/export', async (req, res) => {
    try {
        const { category, year } = req.query;
        const pool = await getPool();
        
        // Get months
        const monthsResult = await pool.request()
            .input('category', sql.NVarChar, category)
            .input('year', sql.Int, parseInt(year))
            .query(`
                SELECT Month FROM MasterTableActiveMonths 
                WHERE Category = @category AND Year = @year 
                ORDER BY Month
            `);
        
        const months = monthsResult.recordset.map(r => r.Month);
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Get entries
        const entriesResult = await pool.request()
            .input('category', sql.NVarChar, category)
            .query(`
                SELECT * FROM MasterTableEntries 
                WHERE Category = @category AND IsActive = 1 
                ORDER BY Code, Company
            `);
        
        const entries = entriesResult.recordset;
        
        // Get monthly data
        let monthlyData = {};
        if (entries.length > 0) {
            const entryIds = entries.map(e => e.Id);
            const monthlyResult = await pool.request()
                .input('year', sql.Int, parseInt(year))
                .query(`
                    SELECT * FROM MasterTableMonthlyData 
                    WHERE EntryId IN (${entryIds.join(',')}) AND Year = @year
                `);
            
            monthlyResult.recordset.forEach(m => {
                if (!monthlyData[m.EntryId]) monthlyData[m.EntryId] = {};
                monthlyData[m.EntryId][m.Month] = m;
            });
        }
        
        // Build CSV
        let baseHeaders = ['Code', 'Scheme', 'Branch', 'Company', 'Role', 'Shifts'];
        if (category === 'Cleaning') {
            baseHeaders.push('Machines Owner', 'Machine Name');
        } else {
            baseHeaders.push('Remarks');
        }
        
        // Add month headers
        months.forEach(m => {
            const name = monthNames[m - 1];
            baseHeaders.push(name + ' Count', name + ' Salary', name + ' Total');
        });
        
        let csv = baseHeaders.join(',') + '\n';
        
        entries.forEach(entry => {
            let row = [
                '"' + (entry.Code || '').replace(/"/g, '""') + '"',
                '"' + (entry.Scheme || '').replace(/"/g, '""') + '"',
                '"' + (entry.Branch || '').replace(/"/g, '""') + '"',
                '"' + (entry.Company || '').replace(/"/g, '""') + '"',
                '"' + (entry.Role || '').replace(/"/g, '""') + '"',
                '"' + (entry.Shifts || '').replace(/"/g, '""') + '"'
            ];
            
            if (category === 'Cleaning') {
                row.push('"' + (entry.MachinesOwner || '').replace(/"/g, '""') + '"');
                row.push('"' + (entry.MachineName || '').replace(/"/g, '""') + '"');
            } else {
                row.push('"' + (entry.Remarks || '').replace(/"/g, '""') + '"');
            }
            
            months.forEach(m => {
                const md = monthlyData[entry.Id] ? monthlyData[entry.Id][m] : null;
                const count = md ? md.StaffCount : 0;
                const salary = md ? md.Salary : 0;
                const total = count * salary;
                row.push(count, salary, total);
            });
            
            csv += row.join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="MasterTable_${category}_${year}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting:', error);
        res.status(500).send('Export error');
    }
});

// API: Import from Excel file (Mastertable 2026.xlsx)
router.post('/api/import', async (req, res) => {
    try {
        const { category, year } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        // Read the Excel file
        const excelPath = path.join(__dirname, 'Mastertable 2026.xlsx');
        const workbook = XLSX.readFile(excelPath);
        
        // Get the sheet for this category
        const sheet = workbook.Sheets[category];
        if (!sheet) {
            return res.status(400).json({ error: `Sheet "${category}" not found in Excel file` });
        }
        
        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Find header row (row with Code, Scheme, Branch, etc.)
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(5, rawData.length); i++) {
            if (rawData[i] && rawData[i][0] === 'Code') {
                headerRowIdx = i;
                break;
            }
        }
        
        if (headerRowIdx === -1) {
            return res.status(400).json({ error: 'Could not find header row in sheet' });
        }
        
        const headers = rawData[headerRowIdx];
        const dataRows = rawData.slice(headerRowIdx + 1);
        
        // Find column indices
        const colIdx = {
            Code: headers.indexOf('Code'),
            Scheme: headers.indexOf('Scheme'),
            Branch: headers.indexOf('Branch'),
            Company: headers.indexOf('Company'),
            Role: headers.indexOf('Role'),
            Shifts: headers.indexOf('Shifts'),
            Remarks: headers.indexOf('Remarks'),
            MachinesOwner: headers.indexOf('Machines Owner'),
            MachineName: headers.indexOf('Machine Name')
        };
        
        // Find month columns - look for "Count" headers after the base columns
        const monthColumns = [];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Check the row above headers for month names
        const monthRow = rawData[headerRowIdx - 1] || [];
        for (let i = 0; i < headers.length; i++) {
            if (headers[i] === 'Count') {
                // Look for month name in the row above
                for (let j = i; j >= 0; j--) {
                    if (monthRow[j] && monthNames.includes(monthRow[j])) {
                        const monthNum = monthNames.indexOf(monthRow[j]) + 1;
                        monthColumns.push({
                            month: monthNum,
                            countIdx: i,
                            salaryIdx: i + 1
                        });
                        break;
                    }
                }
            }
        }
        
        // Ensure active months exist
        for (const mc of monthColumns) {
            await pool.request()
                .input('category', sql.NVarChar, category)
                .input('year', sql.Int, year)
                .input('month', sql.Int, mc.month)
                .query(`
                    IF NOT EXISTS (
                        SELECT 1 FROM MasterTableActiveMonths 
                        WHERE Category = @category AND Year = @year AND Month = @month
                    )
                    INSERT INTO MasterTableActiveMonths (Category, Year, Month) 
                    VALUES (@category, @year, @month)
                `);
        }
        
        let importCount = 0;
        
        // Process each data row
        for (const row of dataRows) {
            // Skip empty rows or summary rows
            const code = row[colIdx.Code];
            if (!code || code === '' || code.includes('Guards') || code.includes('Agents') || code.includes('Total')) {
                continue;
            }
            
            // Insert entry
            const insertResult = await pool.request()
                .input('category', sql.NVarChar, category)
                .input('code', sql.NVarChar, code || '')
                .input('scheme', sql.NVarChar, row[colIdx.Scheme] || '')
                .input('branch', sql.NVarChar, row[colIdx.Branch] || '')
                .input('company', sql.NVarChar, row[colIdx.Company] || '')
                .input('role', sql.NVarChar, row[colIdx.Role] || '')
                .input('shifts', sql.NVarChar, String(row[colIdx.Shifts] || ''))
                .input('remarks', sql.NVarChar, row[colIdx.Remarks] || '')
                .input('machinesOwner', sql.NVarChar, colIdx.MachinesOwner >= 0 ? (row[colIdx.MachinesOwner] || '') : '')
                .input('machineName', sql.NVarChar, colIdx.MachineName >= 0 ? (row[colIdx.MachineName] || '') : '')
                .input('createdBy', sql.NVarChar, user ? user.displayName : 'Import')
                .query(`
                    INSERT INTO MasterTableEntries 
                    (Category, Code, Scheme, Branch, Company, Role, Shifts, Remarks, MachinesOwner, MachineName, CreatedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@category, @code, @scheme, @branch, @company, @role, @shifts, @remarks, @machinesOwner, @machineName, @createdBy)
                `);
            
            const entryId = insertResult.recordset[0].Id;
            
            // Insert monthly data
            for (const mc of monthColumns) {
                let countVal = row[mc.countIdx];
                let salaryVal = row[mc.salaryIdx];
                
                // Parse values - handle currency format
                if (typeof countVal === 'string') {
                    countVal = parseFloat(countVal.replace(/[^0-9.-]/g, '')) || 0;
                }
                if (typeof salaryVal === 'string') {
                    salaryVal = parseFloat(salaryVal.replace(/[^0-9.-]/g, '')) || 0;
                }
                
                countVal = countVal || 0;
                salaryVal = salaryVal || 0;
                
                if (countVal > 0 || salaryVal > 0) {
                    await pool.request()
                        .input('entryId', sql.Int, entryId)
                        .input('year', sql.Int, year)
                        .input('month', sql.Int, mc.month)
                        .input('count', sql.Decimal(10, 2), countVal)
                        .input('salary', sql.Decimal(10, 2), salaryVal)
                        .query(`
                            INSERT INTO MasterTableMonthlyData (EntryId, Year, Month, StaffCount, Salary)
                            VALUES (@entryId, @year, @month, @count, @salary)
                        `);
                }
            }
            
            importCount++;
        }
        
        res.json({ success: true, count: importCount });
    } catch (error) {
        console.error('Error importing:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
