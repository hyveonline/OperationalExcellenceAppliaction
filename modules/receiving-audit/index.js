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
        const pool = await sql.connect(dbConfig);
        const stats = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Draft' THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today
            FROM RCV_Inspections
        `);
        await pool.close();
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
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT SettingKey, SettingValue FROM RCV_InspectionSettings WHERE IsActive = 1');
        await pool.close();
        const settings = {};
        result.recordset.forEach(r => { settings[r.SettingKey] = r.SettingValue; });
        res.json({ success: true, data: settings });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/settings', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
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
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Next Document Number
// ==========================================
router.get('/api/next-document-number', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const prefixResult = await pool.request().query("SELECT SettingValue FROM RCV_InspectionSettings WHERE SettingKey = 'DOCUMENT_PREFIX'");
        const prefix = prefixResult.recordset[0]?.SettingValue || 'GMRL-RCV';
        const maxResult = await pool.request()
            .input('prefix', sql.NVarChar, prefix + '-%')
            .query("SELECT MAX(CAST(RIGHT(DocumentNumber, 4) AS INT)) as maxNum FROM RCV_Inspections WHERE DocumentNumber LIKE @prefix");
        const nextNum = (maxResult.recordset[0]?.maxNum || 0) + 1;
        await pool.close();
        res.json({ success: true, documentNumber: prefix + '-' + String(nextNum).padStart(4, '0') });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Stores API (reuse Stores table)
// ==========================================
router.get('/api/stores', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT Id, StoreName, StoreCode, Brand, Region FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/stores-list', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT Id, StoreName, StoreCode, Brand FROM Stores WHERE IsActive = 1 ORDER BY StoreName');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Template APIs
// ==========================================
router.get('/api/templates/schemas', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT Id as schemaId, TemplateName as schemaName, Description as description, IsDefault as isDefault FROM RCV_InspectionTemplates WHERE IsActive = 1 ORDER BY TemplateName');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/schemas', async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('name', sql.NVarChar, schemaName)
            .input('desc', sql.NVarChar, description || null)
            .input('createdBy', sql.Int, req.currentUser?.userId || 1)
            .query('INSERT INTO RCV_InspectionTemplates (TemplateName, Description, CreatedBy) OUTPUT INSERTED.Id VALUES (@name, @desc, @createdBy)');
        await pool.close();
        res.json({ success: true, data: { schemaId: result.recordset[0].Id } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.get('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const schemaId = parseInt(req.params.schemaId);
        const pool = await sql.connect(dbConfig);
        const templateResult = await pool.request().input('id', sql.Int, schemaId)
            .query('SELECT Id as schemaId, TemplateName as schemaName, Description as description FROM RCV_InspectionTemplates WHERE Id = @id');
        if (templateResult.recordset.length === 0) { await pool.close(); return res.json({ success: false, error: 'Template not found' }); }
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
        await pool.close();
        res.json({ success: true, data: template });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const { schemaName, description } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.schemaId).input('name', sql.NVarChar, schemaName).input('desc', sql.NVarChar, description || null)
            .query('UPDATE RCV_InspectionTemplates SET TemplateName = @name, Description = @desc, UpdatedAt = GETDATE() WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/templates/schemas/:schemaId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.schemaId).query('UPDATE RCV_InspectionTemplates SET IsActive = 0 WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Template Sections
router.get('/api/templates/schemas/:schemaId/sections', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('templateId', sql.Int, req.params.schemaId)
            .query('SELECT Id as sectionId, SectionName as sectionName, SectionIcon as sectionIcon, SectionOrder as sectionNumber FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId AND IsActive = 1 ORDER BY SectionOrder');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/schemas/:schemaId/sections', async (req, res) => {
    try {
        const { sectionName, sectionIcon } = req.body;
        const pool = await sql.connect(dbConfig);
        const maxOrder = await pool.request().input('templateId', sql.Int, req.params.schemaId)
            .query('SELECT ISNULL(MAX(SectionOrder), 0) + 1 as nextOrder FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId');
        const result = await pool.request()
            .input('templateId', sql.Int, req.params.schemaId)
            .input('name', sql.NVarChar, sectionName)
            .input('icon', sql.NVarChar, sectionIcon || '📋')
            .input('order', sql.Int, maxOrder.recordset[0].nextOrder)
            .query('INSERT INTO RCV_InspectionTemplateSections (TemplateId, SectionName, SectionIcon, SectionOrder) OUTPUT INSERTED.Id VALUES (@templateId, @name, @icon, @order)');
        await pool.close();
        res.json({ success: true, data: { sectionId: result.recordset[0].Id } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const { sectionName, sectionIcon, sectionNumber } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.sectionId).input('name', sql.NVarChar, sectionName).input('icon', sql.NVarChar, sectionIcon).input('order', sql.Int, sectionNumber || null)
            .query('UPDATE RCV_InspectionTemplateSections SET SectionName = @name, SectionIcon = ISNULL(@icon, SectionIcon), SectionOrder = ISNULL(@order, SectionOrder) WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/templates/sections/:sectionId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.sectionId).query('UPDATE RCV_InspectionTemplateSections SET IsActive = 0 WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Template Items
router.get('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('sectionId', sql.Int, req.params.sectionId)
            .query(`SELECT Id as itemId, ReferenceValue as referenceValue, Question as title, Coefficient as coeff, AnswerOptions as answer, Criteria as cr, Quantity as quantity, DefaultSeverity as defaultSeverity, IsQuantitative as isQuantitative
                FROM RCV_InspectionTemplateItems WHERE SectionId = @sectionId AND IsActive = 1
                ORDER BY TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 2) AS INT), TRY_CAST(PARSENAME(REPLACE(ReferenceValue, '-', '.'), 1) AS INT)`);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/sections/:sectionId/items', async (req, res) => {
    try {
        const { referenceValue, title, coeff, quantity, answer, cr, defaultSeverity, isQuantitative } = req.body;
        const pool = await sql.connect(dbConfig);
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
        await pool.close();
        res.json({ success: true, data: { itemId: result.recordset[0].Id } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.post('/api/templates/sections/:sectionId/items/bulk', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) return res.json({ success: false, error: 'No items provided' });
        const pool = await sql.connect(dbConfig);
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
        await pool.close();
        res.json({ success: true, data: { imported, skipped } });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.put('/api/templates/items/:itemId', async (req, res) => {
    try {
        const { referenceValue, title, coeff, quantity, answer, cr, defaultSeverity, isQuantitative } = req.body;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, req.params.itemId)
            .input('ref', sql.NVarChar, referenceValue).input('question', sql.NVarChar, title).input('coeff', sql.Decimal(5,2), coeff || 1)
            .input('quantity', sql.Int, quantity || null).input('answer', sql.NVarChar, answer).input('cr', sql.NVarChar, cr || null)
            .input('defaultSeverity', sql.NVarChar, defaultSeverity || null).input('isQuantitative', sql.Bit, isQuantitative || 0)
            .query('UPDATE RCV_InspectionTemplateItems SET ReferenceValue=@ref, Question=@question, Coefficient=@coeff, Quantity=@quantity, AnswerOptions=@answer, Criteria=@cr, DefaultSeverity=@defaultSeverity, IsQuantitative=@isQuantitative WHERE Id=@id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

router.delete('/api/templates/items/:itemId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.itemId).query('UPDATE RCV_InspectionTemplateItems SET IsActive = 0 WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// ==========================================
// Inspection CRUD
// ==========================================
router.post('/api/inspections', async (req, res) => {
    try {
        const { storeId, storeName, documentNumber, inspectionDate, inspectors, accompaniedBy, templateId } = req.body;
        const userId = req.currentUser?.userId || 1;
        const pool = await sql.connect(dbConfig);

        // Determine cycle number: count previous audits for this store + 1
        const cycleResult = await pool.request().input('storeId', sql.Int, storeId)
            .query('SELECT COUNT(*) as cnt FROM RCV_Inspections WHERE StoreId = @storeId');
        const cycle = (cycleResult.recordset[0]?.cnt || 0) + 1;

        const result = await pool.request()
            .input('documentNumber', sql.NVarChar, documentNumber)
            .input('storeId', sql.Int, storeId).input('storeName', sql.NVarChar, storeName)
            .input('inspectionDate', sql.Date, inspectionDate)
            .input('inspectors', sql.NVarChar, inspectors)
            .input('accompaniedBy', sql.NVarChar, accompaniedBy || null)
            .input('cycle', sql.Int, cycle)
            .input('year', sql.Int, new Date(inspectionDate).getFullYear())
            .input('templateId', sql.Int, templateId || null)
            .input('createdBy', sql.Int, userId)
            .query(`INSERT INTO RCV_Inspections (DocumentNumber, StoreId, StoreName, InspectionDate, Inspectors, AccompaniedBy, Cycle, Year, TemplateId, Status, CreatedBy, CreatedAt)
                OUTPUT INSERTED.Id VALUES (@documentNumber, @storeId, @storeName, @inspectionDate, @inspectors, @accompaniedBy, @cycle, @year, @templateId, 'Draft', @createdBy, GETDATE())`);
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
        await pool.close();
        res.json({ success: true, data: { id: inspectionId, documentNumber, cycle } });
    } catch (error) { console.error('Error creating inspection:', error); res.json({ success: false, error: error.message }); }
});

// Get audit details
router.get('/api/audits/:auditId', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        const auditResult = await pool.request().input('id', sql.Int, auditId)
            .query(`SELECT i.Id, i.DocumentNumber, i.StoreId, i.StoreName, i.InspectionDate, i.TimeIn, i.TimeOut, i.Inspectors, i.AccompaniedBy, i.Cycle, i.Year, i.Status, i.Score, i.TotalPoints, i.MaxPoints, i.Comments, i.TemplateId, i.CreatedBy, i.CreatedAt, i.CompletedAt,
                s.StoreCode FROM RCV_Inspections i LEFT JOIN Stores s ON i.StoreId = s.Id WHERE i.Id = @id`);
        if (auditResult.recordset.length === 0) { await pool.close(); return res.status(404).json({ success: false, error: 'Audit not found' }); }
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
        await pool.close();
        res.json({ success: true, data: { auditId: audit.Id, documentNumber: audit.DocumentNumber, storeId: audit.StoreId, storeCode: audit.StoreCode || '', storeName: audit.StoreName, auditDate: audit.InspectionDate, auditors: audit.Inspectors, accompaniedBy: audit.AccompaniedBy, cycle: audit.Cycle, year: audit.Year, status: audit.Status, score: audit.Score, templateId: audit.TemplateId, sections } });
    } catch (error) { console.error('Error fetching audit:', error); res.status(500).json({ success: false, error: error.message }); }
});

// List audits
router.get('/api/audits/list', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`SELECT Id, DocumentNumber, StoreName, InspectionDate, Inspectors, Status, Score, Cycle, Year, CreatedAt FROM RCV_Inspections ORDER BY CreatedAt DESC`);
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Update response
router.put('/api/audits/response/:responseId', async (req, res) => {
    try {
        const { responseId } = req.params;
        const { selectedChoice, coeff, finding, comment, cr, priority, escalate, department } = req.body;
        const pool = await sql.connect(dbConfig);
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
        await pool.close();
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
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('responseId', sql.Int, responseId).input('auditId', sql.Int, auditId)
            .input('fileName', sql.NVarChar, req.file.filename).input('originalName', sql.NVarChar, req.file.originalname)
            .input('contentType', sql.NVarChar, req.file.mimetype).input('pictureType', sql.NVarChar, pictureType)
            .input('filePath', sql.NVarChar, filePath).input('fileSize', sql.Int, stats.size)
            .query('INSERT INTO RCV_InspectionPictures (ItemId, InspectionId, FileName, OriginalName, ContentType, PictureType, FilePath, FileSize, CreatedAt) OUTPUT INSERTED.Id as pictureId VALUES (@responseId, @auditId, @fileName, @originalName, @contentType, @pictureType, @filePath, @fileSize, GETDATE())');
        await pool.request().input('id', sql.Int, responseId).query('UPDATE RCV_InspectionItems SET HasPicture = 1 WHERE Id = @id');
        await pool.close();
        res.json({ success: true, data: { pictureId: result.recordset[0].pictureId, filePath } });
    } catch (error) { console.error('Error uploading picture:', error); res.status(500).json({ success: false, error: error.message }); }
});

// Get pictures for item
router.get('/api/audits/pictures/:responseId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('responseId', sql.Int, req.params.responseId)
            .query('SELECT Id as pictureId, FileName as fileName, OriginalName as originalName, FilePath as filePath, PictureType as pictureType, FileSize as fileSize, CreatedAt as createdAt FROM RCV_InspectionPictures WHERE ItemId = @responseId ORDER BY CreatedAt');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Delete picture
router.delete('/api/audits/pictures/:pictureId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const pic = await pool.request().input('id', sql.Int, req.params.pictureId).query('SELECT FileName, ItemId FROM RCV_InspectionPictures WHERE Id = @id');
        if (pic.recordset.length > 0) {
            const filePath = path.join(uploadDir, pic.recordset[0].FileName);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await pool.request().input('id', sql.Int, req.params.pictureId).query('DELETE FROM RCV_InspectionPictures WHERE Id = @id');
            const remaining = await pool.request().input('itemId', sql.Int, pic.recordset[0].ItemId).query('SELECT COUNT(*) as cnt FROM RCV_InspectionPictures WHERE ItemId = @itemId');
            if (remaining.recordset[0].cnt === 0) await pool.request().input('itemId', sql.Int, pic.recordset[0].ItemId).query('UPDATE RCV_InspectionItems SET HasPicture = 0 WHERE Id = @itemId');
        }
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Complete audit
router.post('/api/audits/:auditId/complete', async (req, res) => {
    try {
        const { auditId } = req.params;
        const pool = await sql.connect(dbConfig);
        const scoreResult = await pool.request().input('auditId', sql.Int, auditId)
            .query("SELECT ISNULL(SUM(Score), 0) as totalPoints, ISNULL(SUM(Coefficient), 0) as maxPoints FROM RCV_InspectionItems WHERE InspectionId = @auditId AND Answer IS NOT NULL AND Answer != 'NA'");
        const { totalPoints, maxPoints } = scoreResult.recordset[0];
        const totalScore = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
        await pool.request().input('auditId', sql.Int, auditId).input('score', sql.Decimal(5,2), totalScore)
            .input('totalPoints', sql.Decimal(10,2), totalPoints).input('maxPoints', sql.Decimal(10,2), maxPoints)
            .query("UPDATE RCV_Inspections SET Status = 'Completed', Score = @score, TotalPoints = @totalPoints, MaxPoints = @maxPoints, CompletedAt = GETDATE(), UpdatedAt = GETDATE() WHERE Id = @auditId");
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
        await pool.close();
        res.json({ success: true, data: { score: totalScore, actionItemsCreated } });
    } catch (error) { console.error('Error completing audit:', error); res.status(500).json({ success: false, error: error.message }); }
});

// Delete audit
router.delete('/api/audits/:auditId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionPictures WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionActionItems WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionItems WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_InspectionSections WHERE InspectionId = @id');
        await pool.request().input('id', sql.Int, req.params.auditId).query('DELETE FROM RCV_Inspections WHERE Id = @id');
        await pool.close();
        res.json({ success: true });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

// Action plan
router.get('/api/action-plan/:inspectionId', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().input('inspectionId', sql.Int, req.params.inspectionId)
            .query('SELECT Id, ReferenceValue, SectionName, Finding, SuggestedAction, Action, Responsible, Department, Deadline, Priority, Status, CompletionDate, CompletionNotes, BeforeImageUrl, AfterImageUrl, CreatedAt FROM RCV_InspectionActionItems WHERE InspectionId = @inspectionId ORDER BY Priority DESC, ReferenceValue');
        await pool.close();
        res.json({ success: true, data: result.recordset });
    } catch (error) { res.json({ success: false, error: error.message }); }
});

module.exports = router;
