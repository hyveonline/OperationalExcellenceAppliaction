require('dotenv').config();
const sql = require('mssql');
(async () => {
    const pool = await sql.connect({
        server: process.env.SQL_SERVER, database: 'OEApp_UAT',
        user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
        options: { encrypt: process.env.SQL_ENCRYPT === 'true', trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' }
    });
    const r = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='OE_FridgeReadings' ORDER BY ORDINAL_POSITION");
    console.log('OE_FridgeReadings columns:', r.recordset.map(x => x.COLUMN_NAME).join(', '));
    await pool.close();
})();
