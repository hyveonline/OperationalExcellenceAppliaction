/**
 * Stores Module - Main Router
 */

const express = require('express');
const router = express.Router();
const path = require('path');
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

// Import form handlers
const theftIncidentRoutes = require('./theft-incident/routes');
const extraCleaningRoutes = require('./extra-cleaning/routes');
const productionExtrasRoutes = require('./production-extras/routes');
const weeklyFeedbackRoutes = require('./weekly-feedback/routes');
const complaintRoutes = require('./complaint/routes');
const fiveDaysRoutes = require('./five-days/routes');
const ohsIncidentRoutes = require('./ohs-incident/routes');
const evacuationDrillRoutes = require('./evacuation-drill/routes');
const lostAndFoundRoutes = require('./lost-and-found/routes');

// Stores main page
router.get('/', (req, res) => {
    const forms = [
        { id: 'theft-incident', icon: '🚨', title: 'Theft Incident Report', href: '/stores/theft-incident', desc: 'Report theft incidents at stores', color: '#dc3545' },
        { id: 'extra-cleaning', icon: '👥', title: 'Extra Third-Party Support', href: '/stores/extra-cleaning', desc: 'Request extra third-party support for your store', color: '#17a2b8' },
        { id: 'weekly-feedback', icon: '📋', title: 'Weekly Third Party Feedback', href: '/stores/weekly-feedback', desc: 'Submit weekly feedback about third party services', color: '#6c5ce7' },
        { id: 'complaint', icon: '📝', title: 'Complaint', href: '/stores/complaint', desc: 'Submit and track complaints', color: '#e17055' },
        { id: 'five-days', icon: '📅', title: '5 Days - Expired Items', href: '/stores/five-days', desc: 'Track expired items during 5-day cycles', color: '#667eea' },
        { id: 'ohs-incident', icon: '🦺', title: 'OHS A&I Reporting', href: '/stores/ohs-incident', desc: 'Report accidents, incidents, and near misses', color: '#e17055' },
        { id: 'evacuation-drill', icon: '🚨', title: 'Post Evacuation Drill', href: '/stores/evacuation-drill', desc: 'Submit post-evacuation drill assessments', color: '#00b894' },
        { id: 'lost-and-found', icon: '🔍', title: 'Lost and Found', href: '/stores/lost-and-found', desc: 'Log lost and found items with return tracking', color: '#6c5ce7' },
        // More forms will be added here
    ];
    
    const formsHtml = forms.map(form => `
        <a href="${form.href}" class="form-card" style="border-top: 4px solid ${form.color || '#0078d4'}">
            <div class="form-icon">${form.icon}</div>
            <div class="form-title" style="color: ${form.color || '#0078d4'}">${form.title}</div>
            <div class="form-desc">${form.desc}</div>
        </a>
    `).join('');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Stores - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                }
                .header {
                    background: linear-gradient(135deg, #0078d4 0%, #005a9e 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { margin: 0; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    margin-left: 20px;
                    padding: 8px 16px;
                    border-radius: 5px;
                    background: rgba(255,255,255,0.1);
                }
                .header-nav a:hover {
                    background: rgba(255,255,255,0.2);
                }
                .container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 30px;
                }
                .breadcrumb {
                    margin-bottom: 20px;
                    color: #666;
                }
                .breadcrumb a {
                    color: #0078d4;
                    text-decoration: none;
                }
                .page-title {
                    font-size: 28px;
                    color: #333;
                    margin-bottom: 30px;
                }
                .forms-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 25px;
                }
                .form-card {
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: #333;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    transition: all 0.3s ease;
                    border: 1px solid #e0e0e0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }
                .form-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0,120,212,0.2);
                    border-color: #0078d4;
                }
                .form-icon {
                    font-size: 48px;
                    margin-bottom: 15px;
                }
                .form-title {
                    font-size: 20px;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #0078d4;
                }
                .form-desc {
                    font-size: 14px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏪 Stores</h1>
                <div class="header-nav">
                    <a href="/dashboard">← Dashboard</a>
                    <a href="/auth/logout">Logout</a>
                </div>
            </div>
            <div class="container">
                <div class="breadcrumb">
                    <a href="/dashboard">Dashboard</a> / <span>Stores</span>
                </div>
                
                <!-- Third Party Staff Summary Section -->
                <div id="staffSummarySection" style="display:none; margin-bottom: 30px;">
                    <h2 class="page-title">📊 Third Party Staff Summary</h2>
                    <div id="staffSummaryCards" class="summary-cards"></div>
                </div>
                
                <h2 class="page-title">Store Forms & Reports</h2>
                <div class="forms-grid">
                    ${formsHtml}
                </div>
            </div>
            
            <style>
                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .summary-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    border-left: 4px solid #0078d4;
                }
                .summary-card h3 {
                    margin: 0 0 15px 0;
                    color: #333;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .summary-card h3 .store-icon { font-size: 24px; }
                .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .summary-table th, .summary-table td {
                    padding: 8px 10px;
                    text-align: left;
                    border-bottom: 1px solid #eee;
                }
                .summary-table th {
                    background: #f8f9fa;
                    font-weight: 600;
                    color: #555;
                }
                .summary-table tr:last-child td { border-bottom: none; }
                .summary-table .total-row {
                    background: #e8f4fd;
                    font-weight: 600;
                }
                .summary-table .total-row td { border-top: 2px solid #0078d4; }
                .category-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                }
                .category-Security { background: #ffeeba; color: #856404; }
                .category-Valet { background: #b8daff; color: #004085; }
                .category-Cleaning { background: #c3e6cb; color: #155724; }
                .category-Helpers { background: #f5c6cb; color: #721c24; }
                .no-data-msg {
                    color: #888;
                    font-style: italic;
                    padding: 20px;
                    text-align: center;
                }
            </style>
            
            <script>
                // Load staff summary on page load
                document.addEventListener('DOMContentLoaded', loadStaffSummary);
                
                async function loadStaffSummary() {
                    try {
                        const res = await fetch('/stores/api/master-table-summary');
                        const data = await res.json();
                        
                        if (data.error) {
                            console.log('Staff summary not available:', data.error);
                            return;
                        }
                        
                        if (!data.stores || data.stores.length === 0) {
                            return; // No stores assigned, don't show section
                        }
                        
                        document.getElementById('staffSummarySection').style.display = 'block';
                        renderStaffSummary(data);
                    } catch (err) {
                        console.error('Error loading staff summary:', err);
                    }
                }
                
                function renderStaffSummary(data) {
                    const container = document.getElementById('staffSummaryCards');
                    const months = data.months || [];
                    
                    // Group data by store
                    const storeData = {};
                    data.stores.forEach(store => {
                        storeData[store.StoreName] = {
                            storeName: store.StoreName,
                            categories: {}
                        };
                    });
                    
                    // Populate with summary data
                    (data.summary || []).forEach(row => {
                        if (!storeData[row.Branch]) return;
                        
                        if (!storeData[row.Branch].categories[row.Category]) {
                            storeData[row.Branch].categories[row.Category] = {};
                        }
                        
                        const key = row.Year + '-' + row.Month;
                        storeData[row.Branch].categories[row.Category][key] = {
                            count: row.TotalCount || 0,
                            salary: row.TotalSalary || 0,
                            total: row.TotalCost || 0
                        };
                    });
                    
                    // Render cards
                    let html = '';
                    Object.values(storeData).forEach(store => {
                        const categories = Object.keys(store.categories);
                        if (categories.length === 0) {
                            html += '<div class="summary-card">' +
                                '<h3><span class="store-icon">🏪</span> ' + store.storeName + '</h3>' +
                                '<div class="no-data-msg">No third party staff data available</div>' +
                            '</div>';
                            return;
                        }
                        
                        html += '<div class="summary-card">' +
                            '<h3><span class="store-icon">🏪</span> ' + store.storeName + '</h3>' +
                            '<table class="summary-table">' +
                                '<thead><tr>' +
                                    '<th>Category</th>' +
                                    '<th>Month</th>' +
                                    '<th style="text-align:right">Count</th>' +
                                    '<th style="text-align:right">Salary</th>' +
                                    '<th style="text-align:right">Total</th>' +
                                '</tr></thead>' +
                                '<tbody>';
                        
                        let grandTotal = 0;
                        categories.forEach(cat => {
                            const monthData = store.categories[cat];
                            Object.keys(monthData).sort().reverse().forEach(key => {
                                const parts = key.split('-');
                                const year = parts[0];
                                const month = parts[1];
                                const monthName = new Date(year, month-1).toLocaleDateString('en-US', {month:'short', year:'numeric'});
                                const d = monthData[key];
                                grandTotal += d.total;
                                
                                html += '<tr>' +
                                    '<td><span class="category-badge category-' + cat + '">' + cat + '</span></td>' +
                                    '<td>' + monthName + '</td>' +
                                    '<td style="text-align:right">' + d.count.toFixed(1) + '</td>' +
                                    '<td style="text-align:right">$' + d.salary.toLocaleString() + '</td>' +
                                    '<td style="text-align:right">$' + d.total.toLocaleString() + '</td>' +
                                '</tr>';
                            });
                        });
                        
                        html += '<tr class="total-row">' +
                            '<td colspan="4"><strong>Grand Total</strong></td>' +
                            '<td style="text-align:right"><strong>$' + grandTotal.toLocaleString() + '</strong></td>' +
                        '</tr></tbody></table></div>';
                    });
                    
                    container.innerHTML = html;
                }
            </script>
        </body>
        </html>
    `);
});

// API: Get Master Table Summary for logged-in store manager's stores
router.get('/api/master-table-summary', async (req, res) => {
    const user = req.currentUser;
    
    if (!user || !user.userId) {
        return res.json({ error: 'Not authenticated', stores: [] });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get stores assigned to this user
        const storesResult = await pool.request()
            .input('userId', sql.Int, user.userId)
            .query(`
                SELECT DISTINCT s.Id, s.StoreName
                FROM StoreManagerAssignments sma
                JOIN Stores s ON sma.StoreId = s.Id
                WHERE sma.UserId = @userId AND s.IsActive = 1
                ORDER BY s.StoreName
            `);
        
        const stores = storesResult.recordset;
        
        if (stores.length === 0) {
            await pool.close();
            return res.json({ stores: [], summary: [], months: [] });
        }
        
        const storeNames = stores.map(s => s.StoreName);
        
        // Get summary data from MasterTableEntries grouped by Branch, Category, Year, Month
        const currentYear = new Date().getFullYear();
        
        // Build IN clause safely
        const inClause = storeNames.map(name => "'" + name.replace(/'/g, "''") + "'").join(',');
        
        const summaryResult = await pool.request()
            .input('year', sql.Int, currentYear)
            .query(`
                SELECT 
                    e.Branch,
                    e.Category,
                    m.Year,
                    m.Month,
                    SUM(m.StaffCount) as TotalCount,
                    SUM(m.Salary) as TotalSalary,
                    SUM(m.StaffCount * m.Salary) as TotalCost
                FROM MasterTableEntries e
                JOIN MasterTableMonthlyData m ON e.Id = m.EntryId
                WHERE e.IsActive = 1 
                    AND m.Year = @year
                    AND e.Branch IN (${inClause})
                GROUP BY e.Branch, e.Category, m.Year, m.Month
                ORDER BY e.Branch, e.Category, m.Year DESC, m.Month DESC
            `);
        
        // Get available months
        const monthsResult = await pool.request()
            .input('year', sql.Int, currentYear)
            .query(`
                SELECT DISTINCT Year, Month 
                FROM MasterTableActiveMonths 
                WHERE Year = @year 
                ORDER BY Year DESC, Month DESC
            `);
        
        await pool.close();
        
        res.json({
            stores: stores,
            summary: summaryResult.recordset,
            months: monthsResult.recordset
        });
        
    } catch (err) {
        console.error('Error fetching master table summary:', err);
        res.status(500).json({ error: err.message });
    }
});

// Mount form routes
router.use('/theft-incident', theftIncidentRoutes);
router.use('/extra-cleaning', extraCleaningRoutes);
router.use('/production-extras', productionExtrasRoutes);
router.use('/weekly-feedback', weeklyFeedbackRoutes);
router.use('/complaint', complaintRoutes);
router.use('/five-days', fiveDaysRoutes);
router.use('/ohs-incident', ohsIncidentRoutes);
router.use('/evacuation-drill', evacuationDrillRoutes);
router.use('/lost-and-found', lostAndFoundRoutes);

module.exports = router;
