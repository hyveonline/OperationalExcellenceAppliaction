// =============================================================
// Create email templates for ALL modules missing templates
// Categories: Stores, Facility Management, Security
// All Outlook-compatible (table-based, inline styles)
// =============================================================
const sql = require('mssql');
const config = { 
    server: 'localhost', 
    database: process.argv[2] || 'OEApp_UAT', 
    user: 'sa', 
    password: 'Kokowawa123@@', 
    options: { encrypt: false, trustServerCertificate: true } 
};

// ── Outlook-safe email shell ──
function shell(headerBg, headerContent, bodyContent, footerContent) {
    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if mso]><style type="text/css">table, td { font-family: Segoe UI, Arial, sans-serif; }</style><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px 10px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-collapse: collapse;">
                    <tr>
                        <td style="background-color: ${headerBg}; padding: 30px; text-align: center;">
                            ${headerContent}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px;">
                            ${bodyContent}
                        </td>
                    </tr>
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

function btn(href, bg, text) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr><td align="center" style="padding: 25px 0 10px 0;">
                                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:45px;v-text-anchor:middle;width:220px;" arcsize="18%" strokecolor="${bg}" fillcolor="${bg}"><w:anchorlock/><center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:600;">${text}</center></v:roundrect><![endif]-->
                                    <!--[if !mso]><!--><a href="${href}" style="display: inline-block; padding: 14px 30px; background-color: ${bg}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">${text}</a><!--<![endif]-->
                                </td></tr>
                            </table>`;
}

function row(label, value, opts = {}) {
    const bg = opts.bg ? `background-color: ${opts.bg};` : '';
    const vc = opts.valColor || '#333333';
    const vw = opts.bold ? 'font-weight: 700;' : 'font-weight: 600;';
    return `<tr>
                                                <td style="${bg} padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;"><strong>${label}</strong></td>
                                                <td style="${bg} padding: 12px; border-bottom: 1px solid #eeeeee; ${vw} font-size: 14px; color: ${vc}; font-family: 'Segoe UI', Arial, sans-serif;">${value}</td>
                                            </tr>`;
}

function table(rows) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">${rows}</table>`;
}

