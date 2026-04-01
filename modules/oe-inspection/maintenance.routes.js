/**
 * Maintenance Integration Routes
 * Proxy routes to connect OE Inspection with Maintenance WR system
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const maintenanceService = require('../../services/maintenance-integration.service');

// Database config (same as main index.js)
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

/**
 * GET /api/maintenance/locations
 * Get available locations from Maintenance system
 */
router.get('/locations', async (req, res) => {
    try {
        const result = await maintenanceService.getLocations();
        res.json(result);
    } catch (error) {
        console.error('Error getting maintenance locations:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/maintenance/recent-wrs
 * Get recent work requests for a location
 * Query params: locationCode, days (optional, default 30)
 */
router.get('/recent-wrs', async (req, res) => {
    try {
        const { locationCode, days } = req.query;
        
        if (!locationCode) {
            return res.status(400).json({ success: false, message: 'locationCode is required' });
        }
        
        const result = await maintenanceService.getRecentWorkRequests(locationCode, parseInt(days) || 30);
        res.json(result);
    } catch (error) {
        console.error('Error getting recent WRs:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/maintenance/create-wr
 * Create a new Work Request in the Maintenance system
 */
router.post('/create-wr', async (req, res) => {
    try {
        const { locationCode, storeName, priority, title, description, sourceApp, sourceType, sourceId, sourceRef, sectionName, referenceValue } = req.body;
        
        // Validation
        if (!locationCode || !sourceId) {
            return res.status(400).json({ 
                success: false, 
                message: 'locationCode and sourceId are required' 
            });
        }
        
        // Get user info from session
        const requestedBy = req.session?.user?.displayName || req.session?.user?.name || 'OE System';
        const requestedByEmail = req.session?.user?.email || 'oe-system@gmrlgroup.com';
        
        const result = await maintenanceService.createWorkRequest({
            locationCode,
            storeName,
            priority: priority || 'Medium',
            title,
            sectionName,
            referenceValue,
            description,
            requestedBy,
            requestedByEmail,
            sourceApp: sourceApp || 'OE_INSPECTION',
            sourceType: sourceType || 'Finding',
            sourceId,
            sourceRef
        });
        
        // If successful, update the OE database to track the WR link
        if (result.success && result.data?.wrNumber && sourceId) {
            try {
                const pool = await sql.connect(dbConfig);
                await pool.request()
                    .input('responseId', sql.Int, sourceId)
                    .input('wrNumber', sql.NVarChar, result.data.wrNumber)
                    .input('userId', sql.Int, req.session?.user?.id || null)
                    .query(`
                        UPDATE OE_InspectionItems 
                        SET MaintenanceWRNumber = @wrNumber,
                            SentToMaintenance = 1,
                            SentToMaintenanceAt = GETDATE(),
                            LinkedByUserId = @userId
                        WHERE Id = @responseId
                    `);
                await pool.close();
            } catch (dbError) {
                console.error('Error updating OE database with WR link:', dbError);
                // Don't fail the whole request for this
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error creating WR:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/maintenance/link-wr
 * Link an existing Work Request to an OE finding
 */
router.post('/link-wr', async (req, res) => {
    try {
        const { wrNumber, sourceApp, sourceType, sourceId, sourceRef } = req.body;
        
        if (!wrNumber || !sourceId) {
            return res.status(400).json({ 
                success: false, 
                message: 'wrNumber and sourceId are required' 
            });
        }
        
        const result = await maintenanceService.linkToWorkRequest(wrNumber, {
            sourceApp: sourceApp || 'OE_INSPECTION',
            sourceType: sourceType || 'Finding',
            sourceId,
            sourceRef
        });
        
        // If successful, update the OE database to track the WR link
        if (result.success) {
            try {
                const pool = await sql.connect(dbConfig);
                await pool.request()
                    .input('responseId', sql.Int, sourceId)
                    .input('wrNumber', sql.NVarChar, wrNumber)
                    .input('userId', sql.Int, req.session?.user?.id || null)
                    .query(`
                        UPDATE OE_InspectionItems 
                        SET MaintenanceWRNumber = @wrNumber,
                            SentToMaintenance = 1,
                            SentToMaintenanceAt = GETDATE(),
                            LinkedByUserId = @userId
                        WHERE Id = @responseId
                    `);
                await pool.close();
            } catch (dbError) {
                console.error('Error updating OE database with WR link:', dbError);
                // Don't fail the whole request for this
            }
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error linking WR:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/maintenance/wr-status/:wrNumber
 * Get status of a Work Request
 */
router.get('/wr-status/:wrNumber', async (req, res) => {
    try {
        const { wrNumber } = req.params;
        
        if (!wrNumber) {
            return res.status(400).json({ success: false, message: 'wrNumber is required' });
        }
        
        const result = await maintenanceService.getWorkRequestStatus(wrNumber);
        res.json(result);
    } catch (error) {
        console.error('Error getting WR status:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/action-plan/maintenance-link
 * Save maintenance WR link to OE database directly (used by action-plan.html)
 */
router.post('/action-plan/maintenance-link', async (req, res) => {
    try {
        const { responseId, wrNumber } = req.body;
        
        if (!responseId || !wrNumber) {
            return res.status(400).json({ 
                success: false, 
                message: 'responseId and wrNumber are required' 
            });
        }
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('responseId', sql.Int, responseId)
            .input('wrNumber', sql.NVarChar, wrNumber)
            .input('userId', sql.Int, req.session?.user?.id || null)
            .query(`
                UPDATE OE_InspectionItems 
                SET MaintenanceWRNumber = @wrNumber,
                    SentToMaintenance = 1,
                    SentToMaintenanceAt = GETDATE(),
                    LinkedByUserId = @userId
                WHERE Id = @responseId
            `);
        await pool.close();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving maintenance link:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
