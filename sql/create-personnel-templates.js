// ============================================================
// Create Personnel module email templates
// ============================================================
const sql = require('mssql');
const db = process.argv[2] || 'OEApp_UAT';
const cfg = { server: 'localhost', database: db, user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

// Outlook-compatible helpers
function shell(headerBg, headerContent, bodyContent, footerContent) {
    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<!--[if mso]><style type="text/css">table, td { font-family: Segoe UI, Arial, sans-serif; }</style><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
<tr><td align="center" style="padding: 20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-collapse: collapse;">
<tr><td style="background-color: ${headerBg}; padding: 30px; text-align: center;">${headerContent}</td></tr>
<tr><td style="padding: 30px;">${bodyContent}</td></tr>
<tr><td style="background-color: #f8f9fa; padding: 20px; text-align: center;">${footerContent}</td></tr>
</table></td></tr></table></body></html>`;
}
function btn(href, bg, text) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding: 25px 0 10px 0;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:45px;v-text-anchor:middle;width:220px;" arcsize="18%" strokecolor="${bg}" fillcolor="${bg}"><w:anchorlock/><center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;">${text}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${href}" style="display: inline-block; padding: 14px 30px; background-color: ${bg}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">${text}</a><!--<![endif]-->
</td></tr></table>`;
}
function row(label, value) {
    return `<tr><td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>${label}</strong></td><td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">${value}</td></tr>`;
}
function table(rows) { return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">${rows}</table>`; }
function p(text) { return `<p style="margin: 0 0 10px 0; font-size: 15px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">${text}</p>`; }
function footer() { return `<p style="margin: 0 0 5px 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">This is an automated notification from the Operational Excellence Application.</p>
<p style="margin: 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">&copy; {{year}} GMRL Group</p>`; }
function h1(text) { return `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">${text}</h1>`; }
function sub(text) { return `<p style="margin: 8px 0 0 0; font-size: 14px; color: #e0e0e0; font-family: 'Segoe UI', Arial, sans-serif;">${text}</p>`; }

const templates = [
    {
        key: 'EMPLOYEE_SCHEDULE_SUBMITTED',
        name: 'Employee Schedule Submitted',
        module: 'Personnel',
        reportType: 'Notification',
        subject: '📅 Employee Schedule Submitted - Week of {{weekStart}}',
        body: shell('#0d6efd',
            `${h1('📅 Employee Schedule Submitted')}${sub('Week of {{weekStart}}')}`,
            `${p('An employee weekly schedule has been submitted:')}
${table(row('Week Start', '{{weekStart}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
${btn('{{viewUrl}}', '#0d6efd', 'View Schedule')}`, footer())
    },
    {
        key: 'SECURITY_SCHEDULE_SUBMITTED',
        name: 'Security Schedule Submitted',
        module: 'Personnel',
        reportType: 'Notification',
        subject: '🛡️ Security Schedule - {{storeName}} - {{fromDate}} to {{toDate}}',
        body: shell('#495057',
            `${h1('🛡️ Security Schedule Submitted')}${sub('{{storeName}}')}`,
            `${p('A security employee schedule has been submitted:')}
${table(row('Store', '{{storeName}}') + row('From', '{{fromDate}}') + row('To', '{{toDate}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
${btn('{{viewUrl}}', '#495057', 'View Schedule')}`, footer())
    },
    {
        key: 'THIRDPARTY_SCHEDULE_SUBMITTED',
        name: 'Third-Party Schedule Submitted',
        module: 'Personnel',
        reportType: 'Notification',
        subject: '👥 Third-Party Schedule - {{storeName}} - {{fromDate}} to {{toDate}}',
        body: shell('#198754',
            `${h1('👥 Third-Party Schedule Submitted')}${sub('{{storeName}}')}`,
            `${p('A third-party employee schedule has been submitted:')}
${table(row('Store', '{{storeName}}') + row('From', '{{fromDate}}') + row('To', '{{toDate}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
${btn('{{viewUrl}}', '#198754', 'View Schedule')}`, footer())
    },
    {
        key: 'THIRDPARTY_ATTENDANCE_UPLOADED',
        name: 'Third-Party Attendance Uploaded',
        module: 'Personnel',
        reportType: 'Notification',
        subject: '📊 Third-Party Attendance Uploaded - {{recordCount}} records',
        body: shell('#6f42c1',
            `${h1('📊 Third-Party Attendance Upload')}${sub('{{fileName}}')}`,
            `${p('A third-party attendance file has been uploaded:')}
${table(row('File Name', '{{fileName}}') + row('Records', '{{recordCount}}') + row('Uploaded By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
${btn('{{viewUrl}}', '#6f42c1', 'View Records')}`, footer())
    }
];

async function run() {
    const pool = await sql.connect(cfg);
    let inserted = 0, skipped = 0;

    for (const t of templates) {
        const exists = await pool.request()
            .input('k', sql.NVarChar, t.key)
            .query('SELECT 1 FROM EmailTemplates WHERE TemplateKey = @k');

        if (exists.recordset.length > 0) {
            console.log(`  ⏭️  ${t.key} already exists, skipping`);
            skipped++;
            continue;
        }

        await pool.request()
            .input('key', sql.NVarChar, t.key)
            .input('name', sql.NVarChar, t.name)
            .input('module', sql.NVarChar, t.module)
            .input('reportType', sql.NVarChar, t.reportType)
            .input('subject', sql.NVarChar, t.subject)
            .input('body', sql.NVarChar, t.body)
            .query(`INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
                    VALUES (@key, @name, @module, @reportType, @subject, @body, 1, GETDATE())`);
        console.log(`  ✅ ${t.key}`);
        inserted++;
    }

    console.log(`\n${cfg.database}: Inserted ${inserted} | Skipped ${skipped}`);
    await pool.close();
}

run();
