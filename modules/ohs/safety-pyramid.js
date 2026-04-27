/**
 * OHS Safety Pyramid Module
 * Displays the safety pyramid with incident statistics and RIR/LTIR calculations
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
    },
    pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 60000
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
            console.log('OHS Safety Pyramid: Connected to SQL Server');
            pool = newPool;
            pool.on('error', err => {
                console.error('OHS Safety Pyramid Pool Error:', err);
                poolPromise = null;
                pool = null;
            });
            return pool;
        }).catch(err => {
            console.error('OHS Safety Pyramid connection error:', err);
            poolPromise = null;
            throw err;
        });
    }
    
    return poolPromise;
}

// =====================================================
// Safety Pyramid Main Page
// =====================================================
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await getPool();
        
        // Get stores from main Stores table (from OE system settings)
        const storesResult = await pool.request().query(`
            SELECT Id as StoreId, StoreName, StoreCode
            FROM Stores
            WHERE IsActive = 1
            ORDER BY StoreName
        `);
        const stores = storesResult.recordset;
        
        // Get severity levels for pyramid
        const levelsResult = await pool.request().query(`
            SELECT * FROM OHSSeverityLevels 
            WHERE IsActive = 1 
            ORDER BY PyramidOrder ASC
        `);
        const severityLevels = levelsResult.recordset;
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Safety Pyramid - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        min-height: 100vh;
                    }
                    .header {
                        background: rgba(0,0,0,0.2);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; align-items: center; }
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
                        max-width: 1400px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .page-title {
                        color: white;
                        margin-bottom: 30px;
                        text-align: center;
                    }
                    .page-title h2 {
                        font-size: 32px;
                        margin-bottom: 10px;
                    }
                    .page-title p {
                        opacity: 0.9;
                        font-size: 18px;
                    }
                    
                    /* Filters */
                    .filters-bar {
                        background: white;
                        padding: 20px;
                        border-radius: 12px;
                        margin-bottom: 30px;
                        display: flex;
                        gap: 20px;
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
                        font-weight: 600;
                        text-transform: uppercase;
                    }
                    .filter-group select, .filter-group input {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                        min-width: 180px;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: #d63031;
                        color: white;
                    }
                    .btn-primary:hover { background: #c0392b; }
                    .btn-secondary {
                        background: #636e72;
                        color: white;
                    }
                    .btn-secondary:hover { background: #2d3436; }
                    
                    /* Main content grid */
                    .main-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 30px;
                    }
                    
                    @media (max-width: 1200px) {
                        .main-grid {
                            grid-template-columns: 1fr;
                        }
                    }
                    
                    .card {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    }
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #eee;
                    }
                    
                    /* Safety Pyramid */
                    .pyramid-wrapper {
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        gap: 0;
                        padding: 20px 0;
                    }
                    
                    /* Vertical indicator arrows */
                    .vertical-indicators-left {
                        display: flex;
                        flex-direction: row;
                        gap: 8px;
                        margin-right: 15px;
                        padding-top: 0;
                    }
                    .vertical-indicators-right {
                        display: flex;
                        flex-direction: column;
                        gap: 0;
                        margin-left: 15px;
                        padding-top: 0;
                    }
                    
                    /* Double-ended arrow container */
                    .arrow-indicator {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        position: relative;
                    }
                    
                    /* Arrow head (pointing up - top) */
                    .arrow-head-up {
                        width: 0;
                        height: 0;
                        border-left: 10px solid transparent;
                        border-right: 10px solid transparent;
                    }
                    .arrow-head-up.ltir { border-bottom: 12px solid #8B0000; }
                    .arrow-head-up.rir { border-bottom: 12px solid #FF8C00; }
                    .arrow-head-up.lagging { border-bottom: 12px solid #d63031; }
                    .arrow-head-up.leading { border-bottom: 12px solid #228B22; }
                    
                    /* Arrow head (pointing down - bottom) */
                    .arrow-head-down {
                        width: 0;
                        height: 0;
                        border-left: 10px solid transparent;
                        border-right: 10px solid transparent;
                    }
                    .arrow-head-down.ltir { border-top: 12px solid #DC143C; }
                    .arrow-head-down.rir { border-top: 12px solid #FFD700; }
                    .arrow-head-down.lagging { border-top: 12px solid #FF6347; }
                    .arrow-head-down.leading { border-top: 12px solid #228B22; }
                    
                    /* Arrow body (stem) */
                    .arrow-body {
                        width: 8px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                    }
                    .arrow-body.ltir { 
                        background: linear-gradient(to bottom, #8B0000, #DC143C);
                    }
                    .arrow-body.rir { 
                        background: linear-gradient(to bottom, #FF8C00, #FFD700);
                    }
                    .arrow-body.lagging { 
                        background: linear-gradient(to bottom, #d63031, #FF6347);
                    }
                    .arrow-body.leading { 
                        background: #228B22;
                    }
                    
                    /* Arrow label (vertical text beside arrow) */
                    .arrow-label-container {
                        position: absolute;
                        left: 12px;
                        top: 0;
                        bottom: 0;
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                    }
                    .arrow-label-container.left-side {
                        left: auto;
                        right: 12px;
                        justify-content: flex-end;
                    }
                    
                    .arrow-label {
                        writing-mode: vertical-rl;
                        text-orientation: mixed;
                        transform: rotate(180deg);
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                        white-space: nowrap;
                        color: #333;
                        text-transform: uppercase;
                    }
                    .arrow-label.ltir { color: #8B0000; }
                    .arrow-label.rir { color: #FF8C00; }
                    .arrow-label.lagging { color: #d63031; }
                    .arrow-label.leading { color: #228B22; }
                    
                    .pyramid-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-start;
                        padding: 0 60px 0 0;
                        flex: 1;
                        width: 480px;
                        min-width: 480px;
                        position: relative;
                    }
                    
                    .pyramid-level {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 4px;
                        transition: transform 0.2s, box-shadow 0.2s;
                        cursor: pointer;
                        position: relative;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    .pyramid-level:hover {
                        transform: scale(1.02);
                        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                        z-index: 10;
                    }
                    
                    .pyramid-level .level-content {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 100%;
                        padding: 10px 15px;
                        color: white;
                        text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                    }
                    .pyramid-level .level-name {
                        font-weight: 600;
                        font-size: 13px;
                        text-align: center;
                    }
                    .pyramid-level .level-count {
                        position: absolute;
                        right: -50px;
                        top: 50%;
                        transform: translateY(-50%);
                        font-weight: 700;
                        font-size: 16px;
                        background: #333;
                        color: white;
                        padding: 4px 10px;
                        border-radius: 15px;
                        min-width: 35px;
                        text-align: center;
                    }
                    
                    /* Pyramid shape widths - centered */
                    .pyramid-level-1 { width: 100px; min-width: 100px; }
                    .pyramid-level-2 { width: 140px; min-width: 140px; }
                    .pyramid-level-3 { width: 180px; min-width: 180px; }
                    .pyramid-level-4 { width: 220px; min-width: 220px; }
                    .pyramid-level-5 { width: 270px; min-width: 270px; }
                    .pyramid-level-6 { width: 320px; min-width: 320px; }
                    .pyramid-level-7 { width: 400px; min-width: 400px; }
                    
                    /* Level details tooltip */
                    .level-tooltip {
                        position: absolute;
                        left: 100%;
                        top: 50%;
                        transform: translateY(-50%);
                        background: #333;
                        color: white;
                        padding: 10px 15px;
                        border-radius: 6px;
                        font-size: 12px;
                        white-space: nowrap;
                        opacity: 0;
                        visibility: hidden;
                        transition: opacity 0.2s, visibility 0.2s;
                        z-index: 100;
                        margin-left: 10px;
                    }
                    .pyramid-level:hover .level-tooltip {
                        opacity: 1;
                        visibility: visible;
                    }
                    .level-tooltip::before {
                        content: '';
                        position: absolute;
                        right: 100%;
                        top: 50%;
                        transform: translateY(-50%);
                        border: 6px solid transparent;
                        border-right-color: #333;
                    }
                    
                    /* Indicator labels */
                    .indicator-labels {
                        display: flex;
                        justify-content: center;
                        gap: 30px;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .indicator-label {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 13px;
                        color: #666;
                    }
                    .indicator-dot {
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                    }
                    .indicator-dot.lagging { background: #d63031; }
                    .indicator-dot.leading { background: #228B22; }
                    
                    /* Rates Card */
                    .rates-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                    }
                    .rate-box {
                        background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                        padding: 25px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .rate-box.rir { border-left: 4px solid #e17055; }
                    .rate-box.ltir { border-left: 4px solid #d63031; }
                    .rate-label {
                        font-size: 14px;
                        color: #666;
                        margin-bottom: 10px;
                        font-weight: 600;
                    }
                    .rate-value {
                        font-size: 36px;
                        font-weight: 700;
                        color: #333;
                    }
                    .rate-formula {
                        font-size: 11px;
                        color: #999;
                        margin-top: 10px;
                        font-style: italic;
                    }
                    
                    /* Stats Summary */
                    .stats-row {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 15px;
                        margin-top: 20px;
                    }
                    .stat-box {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 24px;
                        font-weight: 700;
                        color: #333;
                    }
                    .stat-label {
                        font-size: 11px;
                        color: #666;
                        margin-top: 5px;
                        text-transform: uppercase;
                    }
                    
                    /* Man Hours Entry */
                    .manhours-form {
                        margin-top: 20px;
                    }
                    .manhours-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                    }
                    .manhours-table th, .manhours-table td {
                        padding: 10px;
                        border: 1px solid #eee;
                        text-align: center;
                    }
                    .manhours-table th {
                        background: #f5f5f5;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    .manhours-table input {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        text-align: right;
                    }
                    
                    /* Loading overlay */
                    .loading-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    .loading-overlay.hidden { display: none; }
                    .loading-spinner {
                        background: white;
                        padding: 30px 40px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .spinner {
                        width: 40px;
                        height: 40px;
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #d63031;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    .user-info {
                        background: rgba(255,255,255,0.1);
                        padding: 8px 15px;
                        border-radius: 20px;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>⚠️ Safety Pyramid</h1>
                    <div class="header-nav">
                        <span class="user-info">👤 ${user?.displayName || 'User'}</span>
                        <a href="/ohs">🦺 OHS Home</a>
                        <a href="/">🏠 Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="page-title">
                        <h2>Safety Pyramid Dashboard</h2>
                        <p>Incident tracking by severity level with RIR and LTIR metrics</p>
                    </div>
                    
                    <!-- Filters -->
                    <div class="filters-bar">
                        <div class="filter-group">
                            <label>Store</label>
                            <select id="storeFilter">
                                <option value="">All Stores</option>
                                ${stores.map(s => `<option value="${s.StoreId}">${s.StoreName}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Year</label>
                            <select id="yearFilter">
                                ${[2024, 2025, 2026, 2027].map(y => `
                                    <option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Period</label>
                            <select id="periodFilter">
                                <option value="ytd">Year to Date</option>
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
                        </div>
                        <button class="btn btn-primary" onclick="loadData()">🔍 Apply Filters</button>
                    </div>
                    
                    <!-- Main Content -->
                    <div class="main-grid">
                        <!-- Safety Pyramid -->
                        <div class="card">
                            <div class="card-title">Safety Pyramid</div>
                            <div class="pyramid-wrapper">
                                <!-- Left side: RIR & LTIR arrows (both start from top) -->
                                <div class="vertical-indicators-left">
                                    <div class="arrow-indicator" id="rirArrow" title="Recordable Incident Rate - Fatality to Medical Treatment">
                                        <div class="arrow-head-up rir"></div>
                                        <div class="arrow-body rir" style="height: 200px;">
                                            <div class="arrow-label-container left-side">
                                                <span class="arrow-label rir">RIR</span>
                                            </div>
                                        </div>
                                        <div class="arrow-head-down rir"></div>
                                    </div>
                                    <div class="arrow-indicator" id="ltirArrow" title="Lost Time Injury Rate - Fatality, Irreversible, Lost-Time">
                                        <div class="arrow-head-up ltir"></div>
                                        <div class="arrow-body ltir" style="height: 116px;">
                                            <div class="arrow-label-container left-side">
                                                <span class="arrow-label ltir">LTIR</span>
                                            </div>
                                        </div>
                                        <div class="arrow-head-down ltir"></div>
                                    </div>
                                </div>
                                
                                <!-- Pyramid -->
                                <div class="pyramid-container" id="pyramidContainer">
                                    <!-- Pyramid levels will be rendered here -->
                                </div>
                                
                                <!-- Right side: Lagging & Leading indicators -->
                                <div class="vertical-indicators-right">
                                    <div class="arrow-indicator" id="laggingArrow" title="Lagging Indicators - Reported by HR Personnel">
                                        <div class="arrow-head-up lagging"></div>
                                        <div class="arrow-body lagging" style="height: 246px;">
                                            <div class="arrow-label-container">
                                                <span class="arrow-label lagging">LAGGING</span>
                                            </div>
                                        </div>
                                        <div class="arrow-head-down lagging"></div>
                                    </div>
                                    <div class="arrow-indicator" id="leadingArrow" title="Leading Indicators - Near Miss / Unsafe Conditions & Behaviors - Reported by Store Management">
                                        <div class="arrow-head-up leading"></div>
                                        <div class="arrow-body leading" style="height: 30px;">
                                            <div class="arrow-label-container">
                                                <span class="arrow-label leading">LEADING</span>
                                            </div>
                                        </div>
                                        <div class="arrow-head-down leading"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="indicator-labels">
                                <div class="indicator-label">
                                    <span class="indicator-dot lagging"></span>
                                    Lagging Indicators (Reported by HR Personnel)
                                </div>
                                <div class="indicator-label">
                                    <span class="indicator-dot leading"></span>
                                    Leading Indicators (Reported by Store Management)
                                </div>
                            </div>
                        </div>
                        
                        <!-- RIR & LTIR Rates -->
                        <div class="card">
                            <div class="card-title">Safety Metrics</div>
                            <div class="rates-grid">
                                <div class="rate-box rir">
                                    <div class="rate-label">Recordable Incident Rate (RIR)</div>
                                    <div class="rate-value" id="rirValue">0.00</div>
                                    <div class="rate-formula">RIR = (Recordable Incidents × 200,000) ÷ Total Hours</div>
                                </div>
                                <div class="rate-box ltir">
                                    <div class="rate-label">Lost Time Injury Rate (LTIR)</div>
                                    <div class="rate-value" id="ltirValue">0.00</div>
                                    <div class="rate-formula">LTIR = (Lost Time Injuries × 200,000) ÷ Total Hours</div>
                                </div>
                            </div>
                            
                            <div class="stats-row">
                                <div class="stat-box">
                                    <div class="stat-value" id="totalIncidents">0</div>
                                    <div class="stat-label">Total Incidents</div>
                                </div>
                                <div class="stat-box">
                                    <div class="stat-value" id="recordableIncidents">0</div>
                                    <div class="stat-label">Recordable</div>
                                </div>
                                <div class="stat-box">
                                    <div class="stat-value" id="lostTimeInjuries">0</div>
                                    <div class="stat-label">Lost Time</div>
                                </div>
                                <div class="stat-box">
                                    <div class="stat-value" id="totalHours">0</div>
                                    <div class="stat-label">Hours Worked</div>
                                </div>
                            </div>
                            
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                                <p style="font-size: 12px; color: #666;">
                                    <strong>Note:</strong> 200,000 hours ≈ 100 employees working full-time for one year.
                                    RIR includes Medical Treatment and above. LTIR includes Lost-Time injuries and above.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Man-Hours Entry Section -->
                    <div class="card" style="margin-top: 30px;">
                        <div class="card-title">📊 Store Man-Hours Entry</div>
                        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
                            Enter total hours worked by store for accurate RIR/LTIR calculations.
                            <a href="/ohs/safety-pyramid/man-hours" style="color: #d63031;">📝 Manage Man-Hours →</a>
                        </p>
                    </div>
                </div>
                
                <!-- Loading Overlay -->
                <div class="loading-overlay hidden" id="loadingOverlay">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <div>Loading data...</div>
                    </div>
                </div>
                
                <script>
                    // Severity levels data
                    const severityLevels = ${JSON.stringify(severityLevels)};
                    
                    // Load data on page load
                    document.addEventListener('DOMContentLoaded', loadData);
                    
                    async function loadData() {
                        const storeId = document.getElementById('storeFilter').value;
                        const year = document.getElementById('yearFilter').value;
                        const period = document.getElementById('periodFilter').value;
                        
                        showLoading(true);
                        
                        try {
                            const params = new URLSearchParams({ year, period });
                            if (storeId) params.append('storeId', storeId);
                            
                            const response = await fetch('/ohs/safety-pyramid/api/data?' + params);
                            const data = await response.json();
                            
                            if (data.success) {
                                renderPyramid(data.pyramidData);
                                updateMetrics(data.metrics);
                            } else {
                                alert('Error loading data: ' + data.error);
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('Error loading data');
                        } finally {
                            showLoading(false);
                        }
                    }
                    
                    function renderPyramid(pyramidData) {
                        const container = document.getElementById('pyramidContainer');
                        
                        // Merge severity levels with counts
                        const levels = severityLevels.map(level => {
                            const data = pyramidData.find(p => p.SeverityLevelId === level.Id) || { Count: 0 };
                            return { ...level, Count: data.Count || 0 };
                        });
                        
                        container.innerHTML = levels.map((level, index) => \`
                            <div class="pyramid-level pyramid-level-\${index + 1}" 
                                 style="background: \${level.ColorHex}; border-radius: 4px;"
                                 onclick="viewLevelDetails(\${level.Id}, '\${level.LevelName}')">
                                <div class="level-content">
                                    <span class="level-name">\${level.LevelName}</span>
                                    <span class="level-count">\${level.Count}</span>
                                </div>
                                <div class="level-tooltip">
                                    <strong>\${level.LevelName}</strong><br>
                                    \${level.Description}<br><br>
                                    <em>\${level.IsLagging ? 'Lagging' : 'Leading'} Indicator</em><br>
                                    Reported by: \${level.ReportedBy}
                                </div>
                            </div>
                        \`).join('');
                        
                        // Adjust arrow heights after pyramid renders
                        setTimeout(() => adjustArrowHeights(), 100);
                    }
                    
                    function adjustArrowHeights() {
                        const pyramidLevels = document.querySelectorAll('.pyramid-level');
                        if (pyramidLevels.length < 7) return;
                        
                        // Calculate heights for each section
                        // LTIR: Levels 1-3 (Fatality, Irreversible, Lost-Time)
                        // RIR additional: Levels 4-5 (Restricted Work, Medical Treatment)
                        // Lagging: Levels 1-6, Leading: Level 7
                        
                        let ltirHeight = 0;
                        let rirHeight = 0;
                        let laggingHeight = 0;
                        let leadingHeight = 0;
                        
                        pyramidLevels.forEach((level, index) => {
                            const height = level.offsetHeight + 4; // Include margin
                            
                            // LTIR: Levels 1-3 (Fatality, Irreversible, Lost-Time)
                            if (index < 3) {
                                ltirHeight += height;
                            }
                            // RIR: Levels 1-5 (Fatality, Irreversible, Lost-Time, Restricted Work, Medical Treatment)
                            if (index < 5) {
                                rirHeight += height;
                            }
                            // Lagging: Levels 1-6 (Fatality to First Aid)
                            if (index < 6) {
                                laggingHeight += height;
                            }
                            // Leading: Level 7 only (Near Miss / Unsafe Conditions & Behaviors)
                            if (index === 6) {
                                leadingHeight += height;
                            }
                        });
                        
                        // Apply heights to arrow bodies (subtract arrow heads ~24px for both top and bottom)
                        const ltirBody = document.querySelector('#ltirArrow .arrow-body');
                        const rirBody = document.querySelector('#rirArrow .arrow-body');
                        const laggingBody = document.querySelector('#laggingArrow .arrow-body');
                        const leadingBody = document.querySelector('#leadingArrow .arrow-body');
                        
                        if (ltirBody) ltirBody.style.height = Math.max(ltirHeight - 24, 30) + 'px';
                        if (rirBody) rirBody.style.height = Math.max(rirHeight - 24, 30) + 'px';
                        if (laggingBody) laggingBody.style.height = Math.max(laggingHeight - 24, 30) + 'px';
                        if (leadingBody) leadingBody.style.height = Math.max(leadingHeight - 24, 30) + 'px';
                    }
                    
                    function updateMetrics(metrics) {
                        document.getElementById('rirValue').textContent = metrics.rir.toFixed(2);
                        document.getElementById('ltirValue').textContent = metrics.ltir.toFixed(2);
                        document.getElementById('totalIncidents').textContent = metrics.totalIncidents.toLocaleString();
                        document.getElementById('recordableIncidents').textContent = metrics.recordableIncidents.toLocaleString();
                        document.getElementById('lostTimeInjuries').textContent = metrics.lostTimeInjuries.toLocaleString();
                        document.getElementById('totalHours').textContent = metrics.totalHours.toLocaleString();
                    }
                    
                    function viewLevelDetails(levelId, levelName) {
                        const storeId = document.getElementById('storeFilter').value;
                        const year = document.getElementById('yearFilter').value;
                        const period = document.getElementById('periodFilter').value;
                        
                        // Navigate to incident history filtered by severity level
                        let url = '/stores/ohs-incident/history?severityLevel=' + levelId;
                        if (storeId) url += '&storeId=' + storeId;
                        url += '&year=' + year;
                        if (period !== 'ytd') url += '&month=' + period;
                        
                        window.location.href = url;
                    }
                    
                    function showLoading(show) {
                        document.getElementById('loadingOverlay').classList.toggle('hidden', !show);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading safety pyramid page:', error);
        res.status(500).send('Error loading page');
    }
});

// =====================================================
// API: Get Pyramid Data
// =====================================================
router.get('/api/data', async (req, res) => {
    try {
        const { storeId, year, period } = req.query;
        const pool = await getPool();
        
        // Build date filter
        let dateFilter = '';
        const currentYear = parseInt(year) || new Date().getFullYear();
        
        if (period === 'ytd') {
            dateFilter = `AND YEAR(i.IncidentDate) = ${currentYear}`;
        } else {
            const month = parseInt(period);
            dateFilter = `AND YEAR(i.IncidentDate) = ${currentYear} AND MONTH(i.IncidentDate) = ${month}`;
        }
        
        // Store filter
        let storeFilter = '';
        if (storeId) {
            storeFilter = `AND i.StoreId = ${parseInt(storeId)}`;
        }
        
        // Get incident counts by severity level
        const pyramidResult = await pool.request().query(`
            SELECT 
                ISNULL(i.SeverityLevelId, 7) as SeverityLevelId, -- Default to Near Miss if not set
                COUNT(*) as Count
            FROM OHSIncidents i
            WHERE 1=1 ${dateFilter} ${storeFilter}
            GROUP BY ISNULL(i.SeverityLevelId, 7)
        `);
        
        // Get severity levels for counts
        const levelsResult = await pool.request().query(`
            SELECT * FROM OHSSeverityLevels WHERE IsActive = 1
        `);
        const levels = levelsResult.recordset;
        
        // Get total hours worked for the period
        let hoursQuery = `
            SELECT ISNULL(SUM(TotalHoursWorked), 0) as TotalHours
            FROM OHSStoreManHours
            WHERE Year = ${currentYear}
        `;
        
        if (period !== 'ytd') {
            hoursQuery += ` AND Month = ${parseInt(period)}`;
        }
        
        if (storeId) {
            hoursQuery += ` AND StoreId = ${parseInt(storeId)}`;
        }
        
        const hoursResult = await pool.request().query(hoursQuery);
        const totalHours = hoursResult.recordset[0]?.TotalHours || 0;
        
        // Calculate metrics
        const pyramidData = pyramidResult.recordset;
        
        // Count recordable incidents (Medical Treatment and above - levels 1-5)
        let recordableIncidents = 0;
        let lostTimeInjuries = 0;
        let totalIncidents = 0;
        
        pyramidData.forEach(item => {
            totalIncidents += item.Count;
            
            const level = levels.find(l => l.Id === item.SeverityLevelId);
            if (level) {
                if (level.IncludeInRIR) recordableIncidents += item.Count;
                if (level.IncludeInLTIR) lostTimeInjuries += item.Count;
            }
        });
        
        // Calculate RIR and LTIR
        const rir = totalHours > 0 ? (recordableIncidents * 200000) / totalHours : 0;
        const ltir = totalHours > 0 ? (lostTimeInjuries * 200000) / totalHours : 0;
        
        res.json({
            success: true,
            pyramidData,
            metrics: {
                totalIncidents,
                recordableIncidents,
                lostTimeInjuries,
                totalHours,
                rir,
                ltir
            }
        });
    } catch (error) {
        console.error('Error fetching pyramid data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// Man-Hours Entry Page
// =====================================================
router.get('/man-hours', async (req, res) => {
    const user = req.currentUser;
    
    try {
        const pool = await getPool();
        
        // Get stores from main Stores table (from OE system settings)
        const storesResult = await pool.request().query(`
            SELECT Id as StoreId, StoreName, StoreCode
            FROM Stores
            WHERE IsActive = 1
            ORDER BY StoreName
        `);
        const stores = storesResult.recordset;
        
        const currentYear = new Date().getFullYear();
        
        // Get existing man-hours for current year
        const hoursResult = await pool.request().query(`
            SELECT * FROM OHSStoreManHours
            WHERE Year = ${currentYear}
            ORDER BY StoreId, Month
        `);
        const existingHours = hoursResult.recordset;
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Man-Hours Entry - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #e17055 0%, #d63031 100%);
                        min-height: 100vh;
                    }
                    .header {
                        background: rgba(0,0,0,0.2);
                        color: white;
                        padding: 15px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; align-items: center; }
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
                        max-width: 1400px;
                        margin: 0 auto;
                        padding: 30px;
                    }
                    
                    .card {
                        background: white;
                        border-radius: 12px;
                        padding: 25px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    }
                    .card-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #eee;
                    }
                    
                    .year-selector {
                        margin-bottom: 20px;
                        display: flex;
                        gap: 10px;
                        align-items: center;
                    }
                    .year-selector select {
                        padding: 10px 15px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    }
                    
                    .hours-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                    }
                    .hours-table th, .hours-table td {
                        padding: 10px 8px;
                        border: 1px solid #e0e0e0;
                        text-align: center;
                    }
                    .hours-table th {
                        background: #f5f5f5;
                        font-weight: 600;
                        position: sticky;
                        top: 0;
                    }
                    .hours-table th.store-col {
                        text-align: left;
                        min-width: 200px;
                    }
                    .hours-table td.store-name {
                        text-align: left;
                        font-weight: 500;
                    }
                    .hours-table input {
                        width: 70px;
                        padding: 6px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        text-align: right;
                    }
                    .hours-table input:focus {
                        border-color: #d63031;
                        outline: none;
                    }
                    .hours-table .total-row {
                        background: #f8f9fa;
                        font-weight: 600;
                    }
                    
                    .btn {
                        padding: 12px 25px;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: #d63031;
                        color: white;
                    }
                    .btn-primary:hover { background: #c0392b; }
                    
                    .actions-bar {
                        margin-top: 20px;
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                    }
                    
                    .user-info {
                        background: rgba(255,255,255,0.1);
                        padding: 8px 15px;
                        border-radius: 20px;
                        font-size: 14px;
                    }
                    
                    .toast {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        padding: 15px 25px;
                        border-radius: 8px;
                        color: white;
                        font-weight: 500;
                        z-index: 1000;
                        opacity: 0;
                        transition: opacity 0.3s;
                    }
                    .toast.show { opacity: 1; }
                    .toast.success { background: #00b894; }
                    .toast.error { background: #d63031; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Store Man-Hours Entry</h1>
                    <div class="header-nav">
                        <span class="user-info">👤 ${user?.displayName || 'User'}</span>
                        <a href="/ohs/safety-pyramid">⚠️ Safety Pyramid</a>
                        <a href="/ohs">🦺 OHS Home</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="card">
                        <div class="card-title">Monthly Hours Worked by Store</div>
                        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                            Enter total hours worked per month for each store. This data is used to calculate RIR and LTIR.
                        </p>
                        
                        <div class="year-selector">
                            <label><strong>Year:</strong></label>
                            <select id="yearSelect" onchange="loadYear()">
                                ${[2024, 2025, 2026, 2027].map(y => `
                                    <option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div style="overflow-x: auto;">
                            <table class="hours-table" id="hoursTable">
                                <thead>
                                    <tr>
                                        <th class="store-col">Store</th>
                                        ${months.map(m => `<th>${m}</th>`).join('')}
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stores.map(store => {
                                        const storeHours = existingHours.filter(h => h.StoreId === store.StoreId);
                                        return `
                                            <tr data-store-id="${store.StoreId}">
                                                <td class="store-name">${store.StoreName}</td>
                                                ${months.map((m, i) => {
                                                    const monthData = storeHours.find(h => h.Month === i + 1);
                                                    const value = monthData ? monthData.TotalHoursWorked : '';
                                                    return `<td><input type="number" step="0.01" min="0" data-month="${i + 1}" value="${value}" onchange="updateRowTotal(this)"></td>`;
                                                }).join('')}
                                                <td class="row-total">0</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                                <tfoot>
                                    <tr class="total-row">
                                        <td class="store-name">TOTAL</td>
                                        ${months.map((m, i) => `<td class="month-total" data-month="${i + 1}">0</td>`).join('')}
                                        <td id="grandTotal">0</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div class="actions-bar">
                            <button class="btn btn-primary" onclick="saveAllHours()">💾 Save All Hours</button>
                        </div>
                    </div>
                </div>
                
                <div class="toast" id="toast"></div>
                
                <script>
                    // Calculate totals on load
                    document.addEventListener('DOMContentLoaded', calculateAllTotals);
                    
                    function updateRowTotal(input) {
                        calculateAllTotals();
                    }
                    
                    function calculateAllTotals() {
                        const rows = document.querySelectorAll('tbody tr');
                        const monthTotals = {};
                        let grandTotal = 0;
                        
                        rows.forEach(row => {
                            let rowTotal = 0;
                            row.querySelectorAll('input').forEach(input => {
                                const value = parseFloat(input.value) || 0;
                                const month = input.dataset.month;
                                rowTotal += value;
                                monthTotals[month] = (monthTotals[month] || 0) + value;
                            });
                            row.querySelector('.row-total').textContent = rowTotal.toLocaleString();
                            grandTotal += rowTotal;
                        });
                        
                        // Update month totals
                        for (let i = 1; i <= 12; i++) {
                            const cell = document.querySelector('.month-total[data-month="' + i + '"]');
                            if (cell) {
                                cell.textContent = (monthTotals[i] || 0).toLocaleString();
                            }
                        }
                        
                        document.getElementById('grandTotal').textContent = grandTotal.toLocaleString();
                    }
                    
                    async function saveAllHours() {
                        const year = document.getElementById('yearSelect').value;
                        const rows = document.querySelectorAll('tbody tr');
                        const data = [];
                        
                        rows.forEach(row => {
                            const storeId = row.dataset.storeId;
                            const storeName = row.querySelector('.store-name').textContent;
                            
                            row.querySelectorAll('input').forEach(input => {
                                const month = parseInt(input.dataset.month);
                                const hours = parseFloat(input.value) || 0;
                                
                                if (hours > 0) {
                                    data.push({ storeId, storeName, year, month, hours });
                                }
                            });
                        });
                        
                        try {
                            const response = await fetch('/ohs/safety-pyramid/api/man-hours', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ entries: data, year })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showToast('Hours saved successfully!', 'success');
                            } else {
                                showToast('Error saving: ' + result.error, 'error');
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            showToast('Error saving hours', 'error');
                        }
                    }
                    
                    function loadYear() {
                        window.location.href = '/ohs/safety-pyramid/man-hours?year=' + document.getElementById('yearSelect').value;
                    }
                    
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast show ' + type;
                        setTimeout(() => toast.classList.remove('show'), 3000);
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error loading man-hours page:', error);
        res.status(500).send('Error loading page');
    }
});

// =====================================================
// API: Save Man-Hours
// =====================================================
router.post('/api/man-hours', async (req, res) => {
    try {
        const { entries, year } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        // Delete existing entries for the year and re-insert
        await pool.request()
            .input('year', sql.Int, year)
            .query('DELETE FROM OHSStoreManHours WHERE Year = @year');
        
        // Insert new entries
        for (const entry of entries) {
            await pool.request()
                .input('storeId', sql.Int, entry.storeId)
                .input('storeName', sql.NVarChar, entry.storeName)
                .input('year', sql.Int, entry.year)
                .input('month', sql.Int, entry.month)
                .input('totalHours', sql.Decimal(12, 2), entry.hours)
                .input('userId', sql.NVarChar, user?.id || '')
                .input('userName', sql.NVarChar, user?.displayName || '')
                .query(`
                    INSERT INTO OHSStoreManHours (StoreId, StoreName, Year, Month, TotalHoursWorked, EnteredByUserId, EnteredByName)
                    VALUES (@storeId, @storeName, @year, @month, @totalHours, @userId, @userName)
                `);
        }
        
        res.json({ success: true, message: 'Hours saved successfully' });
    } catch (error) {
        console.error('Error saving man-hours:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
