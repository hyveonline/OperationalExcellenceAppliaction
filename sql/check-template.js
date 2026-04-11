const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(config);
    const r = await pool.request().query("SELECT LEN(BodyTemplate) as len, LEFT(BodyTemplate, 500) as preview FROM EmailTemplates WHERE TemplateKey='THEFT_INCIDENT_REPORT'");
    console.log('Length:', r.recordset[0].len);
    console.log('Preview:', r.recordset[0].preview);
    await pool.close();
}
run();
