/**
 * Run Fire Equipment tables SQL on LIVE database
 */

require('dotenv').config({ path: '.env.live' });
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function runScript() {
    console.log('Using database:', config.database);
    console.log('Connecting...\n');
    
    try {
        const pool = await sql.connect(config);
        
        // Read the SQL file
        const sqlFile = path.join(__dirname, 'sql', 'fire-equipment-tables.sql');
        let sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        // Split by GO statements and run each batch
        const batches = sqlContent.split(/\nGO\s*\n/i);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`Running batch ${i + 1}/${batches.length}...`);
                try {
                    await pool.request().query(batch);
                    console.log('  ✓ Success');
                } catch (e) {
                    console.log('  ✗ Error:', e.message);
                }
            }
        }
        
        // Verify tables
        console.log('\n=== Verification ===');
        const tables = await pool.request().query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'FireEquipment%'
            ORDER BY TABLE_NAME
        `);
        
        console.log('\nFire Equipment Tables:');
        tables.recordset.forEach(t => console.log('  ✓ ' + t.TABLE_NAME));
        
        await pool.close();
        console.log('\nDone!');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

runScript();
