/**
 * Daily Tasks Routes
 * Form filling interface for cleaners to submit daily task completions
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
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

// Main task filling page
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'fill-form.html'));
});

// Dashboard / History page
router.get('/history', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'history.html'));
});

// API: Get current user's assigned zones
router.get('/api/my-zones', async (req, res) => {
    const user = req.currentUser;
    
    if (!user || !user.id) {
        // Return empty array if user not found - they'll see "no zones assigned" message
        return res.json([]);
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('userId', sql.Int, user.id)
            .query(`
                SELECT 
                    z.Id AS ZoneId,
                    z.ZoneName,
                    z.ZoneDescription,
                    z.AgentCount,
                    tt.Id AS TeamTypeId,
                    tt.TeamTypeName
                FROM DailyTask_AgentAssignments aa
                JOIN DailyTask_Zones z ON aa.ZoneId = z.Id
                JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
                WHERE aa.UserId = @userId AND aa.IsActive = 1 AND z.IsActive = 1
                ORDER BY tt.SortOrder, z.SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching user zones:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get all zones (for admins to view all)
router.get('/api/zones', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT 
                    z.Id AS ZoneId,
                    z.ZoneName,
                    z.ZoneDescription,
                    z.AgentCount,
                    tt.Id AS TeamTypeId,
                    tt.TeamTypeName
                FROM DailyTask_Zones z
                JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
                WHERE z.IsActive = 1
                ORDER BY tt.SortOrder, z.SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching zones:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get team types
router.get('/api/team-types', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT Id, TeamTypeName, Description, AgentCount
                FROM DailyTask_TeamTypes
                WHERE IsActive = 1
                ORDER BY SortOrder
            `);
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching team types:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get complete checklist form for a team type (all zones with their tasks)
router.get('/api/form/team/:teamTypeId', async (req, res) => {
    const { teamTypeId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get team type info
        const teamResult = await pool.request()
            .input('teamTypeId', sql.Int, teamTypeId)
            .query(`SELECT * FROM DailyTask_TeamTypes WHERE Id = @teamTypeId`);
        
        // Get all zones for this team type
        const zonesResult = await pool.request()
            .input('teamTypeId', sql.Int, teamTypeId)
            .query(`
                SELECT Id AS ZoneId, ZoneName, ZoneDescription, AgentCount
                FROM DailyTask_Zones
                WHERE TeamTypeId = @teamTypeId AND IsActive = 1
                ORDER BY SortOrder
            `);
        
        const zones = zonesResult.recordset;
        
        if (parseInt(teamTypeId) === 1) {
            // Multi-Zone Team: Get time slots
            const slotsResult = await pool.request()
                .query(`
                    SELECT Id AS TimeSlotId, SlotName, StartTime, EndTime, IsBreak
                    FROM DailyTask_TimeSlots
                    WHERE IsActive = 1
                    ORDER BY SortOrder
                `);
            
            // Get task descriptions for each zone-timeslot combo
            const tasksResult = await pool.request()
                .input('teamTypeId', sql.Int, teamTypeId)
                .query(`
                    SELECT ztst.ZoneId, ztst.TimeSlotId, ztst.TaskDescription
                    FROM DailyTask_ZoneTimeSlotTasks ztst
                    JOIN DailyTask_Zones z ON ztst.ZoneId = z.Id
                    WHERE z.TeamTypeId = @teamTypeId AND ztst.IsActive = 1
                `);
            
            // Map task descriptions to zones
            const taskMap = {};
            tasksResult.recordset.forEach(t => {
                if (!taskMap[t.ZoneId]) taskMap[t.ZoneId] = {};
                taskMap[t.ZoneId][t.TimeSlotId] = t.TaskDescription;
            });
            
            // Add task descriptions to zones
            zones.forEach(z => {
                z.timeSlotTasks = taskMap[z.ZoneId] || {};
            });
            
            await pool.close();
            res.json({
                teamType: teamResult.recordset[0],
                zones: zones,
                timeSlots: slotsResult.recordset
            });
        } else {
            // Fixed Area Team: Get task items with applicability per zone
            const tasksResult = await pool.request()
                .query(`SELECT Id AS TaskItemId, TaskName, TaskDescription, TaskIcon FROM DailyTask_TaskItems WHERE IsActive = 1 ORDER BY SortOrder`);
            
            // Get applicability mapping
            const mappingResult = await pool.request()
                .input('teamTypeId', sql.Int, teamTypeId)
                .query(`
                    SELECT ztm.ZoneId, ztm.TaskItemId, ztm.IsApplicable
                    FROM DailyTask_ZoneTaskMapping ztm
                    JOIN DailyTask_Zones z ON ztm.ZoneId = z.Id
                    WHERE z.TeamTypeId = @teamTypeId
                `);
            
            // Map applicability
            const applicabilityMap = {};
            mappingResult.recordset.forEach(m => {
                if (!applicabilityMap[m.ZoneId]) applicabilityMap[m.ZoneId] = {};
                applicabilityMap[m.ZoneId][m.TaskItemId] = m.IsApplicable;
            });
            
            // Add applicability to zones
            zones.forEach(z => {
                z.taskApplicability = applicabilityMap[z.ZoneId] || {};
            });
            
            await pool.close();
            res.json({
                teamType: teamResult.recordset[0],
                zones: zones,
                tasks: tasksResult.recordset
            });
        }
    } catch (err) {
        console.error('Error fetching team form:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get form data for Fixed Area Team
router.get('/api/form/fixed-area/:zoneId', async (req, res) => {
    const { zoneId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get zone info
        const zoneResult = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .query(`
                SELECT z.*, tt.TeamTypeName
                FROM DailyTask_Zones z
                JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
                WHERE z.Id = @zoneId
            `);
        
        // Get task items with applicability
        const tasksResult = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .query(`
                SELECT 
                    ti.Id AS TaskItemId,
                    ti.TaskName,
                    ti.TaskDescription,
                    ti.TaskIcon,
                    ISNULL(ztm.IsApplicable, 1) AS IsApplicable
                FROM DailyTask_TaskItems ti
                LEFT JOIN DailyTask_ZoneTaskMapping ztm ON ti.Id = ztm.TaskItemId AND ztm.ZoneId = @zoneId
                WHERE ti.IsActive = 1
                ORDER BY ti.SortOrder
            `);
        
        await pool.close();
        
        res.json({
            zone: zoneResult.recordset[0],
            tasks: tasksResult.recordset
        });
    } catch (err) {
        console.error('Error fetching fixed area form:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get form data for Multi-Zone Team
router.get('/api/form/multi-zone/:zoneId', async (req, res) => {
    const { zoneId } = req.params;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get zone info
        const zoneResult = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .query(`
                SELECT z.*, tt.TeamTypeName
                FROM DailyTask_Zones z
                JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
                WHERE z.Id = @zoneId
            `);
        
        // Get time slots with tasks
        const slotsResult = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .query(`
                SELECT 
                    ts.Id AS TimeSlotId,
                    ts.SlotName,
                    ts.StartTime,
                    ts.EndTime,
                    ts.IsBreak,
                    ISNULL(ztst.TaskDescription, '') AS TaskDescription
                FROM DailyTask_TimeSlots ts
                LEFT JOIN DailyTask_ZoneTimeSlotTasks ztst ON ts.Id = ztst.TimeSlotId AND ztst.ZoneId = @zoneId
                WHERE ts.IsActive = 1
                ORDER BY ts.SortOrder
            `);
        
        await pool.close();
        
        res.json({
            zone: zoneResult.recordset[0],
            timeSlots: slotsResult.recordset
        });
    } catch (err) {
        console.error('Error fetching multi-zone form:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get entry data for entire team type (all zones)
router.get('/api/entry/team/:teamTypeId', async (req, res) => {
    const { teamTypeId } = req.params;
    const { dateFrom, dateTo } = req.query;
    
    if (!dateFrom || !dateTo) {
        return res.status(400).json({ error: 'dateFrom and dateTo are required' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Get all zones for this team type
        const zonesResult = await pool.request()
            .input('teamTypeId', sql.Int, teamTypeId)
            .query(`SELECT Id FROM DailyTask_Zones WHERE TeamTypeId = @teamTypeId AND IsActive = 1`);
        
        const zoneIds = zonesResult.recordset.map(z => z.Id);
        
        // Get all entries for these zones and date range
        const entriesResult = await pool.request()
            .input('dateFrom', sql.Date, dateFrom)
            .input('dateTo', sql.Date, dateTo)
            .query(`
                SELECT * FROM DailyTask_Entries
                WHERE ZoneId IN (${zoneIds.join(',')}) 
                AND DateFrom = @dateFrom AND DateTo = @dateTo AND Status = 'Active'
            `);
        
        const entries = entriesResult.recordset;
        const entryMap = {};
        entries.forEach(e => { entryMap[e.ZoneId] = e; });
        
        // Get all details
        let allDetails = [];
        if (entries.length > 0) {
            const entryIds = entries.map(e => e.Id);
            
            if (parseInt(teamTypeId) === 1) {
                // Multi-Zone
                const detailsResult = await pool.request()
                    .query(`
                        SELECT ed.*, e.ZoneId
                        FROM DailyTask_EntryDetails_MultiZone ed
                        JOIN DailyTask_Entries e ON ed.EntryId = e.Id
                        WHERE ed.EntryId IN (${entryIds.join(',')})
                    `);
                allDetails = detailsResult.recordset;
            } else {
                // Fixed Area
                const detailsResult = await pool.request()
                    .query(`
                        SELECT ed.*, e.ZoneId
                        FROM DailyTask_EntryDetails_FixedArea ed
                        JOIN DailyTask_Entries e ON ed.EntryId = e.Id
                        WHERE ed.EntryId IN (${entryIds.join(',')})
                    `);
                allDetails = detailsResult.recordset;
            }
        }
        
        await pool.close();
        res.json({
            entries: entryMap,
            details: allDetails,
            hasData: entries.length > 0
        });
    } catch (err) {
        console.error('Error fetching team entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Save entry data for entire team type (all zones)
router.post('/api/entry/team/:teamTypeId', async (req, res) => {
    const { teamTypeId } = req.params;
    const { dateFrom, dateTo, details } = req.body;
    const user = req.currentUser;
    
    if (!dateFrom || !dateTo || !details) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Group details by zoneId
        const detailsByZone = {};
        details.forEach(d => {
            if (!detailsByZone[d.zoneId]) detailsByZone[d.zoneId] = [];
            detailsByZone[d.zoneId].push(d);
        });
        
        // Process each zone
        for (const zoneId of Object.keys(detailsByZone)) {
            // Check for existing entry
            const existingResult = await pool.request()
                .input('zoneId', sql.Int, zoneId)
                .input('dateFrom', sql.Date, dateFrom)
                .input('dateTo', sql.Date, dateTo)
                .query(`
                    SELECT Id FROM DailyTask_Entries
                    WHERE ZoneId = @zoneId AND DateFrom = @dateFrom AND DateTo = @dateTo AND Status = 'Active'
                `);
            
            let entryId;
            
            if (existingResult.recordset.length > 0) {
                entryId = existingResult.recordset[0].Id;
                await pool.request()
                    .input('entryId', sql.Int, entryId)
                    .query(`UPDATE DailyTask_Entries SET UpdatedAt = GETDATE() WHERE Id = @entryId`);
            } else {
                const insertResult = await pool.request()
                    .input('zoneId', sql.Int, zoneId)
                    .input('teamTypeId', sql.Int, teamTypeId)
                    .input('dateFrom', sql.Date, dateFrom)
                    .input('dateTo', sql.Date, dateTo)
                    .input('createdById', sql.Int, user?.id || null)
                    .input('createdByName', sql.NVarChar, user?.displayName || user?.email || 'Unknown')
                    .query(`
                        INSERT INTO DailyTask_Entries (ZoneId, TeamTypeId, DateFrom, DateTo, CreatedById, CreatedByName)
                        OUTPUT INSERTED.Id
                        VALUES (@zoneId, @teamTypeId, @dateFrom, @dateTo, @createdById, @createdByName)
                    `);
                entryId = insertResult.recordset[0].Id;
                
                // Trigger workflow engine for new entries (non-blocking)
                workflowEngine.start({
                    formCode: 'DAILY_TASKS',
                    recordId: entryId,
                    recordTable: 'DailyTask_Entries',
                    submitter: { userId: user?.id, email: user?.email, name: user?.displayName },
                    store: {},
                    metaData: { zoneId, teamTypeId, dateFrom, dateTo },
                    accessToken: req.currentUser?.accessToken
                }).catch(err => console.error('[WORKFLOW] Daily tasks error:', err));
            }
            
            // Save details for this zone
            for (const detail of detailsByZone[zoneId]) {
                if (parseInt(teamTypeId) === 1) {
                    // Multi-Zone: TimeSlotId + TaskDate
                    const existingDetail = await pool.request()
                        .input('entryId', sql.Int, entryId)
                        .input('timeSlotId', sql.Int, detail.timeSlotId)
                        .input('taskDate', sql.Date, detail.taskDate)
                        .query(`
                            SELECT Id FROM DailyTask_EntryDetails_MultiZone
                            WHERE EntryId = @entryId AND TimeSlotId = @timeSlotId AND TaskDate = @taskDate
                        `);
                    
                    if (existingDetail.recordset.length > 0) {
                        await pool.request()
                            .input('id', sql.Int, existingDetail.recordset[0].Id)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .query(`
                                UPDATE DailyTask_EntryDetails_MultiZone
                                SET IsCompleted = @isCompleted, CompletedById = @completedById, CompletedByName = @completedByName,
                                    CompletedAt = CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END
                                WHERE Id = @id
                            `);
                    } else {
                        await pool.request()
                            .input('entryId', sql.Int, entryId)
                            .input('timeSlotId', sql.Int, detail.timeSlotId)
                            .input('taskDate', sql.Date, detail.taskDate)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .query(`
                                INSERT INTO DailyTask_EntryDetails_MultiZone 
                                (EntryId, TimeSlotId, TaskDate, IsCompleted, CompletedById, CompletedByName, CompletedAt)
                                VALUES (@entryId, @timeSlotId, @taskDate, @isCompleted, @completedById, @completedByName,
                                    CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END)
                            `);
                    }
                } else {
                    // Fixed Area: TaskItemId + DayOfWeek
                    const existingDetail = await pool.request()
                        .input('entryId', sql.Int, entryId)
                        .input('taskItemId', sql.Int, detail.taskItemId)
                        .input('dayOfWeek', sql.Int, detail.dayOfWeek)
                        .query(`
                            SELECT Id FROM DailyTask_EntryDetails_FixedArea
                            WHERE EntryId = @entryId AND TaskItemId = @taskItemId AND DayOfWeek = @dayOfWeek
                        `);
                    
                    if (existingDetail.recordset.length > 0) {
                        await pool.request()
                            .input('id', sql.Int, existingDetail.recordset[0].Id)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .query(`
                                UPDATE DailyTask_EntryDetails_FixedArea
                                SET IsCompleted = @isCompleted, CompletedById = @completedById, CompletedByName = @completedByName,
                                    CompletedAt = CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END
                                WHERE Id = @id
                            `);
                    } else {
                        await pool.request()
                            .input('entryId', sql.Int, entryId)
                            .input('taskItemId', sql.Int, detail.taskItemId)
                            .input('dayOfWeek', sql.Int, detail.dayOfWeek)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .query(`
                                INSERT INTO DailyTask_EntryDetails_FixedArea 
                                (EntryId, TaskItemId, DayOfWeek, IsCompleted, CompletedById, CompletedByName, CompletedAt)
                                VALUES (@entryId, @taskItemId, @dayOfWeek, @isCompleted, @completedById, @completedByName,
                                    CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END)
                            `);
                    }
                }
            }
        }
        
        await pool.close();
        res.json({ success: true, message: 'Saved successfully' });
    } catch (err) {
        console.error('Error saving team entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get or create entry for a zone and date range
router.get('/api/entry', async (req, res) => {
    const { zoneId, dateFrom, dateTo } = req.query;
    
    if (!zoneId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: 'zoneId, dateFrom, and dateTo are required' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check for existing entry
        const existingResult = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('dateFrom', sql.Date, dateFrom)
            .input('dateTo', sql.Date, dateTo)
            .query(`
                SELECT * FROM DailyTask_Entries
                WHERE ZoneId = @zoneId AND DateFrom = @dateFrom AND DateTo = @dateTo AND Status = 'Active'
            `);
        
        if (existingResult.recordset.length > 0) {
            const entry = existingResult.recordset[0];
            
            // Get entry details based on team type
            let details = [];
            if (entry.TeamTypeId === 1) {
                // Multi-Zone: get time slot details
                const detailsResult = await pool.request()
                    .input('entryId', sql.Int, entry.Id)
                    .query(`
                        SELECT ed.*, ts.SlotName
                        FROM DailyTask_EntryDetails_MultiZone ed
                        JOIN DailyTask_TimeSlots ts ON ed.TimeSlotId = ts.Id
                        WHERE ed.EntryId = @entryId
                        ORDER BY ed.TaskDate, ts.SortOrder
                    `);
                details = detailsResult.recordset;
            } else {
                // Fixed Area: get task item details
                const detailsResult = await pool.request()
                    .input('entryId', sql.Int, entry.Id)
                    .query(`
                        SELECT ed.*, ti.TaskName, ti.TaskIcon
                        FROM DailyTask_EntryDetails_FixedArea ed
                        JOIN DailyTask_TaskItems ti ON ed.TaskItemId = ti.Id
                        WHERE ed.EntryId = @entryId
                        ORDER BY ed.DayOfWeek, ti.SortOrder
                    `);
                details = detailsResult.recordset;
            }
            
            await pool.close();
            res.json({ entry, details, isNew: false });
        } else {
            await pool.close();
            res.json({ entry: null, details: [], isNew: true });
        }
    } catch (err) {
        console.error('Error fetching entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Create or update entry with details
router.post('/api/entry', async (req, res) => {
    const { zoneId, teamTypeId, dateFrom, dateTo, details } = req.body;
    const user = req.currentUser;
    
    if (!zoneId || !teamTypeId || !dateFrom || !dateTo) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const pool = await sql.connect(dbConfig);
        
        // Check for existing entry
        const existingResult = await pool.request()
            .input('zoneId', sql.Int, zoneId)
            .input('dateFrom', sql.Date, dateFrom)
            .input('dateTo', sql.Date, dateTo)
            .query(`
                SELECT Id FROM DailyTask_Entries
                WHERE ZoneId = @zoneId AND DateFrom = @dateFrom AND DateTo = @dateTo AND Status = 'Active'
            `);
        
        let entryId;
        
        if (existingResult.recordset.length > 0) {
            entryId = existingResult.recordset[0].Id;
            
            // Update entry timestamp
            await pool.request()
                .input('entryId', sql.Int, entryId)
                .query(`UPDATE DailyTask_Entries SET UpdatedAt = GETDATE() WHERE Id = @entryId`);
        } else {
            // Create new entry
            const insertResult = await pool.request()
                .input('zoneId', sql.Int, zoneId)
                .input('teamTypeId', sql.Int, teamTypeId)
                .input('dateFrom', sql.Date, dateFrom)
                .input('dateTo', sql.Date, dateTo)
                .input('createdById', sql.Int, user?.id || null)
                .input('createdByName', sql.NVarChar, user?.displayName || user?.email || 'Unknown')
                .query(`
                    INSERT INTO DailyTask_Entries (ZoneId, TeamTypeId, DateFrom, DateTo, CreatedById, CreatedByName)
                    OUTPUT INSERTED.Id
                    VALUES (@zoneId, @teamTypeId, @dateFrom, @dateTo, @createdById, @createdByName)
                `);
            entryId = insertResult.recordset[0].Id;
        }
        
        // Process details
        if (details && details.length > 0) {
            for (const detail of details) {
                if (teamTypeId === 1) {
                    // Multi-Zone: TimeSlotId + TaskDate
                    const existingDetail = await pool.request()
                        .input('entryId', sql.Int, entryId)
                        .input('timeSlotId', sql.Int, detail.timeSlotId)
                        .input('taskDate', sql.Date, detail.taskDate)
                        .query(`
                            SELECT Id FROM DailyTask_EntryDetails_MultiZone
                            WHERE EntryId = @entryId AND TimeSlotId = @timeSlotId AND TaskDate = @taskDate
                        `);
                    
                    if (existingDetail.recordset.length > 0) {
                        // Update existing
                        await pool.request()
                            .input('id', sql.Int, existingDetail.recordset[0].Id)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .input('notes', sql.NVarChar, detail.notes || null)
                            .query(`
                                UPDATE DailyTask_EntryDetails_MultiZone
                                SET IsCompleted = @isCompleted, 
                                    CompletedById = @completedById,
                                    CompletedByName = @completedByName,
                                    CompletedAt = CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END,
                                    Notes = @notes
                                WHERE Id = @id
                            `);
                    } else {
                        // Insert new
                        await pool.request()
                            .input('entryId', sql.Int, entryId)
                            .input('timeSlotId', sql.Int, detail.timeSlotId)
                            .input('taskDate', sql.Date, detail.taskDate)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .input('notes', sql.NVarChar, detail.notes || null)
                            .query(`
                                INSERT INTO DailyTask_EntryDetails_MultiZone 
                                (EntryId, TimeSlotId, TaskDate, IsCompleted, CompletedById, CompletedByName, CompletedAt, Notes)
                                VALUES (@entryId, @timeSlotId, @taskDate, @isCompleted, @completedById, @completedByName,
                                    CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END, @notes)
                            `);
                    }
                } else {
                    // Fixed Area: TaskItemId + DayOfWeek
                    const existingDetail = await pool.request()
                        .input('entryId', sql.Int, entryId)
                        .input('taskItemId', sql.Int, detail.taskItemId)
                        .input('dayOfWeek', sql.Int, detail.dayOfWeek)
                        .query(`
                            SELECT Id FROM DailyTask_EntryDetails_FixedArea
                            WHERE EntryId = @entryId AND TaskItemId = @taskItemId AND DayOfWeek = @dayOfWeek
                        `);
                    
                    if (existingDetail.recordset.length > 0) {
                        // Update existing
                        await pool.request()
                            .input('id', sql.Int, existingDetail.recordset[0].Id)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .input('notes', sql.NVarChar, detail.notes || null)
                            .query(`
                                UPDATE DailyTask_EntryDetails_FixedArea
                                SET IsCompleted = @isCompleted, 
                                    CompletedById = @completedById,
                                    CompletedByName = @completedByName,
                                    CompletedAt = CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END,
                                    Notes = @notes
                                WHERE Id = @id
                            `);
                    } else {
                        // Insert new
                        await pool.request()
                            .input('entryId', sql.Int, entryId)
                            .input('taskItemId', sql.Int, detail.taskItemId)
                            .input('dayOfWeek', sql.Int, detail.dayOfWeek)
                            .input('isCompleted', sql.Bit, detail.isCompleted ? 1 : 0)
                            .input('completedById', sql.Int, detail.isCompleted ? (user?.id || null) : null)
                            .input('completedByName', sql.NVarChar, detail.isCompleted ? (user?.displayName || user?.email || 'Unknown') : null)
                            .input('notes', sql.NVarChar, detail.notes || null)
                            .query(`
                                INSERT INTO DailyTask_EntryDetails_FixedArea 
                                (EntryId, TaskItemId, DayOfWeek, IsCompleted, CompletedById, CompletedByName, CompletedAt, Notes)
                                VALUES (@entryId, @taskItemId, @dayOfWeek, @isCompleted, @completedById, @completedByName,
                                    CASE WHEN @isCompleted = 1 THEN GETDATE() ELSE NULL END, @notes)
                            `);
                    }
                }
            }
        }
        
        await pool.close();
        res.json({ success: true, entryId });
    } catch (err) {
        console.error('Error saving entry:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get entry history - grouped by team type and date range
router.get('/api/entries', async (req, res) => {
    const { teamTypeId, dateFrom, dateTo } = req.query;
    
    try {
        const pool = await sql.connect(dbConfig);
        
        let whereClause = "e.Status = 'Active'";
        const request = pool.request();
        
        if (teamTypeId) {
            whereClause += ' AND e.TeamTypeId = @teamTypeId';
            request.input('teamTypeId', sql.Int, teamTypeId);
        }
        if (dateFrom) {
            whereClause += ' AND e.DateFrom >= @dateFrom';
            request.input('dateFrom', sql.Date, dateFrom);
        }
        if (dateTo) {
            whereClause += ' AND e.DateTo <= @dateTo';
            request.input('dateTo', sql.Date, dateTo);
        }
        
        // Group by TeamTypeId, DateFrom, DateTo to show ONE entry per team per week
        const result = await request.query(`
            WITH EntryCounts AS (
                SELECT 
                    e.Id AS EntryId,
                    e.TeamTypeId,
                    e.ZoneId,
                    e.DateFrom,
                    e.DateTo,
                    e.CreatedAt,
                    e.UpdatedAt,
                    e.CreatedByName,
                    ISNULL(fa.CompletedCount, 0) + ISNULL(mz.CompletedCount, 0) AS CompletedTasks,
                    ISNULL(fa.TotalCount, 0) + ISNULL(mz.TotalCount, 0) AS TotalTasks
                FROM DailyTask_Entries e
                LEFT JOIN (
                    SELECT EntryId, 
                           COUNT(*) AS TotalCount,
                           SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS CompletedCount
                    FROM DailyTask_EntryDetails_FixedArea
                    GROUP BY EntryId
                ) fa ON fa.EntryId = e.Id
                LEFT JOIN (
                    SELECT EntryId, 
                           COUNT(*) AS TotalCount,
                           SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS CompletedCount
                    FROM DailyTask_EntryDetails_MultiZone
                    GROUP BY EntryId
                ) mz ON mz.EntryId = e.Id
                WHERE ${whereClause}
            )
            SELECT 
                ec.TeamTypeId,
                tt.TeamTypeName,
                ec.DateFrom,
                ec.DateTo,
                COUNT(DISTINCT ec.ZoneId) AS ZonesCompleted,
                (SELECT COUNT(*) FROM DailyTask_Zones WHERE TeamTypeId = ec.TeamTypeId AND IsActive = 1) AS TotalZones,
                SUM(ec.CompletedTasks) AS CompletedTasks,
                SUM(ec.TotalTasks) AS TotalTasks,
                MIN(ec.CreatedAt) AS CreatedAt,
                MAX(ec.UpdatedAt) AS UpdatedAt,
                MAX(ec.CreatedByName) AS LastUpdatedBy
            FROM EntryCounts ec
            JOIN DailyTask_TeamTypes tt ON ec.TeamTypeId = tt.Id
            GROUP BY ec.TeamTypeId, tt.TeamTypeName, ec.DateFrom, ec.DateTo
            ORDER BY ec.DateFrom DESC, ec.TeamTypeId
        `);
        
        await pool.close();
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching entries:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Get current user info
router.get('/api/current-user', (req, res) => {
    const user = req.currentUser;
    res.json({
        id: user?.id,
        displayName: user?.displayName,
        email: user?.email,
        role: user?.role
    });
});

module.exports = router;
