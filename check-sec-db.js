const sql = require('mssql');
(async () => {
    const p = await new sql.ConnectionPool({server:'localhost',database:'OEApp_UAT',user:'sa',password:'Kokowawa123@@',options:{encrypt:false,trustServerCertificate:true}}).connect();
    
    const r = await p.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='SEC_InspectionTemplateCategories'`);
    console.log('Categories table exists:', r.recordset.length > 0);
    
    if (r.recordset.length > 0) {
        const c = await p.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionTemplateCategories' ORDER BY ORDINAL_POSITION`);
        console.log('Columns:', c.recordset.map(x=>x.COLUMN_NAME).join(', '));
    }
    
    const i = await p.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionTemplateItems' AND COLUMN_NAME IN ('CategoryId','SubCategory')`);
    console.log('Items new cols:', i.recordset.map(x=>x.COLUMN_NAME).join(', ') || 'MISSING');
    
    await p.close();
})().catch(e => console.error(e.message));
