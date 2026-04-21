require('dotenv').config();
const sql = require('mssql');
(async () => {
    const pool = await sql.connect({
        server: process.env.SQL_SERVER, database: 'OEApp_UAT',
        user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
        options: { encrypt: process.env.SQL_ENCRYPT === 'true', trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' }
    });
    
    // Check what columns OE_InspectionItems has
    const cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='OE_InspectionItems' ORDER BY ORDINAL_POSITION");
    console.log('OE_InspectionItems columns:', cols.recordset.map(x => x.COLUMN_NAME).join(', '));
    
    // Check what sections exist for audit 94
    const sections = await pool.request().query("SELECT Id, SectionName, SectionOrder FROM OE_InspectionSections WHERE InspectionId = 94 ORDER BY SectionOrder");
    console.log('\nSections for audit 94:');
    sections.recordset.forEach(s => console.log(' ', s.Id, s.SectionName));
    
    // Check item 6093 (the one with fridge data)
    const item = await pool.request().query("SELECT Id, SectionName, ReferenceValue FROM OE_InspectionItems WHERE Id = 6093");
    console.log('\nItem 6093:', item.recordset[0]);
    
    await pool.close();
})();
