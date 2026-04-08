/**
 * Personnel Employees Dashboard
 * View all employees entered by Personnel in Schedule & Attendance
 * Auto-refreshes to show latest updates
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

// Main dashboard page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Personnel Employees - ${process.env.APP_NAME}</title>
            <link href="https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: #f5f7fa;
                    min-height: 100vh;
                }
                
                .header {
                    background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { 
                    font-size: 24px; 
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .header-nav { display: flex; gap: 10px; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.1);
                    transition: all 0.2s;
                }
                .header-nav a:hover { background: rgba(255,255,255,0.2); }
                
                .container { max-width: 1400px; margin: 0 auto; padding: 25px; }
                
                /* Stats Cards */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 25px;
                }
                .stat-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .stat-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                }
                .stat-icon.total { background: #e3f2fd; color: #1976d2; }
                .stat-icon.company { background: #e8f5e9; color: #388e3c; }
                .stat-icon.store { background: #fff3e0; color: #f57c00; }
                .stat-icon.position { background: #f3e5f5; color: #7b1fa2; }
                
                .stat-info h3 { font-size: 28px; color: #2c3e50; }
                .stat-info p { font-size: 12px; color: #7f8c8d; text-transform: uppercase; }
                
                /* Filters */
                .filters-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }
                .filters-row {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }
                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .filter-group label {
                    font-size: 12px;
                    color: #666;
                    font-weight: 500;
                }
                .filter-group input, .filter-group select {
                    padding: 10px 14px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    min-width: 180px;
                }
                .filter-group input:focus, .filter-group select:focus {
                    outline: none;
                    border-color: #3498db;
                }
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .btn-primary { background: #3498db; color: white; }
                .btn-primary:hover { background: #2980b9; }
                .btn-secondary { background: #95a5a6; color: white; }
                .btn-secondary:hover { background: #7f8c8d; }
                
                /* Table */
                .table-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    overflow: hidden;
                }
                .table-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px 20px;
                    border-bottom: 1px solid #eee;
                }
                .table-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #2c3e50;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .refresh-indicator {
                    font-size: 12px;
                    color: #27ae60;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .refresh-indicator.loading { color: #f39c12; }
                
                .table-container {
                    overflow-x: auto;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    background: #f8f9fa;
                    padding: 14px 16px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    border-bottom: 2px solid #eee;
                    white-space: nowrap;
                }
                td {
                    padding: 14px 16px;
                    border-bottom: 1px solid #f5f5f5;
                    font-size: 14px;
                    color: #333;
                }
                tr:hover { background: #f8f9fa; }
                
                .badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .badge-company { background: #e8f5e9; color: #388e3c; }
                .badge-store { background: #fff3e0; color: #f57c00; }
                .badge-position { background: #f3e5f5; color: #7b1fa2; }
                
                .employee-name {
                    font-weight: 600;
                    color: #2c3e50;
                }
                .employee-id {
                    font-family: monospace;
                    background: #f5f5f5;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 13px;
                }
                .phone-number {
                    color: #3498db;
                }
                .phone-number i {
                    margin-right: 5px;
                }
                
                /* Empty State */
                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: #95a5a6;
                }
                .empty-state i { font-size: 60px; margin-bottom: 15px; }
                .empty-state h3 { margin: 0 0 10px; color: #7f8c8d; }
                .empty-state p { margin: 0; }
                
                /* Count badge */
                .count-badge {
                    background: #3498db;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    margin-left: 8px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1><i class="mdi mdi-account-group"></i> Personnel Employees</h1>
                <div class="header-nav">
                    <a href="/operational-excellence"><i class="mdi mdi-arrow-left"></i> Back</a>
                    <a href="/"><i class="mdi mdi-home"></i> Home</a>
                </div>
            </div>
            
            <div class="container">
                <!-- Stats -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon total"><i class="mdi mdi-account-multiple"></i></div>
                        <div class="stat-info">
                            <h3 id="totalEmployees">-</h3>
                            <p>Total Employees</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon company"><i class="mdi mdi-domain"></i></div>
                        <div class="stat-info">
                            <h3 id="totalCompanies">-</h3>
                            <p>Companies</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon store"><i class="mdi mdi-store"></i></div>
                        <div class="stat-info">
                            <h3 id="totalStores">-</h3>
                            <p>Stores</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon position"><i class="mdi mdi-briefcase"></i></div>
                        <div class="stat-info">
                            <h3 id="totalPositions">-</h3>
                            <p>Positions</p>
                        </div>
                    </div>
                </div>
                
                <!-- Filters -->
                <div class="filters-card">
                    <div class="filters-row">
                        <div class="filter-group">
                            <label>Search</label>
                            <input type="text" id="searchInput" placeholder="Name, ID, Phone..." oninput="filterTable()">
                        </div>
                        <div class="filter-group">
                            <label>Company</label>
                            <select id="filterCompany" onchange="filterTable()">
                                <option value="">All Companies</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Store</label>
                            <select id="filterStore" onchange="filterTable()">
                                <option value="">All Stores</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Position</label>
                            <select id="filterPosition" onchange="filterTable()">
                                <option value="">All Positions</option>
                            </select>
                        </div>
                        <button class="btn btn-secondary" onclick="resetFilters()">
                            <i class="mdi mdi-refresh"></i> Reset
                        </button>
                    </div>
                </div>
                
                <!-- Employees Table -->
                <div class="table-card">
                    <div class="table-header">
                        <div class="table-title">
                            <i class="mdi mdi-table"></i> Employee List
                            <span class="count-badge" id="displayCount">0</span>
                        </div>
                        <div class="refresh-indicator" id="refreshIndicator">
                            <i class="mdi mdi-check-circle"></i> Live
                        </div>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Employee Name</th>
                                    <th>Employee ID</th>
                                    <th>Phone Number</th>
                                    <th>Position</th>
                                    <th>Company</th>
                                    <th>Store</th>
                                </tr>
                            </thead>
                            <tbody id="employeesTable">
                                <tr>
                                    <td colspan="7">
                                        <div class="empty-state">
                                            <i class="mdi mdi-loading mdi-spin"></i>
                                            <h3>Loading...</h3>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <script>
                let allEmployees = [];
                let refreshInterval = null;
                
                // Load employees data
                async function loadEmployees() {
                    const indicator = document.getElementById('refreshIndicator');
                    indicator.className = 'refresh-indicator loading';
                    indicator.innerHTML = '<i class="mdi mdi-loading mdi-spin"></i> Updating...';
                    
                    try {
                        const resp = await fetch('personnel-employees-dashboard/api/employees');
                        const data = await resp.json();
                        
                        allEmployees = data.employees || [];
                        
                        // Update stats
                        document.getElementById('totalEmployees').textContent = data.stats.total || 0;
                        document.getElementById('totalCompanies').textContent = data.stats.companies || 0;
                        document.getElementById('totalStores').textContent = data.stats.stores || 0;
                        document.getElementById('totalPositions').textContent = data.stats.positions || 0;
                        
                        // Update filter dropdowns
                        updateFilterOptions(data.filters);
                        
                        // Render table
                        renderTable();
                        
                        indicator.className = 'refresh-indicator';
                        indicator.innerHTML = '<i class="mdi mdi-check-circle"></i> Live';
                    } catch (err) {
                        console.error('Error loading employees:', err);
                        indicator.className = 'refresh-indicator';
                        indicator.innerHTML = '<i class="mdi mdi-alert-circle" style="color:#e74c3c;"></i> Error';
                    }
                }
                
                function updateFilterOptions(filters) {
                    const companySelect = document.getElementById('filterCompany');
                    const storeSelect = document.getElementById('filterStore');
                    const positionSelect = document.getElementById('filterPosition');
                    
                    // Remember current selections
                    const currentCompany = companySelect.value;
                    const currentStore = storeSelect.value;
                    const currentPosition = positionSelect.value;
                    
                    // Clear and rebuild options
                    companySelect.innerHTML = '<option value="">All Companies</option>';
                    storeSelect.innerHTML = '<option value="">All Stores</option>';
                    positionSelect.innerHTML = '<option value="">All Positions</option>';
                    
                    (filters.companies || []).forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c;
                        opt.textContent = c;
                        companySelect.appendChild(opt);
                    });
                    
                    (filters.stores || []).forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s;
                        opt.textContent = s;
                        storeSelect.appendChild(opt);
                    });
                    
                    (filters.positions || []).forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p;
                        opt.textContent = p;
                        positionSelect.appendChild(opt);
                    });
                    
                    // Restore selections
                    companySelect.value = currentCompany;
                    storeSelect.value = currentStore;
                    positionSelect.value = currentPosition;
                }
                
                function renderTable() {
                    const tbody = document.getElementById('employeesTable');
                    const filtered = getFilteredEmployees();
                    
                    document.getElementById('displayCount').textContent = filtered.length;
                    
                    if (filtered.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="mdi mdi-account-search"></i><h3>No Employees Found</h3><p>No employees match your filter criteria</p></div></td></tr>';
                        return;
                    }
                    
                    let html = '';
                    filtered.forEach((emp, idx) => {
                        html += '<tr>';
                        html += '<td>' + (idx + 1) + '</td>';
                        html += '<td><span class="employee-name">' + escapeHtml(emp.Name || '-') + '</span></td>';
                        html += '<td><span class="employee-id">' + escapeHtml(emp.EmployeeId || '-') + '</span></td>';
                        html += '<td><span class="phone-number"><i class="mdi mdi-phone"></i>' + escapeHtml(emp.PhoneNumber || '-') + '</span></td>';
                        html += '<td>' + (emp.Position ? '<span class="badge badge-position">' + escapeHtml(emp.Position) + '</span>' : '-') + '</td>';
                        html += '<td>' + (emp.Company ? '<span class="badge badge-company">' + escapeHtml(emp.Company) + '</span>' : '-') + '</td>';
                        html += '<td>' + (emp.Store ? '<span class="badge badge-store">' + escapeHtml(emp.Store) + '</span>' : '-') + '</td>';
                        html += '</tr>';
                    });
                    
                    tbody.innerHTML = html;
                }
                
                function getFilteredEmployees() {
                    const search = document.getElementById('searchInput').value.toLowerCase();
                    const company = document.getElementById('filterCompany').value;
                    const store = document.getElementById('filterStore').value;
                    const position = document.getElementById('filterPosition').value;
                    
                    return allEmployees.filter(emp => {
                        if (search && !((emp.Name || '').toLowerCase().includes(search) ||
                                       (emp.EmployeeId || '').toLowerCase().includes(search) ||
                                       (emp.PhoneNumber || '').toLowerCase().includes(search))) {
                            return false;
                        }
                        if (company && emp.Company !== company) return false;
                        if (store && emp.Store !== store) return false;
                        if (position && emp.Position !== position) return false;
                        return true;
                    });
                }
                
                function filterTable() {
                    renderTable();
                }
                
                function resetFilters() {
                    document.getElementById('searchInput').value = '';
                    document.getElementById('filterCompany').value = '';
                    document.getElementById('filterStore').value = '';
                    document.getElementById('filterPosition').value = '';
                    renderTable();
                }
                
                function escapeHtml(text) {
                    if (!text) return '';
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
                
                // Initialize
                document.addEventListener('DOMContentLoaded', () => {
                    loadEmployees();
                    
                    // Auto-refresh every 30 seconds
                    refreshInterval = setInterval(loadEmployees, 30000);
                });
            </script>
        </body>
        </html>
    `);
});

// API: Get employees
router.get('/api/employees', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                Id,
                Company,
                EmployeeId,
                PhoneNumber,
                Name,
                Position,
                Store,
                IsActive,
                CreatedAt
            FROM Personnel_Employees
            WHERE IsActive = 1
            ORDER BY Company, Name
        `);
        
        const employees = result.recordset;
        
        // Calculate stats
        const companies = [...new Set(employees.map(e => e.Company).filter(Boolean))];
        const stores = [...new Set(employees.map(e => e.Store).filter(Boolean))];
        const positions = [...new Set(employees.map(e => e.Position).filter(Boolean))];
        
        await pool.close();
        
        res.json({
            employees,
            stats: {
                total: employees.length,
                companies: companies.length,
                stores: stores.length,
                positions: positions.length
            },
            filters: {
                companies: companies.sort(),
                stores: stores.sort(),
                positions: positions.sort()
            }
        });
    } catch (err) {
        console.error('Error getting employees:', err);
        if (pool) await pool.close();
        res.status(500).json({ error: err.message });
    }
});

// API: Get stats for dashboard card
router.get('/api/stats', async (req, res) => {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT Company) as companies,
                COUNT(DISTINCT Store) as stores
            FROM Personnel_Employees
            WHERE IsActive = 1
        `);
        
        await pool.close();
        
        const stats = result.recordset[0] || { total: 0, companies: 0, stores: 0 };
        
        res.json(stats);
    } catch (err) {
        console.error('Error getting stats:', err);
        if (pool) await pool.close();
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
