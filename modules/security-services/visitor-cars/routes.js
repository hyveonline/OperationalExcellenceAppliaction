/**
 * Visitors Cars Plate Numbers Form
 * Track visitor vehicles and plate numbers
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const workflowEngine = require('../../../services/workflow-engine');

// Database config
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

// Visitor Cars Form Page
router.get('/', (req, res) => {
    const user = req.currentUser;
    const today = new Date().toISOString().split('T')[0];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Visitors Cars Plate Numbers - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container { max-width: 1000px; margin: 0 auto; }
                .header {
                    background: rgba(255,255,255,0.95);
                    border-radius: 15px;
                    padding: 25px 30px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .header h1 {
                    color: #333;
                    font-size: 24px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .header-nav a {
                    color: #0d47a1;
                    text-decoration: none;
                    font-weight: 500;
                    margin-left: 20px;
                }
                .header-nav a:hover { text-decoration: underline; }
                .form-card {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    margin-bottom: 25px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                .form-group label {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .form-group label .required { color: #e74c3c; }
                .form-group input,
                .form-group select {
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 15px;
                    transition: all 0.3s;
                }
                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: #0d47a1;
                    box-shadow: 0 0 0 3px rgba(13, 71, 161, 0.1);
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #0d47a1;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .entries-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .entries-table th {
                    background: #f8f9fa;
                    padding: 15px;
                    text-align: left;
                    font-size: 13px;
                    font-weight: 600;
                    color: #555;
                    border-bottom: 2px solid #dee2e6;
                }
                .entries-table td {
                    padding: 12px 10px;
                    border-bottom: 1px solid #eee;
                    vertical-align: middle;
                }
                .entries-table input {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .entries-table input:focus {
                    outline: none;
                    border-color: #0d47a1;
                }
                .btn-add-row {
                    background: #0d47a1;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 25px;
                }
                .btn-add-row:hover { background: #0a3d91; }
                .btn-remove {
                    background: #fee2e2;
                    color: #dc2626;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 18px;
                }
                .btn-remove:hover { background: #fecaca; }
                .btn-submit {
                    background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
                    color: white;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s;
                }
                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(13, 71, 161, 0.4);
                }
                .btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }
                .alert {
                    padding: 15px 20px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    display: none;
                }
                .alert-success {
                    background: #d1fae5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                }
                .alert-error {
                    background: #fee2e2;
                    color: #991b1b;
                    border: 1px solid #fecaca;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚗 Visitors Cars Plate Numbers</h1>
                    <div class="header-nav">
                        <a href="/security/visitor-cars">📋 View History</a>
                        <a href="/security">← Back to Security</a>
                    </div>
                </div>
                
                <div class="form-card">
                    <div id="alertBox" class="alert"></div>
                    
                    <div class="section-title">📍 Record Details</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Location <span class="required">*</span></label>
                            <select id="location" required>
                                <option value="">Select Location</option>
                                <option value="HO Zouk">HO Zouk</option>
                                <option value="HO Dbayeh">HO Dbayeh</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date <span class="required">*</span></label>
                            <input type="date" id="recordDate" value="${today}" required>
                        </div>
                    </div>
                    
                    <div class="section-title">🚗 Visitor Entries</div>
                    
                    <table class="entries-table" id="entriesTable">
                        <thead>
                            <tr>
                                <th style="width: 22%">Visitor Name</th>
                                <th style="width: 22%">Company</th>
                                <th style="width: 18%">Plate Number</th>
                                <th style="width: 22%">Guard Name</th>
                                <th style="width: 16%">Action</th>
                            </tr>
                        </thead>
                        <tbody id="entriesBody">
                            <tr>
                                <td><input type="text" class="entry-name" placeholder="Visitor name"></td>
                                <td><input type="text" class="entry-company" placeholder="Company"></td>
                                <td><input type="text" class="entry-plate" placeholder="Plate number"></td>
                                <td><input type="text" class="entry-guard" placeholder="Guard name"></td>
                                <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <button type="button" class="btn-add-row" onclick="addRow()">
                        + Add Visitor
                    </button>
                    
                    <button type="button" class="btn-submit" id="submitBtn" onclick="submitForm()">
                        Submit Record
                    </button>
                </div>
            </div>
            
            <script>
                function addRow() {
                    const tbody = document.getElementById('entriesBody');
                    const row = document.createElement('tr');
                    row.innerHTML = \`
                        <td><input type="text" class="entry-name" placeholder="Visitor name"></td>
                        <td><input type="text" class="entry-company" placeholder="Company"></td>
                        <td><input type="text" class="entry-plate" placeholder="Plate number"></td>
                        <td><input type="text" class="entry-guard" placeholder="Guard name"></td>
                        <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
                    \`;
                    tbody.appendChild(row);
                }
                
                function removeRow(btn) {
                    const tbody = document.getElementById('entriesBody');
                    if (tbody.rows.length > 1) {
                        btn.closest('tr').remove();
                    } else {
                        showAlert('At least one entry row is required', 'error');
                    }
                }
                
                function showAlert(message, type) {
                    const alertBox = document.getElementById('alertBox');
                    alertBox.textContent = message;
                    alertBox.className = 'alert alert-' + type;
                    alertBox.style.display = 'block';
                    setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
                }
                
                async function submitForm() {
                    const location = document.getElementById('location').value;
                    const recordDate = document.getElementById('recordDate').value;
                    
                    if (!location || !recordDate) {
                        showAlert('Please fill in all required fields', 'error');
                        return;
                    }
                    
                    // Collect entries
                    const entries = [];
                    const rows = document.querySelectorAll('#entriesBody tr');
                    
                    rows.forEach((row, index) => {
                        const name = row.querySelector('.entry-name').value.trim();
                        const company = row.querySelector('.entry-company').value.trim();
                        const plate = row.querySelector('.entry-plate').value.trim();
                        const guard = row.querySelector('.entry-guard').value.trim();
                        
                        if (name && plate) {
                            entries.push({
                                visitorName: name,
                                company: company || '',
                                plateNumber: plate,
                                guardName: guard || '',
                                order: index + 1
                            });
                        }
                    });
                    
                    if (entries.length === 0) {
                        showAlert('Please add at least one visitor with name and plate number', 'error');
                        return;
                    }
                    
                    const submitBtn = document.getElementById('submitBtn');
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Submitting...';
                    
                    try {
                        const response = await fetch('/security-services/visitor-cars/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                location,
                                recordDate,
                                entries
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            showAlert('Record submitted successfully!', 'success');
                            setTimeout(() => {
                                window.location.href = '/security-services/visitor-cars/' + result.recordId;
                            }, 1500);
                        } else {
                            showAlert(result.message || 'Error submitting record', 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Submit Record';
                        }
                    } catch (err) {
                        showAlert('Error: ' + err.message, 'error');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit Record';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Save Visitor Cars Record
router.post('/save', async (req, res) => {
    const user = req.currentUser;
    const { location, recordDate, entries } = req.body;
    
    if (!location || !recordDate || !entries || entries.length === 0) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Insert record header
        const recordResult = await pool.request()
            .input('recordDate', sql.Date, recordDate)
            .input('location', sql.NVarChar, location)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.NVarChar, user.id)
            .query(`
                INSERT INTO Security_VisitorCars (RecordDate, Location, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@recordDate, @location, @createdBy, @createdById)
            `);
        
        const recordId = recordResult.recordset[0].Id;
        
        // Insert entries
        for (const entry of entries) {
            await pool.request()
                .input('recordId', sql.Int, recordId)
                .input('visitorName', sql.NVarChar, entry.visitorName)
                .input('company', sql.NVarChar, entry.company || '')
                .input('plateNumber', sql.NVarChar, entry.plateNumber)
                .input('guardName', sql.NVarChar, entry.guardName || '')
                .input('order', sql.Int, entry.order)
                .query(`
                    INSERT INTO Security_VisitorCarEntries (VisitorCarId, VisitorName, Company, PlateNumber, GuardName, EntryOrder)
                    VALUES (@recordId, @visitorName, @company, @plateNumber, @guardName, @order)
                `);
        }
        
        await pool.close();
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'VISITOR_CARS',
            recordId: recordId,
            recordTable: 'Security_VisitorCars',
            submitter: { userId: user.id, email: user.email, name: user.displayName },
            store: {},
            metaData: { recordDate, location },
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Visitor cars error:', err));
        
        res.json({ success: true, recordId });
    } catch (err) {
        console.error('Error saving visitor cars record:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// View Visitor Cars Record
router.get('/:id', async (req, res) => {
    const user = req.currentUser;
    const recordId = req.params.id;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const recordResult = await pool.request()
            .input('id', sql.Int, recordId)
            .query(`SELECT * FROM Security_VisitorCars WHERE Id = @id`);
        
        if (recordResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Record not found');
        }
        
        const record = recordResult.recordset[0];
        
        const entriesResult = await pool.request()
            .input('recordId', sql.Int, recordId)
            .query(`SELECT * FROM Security_VisitorCarEntries WHERE VisitorCarId = @recordId ORDER BY EntryOrder`);
        
        await pool.close();
        
        const entries = entriesResult.recordset;
        const recordDate = new Date(record.RecordDate).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        let entriesHtml = entries.map((entry, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${entry.VisitorName}</td>
                <td>${entry.Company || '-'}</td>
                <td><span class="plate-badge">${entry.PlateNumber}</span></td>
                <td>${entry.GuardName || '-'}</td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Visitor Cars Record - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 1000px; margin: 0 auto; }
                    .header {
                        background: rgba(255,255,255,0.95);
                        border-radius: 15px;
                        padding: 25px 30px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .header h1 {
                        color: #333;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .header-nav a {
                        color: #0d47a1;
                        text-decoration: none;
                        font-weight: 500;
                        margin-left: 20px;
                    }
                    .view-card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    .info-item label {
                        display: block;
                        font-size: 12px;
                        color: #888;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    .info-item span {
                        font-size: 16px;
                        font-weight: 600;
                        color: #333;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #555;
                        border-bottom: 2px solid #dee2e6;
                    }
                    td {
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                        font-size: 14px;
                    }
                    .plate-badge {
                        background: #e3f2fd;
                        color: #0d47a1;
                        padding: 5px 12px;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 600;
                        font-family: monospace;
                    }
                    .footer-info {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 13px;
                        color: #888;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Visitor Cars Record #${record.Id}</h1>
                        <div class="header-nav">
                            <a href="/security-services/visitor-cars/${record.Id}/edit" style="background: #f59e0b; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none;">✏️ Edit</a>
                            <a href="/security-services/visitor-cars">+ New Record</a>
                            <a href="/security/visitor-cars">← Back to History</a>
                        </div>
                    </div>
                    
                    <div class="view-card">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Location</label>
                                <span>${record.Location}</span>
                            </div>
                            <div class="info-item">
                                <label>Date</label>
                                <span>${recordDate}</span>
                            </div>
                            <div class="info-item">
                                <label>Created By</label>
                                <span>${record.CreatedBy}</span>
                            </div>
                        </div>
                        
                        <div class="section-title">🚗 Visitor Entries</div>
                        
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Visitor Name</th>
                                    <th>Company</th>
                                    <th>Plate Number</th>
                                    <th>Guard Name</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${entriesHtml}
                            </tbody>
                        </table>
                        
                        <div class="footer-info">
                            Record created on ${new Date(record.CreatedAt).toLocaleString('en-GB')}
                            ${record.UpdatedBy ? `<br>Last updated by ${record.UpdatedBy} on ${new Date(record.UpdatedAt).toLocaleString('en-GB')}` : ''}
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading visitor cars record:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Edit Visitor Cars Record
router.get('/:id/edit', async (req, res) => {
    const user = req.currentUser;
    const recordId = req.params.id;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        const recordResult = await pool.request()
            .input('id', sql.Int, recordId)
            .query(`SELECT * FROM Security_VisitorCars WHERE Id = @id`);
        
        if (recordResult.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Record not found');
        }
        
        const record = recordResult.recordset[0];
        const recordDate = new Date(record.RecordDate).toISOString().split('T')[0];
        
        const entriesResult = await pool.request()
            .input('recordId', sql.Int, recordId)
            .query(`SELECT * FROM Security_VisitorCarEntries WHERE VisitorCarId = @recordId ORDER BY EntryOrder`);
        
        await pool.close();
        
        const entries = entriesResult.recordset;
        
        let entriesHtml = entries.map((entry, idx) => `
            <tr>
                <td><input type="hidden" class="entry-id" value="${entry.Id}"><input type="text" class="entry-name" value="${entry.VisitorName || ''}" placeholder="Visitor name"></td>
                <td><input type="text" class="entry-company" value="${entry.Company || ''}" placeholder="Company"></td>
                <td><input type="text" class="entry-plate" value="${entry.PlateNumber || ''}" placeholder="Plate number"></td>
                <td><input type="text" class="entry-guard" value="${entry.GuardName || ''}" placeholder="Guard name"></td>
                <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Edit Visitor Cars Record - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 1000px; margin: 0 auto; }
                    .header {
                        background: rgba(255,255,255,0.95);
                        border-radius: 15px;
                        padding: 25px 30px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .header h1 {
                        color: #333;
                        font-size: 24px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .header-nav a {
                        color: #0d47a1;
                        text-decoration: none;
                        font-weight: 500;
                        margin-left: 20px;
                    }
                    .header-nav a:hover { text-decoration: underline; }
                    .form-card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    }
                    .form-row {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .form-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .form-group label {
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 8px;
                        font-size: 14px;
                    }
                    .form-group label .required { color: #e74c3c; }
                    .form-group input,
                    .form-group select {
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 15px;
                        transition: all 0.3s;
                    }
                    .form-group input:focus,
                    .form-group select:focus {
                        outline: none;
                        border-color: #0d47a1;
                        box-shadow: 0 0 0 3px rgba(13, 71, 161, 0.1);
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #f59e0b;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .entries-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .entries-table th {
                        background: #f8f9fa;
                        padding: 15px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: 600;
                        color: #555;
                        border-bottom: 2px solid #dee2e6;
                    }
                    .entries-table td {
                        padding: 12px 10px;
                        border-bottom: 1px solid #eee;
                        vertical-align: middle;
                    }
                    .entries-table input {
                        width: 100%;
                        padding: 10px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        font-size: 14px;
                    }
                    .entries-table input:focus {
                        outline: none;
                        border-color: #0d47a1;
                    }
                    .btn-add-row {
                        background: #0d47a1;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 25px;
                    }
                    .btn-add-row:hover { background: #0a3d91; }
                    .btn-remove {
                        background: #fee2e2;
                        color: #dc2626;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 18px;
                    }
                    .btn-remove:hover { background: #fecaca; }
                    .btn-submit {
                        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                        color: white;
                        border: none;
                        padding: 15px 40px;
                        border-radius: 10px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                        transition: all 0.3s;
                    }
                    .btn-submit:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(245, 158, 11, 0.4);
                    }
                    .btn-submit:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none;
                    }
                    .alert {
                        padding: 15px 20px;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        display: none;
                    }
                    .alert-success {
                        background: #d1fae5;
                        color: #065f46;
                        border: 1px solid #a7f3d0;
                    }
                    .alert-error {
                        background: #fee2e2;
                        color: #991b1b;
                        border: 1px solid #fecaca;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✏️ Edit Visitor Cars Record #${record.Id}</h1>
                        <div class="header-nav">
                            <a href="/security-services/visitor-cars/${record.Id}">← Cancel</a>
                        </div>
                    </div>
                    
                    <div class="form-card">
                        <div id="alertBox" class="alert"></div>
                        
                        <div class="section-title">📍 Record Details</div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Location <span class="required">*</span></label>
                                <select id="location" required>
                                    <option value="">Select Location</option>
                                    <option value="HO Zouk" ${record.Location === 'HO Zouk' ? 'selected' : ''}>HO Zouk</option>
                                    <option value="HO Dbayeh" ${record.Location === 'HO Dbayeh' ? 'selected' : ''}>HO Dbayeh</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Date <span class="required">*</span></label>
                                <input type="date" id="recordDate" value="${recordDate}" required>
                            </div>
                        </div>
                        
                        <div class="section-title">🚗 Visitor Entries</div>
                        
                        <table class="entries-table" id="entriesTable">
                            <thead>
                                <tr>
                                    <th style="width: 22%">Visitor Name</th>
                                    <th style="width: 22%">Company</th>
                                    <th style="width: 18%">Plate Number</th>
                                    <th style="width: 22%">Guard Name</th>
                                    <th style="width: 16%">Action</th>
                                </tr>
                            </thead>
                            <tbody id="entriesBody">
                                ${entriesHtml}
                            </tbody>
                        </table>
                        
                        <button type="button" class="btn-add-row" onclick="addRow()">
                            + Add Visitor
                        </button>
                        
                        <button type="button" class="btn-submit" id="submitBtn" onclick="updateForm()">
                            💾 Update Record
                        </button>
                    </div>
                </div>
                
                <script>
                    function addRow() {
                        const tbody = document.getElementById('entriesBody');
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td><input type="hidden" class="entry-id" value="0"><input type="text" class="entry-name" placeholder="Visitor name"></td>
                            <td><input type="text" class="entry-company" placeholder="Company"></td>
                            <td><input type="text" class="entry-plate" placeholder="Plate number"></td>
                            <td><input type="text" class="entry-guard" placeholder="Guard name"></td>
                            <td><button type="button" class="btn-remove" onclick="removeRow(this)">×</button></td>
                        \`;
                        tbody.appendChild(row);
                    }
                    
                    function removeRow(btn) {
                        const tbody = document.getElementById('entriesBody');
                        if (tbody.rows.length > 1) {
                            btn.closest('tr').remove();
                        } else {
                            showAlert('At least one entry row is required', 'error');
                        }
                    }
                    
                    function showAlert(message, type) {
                        const alertBox = document.getElementById('alertBox');
                        alertBox.textContent = message;
                        alertBox.className = 'alert alert-' + type;
                        alertBox.style.display = 'block';
                        setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
                    }
                    
                    async function updateForm() {
                        const location = document.getElementById('location').value;
                        const recordDate = document.getElementById('recordDate').value;
                        
                        if (!location || !recordDate) {
                            showAlert('Please fill in all required fields', 'error');
                            return;
                        }
                        
                        // Collect entries
                        const entries = [];
                        const rows = document.querySelectorAll('#entriesBody tr');
                        
                        rows.forEach((row, index) => {
                            const id = row.querySelector('.entry-id') ? row.querySelector('.entry-id').value : '0';
                            const name = row.querySelector('.entry-name').value.trim();
                            const company = row.querySelector('.entry-company').value.trim();
                            const plate = row.querySelector('.entry-plate').value.trim();
                            const guard = row.querySelector('.entry-guard').value.trim();
                            
                            if (name && plate) {
                                entries.push({
                                    id: parseInt(id) || 0,
                                    visitorName: name,
                                    company: company || '',
                                    plateNumber: plate,
                                    guardName: guard || '',
                                    order: index + 1
                                });
                            }
                        });
                        
                        if (entries.length === 0) {
                            showAlert('Please add at least one visitor with name and plate number', 'error');
                            return;
                        }
                        
                        const submitBtn = document.getElementById('submitBtn');
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Updating...';
                        
                        try {
                            const response = await fetch('/security-services/visitor-cars/update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    recordId: ${record.Id},
                                    location,
                                    recordDate,
                                    entries
                                })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                showAlert('Record updated successfully!', 'success');
                                setTimeout(() => {
                                    window.location.href = '/security-services/visitor-cars/${record.Id}';
                                }, 1500);
                            } else {
                                showAlert(result.message || 'Error updating record', 'error');
                                submitBtn.disabled = false;
                                submitBtn.textContent = '💾 Update Record';
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message, 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = '💾 Update Record';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading visitor cars record for edit:', err);
        res.status(500).send('Error: ' + err.message);
    }
});

// Update Visitor Cars Record
router.post('/update', async (req, res) => {
    const user = req.currentUser;
    const { recordId, location, recordDate, entries } = req.body;
    
    if (!recordId || !location || !recordDate || !entries || entries.length === 0) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Update record header
        await pool.request()
            .input('id', sql.Int, recordId)
            .input('recordDate', sql.Date, recordDate)
            .input('location', sql.NVarChar, location)
            .input('updatedBy', sql.NVarChar, user.displayName)
            .input('updatedAt', sql.DateTime, new Date())
            .query(`
                UPDATE Security_VisitorCars 
                SET RecordDate = @recordDate, Location = @location, UpdatedBy = @updatedBy, UpdatedAt = @updatedAt
                WHERE Id = @id
            `);
        
        // Delete old entries and insert new ones
        await pool.request()
            .input('recordId', sql.Int, recordId)
            .query(`DELETE FROM Security_VisitorCarEntries WHERE VisitorCarId = @recordId`);
        
        // Insert entries
        for (const entry of entries) {
            await pool.request()
                .input('recordId', sql.Int, recordId)
                .input('visitorName', sql.NVarChar, entry.visitorName)
                .input('company', sql.NVarChar, entry.company || '')
                .input('plateNumber', sql.NVarChar, entry.plateNumber)
                .input('guardName', sql.NVarChar, entry.guardName || '')
                .input('order', sql.Int, entry.order)
                .query(`
                    INSERT INTO Security_VisitorCarEntries (VisitorCarId, VisitorName, Company, PlateNumber, GuardName, EntryOrder)
                    VALUES (@recordId, @visitorName, @company, @plateNumber, @guardName, @order)
                `);
        }
        
        await pool.close();
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating visitor cars record:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;
