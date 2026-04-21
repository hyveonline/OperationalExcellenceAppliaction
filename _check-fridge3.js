require('dotenv').config();
const sql = require('mssql');
(async () => {
    const pool = await sql.connect({
        server: process.env.SQL_SERVER, database: 'OEApp_UAT',
        user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
        options: { encrypt: process.env.SQL_ENCRYPT === 'true', trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' }
    });
    const r = await pool.request().query("SELECT * FROM OE_FridgeReadings WHERE InspectionId = 94 ORDER BY CreatedAt DESC");
    console.log('Rows:', r.recordset.length);
    r.recordset.forEach(x => console.log(JSON.stringify(x)));
    await pool.close();
})();
