/**
 * Weekly Third Party Feedback Routes - Updated Form
 * Store managers submit weekly feedback about third party services
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { markFeedbackNotificationsRead } = require('../../../services/notification-scheduler');
const workflowEngine = require('../../../services/workflow-engine');

// Configure multer for image uploads
const uploadDir = path.join(__dirname, '../../../uploads/weekly-feedback');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'feedback-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// Helper: Get current week's start and end dates
function getCurrentWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    return {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
    };
}

// Main page - Weekly Feedback Form
router.get('/', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const currentWeek = getCurrentWeekDates();
        
        // Get stores from database
        const storesResult = await pool.request()
            .query(`SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName`);
        
        // Get users with specific roles (Head of Operations and Area Manager)
        const usersResult = await pool.request()
            .query(`SELECT u.Id, u.DisplayName, u.Email, r.RoleName 
                    FROM Users u 
                    LEFT JOIN UserRoles r ON u.RoleId = r.Id 
                    WHERE r.RoleName IN ('Head of Operations', 'Area Manager', 'Head of Operational Excellence')
                    ORDER BY r.RoleName, u.DisplayName`);
        
        const stores = storesResult.recordset;
        const users = usersResult.recordset;
        
        const headOfOps = users.filter(u => u.RoleName === 'Head of Operations' || u.RoleName === 'Head of Operational Excellence');
        const areaManagers = users.filter(u => u.RoleName === 'Area Manager');
        
        await pool.close();
        
        // Current user info
        const currentUser = req.currentUser || {};
        
        const storeOptions = stores.map(s => 
            `<option value="${s.Id}" data-name="${s.StoreName}">${s.StoreName}</option>`
        ).join('');
        
        const hoOptions = headOfOps.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        const amOptions = areaManagers.map(u => 
            `<option value="${u.Id}" data-name="${u.DisplayName}" data-email="${u.Email}">${u.DisplayName}</option>`
        ).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Weekly Third Party Feedback - ${process.env.APP_NAME}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { font-size: 24px; display: flex; align-items: center; gap: 10px; }
                    .header-nav { display: flex; gap: 15px; flex-wrap: wrap; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); transition: all 0.2s; }
                    .header-nav a:hover { background: rgba(255,255,255,0.25); }
                    .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
                    .form-card { background: white; border-radius: 12px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow: hidden; }
                    .form-header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 25px; text-align: center; }
                    .form-header h2 { margin: 0; font-size: 22px; }
                    .form-header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
                    .form-body { padding: 30px; }
                    .form-section { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
                    .form-section:last-child { border-bottom: none; }
                    .form-section h3 { color: #6c5ce7; font-size: 16px; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #6c5ce7; display: inline-block; }
                    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px; }
                    .form-group label span.required { color: #e74c3c; }
                    .form-group input, .form-group select, .form-group textarea { 
                        width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; 
                        font-size: 14px; transition: all 0.2s; font-family: inherit;
                    }
                    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
                        outline: none; border-color: #6c5ce7; box-shadow: 0 0 0 3px rgba(108,92,231,0.1); 
                    }
                    .form-group textarea { min-height: 80px; resize: vertical; }
                    .form-group input[type="number"] { max-width: 150px; }
                    
                    /* Radio Button Styles */
                    .radio-group { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 8px; }
                    .radio-group.vertical { flex-direction: column; gap: 10px; }
                    .radio-item { display: flex; align-items: center; gap: 8px; cursor: pointer; }
                    .radio-item input[type="radio"] { width: 18px; height: 18px; cursor: pointer; accent-color: #6c5ce7; }
                    .radio-item label { cursor: pointer; font-weight: normal; margin: 0; }
                    
                    /* Company Selection Styled */
                    .company-radio-group { display: flex; gap: 15px; flex-wrap: wrap; }
                    .company-radio { 
                        flex: 1; min-width: 120px; padding: 15px; border: 2px solid #ddd; border-radius: 10px; 
                        text-align: center; cursor: pointer; transition: all 0.2s;
                    }
                    .company-radio:hover { border-color: #6c5ce7; background: #f8f5ff; }
                    .company-radio input { display: none; }
                    .company-radio.selected { border-color: #6c5ce7; background: #6c5ce7; color: white; }
                    .company-radio span { font-weight: 600; }
                    
                    /* Star Rating */
                    .rating-container { margin-bottom: 20px; }
                    .rating-label { font-weight: 600; color: #333; margin-bottom: 10px; display: block; }
                    .stars { display: flex; gap: 5px; direction: rtl; justify-content: flex-end; }
                    .stars input { display: none; }
                    .stars label { cursor: pointer; font-size: 32px; color: #ddd; transition: color 0.2s; }
                    .stars input:checked ~ label, .stars label:hover, .stars label:hover ~ label { color: #f1c40f; }
                    
                    /* Yes/No Toggle */
                    .yes-no-toggle { display: flex; gap: 10px; }
                    .yes-no-btn { 
                        padding: 10px 25px; border: 2px solid #ddd; border-radius: 8px; 
                        cursor: pointer; font-weight: 600; transition: all 0.2s; background: white;
                    }
                    .yes-no-btn:hover { border-color: #6c5ce7; }
                    .yes-no-btn.yes.selected { background: #00b894; border-color: #00b894; color: white; }
                    .yes-no-btn.no.selected { background: #d63031; border-color: #d63031; color: white; }
                    .yes-no-btn input { display: none; }
                    
                    /* Conditional Sections */
                    .conditional-section { display: none; margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #6c5ce7; }
                    .conditional-section.visible { display: block; }
                    
                    .week-info { background: #e8f4fd; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
                    .week-info .icon { font-size: 24px; }
                    .week-info .text { flex: 1; }
                    .week-info .dates { font-weight: 600; color: #0078d4; }
                    
                    .btn-submit { 
                        width: 100%; padding: 16px; background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); 
                        color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; 
                        cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px;
                    }
                    .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(108,92,231,0.3); }
                    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                    
                    .user-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
                    .user-info p { margin: 5px 0; font-size: 14px; }
                    .user-info strong { color: #6c5ce7; }
                    
                    .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; border-radius: 8px; color: white; font-weight: 600; display: none; z-index: 1000; }
                    .toast-success { background: #00b894; }
                    .toast-error { background: #d63031; }
                    
                    .question-number { 
                        display: inline-flex; align-items: center; justify-content: center;
                        width: 24px; height: 24px; background: #6c5ce7; color: white; 
                        border-radius: 50%; font-size: 12px; font-weight: 600; margin-right: 8px;
                    }
                    
                    @media (max-width: 600px) {
                        .form-row { grid-template-columns: 1fr; }
                        .company-radio-group { flex-direction: column; }
                        .header { padding: 15px; }
                        .header h1 { font-size: 18px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Weekly Third Party Feedback</h1>
                    <div class="header-nav">
                        <a href="/stores/weekly-feedback/history">📜 My Submissions</a>
                        <a href="/stores">← Back to Stores</a>
                        <a href="/dashboard">Dashboard</a>
                    </div>
                </div>
                
                <div class="container">
                    <div class="form-card">
                        <div class="form-header">
                            <h2>Weekly Third Party Feedback Form</h2>
                            <p>Submit your weekly feedback about third party services at your store</p>
                        </div>
                        <div class="form-body">
                            <form id="feedbackForm" method="POST" action="/stores/weekly-feedback/submit">
                                <div class="week-info">
                                    <span class="icon">📅</span>
                                    <div class="text">
                                        <div>Current Week</div>
                                        <div class="dates">${currentWeek.start} to ${currentWeek.end}</div>
                                    </div>
                                </div>
                                
                                <input type="hidden" name="weekStart" value="${currentWeek.start}">
                                <input type="hidden" name="weekEnd" value="${currentWeek.end}">
                                
                                <!-- SECTION 1: Store Information -->
                                <div class="form-section">
                                    <h3>📍 Store Information</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">1</span>Head of Operations <span class="required">*</span></label>
                                        <select name="headOfOpsId" id="headOfOpsId" required>
                                            <option value="">Select Head of Operations</option>
                                            ${hoOptions}
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">2</span>Area Manager <span class="required">*</span></label>
                                        <select name="areaManagerId" id="areaManagerId" required>
                                            <option value="">Select Area Manager</option>
                                            ${amOptions}
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">3</span>Store Name <span class="required">*</span></label>
                                        <select name="storeId" id="storeId" required>
                                            <option value="">Select Store</option>
                                            ${storeOptions}
                                        </select>
                                    </div>
                                    
                                    <div class="user-info">
                                        <p><strong>Submitted By:</strong> ${currentUser.displayName || currentUser.email || 'Unknown'}</p>
                                        <p><strong>Email:</strong> ${currentUser.email || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                <!-- SECTION 2: Cleaning Company -->
                                <div class="form-section">
                                    <h3>🧹 Cleaning Services</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">4</span>Cleaning Company <span class="required">*</span></label>
                                        <div class="company-radio-group">
                                            <div class="company-radio" onclick="selectCompany(this, 'Assiyana')">
                                                <input type="radio" name="cleaningCompany" value="Assiyana" required>
                                                <span>Assiyana</span>
                                            </div>
                                            <div class="company-radio" onclick="selectCompany(this, 'Bright')">
                                                <input type="radio" name="cleaningCompany" value="Bright">
                                                <span>Bright</span>
                                            </div>
                                            <div class="company-radio" onclick="selectCompany(this, 'C-Plus')">
                                                <input type="radio" name="cleaningCompany" value="C-Plus">
                                                <span>C-Plus</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">5</span>Number of Cleaners assigned to the store</label>
                                        <input type="number" name="numberOfCleaners" min="0" placeholder="Enter number">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">6</span>Cleaners adherence to the schedule <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'cleanersAdherence', 'yes')">
                                                <input type="radio" name="cleanersAdherence" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'cleanersAdherence', 'no')">
                                                <input type="radio" name="cleanersAdherence" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">7</span>Comments (Adherence to Schedule)</label>
                                        <textarea name="cleanersAdherenceComments" placeholder="Enter comments about schedule adherence..."></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">8</span>Are the cleaners attending with company uniforms? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'cleanersUniforms', 'yes')">
                                                <input type="radio" name="cleanersUniforms" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'cleanersUniforms', 'no')">
                                                <input type="radio" name="cleanersUniforms" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">9</span>Comments (Uniforms)</label>
                                        <textarea name="cleanersUniformComments" placeholder="Enter comments about uniforms..."></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">10</span>Do cleaners respect personal Hygiene? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'cleanersHygiene', 'yes')">
                                                <input type="radio" name="cleanersHygiene" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'cleanersHygiene', 'no')">
                                                <input type="radio" name="cleanersHygiene" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">11</span>Comments (Personal Hygiene)</label>
                                        <textarea name="cleanersHygieneComments" placeholder="Enter comments about personal hygiene..."></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">12</span>Was a deep cleaning performed at the store for this month? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'deepCleaning', 'yes')">
                                                <input type="radio" name="deepCleaning" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'deepCleaning', 'no')">
                                                <input type="radio" name="deepCleaning" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">13</span>Is the cleaning team abiding by the cleaning checklist of the store manager? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'abidingChecklist', 'yes')">
                                                <input type="radio" name="abidingChecklist" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'abidingChecklist', 'no')">
                                                <input type="radio" name="abidingChecklist" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">14</span>Comments (Checklist)</label>
                                        <textarea name="cleaningChecklistComments" placeholder="Enter comments about checklist compliance..."></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">15</span>Cleaning Machine Available at the store? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'machineAvailable', 'yes'); toggleMachineSection(true);">
                                                <input type="radio" name="machineAvailable" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'machineAvailable', 'no'); toggleMachineSection(false);">
                                                <input type="radio" name="machineAvailable" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Conditional Section: Machine Available = YES -->
                                    <div class="conditional-section" id="machineYesSection">
                                        <div class="form-group">
                                            <label><span class="question-number">16</span>Number of Cleaning machines available at the store</label>
                                            <input type="number" name="numberOfMachines" min="0" placeholder="Enter number">
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">17</span>Is the Cleaning Machine operational? <span class="required">*</span></label>
                                            <div class="yes-no-toggle">
                                                <div class="yes-no-btn yes" onclick="selectYesNo(this, 'machineOperational', 'yes')">
                                                    <input type="radio" name="machineOperational" value="yes">Yes
                                                </div>
                                                <div class="yes-no-btn no" onclick="selectYesNo(this, 'machineOperational', 'no')">
                                                    <input type="radio" name="machineOperational" value="no">No
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">18</span>Comments (Cleaning Machine)</label>
                                            <textarea name="machineComments" placeholder="Enter comments about cleaning machine..."></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- SECTION 3: Quality Control & Ratings -->
                                <div class="form-section">
                                    <h3>📊 Quality Control & Ratings</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">19</span>General Comments about Cleaning services</label>
                                        <textarea name="generalCleaningComments" placeholder="Enter general comments about cleaning services..."></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">20</span>Is the Quality Control team from the company visiting the store regularly? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'qcVisiting', 'yes')">
                                                <input type="radio" name="qcVisiting" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'qcVisiting', 'no')">
                                                <input type="radio" name="qcVisiting" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">21</span>How often is the Quality Control team from the cleaning company visiting the store?</label>
                                        <input type="text" name="qcVisitFrequency" placeholder="e.g., Weekly, Bi-weekly, Monthly">
                                    </div>
                                    
                                    <div class="rating-container">
                                        <label class="rating-label"><span class="question-number">22</span>How do you rate the response time of the third-party cleaning company when you face issues?</label>
                                        <div class="stars">
                                            <input type="radio" name="responseTimeRating" value="5" id="resp5"><label for="resp5">★</label>
                                            <input type="radio" name="responseTimeRating" value="4" id="resp4"><label for="resp4">★</label>
                                            <input type="radio" name="responseTimeRating" value="3" id="resp3"><label for="resp3">★</label>
                                            <input type="radio" name="responseTimeRating" value="2" id="resp2"><label for="resp2">★</label>
                                            <input type="radio" name="responseTimeRating" value="1" id="resp1"><label for="resp1">★</label>
                                        </div>
                                        <small style="color: #666;">1 = Poor, 5 = Excellent</small>
                                    </div>
                                    
                                    <div class="rating-container">
                                        <label class="rating-label"><span class="question-number">23</span>Store Cleanliness Rating</label>
                                        <div class="stars">
                                            <input type="radio" name="cleanlinessRating" value="5" id="clean5"><label for="clean5">★</label>
                                            <input type="radio" name="cleanlinessRating" value="4" id="clean4"><label for="clean4">★</label>
                                            <input type="radio" name="cleanlinessRating" value="3" id="clean3"><label for="clean3">★</label>
                                            <input type="radio" name="cleanlinessRating" value="2" id="clean2"><label for="clean2">★</label>
                                            <input type="radio" name="cleanlinessRating" value="1" id="clean1"><label for="clean1">★</label>
                                        </div>
                                        <small style="color: #666;">1 = Poor, 5 = Excellent</small>
                                    </div>
                                </div>
                                
                                <!-- SECTION 4: Porter Services -->
                                <div class="form-section">
                                    <h3>🧑‍💼 Porter Services</h3>
                                    
                                    <div class="form-group">
                                        <label><span class="question-number">24</span>Are porter services available at the store? <span class="required">*</span></label>
                                        <div class="yes-no-toggle">
                                            <div class="yes-no-btn yes" onclick="selectYesNo(this, 'porterAvailable', 'yes'); togglePorterSection(true);">
                                                <input type="radio" name="porterAvailable" value="yes" required>Yes
                                            </div>
                                            <div class="yes-no-btn no" onclick="selectYesNo(this, 'porterAvailable', 'no'); togglePorterSection(false);">
                                                <input type="radio" name="porterAvailable" value="no">No
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Conditional Section: Porter Available = YES -->
                                    <div class="conditional-section" id="porterYesSection">
                                        <div class="form-group">
                                            <label><span class="question-number">25</span>Is the needed porter's count being available at the store as per the schedule? <span class="required">*</span></label>
                                            <div class="yes-no-toggle">
                                                <div class="yes-no-btn yes" onclick="selectYesNo(this, 'porterCount', 'yes')">
                                                    <input type="radio" name="porterCount" value="yes">Yes
                                                </div>
                                                <div class="yes-no-btn no" onclick="selectYesNo(this, 'porterCount', 'no')">
                                                    <input type="radio" name="porterCount" value="no">No
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">26</span>Are the porters abiding by the set schedule? <span class="required">*</span></label>
                                            <div class="yes-no-toggle">
                                                <div class="yes-no-btn yes" onclick="selectYesNo(this, 'porterSchedule', 'yes')">
                                                    <input type="radio" name="porterSchedule" value="yes">Yes
                                                </div>
                                                <div class="yes-no-btn no" onclick="selectYesNo(this, 'porterSchedule', 'no')">
                                                    <input type="radio" name="porterSchedule" value="no">No
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">27</span>Are the Porters attending with company uniforms? <span class="required">*</span></label>
                                            <div class="yes-no-toggle">
                                                <div class="yes-no-btn yes" onclick="selectYesNo(this, 'porterUniforms', 'yes')">
                                                    <input type="radio" name="porterUniforms" value="yes">Yes
                                                </div>
                                                <div class="yes-no-btn no" onclick="selectYesNo(this, 'porterUniforms', 'no')">
                                                    <input type="radio" name="porterUniforms" value="no">No
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">28</span>Do porters respect personal Hygiene? <span class="required">*</span></label>
                                            <div class="yes-no-toggle">
                                                <div class="yes-no-btn yes" onclick="selectYesNo(this, 'porterHygiene', 'yes')">
                                                    <input type="radio" name="porterHygiene" value="yes">Yes
                                                </div>
                                                <div class="yes-no-btn no" onclick="selectYesNo(this, 'porterHygiene', 'no')">
                                                    <input type="radio" name="porterHygiene" value="no">No
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label><span class="question-number">29</span>Comments About Porter Services</label>
                                            <textarea name="porterComments" placeholder="Enter comments about porter services..."></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" class="btn-submit" id="submitBtn">
                                    <span>📤</span> Submit Weekly Feedback
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                
                <div id="toast" class="toast"></div>
                
                <script>
                    function showToast(message, type) {
                        const toast = document.getElementById('toast');
                        toast.textContent = message;
                        toast.className = 'toast toast-' + type;
                        toast.style.display = 'block';
                        setTimeout(() => { toast.style.display = 'none'; }, 4000);
                    }
                    
                    function selectCompany(el, value) {
                        document.querySelectorAll('.company-radio').forEach(r => r.classList.remove('selected'));
                        el.classList.add('selected');
                        el.querySelector('input').checked = true;
                    }
                    
                    function selectYesNo(el, name, value) {
                        const parent = el.parentElement;
                        parent.querySelectorAll('.yes-no-btn').forEach(btn => btn.classList.remove('selected'));
                        el.classList.add('selected');
                        el.querySelector('input').checked = true;
                    }
                    
                    function toggleMachineSection(show) {
                        const section = document.getElementById('machineYesSection');
                        if (show) {
                            section.classList.add('visible');
                            // Make machine operational required when visible
                        } else {
                            section.classList.remove('visible');
                            // Clear values when hidden
                            section.querySelectorAll('input, textarea').forEach(el => {
                                if (el.type === 'radio') el.checked = false;
                                else el.value = '';
                            });
                            section.querySelectorAll('.yes-no-btn').forEach(btn => btn.classList.remove('selected'));
                        }
                    }
                    
                    function togglePorterSection(show) {
                        const section = document.getElementById('porterYesSection');
                        if (show) {
                            section.classList.add('visible');
                        } else {
                            section.classList.remove('visible');
                            // Clear values when hidden
                            section.querySelectorAll('input, textarea').forEach(el => {
                                if (el.type === 'radio') el.checked = false;
                                else el.value = '';
                            });
                            section.querySelectorAll('.yes-no-btn').forEach(btn => btn.classList.remove('selected'));
                        }
                    }
                    
                    document.getElementById('feedbackForm').addEventListener('submit', async function(e) {
                        e.preventDefault();
                        
                        const btn = document.getElementById('submitBtn');
                        btn.disabled = true;
                        btn.innerHTML = '<span>⏳</span> Submitting...';
                        
                        const formData = new FormData(this);
                        
                        // Get selected option names and add them to formData
                        const storeSelect = document.getElementById('storeId');
                        const hoSelect = document.getElementById('headOfOpsId');
                        const amSelect = document.getElementById('areaManagerId');
                        
                        formData.append('storeName', storeSelect.options[storeSelect.selectedIndex]?.dataset.name || '');
                        formData.append('headOfOpsName', hoSelect.options[hoSelect.selectedIndex]?.dataset.name || '');
                        formData.append('headOfOpsEmail', hoSelect.options[hoSelect.selectedIndex]?.dataset.email || '');
                        formData.append('areaManagerName', amSelect.options[amSelect.selectedIndex]?.dataset.name || '');
                        formData.append('areaManagerEmail', amSelect.options[amSelect.selectedIndex]?.dataset.email || '');
                        
                        try {
                            const res = await fetch('/stores/weekly-feedback/submit', {
                                method: 'POST',
                                body: formData
                            });
                            
                            const result = await res.json();
                            
                            if (res.ok && result.success) {
                                showToast('Feedback submitted successfully!', 'success');
                                setTimeout(() => {
                                    window.location.href = '/stores/weekly-feedback/success/' + result.id;
                                }, 1500);
                            } else {
                                showToast(result.error || 'Failed to submit feedback', 'error');
                                btn.disabled = false;
                                btn.innerHTML = '<span>📤</span> Submit Weekly Feedback';
                            }
                        } catch (err) {
                            showToast('Error: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.innerHTML = '<span>📤</span> Submit Weekly Feedback';
                        }
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading feedback form:', err);
        res.status(500).send('Error loading form: ' + err.message);
    }
});

// Submit feedback
router.post('/submit', upload.single('feedbackImage'), async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const data = req.body;
        const currentUser = req.currentUser || {};
        const imagePath = req.file ? '/uploads/weekly-feedback/' + req.file.filename : null;
        
        // Check if feedback already submitted for this store this week
        const existingCheck = await pool.request()
            .input('storeId', sql.Int, data.storeId)
            .input('weekStart', sql.Date, data.weekStart)
            .input('weekEnd', sql.Date, data.weekEnd)
            .query(`SELECT Id FROM WeeklyThirdPartyFeedback 
                    WHERE StoreId = @storeId AND WeekStartDate = @weekStart AND WeekEndDate = @weekEnd`);
        
        if (existingCheck.recordset.length > 0) {
            await pool.close();
            return res.status(400).json({ success: false, error: 'Feedback already submitted for this store this week' });
        }
        
        // Convert yes/no to bit values
        const toBit = (val) => val === 'yes' ? 1 : (val === 'no' ? 0 : null);
        
        const result = await pool.request()
            .input('storeId', sql.Int, data.storeId)
            .input('storeName', sql.NVarChar(100), data.storeName)
            .input('storeManagerId', sql.Int, currentUser.id || null)
            .input('storeManagerName', sql.NVarChar(200), currentUser.displayName || currentUser.email)
            .input('storeManagerEmail', sql.NVarChar(200), currentUser.email)
            .input('areaManagerId', sql.Int, data.areaManagerId || null)
            .input('areaManagerName', sql.NVarChar(200), data.areaManagerName)
            .input('areaManagerEmail', sql.NVarChar(200), data.areaManagerEmail)
            .input('headOfOpsId', sql.Int, data.headOfOpsId || null)
            .input('headOfOpsName', sql.NVarChar(200), data.headOfOpsName)
            .input('headOfOpsEmail', sql.NVarChar(200), data.headOfOpsEmail)
            .input('weekStart', sql.Date, data.weekStart)
            .input('weekEnd', sql.Date, data.weekEnd)
            // New fields
            .input('cleaningCompany', sql.NVarChar(100), data.cleaningCompany)
            .input('numberOfCleaners', sql.Int, data.numberOfCleaners || null)
            .input('cleanersAdherence', sql.Bit, toBit(data.cleanersAdherence))
            .input('cleanersAdherenceComments', sql.NVarChar(sql.MAX), data.cleanersAdherenceComments || null)
            .input('cleanersUniforms', sql.Bit, toBit(data.cleanersUniforms))
            .input('cleanersUniformComments', sql.NVarChar(sql.MAX), data.cleanersUniformComments || null)
            .input('cleanersHygiene', sql.Bit, toBit(data.cleanersHygiene))
            .input('cleanersHygieneComments', sql.NVarChar(sql.MAX), data.cleanersHygieneComments || null)
            .input('deepCleaning', sql.Bit, toBit(data.deepCleaning))
            .input('abidingChecklist', sql.Bit, toBit(data.abidingChecklist))
            .input('cleaningChecklistComments', sql.NVarChar(sql.MAX), data.cleaningChecklistComments || null)
            .input('machineAvailable', sql.Bit, toBit(data.machineAvailable))
            .input('numberOfMachines', sql.Int, data.numberOfMachines || null)
            .input('machineOperational', sql.Bit, toBit(data.machineOperational))
            .input('machineComments', sql.NVarChar(sql.MAX), data.machineComments || null)
            .input('generalCleaningComments', sql.NVarChar(sql.MAX), data.generalCleaningComments || null)
            .input('qcVisiting', sql.Bit, toBit(data.qcVisiting))
            .input('qcVisitFrequency', sql.NVarChar(200), data.qcVisitFrequency || null)
            .input('responseTimeRating', sql.Int, data.responseTimeRating || null)
            .input('cleanlinessRating', sql.Int, data.cleanlinessRating || null)
            .input('porterAvailable', sql.Bit, toBit(data.porterAvailable))
            .input('porterCount', sql.Bit, toBit(data.porterCount))
            .input('porterSchedule', sql.Bit, toBit(data.porterSchedule))
            .input('porterUniforms', sql.Bit, toBit(data.porterUniforms))
            .input('porterHygiene', sql.Bit, toBit(data.porterHygiene))
            .input('porterComments', sql.NVarChar(sql.MAX), data.porterComments || null)
            .input('imagePath', sql.NVarChar(500), imagePath)
            .input('createdBy', sql.Int, currentUser.id || null)
            .query(`INSERT INTO WeeklyThirdPartyFeedback 
                    (StoreId, StoreName, StoreManagerId, StoreManagerName, StoreManagerEmail,
                     AreaManagerId, AreaManagerName, AreaManagerEmail,
                     HeadOfOperationsId, HeadOfOperationsName, HeadOfOperationsEmail,
                     WeekStartDate, WeekEndDate,
                     CleaningCompany, NumberOfCleaners, CleanersAdherenceToSchedule, CleanersAdherenceComments,
                     CleanersWithUniforms, CleanersUniformComments,
                     CleanersPersonalHygiene, CleanersHygieneComments,
                     DeepCleaningPerformed, CleaningTeamAbidingChecklist, CleaningChecklistComments,
                     CleaningMachineAvailable, NumberOfCleaningMachines, CleaningMachineOperational, CleaningMachineComments,
                     GeneralCleaningComments, QCTeamVisitingRegularly, QCTeamVisitFrequency,
                     ResponseTimeRating, CleanlinessRating,
                     PorterServicesAvailable, PorterCountAsPerSchedule, PortersAbidingBySchedule,
                     PortersWithUniforms, PortersPersonalHygiene, PorterServicesComments,
                     ImagePath, CreatedBy)
                    OUTPUT INSERTED.Id
                    VALUES (@storeId, @storeName, @storeManagerId, @storeManagerName, @storeManagerEmail,
                            @areaManagerId, @areaManagerName, @areaManagerEmail,
                            @headOfOpsId, @headOfOpsName, @headOfOpsEmail,
                            @weekStart, @weekEnd,
                            @cleaningCompany, @numberOfCleaners, @cleanersAdherence, @cleanersAdherenceComments,
                            @cleanersUniforms, @cleanersUniformComments,
                            @cleanersHygiene, @cleanersHygieneComments,
                            @deepCleaning, @abidingChecklist, @cleaningChecklistComments,
                            @machineAvailable, @numberOfMachines, @machineOperational, @machineComments,
                            @generalCleaningComments, @qcVisiting, @qcVisitFrequency,
                            @responseTimeRating, @cleanlinessRating,
                            @porterAvailable, @porterCount, @porterSchedule,
                            @porterUniforms, @porterHygiene, @porterComments,
                            @imagePath, @createdBy)`);
        
        const feedbackId = result.recordset[0].Id;
        
        // Trigger workflow engine (non-blocking)
        workflowEngine.start({
            formCode: 'WEEKLY_FEEDBACK',
            recordId: feedbackId,
            recordTable: 'WeeklyThirdPartyFeedback',
            submitter: { userId: currentUser.id, email: currentUser.email, name: currentUser.displayName },
            store: { storeId: data.storeId, storeName: data.storeName },
            metaData: {},
            accessToken: req.currentUser?.accessToken
        }).catch(err => console.error('[WORKFLOW] Weekly feedback error:', err));
        
        await pool.close();
        
        // Mark feedback-related notifications as read
        if (currentUser.id || currentUser.email) {
            await markFeedbackNotificationsRead(currentUser.id, currentUser.email);
        }
        
        res.json({ success: true, id: feedbackId, message: 'Feedback submitted successfully' });
    } catch (err) {
        console.error('Error submitting feedback:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Success page
router.get('/success/:id', async (req, res) => {
    const feedbackId = req.params.id;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Feedback Submitted - ${process.env.APP_NAME}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 50px 20px; background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .container { max-width: 500px; background: white; border-radius: 16px; padding: 50px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                .icon { font-size: 80px; margin-bottom: 20px; }
                h1 { color: #00b894; margin: 0 0 15px 0; }
                p { color: #666; margin-bottom: 30px; font-size: 16px; }
                .ref { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
                .ref strong { color: #6c5ce7; }
                .btn { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 5px; transition: all 0.2s; }
                .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(108,92,231,0.3); }
                .btn-secondary { background: #dfe6e9; color: #2d3436; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">✅</div>
                <h1>Feedback Submitted!</h1>
                <p>Thank you for submitting your weekly third party feedback.</p>
                <div class="ref">
                    <strong>Reference ID:</strong> WF-${feedbackId}
                </div>
                <a href="/stores/weekly-feedback" class="btn">📋 Submit Another</a>
                <a href="/stores/weekly-feedback/history" class="btn btn-secondary">📜 View History</a>
                <a href="/stores" class="btn btn-secondary">← Stores</a>
            </div>
        </body>
        </html>
    `);
});

// History page - My submissions
router.get('/history', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const currentUser = req.currentUser || {};
        
        // Show all feedback records
        const result = await pool.request()
            .query(`SELECT * FROM WeeklyThirdPartyFeedback 
                    ORDER BY CreatedAt DESC`);
        
        await pool.close();
        
        const tableRows = result.recordset.map(r => `
            <tr>
                <td><strong>WF-${r.Id}</strong></td>
                <td>${r.StoreName}</td>
                <td>${r.CleaningCompany || '-'}</td>
                <td>${new Date(r.WeekStartDate).toLocaleDateString('en-GB')} - ${new Date(r.WeekEndDate).toLocaleDateString('en-GB')}</td>
                <td>${'⭐'.repeat(r.CleanlinessRating || 0)}</td>
                <td>${new Date(r.CreatedAt).toLocaleDateString('en-GB')}</td>
                <td>
                    <a href="/stores/weekly-feedback/view/${r.Id}" style="color: #6c5ce7; text-decoration: none;">View</a>
                </td>
            </tr>
        `).join('');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>My Feedback History - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { font-size: 24px; }
                    .header-nav { display: flex; gap: 15px; flex-wrap: wrap; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
                    .table-container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; min-width: 700px; }
                    th { background: #f8f9fa; padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; }
                    td { padding: 15px; border-bottom: 1px solid #eee; }
                    .empty-state { text-align: center; padding: 60px 20px; color: #666; }
                    .empty-state .icon { font-size: 48px; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📜 Feedback History</h1>
                    <div class="header-nav">
                        <a href="/stores/weekly-feedback">➕ New Feedback</a>
                        <a href="/stores">← Back to Stores</a>
                    </div>
                </div>
                <div class="container">
                    <div class="table-container">
                        ${result.recordset.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Store</th>
                                        <th>Company</th>
                                        <th>Week</th>
                                        <th>Cleanliness</th>
                                        <th>Submitted</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        ` : `
                            <div class="empty-state">
                                <div class="icon">📋</div>
                                <h3>No feedback submitted yet</h3>
                                <p>Start by submitting your weekly feedback.</p>
                            </div>
                        `}
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error loading history:', err);
        res.status(500).send('Error loading history: ' + err.message);
    }
});

// View single feedback
router.get('/view/:id', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const feedbackId = parseInt(req.params.id);
        
        const result = await pool.request()
            .input('id', sql.Int, feedbackId)
            .query(`SELECT * FROM WeeklyThirdPartyFeedback WHERE Id = @id`);
        
        await pool.close();
        
        if (result.recordset.length === 0) {
            return res.status(404).send('Feedback not found');
        }
        
        const f = result.recordset[0];
        
        const yesNo = (val) => val === true || val === 1 ? '<span style="color: #00b894; font-weight: 600;">✓ Yes</span>' : (val === false || val === 0 ? '<span style="color: #d63031; font-weight: 600;">✗ No</span>' : 'N/A');
        const starRating = (val) => val ? '★'.repeat(val) + '☆'.repeat(5 - val) : 'Not rated';
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
            <title>View Feedback WF-${f.Id} - ${process.env.APP_NAME}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f6fa; min-height: 100vh; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { font-size: 24px; }
                    .header-nav a { color: white; text-decoration: none; padding: 8px 16px; border-radius: 5px; background: rgba(255,255,255,0.15); }
                    .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
                    .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 15px rgba(0,0,0,0.08); margin-bottom: 20px; }
                    .card-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #eee; }
                    .card-header h3 { color: #6c5ce7; }
                    .card-body { padding: 20px; }
                    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { width: 280px; color: #666; font-weight: 500; flex-shrink: 0; }
                    .detail-value { flex: 1; }
                    .rating { color: #f1c40f; font-size: 18px; }
                    .text-block { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; }
                    .section-title { font-weight: 600; color: #333; padding: 15px 0 10px 0; border-top: 2px solid #eee; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Feedback WF-${f.Id}</h1>
                    <div class="header-nav">
                        <a href="/stores/weekly-feedback/history">← Back to History</a>
                    </div>
                </div>
                <div class="container">
                    <div class="card">
                        <div class="card-header"><h3>📍 Store Information</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Store:</span><span class="detail-value">${f.StoreName}</span></div>
                            <div class="detail-row"><span class="detail-label">Week:</span><span class="detail-value">${new Date(f.WeekStartDate).toLocaleDateString('en-GB')} - ${new Date(f.WeekEndDate).toLocaleDateString('en-GB')}</span></div>
                            <div class="detail-row"><span class="detail-label">Submitted By:</span><span class="detail-value">${f.StoreManagerName}</span></div>
                            <div class="detail-row"><span class="detail-label">Area Manager:</span><span class="detail-value">${f.AreaManagerName || 'N/A'}</span></div>
                            <div class="detail-row"><span class="detail-label">Head of Operations:</span><span class="detail-value">${f.HeadOfOperationsName || 'N/A'}</span></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>🧹 Cleaning Services</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Cleaning Company:</span><span class="detail-value">${f.CleaningCompany || 'N/A'}</span></div>
                            <div class="detail-row"><span class="detail-label">Number of Cleaners:</span><span class="detail-value">${f.NumberOfCleaners || 'N/A'}</span></div>
                            <div class="detail-row"><span class="detail-label">Cleaners Adherence to Schedule:</span><span class="detail-value">${yesNo(f.CleanersAdherenceToSchedule)}</span></div>
                            ${f.CleanersAdherenceComments ? `<div class="text-block">${f.CleanersAdherenceComments}</div>` : ''}
                            <div class="detail-row"><span class="detail-label">Cleaners with Uniforms:</span><span class="detail-value">${yesNo(f.CleanersWithUniforms)}</span></div>
                            ${f.CleanersUniformComments ? `<div class="text-block">${f.CleanersUniformComments}</div>` : ''}
                            <div class="detail-row"><span class="detail-label">Cleaners Personal Hygiene:</span><span class="detail-value">${yesNo(f.CleanersPersonalHygiene)}</span></div>
                            ${f.CleanersHygieneComments ? `<div class="text-block">${f.CleanersHygieneComments}</div>` : ''}
                            <div class="detail-row"><span class="detail-label">Deep Cleaning Performed:</span><span class="detail-value">${yesNo(f.DeepCleaningPerformed)}</span></div>
                            <div class="detail-row"><span class="detail-label">Abiding by Checklist:</span><span class="detail-value">${yesNo(f.CleaningTeamAbidingChecklist)}</span></div>
                            ${f.CleaningChecklistComments ? `<div class="text-block">${f.CleaningChecklistComments}</div>` : ''}
                            
                            <div class="section-title">Cleaning Machine</div>
                            <div class="detail-row"><span class="detail-label">Machine Available:</span><span class="detail-value">${yesNo(f.CleaningMachineAvailable)}</span></div>
                            ${f.CleaningMachineAvailable ? `
                                <div class="detail-row"><span class="detail-label">Number of Machines:</span><span class="detail-value">${f.NumberOfCleaningMachines || 'N/A'}</span></div>
                                <div class="detail-row"><span class="detail-label">Machine Operational:</span><span class="detail-value">${yesNo(f.CleaningMachineOperational)}</span></div>
                                ${f.CleaningMachineComments ? `<div class="text-block">${f.CleaningMachineComments}</div>` : ''}
                            ` : ''}
                            
                            ${f.GeneralCleaningComments ? `
                                <div class="section-title">General Comments</div>
                                <div class="text-block">${f.GeneralCleaningComments}</div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>📊 Quality Control & Ratings</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">QC Team Visiting Regularly:</span><span class="detail-value">${yesNo(f.QCTeamVisitingRegularly)}</span></div>
                            <div class="detail-row"><span class="detail-label">QC Visit Frequency:</span><span class="detail-value">${f.QCTeamVisitFrequency || 'N/A'}</span></div>
                            <div class="detail-row"><span class="detail-label">Response Time Rating:</span><span class="detail-value rating">${starRating(f.ResponseTimeRating)}</span></div>
                            <div class="detail-row"><span class="detail-label">Store Cleanliness Rating:</span><span class="detail-value rating">${starRating(f.CleanlinessRating)}</span></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>🧑‍💼 Porter Services</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Porter Services Available:</span><span class="detail-value">${yesNo(f.PorterServicesAvailable)}</span></div>
                            ${f.PorterServicesAvailable ? `
                                <div class="detail-row"><span class="detail-label">Porter Count as per Schedule:</span><span class="detail-value">${yesNo(f.PorterCountAsPerSchedule)}</span></div>
                                <div class="detail-row"><span class="detail-label">Porters Abiding by Schedule:</span><span class="detail-value">${yesNo(f.PortersAbidingBySchedule)}</span></div>
                                <div class="detail-row"><span class="detail-label">Porters with Uniforms:</span><span class="detail-value">${yesNo(f.PortersWithUniforms)}</span></div>
                                <div class="detail-row"><span class="detail-label">Porters Personal Hygiene:</span><span class="detail-value">${yesNo(f.PortersPersonalHygiene)}</span></div>
                                ${f.PorterServicesComments ? `<div class="text-block">${f.PorterServicesComments}</div>` : ''}
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header"><h3>📝 Submission Details</h3></div>
                        <div class="card-body">
                            <div class="detail-row"><span class="detail-label">Submitted At:</span><span class="detail-value">${new Date(f.CreatedAt).toLocaleString('en-GB')}</span></div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error viewing feedback:', err);
        res.status(500).send('Error viewing feedback: ' + err.message);
    }
});

module.exports = router;
