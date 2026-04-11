const sql = require('mssql');
const fs = require('fs');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(config);
    const r = await pool.request().query(`SELECT TemplateKey, SubjectTemplate, BodyTemplate FROM EmailTemplates WHERE TemplateKey != 'THEFT_INCIDENT_REPORT' ORDER BY TemplateKey`);
    
    let output = '';
    for (const t of r.recordset) {
        output += `\n${'='.repeat(80)}\n`;
        output += `TEMPLATE: ${t.TemplateKey}\n`;
        output += `SUBJECT: ${t.SubjectTemplate}\n`;
        output += `${'='.repeat(80)}\n`;
        output += t.BodyTemplate + '\n';
    }
    
    fs.writeFileSync('sql/all-templates-dump.txt', output, 'utf8');
    console.log(`Dumped ${r.recordset.length} templates to sql/all-templates-dump.txt`);
    await pool.close();
}
run();
