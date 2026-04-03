/**
 * Fix corrupted emoji icons in DailyTask_TaskItems table
 * The emojis were double-encoded as UTF-8
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

// Correct emoji mappings based on task names
const iconFixes = [
    { taskName: 'Trash Bins', icon: '🗑️' },
    { taskName: 'Soap Dispenser', icon: '🧴' },
    { taskName: 'Napkins Dispenser', icon: '🧻' },
    { taskName: 'Offices', icon: '🏢' },
    { taskName: 'Closets/Ground/Wall/Glass', icon: '🧹' },
    { taskName: 'Canteen', icon: '🍽️' },
    { taskName: 'Toilets and Kitchens', icon: '🚻' }
];

async function fixIcons() {
    console.log('Using database:', config.database);
    console.log('Connecting...');
    
    try {
        const pool = await sql.connect(config);
        
        console.log('\n=== Fixing Task Icons ===\n');
        
        for (const fix of iconFixes) {
            const result = await pool.request()
                .input('taskName', sql.NVarChar, fix.taskName)
                .input('icon', sql.NVarChar, fix.icon)
                .query(`
                    UPDATE DailyTask_TaskItems 
                    SET TaskIcon = @icon 
                    WHERE TaskName = @taskName
                `);
            
            console.log(`✓ ${fix.taskName} => ${fix.icon} (${result.rowsAffected[0]} rows)`);
        }
        
        // Verify the fix
        console.log('\n=== Verification ===\n');
        const tasks = await pool.request().query(`
            SELECT TaskName, TaskIcon FROM DailyTask_TaskItems WHERE IsActive = 1 ORDER BY SortOrder
        `);
        
        tasks.recordset.forEach(t => {
            console.log(`  ${t.TaskName}: ${t.TaskIcon}`);
        });
        
        await pool.close();
        console.log('\nDone! Icons fixed successfully.');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

fixIcons();
