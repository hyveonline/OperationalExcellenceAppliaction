/**
 * Check and fix corrupted icons in Forms table
 * 
 * Usage: node check-form-icons.js [live|uat]
 */

const env = process.argv[2] || 'live';
require('dotenv').config({ path: env === 'uat' ? '.env' : '.env.live' });
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

async function checkIcons() {
    console.log('Using database:', config.database);
    console.log('Connecting...\n');
    
    try {
        const pool = await sql.connect(config);
        
        // First check what columns exist
        const cols = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Forms'
            ORDER BY ORDINAL_POSITION
        `);
        console.log('=== Forms Table Columns ===');
        cols.recordset.forEach(c => console.log('  ' + c.COLUMN_NAME));
        
        // Check all forms with icons
        const forms = await pool.request().query(`
            SELECT FormCode, FormName, DashboardIcon, DashboardCategoryIcon, StoresPageIcon
            FROM Forms 
            WHERE DashboardIcon IS NOT NULL OR DashboardCategoryIcon IS NOT NULL OR StoresPageIcon IS NOT NULL
            ORDER BY FormName
        `);
        
        console.log('\n=== Forms with Icons ===\n');
        forms.recordset.forEach(f => {
            console.log(`${f.FormCode}: "${f.FormName}"`);
            console.log(`  DashboardIcon: ${f.DashboardIcon || '(none)'}`);
            console.log(`  DashboardCategoryIcon: ${f.DashboardCategoryIcon || '(none)'}`);
            console.log(`  StoresPageIcon: ${f.StoresPageIcon || '(none)'}`);
            console.log('');
        });
        
        await pool.close();
        console.log('Done!');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkIcons();
