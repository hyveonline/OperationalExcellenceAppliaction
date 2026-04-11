// ============================================================
// Fix template variables v2 - match templates to ACTUAL route data
// Fixes: DAILY_TASKS_REMINDER, WEEKLY_SCHEDULE_PUBLISHED,
//        OHS_INCIDENT_REPORT, FIVE_DAYS (create if missing)
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
function alert(content, bg, border) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;"><tr><td style="background-color: ${bg}; border-left: 4px solid ${border}; padding: 15px; font-size: 14px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">${content}</td></tr></table>`;
}
function p(text) { return `<p style="margin: 0 0 10px 0; font-size: 15px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">${text}</p>`; }
function footer() { return `<p style="margin: 0 0 5px 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">This is an automated notification from the Operational Excellence Application.</p>
<p style="margin: 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">&copy; {{year}} GMRL Group</p>`; }
function h1(text) { return `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">${text}</h1>`; }
function sub(text) { return `<p style="margin: 8px 0 0 0; font-size: 14px; color: #e0e0e0; font-family: 'Segoe UI', Arial, sans-serif;">${text}</p>`; }

const updates = {};

// DAILY_TASKS_REMINDER - Route passes: zoneId, teamTypeId, dateFrom, dateTo
updates['DAILY_TASKS_REMINDER'] = {
    subject: '&#128203; Daily Tasks Submitted - {{dateFrom}} to {{dateTo}}',
    body: shell('#28a745',
        `${h1('&#128203; Daily Tasks Submitted')}${sub('{{dateFrom}} to {{dateTo}}')}`,
        `${p('Daily tasks have been submitted:')}
${table(row('Date From', '{{dateFrom}}') + row('Date To', '{{dateTo}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#28a745', 'View Tasks')}`, footer())
};

// WEEKLY_SCHEDULE_PUBLISHED - Route passes: shiftId, year, month
updates['WEEKLY_SCHEDULE_PUBLISHED'] = {
    subject: '&#128197; Weekly Schedule Published - {{month}}/{{year}}',
    body: shell('#6f42c1',
        `${h1('&#128197; Weekly Schedule Published')}${sub('{{month}}/{{year}}')}`,
        `${p('A weekly cleaning schedule has been submitted:')}
${table(row('Month', '{{month}}') + row('Year', '{{year}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#6f42c1', 'View Schedule')}`, footer())
};

// OHS_INCIDENT_REPORT - Route passes: incidentNumber, incidentDate, incidentTime, exactLocation, reporterName, incidentDescription
updates['OHS_INCIDENT_REPORT'] = {
    subject: '&#9888;&#65039; OHS Incident Report - {{storeName}} - {{incidentDate}}',
    body: shell('#dc3545',
        `${h1('&#9888;&#65039; OHS Incident Report')}${sub('{{storeName}}')}`,
        `${p('An OHS incident has been reported:')}
${alert('<strong>&#128680; Incident #{{incidentNumber}}</strong> reported at <strong>{{storeName}}</strong>', '#f8d7da', '#dc3545')}
${table(row('Incident #', '{{incidentNumber}}') + row('Store', '{{storeName}}') + row('Date', '{{incidentDate}}') + row('Time', '{{incidentTime}}') + row('Location', '{{exactLocation}}') + row('Reporter', '{{reporterName}}') + row('Submitted By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{incidentDescription}}', '#f8f9fa', '#dc3545')}
${btn('{{viewUrl}}', '#dc3545', 'View Full Report')}`, footer())
};

// EXTRA_CLEANING_REQUEST - add storeName alias from 'store' meta field
updates['EXTRA_CLEANING_REQUEST'] = {
    subject: '&#9989; Extra Third-Party Support - {{storeName}} - {{category}}',
    body: shell('#17a2b8',
        `${h1('&#128203; Extra Third-Party Support Request')}${sub('{{storeName}}')}`,
        `${p('A new extra third-party support request has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Category', '{{category}}') + row('Third Party', '{{thirdParty}}') + row('Number of Agents', '{{numberOfAgents}}') + row('Shift Hours', '{{shiftHours}} hours') + row('Start Date', '{{startDate}}') + row('End Date', '{{endDate}}') + row('Description', '{{description}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#17a2b8', 'View Request')}`, footer())
};

async function run() {
    const pool = await sql.connect(cfg);
    let updated = 0, failed = 0, skipped = 0;

    for (const [key, tmpl] of Object.entries(updates)) {
        try {
            const exists = await pool.request()
                .input('k', sql.NVarChar, key)
                .query('SELECT 1 FROM EmailTemplates WHERE TemplateKey = @k');

            if (exists.recordset.length === 0) {
                console.log(`  ⏭️  ${key} - not found, skipping`);
                skipped++;
                continue;
            }

            await pool.request()
                .input('k', sql.NVarChar, key)
                .input('s', sql.NVarChar, tmpl.subject)
                .input('b', sql.NVarChar, tmpl.body)
                .query(`UPDATE EmailTemplates SET SubjectTemplate = @s, BodyTemplate = @b, UpdatedAt = GETDATE() WHERE TemplateKey = @k`);

            console.log(`  ✅ ${key}`);
            updated++;
        } catch (err) {
            console.log(`  ❌ ${key} - ${err.message}`);
            failed++;
        }
    }

    console.log(`\n===================================`);
    console.log(`Database: ${cfg.database}`);
    console.log(`Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`);
    console.log(`===================================`);
    await pool.close();
}

run();
