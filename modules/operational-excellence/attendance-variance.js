/**
 * Attendance Variance Module
 * Compares scheduled shifts with actual attendance to identify variances
 * Variance Types: No Show, Late, Early Leave, Ghost (Not Scheduled), Wrong Location, Overtime
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const ExcelJS = require('exceljs');

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

// Helper: Parse time string to minutes
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const clean = timeStr.trim();
    const match = clean.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

// Helper: Format minutes to time string
function formatMinutesToTime(minutes) {
    if (minutes === null || isNaN(minutes)) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Helper: Get day name from date
function getDayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
}

// Helper: Calculate variance between scheduled and actual times
function calculateVariance(scheduledTime, actualTime, type = 'in') {
    if (!scheduledTime || !actualTime) return null;
    const scheduledMins = parseTimeToMinutes(scheduledTime);
    const actualMins = parseTimeToMinutes(actualTime);
    if (scheduledMins === null || actualMins === null) return null;
    
    if (type === 'in') {
        // Late if actual > scheduled
        return actualMins - scheduledMins;
    } else {
        // Early leave if actual < scheduled
        return scheduledMins - actualMins;
    }
}

// Main dashboard
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Schedule vs Attendance Variance - ${process.env.APP_NAME}</title>
            <link href="https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f7fa; }
                
                .header {
                    background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { margin: 0; font-size: 24px; }
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
                
                .container { max-width: 1600px; margin: 0 auto; padding: 25px; }
                
                /* Tabs */
                .tabs {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 20px;
                    background: white;
                    padding: 8px;
                    border-radius: 10px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .tab {
                    padding: 12px 24px;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .tab:hover { background: #f5f7fa; }
                .tab.active { background: #3498db; color: white; }
                .tab i { font-size: 18px; }
                
                /* Tab Content */
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                
                /* Filters */
                .filters-card {
                    background: white;
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
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
                    min-width: 160px;
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
                .btn-success { background: #27ae60; color: white; }
                .btn-success:hover { background: #219a52; }
                .btn-secondary { background: #95a5a6; color: white; }
                .btn-secondary:hover { background: #7f8c8d; }
                
                /* Stats Cards */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 15px;
                    margin-bottom: 25px;
                }
                .stat-card {
                    background: white;
                    border-radius: 10px;
                    padding: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }
                .stat-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                }
                .stat-card.total::before { background: #3498db; }
                .stat-card.no-show::before { background: #e74c3c; }
                .stat-card.late::before { background: #f39c12; }
                .stat-card.early::before { background: #9b59b6; }
                .stat-card.ghost::before { background: #1abc9c; }
                .stat-card.overtime::before { background: #34495e; }
                .stat-card.match::before { background: #27ae60; }
                
                .stat-value {
                    font-size: 32px;
                    font-weight: 700;
                    color: #2c3e50;
                }
                .stat-label {
                    font-size: 12px;
                    color: #7f8c8d;
                    margin-top: 5px;
                    text-transform: uppercase;
                }
                
                /* Table */
                .table-card {
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
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
                }
                .table-actions {
                    display: flex;
                    gap: 10px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    background: #f8f9fa;
                    padding: 12px 15px;
                    text-align: left;
                    font-size: 12px;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    border-bottom: 1px solid #eee;
                }
                td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #f5f5f5;
                    font-size: 14px;
                    color: #333;
                }
                tr:hover { background: #f8f9fa; }
                
                /* Variance Badges */
                .variance-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                }
                .variance-no-show { background: #fde8e8; color: #e74c3c; }
                .variance-late { background: #fef3e2; color: #f39c12; }
                .variance-early-leave { background: #f3e8fd; color: #9b59b6; }
                .variance-ghost { background: #e8fdf5; color: #1abc9c; }
                .variance-overtime { background: #ebeef0; color: #34495e; }
                .variance-match { background: #e8fde8; color: #27ae60; }
                
                /* Time Display */
                .time-scheduled { color: #3498db; font-weight: 500; }
                .time-actual { color: #2c3e50; }
                .time-diff { font-size: 11px; margin-left: 5px; }
                .time-diff.positive { color: #e74c3c; }
                .time-diff.negative { color: #27ae60; }
                
                /* Loading */
                .loading {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255,255,255,0.8);
                    z-index: 1000;
                    justify-content: center;
                    align-items: center;
                }
                .loading.active { display: flex; }
                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
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
                
                /* Pagination */
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 5px;
                    padding: 15px;
                    border-top: 1px solid #eee;
                }
                .pagination button {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .pagination button:hover { background: #f5f5f5; }
                .pagination button.active { background: #3498db; color: white; border-color: #3498db; }
                .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
                
                /* Summary Charts */
                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 20px;
                    margin-bottom: 25px;
                }
                .chart-card {
                    background: white;
                    border-radius: 10px;
                    padding: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .chart-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #2c3e50;
                    margin-bottom: 15px;
                }
                
                /* Group Toggle */
                .group-toggle {
                    display: flex;
                    gap: 5px;
                    background: #f5f7fa;
                    padding: 4px;
                    border-radius: 6px;
                }
                .group-toggle button {
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                }
                .group-toggle button.active {
                    background: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1><i class="mdi mdi-chart-timeline-variant-shimmer"></i> Schedule vs Attendance Variance</h1>
                <div class="header-nav">
                    <a href="/operational-excellence"><i class="mdi mdi-arrow-left"></i> Back</a>
                    <a href="/"><i class="mdi mdi-home"></i> Home</a>
                </div>
            </div>
            
            <div class="container">
                <!-- Tabs -->
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('thirdparty')">
                        <i class="mdi mdi-account-group"></i> Third Party Attendance
                    </button>
                    <button class="tab" onclick="switchTab('security')">
                        <i class="mdi mdi-shield-account"></i> Security Attendance
                    </button>
                    <button class="tab" onclick="switchTab('personnel')">
                        <i class="mdi mdi-account-clock"></i> Personnel Schedule
                    </button>
                </div>
                
                <!-- Third Party Tab -->
                <div id="thirdparty-tab" class="tab-content active">
                    <div class="filters-card">
                        <div class="filters-row">
                            <div class="filter-group">
                                <label>From Date</label>
                                <input type="date" id="tp-from-date">
                            </div>
                            <div class="filter-group">
                                <label>To Date</label>
                                <input type="date" id="tp-to-date">
                            </div>
                            <div class="filter-group">
                                <label>Store</label>
                                <select id="tp-store">
                                    <option value="">All Stores</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Company</label>
                                <select id="tp-company">
                                    <option value="">All Companies</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Variance Type</label>
                                <select id="tp-variance-type">
                                    <option value="">All Types</option>
                                    <option value="no-show">No Show</option>
                                    <option value="late">Late</option>
                                    <option value="early-leave">Early Leave</option>
                                    <option value="ghost">Ghost (Not Scheduled)</option>
                                    <option value="overtime">Overtime</option>
                                    <option value="match">Match</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="loadThirdPartyVariance()">
                                <i class="mdi mdi-magnify"></i> Search
                            </button>
                            <button class="btn btn-secondary" onclick="resetThirdPartyFilters()">
                                <i class="mdi mdi-refresh"></i> Reset
                            </button>
                        </div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="stats-grid" id="tp-stats">
                        <div class="stat-card total">
                            <div class="stat-value" id="tp-stat-total">-</div>
                            <div class="stat-label">Total Records</div>
                        </div>
                        <div class="stat-card no-show">
                            <div class="stat-value" id="tp-stat-no-show">-</div>
                            <div class="stat-label">No Show</div>
                        </div>
                        <div class="stat-card late">
                            <div class="stat-value" id="tp-stat-late">-</div>
                            <div class="stat-label">Late</div>
                        </div>
                        <div class="stat-card early">
                            <div class="stat-value" id="tp-stat-early">-</div>
                            <div class="stat-label">Early Leave</div>
                        </div>
                        <div class="stat-card ghost">
                            <div class="stat-value" id="tp-stat-ghost">-</div>
                            <div class="stat-label">Ghost</div>
                        </div>
                        <div class="stat-card overtime">
                            <div class="stat-value" id="tp-stat-overtime">-</div>
                            <div class="stat-label">Overtime</div>
                        </div>
                        <div class="stat-card match">
                            <div class="stat-value" id="tp-stat-match">-</div>
                            <div class="stat-label">Match</div>
                        </div>
                    </div>
                    
                    <!-- Results Table -->
                    <div class="table-card">
                        <div class="table-header">
                            <div class="table-title">Variance Details</div>
                            <div class="table-actions">
                                <div class="group-toggle">
                                    <button class="active" onclick="setGroupBy('none', 'tp')">Detail</button>
                                    <button onclick="setGroupBy('store', 'tp')">By Store</button>
                                    <button onclick="setGroupBy('company', 'tp')">By Company</button>
                                    <button onclick="setGroupBy('employee', 'tp')">By Employee</button>
                                </div>
                                <button class="btn btn-success" onclick="exportThirdParty()">
                                    <i class="mdi mdi-file-excel"></i> Export
                                </button>
                            </div>
                        </div>
                        <div id="tp-table-container">
                            <div class="empty-state">
                                <i class="mdi mdi-filter-outline"></i>
                                <h3>Select Date Range</h3>
                                <p>Choose a date range and click Search to view variance data</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Security Tab -->
                <div id="security-tab" class="tab-content">
                    <div class="filters-card">
                        <div class="filters-row">
                            <div class="filter-group">
                                <label>From Date</label>
                                <input type="date" id="sec-from-date">
                            </div>
                            <div class="filter-group">
                                <label>To Date</label>
                                <input type="date" id="sec-to-date">
                            </div>
                            <div class="filter-group">
                                <label>Store</label>
                                <select id="sec-store">
                                    <option value="">All Stores</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Company</label>
                                <select id="sec-company">
                                    <option value="">All Companies</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Variance Type</label>
                                <select id="sec-variance-type">
                                    <option value="">All Types</option>
                                    <option value="no-show">No Show</option>
                                    <option value="late">Late</option>
                                    <option value="early-leave">Early Leave</option>
                                    <option value="ghost">Ghost (Not Scheduled)</option>
                                    <option value="overtime">Overtime</option>
                                    <option value="match">Match</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="loadSecurityVariance()">
                                <i class="mdi mdi-magnify"></i> Search
                            </button>
                            <button class="btn btn-secondary" onclick="resetSecurityFilters()">
                                <i class="mdi mdi-refresh"></i> Reset
                            </button>
                        </div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="stats-grid" id="sec-stats">
                        <div class="stat-card total">
                            <div class="stat-value" id="sec-stat-total">-</div>
                            <div class="stat-label">Total Records</div>
                        </div>
                        <div class="stat-card no-show">
                            <div class="stat-value" id="sec-stat-no-show">-</div>
                            <div class="stat-label">No Show</div>
                        </div>
                        <div class="stat-card late">
                            <div class="stat-value" id="sec-stat-late">-</div>
                            <div class="stat-label">Late</div>
                        </div>
                        <div class="stat-card early">
                            <div class="stat-value" id="sec-stat-early">-</div>
                            <div class="stat-label">Early Leave</div>
                        </div>
                        <div class="stat-card ghost">
                            <div class="stat-value" id="sec-stat-ghost">-</div>
                            <div class="stat-label">Ghost</div>
                        </div>
                        <div class="stat-card overtime">
                            <div class="stat-value" id="sec-stat-overtime">-</div>
                            <div class="stat-label">Overtime</div>
                        </div>
                        <div class="stat-card match">
                            <div class="stat-value" id="sec-stat-match">-</div>
                            <div class="stat-label">Match</div>
                        </div>
                    </div>
                    
                    <!-- Results Table -->
                    <div class="table-card">
                        <div class="table-header">
                            <div class="table-title">Variance Details</div>
                            <div class="table-actions">
                                <div class="group-toggle">
                                    <button class="active" onclick="setGroupBy('none', 'sec')">Detail</button>
                                    <button onclick="setGroupBy('store', 'sec')">By Store</button>
                                    <button onclick="setGroupBy('company', 'sec')">By Company</button>
                                    <button onclick="setGroupBy('employee', 'sec')">By Employee</button>
                                </div>
                                <button class="btn btn-success" onclick="exportSecurity()">
                                    <i class="mdi mdi-file-excel"></i> Export
                                </button>
                            </div>
                        </div>
                        <div id="sec-table-container">
                            <div class="empty-state">
                                <i class="mdi mdi-filter-outline"></i>
                                <h3>Select Date Range</h3>
                                <p>Choose a date range and click Search to view variance data</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Personnel Tab -->
                <div id="personnel-tab" class="tab-content">
                    <div class="filters-card">
                        <div class="filters-row">
                            <div class="filter-group">
                                <label>From Date</label>
                                <input type="date" id="per-from-date">
                            </div>
                            <div class="filter-group">
                                <label>To Date</label>
                                <input type="date" id="per-to-date">
                            </div>
                            <div class="filter-group">
                                <label>Store</label>
                                <select id="per-store">
                                    <option value="">All Stores</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Company</label>
                                <select id="per-company">
                                    <option value="">All Companies</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label>Variance Type</label>
                                <select id="per-variance-type">
                                    <option value="">All Types</option>
                                    <option value="no-show">No Show</option>
                                    <option value="late">Late</option>
                                    <option value="early-leave">Early Leave</option>
                                    <option value="overtime">Overtime</option>
                                    <option value="match">Match</option>
                                </select>
                            </div>
                            <button class="btn btn-primary" onclick="loadPersonnelVariance()">
                                <i class="mdi mdi-magnify"></i> Search
                            </button>
                            <button class="btn btn-secondary" onclick="resetPersonnelFilters()">
                                <i class="mdi mdi-refresh"></i> Reset
                            </button>
                        </div>
                    </div>
                    
                    <!-- Stats -->
                    <div class="stats-grid" id="per-stats">
                        <div class="stat-card total">
                            <div class="stat-value" id="per-stat-total">-</div>
                            <div class="stat-label">Total Records</div>
                        </div>
                        <div class="stat-card no-show">
                            <div class="stat-value" id="per-stat-no-show">-</div>
                            <div class="stat-label">No Show</div>
                        </div>
                        <div class="stat-card late">
                            <div class="stat-value" id="per-stat-late">-</div>
                            <div class="stat-label">Late</div>
                        </div>
                        <div class="stat-card early">
                            <div class="stat-value" id="per-stat-early">-</div>
                            <div class="stat-label">Early Leave</div>
                        </div>
                        <div class="stat-card overtime">
                            <div class="stat-value" id="per-stat-overtime">-</div>
                            <div class="stat-label">Overtime</div>
                        </div>
                        <div class="stat-card match">
                            <div class="stat-value" id="per-stat-match">-</div>
                            <div class="stat-label">Match</div>
                        </div>
                    </div>
                    
                    <!-- Results Table -->
                    <div class="table-card">
                        <div class="table-header">
                            <div class="table-title">Personnel Schedule vs Actual</div>
                            <div class="table-actions">
                                <div class="group-toggle">
                                    <button class="active" onclick="setGroupBy('none', 'per')">Detail</button>
                                    <button onclick="setGroupBy('store', 'per')">By Store</button>
                                    <button onclick="setGroupBy('company', 'per')">By Company</button>
                                    <button onclick="setGroupBy('employee', 'per')">By Employee</button>
                                </div>
                                <button class="btn btn-success" onclick="exportPersonnel()">
                                    <i class="mdi mdi-file-excel"></i> Export
                                </button>
                            </div>
                        </div>
                        <div id="per-table-container">
                            <div class="empty-state">
                                <i class="mdi mdi-filter-outline"></i>
                                <h3>Select Date Range</h3>
                                <p>Choose a date range and click Search to view variance data</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
            </div>
            
            <script>
                let tpGroupBy = 'none';
                let secGroupBy = 'none';
                let perGroupBy = 'none';
                let tpData = [];
                let secData = [];
                let perData = [];
                
                // Initialize
                document.addEventListener('DOMContentLoaded', () => {
                    // Set default dates (last 7 days)
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    document.getElementById('tp-from-date').value = formatDate(weekAgo);
                    document.getElementById('tp-to-date').value = formatDate(today);
                    document.getElementById('sec-from-date').value = formatDate(weekAgo);
                    document.getElementById('sec-to-date').value = formatDate(today);
                    document.getElementById('per-from-date').value = formatDate(weekAgo);
                    document.getElementById('per-to-date').value = formatDate(today);
                    
                    // Load filter options
                    loadFilterOptions();
                });
                
                function formatDate(date) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return year + '-' + month + '-' + day;
                }
                
                function switchTab(tab) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    
                    event.target.closest('.tab').classList.add('active');
                    document.getElementById(tab + '-tab').classList.add('active');
                }
                
                async function loadFilterOptions() {
                    try {
                        const resp = await fetch('attendance-variance/api/filters');
                        const data = await resp.json();
                        
                        // Populate Third Party filters
                        const tpStoreSelect = document.getElementById('tp-store');
                        const tpCompanySelect = document.getElementById('tp-company');
                        
                        data.tpStores.forEach(store => {
                            const opt = document.createElement('option');
                            opt.value = store;
                            opt.textContent = store;
                            tpStoreSelect.appendChild(opt);
                        });
                        
                        data.tpCompanies.forEach(company => {
                            const opt = document.createElement('option');
                            opt.value = company;
                            opt.textContent = company;
                            tpCompanySelect.appendChild(opt);
                        });
                        
                        // Populate Security filters
                        const secStoreSelect = document.getElementById('sec-store');
                        const secCompanySelect = document.getElementById('sec-company');
                        
                        data.secStores.forEach(store => {
                            const opt = document.createElement('option');
                            opt.value = store;
                            opt.textContent = store;
                            secStoreSelect.appendChild(opt);
                        });
                        
                        data.secCompanies.forEach(company => {
                            const opt = document.createElement('option');
                            opt.value = company;
                            opt.textContent = company;
                            secCompanySelect.appendChild(opt);
                        });
                        
                        // Populate Personnel filters
                        const perStoreSelect = document.getElementById('per-store');
                        const perCompanySelect = document.getElementById('per-company');
                        
                        (data.perStores || []).forEach(store => {
                            const opt = document.createElement('option');
                            opt.value = store;
                            opt.textContent = store;
                            perStoreSelect.appendChild(opt);
                        });
                        
                        (data.perCompanies || []).forEach(company => {
                            const opt = document.createElement('option');
                            opt.value = company;
                            opt.textContent = company;
                            perCompanySelect.appendChild(opt);
                        });
                    } catch (err) {
                        console.error('Error loading filters:', err);
                    }
                }
                
                async function loadThirdPartyVariance() {
                    const fromDate = document.getElementById('tp-from-date').value;
                    const toDate = document.getElementById('tp-to-date').value;
                    const store = document.getElementById('tp-store').value;
                    const company = document.getElementById('tp-company').value;
                    const varianceType = document.getElementById('tp-variance-type').value;
                    
                    if (!fromDate || !toDate) {
                        alert('Please select both From and To dates');
                        return;
                    }
                    
                    showLoading(true);
                    
                    try {
                        const params = new URLSearchParams({
                            fromDate, toDate, store, company, varianceType, groupBy: tpGroupBy
                        });
                        
                        const resp = await fetch('attendance-variance/api/thirdparty?' + params);
                        const data = await resp.json();
                        
                        tpData = data.records;
                        
                        // Update stats
                        document.getElementById('tp-stat-total').textContent = data.stats.total;
                        document.getElementById('tp-stat-no-show').textContent = data.stats.noShow;
                        document.getElementById('tp-stat-late').textContent = data.stats.late;
                        document.getElementById('tp-stat-early').textContent = data.stats.earlyLeave;
                        document.getElementById('tp-stat-ghost').textContent = data.stats.ghost;
                        document.getElementById('tp-stat-overtime').textContent = data.stats.overtime;
                        document.getElementById('tp-stat-match').textContent = data.stats.match;
                        
                        // Render table
                        renderThirdPartyTable(data.records);
                    } catch (err) {
                        console.error('Error loading variance:', err);
                        alert('Error loading data');
                    } finally {
                        showLoading(false);
                    }
                }
                
                function formatVarianceMinutes(mins) {
                    if (mins === null || mins === undefined) return '-';
                    const sign = mins >= 0 ? '+' : '-';
                    const absMins = Math.abs(mins);
                    const hours = Math.floor(absMins / 60);
                    const minutes = absMins % 60;
                    return sign + hours + 'h ' + minutes + 'm';
                }
                
                function renderThirdPartyTable(records) {
                    const container = document.getElementById('tp-table-container');
                    
                    if (!records || records.length === 0) {
                        container.innerHTML = '<div class="empty-state"><i class="mdi mdi-check-circle-outline"></i><h3>No Variance Found</h3><p>No records match your filter criteria</p></div>';
                        return;
                    }
                    
                    if (tpGroupBy === 'none') {
                        // Detail view
                        let html = '<table><thead><tr>';
                        html += '<th>Date</th><th>Store</th><th>Company</th><th>Employee</th><th>Position</th>';
                        html += '<th>Scheduled In</th><th>Actual In</th><th>Scheduled Out</th><th>Actual Out</th>';
                        html += '<th>Variance (hrs)</th><th>Status</th></tr></thead><tbody>';
                        
                        records.forEach(r => {
                            const varBadge = getVarianceBadge(r.varianceType);
                            const inDiff = r.lateMinutes ? '<span class="time-diff positive">+' + r.lateMinutes + 'm</span>' : '';
                            const outDiff = r.earlyMinutes ? '<span class="time-diff positive">-' + r.earlyMinutes + 'm</span>' : '';
                            const varianceDisplay = formatVarianceMinutes(r.varianceMinutes);
                            const varianceClass = r.varianceMinutes === null ? '' : (r.varianceMinutes >= 0 ? 'time-diff negative' : 'time-diff positive');
                            
                            html += '<tr>';
                            html += '<td>' + formatDisplayDate(r.date) + '</td>';
                            html += '<td>' + (r.storeName || '-') + '</td>';
                            html += '<td>' + (r.company || '-') + '</td>';
                            html += '<td>' + (r.employeeName || '-') + '</td>';
                            html += '<td>' + (r.position || '-') + '</td>';
                            html += '<td class="time-scheduled">' + (r.scheduledIn || '-') + '</td>';
                            html += '<td class="time-actual">' + (r.actualIn || '-') + inDiff + '</td>';
                            html += '<td class="time-scheduled">' + (r.scheduledOut || '-') + '</td>';
                            html += '<td class="time-actual">' + (r.actualOut || '-') + outDiff + '</td>';
                            html += '<td><span class="' + varianceClass + '" style="font-weight:600;">' + varianceDisplay + '</span></td>';
                            html += '<td>' + varBadge + '</td>';
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    } else {
                        // Grouped view
                        let html = '<table><thead><tr>';
                        html += '<th>' + capitalize(tpGroupBy) + '</th>';
                        html += '<th>Total</th><th>No Show</th><th>Late</th><th>Early Leave</th>';
                        html += '<th>Ghost</th><th>Overtime</th><th>Match</th></tr></thead><tbody>';
                        
                        records.forEach(r => {
                            html += '<tr>';
                            html += '<td><strong>' + (r.groupName || '-') + '</strong></td>';
                            html += '<td>' + r.total + '</td>';
                            html += '<td>' + r.noShow + '</td>';
                            html += '<td>' + r.late + '</td>';
                            html += '<td>' + r.earlyLeave + '</td>';
                            html += '<td>' + r.ghost + '</td>';
                            html += '<td>' + r.overtime + '</td>';
                            html += '<td>' + r.match + '</td>';
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    }
                }
                
                async function loadSecurityVariance() {
                    const fromDate = document.getElementById('sec-from-date').value;
                    const toDate = document.getElementById('sec-to-date').value;
                    const store = document.getElementById('sec-store').value;
                    const company = document.getElementById('sec-company').value;
                    const varianceType = document.getElementById('sec-variance-type').value;
                    
                    if (!fromDate || !toDate) {
                        alert('Please select both From and To dates');
                        return;
                    }
                    
                    showLoading(true);
                    
                    try {
                        const params = new URLSearchParams({
                            fromDate, toDate, store, company, varianceType, groupBy: secGroupBy
                        });
                        
                        const resp = await fetch('attendance-variance/api/security?' + params);
                        const data = await resp.json();
                        
                        secData = data.records;
                        
                        // Update stats
                        document.getElementById('sec-stat-total').textContent = data.stats.total;
                        document.getElementById('sec-stat-no-show').textContent = data.stats.noShow;
                        document.getElementById('sec-stat-late').textContent = data.stats.late;
                        document.getElementById('sec-stat-early').textContent = data.stats.earlyLeave;
                        document.getElementById('sec-stat-ghost').textContent = data.stats.ghost;
                        document.getElementById('sec-stat-overtime').textContent = data.stats.overtime;
                        document.getElementById('sec-stat-match').textContent = data.stats.match;
                        
                        // Render table
                        renderSecurityTable(data.records);
                    } catch (err) {
                        console.error('Error loading variance:', err);
                        alert('Error loading data');
                    } finally {
                        showLoading(false);
                    }
                }
                
                function renderSecurityTable(records) {
                    const container = document.getElementById('sec-table-container');
                    
                    if (!records || records.length === 0) {
                        container.innerHTML = '<div class="empty-state"><i class="mdi mdi-check-circle-outline"></i><h3>No Variance Found</h3><p>No records match your filter criteria</p></div>';
                        return;
                    }
                    
                    if (secGroupBy === 'none') {
                        // Detail view
                        let html = '<table><thead><tr>';
                        html += '<th>Date</th><th>Store</th><th>Company</th><th>Employee</th><th>Position</th>';
                        html += '<th>Scheduled In</th><th>Actual In</th><th>Scheduled Out</th><th>Actual Out</th>';
                        html += '<th>Variance (hrs)</th><th>Status</th></tr></thead><tbody>';
                        
                        records.forEach(r => {
                            const varBadge = getVarianceBadge(r.varianceType);
                            const inDiff = r.lateMinutes ? '<span class="time-diff positive">+' + r.lateMinutes + 'm</span>' : '';
                            const outDiff = r.earlyMinutes ? '<span class="time-diff positive">-' + r.earlyMinutes + 'm</span>' : '';
                            const varianceDisplay = formatVarianceMinutes(r.varianceMinutes);
                            const varianceClass = r.varianceMinutes === null ? '' : (r.varianceMinutes >= 0 ? 'time-diff negative' : 'time-diff positive');
                            
                            html += '<tr>';
                            html += '<td>' + formatDisplayDate(r.date) + '</td>';
                            html += '<td>' + (r.storeName || '-') + '</td>';
                            html += '<td>' + (r.company || '-') + '</td>';
                            html += '<td>' + (r.employeeName || '-') + '</td>';
                            html += '<td>' + (r.position || '-') + '</td>';
                            html += '<td class="time-scheduled">' + (r.scheduledIn || '-') + '</td>';
                            html += '<td class="time-actual">' + (r.actualIn || '-') + inDiff + '</td>';
                            html += '<td class="time-scheduled">' + (r.scheduledOut || '-') + '</td>';
                            html += '<td class="time-actual">' + (r.actualOut || '-') + outDiff + '</td>';
                            html += '<td><span class="' + varianceClass + '" style="font-weight:600;">' + varianceDisplay + '</span></td>';
                            html += '<td>' + varBadge + '</td>';
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    } else {
                        // Grouped view
                        let html = '<table><thead><tr>';
                        html += '<th>' + capitalize(secGroupBy) + '</th>';
                        html += '<th>Total</th><th>No Show</th><th>Late</th><th>Early Leave</th>';
                        html += '<th>Ghost</th><th>Overtime</th><th>Match</th></tr></thead><tbody>';
                        
                        records.forEach(r => {
                            html += '<tr>';
                            html += '<td><strong>' + (r.groupName || '-') + '</strong></td>';
                            html += '<td>' + r.total + '</td>';
                            html += '<td>' + r.noShow + '</td>';
                            html += '<td>' + r.late + '</td>';
                            html += '<td>' + r.earlyLeave + '</td>';
                            html += '<td>' + r.ghost + '</td>';
                            html += '<td>' + r.overtime + '</td>';
                            html += '<td>' + r.match + '</td>';
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    }
                }
                
                function setGroupBy(group, type) {
                    const container = document.querySelector('#' + type + '-tab .group-toggle');
                    container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    event.target.classList.add('active');
                    
                    if (type === 'tp') {
                        tpGroupBy = group;
                        loadThirdPartyVariance();
                    } else if (type === 'sec') {
                        secGroupBy = group;
                        loadSecurityVariance();
                    } else if (type === 'per') {
                        perGroupBy = group;
                        loadPersonnelVariance();
                    }
                }
                
                function getVarianceBadge(type) {
                    const badges = {
                        'no-show': '<span class="variance-badge variance-no-show">No Show</span>',
                        'late': '<span class="variance-badge variance-late">Late</span>',
                        'early-leave': '<span class="variance-badge variance-early-leave">Early Leave</span>',
                        'ghost': '<span class="variance-badge variance-ghost">Ghost</span>',
                        'overtime': '<span class="variance-badge variance-overtime">Overtime</span>',
                        'match': '<span class="variance-badge variance-match">Match</span>'
                    };
                    return badges[type] || type;
                }
                
                function formatDisplayDate(dateStr) {
                    if (!dateStr) return '-';
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('en-GB');
                }
                
                function capitalize(str) {
                    return str.charAt(0).toUpperCase() + str.slice(1);
                }
                
                function resetThirdPartyFilters() {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    document.getElementById('tp-from-date').value = formatDate(weekAgo);
                    document.getElementById('tp-to-date').value = formatDate(today);
                    document.getElementById('tp-store').value = '';
                    document.getElementById('tp-company').value = '';
                    document.getElementById('tp-variance-type').value = '';
                    
                    tpGroupBy = 'none';
                    document.querySelector('#thirdparty-tab .group-toggle').querySelectorAll('button').forEach((b, i) => {
                        b.classList.toggle('active', i === 0);
                    });
                }
                
                function resetSecurityFilters() {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    document.getElementById('sec-from-date').value = formatDate(weekAgo);
                    document.getElementById('sec-to-date').value = formatDate(today);
                    document.getElementById('sec-store').value = '';
                    document.getElementById('sec-company').value = '';
                    document.getElementById('sec-variance-type').value = '';
                    
                    secGroupBy = 'none';
                    document.querySelector('#security-tab .group-toggle').querySelectorAll('button').forEach((b, i) => {
                        b.classList.toggle('active', i === 0);
                    });
                }
                
                async function exportThirdParty() {
                    const fromDate = document.getElementById('tp-from-date').value;
                    const toDate = document.getElementById('tp-to-date').value;
                    const store = document.getElementById('tp-store').value;
                    const company = document.getElementById('tp-company').value;
                    const varianceType = document.getElementById('tp-variance-type').value;
                    
                    const params = new URLSearchParams({
                        fromDate, toDate, store, company, varianceType, groupBy: tpGroupBy
                    });
                    
                    window.location.href = 'attendance-variance/api/thirdparty/export?' + params;
                }
                
                async function exportSecurity() {
                    const fromDate = document.getElementById('sec-from-date').value;
                    const toDate = document.getElementById('sec-to-date').value;
                    const store = document.getElementById('sec-store').value;
                    const company = document.getElementById('sec-company').value;
                    const varianceType = document.getElementById('sec-variance-type').value;
                    
                    const params = new URLSearchParams({
                        fromDate, toDate, store, company, varianceType, groupBy: secGroupBy
                    });
                    
                    window.location.href = 'attendance-variance/api/security/export?' + params;
                }
                
                // Personnel Functions
                async function loadPersonnelVariance() {
                    const fromDate = document.getElementById('per-from-date').value;
                    const toDate = document.getElementById('per-to-date').value;
                    const store = document.getElementById('per-store').value;
                    const company = document.getElementById('per-company').value;
                    const varianceType = document.getElementById('per-variance-type').value;
                    
                    if (!fromDate || !toDate) {
                        alert('Please select both From and To dates');
                        return;
                    }
                    
                    showLoading(true);
                    
                    try {
                        const params = new URLSearchParams({
                            fromDate, toDate, store, company, varianceType, groupBy: perGroupBy
                        });
                        
                        const resp = await fetch('attendance-variance/api/personnel?' + params);
                        const data = await resp.json();
                        
                        perData = data.records;
                        
                        // Update stats
                        document.getElementById('per-stat-total').textContent = data.stats.total;
                        document.getElementById('per-stat-no-show').textContent = data.stats.noShow;
                        document.getElementById('per-stat-late').textContent = data.stats.late;
                        document.getElementById('per-stat-early').textContent = data.stats.earlyLeave;
                        document.getElementById('per-stat-overtime').textContent = data.stats.overtime;
                        document.getElementById('per-stat-match').textContent = data.stats.match;
                        
                        // Render table
                        renderPersonnelTable(data.records);
                    } catch (err) {
                        console.error('Error loading personnel variance:', err);
                        alert('Error loading data');
                    } finally {
                        showLoading(false);
                    }
                }
                
                function renderPersonnelTable(records) {
                    const container = document.getElementById('per-table-container');
                    
                    if (!records || records.length === 0) {
                        container.innerHTML = '<div class="empty-state"><i class="mdi mdi-check-circle-outline"></i><h3>No Variance Found</h3><p>No records match your filter criteria</p></div>';
                        return;
                    }
                    
                    if (perGroupBy === 'none') {
                        // Detail view
                        let html = '<table><thead><tr>';
                        html += '<th>Date</th><th>Store</th><th>Company</th><th>Employee</th><th>Position</th>';
                        html += '<th>Scheduled In</th><th>Actual In</th><th>Scheduled Out</th><th>Actual Out</th>';
                        html += '<th>Variance (hrs)</th><th>Status</th></tr></thead><tbody>';
                        
                        records.forEach(r => {
                            const varBadge = getVarianceBadge(r.varianceType);
                            const inDiff = r.lateMinutes ? '<span class="time-diff positive">+' + r.lateMinutes + 'm</span>' : '';
                            const outDiff = r.earlyMinutes ? '<span class="time-diff positive">-' + r.earlyMinutes + 'm</span>' : '';
                            const varianceDisplay = formatVarianceMinutes(r.varianceMinutes);
                            const varianceClass = r.varianceMinutes === null ? '' : (r.varianceMinutes >= 0 ? 'time-diff negative' : 'time-diff positive');
                            
                            html += '<tr>';
                            html += '<td>' + formatDisplayDate(r.date) + '</td>';
                            html += '<td>' + (r.storeName || '-') + '</td>';
                            html += '<td>' + (r.company || '-') + '</td>';
                            html += '<td>' + (r.employeeName || '-') + '</td>';
                            html += '<td>' + (r.position || '-') + '</td>';
                            html += '<td class="time-scheduled">' + (r.scheduledIn || '-') + '</td>';
                            html += '<td class="time-actual">' + (r.actualIn || '-') + inDiff + '</td>';
                            html += '<td class="time-scheduled">' + (r.scheduledOut || '-') + '</td>';
                            html += '<td class="time-actual">' + (r.actualOut || '-') + outDiff + '</td>';
                            html += '<td><span class="' + varianceClass + '" style="font-weight:600;">' + varianceDisplay + '</span></td>';
                            html += '<td>' + varBadge + '</td>';
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    } else {
                        // Grouped view
                        let html = '<table><thead><tr>';
                        html += '<th>' + capitalize(perGroupBy) + '</th>';
                        html += '<th>Total</th><th>No Show</th><th>Late</th><th>Early Leave</th>';
                        html += '<th>Overtime</th><th>Match</th></tr></thead><tbody>';
                        
                        records.forEach(r => {
                            html += '<tr>';
                            html += '<td><strong>' + (r.groupName || '-') + '</strong></td>';
                            html += '<td>' + r.total + '</td>';
                            html += '<td>' + r.noShow + '</td>';
                            html += '<td>' + r.late + '</td>';
                            html += '<td>' + r.earlyLeave + '</td>';
                            html += '<td>' + r.overtime + '</td>';
                            html += '<td>' + r.match + '</td>';
                            html += '</tr>';
                        });
                        
                        html += '</tbody></table>';
                        container.innerHTML = html;
                    }
                }
                
                function resetPersonnelFilters() {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    
                    document.getElementById('per-from-date').value = formatDate(weekAgo);
                    document.getElementById('per-to-date').value = formatDate(today);
                    document.getElementById('per-store').value = '';
                    document.getElementById('per-company').value = '';
                    document.getElementById('per-variance-type').value = '';
                    
                    perGroupBy = 'none';
                    document.querySelector('#personnel-tab .group-toggle').querySelectorAll('button').forEach((b, i) => {
                        b.classList.toggle('active', i === 0);
                    });
                }
                
                async function exportPersonnel() {
                    const fromDate = document.getElementById('per-from-date').value;
                    const toDate = document.getElementById('per-to-date').value;
                    const store = document.getElementById('per-store').value;
                    const company = document.getElementById('per-company').value;
                    const varianceType = document.getElementById('per-variance-type').value;
                    
                    const params = new URLSearchParams({
                        fromDate, toDate, store, company, varianceType, groupBy: perGroupBy
                    });
                    
                    window.location.href = 'attendance-variance/api/personnel/export?' + params;
                }
                
                function showLoading(show) {
                    document.getElementById('loading').classList.toggle('active', show);
                }
            </script>
        </body>
        </html>
    `);
});

// API: Get filter options
router.get('/api/filters', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Third Party filters
        const tpStores = await pool.request().query(`
            SELECT DISTINCT StoreName FROM ThirdpartySchedules 
            WHERE StoreName IS NOT NULL AND StoreName != '' 
            ORDER BY StoreName
        `);
        
        const tpCompanies = await pool.request().query(`
            SELECT DISTINCT CompanyName FROM ThirdpartyScheduleEmployees 
            WHERE CompanyName IS NOT NULL AND CompanyName != '' 
            ORDER BY CompanyName
        `);
        
        // Security filters
        const secStores = await pool.request().query(`
            SELECT DISTINCT StoreName FROM SecuritySchedules 
            WHERE StoreName IS NOT NULL AND StoreName != '' 
            ORDER BY StoreName
        `);
        
        const secCompanies = await pool.request().query(`
            SELECT DISTINCT CompanyName FROM SecurityScheduleEmployees 
            WHERE CompanyName IS NOT NULL AND CompanyName != '' 
            ORDER BY CompanyName
        `);
        
        // Personnel filters
        const perStores = await pool.request().query(`
            SELECT DISTINCT Store FROM Personnel_Employees 
            WHERE Store IS NOT NULL AND Store != '' AND IsActive = 1
            ORDER BY Store
        `);
        
        const perCompanies = await pool.request().query(`
            SELECT DISTINCT Company FROM Personnel_Employees 
            WHERE Company IS NOT NULL AND Company != '' AND IsActive = 1
            ORDER BY Company
        `);
        
        await pool.close();
        
        res.json({
            tpStores: tpStores.recordset.map(r => r.StoreName),
            tpCompanies: tpCompanies.recordset.map(r => r.CompanyName),
            secStores: secStores.recordset.map(r => r.StoreName),
            secCompanies: secCompanies.recordset.map(r => r.CompanyName),
            perStores: perStores.recordset.map(r => r.Store),
            perCompanies: perCompanies.recordset.map(r => r.Company)
        });
    } catch (err) {
        console.error('Error loading filters:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get Third Party variance
router.get('/api/thirdparty', async (req, res) => {
    try {
        const { fromDate, toDate, store, company, varianceType, groupBy } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        
        request.input('fromDate', sql.Date, fromDate);
        request.input('toDate', sql.Date, toDate);
        
        // Build filter conditions
        let filters = '';
        if (store) {
            request.input('store', sql.NVarChar, store);
            filters += ' AND s.StoreName = @store';
        }
        if (company) {
            request.input('company', sql.NVarChar, company);
            filters += ' AND e.CompanyName = @company';
        }
        
        // Get all scheduled entries for the date range
        const scheduledQuery = `
            WITH DateRange AS (
                SELECT CAST(@fromDate AS DATE) as TheDate
                UNION ALL
                SELECT DATEADD(DAY, 1, TheDate) FROM DateRange WHERE TheDate < @toDate
            ),
            ScheduledShifts AS (
                SELECT 
                    d.TheDate as ScheduleDate,
                    s.StoreName,
                    e.CompanyName,
                    e.EmployeeId,
                    e.EmployeeName,
                    e.EmployeePosition,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MonOff = 1 THEN NULL ELSE e.MonFrom END
                        WHEN 'Tuesday' THEN CASE WHEN e.TueOff = 1 THEN NULL ELSE e.TueFrom END
                        WHEN 'Wednesday' THEN CASE WHEN e.WedOff = 1 THEN NULL ELSE e.WedFrom END
                        WHEN 'Thursday' THEN CASE WHEN e.ThuOff = 1 THEN NULL ELSE e.ThuFrom END
                        WHEN 'Friday' THEN CASE WHEN e.FriOff = 1 THEN NULL ELSE e.FriFrom END
                        WHEN 'Saturday' THEN CASE WHEN e.SatOff = 1 THEN NULL ELSE e.SatFrom END
                        WHEN 'Sunday' THEN CASE WHEN e.SunOff = 1 THEN NULL ELSE e.SunFrom END
                    END as ScheduledIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MonOff = 1 THEN NULL ELSE e.MonTo END
                        WHEN 'Tuesday' THEN CASE WHEN e.TueOff = 1 THEN NULL ELSE e.TueTo END
                        WHEN 'Wednesday' THEN CASE WHEN e.WedOff = 1 THEN NULL ELSE e.WedTo END
                        WHEN 'Thursday' THEN CASE WHEN e.ThuOff = 1 THEN NULL ELSE e.ThuTo END
                        WHEN 'Friday' THEN CASE WHEN e.FriOff = 1 THEN NULL ELSE e.FriTo END
                        WHEN 'Saturday' THEN CASE WHEN e.SatOff = 1 THEN NULL ELSE e.SatTo END
                        WHEN 'Sunday' THEN CASE WHEN e.SunOff = 1 THEN NULL ELSE e.SunTo END
                    END as ScheduledOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN e.MonOff
                        WHEN 'Tuesday' THEN e.TueOff
                        WHEN 'Wednesday' THEN e.WedOff
                        WHEN 'Thursday' THEN e.ThuOff
                        WHEN 'Friday' THEN e.FriOff
                        WHEN 'Saturday' THEN e.SatOff
                        WHEN 'Sunday' THEN e.SunOff
                    END as IsDayOff
                FROM DateRange d
                CROSS JOIN ThirdpartySchedules s
                INNER JOIN ThirdpartyScheduleEmployees e ON s.Id = e.ScheduleId
                WHERE d.TheDate BETWEEN s.FromDate AND s.ToDate
                ${filters}
            )
            SELECT 
                ss.ScheduleDate as [date],
                ss.StoreName as storeName,
                ss.CompanyName as company,
                ss.EmployeeId as employeeId,
                ss.EmployeeName as employeeName,
                ss.EmployeePosition as position,
                ss.ScheduledIn as scheduledIn,
                ss.ScheduledOut as scheduledOut,
                ss.IsDayOff as isDayOff,
                a.TimeIn as actualIn,
                a.TimeOut as actualOut,
                a.TotalHours as totalHours,
                CASE 
                    WHEN ss.IsDayOff = 1 AND a.Id IS NOT NULL THEN 'ghost'
                    WHEN ss.ScheduledIn IS NOT NULL AND a.Id IS NULL THEN 'no-show'
                    WHEN ss.ScheduledIn IS NULL AND a.Id IS NOT NULL THEN 'ghost'
                    ELSE 'scheduled'
                END as baseVariance
            FROM ScheduledShifts ss
            LEFT JOIN ThirdpartyAttendance a ON 
                a.AttendanceDate = ss.ScheduleDate
                AND (LTRIM(RTRIM(ISNULL(a.FirstName, '') + ' ' + ISNULL(a.LastName, ''))) = ss.EmployeeName 
                     OR LTRIM(RTRIM(a.FirstName)) = ss.EmployeeName
                     OR LTRIM(RTRIM(ISNULL(a.FirstName, '') + ISNULL(a.LastName, ''))) = REPLACE(ss.EmployeeName, ' ', ''))
                AND a.StoreName = ss.StoreName
            WHERE ss.IsDayOff = 0 OR a.Id IS NOT NULL
            OPTION (MAXRECURSION 400)
        `;
        
        const scheduled = await request.query(scheduledQuery);
        
        // Also get attendance records that don't match any schedule (ghosts)
        const request2 = pool.request();
        request2.input('fromDate', sql.Date, fromDate);
        request2.input('toDate', sql.Date, toDate);
        
        let ghostFilters = '';
        if (store) {
            request2.input('store', sql.NVarChar, store);
            ghostFilters += ' AND a.StoreName = @store';
        }
        if (company) {
            request2.input('company', sql.NVarChar, company);
            ghostFilters += ' AND a.Company = @company';
        }
        
        const ghostQuery = `
            SELECT 
                a.AttendanceDate as [date],
                a.StoreName as storeName,
                a.Company as company,
                NULL as employeeId,
                LTRIM(RTRIM(ISNULL(a.FirstName, '') + ' ' + ISNULL(a.LastName, ''))) as employeeName,
                a.WorkerType as position,
                NULL as scheduledIn,
                NULL as scheduledOut,
                a.TimeIn as actualIn,
                a.TimeOut as actualOut,
                'ghost' as baseVariance
            FROM ThirdpartyAttendance a
            WHERE a.AttendanceDate BETWEEN @fromDate AND @toDate
            ${ghostFilters}
            AND NOT EXISTS (
                SELECT 1 FROM ThirdpartySchedules s
                INNER JOIN ThirdpartyScheduleEmployees e ON s.Id = e.ScheduleId
                WHERE a.AttendanceDate BETWEEN s.FromDate AND s.ToDate
                AND s.StoreName = a.StoreName
                AND (e.EmployeeName = LTRIM(RTRIM(ISNULL(a.FirstName, '') + ' ' + ISNULL(a.LastName, ''))) 
                     OR e.EmployeeName = a.FirstName)
            )
        `;
        
        const ghosts = await request2.query(ghostQuery);
        
        await pool.close();
        
        // Process all records and calculate variances
        const allRecords = [...scheduled.recordset, ...ghosts.recordset];
        const processedRecords = allRecords.map(r => {
            let varianceType = r.baseVariance;
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let varianceMinutes = null;
            
            // Calculate variance: (Actual Out - Actual In) - (Scheduled Out - Scheduled In)
            const actualInMins = parseTimeToMinutes(r.actualIn);
            const actualOutMins = parseTimeToMinutes(r.actualOut);
            const schedInMins = parseTimeToMinutes(r.scheduledIn);
            const schedOutMins = parseTimeToMinutes(r.scheduledOut);
            
            if (actualInMins !== null && actualOutMins !== null && schedInMins !== null && schedOutMins !== null) {
                const actualHours = actualOutMins - actualInMins;
                const scheduledHours = schedOutMins - schedInMins;
                varianceMinutes = actualHours - scheduledHours;
            }
            
            if (varianceType === 'scheduled' && r.scheduledIn && r.actualIn) {
                const lateVar = calculateVariance(r.scheduledIn, r.actualIn, 'in');
                const earlyVar = calculateVariance(r.scheduledOut, r.actualOut, 'out');
                
                // Check for late (more than 15 minutes late)
                if (lateVar !== null && lateVar > 15) {
                    varianceType = 'late';
                    lateMinutes = lateVar;
                }
                // Check for early leave (more than 15 minutes early)
                else if (earlyVar !== null && earlyVar > 15) {
                    varianceType = 'early-leave';
                    earlyMinutes = earlyVar;
                }
                // Check for overtime (stayed more than 30 minutes extra)
                else if (earlyVar !== null && earlyVar < -30) {
                    varianceType = 'overtime';
                }
                else {
                    varianceType = 'match';
                }
            }
            
            return {
                ...r,
                varianceType,
                varianceMinutes,
                lateMinutes: lateMinutes > 0 ? lateMinutes : null,
                earlyMinutes: earlyMinutes > 0 ? earlyMinutes : null
            };
        });
        
        // Filter by variance type if specified
        let filteredRecords = processedRecords;
        if (varianceType) {
            filteredRecords = processedRecords.filter(r => r.varianceType === varianceType);
        }
        
        // Calculate stats
        const stats = {
            total: filteredRecords.length,
            noShow: processedRecords.filter(r => r.varianceType === 'no-show').length,
            late: processedRecords.filter(r => r.varianceType === 'late').length,
            earlyLeave: processedRecords.filter(r => r.varianceType === 'early-leave').length,
            ghost: processedRecords.filter(r => r.varianceType === 'ghost').length,
            overtime: processedRecords.filter(r => r.varianceType === 'overtime').length,
            match: processedRecords.filter(r => r.varianceType === 'match').length
        };
        
        // Group if needed
        let resultRecords = filteredRecords;
        if (groupBy && groupBy !== 'none') {
            const grouped = {};
            filteredRecords.forEach(r => {
                let key;
                if (groupBy === 'store') key = r.storeName || 'Unknown';
                else if (groupBy === 'company') key = r.company || 'Unknown';
                else if (groupBy === 'employee') key = r.employeeName || 'Unknown';
                else key = 'All';
                
                if (!grouped[key]) {
                    grouped[key] = {
                        groupName: key,
                        total: 0,
                        noShow: 0,
                        late: 0,
                        earlyLeave: 0,
                        ghost: 0,
                        overtime: 0,
                        match: 0
                    };
                }
                
                grouped[key].total++;
                if (r.varianceType === 'no-show') grouped[key].noShow++;
                else if (r.varianceType === 'late') grouped[key].late++;
                else if (r.varianceType === 'early-leave') grouped[key].earlyLeave++;
                else if (r.varianceType === 'ghost') grouped[key].ghost++;
                else if (r.varianceType === 'overtime') grouped[key].overtime++;
                else if (r.varianceType === 'match') grouped[key].match++;
            });
            
            resultRecords = Object.values(grouped).sort((a, b) => b.total - a.total);
        }
        
        res.json({ records: resultRecords, stats });
    } catch (err) {
        console.error('Error getting thirdparty variance:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Export Third Party variance
router.get('/api/thirdparty/export', async (req, res) => {
    try {
        const { fromDate, toDate, store, company, varianceType, groupBy } = req.query;
        
        // Reuse the same logic as the main API
        const params = new URLSearchParams({ fromDate, toDate, store, company, varianceType, groupBy });
        const protocol = req.protocol;
        const host = req.get('host');
        
        // Fetch data internally
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        
        request.input('fromDate', sql.Date, fromDate);
        request.input('toDate', sql.Date, toDate);
        
        let filters = '';
        if (store) {
            request.input('store', sql.NVarChar, store);
            filters += ' AND s.StoreName = @store';
        }
        if (company) {
            request.input('company', sql.NVarChar, company);
            filters += ' AND e.CompanyName = @company';
        }
        
        const scheduledQuery = `
            WITH DateRange AS (
                SELECT CAST(@fromDate AS DATE) as TheDate
                UNION ALL
                SELECT DATEADD(DAY, 1, TheDate) FROM DateRange WHERE TheDate < @toDate
            ),
            ScheduledShifts AS (
                SELECT 
                    d.TheDate as ScheduleDate,
                    s.StoreName,
                    e.CompanyName,
                    e.EmployeeId,
                    e.EmployeeName,
                    e.EmployeePosition,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MonOff = 1 THEN NULL ELSE e.MonFrom END
                        WHEN 'Tuesday' THEN CASE WHEN e.TueOff = 1 THEN NULL ELSE e.TueFrom END
                        WHEN 'Wednesday' THEN CASE WHEN e.WedOff = 1 THEN NULL ELSE e.WedFrom END
                        WHEN 'Thursday' THEN CASE WHEN e.ThuOff = 1 THEN NULL ELSE e.ThuFrom END
                        WHEN 'Friday' THEN CASE WHEN e.FriOff = 1 THEN NULL ELSE e.FriFrom END
                        WHEN 'Saturday' THEN CASE WHEN e.SatOff = 1 THEN NULL ELSE e.SatFrom END
                        WHEN 'Sunday' THEN CASE WHEN e.SunOff = 1 THEN NULL ELSE e.SunFrom END
                    END as ScheduledIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MonOff = 1 THEN NULL ELSE e.MonTo END
                        WHEN 'Tuesday' THEN CASE WHEN e.TueOff = 1 THEN NULL ELSE e.TueTo END
                        WHEN 'Wednesday' THEN CASE WHEN e.WedOff = 1 THEN NULL ELSE e.WedTo END
                        WHEN 'Thursday' THEN CASE WHEN e.ThuOff = 1 THEN NULL ELSE e.ThuTo END
                        WHEN 'Friday' THEN CASE WHEN e.FriOff = 1 THEN NULL ELSE e.FriTo END
                        WHEN 'Saturday' THEN CASE WHEN e.SatOff = 1 THEN NULL ELSE e.SatTo END
                        WHEN 'Sunday' THEN CASE WHEN e.SunOff = 1 THEN NULL ELSE e.SunTo END
                    END as ScheduledOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN e.MonOff
                        WHEN 'Tuesday' THEN e.TueOff
                        WHEN 'Wednesday' THEN e.WedOff
                        WHEN 'Thursday' THEN e.ThuOff
                        WHEN 'Friday' THEN e.FriOff
                        WHEN 'Saturday' THEN e.SatOff
                        WHEN 'Sunday' THEN e.SunOff
                    END as IsDayOff
                FROM DateRange d
                CROSS JOIN ThirdpartySchedules s
                INNER JOIN ThirdpartyScheduleEmployees e ON s.Id = e.ScheduleId
                WHERE d.TheDate BETWEEN s.FromDate AND s.ToDate
                ${filters}
            )
            SELECT 
                ss.ScheduleDate as [date],
                ss.StoreName as storeName,
                ss.CompanyName as company,
                ss.EmployeeId as employeeId,
                ss.EmployeeName as employeeName,
                ss.EmployeePosition as position,
                ss.ScheduledIn as scheduledIn,
                ss.ScheduledOut as scheduledOut,
                ss.IsDayOff as isDayOff,
                a.TimeIn as actualIn,
                a.TimeOut as actualOut,
                CASE 
                    WHEN ss.IsDayOff = 1 AND a.Id IS NOT NULL THEN 'ghost'
                    WHEN ss.ScheduledIn IS NOT NULL AND a.Id IS NULL THEN 'no-show'
                    WHEN ss.ScheduledIn IS NULL AND a.Id IS NOT NULL THEN 'ghost'
                    ELSE 'scheduled'
                END as baseVariance
            FROM ScheduledShifts ss
            LEFT JOIN ThirdpartyAttendance a ON 
                a.AttendanceDate = ss.ScheduleDate
                AND (LTRIM(RTRIM(ISNULL(a.FirstName, '') + ' ' + ISNULL(a.LastName, ''))) = ss.EmployeeName 
                     OR LTRIM(RTRIM(a.FirstName)) = ss.EmployeeName
                     OR LTRIM(RTRIM(ISNULL(a.FirstName, '') + ISNULL(a.LastName, ''))) = REPLACE(ss.EmployeeName, ' ', ''))
                AND a.StoreName = ss.StoreName
            WHERE ss.IsDayOff = 0 OR a.Id IS NOT NULL
            OPTION (MAXRECURSION 400)
        `;
        
        const scheduled = await request.query(scheduledQuery);
        await pool.close();
        
        // Process records
        const processedRecords = scheduled.recordset.map(r => {
            let vType = r.baseVariance;
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let varianceMinutes = null;
            
            // Calculate variance: (Actual Out - Actual In) - (Scheduled Out - Scheduled In)
            const actualInMins = parseTimeToMinutes(r.actualIn);
            const actualOutMins = parseTimeToMinutes(r.actualOut);
            const schedInMins = parseTimeToMinutes(r.scheduledIn);
            const schedOutMins = parseTimeToMinutes(r.scheduledOut);
            
            if (actualInMins !== null && actualOutMins !== null && schedInMins !== null && schedOutMins !== null) {
                const actualHours = actualOutMins - actualInMins;
                const scheduledHours = schedOutMins - schedInMins;
                varianceMinutes = actualHours - scheduledHours;
            }
            
            if (vType === 'scheduled' && r.scheduledIn && r.actualIn) {
                const lateVar = calculateVariance(r.scheduledIn, r.actualIn, 'in');
                const earlyVar = calculateVariance(r.scheduledOut, r.actualOut, 'out');
                
                if (lateVar !== null && lateVar > 15) {
                    vType = 'late';
                    lateMinutes = lateVar;
                } else if (earlyVar !== null && earlyVar > 15) {
                    vType = 'early-leave';
                    earlyMinutes = earlyVar;
                } else if (earlyVar !== null && earlyVar < -30) {
                    vType = 'overtime';
                } else {
                    vType = 'match';
                }
            }
            
            return { ...r, varianceType: vType, varianceMinutes, lateMinutes, earlyMinutes };
        });
        
        let filteredRecords = processedRecords;
        if (varianceType) {
            filteredRecords = processedRecords.filter(r => r.varianceType === varianceType);
        }
        
        // Create Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Thirdparty Variance');
        
        // Header styling
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } },
            border: { bottom: { style: 'thin' } }
        };
        
        if (groupBy && groupBy !== 'none') {
            // Grouped export
            sheet.columns = [
                { header: groupBy.charAt(0).toUpperCase() + groupBy.slice(1), key: 'groupName', width: 30 },
                { header: 'Total', key: 'total', width: 12 },
                { header: 'No Show', key: 'noShow', width: 12 },
                { header: 'Late', key: 'late', width: 12 },
                { header: 'Early Leave', key: 'earlyLeave', width: 12 },
                { header: 'Ghost', key: 'ghost', width: 12 },
                { header: 'Overtime', key: 'overtime', width: 12 },
                { header: 'Match', key: 'match', width: 12 }
            ];
            
            // Group data
            const grouped = {};
            filteredRecords.forEach(r => {
                let key;
                if (groupBy === 'store') key = r.storeName || 'Unknown';
                else if (groupBy === 'company') key = r.company || 'Unknown';
                else if (groupBy === 'employee') key = r.employeeName || 'Unknown';
                else key = 'All';
                
                if (!grouped[key]) {
                    grouped[key] = { groupName: key, total: 0, noShow: 0, late: 0, earlyLeave: 0, ghost: 0, overtime: 0, match: 0 };
                }
                
                grouped[key].total++;
                if (r.varianceType === 'no-show') grouped[key].noShow++;
                else if (r.varianceType === 'late') grouped[key].late++;
                else if (r.varianceType === 'early-leave') grouped[key].earlyLeave++;
                else if (r.varianceType === 'ghost') grouped[key].ghost++;
                else if (r.varianceType === 'overtime') grouped[key].overtime++;
                else if (r.varianceType === 'match') grouped[key].match++;
            });
            
            Object.values(grouped).sort((a, b) => b.total - a.total).forEach(row => sheet.addRow(row));
        } else {
            // Detail export
            sheet.columns = [
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Store', key: 'storeName', width: 25 },
                { header: 'Company', key: 'company', width: 20 },
                { header: 'Employee', key: 'employeeName', width: 25 },
                { header: 'Position', key: 'position', width: 15 },
                { header: 'Scheduled In', key: 'scheduledIn', width: 12 },
                { header: 'Actual In', key: 'actualIn', width: 12 },
                { header: 'Scheduled Out', key: 'scheduledOut', width: 12 },
                { header: 'Actual Out', key: 'actualOut', width: 12 },
                { header: 'Variance (hrs)', key: 'varianceHours', width: 15 },
                { header: 'Status', key: 'varianceType', width: 15 },
                { header: 'Late (mins)', key: 'lateMinutes', width: 12 },
                { header: 'Early (mins)', key: 'earlyMinutes', width: 12 }
            ];
            
            filteredRecords.forEach(r => {
                // Format variance as hours and minutes
                let varianceHours = '';
                if (r.varianceMinutes !== null && r.varianceMinutes !== undefined) {
                    const sign = r.varianceMinutes >= 0 ? '+' : '-';
                    const absMins = Math.abs(r.varianceMinutes);
                    const hrs = Math.floor(absMins / 60);
                    const mins = absMins % 60;
                    varianceHours = sign + hrs + 'h ' + mins + 'm';
                }
                
                sheet.addRow({
                    date: r.date ? new Date(r.date).toLocaleDateString('en-GB') : '',
                    storeName: r.storeName || '',
                    company: r.company || '',
                    employeeName: r.employeeName || '',
                    position: r.position || '',
                    scheduledIn: r.scheduledIn || '',
                    actualIn: r.actualIn || '',
                    scheduledOut: r.scheduledOut || '',
                    actualOut: r.actualOut || '',
                    varianceHours: varianceHours,
                    varianceType: r.varianceType || '',
                    lateMinutes: r.lateMinutes || '',
                    earlyMinutes: r.earlyMinutes || ''
                });
            });
        }
        
        // Style header row
        sheet.getRow(1).eachCell(cell => {
            cell.font = headerStyle.font;
            cell.fill = headerStyle.fill;
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ThirdParty_Variance_${fromDate}_to_${toDate}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error exporting thirdparty variance:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get Security variance
router.get('/api/security', async (req, res) => {
    try {
        const { fromDate, toDate, store, company, varianceType, groupBy } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        
        request.input('fromDate', sql.Date, fromDate);
        request.input('toDate', sql.Date, toDate);
        
        let filters = '';
        if (store) {
            request.input('store', sql.NVarChar, store);
            filters += ' AND s.StoreName = @store';
        }
        if (company) {
            request.input('company', sql.NVarChar, company);
            filters += ' AND e.CompanyName = @company';
        }
        
        // Get all scheduled entries for the date range
        const scheduledQuery = `
            WITH DateRange AS (
                SELECT CAST(@fromDate AS DATE) as TheDate
                UNION ALL
                SELECT DATEADD(DAY, 1, TheDate) FROM DateRange WHERE TheDate < @toDate
            ),
            ScheduledShifts AS (
                SELECT 
                    d.TheDate as ScheduleDate,
                    s.StoreName,
                    e.CompanyName,
                    e.EmployeeId,
                    e.EmployeeName,
                    e.EmployeePosition,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MondayOff = 1 THEN NULL ELSE e.MondayFrom END
                        WHEN 'Tuesday' THEN CASE WHEN e.TuesdayOff = 1 THEN NULL ELSE e.TuesdayFrom END
                        WHEN 'Wednesday' THEN CASE WHEN e.WednesdayOff = 1 THEN NULL ELSE e.WednesdayFrom END
                        WHEN 'Thursday' THEN CASE WHEN e.ThursdayOff = 1 THEN NULL ELSE e.ThursdayFrom END
                        WHEN 'Friday' THEN CASE WHEN e.FridayOff = 1 THEN NULL ELSE e.FridayFrom END
                        WHEN 'Saturday' THEN CASE WHEN e.SaturdayOff = 1 THEN NULL ELSE e.SaturdayFrom END
                        WHEN 'Sunday' THEN CASE WHEN e.SundayOff = 1 THEN NULL ELSE e.SundayFrom END
                    END as ScheduledIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MondayOff = 1 THEN NULL ELSE e.MondayTo END
                        WHEN 'Tuesday' THEN CASE WHEN e.TuesdayOff = 1 THEN NULL ELSE e.TuesdayTo END
                        WHEN 'Wednesday' THEN CASE WHEN e.WednesdayOff = 1 THEN NULL ELSE e.WednesdayTo END
                        WHEN 'Thursday' THEN CASE WHEN e.ThursdayOff = 1 THEN NULL ELSE e.ThursdayTo END
                        WHEN 'Friday' THEN CASE WHEN e.FridayOff = 1 THEN NULL ELSE e.FridayTo END
                        WHEN 'Saturday' THEN CASE WHEN e.SaturdayOff = 1 THEN NULL ELSE e.SaturdayTo END
                        WHEN 'Sunday' THEN CASE WHEN e.SundayOff = 1 THEN NULL ELSE e.SundayTo END
                    END as ScheduledOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN e.MondayOff
                        WHEN 'Tuesday' THEN e.TuesdayOff
                        WHEN 'Wednesday' THEN e.WednesdayOff
                        WHEN 'Thursday' THEN e.ThursdayOff
                        WHEN 'Friday' THEN e.FridayOff
                        WHEN 'Saturday' THEN e.SaturdayOff
                        WHEN 'Sunday' THEN e.SundayOff
                    END as IsDayOff
                FROM DateRange d
                CROSS JOIN SecuritySchedules s
                INNER JOIN SecurityScheduleEmployees e ON s.Id = e.ScheduleId
                WHERE d.TheDate BETWEEN s.FromDate AND s.ToDate
                ${filters}
            )
            SELECT 
                ss.ScheduleDate as [date],
                ss.StoreName as storeName,
                ss.CompanyName as company,
                ss.EmployeeId as employeeId,
                ss.EmployeeName as employeeName,
                ss.EmployeePosition as position,
                ss.ScheduledIn as scheduledIn,
                ss.ScheduledOut as scheduledOut,
                ss.IsDayOff as isDayOff,
                ae.TimeIn as actualIn,
                ae.TimeOut as actualOut,
                CASE 
                    WHEN ss.IsDayOff = 1 AND ae.Id IS NOT NULL THEN 'ghost'
                    WHEN ss.ScheduledIn IS NOT NULL AND ae.Id IS NULL THEN 'no-show'
                    WHEN ss.ScheduledIn IS NULL AND ae.Id IS NOT NULL THEN 'ghost'
                    ELSE 'scheduled'
                END as baseVariance
            FROM ScheduledShifts ss
            LEFT JOIN Security_AttendanceReports ar ON 
                ar.ReportDate = ss.ScheduleDate
                AND ar.Location = ss.StoreName
            LEFT JOIN Security_AttendanceEntries ae ON 
                ae.AttendanceReportId = ar.Id
                AND ae.EmployeeName = ss.EmployeeName
            WHERE ss.IsDayOff = 0 OR ae.Id IS NOT NULL
            OPTION (MAXRECURSION 400)
        `;
        
        const scheduled = await request.query(scheduledQuery);
        await pool.close();
        
        // Process all records and calculate variances
        const processedRecords = scheduled.recordset.map(r => {
            let varianceType = r.baseVariance;
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let varianceMinutes = null;
            
            // Calculate variance: (Actual Out - Actual In) - (Scheduled Out - Scheduled In)
            const actualInMins = parseTimeToMinutes(r.actualIn);
            const actualOutMins = parseTimeToMinutes(r.actualOut);
            const schedInMins = parseTimeToMinutes(r.scheduledIn);
            const schedOutMins = parseTimeToMinutes(r.scheduledOut);
            
            if (actualInMins !== null && actualOutMins !== null && schedInMins !== null && schedOutMins !== null) {
                const actualHours = actualOutMins - actualInMins;
                const scheduledHours = schedOutMins - schedInMins;
                varianceMinutes = actualHours - scheduledHours;
            }
            
            if (varianceType === 'scheduled' && r.scheduledIn && r.actualIn) {
                const lateVar = calculateVariance(r.scheduledIn, r.actualIn, 'in');
                const earlyVar = calculateVariance(r.scheduledOut, r.actualOut, 'out');
                
                if (lateVar !== null && lateVar > 15) {
                    varianceType = 'late';
                    lateMinutes = lateVar;
                } else if (earlyVar !== null && earlyVar > 15) {
                    varianceType = 'early-leave';
                    earlyMinutes = earlyVar;
                } else if (earlyVar !== null && earlyVar < -30) {
                    varianceType = 'overtime';
                } else {
                    varianceType = 'match';
                }
            }
            
            return { ...r, varianceType, varianceMinutes, lateMinutes: lateMinutes > 0 ? lateMinutes : null, earlyMinutes: earlyMinutes > 0 ? earlyMinutes : null };
        });
        
        let filteredRecords = processedRecords;
        if (varianceType) {
            filteredRecords = processedRecords.filter(r => r.varianceType === varianceType);
        }
        
        const stats = {
            total: filteredRecords.length,
            noShow: processedRecords.filter(r => r.varianceType === 'no-show').length,
            late: processedRecords.filter(r => r.varianceType === 'late').length,
            earlyLeave: processedRecords.filter(r => r.varianceType === 'early-leave').length,
            ghost: processedRecords.filter(r => r.varianceType === 'ghost').length,
            overtime: processedRecords.filter(r => r.varianceType === 'overtime').length,
            match: processedRecords.filter(r => r.varianceType === 'match').length
        };
        
        let resultRecords = filteredRecords;
        if (groupBy && groupBy !== 'none') {
            const grouped = {};
            filteredRecords.forEach(r => {
                let key;
                if (groupBy === 'store') key = r.storeName || 'Unknown';
                else if (groupBy === 'company') key = r.company || 'Unknown';
                else if (groupBy === 'employee') key = r.employeeName || 'Unknown';
                else key = 'All';
                
                if (!grouped[key]) {
                    grouped[key] = { groupName: key, total: 0, noShow: 0, late: 0, earlyLeave: 0, ghost: 0, overtime: 0, match: 0 };
                }
                
                grouped[key].total++;
                if (r.varianceType === 'no-show') grouped[key].noShow++;
                else if (r.varianceType === 'late') grouped[key].late++;
                else if (r.varianceType === 'early-leave') grouped[key].earlyLeave++;
                else if (r.varianceType === 'ghost') grouped[key].ghost++;
                else if (r.varianceType === 'overtime') grouped[key].overtime++;
                else if (r.varianceType === 'match') grouped[key].match++;
            });
            
            resultRecords = Object.values(grouped).sort((a, b) => b.total - a.total);
        }
        
        res.json({ records: resultRecords, stats });
    } catch (err) {
        console.error('Error getting security variance:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Export Security variance
router.get('/api/security/export', async (req, res) => {
    try {
        const { fromDate, toDate, store, company, varianceType, groupBy } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        
        request.input('fromDate', sql.Date, fromDate);
        request.input('toDate', sql.Date, toDate);
        
        let filters = '';
        if (store) {
            request.input('store', sql.NVarChar, store);
            filters += ' AND s.StoreName = @store';
        }
        if (company) {
            request.input('company', sql.NVarChar, company);
            filters += ' AND e.CompanyName = @company';
        }
        
        const scheduledQuery = `
            WITH DateRange AS (
                SELECT CAST(@fromDate AS DATE) as TheDate
                UNION ALL
                SELECT DATEADD(DAY, 1, TheDate) FROM DateRange WHERE TheDate < @toDate
            ),
            ScheduledShifts AS (
                SELECT 
                    d.TheDate as ScheduleDate,
                    s.StoreName,
                    e.CompanyName,
                    e.EmployeeId,
                    e.EmployeeName,
                    e.EmployeePosition,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MondayOff = 1 THEN NULL ELSE e.MondayFrom END
                        WHEN 'Tuesday' THEN CASE WHEN e.TuesdayOff = 1 THEN NULL ELSE e.TuesdayFrom END
                        WHEN 'Wednesday' THEN CASE WHEN e.WednesdayOff = 1 THEN NULL ELSE e.WednesdayFrom END
                        WHEN 'Thursday' THEN CASE WHEN e.ThursdayOff = 1 THEN NULL ELSE e.ThursdayFrom END
                        WHEN 'Friday' THEN CASE WHEN e.FridayOff = 1 THEN NULL ELSE e.FridayFrom END
                        WHEN 'Saturday' THEN CASE WHEN e.SaturdayOff = 1 THEN NULL ELSE e.SaturdayFrom END
                        WHEN 'Sunday' THEN CASE WHEN e.SundayOff = 1 THEN NULL ELSE e.SundayFrom END
                    END as ScheduledIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN e.MondayOff = 1 THEN NULL ELSE e.MondayTo END
                        WHEN 'Tuesday' THEN CASE WHEN e.TuesdayOff = 1 THEN NULL ELSE e.TuesdayTo END
                        WHEN 'Wednesday' THEN CASE WHEN e.WednesdayOff = 1 THEN NULL ELSE e.WednesdayTo END
                        WHEN 'Thursday' THEN CASE WHEN e.ThursdayOff = 1 THEN NULL ELSE e.ThursdayTo END
                        WHEN 'Friday' THEN CASE WHEN e.FridayOff = 1 THEN NULL ELSE e.FridayTo END
                        WHEN 'Saturday' THEN CASE WHEN e.SaturdayOff = 1 THEN NULL ELSE e.SaturdayTo END
                        WHEN 'Sunday' THEN CASE WHEN e.SundayOff = 1 THEN NULL ELSE e.SundayTo END
                    END as ScheduledOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN e.MondayOff
                        WHEN 'Tuesday' THEN e.TuesdayOff
                        WHEN 'Wednesday' THEN e.WednesdayOff
                        WHEN 'Thursday' THEN e.ThursdayOff
                        WHEN 'Friday' THEN e.FridayOff
                        WHEN 'Saturday' THEN e.SaturdayOff
                        WHEN 'Sunday' THEN e.SundayOff
                    END as IsDayOff
                FROM DateRange d
                CROSS JOIN SecuritySchedules s
                INNER JOIN SecurityScheduleEmployees e ON s.Id = e.ScheduleId
                WHERE d.TheDate BETWEEN s.FromDate AND s.ToDate
                ${filters}
            )
            SELECT 
                ss.ScheduleDate as [date],
                ss.StoreName as storeName,
                ss.CompanyName as company,
                ss.EmployeeId as employeeId,
                ss.EmployeeName as employeeName,
                ss.EmployeePosition as position,
                ss.ScheduledIn as scheduledIn,
                ss.ScheduledOut as scheduledOut,
                ss.IsDayOff as isDayOff,
                ae.TimeIn as actualIn,
                ae.TimeOut as actualOut,
                CASE 
                    WHEN ss.IsDayOff = 1 AND ae.Id IS NOT NULL THEN 'ghost'
                    WHEN ss.ScheduledIn IS NOT NULL AND ae.Id IS NULL THEN 'no-show'
                    WHEN ss.ScheduledIn IS NULL AND ae.Id IS NOT NULL THEN 'ghost'
                    ELSE 'scheduled'
                END as baseVariance
            FROM ScheduledShifts ss
            LEFT JOIN Security_AttendanceReports ar ON 
                ar.ReportDate = ss.ScheduleDate
                AND ar.Location = ss.StoreName
            LEFT JOIN Security_AttendanceEntries ae ON 
                ae.AttendanceReportId = ar.Id
                AND ae.EmployeeName = ss.EmployeeName
            WHERE ss.IsDayOff = 0 OR ae.Id IS NOT NULL
            OPTION (MAXRECURSION 400)
        `;
        
        const scheduled = await request.query(scheduledQuery);
        await pool.close();
        
        const processedRecords = scheduled.recordset.map(r => {
            let vType = r.baseVariance;
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let varianceMinutes = null;
            
            // Calculate variance: (Actual Out - Actual In) - (Scheduled Out - Scheduled In)
            const actualInMins = parseTimeToMinutes(r.actualIn);
            const actualOutMins = parseTimeToMinutes(r.actualOut);
            const schedInMins = parseTimeToMinutes(r.scheduledIn);
            const schedOutMins = parseTimeToMinutes(r.scheduledOut);
            
            if (actualInMins !== null && actualOutMins !== null && schedInMins !== null && schedOutMins !== null) {
                const actualHours = actualOutMins - actualInMins;
                const scheduledHours = schedOutMins - schedInMins;
                varianceMinutes = actualHours - scheduledHours;
            }
            
            if (vType === 'scheduled' && r.scheduledIn && r.actualIn) {
                const lateVar = calculateVariance(r.scheduledIn, r.actualIn, 'in');
                const earlyVar = calculateVariance(r.scheduledOut, r.actualOut, 'out');
                
                if (lateVar !== null && lateVar > 15) {
                    vType = 'late';
                    lateMinutes = lateVar;
                } else if (earlyVar !== null && earlyVar > 15) {
                    vType = 'early-leave';
                    earlyMinutes = earlyVar;
                } else if (earlyVar !== null && earlyVar < -30) {
                    vType = 'overtime';
                } else {
                    vType = 'match';
                }
            }
            
            return { ...r, varianceType: vType, varianceMinutes, lateMinutes, earlyMinutes };
        });
        
        let filteredRecords = processedRecords;
        if (varianceType) {
            filteredRecords = processedRecords.filter(r => r.varianceType === varianceType);
        }
        
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Security Variance');
        
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } }
        };
        
        if (groupBy && groupBy !== 'none') {
            sheet.columns = [
                { header: groupBy.charAt(0).toUpperCase() + groupBy.slice(1), key: 'groupName', width: 30 },
                { header: 'Total', key: 'total', width: 12 },
                { header: 'No Show', key: 'noShow', width: 12 },
                { header: 'Late', key: 'late', width: 12 },
                { header: 'Early Leave', key: 'earlyLeave', width: 12 },
                { header: 'Ghost', key: 'ghost', width: 12 },
                { header: 'Overtime', key: 'overtime', width: 12 },
                { header: 'Match', key: 'match', width: 12 }
            ];
            
            const grouped = {};
            filteredRecords.forEach(r => {
                let key;
                if (groupBy === 'store') key = r.storeName || 'Unknown';
                else if (groupBy === 'company') key = r.company || 'Unknown';
                else if (groupBy === 'employee') key = r.employeeName || 'Unknown';
                else key = 'All';
                
                if (!grouped[key]) {
                    grouped[key] = { groupName: key, total: 0, noShow: 0, late: 0, earlyLeave: 0, ghost: 0, overtime: 0, match: 0 };
                }
                
                grouped[key].total++;
                if (r.varianceType === 'no-show') grouped[key].noShow++;
                else if (r.varianceType === 'late') grouped[key].late++;
                else if (r.varianceType === 'early-leave') grouped[key].earlyLeave++;
                else if (r.varianceType === 'ghost') grouped[key].ghost++;
                else if (r.varianceType === 'overtime') grouped[key].overtime++;
                else if (r.varianceType === 'match') grouped[key].match++;
            });
            
            Object.values(grouped).sort((a, b) => b.total - a.total).forEach(row => sheet.addRow(row));
        } else {
            sheet.columns = [
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Store', key: 'storeName', width: 25 },
                { header: 'Company', key: 'company', width: 20 },
                { header: 'Employee', key: 'employeeName', width: 25 },
                { header: 'Position', key: 'position', width: 15 },
                { header: 'Scheduled In', key: 'scheduledIn', width: 12 },
                { header: 'Actual In', key: 'actualIn', width: 12 },
                { header: 'Scheduled Out', key: 'scheduledOut', width: 12 },
                { header: 'Actual Out', key: 'actualOut', width: 12 },
                { header: 'Variance (hrs)', key: 'varianceHours', width: 15 },
                { header: 'Status', key: 'varianceType', width: 15 },
                { header: 'Late (mins)', key: 'lateMinutes', width: 12 },
                { header: 'Early (mins)', key: 'earlyMinutes', width: 12 }
            ];
            
            filteredRecords.forEach(r => {
                // Format variance as hours and minutes
                let varianceHours = '';
                if (r.varianceMinutes !== null && r.varianceMinutes !== undefined) {
                    const sign = r.varianceMinutes >= 0 ? '+' : '-';
                    const absMins = Math.abs(r.varianceMinutes);
                    const hrs = Math.floor(absMins / 60);
                    const mins = absMins % 60;
                    varianceHours = sign + hrs + 'h ' + mins + 'm';
                }
                
                sheet.addRow({
                    date: r.date ? new Date(r.date).toLocaleDateString('en-GB') : '',
                    storeName: r.storeName || '',
                    company: r.company || '',
                    employeeName: r.employeeName || '',
                    position: r.position || '',
                    scheduledIn: r.scheduledIn || '',
                    actualIn: r.actualIn || '',
                    scheduledOut: r.scheduledOut || '',
                    actualOut: r.actualOut || '',
                    varianceHours: varianceHours,
                    varianceType: r.varianceType || '',
                    lateMinutes: r.lateMinutes || '',
                    earlyMinutes: r.earlyMinutes || ''
                });
            });
        }
        
        sheet.getRow(1).eachCell(cell => {
            cell.font = headerStyle.font;
            cell.fill = headerStyle.fill;
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Security_Variance_${fromDate}_to_${toDate}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error exporting security variance:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get Personnel variance
router.get('/api/personnel', async (req, res) => {
    try {
        const { fromDate, toDate, store, company, varianceType, groupBy } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        
        request.input('fromDate', sql.Date, fromDate);
        request.input('toDate', sql.Date, toDate);
        
        // Build filter conditions
        let filters = '';
        if (store) {
            request.input('store', sql.NVarChar, store);
            filters += ' AND e.Store = @store';
        }
        if (company) {
            request.input('company', sql.NVarChar, company);
            filters += ' AND e.Company = @company';
        }
        
        // Get all scheduled entries for the date range from Personnel_EmployeeSchedule
        const scheduledQuery = `
            WITH DateRange AS (
                SELECT CAST(@fromDate AS DATE) as TheDate
                UNION ALL
                SELECT DATEADD(DAY, 1, TheDate) FROM DateRange WHERE TheDate < @toDate
            ),
            ScheduledShifts AS (
                SELECT 
                    d.TheDate as ScheduleDate,
                    e.Store as StoreName,
                    e.Company,
                    e.Id as EmployeeId,
                    e.Name as EmployeeName,
                    e.Position,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN s.MondayOff = 1 THEN NULL ELSE s.MondayFrom1 END
                        WHEN 'Tuesday' THEN CASE WHEN s.TuesdayOff = 1 THEN NULL ELSE s.TuesdayFrom1 END
                        WHEN 'Wednesday' THEN CASE WHEN s.WednesdayOff = 1 THEN NULL ELSE s.WednesdayFrom1 END
                        WHEN 'Thursday' THEN CASE WHEN s.ThursdayOff = 1 THEN NULL ELSE s.ThursdayFrom1 END
                        WHEN 'Friday' THEN CASE WHEN s.FridayOff = 1 THEN NULL ELSE s.FridayFrom1 END
                        WHEN 'Saturday' THEN CASE WHEN s.SaturdayOff = 1 THEN NULL ELSE s.SaturdayFrom1 END
                        WHEN 'Sunday' THEN CASE WHEN s.SundayOff = 1 THEN NULL ELSE s.SundayFrom1 END
                    END as ScheduledIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN s.MondayOff = 1 THEN NULL ELSE s.MondayTo1 END
                        WHEN 'Tuesday' THEN CASE WHEN s.TuesdayOff = 1 THEN NULL ELSE s.TuesdayTo1 END
                        WHEN 'Wednesday' THEN CASE WHEN s.WednesdayOff = 1 THEN NULL ELSE s.WednesdayTo1 END
                        WHEN 'Thursday' THEN CASE WHEN s.ThursdayOff = 1 THEN NULL ELSE s.ThursdayTo1 END
                        WHEN 'Friday' THEN CASE WHEN s.FridayOff = 1 THEN NULL ELSE s.FridayTo1 END
                        WHEN 'Saturday' THEN CASE WHEN s.SaturdayOff = 1 THEN NULL ELSE s.SaturdayTo1 END
                        WHEN 'Sunday' THEN CASE WHEN s.SundayOff = 1 THEN NULL ELSE s.SundayTo1 END
                    END as ScheduledOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN s.MondayActualIn
                        WHEN 'Tuesday' THEN s.TuesdayActualIn
                        WHEN 'Wednesday' THEN s.WednesdayActualIn
                        WHEN 'Thursday' THEN s.ThursdayActualIn
                        WHEN 'Friday' THEN s.FridayActualIn
                        WHEN 'Saturday' THEN s.SaturdayActualIn
                        WHEN 'Sunday' THEN s.SundayActualIn
                    END as ActualIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN s.MondayActualOut
                        WHEN 'Tuesday' THEN s.TuesdayActualOut
                        WHEN 'Wednesday' THEN s.WednesdayActualOut
                        WHEN 'Thursday' THEN s.ThursdayActualOut
                        WHEN 'Friday' THEN s.FridayActualOut
                        WHEN 'Saturday' THEN s.SaturdayActualOut
                        WHEN 'Sunday' THEN s.SundayActualOut
                    END as ActualOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN s.MondayOff
                        WHEN 'Tuesday' THEN s.TuesdayOff
                        WHEN 'Wednesday' THEN s.WednesdayOff
                        WHEN 'Thursday' THEN s.ThursdayOff
                        WHEN 'Friday' THEN s.FridayOff
                        WHEN 'Saturday' THEN s.SaturdayOff
                        WHEN 'Sunday' THEN s.SundayOff
                    END as IsDayOff
                FROM DateRange d
                CROSS JOIN Personnel_Employees e
                LEFT JOIN Personnel_EmployeeSchedule s ON s.EmployeeId = e.Id 
                    AND d.TheDate >= s.WeekStartDate 
                    AND d.TheDate < DATEADD(DAY, 7, s.WeekStartDate)
                WHERE e.IsActive = 1
                ${filters}
            )
            SELECT 
                ScheduleDate as [date],
                StoreName as storeName,
                Company as company,
                EmployeeId as employeeId,
                EmployeeName as employeeName,
                Position as position,
                ScheduledIn as scheduledIn,
                ScheduledOut as scheduledOut,
                ActualIn as actualIn,
                ActualOut as actualOut,
                IsDayOff as isDayOff,
                CASE 
                    WHEN IsDayOff = 1 THEN 'off'
                    WHEN ScheduledIn IS NOT NULL AND ActualIn IS NULL THEN 'no-show'
                    ELSE 'scheduled'
                END as baseVariance
            FROM ScheduledShifts
            WHERE IsDayOff = 0 OR IsDayOff IS NULL
            ORDER BY ScheduleDate, StoreName, EmployeeName
            OPTION (MAXRECURSION 400)
        `;
        
        const scheduled = await request.query(scheduledQuery);
        await pool.close();
        
        // Process all records and calculate variances
        const processedRecords = scheduled.recordset.map(r => {
            let varianceType = r.baseVariance;
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let varianceMinutes = null;
            
            // Calculate variance: (Actual Out - Actual In) - (Scheduled Out - Scheduled In)
            const actualInMins = parseTimeToMinutes(r.actualIn);
            const actualOutMins = parseTimeToMinutes(r.actualOut);
            const schedInMins = parseTimeToMinutes(r.scheduledIn);
            const schedOutMins = parseTimeToMinutes(r.scheduledOut);
            
            if (actualInMins !== null && actualOutMins !== null && schedInMins !== null && schedOutMins !== null) {
                const actualHours = actualOutMins - actualInMins;
                const scheduledHours = schedOutMins - schedInMins;
                varianceMinutes = actualHours - scheduledHours;
            }
            
            if (varianceType === 'scheduled' && r.scheduledIn && r.actualIn) {
                const lateVar = calculateVariance(r.scheduledIn, r.actualIn, 'in');
                const earlyVar = calculateVariance(r.scheduledOut, r.actualOut, 'out');
                
                // Check for late (more than 15 minutes late)
                if (lateVar !== null && lateVar > 15) {
                    varianceType = 'late';
                    lateMinutes = lateVar;
                }
                // Check for early leave (more than 15 minutes early)
                else if (earlyVar !== null && earlyVar > 15) {
                    varianceType = 'early-leave';
                    earlyMinutes = earlyVar;
                }
                // Check for overtime (stayed more than 30 minutes extra)
                else if (earlyVar !== null && earlyVar < -30) {
                    varianceType = 'overtime';
                }
                else {
                    varianceType = 'match';
                }
            }
            
            return {
                ...r,
                varianceType,
                varianceMinutes,
                lateMinutes: lateMinutes > 0 ? lateMinutes : null,
                earlyMinutes: earlyMinutes > 0 ? earlyMinutes : null
            };
        });
        
        // Filter by variance type if specified
        let filteredRecords = processedRecords;
        if (varianceType) {
            filteredRecords = processedRecords.filter(r => r.varianceType === varianceType);
        }
        
        // Calculate stats
        const stats = {
            total: filteredRecords.length,
            noShow: processedRecords.filter(r => r.varianceType === 'no-show').length,
            late: processedRecords.filter(r => r.varianceType === 'late').length,
            earlyLeave: processedRecords.filter(r => r.varianceType === 'early-leave').length,
            overtime: processedRecords.filter(r => r.varianceType === 'overtime').length,
            match: processedRecords.filter(r => r.varianceType === 'match').length
        };
        
        // Group if needed
        let resultRecords = filteredRecords;
        if (groupBy && groupBy !== 'none') {
            const grouped = {};
            filteredRecords.forEach(r => {
                let key;
                if (groupBy === 'store') key = r.storeName || 'Unknown';
                else if (groupBy === 'company') key = r.company || 'Unknown';
                else if (groupBy === 'employee') key = r.employeeName || 'Unknown';
                else key = 'All';
                
                if (!grouped[key]) {
                    grouped[key] = {
                        groupName: key,
                        total: 0,
                        noShow: 0,
                        late: 0,
                        earlyLeave: 0,
                        overtime: 0,
                        match: 0
                    };
                }
                
                grouped[key].total++;
                if (r.varianceType === 'no-show') grouped[key].noShow++;
                else if (r.varianceType === 'late') grouped[key].late++;
                else if (r.varianceType === 'early-leave') grouped[key].earlyLeave++;
                else if (r.varianceType === 'overtime') grouped[key].overtime++;
                else if (r.varianceType === 'match') grouped[key].match++;
            });
            
            resultRecords = Object.values(grouped).sort((a, b) => b.total - a.total);
        }
        
        res.json({ records: resultRecords, stats });
    } catch (err) {
        console.error('Error getting personnel variance:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Export Personnel variance
router.get('/api/personnel/export', async (req, res) => {
    try {
        const { fromDate, toDate, store, company, varianceType, groupBy } = req.query;
        
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        
        request.input('fromDate', sql.Date, fromDate);
        request.input('toDate', sql.Date, toDate);
        
        let filters = '';
        if (store) {
            request.input('store', sql.NVarChar, store);
            filters += ' AND e.Store = @store';
        }
        if (company) {
            request.input('company', sql.NVarChar, company);
            filters += ' AND e.Company = @company';
        }
        
        const scheduledQuery = `
            WITH DateRange AS (
                SELECT CAST(@fromDate AS DATE) as TheDate
                UNION ALL
                SELECT DATEADD(DAY, 1, TheDate) FROM DateRange WHERE TheDate < @toDate
            ),
            ScheduledShifts AS (
                SELECT 
                    d.TheDate as ScheduleDate,
                    e.Store as StoreName,
                    e.Company,
                    e.Id as EmployeeId,
                    e.Name as EmployeeName,
                    e.Position,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN s.MondayOff = 1 THEN NULL ELSE s.MondayFrom1 END
                        WHEN 'Tuesday' THEN CASE WHEN s.TuesdayOff = 1 THEN NULL ELSE s.TuesdayFrom1 END
                        WHEN 'Wednesday' THEN CASE WHEN s.WednesdayOff = 1 THEN NULL ELSE s.WednesdayFrom1 END
                        WHEN 'Thursday' THEN CASE WHEN s.ThursdayOff = 1 THEN NULL ELSE s.ThursdayFrom1 END
                        WHEN 'Friday' THEN CASE WHEN s.FridayOff = 1 THEN NULL ELSE s.FridayFrom1 END
                        WHEN 'Saturday' THEN CASE WHEN s.SaturdayOff = 1 THEN NULL ELSE s.SaturdayFrom1 END
                        WHEN 'Sunday' THEN CASE WHEN s.SundayOff = 1 THEN NULL ELSE s.SundayFrom1 END
                    END as ScheduledIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN CASE WHEN s.MondayOff = 1 THEN NULL ELSE s.MondayTo1 END
                        WHEN 'Tuesday' THEN CASE WHEN s.TuesdayOff = 1 THEN NULL ELSE s.TuesdayTo1 END
                        WHEN 'Wednesday' THEN CASE WHEN s.WednesdayOff = 1 THEN NULL ELSE s.WednesdayTo1 END
                        WHEN 'Thursday' THEN CASE WHEN s.ThursdayOff = 1 THEN NULL ELSE s.ThursdayTo1 END
                        WHEN 'Friday' THEN CASE WHEN s.FridayOff = 1 THEN NULL ELSE s.FridayTo1 END
                        WHEN 'Saturday' THEN CASE WHEN s.SaturdayOff = 1 THEN NULL ELSE s.SaturdayTo1 END
                        WHEN 'Sunday' THEN CASE WHEN s.SundayOff = 1 THEN NULL ELSE s.SundayTo1 END
                    END as ScheduledOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN s.MondayActualIn
                        WHEN 'Tuesday' THEN s.TuesdayActualIn
                        WHEN 'Wednesday' THEN s.WednesdayActualIn
                        WHEN 'Thursday' THEN s.ThursdayActualIn
                        WHEN 'Friday' THEN s.FridayActualIn
                        WHEN 'Saturday' THEN s.SaturdayActualIn
                        WHEN 'Sunday' THEN s.SundayActualIn
                    END as ActualIn,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN s.MondayActualOut
                        WHEN 'Tuesday' THEN s.TuesdayActualOut
                        WHEN 'Wednesday' THEN s.WednesdayActualOut
                        WHEN 'Thursday' THEN s.ThursdayActualOut
                        WHEN 'Friday' THEN s.FridayActualOut
                        WHEN 'Saturday' THEN s.SaturdayActualOut
                        WHEN 'Sunday' THEN s.SundayActualOut
                    END as ActualOut,
                    CASE DATENAME(WEEKDAY, d.TheDate)
                        WHEN 'Monday' THEN s.MondayOff
                        WHEN 'Tuesday' THEN s.TuesdayOff
                        WHEN 'Wednesday' THEN s.WednesdayOff
                        WHEN 'Thursday' THEN s.ThursdayOff
                        WHEN 'Friday' THEN s.FridayOff
                        WHEN 'Saturday' THEN s.SaturdayOff
                        WHEN 'Sunday' THEN s.SundayOff
                    END as IsDayOff
                FROM DateRange d
                CROSS JOIN Personnel_Employees e
                LEFT JOIN Personnel_EmployeeSchedule s ON s.EmployeeId = e.Id 
                    AND d.TheDate >= s.WeekStartDate 
                    AND d.TheDate < DATEADD(DAY, 7, s.WeekStartDate)
                WHERE e.IsActive = 1
                ${filters}
            )
            SELECT 
                ScheduleDate as [date],
                StoreName as storeName,
                Company as company,
                EmployeeId as employeeId,
                EmployeeName as employeeName,
                Position as position,
                ScheduledIn as scheduledIn,
                ScheduledOut as scheduledOut,
                ActualIn as actualIn,
                ActualOut as actualOut,
                IsDayOff as isDayOff,
                CASE 
                    WHEN IsDayOff = 1 THEN 'off'
                    WHEN ScheduledIn IS NOT NULL AND ActualIn IS NULL THEN 'no-show'
                    ELSE 'scheduled'
                END as baseVariance
            FROM ScheduledShifts
            WHERE IsDayOff = 0 OR IsDayOff IS NULL
            ORDER BY ScheduleDate, StoreName, EmployeeName
            OPTION (MAXRECURSION 400)
        `;
        
        const scheduled = await request.query(scheduledQuery);
        await pool.close();
        
        // Process records
        const processedRecords = scheduled.recordset.map(r => {
            let vType = r.baseVariance;
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let varianceMinutes = null;
            
            const actualInMins = parseTimeToMinutes(r.actualIn);
            const actualOutMins = parseTimeToMinutes(r.actualOut);
            const schedInMins = parseTimeToMinutes(r.scheduledIn);
            const schedOutMins = parseTimeToMinutes(r.scheduledOut);
            
            if (actualInMins !== null && actualOutMins !== null && schedInMins !== null && schedOutMins !== null) {
                const actualHours = actualOutMins - actualInMins;
                const scheduledHours = schedOutMins - schedInMins;
                varianceMinutes = actualHours - scheduledHours;
            }
            
            if (vType === 'scheduled' && r.scheduledIn && r.actualIn) {
                const lateVar = calculateVariance(r.scheduledIn, r.actualIn, 'in');
                const earlyVar = calculateVariance(r.scheduledOut, r.actualOut, 'out');
                
                if (lateVar !== null && lateVar > 15) {
                    vType = 'late';
                    lateMinutes = lateVar;
                } else if (earlyVar !== null && earlyVar > 15) {
                    vType = 'early-leave';
                    earlyMinutes = earlyVar;
                } else if (earlyVar !== null && earlyVar < -30) {
                    vType = 'overtime';
                } else {
                    vType = 'match';
                }
            }
            
            return { ...r, varianceType: vType, varianceMinutes, lateMinutes, earlyMinutes };
        });
        
        let filteredRecords = processedRecords;
        if (varianceType) {
            filteredRecords = processedRecords.filter(r => r.varianceType === varianceType);
        }
        
        // Create Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Personnel Variance');
        
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } }
        };
        
        if (groupBy && groupBy !== 'none') {
            sheet.columns = [
                { header: groupBy.charAt(0).toUpperCase() + groupBy.slice(1), key: 'groupName', width: 30 },
                { header: 'Total', key: 'total', width: 12 },
                { header: 'No Show', key: 'noShow', width: 12 },
                { header: 'Late', key: 'late', width: 12 },
                { header: 'Early Leave', key: 'earlyLeave', width: 12 },
                { header: 'Overtime', key: 'overtime', width: 12 },
                { header: 'Match', key: 'match', width: 12 }
            ];
            
            const grouped = {};
            filteredRecords.forEach(r => {
                let key;
                if (groupBy === 'store') key = r.storeName || 'Unknown';
                else if (groupBy === 'company') key = r.company || 'Unknown';
                else if (groupBy === 'employee') key = r.employeeName || 'Unknown';
                else key = 'All';
                
                if (!grouped[key]) {
                    grouped[key] = { groupName: key, total: 0, noShow: 0, late: 0, earlyLeave: 0, overtime: 0, match: 0 };
                }
                
                grouped[key].total++;
                if (r.varianceType === 'no-show') grouped[key].noShow++;
                else if (r.varianceType === 'late') grouped[key].late++;
                else if (r.varianceType === 'early-leave') grouped[key].earlyLeave++;
                else if (r.varianceType === 'overtime') grouped[key].overtime++;
                else if (r.varianceType === 'match') grouped[key].match++;
            });
            
            Object.values(grouped).sort((a, b) => b.total - a.total).forEach(row => sheet.addRow(row));
        } else {
            sheet.columns = [
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Store', key: 'storeName', width: 25 },
                { header: 'Company', key: 'company', width: 20 },
                { header: 'Employee', key: 'employeeName', width: 25 },
                { header: 'Position', key: 'position', width: 15 },
                { header: 'Scheduled In', key: 'scheduledIn', width: 12 },
                { header: 'Actual In', key: 'actualIn', width: 12 },
                { header: 'Scheduled Out', key: 'scheduledOut', width: 12 },
                { header: 'Actual Out', key: 'actualOut', width: 12 },
                { header: 'Variance (hrs)', key: 'varianceHours', width: 15 },
                { header: 'Status', key: 'varianceType', width: 15 },
                { header: 'Late (mins)', key: 'lateMinutes', width: 12 },
                { header: 'Early (mins)', key: 'earlyMinutes', width: 12 }
            ];
            
            filteredRecords.forEach(r => {
                let varianceHours = '';
                if (r.varianceMinutes !== null && r.varianceMinutes !== undefined) {
                    const sign = r.varianceMinutes >= 0 ? '+' : '-';
                    const absMins = Math.abs(r.varianceMinutes);
                    const hrs = Math.floor(absMins / 60);
                    const mins = absMins % 60;
                    varianceHours = sign + hrs + 'h ' + mins + 'm';
                }
                
                sheet.addRow({
                    date: r.date ? new Date(r.date).toLocaleDateString('en-GB') : '',
                    storeName: r.storeName || '',
                    company: r.company || '',
                    employeeName: r.employeeName || '',
                    position: r.position || '',
                    scheduledIn: r.scheduledIn || '',
                    actualIn: r.actualIn || '',
                    scheduledOut: r.scheduledOut || '',
                    actualOut: r.actualOut || '',
                    varianceHours: varianceHours,
                    varianceType: r.varianceType || '',
                    lateMinutes: r.lateMinutes || '',
                    earlyMinutes: r.earlyMinutes || ''
                });
            });
        }
        
        sheet.getRow(1).eachCell(cell => {
            cell.font = headerStyle.font;
            cell.fill = headerStyle.fill;
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Personnel_Variance_${fromDate}_to_${toDate}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error exporting personnel variance:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
