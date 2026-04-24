/**
 * Receiving Audit Module
 * Receiving Area Audit Inspection App
 * Handles receiving audits, reports, and action plans
 * Each visit = 1 cycle
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const sql = require('mssql');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const emailTemplateBuilder = require('../../services/email-template-builder');
const emailService = require('../../services/email-service');
const { getFreshAccessToken } = require('../../auth/auth-server');

// Configure multer for receiving audit photo uploads (file storage, NOT base64)
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'receiving-audit');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const auditStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'rcv-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const auditUpload = multer({
    storage: auditStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
});

// Image compression settings
const COMPRESSION_CONFIG = { maxWidth: 1920, maxHeight: 1080, quality: 80, pngCompressionLevel: 8 };

async function compressImage(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const tempPath = filePath + '.tmp';
        let inst = sharp(filePath).resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, { fit: 'inside', withoutEnlargement: true });
        if (ext === '.jpg' || ext === '.jpeg') inst = inst.jpeg({ quality: COMPRESSION_CONFIG.quality });
        else if (ext === '.png') inst = inst.png({ compressionLevel: COMPRESSION_CONFIG.pngCompressionLevel });
        else if (ext === '.webp') inst = inst.webp({ quality: COMPRESSION_CONFIG.quality });
        else if (ext === '.gif') inst = inst.gif();
        await inst.toFile(tempPath);
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
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

// Shared pool - do NOT close per-request
let _pool = null;
async function getPool() {
    if (!_pool || !_pool.connected) {
        _pool = new sql.ConnectionPool(dbConfig);
        _pool.on('error', err => { console.error('RCV SQL pool error:', err); _pool = null; });
        await _pool.connect();
    }
    return _pool;
}

// No-cache middleware
router.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
router.use((req, res, next) => {
    if (req.path.endsWith('.html') || !req.path.includes('.') || req.path === '/') {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

// ==========================================
// Page Routes
// ==========================================

// Landing page - Dashboard
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today
            FROM RCV_Inspections
        `);
        const s = stats.recordset[0] || { total: 0, drafts: 0, completed: 0, today: 0 };

        res.send(`<!DOCTYPE html><html><head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Receiving Audit</title>
            <style>
                *{box-sizing:border-box;margin:0;padding:0}
                body{font-family:'Segoe UI',Arial,sans-serif;background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);min-height:100vh}
                .header{background:rgba(0,0,0,0.2);color:#fff;padding:15px 30px;display:flex;justify-content:space-between;align-items:center}
                .header h1{font-size:24px}
                .header-nav{display:flex;gap:15px}
                .header-nav a{color:#fff;text-decoration:none;padding:8px 16px;border-radius:5px;background:rgba(255,255,255,0.1);transition:background 0.2s}
                .header-nav a:hover{background:rgba(255,255,255,0.2)}
                .container{max-width:1200px;margin:0 auto;padding:30px}
                .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:30px}
                .stat-card{background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);border-radius:15px;padding:25px;color:#fff;text-align:center}
                .stat-number{font-size:36px;font-weight:700}
                .stat-label{font-size:14px;opacity:0.9;margin-top:5px}
                .actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}
                .action-card{background:#fff;border-radius:15px;padding:25px;box-shadow:0 4px 15px rgba(0,0,0,0.1);transition:transform 0.2s;cursor:pointer;text-decoration:none;color:#333}
                .action-card:hover{transform:translateY(-5px)}
                .action-icon{font-size:40px;margin-bottom:15px}
                .action-title{font-size:18px;font-weight:600;margin-bottom:8px}
                .action-desc{color:#666;font-size:14px}
            </style>
        </head><body>
            <div class="header">
                <h1>📦 Receiving Audit</h1>
                <div class="header-nav">
                    <a href="/dashboard">🏠 Dashboard</a>
                    <a href="/receiving-audit/list">📋 Audits</a>
                    <a href="/receiving-audit/template-builder">🔧 Templates</a>
                    <a href="/receiving-audit/settings">⚙️ Settings</a>
                </div>
            </div>
            <div class="container">
                <div class="stats">
                    <div class="stat-card"><div class="stat-number">${s.total}</div><div class="stat-label">Total Audits</div></div>
                    <div class="stat-card"><div class="stat-number">${s.drafts}</div><div class="stat-label">In Progress</div></div>
                    <div class="stat-card"><div class="stat-number">${s.completed}</div><div class="stat-label">Completed</div></div>
                    <div class="stat-card"><div class="stat-number">${s.today}</div><div class="stat-label">Today</div></div>
                </div>
                <div class="actions">
                    <a href="/receiving-audit/start" class="action-card"><div class="action-icon">🚀</div><div class="action-title">Start New Audit</div><div class="action-desc">Begin a new receiving area inspection</div></a>
                    <a href="/receiving-audit/list" class="action-card"><div class="action-icon">📋</div><div class="action-title">View Audits</div><div class="action-desc">Browse all receiving audits</div></a>
                    <a href="/receiving-audit/template-builder" class="action-card"><div class="action-icon">🔧</div><div class="action-title">Template Builder</div><div class="action-desc">Create and manage audit templates</div></a>
                    <a href="/receiving-audit/store-management" class="action-card"><div class="action-icon">🏪</div><div class="action-title">Store Management</div><div class="action-desc">Manage stores and assignments</div></a>
                    <a href="/receiving-audit/settings" class="action-card"><div class="action-icon">⚙️</div><div class="action-title">Settings</div><div class="action-desc">Configure audit settings</div></a>
                </div>
            </div>
        </body></html>`);
    } catch (err) {
        console.error('Error loading dashboard:', err);
        res.status(500).send('Error loading dashboard');
    }
});

router.get('/start', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'start-audit.html')));
router.get('/fill/:id', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'fill-audit.html')));
router.get('/list', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'audit-list.html')));
router.get('/template-builder', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'template-builder.html')));
router.get('/store-management', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'store-management.html')));
router.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'system-settings.html')));
router.get('/action-plan/:id', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'action-plan.html')));

// ==========================================
// Settings API
// ==========================================
router.get('/api/settings', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT SettingKey, SettingValue FROM RCV_InspectionSettings WHERE IsActive = 1');
        const settings = {};
        result.recordset.forEach(r => { settings[r.SettingKey] = r.SettingValue; });
        res.json({ success: true, data: settings });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/settings', async (req, res) => {
    try {
        const pool = await getPool();
        for (const [key, value] of Object.entries(req.body)) {
            await pool.request()
                .input('key', sql.NVarChar, key)
                .input('value', sql.NVarChar, value)
                .query(`
                    IF EXISTS (SELECT 1 FROM RCV_InspectionSettings WHERE SettingKey = @key)
                        UPDATE RCV_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO RCV_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)
                `);
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Next Document Number
// ==========================================
router.get('/api/next-document-number', async (req, res) => {
    try {
        const pool = await getPool();
        const prefixResult = await pool.request().query("SELECT SettingValue FROM RCV_InspectionSettings WHERE SettingKey = 'DOCUMENT_PREFIX'");
        const prefix = prefixResult.recordset[0]?.SettingValue || 'GMRL-RCV';
        const maxResult = await pool.request()
            .input('prefix', sql.NVarChar, prefix + '-%')
            .query("SELECT MAX(CAST(RIGHT(DocumentNumber, 4) AS INT)) as maxNum FROM RCV_Inspections WHERE DocumentNumber LIKE @prefix");
        const nextNum = (maxResult.recordset[0]?.maxNum || 0) + 1;
        res.json({ success: true, documentNumber: prefix + '-' + String(nextNum).padStart(4, '0') });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Get Auditors (users with RCV roles)
// ==========================================
router.get('/api/auditors', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT DISTINCT u.Id, u.DisplayName, u.Email, r.RoleName
            FROM Users u
            INNER JOIN UserRoleAssignments ura ON u.Id = ura.UserId
            INNER JOIN UserRoles r ON ura.RoleId = r.Id
            WHERE r.RoleName IN ('Receiving Audit Admin', 'Receiving Audit Inspector')
            AND u.IsActive = 1
            ORDER BY u.DisplayName
        `);
        res.json({ success: true, auditors: result.recordset });
    } catch (error) { 
        console.error('Error fetching auditors:', error);
        res.json({ success: false, error: error.message }); 
    }
});

// ==========================================
// Cycle/Visit Info API
// ==========================================
router.get('/api/cycle/store/:storeId', async (req, res) => {
    try {
        const pool = await getPool();
        const storeId = parseInt(req.params.storeId);
        const result = await pool.request()
            .input('storeId', sql.Int, storeId)
            .query(`
                SELECT COUNT(*) as storeAuditCount,
                    MAX(Cycle) as lastCycle
                FROM RCV_Inspections WHERE StoreId = @storeId
            `);
        const { storeAuditCount, lastCycle } = result.recordset[0] || { storeAuditCount: 0, lastCycle: 0 };
        const currentCycle = (lastCycle || 0) + 1;
        // Check if there's a pending (Draft) audit in the current cycle
        const pendingResult = await pool.request()
            .input('storeId', sql.Int, storeId)
            .input('cycle', sql.Int, lastCycle || 1)
            .query("SELECT COUNT(*) as cnt FROM RCV_Inspections WHERE StoreId = @storeId AND Cycle = @cycle AND Status = 'Draft'");
        const isPendingInCurrentCycle = pendingResult.recordset[0].cnt > 0;
        res.json({ success: true, data: { storeAuditCount, currentCycle, isPendingInCurrentCycle } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Stores API (reuse Stores table)
// ==========================================
router.get('/api/stores', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                s.Id as storeId,
                s.StoreCode as storeCode,
                s.StoreName as storeName,
                s.BrandId as brandId,
                b.BrandName as brandName,
                b.BrandCode as brandCode,
                s.Location as location,
                s.StoreSize as storeSize,
                s.TemplateId as templateId,
                t.TemplateName as templateName,
                s.IsActive as isActive,
                s.CreatedDate as createdDate
            FROM Stores s
            LEFT JOIN RCV_InspectionTemplates t ON s.TemplateId = t.Id
            LEFT JOIN Brands b ON s.BrandId = b.Id
            WHERE s.IsActive = 1
            ORDER BY s.StoreName
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/stores', async (req, res) => {
    try {
        const { storeCode, storeName, brandId, location, storeSize, templateId } = req.body;
        const pool = await getPool();
        const result = await pool.request()
            .input('code', sql.NVarChar, storeCode)
            .input('name', sql.NVarChar, storeName)
            .input('brandId', sql.Int, brandId || null)
            .input('location', sql.NVarChar, location || null)
            .input('storeSize', sql.NVarChar, storeSize || null)
            .input('templateId', sql.Int, templateId || null)
            .input('createdBy', sql.NVarChar, req.currentUser?.email || 'System')
            .query(`
                INSERT INTO Stores (StoreCode, StoreName, BrandId, Location, StoreSize, TemplateId, IsActive, CreatedDate, CreatedBy)
                OUTPUT INSERTED.Id as storeId
                VALUES (@code, @name, @brandId, @location, @storeSize, @templateId, 1, GETDATE(), @createdBy)
            `);
        res.json({ success: true, data: { storeId: result.recordset[0].storeId } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/stores/:storeId', async (req, res) => {
    try {
        const { storeCode, storeName, brandId, location, storeSize, templateId, isActive } = req.body;
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.storeId)
            .input('code', sql.NVarChar, storeCode)
            .input('name', sql.NVarChar, storeName)
            .input('brandId', sql.Int, brandId || null)
            .input('location', sql.NVarChar, location || null)
            .input('storeSize', sql.NVarChar, storeSize || null)
            .input('templateId', sql.Int, templateId || null)
            .input('isActive', sql.Bit, isActive)
            .query(`UPDATE Stores SET StoreCode = @code, StoreName = @name, BrandId = @brandId, Location = @location, StoreSize = @storeSize, TemplateId = @templateId, IsActive = @isActive WHERE Id = @id`);
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/stores/:storeId', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.storeId)
            .query('UPDATE Stores SET IsActive = 0 WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/stores/available-managers', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT u.Id as userId, u.Email as email, u.DisplayName as displayName, r.RoleName as role
            FROM Users u
            JOIN UserRoleAssignments ura ON u.Id = ura.UserId
            JOIN UserRoles r ON ura.RoleId = r.Id
            WHERE u.IsActive = 1 AND u.IsApproved = 1
            AND r.RoleName IN ('Store Manager', 'Duty Manager', 'Area Manager')
            ORDER BY u.DisplayName
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/stores/manager-assignments', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT sma.StoreId as storeId, sma.UserId as userId, sma.IsPrimary as isPrimary, u.Email as email, u.DisplayName as displayName
            FROM StoreManagerAssignments sma
            JOIN Users u ON sma.UserId = u.Id
            ORDER BY sma.StoreId, sma.IsPrimary DESC
        `);
        const assignments = {};
        result.recordset.forEach(row => {
            if (!assignments[row.storeId]) assignments[row.storeId] = [];
            assignments[row.storeId].push({ userId: row.userId, email: row.email, displayName: row.displayName, isPrimary: row.isPrimary });
        });
        res.json({ success: true, data: assignments });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/stores/:storeId/managers', async (req, res) => {
    try {
        const { userIds } = req.body;
        const storeId = parseInt(req.params.storeId);
        const pool = await getPool();
        await pool.request().input('storeId', sql.Int, storeId).query('DELETE FROM StoreManagerAssignments WHERE StoreId = @storeId');
        for (let i = 0; i < userIds.length; i++) {
            await pool.request()
                .input('storeId', sql.Int, storeId)
                .input('userId', sql.Int, userIds[i])
                .input('isPrimary', sql.Bit, i === 0)
                .input('assignedBy', sql.Int, req.currentUser?.userId || null)
                .query('INSERT INTO StoreManagerAssignments (StoreId, UserId, IsPrimary, AssignedAt, AssignedBy) VALUES (@storeId, @userId, @isPrimary, GETDATE(), @assignedBy)');
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/brands', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT b.*, (SELECT COUNT(*) FROM Stores s WHERE s.BrandId = b.Id) as StoreCount FROM Brands b ORDER BY b.BrandName');
        res.json(result.recordset);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/api/store-responsibles', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT sr.*, s.StoreName, s.StoreCode, u.DisplayName as AreaManagerName, h.DisplayName as HeadOfOpsName
            FROM OE_StoreResponsibles sr
            INNER JOIN Stores s ON sr.StoreId = s.Id
            LEFT JOIN Users u ON sr.AreaManagerId = u.Id
            LEFT JOIN Users h ON sr.HeadOfOpsId = h.Id
            WHERE sr.IsActive = 1
            ORDER BY s.StoreName
        `);
        res.json(result.recordset);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/api/stores-list', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT Id, StoreName, StoreCode, Brand FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Schema Settings APIs (for system-settings page)
// ==========================================
router.get('/api/schemas', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT t.Id as schemaId, t.TemplateName as schemaName, t.Description as description, t.IsActive as isActive,
                ISNULL(s.SettingValue, '80') as overallPassingGrade,
                ISNULL(u.DisplayName, 'System') as createdBy,
                (SELECT COUNT(*) FROM RCV_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id) as sectionCount
            FROM RCV_InspectionTemplates t
            LEFT JOIN RCV_InspectionSettings s ON s.SettingKey = 'PASSING_SCORE_' + CAST(t.Id AS VARCHAR)
            LEFT JOIN Users u ON t.CreatedBy = u.Id
            WHERE t.IsActive = 1 ORDER BY t.TemplateName
        `);
        const schemas = [];
        for (const schema of result.recordset) {
            const sectionsResult = await pool.request()
                .input('templateId', sql.Int, schema.schemaId)
                .query(`SELECT ts.Id as sectionId, ts.SectionName as sectionName, ts.SectionOrder as sectionOrder, ts.SectionIcon as sectionIcon, ISNULL(ts.PassingGrade, 80) as passingGrade
                    FROM RCV_InspectionTemplateSections ts WHERE ts.TemplateId = @templateId ORDER BY ts.SectionOrder`);
            schemas.push({ ...schema, sections: sectionsResult.recordset });
        }
        res.json({ success: true, data: schemas });
    } catch (error) { res.json({ success: true, data: [] }); }
});

router.post('/api/schema/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const schemaId = req.params.schemaId;
        const { overallPassingGrade, sectionGrades } = req.body;
        await pool.request()
            .input('key', sql.NVarChar, 'PASSING_SCORE_' + schemaId)
            .input('value', sql.NVarChar, String(overallPassingGrade))
            .query(`IF EXISTS (SELECT 1 FROM RCV_InspectionSettings WHERE SettingKey = @key)
                UPDATE RCV_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                ELSE INSERT INTO RCV_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)`);
        if (sectionGrades && Array.isArray(sectionGrades)) {
            for (const sg of sectionGrades) {
                await pool.request()
                    .input('sectionId', sql.Int, sg.sectionId)
                    .input('grade', sql.Int, sg.passingGrade)
                    .query('UPDATE RCV_InspectionTemplateSections SET PassingGrade = @grade WHERE Id = @sectionId');
            }
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/schema-colors/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('schemaId', sql.Int, req.params.schemaId)
            .query("SELECT SettingKey, SettingValue FROM RCV_InspectionSettings WHERE SettingKey LIKE 'COLOR_%_' + CAST(@schemaId AS VARCHAR)");
        const colors = { passColor: '#10b981', failColor: '#ef4444', headerColor: '#1e3a5f', accentColor: '#10b981' };
        result.recordset.forEach(row => {
            const key = row.SettingKey.replace(/_\d+$/, '').replace('COLOR_', '').toLowerCase() + 'Color';
            if (colors.hasOwnProperty(key)) colors[key] = row.SettingValue;
        });
        res.json({ success: true, colors });
    } catch (error) { res.json({ success: true, colors: { passColor: '#10b981', failColor: '#ef4444', headerColor: '#1e3a5f', accentColor: '#10b981' } }); }
});

router.post('/api/schema-colors/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const schemaId = req.params.schemaId;
        for (const [key, value] of Object.entries(req.body)) {
            const settingKey = 'COLOR_' + key.replace('Color', '').toUpperCase() + '_' + schemaId;
            await pool.request()
                .input('key', sql.NVarChar, settingKey)
                .input('value', sql.NVarChar, value)
                .query(`IF EXISTS (SELECT 1 FROM RCV_InspectionSettings WHERE SettingKey = @key)
                    UPDATE RCV_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE INSERT INTO RCV_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)`);
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/schema-checklist-info/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('schemaId', sql.Int, req.params.schemaId)
            .query("SELECT SettingKey, SettingValue FROM RCV_InspectionSettings WHERE SettingKey LIKE 'CHECKLIST_%_' + CAST(@schemaId AS VARCHAR)");
        const info = { creationDate: '', revisionDate: '', edition: '', reportTitle: 'Receiving Audit Report', documentPrefix: 'GMRL-RCV' };
        result.recordset.forEach(row => {
            const key = row.SettingKey.replace(/_\d+$/, '').replace('CHECKLIST_', '');
            const camelKey = key.toLowerCase().replace(/_([a-z])/g, (m, c) => c.toUpperCase());
            if (info.hasOwnProperty(camelKey)) info[camelKey] = row.SettingValue;
        });
        res.json({ success: true, info });
    } catch (error) { res.json({ success: true, info: { creationDate: '', revisionDate: '', edition: '', reportTitle: 'Receiving Audit Report', documentPrefix: 'GMRL-RCV' } }); }
});

router.post('/api/schema-checklist-info/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const schemaId = req.params.schemaId;
        for (const [key, value] of Object.entries(req.body)) {
            const settingKey = 'CHECKLIST_' + key.replace(/([A-Z])/g, '_$1').toUpperCase() + '_' + schemaId;
            await pool.request()
                .input('key', sql.NVarChar, settingKey)
                .input('value', sql.NVarChar, value || '')
                .query(`IF EXISTS (SELECT 1 FROM RCV_InspectionSettings WHERE SettingKey = @key)
                    UPDATE RCV_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE INSERT INTO RCV_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)`);
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/schema-department-names/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('schemaId', sql.Int, req.params.schemaId)
            .query("SELECT SettingKey, SettingValue FROM RCV_InspectionSettings WHERE SettingKey LIKE 'DEPT_%_' + CAST(@schemaId AS VARCHAR)");
        const names = { Maintenance: 'Maintenance', Procurement: 'Procurement', Cleaning: 'Cleaning' };
        result.recordset.forEach(row => {
            const key = row.SettingKey.replace(/_\d+$/, '').replace('DEPT_', '');
            if (names.hasOwnProperty(key)) names[key] = row.SettingValue;
        });
        res.json({ success: true, names });
    } catch (error) { res.json({ success: true, names: { Maintenance: 'Maintenance', Procurement: 'Procurement', Cleaning: 'Cleaning' } }); }
});

router.post('/api/schema-department-names/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const schemaId = req.params.schemaId;
        for (const [key, value] of Object.entries(req.body)) {
            const settingKey = 'DEPT_' + key + '_' + schemaId;
            await pool.request()
                .input('key', sql.NVarChar, settingKey)
                .input('value', sql.NVarChar, value)
                .query(`IF EXISTS (SELECT 1 FROM RCV_InspectionSettings WHERE SettingKey = @key)
                    UPDATE RCV_InspectionSettings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE INSERT INTO RCV_InspectionSettings (SettingKey, SettingValue) VALUES (@key, @value)`);
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/section-icons/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        const { icons } = req.body;
        if (icons && Array.isArray(icons)) {
            for (const icon of icons) {
                await pool.request()
                    .input('sectionId', sql.Int, icon.sectionId)
                    .input('icon', sql.NVarChar, icon.icon)
                    .query('UPDATE RCV_InspectionTemplateSections SET SectionIcon = @icon WHERE Id = @sectionId');
            }
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Template APIs
// ==========================================
router.get('/api/templates/schemas', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT t.Id as schemaId, t.TemplateName as schemaName, t.Description as description, t.IsDefault as isDefault,
                ISNULL(u.DisplayName, 'System') as createdBy,
                (SELECT COUNT(*) FROM RCV_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id) as sectionCount
            FROM RCV_InspectionTemplates t
            LEFT JOIN Users u ON t.CreatedBy = u.Id
            WHERE t.IsActive = 1 ORDER BY t.TemplateName
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/schemas', async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const pool = await getPool();
        const result = await pool.request()
            .input('name', sql.NVarChar, schemaName)
            .input('desc', sql.NVarChar, description || null)
            .input('createdBy', sql.Int, req.currentUser?.userId || 1)
            .query('INSERT INTO RCV_InspectionTemplates (TemplateName, Description, CreatedBy) OUTPUT INSERTED.Id VALUES (@name, @desc, @createdBy)');
        res.json({ success: true, data: { schemaId: result.recordset[0].Id } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const schemaId = parseInt(req.params.schemaId);
        const pool = await getPool();
        const templateResult = await pool.request().input('id', sql.Int, schemaId)
            .query('SELECT Id as schemaId, TemplateName as schemaName, Description as description FROM RCV_InspectionTemplates WHERE Id = @id');
        if (templateResult.recordset.length === 0) { return res.json({ success: false, error: 'Template not found' }); }
        const template = templateResult.recordset[0];
        const sectionsResult = await pool.request().input('templateId', sql.Int, schemaId)
            .query('SELECT Id as sectionId, SectionName as sectionName, SectionIcon as sectionIcon, SectionOrder as sectionNumber FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId AND IsActive = 1 ORDER BY SectionOrder');
        template.sections = [];
        for (const section of sectionsResult.recordset) {
            const itemsResult = await pool.request().input('sectionId', sql.Int, section.sectionId)
                .query(`SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, AnswerOptions as answer, Criteria as cr, Quantity as quantity, DefaultSeverity as defaultSeverity, IsQuantitative as isQuantitative, Range1From as range1From, Range1To as range1To, Range2From as range2From, Range2To as range2To, Range3From as range3From
                    FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1
                    ORDER BY TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT), TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)`);
            section.items = itemsResult.recordset;
            template.sections.push(section);
        }
        res.json({ success: true, data: template });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const pool = await getPool();
        await pool.request().input('id', sql.Int, req.params.schemaId).input('name', sql.NVarChar, schemaName).input('desc', sql.NVarChar, description || null)
            .query('UPDATE RCV_InspectionTemplates SET TemplateName = @name, Description = @desc, UpdatedAt = GETDATE() WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().input('id', sql.Int, req.params.schemaId).query('UPDATE RCV_InspectionTemplates SET IsActive = 0 WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Template Sections
router.get('/api/templates/schemas/:schemaId/sections', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().input('templateId', sql.Int, req.params.schemaId)
            .query(`
                SELECT ts.Id as sectionId, ts.SectionName as sectionName, ts.SectionIcon as sectionIcon, ts.SectionOrder as sectionNumber,
                    (SELECT COUNT(*) FROM RCV_InspectionTemplateItems ti WHERE ti.SectionId = ts.Id) as itemCount
                FROM RCV_InspectionTemplateSections ts 
                WHERE ts.TemplateId = @templateId AND ts.IsActive = 1 
                ORDER BY ts.SectionOrder
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/schemas/:schemaId/sections', async (req, res) => {
    try {
        const { sectionName, sectionIcon } = req.body;
        const pool = await getPool();
        const maxOrder = await pool.request().input('templateId', sql.Int, req.params.schemaId)
            .query('SELECT ISNULL(MAX(SectionOrder), 0) + 1 as nextOrder FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId');
        const result = await pool.request()
            .input('templateId', sql.Int, req.params.schemaId)
            .input('name', sql.NVarChar, sectionName)
            .input('icon', sql.NVarChar, sectionIcon || '≡ƒôï')
            .input('order', sql.Int, maxOrder.recordset[0].nextOrder)
            .query('INSERT INTO RCV_InspectionTemplateSections (TemplateId, SectionName, SectionIcon, SectionOrder) OUTPUT INSERTED.Id VALUES (@templateId, @name, @icon, @order)');
        res.json({ success: true, data: { sectionId: result.recordset[0].Id } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const { sectionName, sectionIcon, sectionNumber } = req.body;
        const pool = await getPool();
        await pool.request().input('id', sql.Int, req.params.sectionId).input('name', sql.NVarChar, sectionName).input('icon', sql.NVarChar, sectionIcon).input('order', sql.Int, sectionNumber || null)
            .query('UPDATE RCV_InspectionTemplateSections SET SectionName = @name, SectionIcon = ISNULL(@icon, SectionIcon), SectionOrder = ISNULL(@order, SectionOrder) WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().input('id', sql.Int, req.params.sectionId).query('UPDATE RCV_InspectionTemplateSections SET IsActive = 0 WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Template Items
router.get('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().input('sectionId', sql.Int, req.params.sectionId)
            .query(`SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, AnswerOptions as answer, Criteria as cr, Quantity as quantity, DefaultSeverity as defaultSeverity, IsQuantitative as isQuantitative
                FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1
                ORDER BY TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT), TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)`);
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const { referenceValue, title, coeff, quantity, answer, cr, defaultSeverity, isQuantitative } = req.body;
        const pool = await getPool();
        const sectionInfo = await pool.request().input('sectionId', sql.Int, req.params.sectionId).query('SELECT TemplateId FROM RCV_InspectionTemplateSections WHERE Id = @sectionId');
        const maxOrder = await pool.request().input('sectionId', sql.Int, req.params.sectionId).query('SELECT ISNULL(MAX(ItemOrder), 0) + 1 as nextOrder FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId');
        const result = await pool.request()
            .input('sectionId', sql.Int, req.params.sectionId)
            .input('ref', sql.NVarChar, referenceValue || null)
            .input('question', sql.NVarChar, title)
            .input('coeff', sql.Decimal(5,2), coeff || 1)
            .input('quantity', sql.Int, quantity || null)
            .input('answer', sql.NVarChar, answer || 'Yes,Partially,No,NA')
            .input('cr', sql.NVarChar, cr || null)
            .input('defaultSeverity', sql.NVarChar, defaultSeverity || null)
            .input('isQuantitative', sql.Bit, isQuantitative || 0)
            .input('order', sql.Int, maxOrder.recordset[0].nextOrder)
            .query('INSERT INTO RCV_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, DefaultSeverity, IsQuantitative, ItemOrder) OUTPUT INSERTED.Id VALUES (@sectionId, @ref, @question, @coeff, @quantity, @answer, @cr, @defaultSeverity, @isQuantitative, @order)');
        res.json({ success: true, data: { itemId: result.recordset[0].Id } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/sections/:sectionId/items/bulk', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) return res.json({ success: false, error: 'No items provided' });
        const pool = await getPool();
        const existingResult = await pool.request().input('sectionId', sql.Int, req.params.sectionId)
            .query('SELECT ReferenceValue FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1');
        const existingRefs = new Set(existingResult.recordset.map(r => r.ReferenceValue?.toLowerCase()));
        const maxOrderResult = await pool.request().input('sectionId', sql.Int, req.params.sectionId).query('SELECT ISNULL(MAX(ItemOrder), 0) as maxOrder FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId');
        let currentOrder = maxOrderResult.recordset[0].maxOrder;
        let imported = 0, skipped = 0;
        for (const item of items) {
            if (item.referenceValue && existingRefs.has(item.referenceValue.toLowerCase())) { skipped++; continue; }
            currentOrder++;
            await pool.request()
                .input('sectionId', sql.Int, req.params.sectionId)
                .input('ref', sql.NVarChar, item.referenceValue || null)
                .input('question', sql.NVarChar, item.title || item.referenceValue || 'Untitled')
                .input('coeff', sql.Decimal(5,2), item.coeff || 1)
                .input('answer', sql.NVarChar, item.answer || 'Yes,Partially,No,NA')
                .input('cr', sql.NVarChar, item.cr || null)
                .input('order', sql.Int, currentOrder)
                .query('INSERT INTO RCV_InspectionTemplateItems (SectionId, ReferenceValue, Question, Coefficient, AnswerOptions, Criteria, ItemOrder) VALUES (@sectionId, @ref, @question, @coeff, @answer, @cr, @order)');
            imported++;
        }
        res.json({ success: true, data: { imported, skipped } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/templates/items/:itemId', async (req, res) => {
    try {
        const { referenceValue, title, coeff, quantity, answer, cr, defaultSeverity, isQuantitative } = req.body;
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.itemId)
            .input('ref', sql.NVarChar, referenceValue).input('question', sql.NVarChar, title).input('coeff', sql.Decimal(5,2), coeff || 1)
            .input('quantity', sql.Int, quantity || null).input('answer', sql.NVarChar, answer).input('cr', sql.NVarChar, cr || null)
            .input('defaultSeverity', sql.NVarChar, defaultSeverity || null).input('isQuantitative', sql.Bit, isQuantitative || 0)
            .query('UPDATE RCV_InspectionTemplateItems SET ReferenceValue=@ref, Question=@question, Coefficient=@coeff, Quantity=@quantity, AnswerOptions=@answer, Criteria=@cr, DefaultSeverity=@defaultSeverity, IsQuantitative=@isQuantitative WHERE Id=@id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/templates/items/:itemId', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().input('id', sql.Int, req.params.itemId).query('UPDATE RCV_InspectionTemplateItems SET IsActive = 0 WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Inspection CRUD
// ==========================================
router.post('/api/inspections', async (req, res) => {
    try {
        const { storeId, storeName, documentNumber, inspectionDate, inspectors, accompaniedBy, templateId, timeIn } = req.body;
        const userId = req.currentUser?.userId || 1;
        const pool = await getPool();

        // Determine cycle number: count previous audits for this store + 1
        const cycleResult = await pool.request().input('storeId', sql.Int, storeId)
            .query('SELECT COUNT(*) as cnt FROM RCV_Inspections WHERE StoreId = @storeId');
        const cycle = (cycleResult.recordset[0]?.cnt || 0) + 1;

        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .input('storeId', sql.Int, storeId).input('storeName', sql.NVarChar, storeName)
            .input('inspectionDate', sql.Date, inspectionDate)
            .input('timeIn', sql.NVarChar, timeIn || null)
            .input('inspectors', sql.NVarChar, inspectors)
            .input('accompaniedBy', sql.NVarChar, accompaniedBy || null)
            .input('cycle', sql.Int, cycle)
            .input('year', sql.Int, new Date(inspectionDate).getFullYear())
            .input('templateId', sql.Int, templateId || null)
            .input('createdBy', sql.Int, userId)
            .query(`INSERT INTO RCV_Inspections (DocumentNumber, StoreId, StoreName, InspectionDate, TimeIn, Inspectors, AccompaniedBy, Cycle, Year, TemplateId, Status, CreatedBy, CreatedAt)
                OUTPUT INSERTED.Id VALUES (@documentNumber, @storeId, @storeName, @inspectionDate, @timeIn, @inspectors, @accompaniedBy, @cycle, @year, @templateId, 'Draft', @createdBy, GETDATE())`);
        const inspectionId = result.recordset[0].Id;

        // Copy template sections & items
        let useTemplateId = templateId;
        if (!useTemplateId) {
            const def = await pool.request().query('SELECT TOP 1 Id FROM RCV_InspectionTemplates WHERE IsDefault = 1 AND IsActive = 1');
            useTemplateId = def.recordset[0]?.Id;
        }
        if (useTemplateId) {
            const templateSections = await pool.request().input('templateId', sql.Int, useTemplateId)
                .query('SELECT Id, SectionName, SectionIcon, SectionOrder FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId AND IsActive = 1 ORDER BY SectionOrder');
            for (const section of templateSections.recordset) {
                await pool.request()
                    .input('inspectionId', sql.Int, inspectionId).input('sectionName', sql.NVarChar, section.SectionName)
                    .input('sectionIcon', sql.NVarChar, section.SectionIcon).input('sectionOrder', sql.Int, section.SectionOrder)
                    .query('INSERT INTO RCV_InspectionSections (InspectionId, SectionName, SectionIcon, SectionOrder) VALUES (@inspectionId, @sectionName, @sectionIcon, @sectionOrder)');
                const templateItems = await pool.request().input('sectionId', sql.Int, section.Id)
                    .query('SELECT ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, ItemOrder, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From, DefaultSeverity FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1 ORDER BY ItemOrder');
                for (const item of templateItems.recordset) {
                    await pool.request()
                        .input('inspectionId', sql.Int, inspectionId).input('sectionName', sql.NVarChar, section.SectionName)
                        .input('sectionOrder', sql.Int, section.SectionOrder).input('itemOrder', sql.Int, item.ItemOrder)
                        .input('referenceValue', sql.NVarChar, item.ReferenceValue).input('question', sql.NVarChar, item.Question)
                        .input('coefficient', sql.Decimal(5,2), item.Coefficient || 1).input('quantity', sql.Int, item.Quantity || null)
                        .input('answerOptions', sql.NVarChar, item.AnswerOptions || 'Yes,Partially,No,NA')
                        .input('criteria', sql.NVarChar, item.Criteria).input('defaultSeverity', sql.NVarChar, item.DefaultSeverity || null)
                        .input('isQuantitative', sql.Bit, item.IsQuantitative || 0)
                        .input('range1From', sql.Int, item.Range1From || null).input('range1To', sql.Int, item.Range1To || null)
                        .input('range2From', sql.Int, item.Range2From || null).input('range2To', sql.Int, item.Range2To || null)
                        .input('range3From', sql.Int, item.Range3From || null)
                        .query(`INSERT INTO RCV_InspectionItems (InspectionId, SectionName, SectionOrder, ItemOrder, ReferenceValue, Question, Coefficient, Quantity, AnswerOptions, Criteria, DefaultSeverity, IsQuantitative, Range1From, Range1To, Range2From, Range2To, Range3From)
                            VALUES (@inspectionId, @sectionName, @sectionOrder, @itemOrder, @referenceValue, @question, @coefficient, @quantity, @answerOptions, @criteria, @defaultSeverity, @isQuantitative, @range1From, @range1To, @range2From, @range2To, @range3From)`);
                }
            }
        }
        res.json({ success: true, data: { id: inspectionId, documentNumber, cycle } });
    } catch (error) { console.error('Error creating inspection:', error); res.json({ success: false, error: error.message }); }
});

// List audits (must be before :auditId route)
// List audits (must be before :auditId route)
router.get('/api/audits/list', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                i.Id as AuditID, 
                i.DocumentNumber, 
                i.StoreName, 
                i.InspectionDate, 
                i.Inspectors as Auditors, 
                i.Status, 
                i.Score as TotalScore, 
                i.Cycle as AuditCycle, 
                i.Year as AuditYear, 
                i.CreatedAt,
                t.TemplateName as ChecklistEdition,
                b.BrandName,
                (SELECT COUNT(*) FROM RCV_InspectionActionItems a WHERE a.InspectionId = i.Id) as ActionItemsTotal,
                (SELECT COUNT(*) FROM RCV_InspectionActionItems a WHERE a.InspectionId = i.Id AND a.Action IS NOT NULL AND a.Action != '') as ActionItemsFilled,
                (SELECT MAX(a.UpdatedAt) FROM RCV_InspectionActionItems a WHERE a.InspectionId = i.Id AND a.Action IS NOT NULL AND a.Action != '') as ActionPlanLastUpdated
            FROM RCV_Inspections i
            LEFT JOIN RCV_InspectionTemplates t ON i.TemplateId = t.Id
            LEFT JOIN Stores s ON i.StoreId = s.Id
            LEFT JOIN Brands b ON s.BrandId = b.Id
            ORDER BY i.CreatedAt DESC
        `);
        res.json({ audits: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Serve report files (must be before :auditId route)
router.get('/api/audits/reports/:fileName', (req, res) => {
    const { fileName } = req.params;
    const reportsDir = path.join(__dirname, '..', '..', 'reports', 'receiving-audit');
    const filePath = path.join(reportsDir, fileName);
    if (!filePath.startsWith(reportsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Report not found' });
    }
});

// Get audit details
router.get('/api/audits/:auditId', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();
        const auditResult = await pool.request().input('id', sql.Int, auditId)
            .query(`SELECT i.Id, i.DocumentNumber, i.StoreId, i.StoreName, i.InspectionDate, i.TimeIn, i.TimeOut, i.Inspectors, i.AccompaniedBy, i.Cycle, i.Year, i.Status, i.Score, i.TotalPoints, i.MaxPoints, i.Comments, i.TemplateId, i.CreatedBy, i.CreatedAt, i.CompletedAt,
                s.StoreCode FROM RCV_Inspections i LEFT JOIN Stores s ON i.StoreId = s.Id WHERE i.Id = @id`);
        if (auditResult.recordset.length === 0) { return res.status(404).json({ success: false, error: 'Audit not found' }); }
        const audit = auditResult.recordset[0];
        const sectionsResult = await pool.request().input('inspectionId', sql.Int, auditId)
            .query('SELECT Id as sectionId, SectionName as sectionName, SectionOrder as sectionNumber, SectionIcon as sectionIcon, Score as sectionScore, TotalPoints as totalPoints, MaxPoints as maxPoints FROM RCV_InspectionSections WHERE InspectionId = @inspectionId ORDER BY SectionOrder');
        const sections = [];
        for (const section of sectionsResult.recordset) {
            const itemsResult = await pool.request().input('inspectionId', sql.Int, auditId).input('sectionName', sql.NVarChar, section.sectionName)
                .query(`SELECT Id as responseId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, Quantity as quantity, ActualQuantity as actualQuantity, AnswerOptions as answerOptions, Answer as selectedChoice, Score as value, Finding as finding, Comment as comment, CorrectedAction as cr, Priority as priority, DefaultSeverity as defaultSeverity, HasPicture as hasPicture, Escalate as escalate, Department as department, Criteria as criteria, IsQuantitative as isQuantitative, Range1From as range1From, Range1To as range1To, Range2From as range2From, Range2To as range2To, Range3From as range3From
                    FROM RCV_InspectionItems WHERE InspectionId = @inspectionId AND SectionName = @sectionName
                    ORDER BY TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT), TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)`);
            section.items = itemsResult.recordset;
            sections.push(section);
        }
        res.json({ success: true, data: { auditId: audit.Id, documentNumber: audit.DocumentNumber, storeId: audit.StoreId, storeCode: audit.StoreCode || '', storeName: audit.StoreName, auditDate: audit.InspectionDate, auditors: audit.Inspectors, accompaniedBy: audit.AccompaniedBy, cycle: audit.Cycle, year: audit.Year, status: audit.Status, totalScore: audit.Score, templateId: audit.TemplateId, sections } });
    } catch (error) { console.error('Error fetching audit:', error); res.status(500).json({ success: false, error: error.message }); }
});

// Update response
router.put('/api/audits/response/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const { selectedChoice, coeff, finding, comment, cr, priority, escalate, department } = req.body;
        const pool = await getPool();
        const currentResult = await pool.request().input('id', sql.Int, responseId)
            .query('SELECT Answer, Score, Finding, Comment, CorrectedAction, Priority, Escalate, Department FROM RCV_InspectionItems WHERE Id = @id');
        const current = currentResult.recordset[0] || {};
        let value = 0;
        const choice = selectedChoice !== undefined ? selectedChoice : current.Answer;
        const coefficient = coeff !== undefined ? coeff : 1;
        if (choice === 'Yes') value = coefficient;
        else if (choice === 'Partially') value = coefficient * 0.5;
        const finalEscalate = escalate !== undefined ? (escalate ? 1 : 0) : current.Escalate;
        const finalDepartment = department !== undefined ? (department || null) : current.Department;
        const finalFinding = finding !== undefined ? (finding || null) : current.Finding;
        const finalComment = comment !== undefined ? (comment || null) : current.Comment;
        const finalCr = cr !== undefined ? (cr || null) : current.CorrectedAction;
        const finalPriority = priority !== undefined ? (priority || null) : current.Priority;
        await pool.request().input('id', sql.Int, responseId)
            .input('selectedChoice', sql.NVarChar, choice || null).input('value', sql.Decimal(5,2), value)
            .input('finding', sql.NVarChar, finalFinding).input('comment', sql.NVarChar, finalComment)
            .input('cr', sql.NVarChar, finalCr).input('priority', sql.NVarChar, finalPriority)
            .input('escalate', sql.Bit, finalEscalate).input('department', sql.NVarChar, finalDepartment)
            .query('UPDATE RCV_InspectionItems SET Answer=@selectedChoice, Score=@value, Finding=@finding, Comment=@comment, CorrectedAction=@cr, Priority=@priority, Escalate=@escalate, Department=@department WHERE Id=@id');
        res.json({ success: true, data: { score: value } });
    } catch (error) { console.error('Error updating response:', error); res.status(500).json({ success: false, error: error.message }); }
});

// Upload picture (file storage with metadata in DB)
router.post('/api/audits/pictures', auditUpload.single('picture'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
        const { responseId, auditId, pictureType } = req.body;
        const fullPath = path.join(uploadDir, req.file.filename);
        await compressImage(fullPath);
        const stats = fs.statSync(fullPath);
        const filePath = '/uploads/receiving-audit/' + req.file.filename;
        const pool = await getPool();
        const result = await pool.request()
            .input('responseId', sql.Int, responseId).input('auditId', sql.Int, auditId)
            .input('fileName', sql.NVarChar, req.file.filename).input('originalName', sql.NVarChar, req.file.originalname)
            .input('contentType', sql.NVarChar, req.file.mimetype).input('pictureType', sql.NVarChar, pictureType)
            .input('filePath', sql.NVarChar, filePath).input('fileSize', sql.Int, stats.size)
            .query('INSERT INTO RCV_InspectionPictures (ItemId, InspectionId, FileName, OriginalName, ContentType, PictureType, FilePath, FileSize, CreatedAt) OUTPUT INSERTED.Id as pictureId VALUES (@responseId, @auditId, @fileName, @originalName, @contentType, @pictureType, @filePath, @fileSize, GETDATE())');
        await pool.request().input('id', sql.Int, responseId).query('UPDATE RCV_InspectionItems SET HasPicture = 1 WHERE Id = @id');
        res.json({ success: true, data: { pictureId: result.recordset[0].pictureId, filePath } });
    } catch (error) { console.error('Error uploading picture:', error); res.status(500).json({ success: false, error: error.message }); }
});

// Get pictures for item
router.get('/api/audits/pictures/:responseId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().input('responseId', sql.Int, req.params.responseId)
            .query('SELECT Id as pictureId, FileName as fileName, OriginalName as originalName, FilePath as filePath, PictureType as pictureType, FileSize as fileSize, CreatedAt as createdAt FROM RCV_InspectionPictures WHERE ItemId = @responseId ORDER BY CreatedAt');
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Delete picture
router.delete('/api/audits/pictures/:pictureId', async (req, res) => {
    try {
        const pool = await getPool();
        const pic = await pool.request().input('id', sql.Int, req.params.pictureId).query('SELECT FileName, ItemId FROM RCV_InspectionPictures WHERE Id = @id');
        if (pic.recordset.length > 0) {
            const filePath = path.join(uploadDir, pic.recordset[0].FileName);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await pool.request().input('id', sql.Int, req.params.pictureId).query('DELETE FROM RCV_InspectionPictures WHERE Id = @id');
            const remaining = await pool.request().input('itemId', sql.Int, pic.recordset[0].ItemId).query('SELECT COUNT(*) as cnt FROM RCV_InspectionPictures WHERE ItemId = @itemId');
            if (remaining.recordset[0].cnt === 0) await pool.request().input('itemId', sql.Int, pic.recordset[0].ItemId).query('UPDATE RCV_InspectionItems SET HasPicture = 0 WHERE Id = @itemId');
        }
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Complete audit
router.post('/api/audits/:auditId/complete', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();
        const scoreResult = await pool.request().input('auditId', sql.Int, auditId)
            .query("SELECT ISNULL(SUM(Score), 0) as totalPoints, ISNULL(SUM(Coefficient), 0) as maxPoints FROM RCV_InspectionItems WHERE InspectionId = @auditId AND Answer IS NOT NULL AND Answer != 'NA'");
        const { totalPoints, maxPoints } = scoreResult.recordset[0];
        const totalScore = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
        // Get current time for TimeOut
        const now = new Date();
        const timeOut = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        await pool.request().input('auditId', sql.Int, auditId).input('score', sql.Decimal(5,2), totalScore)
            .input('totalPoints', sql.Decimal(10,2), totalPoints).input('maxPoints', sql.Decimal(10,2), maxPoints)
            .input('timeOut', sql.NVarChar, timeOut)
            .query("UPDATE RCV_Inspections SET Status = 'Completed', Score = @score, TotalPoints = @totalPoints, MaxPoints = @maxPoints, TimeOut = @timeOut, CompletedAt = GETDATE(), UpdatedAt = GETDATE() WHERE Id = @auditId");
        // Auto-create action items from findings
        const findingsResult = await pool.request().input('auditId', sql.Int, auditId)
            .query("SELECT InspectionId, ReferenceValue, SectionName, Finding, CorrectedAction as SuggestedAction, Priority, Department FROM RCV_InspectionItems WHERE InspectionId = @auditId AND ((Finding IS NOT NULL AND Finding != '') OR Escalate = 1)");
        let actionItemsCreated = 0;
        for (const finding of findingsResult.recordset) {
            const exists = await pool.request().input('inspectionId', sql.Int, auditId).input('referenceValue', sql.NVarChar, finding.ReferenceValue).input('sectionName', sql.NVarChar, finding.SectionName)
                .query('SELECT Id FROM RCV_InspectionActionItems WHERE InspectionId = @inspectionId AND ReferenceValue = @referenceValue AND SectionName = @sectionName');
            if (exists.recordset.length === 0) {
                await pool.request()
                    .input('inspectionId', sql.Int, auditId).input('referenceValue', sql.NVarChar, finding.ReferenceValue)
                    .input('sectionName', sql.NVarChar, finding.SectionName).input('finding', sql.NVarChar, finding.Finding)
                    .input('suggestedAction', sql.NVarChar, finding.SuggestedAction).input('priority', sql.NVarChar, finding.Priority || 'Medium')
                    .input('department', sql.NVarChar, finding.Department)
                    .query("INSERT INTO RCV_InspectionActionItems (InspectionId, ReferenceValue, SectionName, Finding, SuggestedAction, Priority, Status, Department, CreatedAt) VALUES (@inspectionId, @referenceValue, @sectionName, @finding, @suggestedAction, @priority, 'Open', @department, GETDATE())");
                actionItemsCreated++;
            }
        }
        res.json({ success: true, data: { totalScore, actionItemsCreated } });
    } catch (error) { console.error('Error completing audit:', error); res.status(500).json({ success: false, error: error.message }); }
});

// Delete audit
router.delete('/api/audits/:auditId', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionPictures WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionActionItems WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionItems WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionSections WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_Inspections WHERE Id = @id');
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Action plan by document number (must be before :inspectionId route)
router.get('/api/action-plan/by-doc/:documentNumber', async (req, res) => {
    try {
        const { documentNumber } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .query(`
                SELECT 
                    a.Id, a.ReferenceValue, a.SectionName, a.Finding, 
                    a.SuggestedAction, a.Action as ActionTaken, a.Responsible as PersonInCharge, 
                    a.Deadline, a.Priority, a.Status, a.Department,
                    a.CompletionDate, a.CompletionNotes, a.BeforeImageUrl, a.AfterImageUrl
                FROM RCV_InspectionActionItems a
                INNER JOIN RCV_Inspections i ON a.InspectionId = i.Id
                WHERE i.DocumentNumber = @documentNumber
                ORDER BY a.Priority DESC, a.ReferenceValue
            `);
        res.json({ success: true, actions: result.recordset });
    } catch (error) {
        console.error('Error fetching action plan by doc:', error);
        res.json({ success: false, error: error.message });
    }
});

// Save action plan
router.post('/api/action-plan/save', async (req, res) => {
    try {
        const { documentNumber, actions } = req.body;
        const pool = await getPool();
        
        // Get inspection ID from document number
        const inspResult = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .query('SELECT Id FROM RCV_Inspections WHERE DocumentNumber = @documentNumber');
        
        if (inspResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        const inspectionId = inspResult.recordset[0].Id;
        
        // Update each action item
        for (const action of actions) {
            await pool.request()
                .input('inspectionId', sql.Int, inspectionId)
                .input('referenceValue', sql.NVarChar, action.referenceValue)
                .input('action', sql.NVarChar, action.actionTaken || null)
                .input('responsible', sql.NVarChar, action.personInCharge || null)
                .input('deadline', sql.Date, action.deadline || null)
                .input('status', sql.NVarChar, action.status || 'Pending')
                .query(`
                    UPDATE RCV_InspectionActionItems 
                    SET Action = @action, 
                        Responsible = @responsible, 
                        Deadline = @deadline, 
                        Status = @status,
                        UpdatedAt = GETDATE()
                    WHERE InspectionId = @inspectionId AND ReferenceValue = @referenceValue
                `);
        }
        
        res.json({ success: true, message: 'Action plan saved successfully' });
    } catch (error) {
        console.error('Error saving action plan:', error);
        res.json({ success: false, error: error.message });
    }
});

// Action plan by inspection ID
router.get('/api/action-plan/:inspectionId', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().input('inspectionId', sql.Int, req.params.inspectionId)
            .query('SELECT Id, ReferenceValue, SectionName, Finding, SuggestedAction, Action, Responsible, Department, Deadline, Priority, Status, CompletionDate, CompletionNotes, BeforeImageUrl, AfterImageUrl, CreatedAt FROM RCV_InspectionActionItems WHERE InspectionId = @inspectionId ORDER BY Priority DESC, ReferenceValue');
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Report APIs
// ==========================================

// Check for published report
router.get('/api/audits/:auditId/published-report', async (req, res) => {
    try {
        const { auditId } = req.params;
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'receiving-audit');
        if (fs.existsSync(reportsDir)) {
            const files = fs.readdirSync(reportsDir);
            const reportFile = files.find(f => f.includes(`audit-${auditId}`) && f.endsWith('.html'));
            if (reportFile) {
                return res.json({ success: true, fileName: reportFile });
            }
        }
        res.json({ success: false, message: 'No published report found' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Generate full report
router.post('/api/audits/:auditId/generate-report', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();

        // 1. Get audit header
        const auditResult = await pool.request().input('auditId', sql.Int, auditId)
            .query(`SELECT i.*, t.TemplateName FROM RCV_Inspections i LEFT JOIN RCV_InspectionTemplates t ON i.TemplateId = t.Id WHERE i.Id = @auditId`);
        if (auditResult.recordset.length === 0) return res.status(404).json({ success: false, error: 'Audit not found' });
        const audit = auditResult.recordset[0];

        // 2. Get all items
        const itemsResult = await pool.request().input('auditId', sql.Int, auditId)
            .query('SELECT * FROM RCV_InspectionItems WHERE InspectionId = @auditId ORDER BY SectionOrder, ItemOrder');

        // 3. Group by section
        const sectionMap = new Map();
        for (const item of itemsResult.recordset) {
            const sectionName = item.SectionName || 'General';
            if (!sectionMap.has(sectionName)) {
                sectionMap.set(sectionName, { SectionName: sectionName, SectionOrder: item.SectionOrder || 0, items: [], earnedScore: 0, maxScore: 0 });
            }
            const section = sectionMap.get(sectionName);
            section.items.push(item);
            if (item.Answer && item.Answer !== 'NA') {
                section.maxScore += parseFloat(item.Coefficient || 0);
                section.earnedScore += parseFloat(item.Score || 0);
            }
        }
        const sections = Array.from(sectionMap.values()).sort((a, b) => a.SectionOrder - b.SectionOrder);

        // Sort items within sections
        for (const section of sections) {
            section.items.sort((a, b) => {
                const partsA = (a.ReferenceValue || '').split('.').map(p => parseInt(p) || 0);
                const partsB = (b.ReferenceValue || '').split('.').map(p => parseInt(p) || 0);
                for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                    if ((partsA[i] || 0) !== (partsB[i] || 0)) return (partsA[i] || 0) - (partsB[i] || 0);
                }
                return 0;
            });
        }

        // 4. Findings
        const findings = itemsResult.recordset.filter(item => item.Answer === 'No' || item.Answer === 'Partially' || item.Finding);

        // 5. Pictures (direct uploads + gallery links)
        const picturesResult = await pool.request().input('auditId', sql.Int, auditId)
            .query('SELECT p.Id, p.ItemId, p.FileName, p.PictureType, p.FilePath, p.OriginalName FROM RCV_InspectionPictures p WHERE p.InspectionId = @auditId ORDER BY p.ItemId, p.Id');
        const galleryResult = await pool.request().input('auditId', sql.Int, auditId)
            .query('SELECT l.ResponseId as ItemId, l.PictureType, g.Id, g.FileName, g.FilePath, g.OriginalName FROM RCV_InspectionGalleryLinks l INNER JOIN RCV_InspectionGallery g ON g.Id = l.GalleryPictureId WHERE g.InspectionId = @auditId ORDER BY l.ResponseId');

        // Build pictures by item
        const picturesByItem = {};
        for (const pic of picturesResult.recordset) {
            if (!picturesByItem[pic.ItemId]) picturesByItem[pic.ItemId] = [];
            picturesByItem[pic.ItemId].push({ id: pic.Id, fileName: pic.OriginalName || pic.FileName, pictureType: pic.PictureType || 'issue', dataUrl: pic.FilePath });
        }
        for (const pic of galleryResult.recordset) {
            if (!picturesByItem[pic.ItemId]) picturesByItem[pic.ItemId] = [];
            picturesByItem[pic.ItemId].push({ id: 'gallery-' + pic.Id, fileName: pic.OriginalName || pic.FileName, pictureType: pic.PictureType || 'Finding', dataUrl: pic.FilePath, isGallery: true });
        }

        // 6. Fridge readings
        const fridgeResult = await pool.request().input('auditId', sql.Int, auditId)
            .query(`SELECT fr.Id, fr.ItemId, fr.DisplayTemp, fr.ProbeTemp, fr.Issue, fr.IsCompliant, fr.Picture,
                    i.SectionName, i.ReferenceValue
                    FROM RCV_FridgeReadings fr LEFT JOIN RCV_InspectionItems i ON fr.ItemId = i.Id
                    WHERE fr.InspectionId = @auditId AND fr.ItemId IS NOT NULL ORDER BY fr.Id`);

        // 7. Calculate overall score
        const totalEarned = sections.reduce((sum, s) => sum + s.earnedScore, 0);
        const totalMax = sections.reduce((sum, s) => sum + s.maxScore, 0);
        const overallScore = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

        // 8. Get settings for threshold
        const settingsResult = await pool.request().input('templateId', sql.Int, audit.TemplateId)
            .query(`SELECT ISNULL(s.SettingValue, '80') as PassingGrade FROM RCV_InspectionSettings s
                    WHERE s.SettingKey = 'PASSING_SCORE_' + CAST(@templateId AS VARCHAR)
                    UNION ALL SELECT ISNULL(s.SettingValue, '80') FROM RCV_InspectionSettings s WHERE s.SettingKey = 'PASSING_SCORE'`);
        const threshold = settingsResult.recordset.length > 0
            ? parseInt(settingsResult.recordset[0].PassingGrade) || 80 : 80;

        // 9. Section-level passing grades
        const sectionGradesResult = await pool.request().input('templateId', sql.Int, audit.TemplateId)
            .query(`SELECT SectionName, ISNULL(PassingGrade, 80) as PassingGrade FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId`);
        const sectionPassingGrades = {};
        for (const sg of sectionGradesResult.recordset) sectionPassingGrades[sg.SectionName] = sg.PassingGrade;
        for (const section of sections) section.PassingGrade = sectionPassingGrades[section.SectionName] || threshold;

        // 10. Historical audits for cycle comparison
        const historicalResult = await pool.request().input('storeId', sql.Int, audit.StoreId).input('currentAuditId', sql.Int, auditId)
            .query(`SELECT i.Id, i.DocumentNumber, i.InspectionDate, i.CompletedAt,
                    CAST(ROUND((i.TotalPoints / NULLIF(i.MaxPoints, 0)) * 100, 0) AS INT) as TotalScore
                    FROM RCV_Inspections i WHERE i.StoreId = @storeId AND i.Status = 'Completed'
                    ORDER BY i.CompletedAt ASC, i.Id ASC`);

        const historicalAuditsWithCycles = [];
        let cycleNumber = 0;
        for (const ha of historicalResult.recordset) {
            cycleNumber++;
            const sectionScoresResult = await pool.request().input('inspectionId', sql.Int, ha.Id)
                .query(`SELECT SectionName, SUM(Score) as EarnedScore,
                        SUM(CASE WHEN Answer != 'NA' THEN Coefficient ELSE 0 END) as MaxScore,
                        CAST(ROUND((SUM(Score) / NULLIF(SUM(CASE WHEN Answer != 'NA' THEN Coefficient ELSE 0 END), 0)) * 100, 0) AS INT) as Percentage
                        FROM RCV_InspectionItems WHERE InspectionId = @inspectionId GROUP BY SectionName`);
            const sectionScores = {};
            for (const ss of sectionScoresResult.recordset) sectionScores[ss.SectionName] = ss.Percentage || 0;
            historicalAuditsWithCycles.push({
                auditId: ha.Id, documentNumber: ha.DocumentNumber, inspectionDate: ha.InspectionDate,
                totalScore: ha.TotalScore || 0, cycle: cycleNumber, cycleLabel: `C${cycleNumber} (1/1)`,
                sectionScores, isCurrent: ha.Id === parseInt(auditId)
            });
        }
        const currentIndex = historicalAuditsWithCycles.findIndex(a => a.isCurrent);
        const startIdx = Math.max(0, currentIndex - 5);
        const cycleAudits = historicalAuditsWithCycles.slice(startIdx, currentIndex + 1);

        // 11. Get repetitive findings across all cycles for this store
        const repetitiveFindingsResult = await pool.request().input('storeId', sql.Int, audit.StoreId)
            .query(`
                SELECT 
                    it.ReferenceValue,
                    it.Question,
                    it.SectionName,
                    COUNT(*) as OccurrenceCount,
                    STRING_AGG(CONCAT('C', i.Cycle, ': ', it.Answer), ' | ') WITHIN GROUP (ORDER BY i.InspectionDate) as CycleHistory
                FROM RCV_InspectionItems it
                INNER JOIN RCV_Inspections i ON it.InspectionId = i.Id
                WHERE i.StoreId = @storeId 
                    AND i.Status = 'Completed'
                    AND (it.Answer = 'No' OR it.Answer = 'Partially')
                GROUP BY it.ReferenceValue, it.Question, it.SectionName
                HAVING COUNT(*) >= 2
                ORDER BY COUNT(*) DESC, it.ReferenceValue
            `);
        const repetitiveFindings = repetitiveFindingsResult.recordset;
        console.log(`[RCV Report] Store ${audit.StoreId} - Found ${repetitiveFindings.length} repetitive findings`);

        // Build report data
        const reportData = {
            audit,
            sections: sections.map(s => ({ ...s, Percentage: s.maxScore > 0 ? Math.round((s.earnedScore / s.maxScore) * 100) : 0 })),
            findings, pictures: picturesByItem,
            fridgeReadings: fridgeResult.recordset,
            overallScore, threshold, cycleAudits,
            repetitiveFindings,
            generatedAt: new Date().toISOString()
        };

        // Generate HTML
        const html = generateRcvReportHTML(reportData);

        // Save
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'receiving-audit');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        const fileName = `RCV_Report_audit-${auditId}_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        fs.writeFileSync(path.join(reportsDir, fileName), html, 'utf8');

        // Update audit with report info
        await pool.request().input('auditId', sql.Int, auditId).input('fileName', sql.NVarChar, fileName)
            .query(`UPDATE RCV_Inspections SET ReportFileName = @fileName, ReportGeneratedAt = GETDATE() WHERE Id = @auditId`);

        console.log(`✅ RCV Report generated: ${fileName}`);
        res.json({ success: true, fileName, overallScore });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Department report
router.get('/api/audits/:auditId/department-report/:department', async (req, res) => {
    try {
        const { auditId, department } = req.params;
        const pool = await getPool();
        const auditResult = await pool.request().input('auditId', sql.Int, auditId)
            .query('SELECT * FROM RCV_Inspections WHERE Id = @auditId');
        if (auditResult.recordset.length === 0) return res.status(404).json({ success: false, error: 'Audit not found' });
        const audit = auditResult.recordset[0];

        const itemsResult = await pool.request().input('auditId', sql.Int, auditId).input('department', sql.NVarChar, department)
            .query('SELECT * FROM RCV_InspectionItems WHERE InspectionId = @auditId AND Department = @department AND Escalate = 1 ORDER BY SectionOrder, ItemOrder');

        const picturesResult = await pool.request().input('auditId', sql.Int, auditId)
            .query('SELECT p.ItemId, p.PictureType, p.FilePath, p.OriginalName FROM RCV_InspectionPictures p WHERE p.InspectionId = @auditId');
        const picturesByItem = {};
        for (const pic of picturesResult.recordset) {
            if (!picturesByItem[pic.ItemId]) picturesByItem[pic.ItemId] = [];
            picturesByItem[pic.ItemId].push(pic);
        }

        const html = generateDeptReportHTML(audit, department, itemsResult.recordset, picturesByItem);
        const reportsDir = path.join(__dirname, '..', '..', 'reports', 'receiving-audit');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        const fileName = `RCV_Dept_${department}_audit-${auditId}_${new Date().toISOString().split('T')[0]}.html`;
        fs.writeFileSync(path.join(reportsDir, fileName), html, 'utf8');
        res.json({ success: true, fileName });
    } catch (error) {
        console.error('Error generating dept report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Report HTML generator - Full featured (matching OE Inspection report)
function generateRcvReportHTML(data) {
    const { audit, sections, findings, pictures, fridgeReadings, overallScore, threshold, cycleAudits, repetitiveFindings, generatedAt } = data;
    const passedClass = overallScore >= threshold ? 'pass' : 'fail';
    const passedText = overallScore >= threshold ? 'PASS ✅' : 'FAIL ❌';

    // Collect all pictures for galleries
    const goodObsItems = [];
    const findingPicItems = [];

    sections.forEach(section => {
        (section.items || []).forEach(item => {
            const itemPics = pictures[item.Id] || [];
            itemPics.forEach(pic => {
                if (pic.pictureType === 'Good') {
                    goodObsItems.push({ ref: item.ReferenceValue || 'N/A', section: section.SectionName, question: item.Question, dataUrl: pic.dataUrl, fileName: pic.fileName });
                } else if (item.Answer === 'No' || item.Answer === 'Partially') {
                    findingPicItems.push({ ref: item.ReferenceValue || 'N/A', section: section.SectionName, question: item.Question, answer: item.Answer, finding: item.Finding, dataUrl: pic.dataUrl, fileName: pic.fileName, pictureType: pic.pictureType });
                }
            });
        });
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receiving Audit Report - ${audit.DocumentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px; }
        .header h1 { font-size: 20px; margin-bottom: 8px; }
        .header-info { display: flex; flex-wrap: wrap; gap: 10px; }
        .header-item { background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 6px; }
        .header-item label { font-size: 10px; opacity: 0.8; display: block; }
        .header-item span { font-size: 13px; font-weight: 600; }
        .score-card { background: white; border-radius: 10px; padding: 12px 25px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; gap: 20px; }
        .score-value { font-size: 36px; font-weight: bold; }
        .score-value.pass { color: #10b981; }
        .score-value.fail { color: #ef4444; }
        .score-label { font-size: 18px; font-weight: 600; }
        .score-label.pass { color: #10b981; }
        .score-label.fail { color: #ef4444; }
        .score-threshold { color: #64748b; font-size: 14px; border-left: 1px solid #e2e8f0; padding-left: 20px; }

        .summary-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .summary-title { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; }
        .summary-table { width: 100%; border-collapse: collapse; }
        .summary-table th, .summary-table td { padding: 10px 15px; }
        .summary-table th { background: #64748b; color: white; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #475569; }
        .summary-table td { border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .summary-table tr:hover { background: #f8fafc; }
        .summary-table .total-row { background: #f1f5f9; border-top: 2px solid #64748b; }
        .summary-table .current-cycle { background: #ede9fe; }
        .score-pass { color: #10b981; font-weight: 600; }
        .score-fail { color: #ef4444; font-weight: 600; }

        .chart-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .chart-title { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; }
        .chart-simple { padding: 20px; }
        .chart-row { display: flex; align-items: center; margin-bottom: 8px; gap: 10px; }
        .chart-row-label { width: 200px; font-size: 12px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
        .chart-row-bar-container { flex: 1; height: 20px; background: #e2e8f0; border-radius: 4px; position: relative; overflow: visible; }
        .chart-row-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
        .chart-row-bar.bar-pass { background: linear-gradient(90deg, #10b981 0%, #059669 100%); }
        .chart-row-bar.bar-fail { background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); }
        .chart-row-threshold { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #f59e0b; }
        .chart-row-value { width: 50px; font-size: 13px; font-weight: 700; text-align: right; }
        .chart-row-value.bar-pass { color: #10b981; }
        .chart-row-value.bar-fail { color: #ef4444; }
        .chart-legend { display: flex; gap: 20px; justify-content: center; padding: 15px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; }
        .legend-color { width: 14px; height: 14px; border-radius: 3px; }
        .legend-color.pass { background: #10b981; }
        .legend-color.fail { background: #ef4444; }
        .legend-line { width: 20px; height: 2px; background: #f59e0b; }

        .toggle-controls { display: flex; gap: 10px; margin-bottom: 20px; justify-content: flex-end; }
        .toggle-btn { background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s; }
        .toggle-btn:hover { background: #6d28d9; }

        .section-card { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
        .section-header:hover { filter: brightness(1.05); }
        .section-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .section-score { font-size: 20px; font-weight: bold; display: flex; align-items: center; gap: 10px; }
        .collapse-icon { font-size: 20px; transition: transform 0.3s ease; }
        .collapse-icon.collapsed { transform: rotate(-90deg); }
        .section-content { padding: 0; transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease; overflow: hidden; }
        .section-content.collapsed { max-height: 0 !important; padding: 0; opacity: 0; }

        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        th { background: #f8fafc; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }
        tr:hover { background: #f8fafc; }
        .choice-yes { color: #10b981; font-weight: 600; }
        .choice-no { color: #ef4444; font-weight: 600; }
        .choice-partial { color: #f59e0b; font-weight: 600; }
        .choice-na { color: #94a3b8; }

        .section-findings { background: #fef2f2; border-top: 2px solid #fecaca; padding: 12px 15px; }
        .section-findings-title { color: #dc2626; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        .finding-item { background: white; border-radius: 8px; padding: 12px; margin-bottom: 8px; border-left: 4px solid #ef4444; }
        .finding-ref { font-weight: 600; color: #7c3aed; font-size: 12px; }
        .finding-question { margin: 5px 0; font-size: 14px; }
        .finding-detail { color: #64748b; font-size: 13px; }
        .finding-cr { background: #ecfdf5; border-left: 4px solid #10b981; padding: 10px; margin-top: 8px; border-radius: 4px; font-size: 13px; color: #065f46; }
        .finding-pictures { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        .pictures-wrapper { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; }

        .fridge-section { background: white; border-radius: 12px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .fridge-header { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; padding: 15px 20px; }
        .fridge-title { font-size: 18px; font-weight: 600; }

        .gallery-section { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 25px; overflow: hidden; }
        .gallery-title { margin: 0; padding: 15px 20px; font-size: 18px; font-weight: 600; color: white; }
        .gallery-title.good { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
        .gallery-title.findings { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; padding: 20px; }
        .gallery-card { background: #f8fafc; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; transition: transform 0.2s, box-shadow 0.2s; }
        .gallery-card:hover { transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
        .gallery-card.good { border-left: 4px solid #6b7280; }
        .gallery-card.finding { border-left: 4px solid #ef4444; }
        .gallery-img { width: 100%; height: 180px; object-fit: cover; cursor: pointer; background: #e2e8f0; }
        .gallery-info { padding: 12px; }
        .gallery-ref { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .gallery-ref.good { color: #4b5563; }
        .gallery-ref.finding { color: #dc2626; }
        .gallery-section-name { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .gallery-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
        .gallery-type.good { background: #e5e7eb; color: #374151; }
        .gallery-type.issue { background: #fee2e2; color: #991b1b; }
        .gallery-type.corrective { background: #d1fae5; color: #065f46; }
        .gallery-empty { text-align: center; padding: 40px 20px; color: #94a3b8; font-size: 16px; }

        .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); }
        .lightbox-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; font-weight: bold; cursor: pointer; transition: color 0.2s; }
        .lightbox-close:hover { color: #7c3aed; }

        .filter-toolbar {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 20px; margin-bottom: 20px;
            display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: sticky; top: 80px; z-index: 100;
        }
        .filter-toolbar-title { font-weight: 600; color: #475569; font-size: 14px; }
        .filter-group { display: flex; gap: 8px; }
        .filter-btn {
            padding: 6px 14px; border: 2px solid #cbd5e1; border-radius: 20px; background: white;
            cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s ease;
            display: flex; align-items: center; gap: 4px;
        }
        .filter-btn:hover { background: #f1f5f9; }
        .filter-btn.active { border-color: #7c3aed; background: #f5f3ff; color: #6d28d9; }
        .filter-btn.filter-yes.active { border-color: #10b981; background: #ecfdf5; color: #059669; }
        .filter-btn.filter-partial.active { border-color: #f59e0b; background: #fffbeb; color: #d97706; }
        .filter-btn.filter-no.active { border-color: #ef4444; background: #fef2f2; color: #dc2626; }
        .filter-btn.filter-na.active { border-color: #64748b; background: #f1f5f9; color: #475569; }
        .filter-divider { width: 1px; height: 30px; background: #cbd5e1; }
        .hidden-by-filter { display: none !important; }
        .section-hidden { display: none !important; }

        .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000; }
        .action-bar button { padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s; }
        .action-bar button:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .btn-email { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; }
        .btn-print { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; }
        .btn-pdf { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
        .btn-back { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; }

        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }

        @media print {
            @page { size: landscape; margin: 10mm; }
            body { background: white; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { max-width: 100%; padding: 0; }
            .action-bar { display: none !important; }
            .filter-toolbar { display: none !important; }
            .section-card { break-inside: avoid; page-break-inside: avoid; }
            .gallery-section { break-before: page; }
            .lightbox { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn-back" onclick="goBack()">← Back</button>
        <button class="btn-pdf" onclick="exportToPDF()">📄 PDF</button>
        <button class="btn-email" onclick="openEmailModal('full')">📧 Send Report</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    </div>

    <div class="lightbox" id="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close">&times;</span>
        <img id="lightbox-img" src="" alt="Full size image">
    </div>

    <script>
        function goBack() {
            if (document.referrer && document.referrer.includes(window.location.hostname)) { history.back(); }
            else { window.location.href = '/receiving-audit/list'; }
        }
        function exportToPDF() {
            const overlay = document.createElement('div');
            overlay.innerHTML = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:10000;"><div style="background:white;padding:30px 50px;border-radius:12px;text-align:center;"><h3 style="margin:0 0 15px 0;">📄 Export to PDF</h3><p style="margin:0 0 20px 0;color:#666;">In the print dialog, select <strong>"Save as PDF"</strong> as the destination.</p></div></div>';
            document.body.appendChild(overlay);
            setTimeout(() => { overlay.remove(); window.print(); }, 2000);
        }
        function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox').classList.add('active'); }
        function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
        
        const auditId = ${audit.Id};
        
        async function openEmailModal(reportType) {
            try {
                const btn = document.querySelector('.btn-email');
                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳ Loading...';
                btn.disabled = true;
                
                const recipientsRes = await fetch('/receiving-audit/api/audits/' + auditId + '/email-recipients?reportType=' + reportType);
                const recipientsData = await recipientsRes.json();
                
                if (!recipientsData.success) {
                    throw new Error(recipientsData.error || 'Failed to load recipients');
                }
                
                const previewRes = await fetch('/receiving-audit/api/audits/' + auditId + '/email-preview?reportType=' + reportType);
                const previewData = await previewRes.json();
                
                if (!previewData.success) {
                    throw new Error(previewData.error || 'Failed to generate preview');
                }
                
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                EmailModal.show({
                    module: 'RCV',
                    from: recipientsData.from,
                    to: recipientsData.to,
                    ccSuggestions: recipientsData.ccSuggestions,
                    subject: previewData.subject,
                    bodyHtml: previewData.bodyHtml,
                    reportType: reportType,
                    auditId: auditId,
                    sendUrl: '/receiving-audit/api/audits/' + auditId + '/send-report-email',
                    searchEndpoint: '/operational-excellence/api/users'
                });
            } catch (error) {
                console.error('Error:', error);
                alert('Error preparing email: ' + error.message);
                const btn = document.querySelector('.btn-email');
                if (btn) { btn.innerHTML = '📧 Send Report'; btn.disabled = false; }
            }
        }
    </script>
    <script src="/js/email-modal.js"></script>

    <div class="container">
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
            <span class="filter-toolbar-title">🔍 Filter:</span>
            <div class="filter-group">
                <button class="filter-btn filter-yes active" onclick="toggleFilter('yes', this)" title="Show/Hide Yes answers">✓ Yes</button>
                <button class="filter-btn filter-partial active" onclick="toggleFilter('partial', this)" title="Show/Hide Partially answers">◐ Partially</button>
                <button class="filter-btn filter-no active" onclick="toggleFilter('no', this)" title="Show/Hide No answers">✗ No</button>
                <button class="filter-btn filter-na active" onclick="toggleFilter('na', this)" title="Show/Hide N/A answers">— N/A</button>
            </div>
            <div class="filter-divider"></div>
            <div class="filter-group">
                <button class="filter-btn" onclick="showOnlyFindings()" title="Show only items with findings">⚠️ Findings Only</button>
                <button class="filter-btn" onclick="resetFilters()" title="Reset all filters">🔄 Reset</button>
            </div>
        </div>

        <div class="header">
            <h1>📦 Receiving Audit Report</h1>
            <div class="header-info">
                <div class="header-item"><label>Document #</label><span>${audit.DocumentNumber}</span></div>
                <div class="header-item"><label>Store</label><span>${audit.StoreName || 'N/A'}</span></div>
                <div class="header-item"><label>Date</label><span>${audit.InspectionDate ? new Date(audit.InspectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span></div>
                <div class="header-item"><label>Auditors</label><span>${audit.Inspectors || 'N/A'}</span></div>
                <div class="header-item"><label>Accompanied By</label><span>${audit.AccompaniedBy || 'N/A'}</span></div>
                <div class="header-item"><label>Time In</label><span>${audit.TimeIn ? (typeof audit.TimeIn === 'string' ? audit.TimeIn : new Date(audit.TimeIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })) : 'N/A'}</span></div>
                <div class="header-item"><label>Time Out</label><span>${audit.TimeOut ? (typeof audit.TimeOut === 'string' ? audit.TimeOut : new Date(audit.TimeOut).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })) : 'N/A'}</span></div>
                <div class="header-item"><label>Cycle</label><span>${audit.Cycle || '-'} / ${audit.Year || '-'}</span></div>
                <div class="header-item"><label>Status</label><span>${audit.Status}</span></div>
            </div>
        </div>

        <div class="score-card">
            <div class="score-value ${passedClass}">${overallScore}%</div>
            <div class="score-label ${passedClass}">${passedText}</div>
            <div class="score-threshold">Threshold: ${threshold}%</div>
        </div>

        <!-- Summary Table with Historical Cycles -->
        <div class="summary-section">
            <h2 class="summary-title">📊 Audit Summary</h2>
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Section</th>
                        ${cycleAudits.map(ca => '<th style="text-align:center;">' + ca.cycleLabel + '</th>').join('')}
                    </tr>
                </thead>
                <tbody>
                    ${sections.map(section => {
                        const sectionThreshold = section.PassingGrade || threshold;
                        return '<tr><td><strong>' + section.SectionName + '</strong></td>' +
                            cycleAudits.map(ca => {
                                const score = ca.sectionScores[section.SectionName] || 0;
                                const isPassed = score >= sectionThreshold;
                                const scoreClass = isPassed ? 'score-pass' : 'score-fail';
                                const currentClass = ca.isCurrent ? ' current-cycle' : '';
                                return '<td style="text-align:center;" class="' + currentClass + '"><strong class="' + scoreClass + '">' + score + '%</strong></td>';
                            }).join('') + '</tr>';
                    }).join('')}
                    <tr class="total-row">
                        <td><strong>TOTAL</strong></td>
                        ${cycleAudits.map(ca => {
                            const isPassed = ca.totalScore >= threshold;
                            const scoreClass = isPassed ? 'score-pass' : 'score-fail';
                            const currentClass = ca.isCurrent ? ' current-cycle' : '';
                            return '<td style="text-align:center;" class="' + currentClass + '"><strong class="' + scoreClass + '">' + ca.totalScore + '%</strong></td>';
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Section Scores Chart -->
        <div class="chart-section">
            <h2 class="chart-title">📊 Section Scores Overview</h2>
            <div class="chart-simple">
                ${sections.map(section => {
                    const sectionThreshold = section.PassingGrade || threshold;
                    const barClass = section.Percentage >= sectionThreshold ? 'bar-pass' : 'bar-fail';
                    return '<div class="chart-row">' +
                        '<div class="chart-row-label">' + section.SectionName + '</div>' +
                        '<div class="chart-row-bar-container">' +
                        '<div class="chart-row-bar ' + barClass + '" style="width: ' + section.Percentage + '%;"></div>' +
                        '<div class="chart-row-threshold" style="left: ' + sectionThreshold + '%;"></div>' +
                        '</div>' +
                        '<div class="chart-row-value ' + barClass + '">' + section.Percentage + '%</div>' +
                        '</div>';
                }).join('')}
            </div>
            <div class="chart-legend">
                <span class="legend-item"><span class="legend-color pass"></span> Pass (≥threshold)</span>
                <span class="legend-item"><span class="legend-color fail"></span> Fail (&lt;threshold)</span>
                <span class="legend-item"><span class="legend-line"></span> Section Threshold</span>
            </div>
        </div>

        <div class="toggle-controls">
            <button class="toggle-btn" onclick="expandAll()">📂 Expand All</button>
            <button class="toggle-btn" onclick="collapseAll()">📁 Collapse All</button>
        </div>

        ${sections.map((section, sectionIdx) => {
            const sectionFindings = (section.items || []).filter(item => item.Answer === 'No' || item.Answer === 'Partially');
            return '<div class="section-card">' +
                '<div class="section-header" onclick="toggleSection(' + sectionIdx + ')">' +
                '<div class="section-title"><span class="collapse-icon" id="icon-' + sectionIdx + '">▼</span>' + section.SectionName + '</div>' +
                '<div class="section-score">' + section.Percentage + '%</div>' +
                '</div>' +
                '<div class="section-content" id="section-' + sectionIdx + '">' +
                '<table><thead><tr>' +
                '<th style="width:60px">#</th><th>Question</th><th style="width:80px">Answer</th><th style="width:80px">Score</th><th style="width:90px">Observation</th>' +
                '</tr></thead><tbody>' +
                (section.items || []).map(item => {
                    const answerType = item.Answer === 'Yes' ? 'Yes' : item.Answer === 'No' ? 'No' : item.Answer === 'Partially' ? 'Partially' : 'NA';
                    const itemPics = pictures[item.Id] || [];
                    const goodPics = itemPics.filter(p => p.pictureType === 'Good');
                    const goodPicsHtml = goodPics.length > 0
                        ? goodPics.map(p => '<img src="' + p.dataUrl + '" alt="Good" title="Good Observation" style="max-width:50px;max-height:40px;border-radius:4px;cursor:pointer;border:2px solid #10b981;object-fit:cover;" onclick="openLightbox(this.src)">').join('')
                        : '-';
                    return '<tr data-answer="' + answerType + '">' +
                        '<td>' + (item.ReferenceValue || '-') + '</td>' +
                        '<td>' + (item.Question || '-') + '</td>' +
                        '<td class="' + (item.Answer === 'Yes' ? 'choice-yes' : item.Answer === 'No' ? 'choice-no' : item.Answer === 'Partially' ? 'choice-partial' : 'choice-na') + '">' + (item.Answer || '-') + '</td>' +
                        '<td>' + (item.Score != null ? item.Score : '-') + ' / ' + (item.Coefficient || 0) + '</td>' +
                        '<td>' + goodPicsHtml + '</td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table>' +
                (sectionFindings.length > 0 ? '<div class="section-findings">' +
                    '<div class="section-findings-title">⚠️ Findings (' + sectionFindings.length + ')</div>' +
                    sectionFindings.map(f => {
                        const itemPics = pictures[f.Id] || [];
                        const correctiveHtml = f.CorrectedAction ? '<div class="finding-cr">✅ Corrective Action: ' + f.CorrectedAction + '</div>' : '';
                        const picsHtml = itemPics.length > 0
                            ? '<div class="finding-pictures"><strong>Photos:</strong><div class="pictures-wrapper">' +
                              itemPics.map(p => '<img src="' + p.dataUrl + '" alt="' + (p.fileName || 'Photo') + '" title="' + (p.pictureType || 'Photo') + '" style="max-width:100px;max-height:75px;border-radius:4px;cursor:pointer;border:2px solid ' + (p.pictureType === 'Good' || p.pictureType === 'corrective' ? '#10b981' : '#ef4444') + ';" onclick="openLightbox(this.src)">').join('') +
                              '</div></div>' : '';
                        return '<div class="finding-item">' +
                            '<div class="finding-ref">[' + (f.ReferenceValue || 'N/A') + ']</div>' +
                            '<div class="finding-question">' + f.Question + '</div>' +
                            '<div class="finding-detail">Answer: <strong class="' + (f.Answer === 'No' ? 'choice-no' : 'choice-partial') + '">' + f.Answer + '</strong> | Finding: ' + (f.Finding || 'N/A') + '</div>' +
                            correctiveHtml + picsHtml +
                            '</div>';
                    }).join('') +
                    '</div>' : '') +
                // Fridge readings for this section
                (() => {
                    const sectionFridgeReadings = fridgeReadings.filter(r => r.SectionName === section.SectionName);
                    if (sectionFridgeReadings.length === 0) return '';
                    return '<div class="section-findings" style="margin-top:10px;background:#ecfeff;border-top:2px solid #99f6e4;">' +
                        '<div class="section-findings-title" style="color:#0891b2;">🌡️ Fridge Temperature Readings (' + sectionFridgeReadings.length + ')</div>' +
                        '<table><thead><tr><th>Ref</th><th>Display (°C)</th><th>Probe (°C)</th><th>Status</th><th>Issue</th><th>Photo</th></tr></thead><tbody>' +
                        sectionFridgeReadings.map(r =>
                            '<tr><td>' + (r.ReferenceValue || 'N/A') + '</td>' +
                            '<td>' + (r.DisplayTemp != null ? r.DisplayTemp : 'N/A') + '</td>' +
                            '<td>' + (r.ProbeTemp != null ? r.ProbeTemp : 'N/A') + '</td>' +
                            '<td>' + (r.IsCompliant ? '✅ OK' : '❌ Issue') + '</td>' +
                            '<td>' + (r.Issue || '-') + '</td>' +
                            '<td>' + (r.Picture ? '<img src="' + r.Picture + '" alt="Fridge" style="max-width:80px;max-height:60px;border-radius:4px;cursor:pointer;object-fit:cover;" onclick="openLightbox(this.src)">' : '-') + '</td></tr>'
                        ).join('') +
                        '</tbody></table></div>';
                })() +
                '</div></div>';
        }).join('')}

        <!-- Repetitive Findings Across Cycles -->
        <div class="summary-section" style="margin-bottom: 25px;">
            <h2 class="summary-title" style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);">🔄 Repetitive Findings Across Cycles (${repetitiveFindings ? repetitiveFindings.length : 0})</h2>
            ${repetitiveFindings && repetitiveFindings.length > 0 ? `
            <div style="padding: 15px; background: #fef2f2;">
                <p style="margin: 0 0 15px 0; color: #991b1b; font-size: 14px;">These items have failed or partially complied in <strong>2 or more audit cycles</strong> for this store and require attention:</p>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">Ref</th>
                            <th style="width: 150px;">Section</th>
                            <th>Question</th>
                            <th style="width: 60px; text-align: center;">Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${repetitiveFindings.map(rf => `
                            <tr style="background: ${rf.OccurrenceCount >= 3 ? '#fee2e2' : '#fff'};">
                                <td><strong style="color: #7c3aed;">${rf.ReferenceValue || 'N/A'}</strong></td>
                                <td style="font-size: 12px;">${rf.SectionName || 'N/A'}</td>
                                <td>${rf.Question || 'N/A'}</td>
                                <td style="text-align: center;"><span style="background: ${rf.OccurrenceCount >= 3 ? '#dc2626' : '#f59e0b'}; color: white; padding: 2px 10px; border-radius: 12px; font-weight: 600;">${rf.OccurrenceCount}x</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : `<div style="padding: 30px; text-align: center; background: #f0fdf4; color: #166534;">
                <span style="font-size: 24px;">✅</span>
                <p style="margin: 10px 0 0 0; font-size: 14px;">No repetitive findings detected. Each finding appears in only one audit cycle.</p>
            </div>`}
        </div>

        <!-- Observation Gallery -->
        <div class="gallery-section">
            <h2 class="gallery-title good">📷 Observation Gallery (${goodObsItems.length})</h2>
            ${goodObsItems.length > 0 ? '<div class="gallery-grid">' +
                goodObsItems.map(item =>
                    '<div class="gallery-card good">' +
                    '<img src="' + item.dataUrl + '" alt="Observation" class="gallery-img" onclick="openLightbox(this.src)">' +
                    '<div class="gallery-info">' +
                    '<div class="gallery-ref good">[' + item.ref + ']</div>' +
                    '<div class="gallery-section-name">📋 ' + item.section + '</div>' +
                    '<span class="gallery-type good">📷 Observation</span>' +
                    '</div></div>'
                ).join('') + '</div>'
            : '<div class="gallery-empty">No observations captured</div>'}
        </div>

        <!-- Findings Gallery -->
        <div class="gallery-section">
            <h2 class="gallery-title findings">⚠️ Findings Gallery (${findingPicItems.length})</h2>
            ${findingPicItems.length > 0 ? '<div class="gallery-grid">' +
                findingPicItems.map(item =>
                    '<div class="gallery-card finding">' +
                    '<img src="' + item.dataUrl + '" alt="Finding" class="gallery-img" onclick="openLightbox(this.src)">' +
                    '<div class="gallery-info">' +
                    '<div class="gallery-ref finding">[' + item.ref + ']</div>' +
                    '<div class="gallery-section-name">📋 ' + item.section + '</div>' +
                    '<span class="gallery-type ' + (item.pictureType === 'corrective' ? 'corrective' : 'issue') + '">' + (item.pictureType === 'corrective' ? '✅ Corrective' : '⚠️ Issue') + '</span>' +
                    '</div></div>'
                ).join('') + '</div>'
            : '<div class="gallery-empty">No finding photos captured</div>'}
        </div>

        <div class="footer">
            Report generated on ${new Date(generatedAt).toLocaleString()} | Receiving Audit System
        </div>
    </div>

    <script>
        // Section collapse/expand
        function toggleSection(index) {
            const content = document.getElementById('section-' + index);
            const icon = document.getElementById('icon-' + index);
            if (content.classList.contains('collapsed')) { content.classList.remove('collapsed'); icon.classList.remove('collapsed'); }
            else { content.classList.add('collapsed'); icon.classList.add('collapsed'); }
        }
        function expandAll() {
            document.querySelectorAll('.section-content').forEach(el => el.classList.remove('collapsed'));
            document.querySelectorAll('.collapse-icon').forEach(el => el.classList.remove('collapsed'));
        }
        function collapseAll() {
            document.querySelectorAll('.section-content').forEach(el => el.classList.add('collapsed'));
            document.querySelectorAll('.collapse-icon').forEach(el => el.classList.add('collapsed'));
        }

        // Filter functionality
        const filters = { yes: true, partial: true, no: true, na: true };
        function toggleFilter(type, btn) { filters[type] = !filters[type]; btn.classList.toggle('active', filters[type]); applyFilters(); }
        function applyFilters() {
            document.querySelectorAll('tr[data-answer]').forEach(row => {
                const answer = row.dataset.answer;
                let show = false;
                if (answer === 'Yes' && filters.yes) show = true;
                if (answer === 'Partially' && filters.partial) show = true;
                if (answer === 'No' && filters.no) show = true;
                if (answer === 'NA' && filters.na) show = true;
                row.classList.toggle('hidden-by-filter', !show);
            });
            document.querySelectorAll('.section-card').forEach(section => {
                const visibleRows = section.querySelectorAll('tr[data-answer]:not(.hidden-by-filter)');
                section.classList.toggle('section-hidden', visibleRows.length === 0);
            });
        }
        function showOnlyFindings() {
            filters.yes = false; filters.na = false; filters.partial = true; filters.no = true;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.classList.contains('filter-yes')) btn.classList.remove('active');
                if (btn.classList.contains('filter-na')) btn.classList.remove('active');
                if (btn.classList.contains('filter-partial')) btn.classList.add('active');
                if (btn.classList.contains('filter-no')) btn.classList.add('active');
            });
            applyFilters();
        }
        function resetFilters() {
            filters.yes = true; filters.partial = true; filters.no = true; filters.na = true;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.add('active'));
            document.querySelectorAll('tr[data-answer]').forEach(row => row.classList.remove('hidden-by-filter'));
            document.querySelectorAll('.section-card').forEach(section => section.classList.remove('section-hidden'));
        }
    </script>
</body>
</html>`;
}

function generateDeptReportHTML(audit, department, items, picturesByItem) {
    const itemsHTML = items.map(item => {
        const itemPics = picturesByItem[item.Id] || [];
        const picsHtml = itemPics.length > 0
            ? itemPics.map(p => '<img src="' + p.FilePath + '" style="max-width:150px;max-height:100px;border-radius:6px;cursor:pointer;margin:3px;border:2px solid ' + (p.PictureType === 'corrective' ? '#10b981' : '#ef4444') + ';" onclick="openLightbox(this.src)" alt="">').join('')
            : '-';
        return '<tr>' +
            '<td>' + (item.ReferenceValue || '') + '</td>' +
            '<td>' + (item.SectionName || '') + '</td>' +
            '<td>' + (item.Question || '') + '</td>' +
            '<td style="font-weight:600;color:' + (item.Answer === 'No' ? '#ef4444' : '#f59e0b') + ';">' + (item.Answer || '-') + '</td>' +
            '<td>' + (item.Finding || '') + '</td>' +
            '<td><span style="padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:' +
            (item.Priority === 'Critical' ? '#fef2f2;color:#dc2626' : item.Priority === 'High' ? '#fff7ed;color:#ea580c' : '#f0fdf4;color:#16a34a') + ';">' + (item.Priority || 'Medium') + '</span></td>' +
            '<td>' + picsHtml + '</td></tr>';
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${department} Department Report - ${audit.DocumentNumber}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 20px 25px; border-radius: 12px; margin-bottom: 20px; text-align: center; }
        .header h1 { font-size: 22px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .dept-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 20px; border-radius: 50px; font-size: 16px; font-weight: 700; margin-top: 10px; }
        .stats { display: flex; gap: 15px; margin-bottom: 20px; justify-content: center; }
        .stat-card { background: white; border-radius: 10px; padding: 15px 25px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); flex: 0 1 200px; }
        .stat-value { font-size: 28px; font-weight: bold; color: #7c3aed; }
        .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
        .items-section { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08); margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #7c3aed; color: white; padding: 12px 10px; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 600; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: middle; }
        tr:hover { background: #f8fafc; }
        .empty-state { text-align: center; padding: 40px; color: #94a3b8; font-size: 16px; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000; }
        .action-bar button { padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        .btn-back { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; }
        .btn-print { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; }
        .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; justify-content: center; align-items: center; }
        .lightbox.active { display: flex; }
        .lightbox img { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .lightbox-close { position: absolute; top: 20px; right: 30px; color: white; font-size: 40px; cursor: pointer; }
        @media print {
            @page { size: landscape; margin: 10mm; }
            body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .action-bar { display: none !important; }
            .lightbox { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="action-bar">
        <button class="btn-back" onclick="history.back()">← Back</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
    </div>
    <div class="lightbox" id="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close">&times;</span>
        <img id="lightbox-img" src="" alt="Full size image">
    </div>
    <script>
        function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox').classList.add('active'); }
        function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
    </script>
    <div class="container">
        <div class="header">
            <h1>📦 Department Escalation Report</h1>
            <p>${audit.DocumentNumber} | ${audit.StoreName || 'N/A'} | ${audit.InspectionDate ? new Date(audit.InspectionDate).toLocaleDateString() : 'N/A'}</p>
            <div class="dept-badge">🏢 ${department}</div>
        </div>
        <div class="stats">
            <div class="stat-card"><div class="stat-value">${items.length}</div><div class="stat-label">Escalated Items</div></div>
            <div class="stat-card"><div class="stat-value">${items.filter(i => i.Priority === 'Critical').length}</div><div class="stat-label">Critical</div></div>
            <div class="stat-card"><div class="stat-value">${items.filter(i => i.Priority === 'High').length}</div><div class="stat-label">High Priority</div></div>
        </div>
        <div class="items-section">
            <table>
                <thead><tr>
                    <th>Ref</th><th>Section</th><th>Question</th><th>Answer</th><th>Finding</th><th>Priority</th><th>Pictures</th>
                </tr></thead>
                <tbody>${itemsHTML || '<tr><td colspan="7" class="empty-state">No escalated items for this department</td></tr>'}</tbody>
            </table>
        </div>
        <div class="footer">Generated on ${new Date().toLocaleString()} | Receiving Audit System</div>
    </div>
</body>
</html>`;
}

// ==========================================
// Fridge Readings APIs
// ==========================================

function saveFridgePicture(base64Data, auditId) {
    const fridgeDir = path.join(__dirname, '..', '..', 'uploads', 'receiving-audit', 'fridge');
    if (!fs.existsSync(fridgeDir)) fs.mkdirSync(fridgeDir, { recursive: true });
    const matches = base64Data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
    if (!matches) return null;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const fileName = `fridge-${auditId}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const filePath = path.join(fridgeDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(matches[2], 'base64'));
    return '/uploads/receiving-audit/fridge/' + fileName;
}

// Save fridge readings
router.post('/api/audits/:auditId/fridge-readings', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { goodReadings, badReadings } = req.body;
        const pool = await getPool();

        // Get existing picture file paths before deleting
        const existingPics = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query('SELECT Picture FROM RCV_FridgeReadings WHERE InspectionId = @auditId AND Picture IS NOT NULL');

        // Collect paths of pictures being re-submitted
        const reusedPaths = new Set();
        for (const r of [...(goodReadings || []), ...(badReadings || [])]) {
            if (r.picture && !r.picture.startsWith('data:')) reusedPaths.add(r.picture);
        }

        // Delete orphan picture files
        for (const row of existingPics.recordset) {
            if (row.Picture && !reusedPaths.has(row.Picture)) {
                const filePath = path.join(__dirname, '..', '..', row.Picture);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
                }
            }
        }

        // Delete existing readings
        await pool.request().input('auditId', sql.Int, auditId)
            .query('DELETE FROM RCV_FridgeReadings WHERE InspectionId = @auditId');

        // Insert good readings
        for (const reading of (goodReadings || [])) {
            const itemId = parseInt(reading.responseId);
            if (!itemId) continue;
            const displayVal = parseFloat(reading.displayTemp || reading.display);
            const probeVal = parseFloat(reading.probeTemp || reading.probe);
            let picturePath = null;
            if (reading.picture) {
                picturePath = reading.picture.startsWith('data:') ? saveFridgePicture(reading.picture, auditId) : reading.picture;
            }
            await pool.request()
                .input('auditId', sql.Int, auditId).input('itemId', sql.Int, itemId)
                .input('displayTemp', sql.Decimal(10,2), isNaN(displayVal) ? null : displayVal)
                .input('probeTemp', sql.Decimal(10,2), isNaN(probeVal) ? null : probeVal)
                .input('isCompliant', sql.Bit, 1).input('picture', sql.NVarChar, picturePath)
                .query('INSERT INTO RCV_FridgeReadings (InspectionId, ItemId, DisplayTemp, ProbeTemp, IsCompliant, Picture, CreatedAt) VALUES (@auditId, @itemId, @displayTemp, @probeTemp, @isCompliant, @picture, GETDATE())');
        }

        // Insert bad readings
        for (const reading of (badReadings || [])) {
            const itemId = parseInt(reading.responseId);
            if (!itemId) continue;
            const displayVal = parseFloat(reading.displayTemp || reading.display);
            const probeVal = parseFloat(reading.probeTemp || reading.probe);
            let picturePath = null;
            if (reading.picture) {
                picturePath = reading.picture.startsWith('data:') ? saveFridgePicture(reading.picture, auditId) : reading.picture;
            }
            await pool.request()
                .input('auditId', sql.Int, auditId).input('itemId', sql.Int, itemId)
                .input('displayTemp', sql.Decimal(10,2), isNaN(displayVal) ? null : displayVal)
                .input('probeTemp', sql.Decimal(10,2), isNaN(probeVal) ? null : probeVal)
                .input('issue', sql.NVarChar, reading.issue || null)
                .input('isCompliant', sql.Bit, 0).input('picture', sql.NVarChar, picturePath)
                .query('INSERT INTO RCV_FridgeReadings (InspectionId, ItemId, DisplayTemp, ProbeTemp, Issue, IsCompliant, Picture, CreatedAt) VALUES (@auditId, @itemId, @displayTemp, @probeTemp, @issue, @isCompliant, @picture, GETDATE())');
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving fridge readings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get fridge readings
router.get('/api/audits/:auditId/fridge-readings', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();

        const result = await pool.request().input('auditId', sql.Int, auditId)
            .query(`
                SELECT fr.Id, fr.ItemId, fr.DisplayTemp, fr.ProbeTemp, fr.Issue, fr.IsCompliant, fr.Picture,
                       i.SectionName
                FROM RCV_FridgeReadings fr
                LEFT JOIN RCV_InspectionItems i ON fr.ItemId = i.Id
                WHERE fr.InspectionId = @auditId
                ORDER BY fr.CreatedAt
            `);

        // Auto-detect which sections have fridge readings
        const enabledSectionsResult = await pool.request().input('auditId', sql.Int, auditId)
            .query(`
                SELECT DISTINCT sec.Id as sectionId
                FROM RCV_FridgeReadings fr
                INNER JOIN RCV_InspectionItems i ON fr.ItemId = i.Id AND i.InspectionId = @auditId
                INNER JOIN RCV_InspectionSections sec ON sec.InspectionId = @auditId AND sec.SectionName = i.SectionName
                WHERE fr.InspectionId = @auditId
            `);

        const enabledSections = {};
        for (const row of enabledSectionsResult.recordset) {
            enabledSections[row.sectionId] = true;
        }

        const mapped = result.recordset.filter(r => r.ItemId != null).map(r => ({
            id: r.Id,
            responseId: r.ItemId,
            section: r.SectionName || '',
            displayTemp: r.DisplayTemp != null ? String(r.DisplayTemp) : '',
            probeTemp: r.ProbeTemp != null ? String(r.ProbeTemp) : '',
            issue: r.Issue || '',
            picture: r.Picture || null,
            isCompliant: r.IsCompliant
        }));

        const goodReadings = mapped.filter(r => r.isCompliant === true || r.isCompliant === 1);
        const badReadings = mapped.filter(r => r.isCompliant === false || r.isCompliant === 0);

        res.json({ success: true, data: { goodReadings, badReadings, enabledSections } });
    } catch (error) {
        console.error('Error fetching fridge readings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Gallery APIs
// ==========================================

const galleryUploadDir = path.join(__dirname, '..', '..', 'uploads', 'receiving-audit', 'gallery');
if (!fs.existsSync(galleryUploadDir)) {
    fs.mkdirSync(galleryUploadDir, { recursive: true });
}

const galleryStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, galleryUploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'rcv-gallery-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const galleryUpload = multer({
    storage: galleryStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only image files are allowed'));
    }
});

// Upload multiple pictures to gallery
router.post('/api/gallery/:auditId/upload-multiple', galleryUpload.array('pictures', 20), async (req, res) => {
    try {
        const { auditId } = req.params;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }
        const pool = await getPool();
        const uploadedPictures = [];
        for (const file of req.files) {
            await compressImage(file.path);
            const stats = fs.statSync(file.path);
            const result = await pool.request()
                .input('auditId', sql.Int, auditId)
                .input('fileName', sql.NVarChar, file.filename)
                .input('filePath', sql.NVarChar, '/uploads/receiving-audit/gallery/' + file.filename)
                .input('originalName', sql.NVarChar, file.originalname)
                .input('fileSize', sql.Int, stats.size)
                .input('uploadedBy', sql.NVarChar, req.currentUser?.displayName || 'Unknown')
                .query('INSERT INTO RCV_InspectionGallery (InspectionId, FileName, FilePath, OriginalName, FileSize, UploadedBy) OUTPUT INSERTED.Id, INSERTED.FileName, INSERTED.FilePath, INSERTED.OriginalName, INSERTED.FileSize, INSERTED.UploadedAt VALUES (@auditId, @fileName, @filePath, @originalName, @fileSize, @uploadedBy)');
            uploadedPictures.push(result.recordset[0]);
        }
        res.json({ success: true, data: uploadedPictures, count: uploadedPictures.length });
    } catch (error) {
        console.error('Error uploading to gallery:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all gallery pictures for an audit
router.get('/api/gallery/:auditId', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();
        const result = await pool.request().input('auditId', sql.Int, auditId)
            .query(`
                SELECT g.Id, g.FileName, g.FilePath, g.OriginalName, g.FileSize, g.UploadedBy, g.UploadedAt,
                    (SELECT COUNT(*) FROM RCV_InspectionGalleryLinks WHERE GalleryPictureId = g.Id) as AssignmentCount
                FROM RCV_InspectionGallery g
                WHERE g.InspectionId = @auditId
                ORDER BY g.UploadedAt DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching gallery:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete picture from gallery
router.delete('/api/gallery/picture/:pictureId', async (req, res) => {
    try {
        const { pictureId } = req.params;
        const pool = await getPool();
        const fileResult = await pool.request().input('id', sql.Int, pictureId)
            .query('SELECT FilePath FROM RCV_InspectionGallery WHERE Id = @id');
        if (fileResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Picture not found' });
        }
        // Delete links first, then gallery record
        await pool.request().input('id', sql.Int, pictureId)
            .query('DELETE FROM RCV_InspectionGalleryLinks WHERE GalleryPictureId = @id');
        await pool.request().input('id', sql.Int, pictureId)
            .query('DELETE FROM RCV_InspectionGallery WHERE Id = @id');
        // Delete file from disk
        const filePath = path.join(__dirname, '..', '..', fileResult.recordset[0].FilePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting gallery picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Assign gallery picture to item
router.post('/api/gallery/assign', async (req, res) => {
    try {
        const { galleryPictureId, responseId, pictureType } = req.body;
        if (!galleryPictureId || !responseId || !pictureType) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        const pool = await getPool();
        // Check if already assigned
        const existing = await pool.request()
            .input('galleryPictureId', sql.Int, galleryPictureId)
            .input('responseId', sql.Int, responseId)
            .input('pictureType', sql.NVarChar, pictureType)
            .query('SELECT Id FROM RCV_InspectionGalleryLinks WHERE GalleryPictureId = @galleryPictureId AND ResponseId = @responseId AND PictureType = @pictureType');
        if (existing.recordset.length > 0) {
            return res.json({ success: true, message: 'Already assigned' });
        }
        const result = await pool.request()
            .input('galleryPictureId', sql.Int, galleryPictureId)
            .input('responseId', sql.Int, responseId)
            .input('pictureType', sql.NVarChar, pictureType)
            .query('INSERT INTO RCV_InspectionGalleryLinks (GalleryPictureId, ResponseId, PictureType) OUTPUT INSERTED.Id VALUES (@galleryPictureId, @responseId, @pictureType)');
        // Update HasPicture flag
        await pool.request().input('responseId', sql.Int, responseId)
            .query('UPDATE RCV_InspectionItems SET HasPicture = 1 WHERE Id = @responseId');
        res.json({ success: true, linkId: result.recordset[0].Id });
    } catch (error) {
        console.error('Error assigning gallery picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Unassign gallery picture from item
router.delete('/api/gallery/unassign/:linkId', async (req, res) => {
    try {
        const { linkId } = req.params;
        const pool = await getPool();
        const linkResult = await pool.request().input('id', sql.Int, linkId)
            .query('SELECT ResponseId FROM RCV_InspectionGalleryLinks WHERE Id = @id');
        if (linkResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Link not found' });
        }
        const responseId = linkResult.recordset[0].ResponseId;
        await pool.request().input('id', sql.Int, linkId)
            .query('DELETE FROM RCV_InspectionGalleryLinks WHERE Id = @id');
        // Check if item still has pictures
        const pictureCheck = await pool.request().input('responseId', sql.Int, responseId)
            .query(`SELECT (SELECT COUNT(*) FROM RCV_InspectionPictures WHERE ItemId = @responseId) + (SELECT COUNT(*) FROM RCV_InspectionGalleryLinks WHERE ResponseId = @responseId) as TotalPictures`);
        if (pictureCheck.recordset[0].TotalPictures === 0) {
            await pool.request().input('responseId', sql.Int, responseId)
                .query('UPDATE RCV_InspectionItems SET HasPicture = 0 WHERE Id = @responseId');
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error unassigning gallery picture:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get assignments for a gallery picture
router.get('/api/gallery/picture/:pictureId/assignments', async (req, res) => {
    try {
        const { pictureId } = req.params;
        const pool = await getPool();
        const result = await pool.request().input('pictureId', sql.Int, pictureId)
            .query(`
                SELECT l.Id as LinkId, l.PictureType, l.AssignedAt,
                       i.Id as ResponseId, i.ReferenceValue, i.Question, i.SectionName
                FROM RCV_InspectionGalleryLinks l
                INNER JOIN RCV_InspectionItems i ON i.Id = l.ResponseId
                WHERE l.GalleryPictureId = @pictureId
                ORDER BY l.AssignedAt DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching picture assignments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get gallery pictures assigned to a response/item
router.get('/api/gallery/item/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const pool = await getPool();
        const result = await pool.request().input('responseId', sql.Int, responseId)
            .query(`
                SELECT l.Id as LinkId, l.PictureType, l.AssignedAt,
                       g.Id as GalleryPictureId, g.FileName, g.FilePath, g.OriginalName
                FROM RCV_InspectionGalleryLinks l
                INNER JOIN RCV_InspectionGallery g ON g.Id = l.GalleryPictureId
                WHERE l.ResponseId = @responseId
                ORDER BY l.AssignedAt DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching item gallery pictures:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unassigned pictures for an audit
router.get('/api/gallery/:auditId/unassigned', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();
        const result = await pool.request().input('auditId', sql.Int, auditId)
            .query(`
                SELECT g.Id, g.FileName, g.FilePath, g.OriginalName, g.UploadedAt
                FROM RCV_InspectionGallery g
                WHERE g.InspectionId = @auditId
                AND NOT EXISTS (SELECT 1 FROM RCV_InspectionGalleryLinks l WHERE l.GalleryPictureId = g.Id)
                ORDER BY g.UploadedAt DESC
            `);
        res.json({ success: true, data: result.recordset, count: result.recordset.length });
    } catch (error) {
        console.error('Error fetching unassigned pictures:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete all unassigned pictures for an audit
router.delete('/api/gallery/:auditId/unassigned', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await getPool();
        const files = await pool.request().input('auditId', sql.Int, auditId)
            .query(`
                SELECT g.Id, g.FilePath FROM RCV_InspectionGallery g
                WHERE g.InspectionId = @auditId
                AND NOT EXISTS (SELECT 1 FROM RCV_InspectionGalleryLinks l WHERE l.GalleryPictureId = g.Id)
            `);
        for (const file of files.recordset) {
            await pool.request().input('id', sql.Int, file.Id)
                .query('DELETE FROM RCV_InspectionGallery WHERE Id = @id');
            const filePath = path.join(__dirname, '..', '..', file.FilePath);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
            }
        }
        res.json({ success: true, deleted: files.recordset.length });
    } catch (error) {
        console.error('Error deleting unassigned pictures:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ EMAIL FUNCTIONALITY ============

// Get email recipients for RCV audit
router.get('/api/audits/:auditId/email-recipients', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { reportType } = req.query; // 'full' or 'action-plan'
        const pool = await getPool();
        
        // Get audit info with store
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id as auditId,
                    i.DocumentNumber,
                    i.StoreId,
                    s.StoreName,
                    s.StoreCode,
                    s.BrandId,
                    b.BrandName,
                    b.BrandCode,
                    b.PrimaryColor as BrandColor,
                    i.Score as TotalScore,
                    i.InspectionDate,
                    i.Inspectors,
                    i.Status,
                    i.CreatedBy
                FROM RCV_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        let toRecipient = null;
        
        // For action-plan reports, send to the inspector who created the audit
        if (reportType === 'action-plan' && audit.CreatedBy) {
            const inspectorResult = await pool.request()
                .input('userId', sql.Int, audit.CreatedBy)
                .query(`SELECT Id, Email, DisplayName FROM Users WHERE Id = @userId AND IsActive = 1`);
            
            if (inspectorResult.recordset.length > 0) {
                const inspector = inspectorResult.recordset[0];
                toRecipient = { email: inspector.Email, name: inspector.DisplayName };
            }
        } else {
            // For full reports, send to store manager
            const storeManagerResult = await pool.request()
                .input('storeId', sql.Int, audit.StoreId)
                .query(`
                    SELECT TOP 1 u.Id, u.Email, u.DisplayName
                    FROM StoreManagerAssignments sma
                    INNER JOIN Users u ON sma.UserId = u.Id
                    WHERE sma.StoreId = @storeId AND sma.IsPrimary = 1 AND u.IsActive = 1
                `);
            
            if (storeManagerResult.recordset.length > 0) {
                const storeManager = storeManagerResult.recordset[0];
                toRecipient = { email: storeManager.Email, name: storeManager.DisplayName };
            }
        }
        
        // Get CC suggestions (brand responsibles)
        const ccSuggestions = [];
        if (audit.BrandId) {
            const brandResponsiblesResult = await pool.request()
                .input('brandId', sql.Int, audit.BrandId)
                .query(`
                    SELECT 
                        br.AreaManagerId, am.Email as AreaManagerEmail, am.DisplayName as AreaManagerName,
                        br.HeadOfOpsId, ho.Email as HeadOfOpsEmail, ho.DisplayName as HeadOfOpsName
                    FROM OE_BrandResponsibles br
                    LEFT JOIN Users am ON br.AreaManagerId = am.Id AND am.IsActive = 1
                    LEFT JOIN Users ho ON br.HeadOfOpsId = ho.Id AND ho.IsActive = 1
                    WHERE br.BrandId = @brandId AND br.IsActive = 1
                `);
            
            if (brandResponsiblesResult.recordset.length > 0) {
                const br = brandResponsiblesResult.recordset[0];
                if (br.AreaManagerEmail) {
                    ccSuggestions.push({ email: br.AreaManagerEmail, name: br.AreaManagerName, role: 'Area Manager' });
                }
                if (br.HeadOfOpsEmail) {
                    ccSuggestions.push({ email: br.HeadOfOpsEmail, name: br.HeadOfOpsName, role: 'Head of Operations' });
                }
            }
        }
        
        res.json({
            success: true,
            audit: {
                auditId: audit.auditId,
                documentNumber: audit.DocumentNumber,
                storeName: audit.StoreName,
                storeCode: audit.StoreCode,
                brandName: audit.BrandName,
                brandCode: audit.BrandCode,
                totalScore: audit.TotalScore,
                inspectionDate: audit.InspectionDate,
                inspectors: audit.Inspectors,
                status: audit.Status
            },
            to: toRecipient,
            ccSuggestions: ccSuggestions,
            from: req.currentUser ? {
                email: req.currentUser.email,
                name: req.currentUser.displayName || req.currentUser.name || req.currentUser.email
            } : null
        });
    } catch (error) {
        console.error('Error fetching email recipients:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get email preview for RCV audit
router.get('/api/audits/:auditId/email-preview', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { reportType } = req.query; // 'full' or 'action-plan'
        const pool = await getPool();
        
        // Get audit details
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, s.StoreName, s.StoreCode,
                    b.BrandCode, i.Score as TotalScore, i.InspectionDate, i.Inspectors, i.Status,
                    i.Cycle, i.Year
                FROM RCV_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Build report URL
        const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const reportUrl = reportType === 'action-plan' 
            ? `${appUrl}/receiving-audit/api/audits/reports/RCV_ActionPlan_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`
            : `${appUrl}/receiving-audit/api/audits/reports/RCV_Report_audit-${auditId}_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Get findings stats for action plan
        let findingsStats = null;
        if (reportType === 'action-plan') {
            const findingsResult = await pool.request()
                .input('auditId', sql.Int, auditId)
                .query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN Priority = 'Critical' OR Priority = 'High' THEN 1 ELSE 0 END) as high,
                        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) as medium,
                        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) as low
                    FROM RCV_InspectionActionItems
                    WHERE InspectionId = @auditId
                `);
            findingsStats = findingsResult.recordset[0];
        }
        
        // Build email using template builder
        const auditData = {
            documentNumber: audit.DocumentNumber,
            storeName: audit.StoreName,
            storeCode: audit.StoreCode,
            brandCode: audit.BrandCode,
            inspectionDate: audit.InspectionDate,
            auditDate: audit.InspectionDate,
            inspectorName: audit.Inspectors,
            auditors: audit.Inspectors,
            totalScore: audit.TotalScore,
            status: audit.Status,
            cycle: audit.Cycle,
            year: audit.Year,
            passingGrade: 80
        };
        
        // Use database template
        const emailContent = await emailTemplateBuilder.buildEmailFromDB('RCV', reportType, auditData, reportUrl, findingsStats);
        
        res.json({
            success: true,
            subject: emailContent.subject,
            bodyHtml: emailContent.body,
            reportUrl: reportUrl
        });
    } catch (error) {
        console.error('Error generating email preview:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send RCV report email
router.post('/api/audits/:auditId/send-report-email', async (req, res) => {
    try {
        const { auditId } = req.params;
        const { reportType, to, cc } = req.body;
        
        // Handle both array format and object format
        let toRecipient;
        if (Array.isArray(to) && to.length > 0) {
            toRecipient = to[0];
        } else if (to && to.email) {
            toRecipient = to;
        }
        
        if (!toRecipient || !toRecipient.email) {
            return res.status(400).json({ success: false, error: 'Recipient (to) is required' });
        }
        
        const pool = await getPool();
        
        // Get audit details
        const auditResult = await pool.request()
            .input('auditId', sql.Int, auditId)
            .query(`
                SELECT 
                    i.Id, i.DocumentNumber, i.StoreId, s.StoreName, s.StoreCode,
                    s.BrandId, b.BrandName, b.BrandCode, 
                    i.Score as TotalScore, i.InspectionDate, i.Inspectors, i.Status, i.Cycle, i.Year
                FROM RCV_Inspections i
                INNER JOIN Stores s ON i.StoreId = s.Id
                LEFT JOIN Brands b ON s.BrandId = b.Id
                WHERE i.Id = @auditId
            `);
        
        if (auditResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Audit not found' });
        }
        
        const audit = auditResult.recordset[0];
        
        // Build report URL
        const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const reportUrl = reportType === 'action-plan' 
            ? `${appUrl}/receiving-audit/api/audits/reports/RCV_ActionPlan_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`
            : `${appUrl}/receiving-audit/api/audits/reports/RCV_Report_audit-${auditId}_${audit.DocumentNumber}_${new Date().toISOString().split('T')[0]}.html`;
        
        // Get findings stats for action plan
        let findingsStats = null;
        if (reportType === 'action-plan') {
            const findingsResult = await pool.request()
                .input('auditId', sql.Int, auditId)
                .query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN Priority = 'Critical' OR Priority = 'High' THEN 1 ELSE 0 END) as high,
                        SUM(CASE WHEN Priority = 'Medium' THEN 1 ELSE 0 END) as medium,
                        SUM(CASE WHEN Priority = 'Low' THEN 1 ELSE 0 END) as low
                    FROM RCV_InspectionActionItems
                    WHERE InspectionId = @auditId
                `);
            findingsStats = findingsResult.recordset[0];
        }
        
        // Build email content
        const auditData = {
            documentNumber: audit.DocumentNumber,
            storeName: audit.StoreName,
            storeCode: audit.StoreCode,
            brandCode: audit.BrandCode,
            inspectionDate: audit.InspectionDate,
            auditDate: audit.InspectionDate,
            inspectorName: audit.Inspectors,
            auditors: audit.Inspectors,
            totalScore: audit.TotalScore,
            status: audit.Status,
            cycle: audit.Cycle,
            year: audit.Year,
            passingGrade: 80
        };
        
        const emailContent = await emailTemplateBuilder.buildEmailFromDB('RCV', reportType, auditData, reportUrl, findingsStats);
        
        // Build CC string
        const ccEmails = cc && cc.length > 0 ? cc.map(c => c.email).join(',') : null;
        
        // Get fresh access token for the current user
        let accessToken;
        try {
            accessToken = await getFreshAccessToken(req.currentUser);
        } catch (tokenError) {
            console.error('[RCV] Token refresh failed:', tokenError.message);
            return res.status(401).json({ 
                success: false, 
                error: 'Your session has expired. Please log out and log in again.',
                needsRelogin: true 
            });
        }
        
        // Send email from the logged-in user's account
        const emailResult = await emailService.sendEmail({
            to: toRecipient.email,
            subject: emailContent.subject,
            body: emailContent.body,
            cc: ccEmails,
            accessToken: accessToken
        });
        
        // Log the email
        await pool.request()
            .input('auditId', sql.Int, auditId)
            .input('documentNumber', sql.NVarChar, audit.DocumentNumber)
            .input('module', sql.NVarChar, 'RCV')
            .input('reportType', sql.NVarChar, reportType)
            .input('sentBy', sql.Int, req.currentUser?.userId || 0)
            .input('sentByEmail', sql.NVarChar, req.currentUser?.email || 'Unknown')
            .input('sentByName', sql.NVarChar, req.currentUser?.displayName || 'Unknown')
            .input('sentTo', sql.NVarChar, JSON.stringify([toRecipient]))
            .input('ccRecipients', sql.NVarChar, cc ? JSON.stringify(cc) : null)
            .input('subject', sql.NVarChar, emailContent.subject)
            .input('reportUrl', sql.NVarChar, reportUrl)
            .input('status', sql.NVarChar, emailResult.success ? 'sent' : 'failed')
            .input('errorMessage', sql.NVarChar, emailResult.error || null)
            .input('storeId', sql.Int, audit.StoreId)
            .input('storeName', sql.NVarChar, audit.StoreName)
            .input('brandId', sql.Int, audit.BrandId)
            .input('brandName', sql.NVarChar, audit.BrandName)
            .query(`
                INSERT INTO ReportEmailLog 
                (AuditId, DocumentNumber, Module, ReportType, SentBy, SentByEmail, SentByName, 
                 SentTo, CcRecipients, Subject, ReportUrl, Status, ErrorMessage, 
                 StoreId, StoreName, BrandId, BrandName, SentAt)
                VALUES 
                (@auditId, @documentNumber, @module, @reportType, @sentBy, @sentByEmail, @sentByName,
                 @sentTo, @ccRecipients, @subject, @reportUrl, @status, @errorMessage,
                 @storeId, @storeName, @brandId, @brandName, GETDATE())
            `);
        
        if (emailResult.success) {
            console.log(`✅ RCV Report email sent: ${audit.DocumentNumber} to ${toRecipient.email}`);
            res.json({ success: true, message: 'Email sent successfully' });
        } else {
            console.error(`❌ RCV Report email failed: ${audit.DocumentNumber}`, emailResult.error);
            res.status(500).json({ success: false, error: emailResult.error || 'Failed to send email' });
        }
    } catch (error) {
        console.error('Error sending report email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
