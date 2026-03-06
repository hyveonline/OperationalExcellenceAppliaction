/**
 * 5 Days Expired Items Tracking - Store Manager Module
 * Tracks expired items found during 5-day cycles (2 times per month)
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    }
});

const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let poolPromise = null;
async function getPool() {
    try {
        if (!poolPromise) {
            poolPromise = sql.connect(dbConfig);
        }
        const pool = await poolPromise;
        if (!pool.connected) {
            poolPromise = null;
            poolPromise = sql.connect(dbConfig);
            return await poolPromise;
        }
        return pool;
    } catch (err) {
        poolPromise = null;
        throw err;
    }
}

// Main form page
router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const user = req.currentUser || req.session?.user;
    
    // Get store from StoreManagerAssignments table (primary assignment)
    let storeName = '';
    let storeId = null;
    let allStores = [];
    try {
        const pool = await getPool();
        
        // Get user's assigned store
        const storeResult = await pool.request()
            .input('userId', sql.Int, user?.userId || 0)
            .query(`
                SELECT s.Id, s.StoreName 
                FROM StoreManagerAssignments sma
                JOIN Stores s ON sma.StoreId = s.Id
                WHERE sma.UserId = @userId AND sma.IsPrimary = 1
            `);
        if (storeResult.recordset[0]) {
            storeId = storeResult.recordset[0].Id;
            storeName = storeResult.recordset[0].StoreName;
        }
        
        // Get all active stores for dropdown
        const allStoresResult = await pool.request().query(`
            SELECT Id, StoreName, StoreCode FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        allStores = allStoresResult.recordset;
    } catch (err) {
        console.error('[5 Days] Error getting store assignment:', err);
    }
    
    // Generate store options HTML
    const storeOptionsHtml = allStores.map(s => 
        `<option value="${s.Id}" ${s.Id === storeId ? 'selected' : ''}>${s.StoreName}${s.StoreCode ? ' (' + s.StoreCode + ')' : ''}</option>`
    ).join('');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>5 Days - Expired Items Tracking</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
                .header {
                    background: rgba(255,255,255,0.1);
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: white;
                }
                .header h1 { font-size: 20px; }
                .header a { color: white; text-decoration: none; opacity: 0.8; }
                .header a:hover { opacity: 1; }
                
                .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
                
                .card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    margin-bottom: 20px;
                }
                
                .card-title {
                    font-size: 24px;
                    color: #333;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .card-desc { color: #666; margin-bottom: 25px; }
                
                .cycle-selector {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .cycle-btn {
                    flex: 1;
                    padding: 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    background: white;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.3s;
                }
                .cycle-btn:hover { border-color: #667eea; }
                .cycle-btn.active { border-color: #667eea; background: #f0f4ff; }
                .cycle-btn .label { font-weight: 600; color: #333; }
                .cycle-btn .sub { font-size: 12px; color: #888; margin-top: 5px; }
                
                .day-selector {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 25px;
                }
                .day-btn {
                    flex: 1;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    background: white;
                    cursor: pointer;
                    text-align: center;
                    font-weight: 600;
                    transition: all 0.3s;
                }
                .day-btn:hover { border-color: #667eea; background: #f8f9ff; }
                .day-btn.active { border-color: #667eea; background: #667eea; color: white; }
                
                .form-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
                .form-row.two-col { grid-template-columns: repeat(2, 1fr); }
                .form-group { display: flex; flex-direction: column; }
                .form-group label { font-weight: 600; color: #333; margin-bottom: 8px; font-size: 13px; }
                .form-group label span { color: #dc3545; }
                .form-control {
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }
                .form-control:focus { outline: none; border-color: #667eea; }
                
                .btn {
                    padding: 14px 30px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102,126,234,0.4); }
                .btn-secondary { background: #6c757d; color: white; }
                .btn-success { background: #28a745; color: white; }
                
                .btn-row { display: flex; gap: 15px; justify-content: flex-end; margin-top: 25px; }
                
                .entries-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .entries-table th, .entries-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
                .entries-table th { background: #f8f9fa; font-weight: 600; }
                .entries-table tr:hover { background: #f8f9fa; }
                
                .badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                .badge-day { background: #667eea; color: white; }
                .badge-cycle { background: #28a745; color: white; }
                
                .empty-state { text-align: center; padding: 40px; color: #888; }
                .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                
                @media (max-width: 768px) {
                    .form-row { grid-template-columns: 1fr; }
                    .form-row.two-col { grid-template-columns: 1fr; }
                    .cycle-selector { flex-direction: column; }
                    .day-selector { flex-wrap: wrap; }
                    .day-btn { flex: 0 0 calc(33% - 10px); }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📅 5 Days - Expired Items Tracking</h1>
                <a href="/stores">← Back to Store Portal</a>
            </div>
            
            <div class="container">
                <div class="card">
                    <div class="card-title">📦 Add Expired Item Entry</div>
                    <div class="card-desc">Record expired items found during the 5-day cycle. Select cycle and day, then enter item details.</div>
                    
                    <!-- Excel Upload Section -->
                    <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%); border-radius: 12px; padding: 20px; margin-bottom: 25px; border: 2px dashed #667eea;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                            <div>
                                <h3 style="color: #333; margin-bottom: 5px;">📊 Bulk Upload via Excel</h3>
                                <p style="color: #666; font-size: 13px; margin: 0;">Download template, fill items for the cycle, then upload</p>
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                <select id="uploadStore" style="padding: 10px 15px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px; background: white; min-width: 180px;">
                                    <option value="">-- Select Store --</option>
                                    ${storeOptionsHtml}
                                </select>
                                <select id="uploadCycle" style="padding: 10px 15px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px; background: white;">
                                    <option value="1">Cycle 1</option>
                                    <option value="2">Cycle 2</option>
                                </select>
                                <button type="button" onclick="downloadTemplate()" class="btn" style="background: #28a745; padding: 10px 20px;">
                                    ⬇️ Download Template
                                </button>
                                <label class="btn" style="background: #667eea; padding: 10px 20px; cursor: pointer;">
                                    ⬆️ Upload Excel
                                    <input type="file" id="excelFile" accept=".xlsx,.xls" style="display: none;" onchange="uploadExcel(this)">
                                </label>
                            </div>
                        </div>
                        <div id="uploadStatus" style="margin-top: 10px; display: none;"></div>
                    </div>
                    
                    <div style="text-align: center; color: #888; margin-bottom: 20px; font-size: 13px;">— OR enter items manually below —</div>
                    
                    <form id="entryForm">
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight:600;color:#333;margin-bottom:10px;display:block;">Select Cycle</label>
                            <div class="cycle-selector">
                                <div class="cycle-btn active" data-cycle="1" onclick="selectCycle(1)">
                                    <div class="label">1st Cycle</div>
                                    <div class="sub">First 5 days of the month</div>
                                </div>
                                <div class="cycle-btn" data-cycle="2" onclick="selectCycle(2)">
                                    <div class="label">2nd Cycle</div>
                                    <div class="sub">Second 5 days of the month</div>
                                </div>
                            </div>
                            <input type="hidden" name="cycleNumber" id="cycleNumber" value="1">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight:600;color:#333;margin-bottom:10px;display:block;">Select Day <span style="color:#dc3545;">*</span></label>
                            <div class="day-selector">
                                <div class="day-btn" data-day="1" onclick="selectDay(1)">Day 1</div>
                                <div class="day-btn" data-day="2" onclick="selectDay(2)">Day 2</div>
                                <div class="day-btn" data-day="3" onclick="selectDay(3)">Day 3</div>
                                <div class="day-btn" data-day="4" onclick="selectDay(4)">Day 4</div>
                                <div class="day-btn" data-day="5" onclick="selectDay(5)">Day 5</div>
                            </div>
                            <input type="hidden" name="dayNumber" id="dayNumber" value="">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Item No <span>*</span></label>
                                <input type="text" name="itemNo" class="form-control" pattern="[0-9]+" placeholder="Numbers only" required>
                            </div>
                            <div class="form-group">
                                <label>Item Variant</label>
                                <input type="text" name="itemVariant" class="form-control" placeholder="Numbers & letters">
                            </div>
                            <div class="form-group">
                                <label>Barcode</label>
                                <input type="text" name="barcode" class="form-control" pattern="[0-9]*" placeholder="Numbers only">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Family</label>
                                <input type="text" name="family" class="form-control" placeholder="Product family">
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Description</label>
                                <input type="text" name="description" class="form-control" placeholder="Item description">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Size</label>
                                <input type="text" name="size" class="form-control" placeholder="e.g., 500ml, 1kg">
                            </div>
                            <div class="form-group">
                                <label>Qty</label>
                                <input type="number" name="qty" class="form-control" min="1" placeholder="Quantity">
                            </div>
                            <div class="form-group">
                                <label>Expiry Date</label>
                                <input type="date" name="expiryDate" class="form-control">
                            </div>
                        </div>
                        
                        <div class="form-row two-col">
                            <div class="form-group">
                                <label>Date Found <span>*</span></label>
                                <input type="date" name="dateFound" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                            <div class="form-group">
                                <label>Store</label>
                                <input type="text" class="form-control" value="${storeName}" readonly style="background:#f8f9fa;">
                            </div>
                        </div>
                        
                        <div class="btn-row">
                            <button type="button" class="btn btn-secondary" onclick="clearForm()">Clear</button>
                            <button type="submit" class="btn btn-primary">➕ Add Entry</button>
                        </div>
                    </form>
                </div>
                
                <div class="card">
                    <div class="card-title">📋 Today's Entries</div>
                    <div id="entriesList">
                        <div class="empty-state">
                            <div class="icon">📭</div>
                            <p>No entries yet. Add your first expired item above.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                let selectedDay = null;
                let selectedCycle = 1;
                
                // Excel template download
                function downloadTemplate() {
                    const cycle = document.getElementById('uploadCycle').value;
                    window.location.href = '/stores/five-days/api/template?cycle=' + cycle;
                }
                
                // Excel upload
                async function uploadExcel(input) {
                    const file = input.files[0];
                    if (!file) return;
                    
                    const cycle = document.getElementById('uploadCycle').value;
                    const storeId = document.getElementById('uploadStore').value;
                    const statusDiv = document.getElementById('uploadStatus');
                    
                    if (!storeId) {
                        statusDiv.style.display = 'block';
                        statusDiv.innerHTML = '<span style="color: #dc3545;">❌ Please select a store first</span>';
                        input.value = '';
                        return;
                    }
                    
                    statusDiv.style.display = 'block';
                    statusDiv.innerHTML = '<span style="color: #667eea;">⏳ Uploading and processing...</span>';
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('cycleNumber', cycle);
                    formData.append('storeId', storeId);
                    
                    try {
                        const res = await fetch('/stores/five-days/api/upload-excel', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await res.json();
                        
                        if (result.success) {
                            statusDiv.innerHTML = '<span style="color: #28a745;">✅ ' + result.message + '</span>';
                            loadTodayEntries();
                        } else {
                            statusDiv.innerHTML = '<span style="color: #dc3545;">❌ ' + (result.error || 'Upload failed') + '</span>';
                        }
                    } catch (err) {
                        statusDiv.innerHTML = '<span style="color: #dc3545;">❌ Error: ' + err.message + '</span>';
                    }
                    
                    // Clear file input
                    input.value = '';
                    
                    // Hide status after 5 seconds
                    setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
                }
                
                function selectCycle(cycle) {
                    selectedCycle = cycle;
                    document.getElementById('cycleNumber').value = cycle;
                    document.querySelectorAll('.cycle-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.cycle == cycle);
                    });
                }
                
                function selectDay(day) {
                    selectedDay = day;
                    document.getElementById('dayNumber').value = day;
                    document.querySelectorAll('.day-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.day == day);
                    });
                }
                
                function clearForm() {
                    document.getElementById('entryForm').reset();
                    document.getElementById('cycleNumber').value = 1;
                    document.getElementById('dayNumber').value = '';
                    selectedDay = null;
                    selectCycle(1);
                    document.querySelectorAll('.day-btn').forEach(btn => btn.classList.remove('active'));
                }
                
                document.getElementById('entryForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    if (!selectedDay) {
                        alert('Please select a Day (1-5)');
                        return;
                    }
                    
                    const form = e.target;
                    const data = {
                        cycleNumber: parseInt(form.cycleNumber.value),
                        dayNumber: parseInt(form.dayNumber.value),
                        itemNo: form.itemNo.value,
                        itemVariant: form.itemVariant.value,
                        barcode: form.barcode.value,
                        family: form.family.value,
                        description: form.description.value,
                        size: form.size.value,
                        qty: form.qty.value ? parseInt(form.qty.value) : null,
                        expiryDate: form.expiryDate.value || null,
                        dateFound: form.dateFound.value
                    };
                    
                    try {
                        const res = await fetch('/stores/five-days/api/entry', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        if (res.ok) {
                            alert('Entry added successfully!');
                            // Clear item fields but keep day/cycle
                            form.itemNo.value = '';
                            form.itemVariant.value = '';
                            form.barcode.value = '';
                            form.family.value = '';
                            form.description.value = '';
                            form.size.value = '';
                            form.qty.value = '';
                            form.expiryDate.value = '';
                            loadTodayEntries();
                        } else {
                            const err = await res.json();
                            alert('Error: ' + (err.error || 'Failed to save'));
                        }
                    } catch (err) {
                        alert('Error: ' + err.message);
                    }
                });
                
                async function loadTodayEntries() {
                    try {
                        const res = await fetch('/stores/five-days/api/my-entries?today=true');
                        const entries = await res.json();
                        
                        if (entries.length === 0) {
                            document.getElementById('entriesList').innerHTML = \`
                                <div class="empty-state">
                                    <div class="icon">📭</div>
                                    <p>No entries yet. Add your first expired item above.</p>
                                </div>
                            \`;
                            return;
                        }
                        
                        const rows = entries.map(e => \`
                            <tr>
                                <td><span class="badge badge-cycle">C\${e.CycleNumber}</span> <span class="badge badge-day">D\${e.DayNumber}</span></td>
                                <td>\${e.ItemNo}</td>
                                <td>\${e.Description || '-'}</td>
                                <td>\${e.Qty || '-'}</td>
                                <td>\${e.ExpiryDate ? new Date(e.ExpiryDate).toLocaleDateString('en-GB') : '-'}</td>
                                <td>
                                    <button onclick="deleteEntry(\${e.Id})" style="background:#dc3545;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">🗑️</button>
                                </td>
                            </tr>
                        \`).join('');
                        
                        document.getElementById('entriesList').innerHTML = \`
                            <table class="entries-table">
                                <thead>
                                    <tr>
                                        <th>Cycle/Day</th>
                                        <th>Item No</th>
                                        <th>Description</th>
                                        <th>Qty</th>
                                        <th>Expiry Date</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>\${rows}</tbody>
                            </table>
                        \`;
                    } catch (err) {
                        console.error('Error loading entries:', err);
                    }
                }
                
                async function deleteEntry(id) {
                    if (!confirm('Delete this entry?')) return;
                    
                    try {
                        const res = await fetch('/stores/five-days/api/entry/' + id, { method: 'DELETE' });
                        if (res.ok) {
                            loadTodayEntries();
                        }
                    } catch (err) {
                        alert('Error deleting entry');
                    }
                }
                
                // Load entries on page load
                loadTodayEntries();
            </script>
        </body>
        </html>
    `);
});

// History page
router.get('/history', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const user = req.session?.user;
    
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('storeId', sql.Int, user?.storeId || 0)
            .query(`
                SELECT f.*, s.StoreName
                FROM FiveDaysEntries f
                LEFT JOIN Stores s ON f.StoreId = s.Id
                WHERE f.StoreId = @storeId
                ORDER BY f.CreatedAt DESC
            `);
        
        const entries = result.recordset;
        
        const rows = entries.map(e => `
            <tr>
                <td>${new Date(e.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td><span class="badge badge-cycle">Cycle ${e.CycleNumber}</span></td>
                <td><span class="badge badge-day">Day ${e.DayNumber}</span></td>
                <td>${e.ItemNo}</td>
                <td>${e.Description || '-'}</td>
                <td>${e.Qty || '-'}</td>
                <td>${e.ExpiryDate ? new Date(e.ExpiryDate).toLocaleDateString('en-GB') : '-'}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>5 Days History</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial; background: #f0f2f5; min-height: 100vh; }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px 30px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .header h1 { font-size: 20px; }
                    .header a { color: white; text-decoration: none; opacity: 0.8; }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    th { background: #f8f9fa; font-weight: 600; }
                    .badge { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                    .badge-day { background: #667eea; color: white; }
                    .badge-cycle { background: #28a745; color: white; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 5 Days - My History</h1>
                    <a href="/stores/five-days">← Back to Form</a>
                </div>
                <div class="container">
                    <div class="card">
                        ${entries.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Cycle</th>
                                        <th>Day</th>
                                        <th>Item No</th>
                                        <th>Description</th>
                                        <th>Qty</th>
                                        <th>Expiry Date</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        ` : '<p style="text-align:center;color:#888;padding:40px;">No entries found.</p>'}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

// API: Add entry
router.post('/api/entry', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const user = req.currentUser || req.session?.user;
        
        const { cycleNumber, dayNumber, itemNo, itemVariant, barcode, family, description, size, qty, expiryDate, dateFound } = req.body;
        
        if (!dayNumber || !itemNo) {
            return res.status(400).json({ error: 'Day and Item No are required' });
        }
        
        const pool = await getPool();
        
        // Get store from StoreManagerAssignments
        const storeResult = await pool.request()
            .input('userId', sql.Int, user?.userId || 0)
            .query(`
                SELECT StoreId FROM StoreManagerAssignments 
                WHERE UserId = @userId AND IsPrimary = 1
            `);
        
        const storeId = storeResult.recordset[0]?.StoreId;
        if (!storeId) {
            return res.status(400).json({ error: 'Store not assigned to user' });
        }
        
        await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('createdBy', sql.Int, user.userId)
            .input('cycleNumber', sql.Int, cycleNumber || 1)
            .input('dayNumber', sql.Int, dayNumber)
            .input('itemNo', sql.NVarChar, itemNo)
            .input('itemVariant', sql.NVarChar, itemVariant || null)
            .input('barcode', sql.NVarChar, barcode || null)
            .input('family', sql.NVarChar, family || null)
            .input('description', sql.NVarChar, description || null)
            .input('size', sql.NVarChar, size || null)
            .input('qty', sql.Int, qty || null)
            .input('expiryDate', sql.Date, expiryDate || null)
            .input('dateFound', sql.Date, dateFound || null)
            .query(`
                INSERT INTO FiveDaysEntries 
                (StoreId, CreatedBy, CycleNumber, DayNumber, ItemNo, ItemVariant, Barcode, Family, Description, Size, Qty, ExpiryDate, DateFound)
                VALUES 
                (@storeId, @createdBy, @cycleNumber, @dayNumber, @itemNo, @itemVariant, @barcode, @family, @description, @size, @qty, @expiryDate, @dateFound)
            `);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error adding entry:', err);
        poolPromise = null;
        res.status(500).json({ error: err.message });
    }
});

// API: Get my entries
router.get('/api/my-entries', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const user = req.currentUser || req.session?.user;
        const today = req.query.today === 'true';
        
        const pool = await getPool();
        
        // Get user's store from StoreManagerAssignments
        const storeResult = await pool.request()
            .input('userId', sql.Int, user?.userId || 0)
            .query(`
                SELECT sma.StoreId 
                FROM StoreManagerAssignments sma
                WHERE sma.UserId = @userId AND sma.IsPrimary = 1
            `);
        
        const storeId = storeResult.recordset[0]?.StoreId || 0;
        
        let query = `
            SELECT * FROM FiveDaysEntries 
            WHERE StoreId = @storeId
        `;
        
        if (today) {
            query += ` AND CAST(CreatedAt as DATE) = CAST(GETDATE() as DATE)`;
        }
        
        query += ` ORDER BY CreatedAt DESC`;
        
        const result = await pool.request()
            .input('storeId', sql.Int, storeId)
            .query(query);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error getting entries:', err);
        poolPromise = null;
        res.json([]);
    }
});

// API: Delete entry
router.delete('/api/entry/:id', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
        const user = req.currentUser || req.session?.user;
        const pool = await getPool();
        
        // Get user's store from StoreManagerAssignments
        const storeResult = await pool.request()
            .input('userId', sql.Int, user?.userId || 0)
            .query(`
                SELECT sma.StoreId 
                FROM StoreManagerAssignments sma
                WHERE sma.UserId = @userId AND sma.IsPrimary = 1
            `);
        
        const storeId = storeResult.recordset[0]?.StoreId || 0;
        
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('storeId', sql.Int, storeId)
            .query('DELETE FROM FiveDaysEntries WHERE Id = @id AND StoreId = @storeId');
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting entry:', err);
        poolPromise = null;
        res.status(500).json({ error: err.message });
    }
});

// API: Download Excel template
router.get('/api/template', async (req, res) => {
    try {
        const user = req.currentUser || req.session?.user;
        const cycleNumber = req.query.cycle || '1';
        
        // Get user's store name
        let storeName = '';
        try {
            const pool = await getPool();
            const storeResult = await pool.request()
                .input('userId', sql.Int, user?.userId || 0)
                .query(`
                    SELECT s.StoreName 
                    FROM StoreManagerAssignments sma
                    JOIN Stores s ON sma.StoreId = s.Id
                    WHERE sma.UserId = @userId AND sma.IsPrimary = 1
                `);
            storeName = storeResult.recordset[0]?.StoreName || '';
        } catch (err) {
            console.error('[5 Days] Error getting store:', err);
        }
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'OE App';
        workbook.created = new Date();
        
        const sheet = workbook.addWorksheet('5 Days Entries');
        
        // Set columns with proper widths
        sheet.columns = [
            { header: 'Day', key: 'day', width: 8 },
            { header: 'Item No', key: 'itemNo', width: 15 },
            { header: 'Item Variant', key: 'itemVariant', width: 15 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'Item Family', key: 'family', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Size', key: 'size', width: 12 },
            { header: 'Qty', key: 'qty', width: 8 },
            { header: 'Expiry Date', key: 'expiryDate', width: 14 },
            { header: 'Store Name', key: 'storeName', width: 20 },
            { header: 'Date Found', key: 'dateFound', width: 14 }
        ];
        
        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF667EEA' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;
        
        // Add validation notes row
        sheet.addRow({
            day: '1-5',
            itemNo: 'Numbers only',
            itemVariant: 'Letters & numbers',
            barcode: 'Numbers only',
            family: '',
            description: '',
            size: '',
            qty: '',
            expiryDate: 'DD/MM/YYYY',
            storeName: storeName,
            dateFound: 'DD/MM/YYYY'
        });
        
        const notesRow = sheet.getRow(2);
        notesRow.font = { italic: true, color: { argb: 'FF888888' } };
        notesRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F4FF' }
        };
        
        // Add data validation for Day column (must be 1-5)
        sheet.getColumn('day').eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber > 2) {
                cell.dataValidation = {
                    type: 'whole',
                    operator: 'between',
                    formulae: [1, 5],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Day',
                    error: 'Day must be between 1 and 5'
                };
            }
        });
        
        // Add 20 empty rows for data entry with store name pre-filled
        for (let i = 0; i < 20; i++) {
            const row = sheet.addRow({
                day: '',
                itemNo: '',
                itemVariant: '',
                barcode: '',
                family: '',
                description: '',
                size: '',
                qty: '',
                expiryDate: '',
                storeName: storeName,
                dateFound: ''
            });
            
            // Add day validation to each data row
            row.getCell('day').dataValidation = {
                type: 'whole',
                operator: 'between',
                formulae: [1, 5],
                showErrorMessage: true,
                errorTitle: 'Invalid Day',
                error: 'Day must be between 1 and 5'
            };
        }
        
        // Add borders to all cells
        sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                    right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                };
            });
        });
        
        // Set response headers
        const filename = `5Days_Template_Cycle${cycleNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('[5 Days] Error generating template:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Upload Excel file
router.post('/api/upload-excel', upload.single('file'), async (req, res) => {
    try {
        const user = req.currentUser || req.session?.user;
        const cycleNumber = parseInt(req.body.cycleNumber) || 1;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const pool = await getPool();
        
        // Get storeId from request body first, then fall back to user assignment
        let storeId = req.body.storeId ? parseInt(req.body.storeId) : null;
        
        if (!storeId) {
            // Try to get user's assigned store as fallback
            const storeResult = await pool.request()
                .input('userId', sql.Int, user?.userId || 0)
                .query(`
                    SELECT StoreId FROM StoreManagerAssignments 
                    WHERE UserId = @userId AND IsPrimary = 1
                `);
            storeId = storeResult.recordset[0]?.StoreId;
        }
        
        if (!storeId) {
            return res.status(400).json({ error: 'Please select a store' });
        }
        
        // Verify store exists
        const storeCheck = await pool.request()
            .input('storeId', sql.Int, storeId)
            .query('SELECT Id, StoreName FROM Stores WHERE Id = @storeId AND IsActive = 1');
        
        if (!storeCheck.recordset[0]) {
            return res.status(400).json({ error: 'Invalid store selected' });
        }
        
        // Read Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            return res.status(400).json({ error: 'Excel file has no worksheets' });
        }
        
        // Parse rows (skip header row 1 and notes row 2)
        const entries = [];
        const errors = [];
        
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber <= 2) return; // Skip header and notes rows
            
            const dayValue = row.getCell(1).value;
            const itemNo = row.getCell(2).value;
            
            // Skip empty rows
            if (!dayValue && !itemNo) return;
            
            // Validate day
            const day = parseInt(dayValue);
            if (!day || day < 1 || day > 5) {
                if (itemNo) {
                    errors.push('Row ' + rowNumber + ': Invalid day "' + dayValue + '" (must be 1-5)');
                }
                return;
            }
            
            // Validate item number
            if (!itemNo) {
                errors.push('Row ' + rowNumber + ': Item No is required');
                return;
            }
            
            // Parse dates
            let expiryDate = null;
            let dateFound = null;
            
            const expiryCell = row.getCell(9).value;
            if (expiryCell) {
                if (expiryCell instanceof Date) {
                    expiryDate = expiryCell;
                } else if (typeof expiryCell === 'string') {
                    expiryDate = parseDate(expiryCell);
                } else if (typeof expiryCell === 'number') {
                    // Excel serial date
                    expiryDate = excelSerialToDate(expiryCell);
                }
            }
            
            const dateFoundCell = row.getCell(11).value;
            if (dateFoundCell) {
                if (dateFoundCell instanceof Date) {
                    dateFound = dateFoundCell;
                } else if (typeof dateFoundCell === 'string') {
                    dateFound = parseDate(dateFoundCell);
                } else if (typeof dateFoundCell === 'number') {
                    dateFound = excelSerialToDate(dateFoundCell);
                }
            }
            
            entries.push({
                dayNumber: day,
                itemNo: String(itemNo).trim(),
                itemVariant: row.getCell(3).value ? String(row.getCell(3).value).trim() : null,
                barcode: row.getCell(4).value ? String(row.getCell(4).value).trim() : null,
                family: row.getCell(5).value ? String(row.getCell(5).value).trim() : null,
                description: row.getCell(6).value ? String(row.getCell(6).value).trim() : null,
                size: row.getCell(7).value ? String(row.getCell(7).value).trim() : null,
                qty: row.getCell(8).value ? parseInt(row.getCell(8).value) : null,
                expiryDate: expiryDate,
                dateFound: dateFound || new Date()
            });
        });
        
        if (entries.length === 0) {
            return res.status(400).json({ error: 'No valid entries found in Excel file. ' + (errors.length > 0 ? errors.join('; ') : '') });
        }
        
        // Insert all entries
        let insertedCount = 0;
        for (const entry of entries) {
            try {
                await pool.request()
                    .input('storeId', sql.Int, storeId)
                    .input('createdBy', sql.Int, user.userId)
                    .input('cycleNumber', sql.Int, cycleNumber)
                    .input('dayNumber', sql.Int, entry.dayNumber)
                    .input('itemNo', sql.NVarChar, entry.itemNo)
                    .input('itemVariant', sql.NVarChar, entry.itemVariant)
                    .input('barcode', sql.NVarChar, entry.barcode)
                    .input('family', sql.NVarChar, entry.family)
                    .input('description', sql.NVarChar, entry.description)
                    .input('size', sql.NVarChar, entry.size)
                    .input('qty', sql.Int, entry.qty)
                    .input('expiryDate', sql.Date, entry.expiryDate)
                    .input('dateFound', sql.Date, entry.dateFound)
                    .query(`
                        INSERT INTO FiveDaysEntries 
                        (StoreId, CreatedBy, CycleNumber, DayNumber, ItemNo, ItemVariant, Barcode, Family, Description, Size, Qty, ExpiryDate, DateFound)
                        VALUES 
                        (@storeId, @createdBy, @cycleNumber, @dayNumber, @itemNo, @itemVariant, @barcode, @family, @description, @size, @qty, @expiryDate, @dateFound)
                    `);
                insertedCount++;
            } catch (err) {
                errors.push('Failed to insert item "' + entry.itemNo + '": ' + err.message);
            }
        }
        
        let message = 'Successfully imported ' + insertedCount + ' entries for Cycle ' + cycleNumber;
        if (errors.length > 0) {
            message += '. Warnings: ' + errors.slice(0, 3).join('; ');
            if (errors.length > 3) {
                message += ' and ' + (errors.length - 3) + ' more...';
            }
        }
        
        res.json({ success: true, message, imported: insertedCount, errors: errors.length });
        
    } catch (err) {
        console.error('[5 Days] Error uploading Excel:', err);
        res.status(500).json({ error: err.message });
    }
});

// Helper: Parse date string (DD/MM/YYYY or YYYY-MM-DD)
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Try DD/MM/YYYY format
    const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        return new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
    }
    
    // Try YYYY-MM-DD format
    const yyyymmdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) {
        return new Date(yyyymmdd[1], yyyymmdd[2] - 1, yyyymmdd[3]);
    }
    
    // Try parsing as Date
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
}

// Helper: Convert Excel serial date to JS Date
function excelSerialToDate(serial) {
    // Excel serial dates start from 1900-01-01
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    return new Date(utcValue * 1000);
}

module.exports = router;
