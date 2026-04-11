// =============================================================
// Fix ALL email templates for Outlook compatibility
// Converts <style> blocks, linear-gradient, CSS classes, 
// inline-block, and div-based layouts to table-based layouts
// =============================================================
const sql = require('mssql');
const config = { 
    server: 'localhost', 
    database: process.argv[2] || 'OEApp_UAT', 
    user: 'sa', 
    password: 'Kokowawa123@@', 
    options: { encrypt: false, trustServerCertificate: true } 
};

// ── Helper: wrap content in Outlook-safe email shell ──
function emailShell(headerBg, headerContent, bodyContent, footerContent) {
    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if mso]>
    <style type="text/css">
        table, td { font-family: Segoe UI, Arial, sans-serif; }
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px 10px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-collapse: collapse;">
                    <!-- HEADER -->
                    <tr>
                        <td style="background-color: ${headerBg}; padding: 30px; text-align: center;">
                            ${headerContent}
                        </td>
                    </tr>
                    <!-- BODY -->
                    <tr>
                        <td style="padding: 30px;">
                            ${bodyContent}
                        </td>
                    </tr>
                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            ${footerContent}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ── Helper: create Outlook-safe button ──
function emailButton(href, bgColor, text) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 25px 0 10px 0;">
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:45px;v-text-anchor:middle;width:220px;" arcsize="18%" strokecolor="${bgColor}" fillcolor="${bgColor}">
                                            <w:anchorlock/>
                                            <center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;">${text}</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="${href}" style="display: inline-block; padding: 14px 30px; background-color: ${bgColor}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">${text}</a>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>`;
}

// ── Helper: detail row ──
function detailRow(label, value, opts = {}) {
    const bgStyle = opts.bg ? `background-color: ${opts.bg};` : '';
    const valColor = opts.valColor || '#333333';
    const valWeight = opts.bold ? 'font-weight: 700;' : 'font-weight: 600;';
    return `<tr>
                                                <td style="${bgStyle} padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>${label}</strong></td>
                                                <td style="${bgStyle} padding: 12px; border-bottom: 1px solid #eeeeee; ${valWeight} font-size: 14px; color: ${valColor}; font-family: 'Segoe UI', Arial, sans-serif;">${value}</td>
                                            </tr>`;
}

// ── Helper: section title ──
function sectionTitle(text) {
    return `<p style="margin: 25px 0 15px 0; font-size: 16px; font-weight: 600; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">${text}</p>`;
}

// ── Helper: info/alert box ──
function alertBox(content, bgColor, borderColor) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                                <tr>
                                    <td style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 15px; font-size: 14px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">${content}</td>
                                </tr>
                            </table>`;
}

// ── Helper: detail table ──
function detailTable(rows) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                            ${rows}
                            </table>`;
}

// ── Helper: standard footer text ──
function footerText(lines) {
    return lines.map(l => `<p style="margin: 0 0 5px 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">${l}</p>`).join('\n                            ');
}

// ── Helper: checklist items ──
function checklistItems(items, bgColor) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                                <tr>
                                    <td style="background-color: ${bgColor}; padding: 15px 20px; font-size: 14px; color: #333333; line-height: 2; font-family: 'Segoe UI', Arial, sans-serif;">
                                        ${items.join('<br>')}
                                    </td>
                                </tr>
                            </table>`;
}

// ── Helper: paragraph ──
function p(text, opts = {}) {
    const color = opts.color || '#333333';
    const mb = opts.mb || '10px';
    const extra = opts.bold ? 'font-weight: 600;' : '';
    return `<p style="margin: 0 0 ${mb} 0; font-size: 15px; color: ${color}; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif; ${extra}">${text}</p>`;
}

// ── Helper: badge ──
function badge(text, bgColor, fgColor) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 15px auto;" align="center">
                                <tr>
                                    <td style="background-color: ${bgColor}; padding: 10px 25px; font-size: 15px; font-weight: 600; color: ${fgColor}; font-family: 'Segoe UI', Arial, sans-serif; text-align: center;">${text}</td>
                                </tr>
                            </table>`;
}

