require('dotenv').config();
const sql = require('mssql');
(async () => {
    const pool = await sql.connect({
        server: process.env.SQL_SERVER, database: 'OEApp_UAT',
        user: process.env.SQL_USER, password: process.env.SQL_PASSWORD,
        options: { encrypt: process.env.SQL_ENCRYPT === 'true', trustServerCertificate: process.env.SQL_TRUST_CERT === 'true' }
    });
    const r = await pool.request().query(`
        SELECT InspectionId, SectionName, SectionOrder, COUNT(*) as cnt 
        FROM SEC_InspectionItems 
        GROUP BY InspectionId, SectionName, SectionOrder 
        ORDER BY InspectionId, SectionOrder
    `);
    let cur = '';
    r.recordset.forEach(x => {
        if (x.InspectionId.toString() !== cur) {
            cur = x.InspectionId.toString();
            process.stdout.write('\nAudit ' + cur + ':');
        }
        process.stdout.write(' ' + x.SectionName + '(' + x.cnt + ')');
    });
    console.log('\n\n--- Template sections ---');
    const t = await pool.request().query(`
        SELECT t.Id as TemplateId, t.TemplateName, s.SectionName, s.SectionOrder
        FROM SEC_InspectionTemplateSections s
        JOIN SEC_InspectionTemplates t ON s.TemplateId = t.Id
        ORDER BY t.Id, s.SectionOrder
    `);
    cur = '';
    t.recordset.forEach(x => {
        if (x.TemplateId.toString() !== cur) {
            cur = x.TemplateId.toString();
            console.log('\nTemplate ' + cur + ' (' + x.TemplateName + '):');
        }
        console.log('  ' + x.SectionOrder + '. ' + x.SectionName);
    });
    await pool.close();
})();
