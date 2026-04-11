/**
 * Parking Violation Form
 * Track parking violations with photo upload
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const workflowEngine = require('../../../services/workflow-engine');

// Image compression settings
const COMPRESSION_CONFIG = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    pngCompressionLevel: 8
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
        
        if (ext === '.jpg' || ext === '.jpeg') {
            sharpInstance = sharpInstance.jpeg({ quality: COMPRESSION_CONFIG.quality });
        } else if (ext === '.png') {
            sharpInstance = sharpInstance.png({ compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel });
        } else if (ext === '.webp') {
            sharpInstance = sharpInstance.webp({ quality: COMPRESSION_CONFIG.quality });
        } else if (ext === '.gif') {
            sharpInstance = sharpInstance.gif();
        }
        
        await sharpInstance.toFile(tempPath);
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        
        console.log(`[Parking Violation] Compressed image: ${path.basename(filePath)}`);
        return true;
    } catch (err) {
        console.error('Image compression error:', err);
        return false;
    }
}

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

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../../uploads/parking-violations');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'parking-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Multiple file upload middleware (up to 10 images)
const uploadMultiple = upload.array('images', 10);

// Parking Violation Form Page
router.get('/', (req, res) => {
    const user = req.currentUser;
    const today = new Date().toISOString().split('T')[0];
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Parking Violation - ${process.env.APP_NAME}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container { max-width: 800px; margin: 0 auto; }
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
                    color: #c62828;
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
                .form-group.full-width {
                    grid-column: 1 / -1;
                }
                .form-group label {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .form-group label .required { color: #e74c3c; }
                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 12px 15px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 15px;
                    transition: all 0.3s;
                }
                .form-group textarea {
                    min-height: 100px;
                    resize: vertical;
                }
                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #c62828;
                    box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.1);
                }
                .section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #c62828;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .upload-area {
                    border: 2px dashed #ddd;
                    border-radius: 10px;
                    padding: 40px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                    background: #fafafa;
                }
                .upload-area:hover {
                    border-color: #c62828;
                    background: #fff5f5;
                }
                .upload-area.has-file {
                    border-color: #4caf50;
                    background: #e8f5e9;
                }
                .upload-area input[type="file"] {
                    display: none;
                }
                .upload-icon {
                    font-size: 50px;
                    margin-bottom: 15px;
                }
                .upload-text {
                    color: #666;
                    font-size: 14px;
                }
                .upload-text strong {
                    color: #c62828;
                }
                .preview-container {
                    margin-top: 15px;
                    display: none;
                }
                .preview-container img {
                    max-width: 100%;
                    max-height: 300px;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .preview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }
                .preview-item {
                    position: relative;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .preview-item img {
                    width: 100%;
                    height: 150px;
                    object-fit: cover;
                }
                .preview-item .remove-btn {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: rgba(198, 40, 40, 0.9);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .preview-item .remove-btn:hover {
                    background: #b71c1c;
                }
                .btn-submit {
                    background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                    color: white;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.3s;
                    margin-top: 20px;
                }
                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(198, 40, 40, 0.4);
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
                    <h1>🅿️ Parking Violation</h1>
                    <div class="header-nav">
                        <a href="/security-services/parking-violation/history">📜 My History</a>
                        <a href="/security-services">← Back to Security Services</a>
                    </div>
                </div>
                
                <div class="form-card">
                    <div id="alertBox" class="alert"></div>
                    
                    <form id="violationForm" enctype="multipart/form-data">
                        <div class="section-title">📋 Violation Details</div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date <span class="required">*</span></label>
                                <input type="date" id="violationDate" name="violationDate" value="${today}" required>
                            </div>
                            <div class="form-group">
                                <label>Location <span class="required">*</span></label>
                                <select id="location" name="location" required>
                                    <option value="">Select Location</option>
                                    <option value="HO Zouk">HO Zouk</option>
                                    <option value="HO Dbayeh">HO Dbayeh</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Name of Violator <span class="required">*</span></label>
                                <input type="text" id="violatorName" name="violatorName" placeholder="Enter violator's name" required>
                            </div>
                            <div class="form-group">
                                <label>Car Plate Number <span class="required">*</span></label>
                                <input type="text" id="carPlateNumber" name="carPlateNumber" placeholder="Enter car plate number" required style="text-transform: uppercase;">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group full-width">
                                <label>Parking Lot Information</label>
                                <textarea id="parkingLotInfo" name="parkingLotInfo" placeholder="Enter details about the parking violation..."></textarea>
                            </div>
                        </div>
                        
                        <div class="section-title">📷 Photo Evidence</div>
                        
                        <div class="upload-area" id="uploadArea" onclick="document.getElementById('imageFiles').click()">
                            <input type="file" id="imageFiles" name="images" accept="image/*" multiple>
                            <div class="upload-icon">📷</div>
                            <div class="upload-text">
                                <strong>Click to upload</strong> or drag and drop<br>
                                JPG, PNG, GIF up to 10MB each (max 10 images)
                            </div>
                        </div>
                        <div class="preview-grid" id="previewGrid"></div>
                        
                        <button type="submit" class="btn-submit" id="submitBtn">
                            Submit Violation Report
                        </button>
                    </form>
                </div>
            </div>
            
            <script>
                const imageInput = document.getElementById('imageFiles');
                const uploadArea = document.getElementById('uploadArea');
                const previewGrid = document.getElementById('previewGrid');
                let selectedFiles = [];
                
                function updatePreviews() {
                    previewGrid.innerHTML = '';
                    selectedFiles.forEach((file, index) => {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const div = document.createElement('div');
                            div.className = 'preview-item';
                            div.innerHTML = \`
                                <img src="\${e.target.result}" alt="Preview">
                                <button type="button" class="remove-btn" onclick="removeImage(\${index})">×</button>
                            \`;
                            previewGrid.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    });
                    
                    if (selectedFiles.length > 0) {
                        uploadArea.classList.add('has-file');
                        uploadArea.querySelector('.upload-text').innerHTML = '<strong>' + selectedFiles.length + ' image(s) selected</strong><br>Click to add more';
                    } else {
                        uploadArea.classList.remove('has-file');
                        uploadArea.querySelector('.upload-text').innerHTML = '<strong>Click to upload</strong> or drag and drop<br>JPG, PNG, GIF up to 10MB each (max 10 images)';
                    }
                }
                
                function removeImage(index) {
                    selectedFiles.splice(index, 1);
                    updatePreviews();
                    updateFileInput();
                }
                
                function updateFileInput() {
                    const dt = new DataTransfer();
                    selectedFiles.forEach(file => dt.items.add(file));
                    imageInput.files = dt.files;
                }
                
                imageInput.addEventListener('change', function(e) {
                    const newFiles = Array.from(e.target.files);
                    const totalFiles = selectedFiles.length + newFiles.length;
                    
                    if (totalFiles > 10) {
                        showAlert('Maximum 10 images allowed', 'error');
                        return;
                    }
                    
                    selectedFiles = [...selectedFiles, ...newFiles];
                    updatePreviews();
                    updateFileInput();
                });
                
                // Drag and drop
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.style.borderColor = '#c62828';
                });
                
                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.style.borderColor = '#ddd';
                });
                
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.style.borderColor = '#ddd';
                    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                    const totalFiles = selectedFiles.length + droppedFiles.length;
                    
                    if (totalFiles > 10) {
                        showAlert('Maximum 10 images allowed', 'error');
                        return;
                    }
                    
                    selectedFiles = [...selectedFiles, ...droppedFiles];
                    updatePreviews();
                    updateFileInput();
                });
                
                function showAlert(message, type) {
                    const alertBox = document.getElementById('alertBox');
                    alertBox.textContent = message;
                    alertBox.className = 'alert alert-' + type;
                    alertBox.style.display = 'block';
                    setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
                }
                
                document.getElementById('violationForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const violationDate = document.getElementById('violationDate').value;
                    const location = document.getElementById('location').value;
                    
                    if (!violationDate || !location) {
                        showAlert('Please fill in all required fields', 'error');
                        return;
                    }
                    
                    const submitBtn = document.getElementById('submitBtn');
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Submitting...';
                    
                    try {
                        const formData = new FormData(this);
                        
                        const response = await fetch('/security-services/parking-violation/save', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            showAlert('Violation report submitted successfully!', 'success');
                            setTimeout(() => {
                                window.location.href = '/security-services/parking-violation/' + result.violationId;
                            }, 1500);
                        } else {
                            showAlert(result.message || 'Error submitting report', 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Submit Violation Report';
                        }
                    } catch (err) {
                        showAlert('Error: ' + err.message, 'error');
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit Violation Report';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Save Parking Violation
router.post('/save', uploadMultiple, async (req, res) => {
    const user = req.currentUser;
    const { violationDate, location, violatorName, carPlateNumber, parkingLotInfo } = req.body;
    
    if (!violationDate || !location || !violatorName || !carPlateNumber) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Insert violation record (ImagePath kept for backward compatibility - stores first image)
        const firstImagePath = req.files && req.files.length > 0 ? '/uploads/parking-violations/' + req.files[0].filename : null;
        
        const result = await pool.request()
            .input('violationDate', sql.Date, violationDate)
            .input('location', sql.NVarChar, location)
            .input('violatorName', sql.NVarChar, violatorName)
            .input('carPlateNumber', sql.NVarChar, carPlateNumber.toUpperCase())
            .input('parkingLotInfo', sql.NVarChar, parkingLotInfo || '')
            .input('imagePath', sql.NVarChar, firstImagePath)
            .input('createdBy', sql.NVarChar, user.displayName)
            .input('createdById', sql.NVarChar, user.id)
            .query(`
                INSERT INTO Security_ParkingViolations (ViolationDate, Location, ViolatorName, CarPlateNumber, ParkingLotInfo, ImagePath, CreatedBy, CreatedById)
                OUTPUT INSERTED.Id
                VALUES (@violationDate, @location, @violatorName, @carPlateNumber, @parkingLotInfo, @imagePath, @createdBy, @createdById)
            `);
        
        const violationId = result.recordset[0].Id;
        
        // Compress and insert all images into the images table
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Compress the uploaded image
                const fullPath = path.join(__dirname, '../../../uploads/parking-violations', file.filename);
                await compressImage(fullPath);
                
                const imagePath = '/uploads/parking-violations/' + file.filename;
                await pool.request()
                    .input('violationId', sql.Int, violationId)
                    .input('imagePath', sql.NVarChar, imagePath)
                    .query(`
                        INSERT INTO Security_ParkingViolation_Images (ViolationId, ImagePath)
                        VALUES (@violationId, @imagePath)
                    `);
            }
        }
        
        await pool.close();
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'PARKING_VIOLATION',
            recordId: violationId,
            recordTable: 'Security_ParkingViolations',
            submitter: { userId: user.id, email: user.email, name: user.displayName },
            store: {},
            metaData: { violationDate, location, violatorName, carPlateNumber, parkingLotInfo },
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Parking violation error:', err));
        
        res.json({ success: true, violationId });
    } catch (err) {
        console.error('Error saving parking violation:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

// Parking Violation History
router.get('/history', async (req, res) => {
    const user = req.currentUser;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Get all parking violations, ordered by most recent
        const result = await pool.request()
            .query(`SELECT v.*, 
                    (SELECT COUNT(*) FROM Security_ParkingViolation_Images WHERE ViolationId = v.Id) as ImageCount
                    FROM Security_ParkingViolations v
                    ORDER BY v.ViolationDate DESC, v.CreatedAt DESC`);
        
        await pool.close();
        
        const tableRows = result.recordset.map(v => {
            const violationDate = new Date(v.ViolationDate).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const createdDate = new Date(v.CreatedAt).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const imageCount = v.ImageCount || (v.ImagePath ? 1 : 0);
            
            return `
                <tr onclick="window.location='/security-services/parking-violation/${v.Id}'" style="cursor: pointer;">
                    <td><strong style="color: #c62828;">PV-${v.Id}</strong></td>
                    <td>${violationDate}</td>
                    <td>${v.Location}</td>
                    <td>${v.ViolatorName || '<span style="color: #999;">Unknown</span>'}</td>
                    <td><code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${v.CarPlateNumber || '-'}</code></td>
                    <td>${imageCount > 0 ? '📷 ' + imageCount : '<span style="color: #999;">-</span>'}</td>
                    <td>${v.CreatedBy}</td>
                    <td>
                        <a href="/security-services/parking-violation/${v.Id}" class="btn-view">View</a>
                    </td>
                </tr>
            `;
        }).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Parking Violations History - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { 
                        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%); 
                        color: white; 
                        padding: 20px 30px; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        flex-wrap: wrap; 
                        gap: 10px; 
                    }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; flex-wrap: wrap; }
                    .header-nav a { 
                        color: white; 
                        text-decoration: none; 
                        padding: 8px 16px; 
                        border-radius: 5px; 
                        background: rgba(255,255,255,0.15); 
                        transition: background 0.3s;
                    }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    .container { max-width: 1400px; margin: 30px auto; padding: 0 20px; }
                    .stats-bar {
                        display: flex;
                        gap: 20px;
                        margin-bottom: 25px;
                        flex-wrap: wrap;
                    }
                    .stat-card {
                        background: white;
                        padding: 20px 25px;
                        border-radius: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.06);
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    .stat-icon { font-size: 32px; }
                    .stat-value { font-size: 28px; font-weight: 700; color: #c62828; }
                    .stat-label { font-size: 13px; color: #666; }
                    .table-container { 
                        background: white; 
                        border-radius: 12px; 
                        overflow: hidden; 
                        box-shadow: 0 2px 15px rgba(0,0,0,0.08); 
                        overflow-x: auto;
                    }
                    table { width: 100%; border-collapse: collapse; min-width: 900px; }
                    th { 
                        background: #f8f9fa; 
                        padding: 15px; 
                        text-align: left; 
                        font-size: 12px; 
                        text-transform: uppercase; 
                        color: #666; 
                        border-bottom: 2px solid #dee2e6; 
                    }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                    tr:hover { background: #fef5f5; }
                    .btn-view {
                        color: #c62828;
                        text-decoration: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        border: 1px solid #c62828;
                        font-size: 13px;
                        transition: all 0.2s;
                    }
                    .btn-view:hover {
                        background: #c62828;
                        color: white;
                    }
                    .empty-state { 
                        text-align: center; 
                        padding: 60px 20px; 
                        color: #666; 
                    }
                    .empty-state .icon { font-size: 64px; margin-bottom: 20px; }
                    .empty-state h3 { margin-bottom: 10px; color: #333; }
                    .empty-state a {
                        display: inline-block;
                        margin-top: 20px;
                        background: #c62828;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 8px;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🅿️ Parking Violations History</h1>
                    <div class="header-nav">
                        <a href="/security-services/parking-violation">➕ Report New Violation</a>
                        <a href="/security-services">← Back to Security Services</a>
                    </div>
                </div>
                <div class="container">
                    <div class="stats-bar">
                        <div class="stat-card">
                            <div class="stat-icon">📋</div>
                            <div>
                                <div class="stat-value">${result.recordset.length}</div>
                                <div class="stat-label">Total Violations</div>
                            </div>
                        </div>
                    </div>
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Location</th>
                                        <th>Violator Name</th>
                                        <th>Car Plate</th>
                                        <th>Photos</th>
                                        <th>Reported By</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">🅿️</div>
                                <h3>No parking violations recorded yet</h3>
                                <p>Report a parking violation to get started.</p>
                                <a href="/security-services/parking-violation">➕ Report New Violation</a>
                            </div>
                        `}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading parking violation history:', err);
        if (pool) await pool.close();
        res.status(500).send('Error loading history: ' + err.message);
    }
});

// View Parking Violation
router.get('/:id', async (req, res) => {
    const user = req.currentUser;
    const violationId = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, violationId)
            .query(`SELECT * FROM Security_ParkingViolations WHERE Id = @id`);
        
        if (result.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Violation not found');
        }
        
        // Get all images for this violation
        const imagesResult = await pool.request()
            .input('violationId', sql.Int, violationId)
            .query(`SELECT ImagePath FROM Security_ParkingViolation_Images WHERE ViolationId = @violationId ORDER BY Id`);
        
        await pool.close();
        
        const violation = result.recordset[0];
        const images = imagesResult.recordset;
        
        // If no images in new table, fall back to legacy ImagePath
        if (images.length === 0 && violation.ImagePath) {
            images.push({ ImagePath: violation.ImagePath });
        }
        
        const violationDate = new Date(violation.ViolationDate).toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        
        // Build images HTML
        let imagesHtml = '';
        if (images.length > 0) {
            imagesHtml = '<div class="image-gallery">' + 
                images.map(img => `<div class="gallery-item"><img src="${img.ImagePath}" alt="Parking Violation Photo" onclick="openLightbox('${img.ImagePath}')"></div>`).join('') +
                '</div>';
        } else {
            imagesHtml = `
                <div class="no-image">
                    <div style="font-size: 40px; margin-bottom: 10px;">📷</div>
                    No photos uploaded
                </div>
            `;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>View Parking Violation - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 900px; margin: 0 auto; }
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
                        color: #c62828;
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
                    .info-text {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin-bottom: 30px;
                        line-height: 1.6;
                    }
                    .image-gallery {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 15px;
                    }
                    .gallery-item {
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        cursor: pointer;
                        transition: transform 0.3s;
                    }
                    .gallery-item:hover {
                        transform: scale(1.02);
                    }
                    .gallery-item img {
                        width: 100%;
                        height: 200px;
                        object-fit: cover;
                    }
                    .no-image {
                        background: #f8f9fa;
                        padding: 60px;
                        border-radius: 10px;
                        text-align: center;
                        color: #888;
                    }
                    .footer-info {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 13px;
                        color: #888;
                    }
                    /* Lightbox */
                    .lightbox {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.9);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                    }
                    .lightbox.active {
                        display: flex;
                    }
                    .lightbox img {
                        max-width: 90%;
                        max-height: 90%;
                        border-radius: 10px;
                    }
                    .lightbox-close {
                        position: absolute;
                        top: 20px;
                        right: 30px;
                        color: white;
                        font-size: 40px;
                        cursor: pointer;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        text-decoration: none;
                        display: inline-block;
                        font-weight: 500;
                    }
                    .btn-primary {
                        background: #c62828;
                        color: white;
                    }
                    .btn-primary:hover {
                        background: #b71c1c;
                    }
                    .btn-outline {
                        background: white;
                        border: 2px solid #c62828;
                        color: #c62828;
                    }
                    .btn-outline:hover {
                        background: #ffebee;
                    }
                    .actions-bar {
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        text-align: right;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🅿️ Parking Violation #${violation.Id}</h1>
                        <div class="header-nav">
                            <a href="/security-services/parking-violation">+ New Report</a>
                            <a href="/security-services/parking-violation/history">← Back to History</a>
                        </div>
                    </div>
                    
                    <div class="view-card">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Date</label>
                                <span>${violationDate}</span>
                            </div>
                            <div class="info-item">
                                <label>Location</label>
                                <span>${violation.Location}</span>
                            </div>
                            <div class="info-item">
                                <label>Created By</label>
                                <span>${violation.CreatedBy}</span>
                            </div>
                            <div class="info-item">
                                <label>Violator Name</label>
                                <span>${violation.ViolatorName || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Car Plate Number</label>
                                <span style="font-family: monospace; font-size: 18px; letter-spacing: 1px;">${violation.CarPlateNumber || '-'}</span>
                            </div>
                        </div>
                        
                        ${violation.ParkingLotInfo ? `
                            <div class="section-title">📋 Parking Lot Information</div>
                            <div class="info-text">${violation.ParkingLotInfo}</div>
                        ` : ''}
                        
                        <div class="section-title">📷 Photo Evidence (${images.length} image${images.length !== 1 ? 's' : ''})</div>
                        ${imagesHtml}
                        
                        <div class="footer-info">
                            Report created on ${new Date(violation.CreatedAt).toLocaleString('en-GB')}
                        </div>
                        
                        <div class="actions-bar">
                            <a href="/security-services/parking-violation/${violationId}/edit" class="btn btn-primary" style="margin-right: 10px;">✏️ Edit</a>
                            <button class="btn btn-outline" onclick="window.print()">🖨️ Print</button>
                        </div>
                    </div>
                </div>
                
                <div class="lightbox" id="lightbox" onclick="closeLightbox()">
                    <span class="lightbox-close">&times;</span>
                    <img id="lightboxImg" src="" alt="Full size">
                </div>
                
                <script>
                    function openLightbox(src) {
                        document.getElementById('lightboxImg').src = src;
                        document.getElementById('lightbox').classList.add('active');
                    }
                    function closeLightbox() {
                        document.getElementById('lightbox').classList.remove('active');
                    }
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') closeLightbox();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading parking violation:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

// Edit Parking Violation
router.get('/:id/edit', async (req, res) => {
    const user = req.currentUser;
    const violationId = req.params.id;
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('id', sql.Int, violationId)
            .query(`SELECT *, CONVERT(VARCHAR(10), ViolationDate, 120) as ViolationDateFormatted FROM Security_ParkingViolations WHERE Id = @id`);
        
        if (result.recordset.length === 0) {
            await pool.close();
            return res.status(404).send('Violation not found');
        }
        
        // Get all images for this violation
        const imagesResult = await pool.request()
            .input('violationId', sql.Int, violationId)
            .query(`SELECT Id, ImagePath FROM Security_ParkingViolation_Images WHERE ViolationId = @violationId ORDER BY Id`);
        
        await pool.close();
        
        const violation = result.recordset[0];
        const images = imagesResult.recordset;
        const violationDate = violation.ViolationDateFormatted || new Date(violation.ViolationDate).toISOString().split('T')[0];
        
        // Build existing images HTML
        let existingImagesHtml = '';
        if (images.length > 0) {
            existingImagesHtml = images.map(img => `
                <div class="existing-image" data-id="${img.Id}">
                    <img src="${img.ImagePath}" alt="Photo">
                    <button type="button" class="remove-image" onclick="removeExistingImage(${img.Id}, this)">✕</button>
                </div>
            `).join('');
        }
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Edit Parking Violation - ${process.env.APP_NAME}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container { max-width: 800px; margin: 0 auto; }
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
                    .header h1 { color: #333; font-size: 24px; }
                    .header-nav a { color: #c62828; text-decoration: none; font-weight: 500; margin-left: 20px; }
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
                    .form-group { display: flex; flex-direction: column; }
                    .form-group.full-width { grid-column: 1 / -1; }
                    .form-group label { font-weight: 600; color: #333; margin-bottom: 8px; font-size: 14px; }
                    .form-group input, .form-group select, .form-group textarea {
                        padding: 12px 15px;
                        border: 2px solid #e0e0e0;
                        border-radius: 10px;
                        font-size: 15px;
                    }
                    .form-group textarea { min-height: 100px; resize: vertical; }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
                        outline: none;
                        border-color: #c62828;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #333;
                        margin: 25px 0 15px 0;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .existing-images {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    .existing-image {
                        position: relative;
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    .existing-image img {
                        width: 100%;
                        height: 120px;
                        object-fit: cover;
                    }
                    .existing-image .remove-image {
                        position: absolute;
                        top: 5px;
                        right: 5px;
                        background: #c62828;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 25px;
                        height: 25px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    .existing-image.removed {
                        opacity: 0.3;
                    }
                    .existing-image.removed .remove-image {
                        background: #4caf50;
                    }
                    .btn {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 15px;
                        font-weight: 600;
                        text-decoration: none;
                        display: inline-block;
                    }
                    .btn-success { background: #c62828; color: white; }
                    .btn-outline { background: white; border: 2px solid #c62828; color: #c62828; }
                    .actions-bar {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 25px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                    }
                    .alert {
                        padding: 15px;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        display: none;
                        background: #ffebee;
                        color: #c62828;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✏️ Edit Parking Violation #${violationId}</h1>
                        <div class="header-nav">
                            <a href="/security-services/parking-violation/${violationId}">← Cancel</a>
                        </div>
                    </div>
                    
                    <div class="form-card">
                        <div id="alertBox" class="alert"></div>
                        <form id="editForm">
                            <input type="hidden" id="violationId" value="${violationId}">
                            <input type="hidden" id="removedImages" value="">
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Date *</label>
                                    <input type="date" id="violationDate" value="${violationDate}" required>
                                </div>
                                <div class="form-group">
                                    <label>Location *</label>
                                    <select id="location" required>
                                        <option value="HO Dbayeh Block A" ${violation.Location === 'HO Dbayeh Block A' ? 'selected' : ''}>HO Dbayeh Block A</option>
                                        <option value="HO Dbayeh Block B" ${violation.Location === 'HO Dbayeh Block B' ? 'selected' : ''}>HO Dbayeh Block B</option>
                                        <option value="Zouk HO" ${violation.Location === 'Zouk HO' ? 'selected' : ''}>Zouk HO</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Violator Name</label>
                                    <input type="text" id="violatorName" value="${violation.ViolatorName || ''}" placeholder="If known">
                                </div>
                                <div class="form-group">
                                    <label>Car Plate Number</label>
                                    <input type="text" id="carPlateNumber" value="${violation.CarPlateNumber || ''}" placeholder="e.g., B 123456">
                                </div>
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Parking Lot Information</label>
                                <textarea id="parkingLotInfo" placeholder="Describe the violation...">${violation.ParkingLotInfo || ''}</textarea>
                            </div>
                            
                            <div class="section-title">📷 Existing Photos</div>
                            <div class="existing-images" id="existingImages">
                                ${existingImagesHtml || '<p style="color: #888;">No photos</p>'}
                            </div>
                            
                            <div class="form-group full-width">
                                <label>Add New Photos</label>
                                <input type="file" id="newImages" accept="image/*" multiple>
                            </div>
                            
                            <div class="actions-bar">
                                <a href="/security-services/parking-violation/${violationId}" class="btn btn-outline">Cancel</a>
                                <button type="submit" class="btn btn-success">💾 Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
                
                <script>
                    let removedImageIds = [];
                    
                    function removeExistingImage(id, btn) {
                        const container = btn.closest('.existing-image');
                        if (container.classList.contains('removed')) {
                            container.classList.remove('removed');
                            removedImageIds = removedImageIds.filter(i => i !== id);
                            btn.textContent = '✕';
                        } else {
                            container.classList.add('removed');
                            removedImageIds.push(id);
                            btn.textContent = '↩';
                        }
                        document.getElementById('removedImages').value = removedImageIds.join(',');
                    }
                    
                    function showAlert(msg) {
                        const box = document.getElementById('alertBox');
                        box.textContent = msg;
                        box.style.display = 'block';
                        setTimeout(() => box.style.display = 'none', 5000);
                    }
                    
                    document.getElementById('editForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        
                        const formData = new FormData();
                        formData.append('violationId', document.getElementById('violationId').value);
                        formData.append('violationDate', document.getElementById('violationDate').value);
                        formData.append('location', document.getElementById('location').value);
                        formData.append('violatorName', document.getElementById('violatorName').value);
                        formData.append('carPlateNumber', document.getElementById('carPlateNumber').value);
                        formData.append('parkingLotInfo', document.getElementById('parkingLotInfo').value);
                        formData.append('removedImages', document.getElementById('removedImages').value);
                        
                        const newImages = document.getElementById('newImages').files;
                        for (let i = 0; i < newImages.length; i++) {
                            formData.append('images', newImages[i]);
                        }
                        
                        try {
                            const res = await fetch('/security-services/parking-violation/update', {
                                method: 'POST',
                                body: formData
                            });
                            const result = await res.json();
                            if (result.success) {
                                window.location.href = '/security-services/parking-violation/' + document.getElementById('violationId').value;
                            } else {
                                showAlert(result.message || 'Failed to save changes');
                            }
                        } catch (err) {
                            showAlert('Error: ' + err.message);
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading parking violation edit:', err);
        if (pool) await pool.close();
        res.status(500).send('Error: ' + err.message);
    }
});

// Update Parking Violation
router.post('/update', uploadMultiple, async (req, res) => {
    let pool;
    try {
        const { violationId, violationDate, location, violatorName, carPlateNumber, parkingLotInfo, removedImages } = req.body;
        
        if (!violationId || !violationDate || !location) {
            return res.json({ success: false, message: 'Missing required fields' });
        }
        
        pool = await sql.connect(dbConfig);
        
        // Update main violation record
        await pool.request()
            .input('id', sql.Int, violationId)
            .input('violationDate', sql.Date, violationDate)
            .input('location', sql.NVarChar, location)
            .input('violatorName', sql.NVarChar, violatorName || null)
            .input('carPlateNumber', sql.NVarChar, carPlateNumber || null)
            .input('parkingLotInfo', sql.NVarChar, parkingLotInfo || null)
            .query(`UPDATE Security_ParkingViolations SET 
                ViolationDate = @violationDate, 
                Location = @location, 
                ViolatorName = @violatorName, 
                CarPlateNumber = @carPlateNumber, 
                ParkingLotInfo = @parkingLotInfo
                WHERE Id = @id`);
        
        // Remove selected images
        if (removedImages) {
            const imageIds = removedImages.split(',').filter(id => id).map(id => parseInt(id));
            for (const imageId of imageIds) {
                // Get the file path first
                const imgResult = await pool.request()
                    .input('id', sql.Int, imageId)
                    .query('SELECT ImagePath FROM Security_ParkingViolation_Images WHERE Id = @id');
                
                if (imgResult.recordset.length > 0) {
                    // Delete from database
                    await pool.request()
                        .input('id', sql.Int, imageId)
                        .query('DELETE FROM Security_ParkingViolation_Images WHERE Id = @id');
                    
                    // Try to delete file from disk
                    try {
                        const filePath = path.join(__dirname, '../../..', imgResult.recordset[0].ImagePath);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    } catch (e) {
                        console.error('Error deleting file:', e);
                    }
                }
            }
        }
        
        // Add new images with compression
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Compress the uploaded image
                const fullPath = path.join(__dirname, '../../../uploads/parking-violations', file.filename);
                await compressImage(fullPath);
                
                const imagePath = '/uploads/parking-violations/' + file.filename;
                await pool.request()
                    .input('violationId', sql.Int, violationId)
                    .input('imagePath', sql.NVarChar, imagePath)
                    .query('INSERT INTO Security_ParkingViolation_Images (ViolationId, ImagePath) VALUES (@violationId, @imagePath)');
            }
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating parking violation:', err);
        if (pool) await pool.close();
        res.json({ success: false, message: err.message });
    }
});

module.exports = router;
