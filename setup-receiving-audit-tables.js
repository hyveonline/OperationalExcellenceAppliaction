/**
 * Run Receiving Audit tables SQL on specified database
 * Usage: node setup-receiving-audit-tables.js [uat|live]
 */

const env = process.argv[2] || 'uat';
const envFile = env === 'live' ? '.env.live' : '.env';
require('dotenv').config({ path: envFile });
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || (env === 'live' ? 'OEApp_Live' : 'OEApp_UAT'),
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

async function runScript() {
    console.log(`\n=== Setting up Receiving Audit on ${env.toUpperCase()} ===`);
    console.log('Database:', config.database);
    console.log('Connecting...\n');
    
    try {
        const pool = await sql.connect(config);
        
        const sqlFile = path.join(__dirname, 'sql', 'setup-receiving-audit-tables.sql');
        let sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        const batches = sqlContent.split(/\nGO\s*\n/i);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`Running batch ${i + 1}/${batches.length}...`);
                try {
                    const result = await pool.request().query(batch);
                    if (result.output && result.output.message) {
                        console.log(' ', result.output.message);
                    }
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
            WHERE TABLE_NAME LIKE 'RCV_%'
            ORDER BY TABLE_NAME
        `);
        
        console.log('\nReceiving Audit Tables:');
        tables.recordset.forEach(t => console.log('  ✓ ' + t.TABLE_NAME));
        
        // Verify Forms entries
        const forms = await pool.request().query(`
            SELECT FormCode, FormName, MenuId, ShowOnDashboard 
            FROM Forms WHERE FormCode LIKE 'RCV_%'
        `);
        
        console.log('\nForms Registry:');
        forms.recordset.forEach(f => console.log(`  ✓ ${f.FormCode} (MenuId: ${f.MenuId}, Dashboard: ${f.ShowOnDashboard ? 'Yes' : 'No'})`));
        
        await pool.close();
        console.log('\nDone!');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

runScript();
