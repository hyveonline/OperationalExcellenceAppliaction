require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER,
    database: 'OEApp_UAT',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true }
};

(async () => {
    const pool = await sql.connect(config);
    
    const result = await pool.request().query(`
        SELECT t.Id, t.TemplateName, t.Description, t.CreatedBy,
            ISNULL(u.DisplayName, 'System') as CreatedByName,
            (SELECT COUNT(*) FROM RCV_InspectionTemplateSections ts WHERE ts.TemplateId = t.Id) as SectionCount
        FROM RCV_InspectionTemplates t
        LEFT JOIN Users u ON t.CreatedBy = u.Id
        WHERE t.IsActive = 1
    `);
    
    console.log('=== Templates ===');
    for (const t of result.recordset) {
        console.log(`${t.Id}: ${t.TemplateName} | CreatedBy: ${t.CreatedBy} -> ${t.CreatedByName} | Sections: ${t.SectionCount}`);
    }
    
    // Get sections for each template
    for (const t of result.recordset) {
        const sections = await pool.request()
            .input('templateId', sql.Int, t.Id)
            .query('SELECT Id, SectionName FROM RCV_InspectionTemplateSections WHERE TemplateId = @templateId');
        console.log(`  Template ${t.Id} sections:`, sections.recordset.length);
    }
    
    await pool.close();
})().catch(e => console.error('Error:', e.message));
