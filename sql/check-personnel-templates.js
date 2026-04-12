const sql = require('mssql');
const cfg = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(cfg);
    const r = await pool.request().query(`
        SELECT TemplateKey, Module FROM EmailTemplates 
        WHERE Module = 'Personnel' 
           OR TemplateKey LIKE '%SCHEDULE%' 
           OR TemplateKey LIKE '%ATTENDANCE%'
        ORDER BY TemplateKey
    `);
    console.log('Personnel-related templates:', r.recordset.length);
    for (const t of r.recordset) {
        console.log(`  ${t.Module}: ${t.TemplateKey}`);
    }
    await pool.close();
}
run();
