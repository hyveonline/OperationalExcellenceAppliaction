const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

(async () => {
    const pool = await sql.connect(config);
    
    // Clear audit #1 so it re-seeds with all columns now
    await pool.request().query("DELETE FROM SEC_InspectionItems WHERE InspectionId = 1");
    await pool.request().query("DELETE FROM SEC_InspectionSections WHERE InspectionId = 1");
    console.log('Cleared audit #1 for re-seed');
    
    // Test document number generation
    const prefixResult = await pool.request().query("SELECT SettingValue FROM SEC_InspectionSettings WHERE SettingKey = 'DOCUMENT_PREFIX'");
    const prefix = prefixResult.recordset[0]?.SettingValue || 'GMRL-SEC';
    console.log('Prefix:', prefix);
    
    const maxResult = await pool.request()
        .input('prefix', sql.NVarChar, prefix + '-%')
        .query("SELECT MAX(CAST(RIGHT(DocumentNumber, 4) AS INT)) as maxNum FROM SEC_Inspections WHERE DocumentNumber LIKE @prefix");
    console.log('Max num:', maxResult.recordset[0]?.maxNum);
    
    const nextNum = (maxResult.recordset[0]?.maxNum || 0) + 1;
    console.log('Next doc number:', prefix + '-' + String(nextNum).padStart(4, '0'));
    
    // Verify columns now
    const r = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionItems' ORDER BY ORDINAL_POSITION");
    console.log('Columns now:', r.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    await pool.close();
})().catch(e => console.error(e.message));
