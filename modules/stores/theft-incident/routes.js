/**
 * Theft Incident Report - Routes
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const emailService = require('../../../services/email-service');
const workflowEngine = require('../../../services/workflow-engine');

// Theft Incident notification email recipient (can be updated later)
const THEFT_INCIDENT_NOTIFICATION_EMAIL = 'shammas.sh@gmrl.com'; // TODO: Update with actual recipient

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../../uploads/theft-incidents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'theft-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
    }
});

// Image compression settings
const COMPRESSION_CONFIG = {
    maxWidth: 1920,      // Max width in pixels
    maxHeight: 1080,     // Max height in pixels
    quality: 80,         // JPEG/WebP quality (1-100)
    pngCompressionLevel: 8  // PNG compression (0-9)
};

// Compress and resize image
async function compressImage(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const tempPath = filePath + '.tmp';
        
        let sharpInstance = sharp(filePath)
            .resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        
        // Apply format-specific compression
        if (ext === '.jpg' || ext === '.jpeg') {
            sharpInstance = sharpInstance.jpeg({ quality: COMPRESSION_CONFIG.quality });
        } else if (ext === '.png') {
            sharpInstance = sharpInstance.png({ compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel });
        } else if (ext === '.webp') {
            sharpInstance = sharpInstance.webp({ quality: COMPRESSION_CONFIG.quality });
        } else if (ext === '.gif') {
            // GIF - just resize, limited compression options
            sharpInstance = sharpInstance.gif();
        }
        
        // Save to temp file then replace original
        await sharpInstance.toFile(tempPath);
        
        // Get compressed file size
        const compressedStats = fs.statSync(tempPath);
        
        // Replace original with compressed version
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        
        return compressedStats.size;
    } catch (err) {
        console.error('Image compression error:', err);
        // Return original size if compression fails
        return fs.statSync(filePath).size;
    }
}

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

// Mount settings routes
const settingsRoutes = require('./settings');
router.use('/settings', settingsRoutes);

// Mount reports routes
const reportsRoutes = require('./reports');
router.use('/reports', reportsRoutes);

// Theft Incident Form
router.get('/', async (req, res) => {
    try {
        // Load dynamic options from database
        const pool = await sql.connect(dbConfig);
        const stores = await pool.request().query('SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        const captureMethods = await pool.request().query('SELECT Id, MethodName FROM CaptureMethods WHERE IsActive = 1 ORDER BY MethodName');
        const companies = await pool.request().query('SELECT Id, CompanyName FROM OutsourceSecurityCompanies WHERE IsActive = 1 ORDER BY CompanyName');
        await pool.close();
        
        const storeOptions = stores.recordset.map(s => `<option value="${s.StoreName}">${s.StoreName}</option>`).join('');
        const captureMethodOptions = captureMethods.recordset.map(m => `<option value="${m.MethodName}">${m.MethodName}</option>`).join('');
        const companyOptions = companies.recordset.map(c => `<option value="${c.CompanyName}">${c.CompanyName}</option>`).join('');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Theft Incident Report - ${process.env.APP_NAME}</title>
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                }
                .header {
                    background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%);
                    color: white;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { margin: 0; font-size: 24px; }
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
                    max-width: 900px;
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
                .form-container {
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                }
                .form-title {
                    font-size: 24px;
                    color: #333;
                    margin-bottom: 30px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid #dc3545;
                }
                .form-section {
                    margin-bottom: 30px;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #dc3545;
                    margin-bottom: 15px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .form-row {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    margin-bottom: 15px;
                }
                .form-row.single {
                    grid-template-columns: 1fr;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                }
                .form-group label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #555;
                    margin-bottom: 6px;
                }
                .form-group label.required::after {
                    content: ' *';
                    color: #dc3545;
                }
                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 12px 15px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #0078d4;
                    box-shadow: 0 0 0 3px rgba(0,120,212,0.1);
                }
                .form-group textarea {
                    resize: vertical;
                    min-height: 80px;
                }
                .security-options {
                    display: none;
                    margin-top: 10px;
                }
                .security-options.show {
                    display: block;
                }
                .btn-row {
                    display: flex;
                    gap: 15px;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                }
                .btn {
                    padding: 14px 30px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-primary {
                    background: #dc3545;
                    color: white;
                }
                .btn-primary:hover {
                    background: #a71d2a;
                }
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                .btn-secondary:hover {
                    background: #545b62;
                }
                .alert {
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .alert-success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                .alert-error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
                .photo-preview {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin-top: 15px;
                }
                .photo-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px solid #e9ecef;
                }
                .photo-item img {
                    max-width: 150px;
                    max-height: 150px;
                    border-radius: 6px;
                    object-fit: cover;
                }
                .photo-item .photo-name {
                    font-size: 12px;
                    color: #555;
                    margin-top: 8px;
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .photo-item .photo-size {
                    font-size: 11px;
                    color: #888;
                }
                input[type="file"] {
                    padding: 10px;
                    background: #f8f9fa;
                    border: 2px dashed #ddd;
                    border-radius: 8px;
                    cursor: pointer;
                }
                input[type="file"]:hover {
                    border-color: #0078d4;
                    background: #e8f4fc;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚨 Theft Incident Report</h1>
                <div class="header-nav">
                    <a href="/stores/theft-incident/reports">📊 View Reports</a>
                    <a href="/stores/theft-incident/settings">⚙️ Settings</a>
                    <a href="/stores">← Back to Stores</a>
                    <a href="/dashboard">Dashboard</a>
                </div>
            </div>
            <div class="container">
                <div class="breadcrumb">
                    <a href="/dashboard">Dashboard</a> / <a href="/stores">Stores</a> / <span>Theft Incident Report</span>
                </div>
                
                <div class="form-container">
                    <h2 class="form-title">🚨 Theft Incident Report Form</h2>
                    
                    <form id="theftIncidentForm" action="/stores/theft-incident/submit" method="POST" enctype="multipart/form-data">
                        
                        <!-- Store Information -->
                        <div class="form-section">
                            <div class="section-title">📍 Store Information</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="required" for="store">Store</label>
                                    <select id="store" name="store" required>
                                        <option value="">Select Store...</option>
                                        ${storeOptions}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="required" for="incidentDate">Date</label>
                                    <input type="date" id="incidentDate" name="incidentDate" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="required" for="storeManager">Store Manager</label>
                                    <input type="text" id="storeManager" name="storeManager" value="${req.currentUser.displayName}" required>
                                </div>
                                <div class="form-group">
                                    <label for="staffName">Staff Name (Reporter)</label>
                                    <input type="text" id="staffName" name="staffName" placeholder="Enter staff name">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Stolen Items -->
                        <div class="form-section">
                            <div class="section-title">📦 Stolen Items Details</div>
                            <div class="form-row single">
                                <div class="form-group">
                                    <label class="required" for="stolenItems">Stolen Items</label>
                                    <textarea id="stolenItems" name="stolenItems" placeholder="Describe the stolen items in detail..." required></textarea>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="required" for="stolenValue">Value of Stolen Items</label>
                                    <div style="display: flex; gap: 10px;">
                                        <input type="number" id="stolenValue" name="stolenValue" step="0.01" placeholder="0.00" required style="flex: 1;">
                                        <select id="stolenValueCurrency" name="stolenValueCurrency" style="width: 100px;">
                                            <option value="USD">USD</option>
                                            <option value="LBP">LBP</option>
                                            <option value="EUR">EUR</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="valueCollected">Value Collected</label>
                                    <div style="display: flex; gap: 10px;">
                                        <input type="number" id="valueCollected" name="valueCollected" step="0.01" placeholder="0.00" style="flex: 1;">
                                        <select id="valueCollectedCurrency" name="valueCollectedCurrency" style="width: 100px;">
                                            <option value="USD">USD</option>
                                            <option value="LBP">LBP</option>
                                            <option value="EUR">EUR</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Thief Caught Section -->
                        <div class="form-section">
                            <div class="section-title">🚔 Thief Status</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="required" for="thiefCaught">Thief Caught?</label>
                                    <select id="thiefCaught" name="thiefCaught" required onchange="toggleThiefInfo()">
                                        <option value="">Select...</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="offense">Offense</label>
                                    <select id="offense" name="offense">
                                        <option value="">Select...</option>
                                        <option value="First offense">First offense</option>
                                        <option value="Repeated">Repeated</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Thief Information (shown only when thief is caught) -->
                        <div class="form-section" id="thiefInfoSection" style="display: none;">
                            <div class="section-title">👤 Thief Information</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="thiefName">Thief Name</label>
                                    <input type="text" id="thiefName" name="thiefName" placeholder="First name">
                                </div>
                                <div class="form-group">
                                    <label for="thiefSurname">Surname</label>
                                    <input type="text" id="thiefSurname" name="thiefSurname" placeholder="Last name">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="fatherName">Father's Name</label>
                                    <input type="text" id="fatherName" name="fatherName">
                                </div>
                                <div class="form-group">
                                    <label for="motherName">Mother's Name</label>
                                    <input type="text" id="motherName" name="motherName">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="idCard">ID Card Number</label>
                                    <input type="text" id="idCard" name="idCard" placeholder="National ID">
                                </div>
                                <div class="form-group">
                                    <label for="placeOfBirth">Place of Birth</label>
                                    <input type="text" id="placeOfBirth" name="placeOfBirth">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="dateOfBirth">Date of Birth</label>
                                    <input type="date" id="dateOfBirth" name="dateOfBirth">
                                </div>
                                <div class="form-group">
                                    <label for="maritalStatus">Marital Status</label>
                                    <select id="maritalStatus" name="maritalStatus">
                                        <option value="">Select...</option>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Capture Details -->
                        <div class="form-section">
                            <div class="section-title">🎯 Capture Details</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="required" for="captureMethod">Capture Method</label>
                                    <select id="captureMethod" name="captureMethod" required>
                                        <option value="">Select method...</option>
                                        ${captureMethodOptions}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="required" for="securityType">Security Type</label>
                                    <select id="securityType" name="securityType" required onchange="toggleOutsourceField()">
                                        <option value="">Select...</option>
                                        <option value="In-House">In-House</option>
                                        <option value="Outsource">Outsource</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-row security-options" id="outsourceOptions">
                                <div class="form-group">
                                    <label for="outsourceCompany">Outsource Security Company</label>
                                    <select id="outsourceCompany" name="outsourceCompany">
                                        <option value="">Select company...</option>
                                        ${companyOptions}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- HO Currency -->
                        <div class="form-section">
                            <div class="section-title">💰 Financial Details</div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="amountToHO">Amount to HO</label>
                                    <div style="display: flex; gap: 10px;">
                                        <input type="number" id="amountToHO" name="amountToHO" step="0.01" placeholder="0.00" style="flex: 1;">
                                        <select id="amountToHOCurrency" name="amountToHOCurrency" style="width: 100px;">
                                            <option value="USD">USD</option>
                                            <option value="LBP">LBP</option>
                                            <option value="EUR">EUR</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Photo Upload -->
                        <div class="form-section">
                            <div class="section-title">📷 Evidence Photos <span style="color: #dc3545; font-weight: normal;">(Required)</span></div>
                            <div class="form-row single">
                                <div class="form-group">
                                    <label class="required" for="photos">Upload Photos</label>
                                    <input type="file" id="photos" name="photos" multiple accept="image/*" onchange="previewPhotos(this)" required>
                                    <small style="color: #666; margin-top: 5px; display: block;">
                                        Upload at least 1 photo (max 5). Supported: JPEG, PNG, GIF, WebP. Max 10MB each.
                                    </small>
                                </div>
                            </div>
                            <div id="photoPreview" class="photo-preview"></div>
                        </div>
                        
                        <!-- Submit -->
                        <div class="btn-row">
                            <button type="submit" class="btn btn-primary">Submit Report</button>
                            <button type="reset" class="btn btn-secondary" onclick="clearPreviews()">Clear Form</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <script>
                // Set default date to today
                document.getElementById('incidentDate').valueAsDate = new Date();
                
                // Toggle outsource company field
                function toggleOutsourceField() {
                    const securityType = document.getElementById('securityType').value;
                    const outsourceOptions = document.getElementById('outsourceOptions');
                    if (securityType === 'Outsource') {
                        outsourceOptions.classList.add('show');
                    } else {
                        outsourceOptions.classList.remove('show');
                    }
                }
                
                // Toggle thief information section based on "Thief Caught" selection
                function toggleThiefInfo() {
                    const thiefCaught = document.getElementById('thiefCaught').value;
                    const thiefInfoSection = document.getElementById('thiefInfoSection');
                    if (thiefCaught === 'Yes') {
                        thiefInfoSection.style.display = 'block';
                    } else {
                        thiefInfoSection.style.display = 'none';
                        // Clear thief info fields when not caught
                        document.getElementById('thiefName').value = '';
                        document.getElementById('thiefSurname').value = '';
                        document.getElementById('fatherName').value = '';
                        document.getElementById('motherName').value = '';
                        document.getElementById('idCard').value = '';
                        document.getElementById('placeOfBirth').value = '';
                        document.getElementById('dateOfBirth').value = '';
                        document.getElementById('maritalStatus').value = '';
                    }
                }
                
                // Form validation
                document.getElementById('theftIncidentForm').addEventListener('submit', function(e) {
                    const photos = document.getElementById('photos');
                    if (!photos.files || photos.files.length === 0) {
                        e.preventDefault();
                        alert('Please upload at least one evidence photo.');
                        photos.focus();
                        return false;
                    }
                });
                
                // Photo preview function
                function previewPhotos(input) {
                    const preview = document.getElementById('photoPreview');
                    preview.innerHTML = '';
                    
                    if (input.files && input.files.length > 0) {
                        if (input.files.length > 5) {
                            alert('Maximum 5 photos allowed. Only the first 5 will be uploaded.');
                        }
                        
                        const files = Array.from(input.files).slice(0, 5);
                        files.forEach((file, index) => {
                            const reader = new FileReader();
                            reader.onload = function(e) {
                                const div = document.createElement('div');
                                div.className = 'photo-item';
                                div.innerHTML = \`
                                    <img src="\${e.target.result}" alt="Photo \${index + 1}">
                                    <span class="photo-name">\${file.name}</span>
                                    <span class="photo-size">\${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                \`;
                                preview.appendChild(div);
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                }
                
                // Clear previews on form reset
                function clearPreviews() {
                    document.getElementById('photoPreview').innerHTML = '';
                }
            </script>
        </body>
        </html>
    `);
    } catch (err) {
        console.error('Error loading theft incident form:', err);
        res.status(500).send(`
            <div style="text-align:center;padding:50px;">
                <h2>Error loading form</h2>
                <p>${err.message}</p>
                <a href="/stores">Back to Stores</a>
            </div>
        `);
    }
});

// Submit Theft Incident
router.post('/submit', upload.array('photos', 5), async (req, res) => {
    try {
        // Validate required evidence photos
        if (!req.files || req.files.length === 0) {
            return res.status(400).send(`
                <script>
                    alert('Evidence photos are required. Please upload at least one photo.');
                    window.history.back();
                </script>
            `);
        }
        
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('store', sql.NVarChar, req.body.store)
            .input('incidentDate', sql.Date, req.body.incidentDate)
            .input('storeManager', sql.NVarChar, req.body.storeManager)
            .input('staffName', sql.NVarChar, req.body.staffName)
            .input('stolenItems', sql.NVarChar, req.body.stolenItems)
            .input('stolenValue', sql.Decimal(18, 2), req.body.stolenValue || 0)
            .input('stolenValueCurrency', sql.NVarChar, req.body.stolenValueCurrency || 'USD')
            .input('valueCollected', sql.Decimal(18, 2), req.body.valueCollected || 0)
            .input('valueCollectedCurrency', sql.NVarChar, req.body.valueCollectedCurrency || 'USD')
            .input('thiefCaught', sql.NVarChar, req.body.thiefCaught)
            .input('offense', sql.NVarChar, req.body.offense)
            .input('idCard', sql.NVarChar, req.body.idCard)
            .input('thiefName', sql.NVarChar, req.body.thiefName)
            .input('thiefSurname', sql.NVarChar, req.body.thiefSurname)
            .input('fatherName', sql.NVarChar, req.body.fatherName)
            .input('motherName', sql.NVarChar, req.body.motherName)
            .input('placeOfBirth', sql.NVarChar, req.body.placeOfBirth)
            .input('dateOfBirth', sql.Date, req.body.dateOfBirth || null)
            .input('maritalStatus', sql.NVarChar, req.body.maritalStatus)
            .input('captureMethod', sql.NVarChar, req.body.captureMethod)
            .input('securityType', sql.NVarChar, req.body.securityType)
            .input('outsourceCompany', sql.NVarChar, req.body.outsourceCompany)
            .input('amountToHO', sql.Decimal(18, 2), req.body.amountToHO || 0)
            .input('amountToHOCurrency', sql.NVarChar, req.body.amountToHOCurrency || 'USD')
            .input('createdBy', sql.Int, req.currentUser.userId)
            .query(`
                INSERT INTO TheftIncidents (
                    Store, IncidentDate, StoreManager, StaffName, StolenItems, StolenValue, StolenValueCurrency,
                    ValueCollected, ValueCollectedCurrency, ThiefCaught, Offense, IDCard, ThiefName, ThiefSurname, 
                    FatherName, MotherName, PlaceOfBirth, DateOfBirth, MaritalStatus, CaptureMethod, SecurityType,
                    OutsourceCompany, AmountToHO, AmountToHOCurrency, CreatedBy, CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES (
                    @store, @incidentDate, @storeManager, @staffName, @stolenItems, @stolenValue, @stolenValueCurrency,
                    @valueCollected, @valueCollectedCurrency, @thiefCaught, @offense, @idCard, @thiefName, @thiefSurname, 
                    @fatherName, @motherName, @placeOfBirth, @dateOfBirth, @maritalStatus, @captureMethod, @securityType,
                    @outsourceCompany, @amountToHO, @amountToHOCurrency, @createdBy, GETDATE()
                )
            `);
        
        const incidentId = result.recordset[0].Id;
        
        // Compress and save uploaded photos to database
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Compress the image and get new file size
                const fullPath = path.join(__dirname, '../../../uploads/theft-incidents', file.filename);
                const compressedSize = await compressImage(fullPath);
                
                await pool.request()
                    .input('incidentId', sql.Int, incidentId)
                    .input('fileName', sql.NVarChar, file.filename)
                    .input('originalName', sql.NVarChar, file.originalname)
                    .input('filePath', sql.NVarChar, '/uploads/theft-incidents/' + file.filename)
                    .input('fileSize', sql.Int, compressedSize)
                    .input('mimeType', sql.NVarChar, file.mimetype)
                    .query(`
                        INSERT INTO TheftIncidentPhotos (IncidentId, FileName, OriginalName, FilePath, FileSize, MimeType, UploadedAt)
                        VALUES (@incidentId, @fileName, @originalName, @filePath, @fileSize, @mimeType, GETDATE())
                    `);
            }
        }
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'THEFT_INCIDENT',
            recordId: incidentId,
            recordTable: 'TheftIncidents',
            submitter: { userId: req.currentUser.userId, email: req.currentUser.email || req.currentUser.mail, name: req.currentUser.displayName },
            store: { storeId: null, storeName: req.body.store },
            metaData: { stolenValue: req.body.stolenValue, thiefCaught: req.body.thiefCaught },
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Theft incident error:', err));
        
        // Send automatic email notification
        try {
            // Get the email template
            const templateResult = await pool.request()
                .input('templateKey', sql.NVarChar, 'THEFT_INCIDENT_REPORT')
                .query('SELECT SubjectTemplate, BodyTemplate FROM EmailTemplates WHERE TemplateKey = @templateKey AND IsActive = 1');
            
            if (templateResult.recordset.length > 0) {
                const template = templateResult.recordset[0];
                const baseUrl = process.env.APP_URL || 'https://oeapp-uat.gmrlapps.com';
                
                // Format values with their respective currencies
                const stolenValueCurrency = req.body.stolenValueCurrency || 'USD';
                const valueCollectedCurrency = req.body.valueCollectedCurrency || 'USD';
                const amountToHOCurrency = req.body.amountToHOCurrency || 'USD';
                
                const stolenValue = parseFloat(req.body.stolenValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + stolenValueCurrency;
                const valueCollected = parseFloat(req.body.valueCollected || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + valueCollectedCurrency;
                const amountToHO = parseFloat(req.body.amountToHO || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + amountToHOCurrency;
                const incidentDate = req.body.incidentDate ? new Date(req.body.incidentDate).toLocaleDateString('en-GB') : '';
                const dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth).toLocaleDateString('en-GB') : 'Not Available';
                
                // Build template data
                const templateData = {
                    incidentId: incidentId.toString(),
                    storeName: req.body.store || '',
                    incidentDate: incidentDate,
                    storeManager: req.body.storeManager || '',
                    staffName: req.body.staffName || 'N/A',
                    stolenItems: req.body.stolenItems || '',
                    stolenValue: stolenValue,
                    valueCollected: valueCollected,
                    thiefCaught: req.body.thiefCaught || 'Unknown',
                    offense: req.body.offense || 'N/A',
                    thiefName: req.body.thiefCaught === 'Yes' ? (req.body.thiefName || 'Unknown') : 'N/A (Not Caught)',
                    thiefSurname: req.body.thiefCaught === 'Yes' ? (req.body.thiefSurname || '') : '',
                    idCard: req.body.thiefCaught === 'Yes' ? (req.body.idCard || 'Not Available') : 'N/A',
                    dateOfBirth: req.body.thiefCaught === 'Yes' ? dateOfBirth : 'N/A',
                    placeOfBirth: req.body.thiefCaught === 'Yes' ? (req.body.placeOfBirth || 'Not Available') : 'N/A',
                    fatherName: req.body.thiefCaught === 'Yes' ? (req.body.fatherName || 'Not Available') : 'N/A',
                    motherName: req.body.thiefCaught === 'Yes' ? (req.body.motherName || 'Not Available') : 'N/A',
                    maritalStatus: req.body.thiefCaught === 'Yes' ? (req.body.maritalStatus || 'Unknown') : 'N/A',
                    captureMethod: req.body.captureMethod || '',
                    securityType: req.body.securityType || '',
                    outsourceCompany: req.body.outsourceCompany || 'N/A',
                    amountToHO: amountToHO,
                    reportUrl: `${baseUrl}/stores/theft-incident/reports/${incidentId}`,
                    recipientName: 'Team',
                    submittedAt: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                };
                
                // Replace variables in template
                let subject = template.SubjectTemplate;
                let body = template.BodyTemplate;
                
                for (const [key, value] of Object.entries(templateData)) {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    subject = subject.replace(regex, value);
                    body = body.replace(regex, value);
                }
                
                // Send email
                const emailResult = await emailService.sendEmail({
                    to: THEFT_INCIDENT_NOTIFICATION_EMAIL,
                    subject: subject,
                    body: body,
                    accessToken: req.currentUser?.accessToken
                });
                
                // Log the email with actual result
                const emailStatus = emailResult.success ? 'Sent' : 'Failed';
                const emailError = emailResult.success ? null : (emailResult.error || 'Unknown error');
                
                await pool.request()
                    .input('incidentId', sql.Int, incidentId)
                    .input('toEmail', sql.NVarChar, THEFT_INCIDENT_NOTIFICATION_EMAIL)
                    .input('subject', sql.NVarChar, subject)
                    .input('status', sql.NVarChar, emailStatus)
                    .input('errorMessage', sql.NVarChar, emailError)
                    .input('sentBy', sql.Int, req.currentUser.userId)
                    .query(`
                        INSERT INTO TheftIncidentEmailLog (IncidentId, ToEmail, Subject, Status, ErrorMessage, SentBy, SentAt)
                        VALUES (@incidentId, @toEmail, @subject, @status, @errorMessage, @sentBy, GETDATE())
                    `);
                
                if (emailResult.success) {
                    console.log(`Theft incident email sent for incident #${incidentId} to ${THEFT_INCIDENT_NOTIFICATION_EMAIL}`);
                } else {
                    console.error(`Theft incident email FAILED for incident #${incidentId}: ${emailError}`);
                }
            }
        } catch (emailErr) {
            // Log error but don't fail the submission
            console.error('Error sending theft incident email:', emailErr);
            
            // Log the failed email attempt
            try {
                await pool.request()
                    .input('incidentId', sql.Int, incidentId)
                    .input('toEmail', sql.NVarChar, THEFT_INCIDENT_NOTIFICATION_EMAIL)
                    .input('subject', sql.NVarChar, 'Theft Incident Notification')
                    .input('status', sql.NVarChar, 'Failed')
                    .input('errorMessage', sql.NVarChar, emailErr.message)
                    .input('sentBy', sql.Int, req.currentUser.userId)
                    .query(`
                        INSERT INTO TheftIncidentEmailLog (IncidentId, ToEmail, Subject, Status, ErrorMessage, SentBy, SentAt)
                        VALUES (@incidentId, @toEmail, @subject, @status, @errorMessage, @sentBy, GETDATE())
                    `);
            } catch (logErr) {
                console.error('Error logging failed email:', logErr);
            }
        }
        
        await pool.close();
        
        res.redirect('/stores/theft-incident/success?id=' + incidentId);
        
    } catch (err) {
        console.error('Error submitting theft incident:', err);
        res.status(500).send(`
            <script>
                alert('Error submitting form: ${err.message}');
                window.history.back();
            </script>
        `);
    }
});

// Success page
router.get('/success', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Report Submitted - ${process.env.APP_NAME}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    min-height: 100vh; 
                    background: #f5f5f5;
                    margin: 0;
                }
                .success-card {
                    background: white;
                    padding: 50px;
                    border-radius: 15px;
                    text-align: center;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                }
                .success-icon { font-size: 64px; margin-bottom: 20px; }
                h1 { color: #28a745; margin-bottom: 10px; }
                .ref-number { font-size: 18px; color: #666; margin-bottom: 30px; }
                .btn {
                    padding: 12px 25px;
                    background: #0078d4;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    margin: 0 10px;
                    display: inline-block;
                }
                .btn:hover { background: #005a9e; }
            </style>
        </head>
        <body>
            <div class="success-card">
                <div class="success-icon">✅</div>
                <h1>Report Submitted Successfully!</h1>
                <p class="ref-number">Reference Number: TI-${req.query.id || 'N/A'}</p>
                <a href="/stores/theft-incident" class="btn">Submit Another</a>
                <a href="/stores" class="btn">Back to Stores</a>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
