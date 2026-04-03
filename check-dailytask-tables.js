/**
 * Check DailyTask tables in database
 */

require('dotenv').config({ path: '.env.live' });
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_Live',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

console.log('Using database:', config.database);

async function checkTables() {
    try {
        console.log('Connecting to ' + config.database + '...');
        const pool = await sql.connect(config);
        
        // Check for DailyTask tables
        const tables = await pool.request().query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'DailyTask%'
            ORDER BY TABLE_NAME
        `);
        
        console.log('\n=== DailyTask Tables in DB ===');
        if (tables.recordset.length === 0) {
            console.log('NO DailyTask tables found!');
        } else {
            tables.recordset.forEach(t => console.log('  - ' + t.TABLE_NAME));
        }
        
        // Check zones
        console.log('\n=== Checking DailyTask_Zones ===');
        try {
            const zones = await pool.request().query(`
                SELECT * FROM DailyTask_Zones WHERE TeamTypeId = 2 AND IsActive = 1
            `);
            console.log('Zones found:', zones.recordset.length);
            zones.recordset.forEach(z => console.log(`  - ${z.Id}: ${z.ZoneName}`));
        } catch (e) {
            console.log('Error:', e.message);
        }
        
        // Check tasks
        console.log('\n=== Checking DailyTask_TaskItems ===');
        try {
            const tasks = await pool.request().query(`
                SELECT * FROM DailyTask_TaskItems WHERE IsActive = 1
            `);
            console.log('Tasks found:', tasks.recordset.length);
        } catch (e) {
            console.log('Error:', e.message);
        }
        
        // Check zone-task mapping
        console.log('\n=== Checking DailyTask_ZoneTaskMapping ===');
        try {
            const matrix = await pool.request().query(`
                SELECT COUNT(*) as cnt FROM DailyTask_ZoneTaskMapping
            `);
            console.log('Zone-Task mappings:', matrix.recordset[0].cnt);
        } catch (e) {
            console.log('Error:', e.message);
        }
        
        // Check Users table
        console.log('\n=== Checking Users Table ===');
        try {
            const users = await pool.request().query(`
                SELECT COUNT(*) as cnt FROM Users WHERE IsActive = 1
            `);
            console.log('Active users:', users.recordset[0].cnt);
        } catch (e) {
            console.log('Error:', e.message);
        }
        
        // Check agent assignments
        console.log('\n=== Checking DailyTask_AgentAssignments ===');
        try {
            const assigns = await pool.request().query(`
                SELECT COUNT(*) as cnt FROM DailyTask_AgentAssignments WHERE IsActive = 1
            `);
            console.log('Active assignments:', assigns.recordset[0].cnt);
        } catch (e) {
            console.log('Error:', e.message);
        }
        
        await pool.close();
        console.log('\nDone!');
    } catch (err) {
        console.error('Connection error:', err.message);
    }
}

checkTables();