// ── Helper: findings stats row (for OE/OHS action plans) ──
function findingsStats(stats) {
    const cells = stats.map(s => `<td style="text-align: center; padding: 15px; vertical-align: top;">
                                        <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${s.color}; font-family: 'Segoe UI', Arial, sans-serif;">${s.value}</p>
                                        <p style="margin: 5px 0 0 0; font-size: 11px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">${s.label}</p>
                                    </td>`).join('\n                                    ');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                                <tr>
                                    ${cells}
                                </tr>
                            </table>`;
}

// ═══════════════════════════════════════════════════════════
// ALL TEMPLATES
// ═══════════════════════════════════════════════════════════

const templates = {};

// ─── BROADCAST_5DAYS ───
templates['BROADCAST_5DAYS'] = emailShell('#667eea',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128197; 5 Days Expired Items Check</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #e8e0ff; font-family: 'Segoe UI', Arial, sans-serif;">Daily Compliance Reminder</p>`,
    `${p('Dear {{recipientName}},')}
                            ${badge('&#9200; Action Required', '#eee8ff', '#667eea')}
                            ${alertBox('{{message}}', '#f8f9fa', '#667eea')}
                            ${checklistItems([
                                '<strong>&#128203; Checklist:</strong>',
                                '&#9989; Check all products within 5 days of expiry',
                                '&#9989; Update inventory system',
                                '&#9989; Mark down items as needed',
                                '&#9989; Submit daily report'
                            ], '#e8f5e9')}
                            ${emailButton('{{dashboardUrl}}', '#667eea', 'Go to Dashboard')}`,
    footerText(['Sent by: {{senderName}} | {{sentDate}}', '&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── BROADCAST_CLEANING ───
templates['BROADCAST_CLEANING'] = emailShell('#17a2b8',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#129529; Cleaning Checklist</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #d1ecf1; font-family: 'Segoe UI', Arial, sans-serif;">Daily Hygiene Standards</p>`,
    `${p('Dear {{recipientName}},')}
                            ${badge('&#129532; Cleanliness Matters', '#d1ecf1', '#17a2b8')}
                            ${alertBox('{{message}}', '#f8f9fa', '#17a2b8')}
                            ${checklistItems([
                                '<strong>&#127978; Key Areas to Clean:</strong>',
                                '&#128682; Entrance &amp; Customer Areas',
                                '&#127869;&#65039; Food Preparation Surfaces',
                                '&#128703; Restrooms &amp; Washrooms',
                                '&#128465;&#65039; Waste Disposal Areas',
                                '&#10052;&#65039; Refrigeration Units'
                            ], '#e0f7fa')}
                            ${emailButton('{{dashboardUrl}}', '#17a2b8', 'Submit Cleaning Report')}`,
    footerText(['Sent by: {{senderName}} | {{sentDate}}', '&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── BROADCAST_INSPECTION ───
templates['BROADCAST_INSPECTION'] = emailShell('#0078d4',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128269; Inspection Reminder</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #cce5ff; font-family: 'Segoe UI', Arial, sans-serif;">Prepare Your Store</p>`,
    `${p('Dear {{recipientName}},')}
                            ${badge('&#128203; Inspection Due', '#cce5ff', '#0078d4')}
                            ${alertBox('{{message}}', '#f8f9fa', '#0078d4')}
                            ${checklistItems([
                                '<strong>&#128269; Preparation Checklist:</strong>',
                                '&#128193; Gather all required documentation',
                                '&#129529; Ensure all areas are clean and organized',
                                '&#9989; Verify compliance with all standards',
                                '&#128101; Brief your team on inspection expectations'
                            ], '#e3f2fd')}
                            ${emailButton('{{dashboardUrl}}', '#0078d4', 'View Inspection Schedule')}`,
    footerText(['Sent by: {{senderName}} | {{sentDate}}', '&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── BROADCAST_MESSAGE ───
templates['BROADCAST_MESSAGE'] = emailShell('#0078d4',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128226; {{title}}</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #cce5ff; font-family: 'Segoe UI', Arial, sans-serif;">Announcement from {{senderName}}</p>`,
    `${p('Dear {{recipientName}},')}
                            ${badge('{{priorityLabel}}', '#e3f2fd', '#0078d4')}
                            ${alertBox('{{message}}', '#f8f9fa', '#0078d4')}
                            ${detailTable(
                                detailRow('From', '{{senderName}}') +
                                detailRow('Date', '{{sentDate}}') +
                                detailRow('Priority', '{{priority}}')
                            )}
                            ${emailButton('{{dashboardUrl}}', '#0078d4', 'Go to Dashboard')}`,
    footerText(['This is an automated announcement from the Operational Excellence Application.', '&copy; {{year}} GMRL - All Rights Reserved'])
);

// ─── BROADCAST_SAFETY ───
templates['BROADCAST_SAFETY'] = emailShell('#dc3545',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9888;&#65039; Safety First</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">Your Safety is Our Priority</p>`,
    `${p('Dear {{recipientName}},')}
                            ${badge('&#129466; Safety Alert', '#f8d7da', '#dc3545')}
                            ${alertBox('{{message}}', '#f8f9fa', '#dc3545')}
                            ${checklistItems([
                                '<strong>&#128737;&#65039; Safety Reminders:</strong>',
                                '&#128293; Know your fire exit locations',
                                '&#129508; Use proper PPE when required',
                                '&#9889; Report electrical hazards immediately',
                                '&#128683; Keep emergency exits clear at all times',
                                '&#128222; Know emergency contact numbers'
                            ], '#ffebee')}
                            ${emailButton('{{dashboardUrl}}', '#dc3545', 'Review Safety Guidelines')}`,
    footerText(['Sent by: {{senderName}} | {{sentDate}}', '&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── DEPARTMENT_ESCALATION ───
templates['DEPARTMENT_ESCALATION'] = emailShell('#7c3aed',
    `<h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128203; {{module}} Inspection - Department Escalation</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #e8e0ff; font-family: 'Segoe UI', Arial, sans-serif;">An item has been assigned to your department</p>`,
    `${p('Dear {{departmentName}} Team,')}
                            ${p('An inspection finding has been assigned to your department for follow-up:')}
                            ${alertBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                ${detailRow('Store', '{{storeName}}')}
                                ${detailRow('Document #', '{{documentNumber}}')}
                                ${detailRow('Reference', '{{referenceValue}}')}
                                ${detailRow('Question', '{{questionTitle}}')}
                            </table>`, '#f9fafb', '#7c3aed')}
                            ${alertBox('<strong>&#9888;&#65039; Finding</strong><br>{{finding}}', '#fef2f2', '#ef4444')}
                            ${alertBox('<strong>&#9989; Required Action</strong><br>{{correctiveAction}}', '#f0fdf4', '#22c55e')}
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                                <tr>
                                    <td width="48%" style="background-color: #fef3c7; padding: 15px; text-align: center;">
                                        <p style="margin: 0; font-size: 12px; color: #92400e; font-family: 'Segoe UI', Arial, sans-serif;">Priority</p>
                                        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 700; color: #78350f; font-family: 'Segoe UI', Arial, sans-serif;">{{priority}}</p>
                                    </td>
                                    <td width="4%"></td>
                                    <td width="48%" style="background-color: #fee2e2; padding: 15px; text-align: center;">
                                        <p style="margin: 0; font-size: 12px; color: #991b1b; font-family: 'Segoe UI', Arial, sans-serif;">Deadline</p>
                                        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 700; color: #7f1d1d; font-family: 'Segoe UI', Arial, sans-serif;">{{deadline}}</p>
                                    </td>
                                </tr>
                            </table>
                            ${p('Escalated by: <strong>{{escalatedByName}}</strong> on {{escalatedAt}}', { color: '#666666' })}
                            ${emailButton('{{actionPlanUrl}}', '#7c3aed', 'View Action Plan')}`,
    footerText(['This is an automated notification from the {{module}} Inspection System.'])
);

// ─── DEPARTMENT_REMINDER ───
templates['DEPARTMENT_REMINDER'] = emailShell('#d97706',
    `<h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9200; Reminder: Pending Department Action</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #fef3c7; font-family: 'Segoe UI', Arial, sans-serif;">This item requires your attention</p>`,
    `${p('Dear {{departmentName}} Team,')}
                            ${p('This is a reminder that the following item is still pending and {{status}}:')}
                            ${alertBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                ${detailRow('Store', '{{storeName}}')}
                                ${detailRow('Document #', '{{documentNumber}}')}
                                ${detailRow('Finding', '{{finding}}')}
                                ${detailRow('Deadline', '{{deadline}} ({{daysStatus}})', { valColor: '#dc2626', bold: true })}
                            </table>`, '#fef3c7', '#d97706')}
                            ${emailButton('{{actionPlanUrl}}', '#d97706', 'Take Action Now')}`,
    footerText(['This is reminder #{{reminderCount}}. Escalated on {{escalatedAt}}.'])
);

// ─── FIVEDAYS_DAILY ───
templates['FIVEDAYS_DAILY'] = emailShell('#667eea',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128203; Day {{dayNumber}} of 5</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #e8e0ff; font-family: 'Segoe UI', Arial, sans-serif;">5 Days Expired Items Check</p>`,
    `${p('Dear {{recipientName}},')}
                            ${badge('Day {{dayNumber}} / 5', '#eee8ff', '#667eea')}
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                                <tr>
                                    <td style="background-color: #e9ecef; padding: 0; height: 20px;">
                                        <table role="presentation" width="{{progressPercent}}%" cellpadding="0" cellspacing="0" border="0" style="height: 20px;">
                                            <tr>
                                                <td style="background-color: #667eea; height: 20px; font-size: 1px;">&nbsp;</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            ${alertBox('{{message}}', '#f8f9fa', '#667eea')}
                            ${p('<strong>Your entries so far:</strong> {{entryCount}} items recorded')}
                            ${emailButton('{{dashboardUrl}}', '#667eea', 'Continue Recording')}`,
    footerText(['Store: {{storeName}} | Sent: {{sentDate}}', '&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── FIVEDAYS_INITIATE ───
templates['FIVEDAYS_INITIATE'] = emailShell('#667eea',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128197; 5 Days Cycle Started</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #e8e0ff; font-family: 'Segoe UI', Arial, sans-serif;">Time to Record Expired Items</p>`,
    `${p('Dear {{recipientName}},')}
                            ${p('The 5 Days Expired Items cycle has <strong>officially started</strong> for {{storeName}}!')}
                            ${alertBox('<strong>&#128203; Your Task:</strong><br>Record ALL expired items found in your store during this 5-day period.', '#f8f9fa', '#667eea')}
                            ${checklistItems([
                                '<strong>Daily Checklist:</strong>',
                                '&#9989; Check all shelves for expired products',
                                '&#9989; Check refrigerated items',
                                '&#9989; Check backstock area',
                                '&#9989; Record findings in the system'
                            ], '#e8f5e9')}
                            ${p('<strong>Cycle End Date:</strong> {{cycleEndDate}}')}
                            ${emailButton('{{dashboardUrl}}', '#667eea', 'Open 5 Days Form')}`,
    footerText(['&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── FIVEDAYS_OVERDUE ───
templates['FIVEDAYS_OVERDUE'] = emailShell('#dc3545',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128680; OVERDUE WARNING</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">5 Days Entries Missing</p>`,
    `${p('Dear {{recipientName}},')}
                            ${alertBox('<strong>&#9888;&#65039; Your 5 Days cycle submissions are OVERDUE!</strong><br><br>The cycle ended on {{cycleEndDate}} and we have not received complete submissions from {{storeName}}.', '#ffebee', '#dc3545')}
                            ${checklistItems([
                                '<strong>&#9889; This WILL affect your store:</strong>',
                                '&#10060; Negative mark on upcoming store audit',
                                '&#10060; Compliance score reduction',
                                '&#10060; Area Manager notification'
                            ], '#fff3cd')}
                            ${p('<strong>Days overdue:</strong> {{daysOverdue}}')}
                            ${p('<strong>Entries recorded:</strong> {{entryCount}} ({{status}})')}
                            ${emailButton('{{dashboardUrl}}', '#dc3545', 'Complete Now')}`,
    footerText(['This is an automated compliance warning.', '&copy; {{year}} GMRL - Operational Excellence'])
);

// ─── OE_ACTION_PLAN ───
templates['OE_ACTION_PLAN'] = emailShell('#0078d4',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128221; OE Action Plan</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #cce5ff; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}} - {{documentNumber}}</p>`,
    `${p('Dear Store Manager,')}
                            ${p('Following the Operational Excellence inspection at your store, please find below the findings that require your attention:')}
                            ${findingsStats([
                                { value: '{{totalFindings}}', label: 'Total', color: '#333333' },
                                { value: '{{highFindings}}', label: 'High', color: '#dc3545' },
                                { value: '{{mediumFindings}}', label: 'Medium', color: '#fd7e14' },
                                { value: '{{lowFindings}}', label: 'Low', color: '#ffc107' }
                            ])}
                            ${detailTable(
                                detailRow('Document Number', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}}') +
                                detailRow('Inspection Date', '{{auditDate}}') +
                                detailRow('Inspector', '{{auditors}}')
                            )}
                            ${alertBox('&#9200; <strong>Deadline:</strong> Please complete all corrective actions by {{deadline}}', '#fff3cd', '#ffc107')}
                            ${emailButton('{{reportUrl}}', '#0078d4', '&#128203; View Action Plan')}`,
    footerText(['This is an automated message from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
);

// ─── OE_ESCALATION ───
templates['OE_ESCALATION'] = emailShell('#ee5a24',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">OE Action Plan Escalation</h1>`,
    `${p('Dear {{recipientName}},')}
                            ${p('An OE inspection action plan has exceeded its deadline and requires your attention:')}
                            ${detailTable(
                                detailRow('Store', '{{storeName}}', { bg: '#f8f9fa' }) +
                                detailRow('Inspection #', '{{documentNumber}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}', { bg: '#f8f9fa' }) +
                                detailRow('Deadline', '{{deadline}}') +
                                detailRow('Days Overdue', '{{daysOverdue}} day(s)', { bg: '#fff3cd', valColor: '#e74c3c', bold: true })
                            )}
                            ${p('Please contact the Store Manager to ensure the action plan is completed promptly.')}
                            ${emailButton('{{actionPlanUrl}}', '#ee5a24', 'View Action Plan')}`,
    footerText(['This is an automated notification from the OE Inspection System.'])
);

// ─── OE_FULL ───
templates['OE_FULL'] = emailShell('#0078d4',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128203; OE Inspection Report</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #cce5ff; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</p>`,
    `${p('Dear Store Manager,')}
                            ${p('Please find below the summary of the Operational Excellence inspection conducted at your store:')}
                            ${badge('{{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})', '#e3f2fd', '#0078d4')}
                            ${detailTable(
                                detailRow('Document Number', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}} ({{storeCode}})') +
                                detailRow('Inspection Date', '{{auditDate}}') +
                                detailRow('Inspector', '{{auditors}}') +
                                detailRow('Status', '{{status}}')
                            )}
                            ${emailButton('{{reportUrl}}', '#0078d4', '&#128196; View Full Report')}
                            ${p('Please review the report and address any findings within the required timeframe.', { color: '#666666' })}`,
    footerText(['This is an automated message from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
);

// ─── OE_INSPECTION_ESCALATION ───
templates['OE_INSPECTION_ESCALATION'] = emailShell('#c0392b',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128680; OE Action Plan Escalation</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</p>`,
    `${p('Dear {{recipientName}},')}
                            ${p('An OE Inspection action plan has been <strong>escalated</strong> and requires immediate attention:')}
                            ${alertBox('<strong>&#9888;&#65039; Escalation Level: {{escalationLevel}}</strong><br>This action plan has exceeded the allowed timeframe.', '#f8d7da', '#dc3545')}
                            ${detailTable(
                                detailRow('Document', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}} ({{storeCode}})') +
                                detailRow('Inspection Date', '{{auditDate}}') +
                                detailRow('Days Overdue', '{{daysOverdue}} days', { valColor: '#dc3545', bold: true }) +
                                detailRow('Open Findings', '{{openFindings}} remaining')
                            )}
                            ${emailButton('{{reportUrl}}', '#dc3545', 'View Action Plan')}
                            ${p('Please take immediate action to resolve the outstanding findings.', { color: '#666666' })}`,
    footerText(['This is an automated escalation from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
);

// ─── OE_INSPECTION_OVERDUE ───
templates['OE_INSPECTION_OVERDUE'] = emailShell('#e67e22',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9888;&#65039; OE Action Plan Overdue</h1>`,
    `${p('Dear {{recipientName}},')}
                            ${p('<strong style="color: #e67e22;">The action plan deadline has passed.</strong> Please complete the outstanding items immediately to avoid escalation to your Area Manager.')}
                            ${detailTable(
                                detailRow('Store', '{{storeName}}', { bg: '#f8f9fa' }) +
                                detailRow('Inspection #', '{{documentNumber}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}', { bg: '#f8f9fa' }) +
                                detailRow('Deadline', '{{deadline}}') +
                                detailRow('Days Overdue', '{{daysOverdue}} day(s)', { bg: '#fff3cd', valColor: '#e74c3c', bold: true })
                            )}
                            ${p('<strong>Action Required:</strong> Complete all outstanding action items as soon as possible.', { color: '#e67e22' })}
                            ${emailButton('{{actionPlanUrl}}', '#e67e22', 'Complete Action Plan Now')}`,
    footerText(['This is an automated notification from the OE Inspection System.'])
);

// ─── OE_INSPECTION_REMINDER ───
templates['OE_INSPECTION_REMINDER'] = emailShell('#3498db',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9200; OE Action Plan Reminder</h1>`,
    `${p('Dear {{recipientName}},')}
                            ${p('This is a reminder that the action plan for the following OE inspection is due soon:')}
                            ${detailTable(
                                detailRow('Store', '{{storeName}}', { bg: '#f8f9fa' }) +
                                detailRow('Inspection #', '{{documentNumber}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}', { bg: '#f8f9fa' }) +
                                detailRow('Deadline', '{{deadline}}', { bg: '#e3f2fd', valColor: '#2980b9', bold: true }) +
                                detailRow('Days Remaining', '{{daysUntilDeadline}} day(s)', { bg: '#fff3e0', valColor: '#e67e22', bold: true })
                            )}
                            ${p('Please ensure all action items are addressed before the deadline to avoid escalation.')}
                            ${emailButton('{{actionPlanUrl}}', '#3498db', 'View Action Plan')}`,
    footerText(['This is an automated reminder from the OE Inspection System.'])
);

// ─── OE_VERIFICATION_SUBMITTED ───
templates['OE_VERIFICATION_SUBMITTED'] = emailShell('#28a745',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9989; Verification Submitted</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #d4edda; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</p>`,
    `${p('Dear {{recipientName}},')}
                            ${p('An action item verification has been submitted for your review:')}
                            ${badge('&#9203; Pending Review', '#d4edda', '#28a745')}
                            ${detailTable(
                                detailRow('Document Number', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}} ({{storeCode}})') +
                                detailRow('Section', '{{sectionName}}') +
                                detailRow('Finding', '{{findingDescription}}') +
                                detailRow('Submitted By', '{{submittedBy}}') +
                                detailRow('Submitted At', '{{submittedAt}}')
                            )}
                            ${alertBox('<strong>&#128221; Verification Notes:</strong><br>{{verificationNotes}}', '#e8f5e9', '#28a745')}
                            ${emailButton('{{verificationUrl}}', '#28a745', '&#128270; Review Verification')}
                            ${p('Please review the submitted verification and approve or reject it accordingly.', { color: '#666666' })}`,
    footerText(['This is an automated message from the Operational Excellence Application.', '&copy; {{year}} GMRL Apps'])
);

// ─── OHS_ACTION_PLAN ───
templates['OHS_ACTION_PLAN'] = emailShell('#d63031',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9888;&#65039; OHS Action Plan</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}} - {{documentNumber}}</p>`,
    `${p('Dear Store Manager,')}
                            ${p('Following the OHS inspection at your store, the following safety findings require <strong>immediate attention</strong>:')}
                            ${findingsStats([
                                { value: '{{totalFindings}}', label: 'Total', color: '#333333' },
                                { value: '{{criticalFindings}}', label: 'Critical', color: '#7c3aed' },
                                { value: '{{highFindings}}', label: 'High', color: '#dc3545' },
                                { value: '{{mediumFindings}}', label: 'Medium', color: '#fd7e14' },
                                { value: '{{lowFindings}}', label: 'Low', color: '#ffc107' }
                            ])}
                            ${alertBox('&#128680; <strong>Safety Priority:</strong> Critical and High priority items must be addressed within 48 hours.', '#f8d7da', '#dc3545')}
                            ${detailTable(
                                detailRow('Document Number', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}') +
                                detailRow('Inspector', '{{inspectors}}')
                            )}
                            ${emailButton('{{reportUrl}}', '#d63031', '&#128203; View Action Plan')}`,
    footerText(['This is an automated message from the OHS Inspection System.', '&copy; {{year}} GMRL Group'])
);

// ─── OHS_ESCALATION ───
templates['OHS_ESCALATION'] = emailShell('#c0392b',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">OHS Safety Action Plan Escalation</h1>`,
    `${p('Dear {{recipientName}},')}
                            ${p('An OHS safety inspection action plan has exceeded its deadline and requires <strong>immediate attention</strong>:')}
                            ${detailTable(
                                detailRow('Store', '{{storeName}}', { bg: '#f8f9fa' }) +
                                detailRow('Inspection #', '{{documentNumber}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}', { bg: '#f8f9fa' }) +
                                detailRow('Deadline', '{{deadline}}') +
                                detailRow('Days Overdue', '{{daysOverdue}} day(s)', { bg: '#ffebee', valColor: '#c0392b', bold: true })
                            )}
                            ${p('<strong>Safety compliance is critical.</strong> Please ensure immediate action is taken to address the outstanding safety findings.', { color: '#c0392b' })}
                            ${emailButton('{{actionPlanUrl}}', '#c0392b', 'View Safety Action Plan')}`,
    footerText(['This is an automated notification from the OHS Safety Inspection System.'])
);

// ─── OHS_FULL ───
templates['OHS_FULL'] = emailShell('#d63031',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#129466; OHS Inspection Report</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</p>`,
    `${p('Dear Store Manager,')}
                            ${p('Please find below the summary of the Occupational Health &amp; Safety inspection conducted at your store:')}
                            ${badge('{{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})', '#f8d7da', '#d63031')}
                            ${detailTable(
                                detailRow('Document Number', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}} ({{storeCode}})') +
                                detailRow('Inspection Date', '{{inspectionDate}}') +
                                detailRow('Inspector', '{{inspectors}}') +
                                detailRow('Status', '{{status}}')
                            )}
                            ${emailButton('{{reportUrl}}', '#d63031', '&#128196; View Full Report')}
                            ${p('Please review the report and ensure all safety standards are maintained.', { color: '#666666' })}`,
    footerText(['This is an automated message from the OHS Inspection System.', '&copy; {{year}} GMRL Group'])
);

// ─── OHS_INSPECTION_ESCALATION ───
templates['OHS_INSPECTION_ESCALATION'] = emailShell('#c0392b',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128680; OHS Safety Escalation</h1>
                            <p style="margin: 8px 0 0 0; font-size: 14px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</p>`,
    `${p('Dear {{recipientName}},')}
                            ${p('An OHS Safety action plan has been <strong>escalated</strong> and requires immediate attention:')}
                            ${alertBox('<strong>&#9888;&#65039; Escalation Level: {{escalationLevel}}</strong><br>This safety action plan has exceeded the allowed timeframe.', '#f8d7da', '#dc3545')}
                            ${detailTable(
                                detailRow('Document', '{{documentNumber}}') +
                                detailRow('Store', '{{storeName}} ({{storeCode}})') +
                                detailRow('Inspection Date', '{{inspectionDate}}') +
                                detailRow('Days Overdue', '{{daysOverdue}} days', { valColor: '#dc3545', bold: true }) +
                                detailRow('Open Findings', '{{openFindings}} remaining')
                            )}
                            ${emailButton('{{reportUrl}}', '#dc3545', 'View Safety Plan')}
                            ${p('Please take immediate action to resolve the outstanding safety findings.', { color: '#666666' })}`,
    footerText(['This is an automated escalation from the OHS Inspection System.', '&copy; {{year}} GMRL Group'])
);

// ─── OHS_INSPECTION_OVERDUE ───
templates['OHS_INSPECTION_OVERDUE'] = emailShell('#e67e22',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9888;&#65039; OHS Safety Action Plan Overdue</h1>`,
    `${p('Dear {{recipientName}},')}
                            ${p('<strong style="color: #e74c3c;">URGENT: The safety action plan deadline has passed.</strong> Please complete the outstanding safety items immediately to maintain compliance and avoid escalation.')}
                            ${detailTable(
                                detailRow('Store', '{{storeName}}', { bg: '#f8f9fa' }) +
                                detailRow('Inspection #', '{{documentNumber}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}', { bg: '#f8f9fa' }) +
                                detailRow('Deadline', '{{deadline}}') +
                                detailRow('Days Overdue', '{{daysOverdue}} day(s)', { bg: '#ffebee', valColor: '#e74c3c', bold: true })
                            )}
                            ${p('<strong>&#9888;&#65039; Safety compliance must not be delayed.</strong> Complete all outstanding safety action items immediately.', { color: '#e74c3c' })}
                            ${emailButton('{{actionPlanUrl}}', '#e67e22', 'Complete Safety Action Plan Now')}`,
    footerText(['This is an automated notification from the OHS Safety Inspection System.'])
);

// ─── OHS_INSPECTION_REMINDER ───
templates['OHS_INSPECTION_REMINDER'] = emailShell('#27ae60',
    `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#9200; OHS Safety Action Plan Reminder</h1>`,
    `${p('Dear {{recipientName}},')}
                            ${p('This is a reminder that the <strong>safety action plan</strong> for the following OHS inspection is due soon:')}
                            ${detailTable(
                                detailRow('Store', '{{storeName}}', { bg: '#f8f9fa' }) +
                                detailRow('Inspection #', '{{documentNumber}}') +
                                detailRow('Inspection Date', '{{inspectionDate}}', { bg: '#f8f9fa' }) +
                                detailRow('Deadline', '{{deadline}}', { bg: '#e8f5e9', valColor: '#27ae60', bold: true }) +
                                detailRow('Days Remaining', '{{daysUntilDeadline}} day(s)', { bg: '#fff3e0', valColor: '#e67e22', bold: true })
                            )}
                            ${p('<strong>Safety compliance is critical.</strong> Please ensure all safety action items are addressed before the deadline.', { color: '#27ae60' })}
                            ${emailButton('{{actionPlanUrl}}', '#27ae60', 'View Safety Action Plan')}`,
    footerText(['This is an automated reminder from the OHS Safety Inspection System.'])
);

// ═══════════════════════════════════════════════════════════
// Execute updates
// ═══════════════════════════════════════════════════════════
async function run() {
    const pool = await sql.connect(config);
    let updated = 0;
    let failed = 0;
    
    for (const [key, body] of Object.entries(templates)) {
        try {
            const result = await pool.request()
                .input('k', sql.NVarChar, key)
                .input('b', sql.NVarChar, body)
                .query('UPDATE EmailTemplates SET BodyTemplate=@b WHERE TemplateKey=@k');
            
            if (result.rowsAffected[0] > 0) {
                console.log(`  ✅ ${key} - updated`);
                updated++;
            } else {
                console.log(`  ⚠️  ${key} - NOT FOUND in database`);
                failed++;
            }
        } catch (err) {
            console.log(`  ❌ ${key} - ERROR: ${err.message}`);
            failed++;
        }
    }
    
    console.log(`\n===================================`);
    console.log(`Database: ${config.database}`);
    console.log(`Updated: ${updated} | Failed: ${failed}`);
    console.log(`===================================`);
    
    await pool.close();
}

run();
