/**
 * Multi-Zone Team Configuration Routes
 * Admin interface for configuring zones, time slots, and agent assignments
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');

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

// Main config page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'config.html'));
});

// API: Get all zones for Multi-Zone Team
router.get('/api/zones', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT z.*, 
                    (SELECT COUNT(*) FROM DailyTask_AgentAssignments WHERE ZoneId = z.Id AND IsActive = 1) as AssignedAgentCount
                FROM DailyTask_Zones z
                WHERE z.TeamTypeId = 1 AND z.IsActive = 1
                ORDER BY z.SortOrder, z.ZoneName
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching zones:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get all time slots
router.get('/api/timeslots', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT * FROM DailyTask_TimeSlots 
                WHERE IsActive = 1
                ORDER BY SortOrder, StartTime
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching time slots:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get zone schedule (zone + time slot tasks)
router.get('/api/schedule', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT 
                    z.Id AS ZoneId,
                    z.ZoneName,
                    z.AgentCount,
                    ts.Id AS TimeSlotId,
                    ts.SlotName,
                    ts.IsBreak,
                    ISNULL(ztst.TaskDescription, '') AS TaskDescription,
                    ztst.Id AS TaskId
                FROM DailyTask_Zones z
                CROSS JOIN DailyTask_TimeSlots ts
                LEFT JOIN DailyTask_ZoneTimeSlotTasks ztst ON z.Id = ztst.ZoneId AND ts.Id = ztst.TimeSlotId
                WHERE z.TeamTypeId = 1 AND z.IsActive = 1 AND ts.IsActive = 1
                ORDER BY z.SortOrder, z.ZoneName, ts.SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching schedule:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Add new zone
router.post('/api/zones', async (req, res) => {
    const { zoneName, zoneDescription, agentCount } = req.body;
    
    if (!zoneName) {
        return res.status(400).json({ error: 'Zone name is required' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('zoneName', sql.NVarChar, zoneName)
            .input('zoneDescription', sql.NVarChar, zoneDescription || '')
            .input('agentCount', sql.Int, agentCount || 1)
            .input('teamTypeId', sql.Int, 1) // Multi-Zone Team
            .query(`
                INSERT INTO DailyTask_Zones (TeamTypeId, ZoneName, ZoneDescription, AgentCount, SortOrder)
                OUTPUT INSERTED.*
                VALUES (@teamTypeId, @zoneName, @zoneDescription, @agentCount, 
                    (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM DailyTask_Zones WHERE TeamTypeId = 1))
            `);
        await pool.close();
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error adding zone:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Update zone
router.put('/api/zones/:id', async (req, res) => {
    const { id } = req.params;
    const { zoneName, zoneDescription, agentCount } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .input('zoneName', sql.NVarChar, zoneName)
            .input('zoneDescription', sql.NVarChar, zoneDescription || '')
            .input('agentCount', sql.Int, agentCount || 1)
            .query(`
                UPDATE DailyTask_Zones 
                SET ZoneName = @zoneName, ZoneDescription = @zoneDescription, 
                    AgentCount = @agentCount, UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating zone:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Delete zone (soft delete)
router.delete('/api/zones/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE DailyTask_Zones SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting zone:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Update time slot task description
router.post('/api/schedule/task', async (req, res) => {
    const { zoneId, timeSlotId, taskDescription } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check if mapping exists
        const existing = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('timeSlotId', sql.Int, timeSlotId)
            .query(`SELECT Id FROM DailyTask_ZoneTimeSlotTasks WHERE ZoneId = @zoneId AND TimeSlotId = @timeSlotId`);
        
        if (existing.recordset.length > 0) {
            // Update existing
            await pool.request()
                .input('zoneId', sql.Int, zoneId)
                .input('timeSlotId', sql.Int, timeSlotId)
                .input('taskDescription', sql.NVarChar, taskDescription || '')
                .query(`
                    UPDATE DailyTask_ZoneTimeSlotTasks 
                    SET TaskDescription = @taskDescription, UpdatedAt = GETDATE()
                    WHERE ZoneId = @zoneId AND TimeSlotId = @timeSlotId
                `);
        } else {
            // Insert new
            await pool.request()
                .input('zoneId', sql.Int, zoneId)
                .input('timeSlotId', sql.Int, timeSlotId)
                .input('taskDescription', sql.NVarChar, taskDescription || '')
                .query(`
                    INSERT INTO DailyTask_ZoneTimeSlotTasks (ZoneId, TimeSlotId, TaskDescription)
                    VALUES (@zoneId, @timeSlotId, @taskDescription)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get all users for agent assignment dropdown
router.get('/api/users', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT Id, DisplayName, Email 
                FROM Users 
                WHERE IsActive = 1 
                ORDER BY DisplayName
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get agent assignments for a zone
router.get('/api/zones/:zoneId/agents', async (req, res) => {
    const { zoneId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .query(`
                SELECT aa.*, u.DisplayName, u.Email
                FROM DailyTask_AgentAssignments aa
                JOIN Users u ON aa.UserId = u.Id
                WHERE aa.ZoneId = @zoneId AND aa.IsActive = 1
                ORDER BY u.DisplayName
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching agents:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Assign agent to zone
router.post('/api/zones/:zoneId/agents', async (req, res) => {
    const { zoneId } = req.params;
    const { userId } = req.body;
    const currentUser = req.currentUser;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check if already assigned
        const existing = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('userId', sql.Int, userId)
            .query(`SELECT Id FROM DailyTask_AgentAssignments WHERE ZoneId = @zoneId AND UserId = @userId AND IsActive = 1`);
        
        if (existing.recordset.length > 0) {
            await pool.close();
            return res.status(400).json({ error: 'Agent is already assigned to this zone' });
        }
        
        const result = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('userId', sql.Int, userId)
            .input('assignedBy', sql.Int, currentUser?.id || null)
            .query(`
                INSERT INTO DailyTask_AgentAssignments (ZoneId, UserId, AssignedBy)
                OUTPUT INSERTED.*
                VALUES (@zoneId, @userId, @assignedBy)
            `);
        
        await pool.close();
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Error assigning agent:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Remove agent from zone
router.delete('/api/zones/:zoneId/agents/:userId', async (req, res) => {
    const { zoneId, userId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('userId', sql.Int, userId)
            .query(`UPDATE DailyTask_AgentAssignments SET IsActive = 0 WHERE ZoneId = @zoneId AND UserId = @userId`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error removing agent:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
