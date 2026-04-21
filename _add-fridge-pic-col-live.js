require('dotenv').config();
const sql = require('mssql');
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: 'OEApp_Live',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: { encrypt: process.env.SQL_ENCRYPT === 'true', trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' }
};
async function run() {
    const pool = await sql.connect(dbConfig);
    await pool.request().query(`
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'OE_FridgeReadings' AND COLUMN_NAME = 'Picture'
        )
        ALTER TABLE OE_FridgeReadings ADD Picture NVARCHAR(MAX) NULL
    `);
    console.log('LIVE: Picture column added to OE_FridgeReadings');
    const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OE_FridgeReadings' ORDER BY ORDINAL_POSITION`);
    console.log('Columns:', cols.recordset.map(c => c.COLUMN_NAME).join(', '));
    process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
