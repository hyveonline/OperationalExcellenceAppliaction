const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

(async () => {
    const pool = await sql.connect(config);
    
    const r1 = await pool.request().query("SELECT * FROM SEC_InspectionSettings WHERE SettingKey='DOCUMENT_PREFIX'");
    console.log('Prefix setting:', JSON.stringify(r1.recordset));
    
    const r2 = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionItems' ORDER BY ORDINAL_POSITION");
    console.log('SEC_InspectionItems columns:', r2.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    const r3 = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionSettings' ORDER BY ORDINAL_POSITION");
    console.log('SEC_InspectionSettings columns:', r3.recordset.map(c => c.COLUMN_NAME).join(', '));

    const r4 = await pool.request().query("SELECT COUNT(*) as cnt FROM SEC_InspectionSettings");
    console.log('Settings count:', r4.recordset[0].cnt);
    
    await pool.close();
})().catch(e => console.error(e.message));