function alert(content, bg, border) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 15px 0;">
                                <tr><td style="background-color: ${bg}; border-left: 4px solid ${border}; padding: 15px; font-size: 14px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">${content}</td></tr>
                            </table>`;
}

function p(text, opts = {}) {
    const c = opts.color || '#333333';
    return `<p style="margin: 0 0 ${opts.mb || '10px'} 0; font-size: 15px; color: ${c}; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif; ${opts.bold ? 'font-weight:600;' : ''}">${text}</p>`;
}

function footer(lines) {
    return lines.map(l => `<p style="margin: 0 0 5px 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">${l}</p>`).join('\n');
}

function h1(text, color = '#ffffff') {
    return `<h1 style="margin: 0; font-size: 24px; font-weight: 700; color: ${color}; font-family: 'Segoe UI', Arial, sans-serif;">${text}</h1>`;
}

function sub(text, color = '#e0e0e0') {
    return `<p style="margin: 8px 0 0 0; font-size: 14px; color: ${color}; font-family: 'Segoe UI', Arial, sans-serif;">${text}</p>`;
}

// ═══════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════
const templates = [];

// ─────────────────────────────────────────
// STORES CATEGORY
// ─────────────────────────────────────────

// 1. Extra Cleaning Request
templates.push({
    key: 'EXTRA_CLEANING_REQUEST', name: 'Extra Cleaning Request Submitted', module: 'Stores',
    subject: '&#9989; Extra Third-Party Support Request - {{storeName}} - {{category}}',
    body: shell('#17a2b8',
        `${h1('&#128203; Extra Third-Party Support Request')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A new extra third-party support request has been submitted and requires your approval:')}
                            ${table(row('Store', '{{storeName}}') + row('Category', '{{category}}') + row('Third Party', '{{thirdParty}}') + row('Number of Agents', '{{numberOfAgents}}') + row('Shift Hours', '{{shiftHours}} hours') + row('Start Date', '{{startDate}}') + row('End Date', '{{endDate}}') + row('Requested By', '{{requestedBy}}'))}
                            ${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#17a2b8')}
                            ${btn('{{approvalUrl}}', '#17a2b8', 'Review Request')}`,
        footer(['This is an automated notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// 2. Complaint Submitted
templates.push({
    key: 'COMPLAINT_SUBMITTED', name: 'Store Complaint Submitted', module: 'Stores',
    subject: '&#128680; Complaint Submitted - {{storeName}} - {{category}}',
    body: shell('#e74c3c',
        `${h1('&#128680; Store Complaint')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A new complaint has been submitted that requires your attention:')}
                            ${table(row('Store', '{{storeName}}') + row('Category', '{{category}}') + row('Complaint Type', '{{complaintType}}') + row('Priority', '{{priority}}', { valColor: '#e74c3c', bold: true }) + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
                            ${alert('<strong>&#9888;&#65039; Subject:</strong> {{subject}}', '#f8d7da', '#e74c3c')}
                            ${alert('<strong>&#128221; Description:</strong><br>{{description}}', '#f8f9fa', '#6c757d')}
                            ${btn('{{viewUrl}}', '#e74c3c', 'View Complaint')}`,
        footer(['This is an automated notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// 3. Evacuation Drill Report
templates.push({
    key: 'EVACUATION_DRILL_REPORT', name: 'Post Evacuation Drill Report', module: 'Stores',
    subject: '&#128680; Post Evacuation Drill Report - {{storeName}} - {{drillDate}}',
    body: shell('#ff6b35',
        `${h1('&#128680; Post Evacuation Drill Assessment')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A post-evacuation drill assessment has been submitted:')}
                            ${table(row('Store', '{{storeName}}') + row('Drill Date', '{{drillDate}}') + row('Shift', '{{shift}}') + row('Evacuation Time', '{{evacuationTime}}') + row('Head Count', '{{headCount}}') + row('Submitted By', '{{submittedBy}}'))}
                            ${alert('<strong>&#128270; Findings:</strong><br>{{findings}}', '#fff3cd', '#ffc107')}
                            ${btn('{{viewUrl}}', '#ff6b35', 'View Full Report')}`,
        footer(['This is an automated notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// 4. Lost and Found Report
templates.push({
    key: 'LOSTFOUND_REPORT', name: 'Lost and Found Item Report', module: 'Stores',
    subject: '&#128270; Lost and Found Item - {{storeName}} - {{itemDescription}}',
    body: shell('#6f42c1',
        `${h1('&#128270; Lost and Found Report')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A new item has been logged in the Lost and Found system:')}
                            ${table(row('Store', '{{storeName}}') + row('Date Found', '{{dateFound}}') + row('Item Description', '{{itemDescription}}') + row('Location Found', '{{locationFound}}') + row('Estimated Value', '{{estimatedValue}}') + row('Status', '{{status}}') + row('Logged By', '{{loggedBy}}'))}
                            ${btn('{{viewUrl}}', '#6f42c1', 'View Details')}`,
        footer(['This is an automated notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// 5. OHS Incident Report
templates.push({
    key: 'OHS_INCIDENT_REPORT', name: 'OHS Accident & Incident Report', module: 'Stores',
    subject: '&#9888;&#65039; OHS {{incidentType}} Report - {{storeName}} - {{incidentDate}}',
    body: shell('#dc3545',
        `${h1('&#9888;&#65039; OHS {{incidentType}} Report')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('An OHS incident has been reported that requires immediate attention:')}
                            ${alert('<strong>&#128680; {{incidentType}}</strong> reported at <strong>{{storeName}}</strong>', '#f8d7da', '#dc3545')}
                            ${table(row('Store', '{{storeName}}') + row('Incident Type', '{{incidentType}}', { valColor: '#dc3545', bold: true }) + row('Date/Time', '{{incidentDate}} {{incidentTime}}') + row('Location', '{{location}}') + row('People Involved', '{{peopleInvolved}}') + row('Injuries', '{{injuries}}') + row('Reported By', '{{reportedBy}}'))}
                            ${alert('<strong>&#128221; Description:</strong><br>{{description}}', '#f8f9fa', '#dc3545')}
                            ${alert('<strong>&#127919; Action Taken:</strong><br>{{actionTaken}}', '#d4edda', '#28a745')}
                            ${btn('{{viewUrl}}', '#dc3545', 'View Full Report')}`,
        footer(['This is an automated safety notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// 6. Production Extras Request
templates.push({
    key: 'PRODUCTION_EXTRAS_REQUEST', name: 'Production Extras Request', module: 'Stores',
    subject: '&#128230; Production Extras Request - {{storeName}}',
    body: shell('#20c997',
        `${h1('&#128230; Production Extras Request')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A new production extras request has been submitted:')}
                            ${table(row('Store', '{{storeName}}') + row('Date Needed', '{{dateNeeded}}') + row('Item/Service', '{{itemRequested}}') + row('Quantity', '{{quantity}}') + row('Reason', '{{reason}}') + row('Priority', '{{priority}}') + row('Requested By', '{{requestedBy}}'))}
                            ${btn('{{viewUrl}}', '#20c997', 'Review Request')}`,
        footer(['This is an automated notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// 7. Weekly Feedback Submitted
templates.push({
    key: 'WEEKLY_FEEDBACK_SUBMITTED', name: 'Weekly Third Party Feedback', module: 'Stores',
    subject: '&#128203; Weekly Feedback - {{storeName}} - {{weekStartDate}}',
    body: shell('#fd7e14',
        `${h1('&#128203; Weekly Third Party Feedback')}${sub('{{storeName}} - Week of {{weekStartDate}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A weekly third-party feedback report has been submitted:')}
                            ${table(row('Store', '{{storeName}}') + row('Week', '{{weekStartDate}}') + row('Company', '{{companyServing}}') + row('Rating', '{{rating}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
                            ${alert('<strong>&#128221; Comments:</strong><br>{{comments}}', '#f8f9fa', '#fd7e14')}
                            ${btn('{{viewUrl}}', '#fd7e14', 'View Feedback')}`,
        footer(['This is an automated notification from the Operational Excellence Application.', '&copy; {{year}} GMRL Group'])
    )
});

// ─────────────────────────────────────────
// FACILITY MANAGEMENT CATEGORY
// ─────────────────────────────────────────

// 8. Parking Violation
templates.push({
    key: 'PARKING_VIOLATION', name: 'Parking Violation Report', module: 'Facility Management',
    subject: '&#128663; Parking Violation - {{location}} - {{violationDate}}',
    body: shell('#e74c3c',
        `${h1('&#128663; Parking Violation Report')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A parking violation has been reported and documented:')}
                            ${table(row('Date/Time', '{{violationDate}} {{violationTime}}') + row('Location', '{{location}}') + row('Vehicle Plate', '{{vehiclePlate}}', { bold: true }) + row('Violation Type', '{{violationType}}', { valColor: '#e74c3c', bold: true }) + row('Severity', '{{severity}}') + row('Reported By', '{{reportedBy}}'))}
                            ${alert('<strong>&#128221; Notes:</strong><br>{{notes}}', '#f8f9fa', '#e74c3c')}
                            ${btn('{{viewUrl}}', '#e74c3c', 'View Details')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 9. Delivery Log
templates.push({
    key: 'DELIVERY_LOG_ALERT', name: 'Delivery Log Alert', module: 'Facility Management',
    subject: '&#128666; Delivery Log - {{location}} - {{deliveryDate}}',
    body: shell('#3498db',
        `${h1('&#128666; Delivery Log Entry')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A delivery has been logged at the facility:')}
                            ${table(row('Date', '{{deliveryDate}}') + row('Time In', '{{timeIn}}') + row('Time Out', '{{timeOut}}') + row('Vehicle', '{{vehicleDetails}}') + row('Driver', '{{driverName}}') + row('Items', '{{itemDescription}}') + row('Receiver', '{{receiver}}') + row('Logged By', '{{loggedBy}}'))}
                            ${btn('{{viewUrl}}', '#3498db', 'View Log')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 10. Patrol Sheet
templates.push({
    key: 'PATROL_SHEET_SUBMITTED', name: 'Patrol Sheet Submitted', module: 'Facility Management',
    subject: '&#128110; Patrol Report - {{location}} - {{patrolDate}}',
    body: shell('#34495e',
        `${h1('&#128110; Patrol Sheet Report')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A patrol sheet has been submitted:')}
                            ${table(row('Date', '{{patrolDate}}') + row('Time', '{{patrolTime}}') + row('Zone/Area', '{{zone}}') + row('Status', '{{status}}') + row('Submitted By', '{{submittedBy}}'))}
                            ${alert('<strong>&#128270; Findings:</strong><br>{{findings}}', '#fff3cd', '#ffc107')}
                            ${btn('{{viewUrl}}', '#34495e', 'View Patrol Report')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 11. Entrance Form
templates.push({
    key: 'ENTRANCE_FORM_LOGGED', name: 'Workers Entrance Form Logged', module: 'Facility Management',
    subject: '&#128682; Worker Entrance Log - {{location}} - {{entryDate}}',
    body: shell('#6c757d',
        `${h1('&#128682; Workers Entrance Form')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A worker entrance has been logged:')}
                            ${table(row('Employee', '{{employeeName}}') + row('Badge #', '{{badgeNumber}}') + row('Entry Date', '{{entryDate}}') + row('Entry Time', '{{entryTime}}') + row('Purpose', '{{purpose}}') + row('Logged By', '{{loggedBy}}'))}
                            ${btn('{{viewUrl}}', '#6c757d', 'View Entry Log')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 12. Attendance Report
templates.push({
    key: 'ATTENDANCE_REPORT', name: 'Employee Attendance Report', module: 'Facility Management',
    subject: '&#9200; Attendance Alert - {{employeeName}} - {{date}}',
    body: shell('#fd7e14',
        `${h1('&#9200; Attendance Report')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('An attendance anomaly has been reported:')}
                            ${table(row('Employee', '{{employeeName}}') + row('Date', '{{date}}') + row('Arrival Time', '{{arrivalTime}}', { valColor: '#e74c3c', bold: true }) + row('Location', '{{location}}') + row('Reason', '{{reason}}') + row('Reported By', '{{reportedBy}}'))}
                            ${btn('{{viewUrl}}', '#fd7e14', 'View Details')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 13. Visitor Cars
templates.push({
    key: 'VISITOR_CARS_LOGGED', name: 'Visitor Vehicle Logged', module: 'Facility Management',
    subject: '&#128663; Visitor Vehicle - {{plateNumber}} - {{visitDate}}',
    body: shell('#2c3e50',
        `${h1('&#128663; Visitor Vehicle Log')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A visitor vehicle has been logged at the facility:')}
                            ${table(row('Plate Number', '{{plateNumber}}', { bold: true }) + row('Vehicle Type', '{{vehicleType}}') + row('Visitor Name', '{{visitorName}}') + row('Purpose', '{{purpose}}') + row('Time In', '{{timeIn}}') + row('Time Out', '{{timeOut}}') + row('Date', '{{visitDate}}') + row('Logged By', '{{loggedBy}}'))}
                            ${btn('{{viewUrl}}', '#2c3e50', 'View Log')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 14. Security Checklist
templates.push({
    key: 'SECURITY_CHECKLIST_SUBMITTED', name: 'Security Checklist Submitted', module: 'Facility Management',
    subject: '&#128737;&#65039; Security Checklist - {{location}} - {{shift}} Shift - {{weekDate}}',
    body: shell('#495057',
        `${h1('&#128737;&#65039; Security Checklist Submitted')}${sub('{{location}} - {{shift}} Shift')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A weekly security checklist has been submitted:')}
                            ${table(row('Location', '{{location}}') + row('Subcategory', '{{subcategory}}') + row('Shift', '{{shift}}') + row('Week', '{{weekDate}}') + row('Status', '{{status}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
                            ${alert('<strong>&#128270; Findings:</strong><br>{{findings}}', '#fff3cd', '#ffc107')}
                            ${btn('{{viewUrl}}', '#495057', 'View Checklist')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 15. Cleaning Checklist
templates.push({
    key: 'CLEANING_CHECKLIST_SUBMITTED', name: 'Cleaning Checklist Submitted', module: 'Facility Management',
    subject: '&#129529; Cleaning Checklist - {{location}} - {{weekDate}}',
    body: shell('#17a2b8',
        `${h1('&#129529; Cleaning Checklist Submitted')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A weekly cleaning checklist has been submitted:')}
                            ${table(row('Location', '{{location}}') + row('Category', '{{category}}') + row('Week', '{{weekDate}}') + row('Status', '{{status}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
                            ${alert('<strong>&#128221; Notes:</strong><br>{{notes}}', '#f8f9fa', '#17a2b8')}
                            ${btn('{{viewUrl}}', '#17a2b8', 'View Checklist')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 16. Daily Tasks
templates.push({
    key: 'DAILY_TASKS_REMINDER', name: 'Daily Tasks Reminder', module: 'Facility Management',
    subject: '&#128203; Daily Tasks - {{zone}} - {{date}}',
    body: shell('#28a745',
        `${h1('&#128203; Daily Tasks Assignment')}${sub('{{zone}} - {{date}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('Your daily tasks have been assigned. Please complete them by end of shift:')}
                            ${table(row('Zone', '{{zone}}') + row('Date', '{{date}}') + row('Team', '{{team}}') + row('Assigned By', '{{assignedBy}}'))}
                            ${alert('<strong>&#128203; Tasks:</strong><br>{{taskList}}', '#d4edda', '#28a745')}
                            ${btn('{{dashboardUrl}}', '#28a745', 'View Tasks')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// 17. Weekly Schedule
templates.push({
    key: 'WEEKLY_SCHEDULE_PUBLISHED', name: 'Weekly Schedule Published', module: 'Facility Management',
    subject: '&#128197; Weekly Cleaning Schedule - {{weekDate}}',
    body: shell('#6f42c1',
        `${h1('&#128197; Weekly Schedule Published')}${sub('Week of {{weekDate}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('The weekly cleaning schedule has been published:')}
                            ${table(row('Week', '{{weekDate}}') + row('Shift', '{{shift}}') + row('Areas Assigned', '{{areasAssigned}}') + row('Published By', '{{publishedBy}}') + row('Date', '{{publishedDate}}'))}
                            ${btn('{{viewUrl}}', '#6f42c1', 'View Schedule')}`,
        footer(['This is an automated notification from the Facility Management System.', '&copy; {{year}} GMRL Group'])
    )
});

// ─────────────────────────────────────────
// SECURITY CATEGORY
// ─────────────────────────────────────────

// 18. Internal Investigation
templates.push({
    key: 'INTERNAL_INVESTIGATION', name: 'Internal Investigation Report', module: 'Security',
    subject: '&#128270; Internal Investigation - {{storeName}} - {{caseTopic}}',
    body: shell('#7c3aed',
        `${h1('&#128270; Internal Investigation')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('An internal investigation has been opened and requires your attention:')}
                            ${table(row('Case Topic', '{{caseTopic}}', { bold: true }) + row('Store', '{{storeName}}') + row('Employees Involved', '{{employeesInvolved}}') + row('Amount Stolen', '{{amountStolen}}', { valColor: '#dc3545', bold: true }) + row('Amount Collected', '{{amountCollected}}', { valColor: '#28a745', bold: true }) + row('Security Team', '{{securityTeam}}') + row('HR Reps', '{{hrReps}}') + row('Status', '{{status}}'))}
                            ${alert('<strong>&#128221; Details:</strong><br>{{details}}', '#f8f9fa', '#7c3aed')}
                            ${btn('{{viewUrl}}', '#7c3aed', 'View Investigation')}`,
        footer(['This is a confidential notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// 19. Legal Cases
templates.push({
    key: 'LEGAL_CASE_UPDATE', name: 'Legal Case Update', module: 'Security',
    subject: '&#9878;&#65039; Legal Case Update - {{storeName}} - {{caseType}}',
    body: shell('#1e3a5f',
        `${h1('&#9878;&#65039; Legal Case Update')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A legal case has been updated:')}
                            ${table(row('Case Type', '{{caseType}}', { bold: true }) + row('Store(s)', '{{storeName}}') + row('Date of Issue', '{{dateOfIssue}}') + row('Amount Stolen', '{{amountStolen}}') + row('Amount Returned', '{{amountReturned}}') + row('Verdict', '{{verdict}}') + row('Status', '{{status}}', { bold: true }))}
                            ${alert('<strong>&#128221; Description:</strong><br>{{description}}', '#f8f9fa', '#1e3a5f')}
                            ${btn('{{viewUrl}}', '#1e3a5f', 'View Case')}`,
        footer(['This is a confidential notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// 20. Blacklist Update
templates.push({
    key: 'BLACKLIST_UPDATE', name: 'Blacklist Staff Update', module: 'Security',
    subject: '&#128683; Blacklist Update - {{staffName}} - {{action}}',
    body: shell('#343a40',
        `${h1('&#128683; Blacklist Update')}${sub('Staff Access Control')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A blacklist entry has been updated:')}
                            ${table(row('Staff Name', '{{staffName}}', { bold: true }) + row('Role', '{{role}}') + row('Company', '{{company}}') + row('Action', '{{action}}', { valColor: '#dc3545', bold: true }) + row('Reason', '{{reason}}') + row('Updated By', '{{updatedBy}}') + row('Date', '{{date}}'))}
                            ${btn('{{viewUrl}}', '#343a40', 'View Blacklist')}`,
        footer(['This is a confidential notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// 21. Camera Request
templates.push({
    key: 'CAMERA_REQUEST', name: 'Camera Request / Malfunction Report', module: 'Security',
    subject: '&#128249; Camera {{requestType}} - {{location}}',
    body: shell('#e67e22',
        `${h1('&#128249; Camera {{requestType}}')}${sub('{{location}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A camera request/malfunction has been reported:')}
                            ${table(row('Request Type', '{{requestType}}', { bold: true }) + row('Location', '{{location}}') + row('Camera Details', '{{cameraDetails}}') + row('Priority', '{{priority}}', { valColor: '#e67e22', bold: true }) + row('Reason', '{{reason}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
                            ${btn('{{viewUrl}}', '#e67e22', 'View Request')}`,
        footer(['This is an automated notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// 22. Post Visit Report
templates.push({
    key: 'POST_VISIT_REPORT', name: 'Post Visit Report Submitted', module: 'Security',
    subject: '&#128203; Post Visit Report - {{storeName}} - {{visitDate}}',
    body: shell('#2980b9',
        `${h1('&#128203; Post Visit Report')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A security post-visit report has been submitted:')}
                            ${table(row('Store', '{{storeName}}') + row('Visit Date', '{{visitDate}}') + row('Inspector', '{{inspector}}') + row('Status', '{{status}}'))}
                            ${alert('<strong>&#128270; Findings:</strong><br>{{findings}}', '#fff3cd', '#ffc107')}
                            ${alert('<strong>&#127919; Recommendations:</strong><br>{{recommendations}}', '#d4edda', '#28a745')}
                            ${btn('{{viewUrl}}', '#2980b9', 'View Full Report')}`,
        footer(['This is an automated notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// 23. Daily Reporting
templates.push({
    key: 'SECURITY_DAILY_REPORT', name: 'Security Daily Report', module: 'Security',
    subject: '&#128203; Security Daily Report - {{storeName}} - {{reportDate}}',
    body: shell('#34495e',
        `${h1('&#128203; Security Daily Report')}${sub('{{storeName}} - {{reportDate}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A security daily report has been submitted:')}
                            ${table(row('Store', '{{storeName}}') + row('Company', '{{company}}') + row('Guard', '{{guardName}}') + row('Date', '{{reportDate}}') + row('Submitted By', '{{submittedBy}}'))}
                            ${alert('<strong>&#128221; Daily Notes:</strong><br>{{dailyNotes}}', '#f8f9fa', '#34495e')}
                            ${btn('{{viewUrl}}', '#34495e', 'View Report')}`,
        footer(['This is an automated notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// 24. Visit Schedule (Calendar)
templates.push({
    key: 'VISIT_SCHEDULE_UPDATE', name: 'Visit Schedule Update', module: 'Security',
    subject: '&#128197; Visit Schedule - {{storeName}} - {{visitDate}}',
    body: shell('#0078d4',
        `${h1('&#128197; Visit Schedule Update')}${sub('{{storeName}}')}`,
        `${p('Dear {{recipientName}},')}
                            ${p('A store visit has been scheduled:')}
                            ${table(row('Store', '{{storeName}}') + row('Visit Date', '{{visitDate}}') + row('Scheduled Time', '{{scheduledTime}}') + row('Assigned To', '{{assignedTo}}') + row('Status', '{{status}}'))}
                            ${btn('{{viewUrl}}', '#0078d4', 'View Calendar')}`,
        footer(['This is an automated notification from the Security Department.', '&copy; {{year}} GMRL Group'])
    )
});

// ═══════════════════════════════════════════════════════════
// Execute inserts
// ═══════════════════════════════════════════════════════════
async function run() {
    const pool = await sql.connect(config);
    let inserted = 0, skipped = 0, failed = 0;
    
    for (const t of templates) {
        try {
            // Check if already exists
            const exists = await pool.request()
                .input('k', sql.NVarChar, t.key)
                .query('SELECT 1 FROM EmailTemplates WHERE TemplateKey = @k');
            
            if (exists.recordset.length > 0) {
                console.log(`  ⏭️  ${t.key} - already exists, skipping`);
                skipped++;
                continue;
            }
            
            await pool.request()
                .input('k', sql.NVarChar, t.key)
                .input('n', sql.NVarChar, t.name)
                .input('m', sql.NVarChar, t.module)
                .input('s', sql.NVarChar, t.subject)
                .input('b', sql.NVarChar, t.body)
                .query(`INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, SubjectTemplate, BodyTemplate, IsActive, CreatedAt) 
                        VALUES (@k, @n, @m, @s, @b, 1, GETDATE())`);
            
            console.log(`  ✅ ${t.key} (${t.module})`);
            inserted++;
        } catch (err) {
            console.log(`  ❌ ${t.key} - ERROR: ${err.message}`);
            failed++;
        }
    }
    
    console.log(`\n===================================`);
    console.log(`Database: ${config.database}`);
    console.log(`Inserted: ${inserted} | Skipped: ${skipped} | Failed: ${failed}`);
    console.log(`===================================`);
    
    await pool.close();
}

run();
