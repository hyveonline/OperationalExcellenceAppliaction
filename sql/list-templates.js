const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(config);
    
    // Check table columns
    const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EmailTemplates' ORDER BY ORDINAL_POSITION`);
    console.log('Columns:', cols.recordset.map(c => c.COLUMN_NAME).join(', '));
    
    // List existing templates
    const res = await pool.request().query(`SELECT TemplateKey, ISNULL(Module, 'Uncategorized') as Module, IsActive FROM EmailTemplates ORDER BY Module, TemplateKey`);
    
    let currentCat = '';
    for (const t of res.recordset) {
        if (t.Module !== currentCat) {
            currentCat = t.Module;
            console.log(`\n--- ${currentCat} ---`);
        }
        console.log(`  ${t.IsActive ? '✅' : '❌'} ${t.TemplateKey}`);
    }
    
    console.log(`\nTotal: ${res.recordset.length} templates`);
    await pool.close();
}
run();
