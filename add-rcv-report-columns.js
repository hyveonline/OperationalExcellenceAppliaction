// Add ReportFileName and ReportGeneratedAt columns to RCV_Inspections
// Run: node add-rcv-report-columns.js [uat|live|both]

require('dotenv').config();
const sql = require('mssql');

const baseConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true }
};

async function addColumns(database) {
    const config = { ...baseConfig, database };
    console.log(`\n📦 Processing ${database}...`);
    
    try {
        const pool = await sql.connect(config);
        
        // Check and add ReportFileName
        const col1 = await pool.request().query(`
            SELECT 1 FROM sys.columns 
            WHERE object_id = OBJECT_ID('RCV_Inspections') AND name = 'ReportFileName'
        `);
        if (col1.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE RCV_Inspections ADD ReportFileName NVARCHAR(500) NULL`);
            console.log('  ✅ Added ReportFileName column');
        } else {
            console.log('  ℹ️ ReportFileName already exists');
        }
        
        // Check and add ReportGeneratedAt
        const col2 = await pool.request().query(`
            SELECT 1 FROM sys.columns 
            WHERE object_id = OBJECT_ID('RCV_Inspections') AND name = 'ReportGeneratedAt'
        `);
        if (col2.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE RCV_Inspections ADD ReportGeneratedAt DATETIME2 NULL`);
            console.log('  ✅ Added ReportGeneratedAt column');
        } else {
            console.log('  ℹ️ ReportGeneratedAt already exists');
        }
        
        await pool.close();
        console.log(`✅ ${database} completed successfully`);
        return true;
    } catch (error) {
        console.error(`❌ ${database} Error:`, error.message);
        return false;
    }
}

(async () => {
    const arg = process.argv[2] || 'both';
    
    if (arg === 'uat' || arg === 'both') {
        await addColumns('OEApp_UAT');
    }
    if (arg === 'live' || arg === 'both') {
        await addColumns('OEApp_Live');
    }
    
    console.log('\n🎉 Done!');
    process.exit(0);
})();
