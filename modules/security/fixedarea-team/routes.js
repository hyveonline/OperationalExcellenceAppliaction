/**
 * Fixed Area Team Configuration Routes
 * Admin interface for configuring areas, task items, and agent assignments
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

// API: Get all zones for Fixed Area Team
router.get('/api/zones', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT z.*, 
                    (SELECT COUNT(*) FROM DailyTask_AgentAssignments WHERE ZoneId = z.Id AND IsActive = 1) as AssignedAgentCount
                FROM DailyTask_Zones z
                WHERE z.TeamTypeId = 2 AND z.IsActive = 1
                ORDER BY z.SortOrder, z.ZoneName
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching zones:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get all task items
router.get('/api/tasks', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT * FROM DailyTask_TaskItems 
                WHERE IsActive = 1
                ORDER BY SortOrder, TaskName
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get zone-task mapping matrix
router.get('/api/matrix', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT 
                    z.Id AS ZoneId,
                    z.ZoneName,
                    z.AgentCount,
                    ti.Id AS TaskItemId,
                    ti.TaskName,
                    ti.TaskIcon,
                    ISNULL(ztm.IsApplicable, 1) AS IsApplicable,
                    ztm.Notes
                FROM DailyTask_Zones z
                CROSS JOIN DailyTask_TaskItems ti
                LEFT JOIN DailyTask_ZoneTaskMapping ztm ON z.Id = ztm.ZoneId AND ti.Id = ztm.TaskItemId
                WHERE z.TeamTypeId = 2 AND z.IsActive = 1 AND ti.IsActive = 1
                ORDER BY z.SortOrder, z.ZoneName, ti.SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching matrix:', err);
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
        
        // Insert zone
        const result = await pool.request()
            .input('zoneName', sql.NVarChar, zoneName)
            .input('zoneDescription', sql.NVarChar, zoneDescription || '')
            .input('agentCount', sql.Int, agentCount || 1)
            .input('teamTypeId', sql.Int, 2) // Fixed Area Team
            .query(`
                INSERT INTO DailyTask_Zones (TeamTypeId, ZoneName, ZoneDescription, AgentCount, SortOrder)
                OUTPUT INSERTED.*
                VALUES (@teamTypeId, @zoneName, @zoneDescription, @agentCount, 
                    (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM DailyTask_Zones WHERE TeamTypeId = 2))
            `);
        
        const newZone = result.recordset[0];
        
        // Create default task mappings (all applicable by default)
        await pool.request()
            .input('zoneId', sql.Int, newZone.Id)
            .query(`
                INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
                SELECT @zoneId, Id, 1 FROM DailyTask_TaskItems WHERE IsActive = 1
            `);
        
        await pool.close();
        res.json(newZone);
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

// API: Update task applicability for a zone
router.post('/api/matrix/update', async (req, res) => {
    const { zoneId, taskItemId, isApplicable } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check if mapping exists
        const existing = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('taskItemId', sql.Int, taskItemId)
            .query(`SELECT Id FROM DailyTask_ZoneTaskMapping WHERE ZoneId = @zoneId AND TaskItemId = @taskItemId`);
        
        if (existing.recordset.length > 0) {
            // Update existing
            await pool.request()
                .input('zoneId', sql.Int, zoneId)
                .input('taskItemId', sql.Int, taskItemId)
                .input('isApplicable', sql.Bit, isApplicable ? 1 : 0)
                .query(`
                    UPDATE DailyTask_ZoneTaskMapping 
                    SET IsApplicable = @isApplicable, UpdatedAt = GETDATE()
                    WHERE ZoneId = @zoneId AND TaskItemId = @taskItemId
                `);
        } else {
            // Insert new
            await pool.request()
                .input('zoneId', sql.Int, zoneId)
                .input('taskItemId', sql.Int, taskItemId)
                .input('isApplicable', sql.Bit, isApplicable ? 1 : 0)
                .query(`
                    INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
                    VALUES (@zoneId, @taskItemId, @isApplicable)
                `);
        }
        
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating matrix:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Add new task item
router.post('/api/tasks', async (req, res) => {
    const { taskName, taskDescription, taskIcon } = req.body;
    
    if (!taskName) {
        return res.status(400).json({ error: 'Task name is required' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Insert task
        const result = await pool.request()
            .input('taskName', sql.NVarChar, taskName)
            .input('taskDescription', sql.NVarChar, taskDescription || '')
            .input('taskIcon', sql.NVarChar, taskIcon || '📋')
            .query(`
                INSERT INTO DailyTask_TaskItems (TaskName, TaskDescription, TaskIcon, SortOrder)
                OUTPUT INSERTED.*
                VALUES (@taskName, @taskDescription, @taskIcon,
                    (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM DailyTask_TaskItems))
            `);
        
        const newTask = result.recordset[0];
        
        // Create mappings for all Fixed Area zones (applicable by default)
        await pool.request()
            .input('taskItemId', sql.Int, newTask.Id)
            .query(`
                INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
                SELECT Id, @taskItemId, 1 FROM DailyTask_Zones WHERE TeamTypeId = 2 AND IsActive = 1
            `);
        
        await pool.close();
        res.json(newTask);
    } catch (err) {
        console.error('Error adding task:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Update task item
router.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { taskName, taskDescription, taskIcon } = req.body;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .input('taskName', sql.NVarChar, taskName)
            .input('taskDescription', sql.NVarChar, taskDescription || '')
            .input('taskIcon', sql.NVarChar, taskIcon || '📋')
            .query(`
                UPDATE DailyTask_TaskItems 
                SET TaskName = @taskName, TaskDescription = @taskDescription, TaskIcon = @taskIcon
                WHERE Id = @id
            `);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Delete task item (soft delete)
router.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id)
            .query(`UPDATE DailyTask_TaskItems SET IsActive = 0 WHERE Id = @id`);
        await pool.close();
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting task:', err);
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
