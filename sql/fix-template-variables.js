// ============================================================
// Fix ALL email templates to use correct variable names
// that match what each module's route actually passes
// ============================================================
const sql = require('mssql');
const db = process.argv[2] || 'OEApp_UAT';
const cfg = { server: 'localhost', database: db, user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

// Outlook-compatible helpers (same as create-all-module-templates.js)
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

// =========================================================
// ALL TEMPLATES - using ACTUAL variable names from routes
// =========================================================
const updates = {};

// ── STORES ──

// 1. EXTRA_CLEANING_REQUEST
// Route vars: store (=storeName), category, thirdParty, numberOfAgents, shiftHours, startDate, endDate, description, startTimeFrom, startTimeTo, endTimeFrom, endTimeTo
updates['EXTRA_CLEANING_REQUEST'] = {
    subject: '&#9989; Extra Third-Party Support - {{storeName}} - {{category}}',
    body: shell('#17a2b8',
        `${h1('&#128203; Extra Third-Party Support Request')}${sub('{{storeName}}')}`,
        `${p('A new extra third-party support request has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Category', '{{category}}') + row('Third Party', '{{thirdParty}}') + row('Number of Agents', '{{numberOfAgents}}') + row('Shift Hours', '{{shiftHours}} hours') + row('Start Date', '{{startDate}}') + row('End Date', '{{endDate}}') + row('Submitted By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#17a2b8')}
${btn('{{viewUrl}}', '#17a2b8', 'View Request')}`, footer())
};

// 2. COMPLAINT_SUBMITTED
// Route vars: category (categoryName), complaintType (typeName), storeId, description, caseNumber
updates['COMPLAINT_SUBMITTED'] = {
    subject: '&#128680; Complaint - {{storeName}} - {{category}}',
    body: shell('#e74c3c',
        `${h1('&#128680; Store Complaint')}${sub('{{storeName}}')}`,
        `${p('A new complaint has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Category', '{{category}}') + row('Complaint Type', '{{complaintType}}') + row('Case Number', '{{caseNumber}}') + row('Submitted By', '{{submittedBy}}') + row('Date', '{{submittedDate}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#e74c3c')}
${btn('{{viewUrl}}', '#e74c3c', 'View Complaint')}`, footer())
};

// 3. EVACUATION_DRILL_REPORT
// Route vars: drillDate, drillTime, shift, conductedBy, totalEmployeesInAssembly, actualEmployeesCount, drillPercentage, remarks
updates['EVACUATION_DRILL_REPORT'] = {
    subject: '&#128680; Evacuation Drill Report - {{storeName}} - {{drillDate}}',
    body: shell('#ff6b35',
        `${h1('&#128680; Post Evacuation Drill Report')}${sub('{{storeName}}')}`,
        `${p('A post-evacuation drill report has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Drill Date', '{{drillDate}}') + row('Drill Time', '{{drillTime}}') + row('Shift', '{{shift}}') + row('Conducted By', '{{conductedBy}}') + row('Total Employees', '{{totalEmployeesInAssembly}}') + row('Actual Count', '{{actualEmployeesCount}}') + row('Drill %', '{{drillPercentage}}%') + row('Submitted By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Remarks:</strong><br>{{remarks}}', '#fff3cd', '#ffc107')}
${btn('{{viewUrl}}', '#ff6b35', 'View Full Report')}`, footer())
};

// 4. LOSTFOUND_REPORT
// Route vars: itemDate, itemName, itemType, currency, amount, quantity, description
updates['LOSTFOUND_REPORT'] = {
    subject: '&#128270; Lost and Found - {{storeName}} - {{itemName}}',
    body: shell('#6f42c1',
        `${h1('&#128270; Lost and Found Report')}${sub('{{storeName}}')}`,
        `${p('A new item has been logged in the Lost and Found system:')}
${table(row('Store', '{{storeName}}') + row('Date', '{{itemDate}}') + row('Item Name', '{{itemName}}') + row('Item Type', '{{itemType}}') + row('Value', '{{currency}} {{amount}}') + row('Quantity', '{{quantity}}') + row('Logged By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#6f42c1')}
${btn('{{viewUrl}}', '#6f42c1', 'View Details')}`, footer())
};

// 5. OHS_INCIDENT_REPORT
// Route vars: incidentDate, incidentTime, exactLocation, reporterName, eventType, category, subCategory, bodyPart, injuryType, description
updates['OHS_INCIDENT_REPORT'] = {
    subject: '&#9888;&#65039; OHS Incident Report - {{storeName}} - {{incidentDate}}',
    body: shell('#dc3545',
        `${h1('&#9888;&#65039; OHS Incident Report')}${sub('{{storeName}}')}`,
        `${p('An OHS incident has been reported:')}
${alert('<strong>&#128680; Incident</strong> reported at <strong>{{storeName}}</strong>', '#f8d7da', '#dc3545')}
${table(row('Store', '{{storeName}}') + row('Date/Time', '{{incidentDate}} {{incidentTime}}') + row('Location', '{{exactLocation}}') + row('Reporter', '{{reporterName}}') + row('Event Type', '{{eventType}}') + row('Category', '{{category}}') + row('Body Part', '{{bodyPart}}') + row('Injury Type', '{{injuryType}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#dc3545')}
${btn('{{viewUrl}}', '#dc3545', 'View Full Report')}`, footer())
};

// 6. PRODUCTION_EXTRAS_REQUEST
// Route vars: numberOfAgents, totalCost, unitCost, description, startDateTime, endDateTime
updates['PRODUCTION_EXTRAS_REQUEST'] = {
    subject: '&#128230; Production Extras Request - {{storeName}}',
    body: shell('#20c997',
        `${h1('&#128230; Production Extras Request')}${sub('{{storeName}}')}`,
        `${p('A new production extras request has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Number of Agents', '{{numberOfAgents}}') + row('Unit Cost', '{{unitCost}}') + row('Total Cost', '{{totalCost}}') + row('Start', '{{startDateTime}}') + row('End', '{{endDateTime}}') + row('Requested By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#20c997')}
${btn('{{viewUrl}}', '#20c997', 'Review Request')}`, footer())
};

// 7. WEEKLY_FEEDBACK_SUBMITTED
// Route vars: weekStart, weekEnd, cleaningCompany, numberOfCleaners, cleanlinessRating, responseTimeRating, generalCleaningComments
updates['WEEKLY_FEEDBACK_SUBMITTED'] = {
    subject: '&#128203; Weekly Third Party Feedback - {{storeName}} - {{weekStart}}',
    body: shell('#fd7e14',
        `${h1('&#128203; Weekly Third Party Feedback')}${sub('{{storeName}}')}`,
        `${p('A weekly third-party feedback report has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Week', '{{weekStart}} to {{weekEnd}}') + row('Cleaning Company', '{{cleaningCompany}}') + row('Number of Cleaners', '{{numberOfCleaners}}') + row('Cleanliness Rating', '{{cleanlinessRating}}') + row('Response Time', '{{responseTimeRating}}') + row('Submitted By', '{{submittedBy}}'))}
${alert('&#128221; <strong>General Comments:</strong><br>{{generalCleaningComments}}', '#f8f9fa', '#fd7e14')}
${btn('{{viewUrl}}', '#fd7e14', 'View Feedback')}`, footer())
};

// ── FACILITY MANAGEMENT ──

// 8. PARKING_VIOLATION
// Route vars: violationDate, location, violatorName, carPlateNumber, parkingLotInfo
updates['PARKING_VIOLATION'] = {
    subject: '&#128663; Parking Violation - {{location}} - {{violationDate}}',
    body: shell('#e74c3c',
        `${h1('&#128663; Parking Violation Report')}${sub('{{location}}')}`,
        `${p('A parking violation has been reported:')}
${table(row('Date', '{{violationDate}}') + row('Location', '{{location}}') + row('Violator Name', '{{violatorName}}') + row('Vehicle Plate', '{{carPlateNumber}}') + row('Parking Lot Info', '{{parkingLotInfo}}') + row('Reported By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#e74c3c', 'View Details')}`, footer())
};

// 9. DELIVERY_LOG_ALERT
// Route vars: logDate, premises, filledBy
updates['DELIVERY_LOG_ALERT'] = {
    subject: '&#128666; Delivery Log - {{premises}} - {{logDate}}',
    body: shell('#3498db',
        `${h1('&#128666; Delivery Log Entry')}${sub('{{premises}}')}`,
        `${p('A delivery log has been submitted:')}
${table(row('Date', '{{logDate}}') + row('Premises', '{{premises}}') + row('Filled By', '{{filledBy}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#3498db', 'View Log')}`, footer())
};

// 10. PATROL_SHEET_SUBMITTED
// Route vars: patrolDate, location
updates['PATROL_SHEET_SUBMITTED'] = {
    subject: '&#128110; Patrol Report - {{location}} - {{patrolDate}}',
    body: shell('#34495e',
        `${h1('&#128110; Patrol Sheet Report')}${sub('{{location}}')}`,
        `${p('A patrol sheet has been submitted:')}
${table(row('Date', '{{patrolDate}}') + row('Location', '{{location}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#34495e', 'View Patrol Report')}`, footer())
};

// 11. ENTRANCE_FORM_LOGGED
// Route vars: formDate, location
updates['ENTRANCE_FORM_LOGGED'] = {
    subject: '&#128682; Worker Entrance Log - {{location}} - {{formDate}}',
    body: shell('#6c757d',
        `${h1('&#128682; Workers Entrance Form')}${sub('{{location}}')}`,
        `${p('A workers entrance form has been submitted:')}
${table(row('Date', '{{formDate}}') + row('Location', '{{location}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#6c757d', 'View Entry Log')}`, footer())
};

// 12. ATTENDANCE_REPORT
// Route vars: location, reportDate
updates['ATTENDANCE_REPORT'] = {
    subject: '&#9200; Attendance Report - {{location}} - {{reportDate}}',
    body: shell('#fd7e14',
        `${h1('&#9200; Attendance Report')}${sub('{{location}}')}`,
        `${p('An attendance report has been submitted:')}
${table(row('Date', '{{reportDate}}') + row('Location', '{{location}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#fd7e14', 'View Details')}`, footer())
};

// 13. VISITOR_CARS_LOGGED
// Route vars: location, recordDate
updates['VISITOR_CARS_LOGGED'] = {
    subject: '&#128663; Visitor Cars Log - {{location}} - {{recordDate}}',
    body: shell('#2c3e50',
        `${h1('&#128663; Visitor Vehicle Log')}${sub('{{location}}')}`,
        `${p('A visitor vehicle log has been submitted:')}
${table(row('Date', '{{recordDate}}') + row('Location', '{{location}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#2c3e50', 'View Log')}`, footer())
};

// 14. SECURITY_CHECKLIST_SUBMITTED
// Route vars: weekStart, subCategoryName, locationName
updates['SECURITY_CHECKLIST_SUBMITTED'] = {
    subject: '&#128737;&#65039; Security Checklist - {{locationName}} - {{weekStart}}',
    body: shell('#495057',
        `${h1('&#128737;&#65039; Security Checklist Submitted')}${sub('{{locationName}}')}`,
        `${p('A weekly security checklist has been submitted:')}
${table(row('Location', '{{locationName}}') + row('Subcategory', '{{subCategoryName}}') + row('Week Start', '{{weekStart}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#495057', 'View Checklist')}`, footer())
};

// 15. CLEANING_CHECKLIST_SUBMITTED
// Route vars: locationName, categoryName, weekStartDate
updates['CLEANING_CHECKLIST_SUBMITTED'] = {
    subject: '&#129529; Cleaning Checklist - {{locationName}} - {{weekStartDate}}',
    body: shell('#17a2b8',
        `${h1('&#129529; Cleaning Checklist Submitted')}${sub('{{locationName}}')}`,
        `${p('A weekly cleaning checklist has been submitted:')}
${table(row('Location', '{{locationName}}') + row('Category', '{{categoryName}}') + row('Week Start', '{{weekStartDate}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#17a2b8', 'View Checklist')}`, footer())
};

// 16. DAILY_TASKS_REMINDER
// Route vars: zoneName, teamTypeName, dateFrom, dateTo
updates['DAILY_TASKS_REMINDER'] = {
    subject: '&#128203; Daily Tasks - {{zoneName}} - {{dateFrom}}',
    body: shell('#28a745',
        `${h1('&#128203; Daily Tasks Submitted')}${sub('{{zoneName}}')}`,
        `${p('Daily tasks have been submitted:')}
${table(row('Zone', '{{zoneName}}') + row('Team Type', '{{teamTypeName}}') + row('Date From', '{{dateFrom}}') + row('Date To', '{{dateTo}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#28a745', 'View Tasks')}`, footer())
};

// 17. WEEKLY_SCHEDULE_PUBLISHED
// Route vars: shiftName, year, month
updates['WEEKLY_SCHEDULE_PUBLISHED'] = {
    subject: '&#128197; Weekly Schedule - {{shiftName}} - {{month}}/{{year}}',
    body: shell('#6f42c1',
        `${h1('&#128197; Weekly Schedule Published')}${sub('{{shiftName}} - {{month}}/{{year}}')}`,
        `${p('A weekly cleaning schedule has been submitted:')}
${table(row('Shift', '{{shiftName}}') + row('Month', '{{month}}') + row('Year', '{{year}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#6f42c1', 'View Schedule')}`, footer())
};

// ── SECURITY ──

// 18. INTERNAL_INVESTIGATION
// Route vars: caseTopic, employeeNames, currency, amountStolen, amountCollected, actionTaken, status
updates['INTERNAL_INVESTIGATION'] = {
    subject: '&#128270; Internal Investigation - {{storeName}} - {{caseTopic}}',
    body: shell('#7c3aed',
        `${h1('&#128270; Internal Investigation')}${sub('{{storeName}}')}`,
        `${p('An internal investigation has been opened:')}
${table(row('Case Topic', '{{caseTopic}}') + row('Store', '{{storeName}}') + row('Employees Involved', '{{employeeNames}}') + row('Amount Stolen', '{{currency}} {{amountStolen}}') + row('Amount Collected', '{{currency}} {{amountCollected}}') + row('Status', '{{status}}') + row('Opened By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Action Taken:</strong><br>{{actionTaken}}', '#f8f9fa', '#7c3aed')}
${btn('{{viewUrl}}', '#7c3aed', 'View Investigation')}`, footer())
};

// 19. LEGAL_CASE_UPDATE
// Route vars: caseType, description, dateOfIssue, amountStolen, amountReturned, verdict, status
updates['LEGAL_CASE_UPDATE'] = {
    subject: '&#9878;&#65039; Legal Case - {{storeName}} - {{caseType}}',
    body: shell('#1e3a5f',
        `${h1('&#9878;&#65039; Legal Case Update')}${sub('{{storeName}}')}`,
        `${p('A legal case has been submitted:')}
${table(row('Case Type', '{{caseType}}') + row('Store(s)', '{{storeName}}') + row('Date of Issue', '{{dateOfIssue}}') + row('Amount Stolen', '{{amountStolen}}') + row('Amount Returned', '{{amountReturned}}') + row('Verdict', '{{verdict}}') + row('Status', '{{status}}'))}
${alert('&#128221; <strong>Description:</strong><br>{{description}}', '#f8f9fa', '#1e3a5f')}
${btn('{{viewUrl}}', '#1e3a5f', 'View Case')}`, footer())
};

// 20. BLACKLIST_UPDATE
// Route vars: employeeName, role, company, incidentDate, incidentDetails
updates['BLACKLIST_UPDATE'] = {
    subject: '&#128683; Blacklist Update - {{employeeName}}',
    body: shell('#343a40',
        `${h1('&#128683; Blacklist Update')}${sub('Staff Access Control')}`,
        `${p('A blacklist entry has been created:')}
${table(row('Employee Name', '{{employeeName}}') + row('Role', '{{role}}') + row('Company', '{{company}}') + row('Incident Date', '{{incidentDate}}') + row('Updated By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Incident Details:</strong><br>{{incidentDetails}}', '#f8f9fa', '#343a40')}
${btn('{{viewUrl}}', '#343a40', 'View Blacklist')}`, footer())
};

// 21. CAMERA_REQUEST
// Route vars: requestType, numberOfCameras, storeName (from storeSelect lookup), requestReason, requestAreaCoverage
updates['CAMERA_REQUEST'] = {
    subject: '&#128249; Camera {{requestType}} - {{storeName}}',
    body: shell('#e67e22',
        `${h1('&#128249; Camera {{requestType}}')}${sub('{{storeName}}')}`,
        `${p('A camera request has been submitted:')}
${table(row('Request Type', '{{requestType}}') + row('Store', '{{storeName}}') + row('Number of Cameras', '{{numberOfCameras}}') + row('Reason', '{{requestReason}}') + row('Area Coverage', '{{requestAreaCoverage}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#e67e22', 'View Request')}`, footer())
};

// 22. POST_VISIT_REPORT
// Route vars: visitDate, overallRating
updates['POST_VISIT_REPORT'] = {
    subject: '&#128203; Post Visit Report - {{storeName}} - {{visitDate}}',
    body: shell('#2980b9',
        `${h1('&#128203; Post Visit Report')}${sub('{{storeName}}')}`,
        `${p('A security post-visit report has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Visit Date', '{{visitDate}}') + row('Overall Rating', '{{overallRating}}') + row('Inspector', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#2980b9', 'View Full Report')}`, footer())
};

// 23. SECURITY_DAILY_REPORT
// Route vars: reportDate, company, guardName, dailyNotes
updates['SECURITY_DAILY_REPORT'] = {
    subject: '&#128203; Security Daily Report - {{storeName}} - {{reportDate}}',
    body: shell('#34495e',
        `${h1('&#128203; Security Daily Report')}${sub('{{storeName}}')}`,
        `${p('A security daily report has been submitted:')}
${table(row('Store', '{{storeName}}') + row('Company', '{{company}}') + row('Guard', '{{guardName}}') + row('Date', '{{reportDate}}') + row('Submitted By', '{{submittedBy}}'))}
${alert('&#128221; <strong>Daily Notes:</strong><br>{{dailyNotes}}', '#f8f9fa', '#34495e')}
${btn('{{viewUrl}}', '#34495e', 'View Report')}`, footer())
};

// 24. VISIT_SCHEDULE_UPDATE
// Route vars: storeName, visitDate, scheduledTime, assignedTo, status (calendar module)
updates['VISIT_SCHEDULE_UPDATE'] = {
    subject: '&#128197; Visit Schedule - {{storeName}} - {{visitDate}}',
    body: shell('#0078d4',
        `${h1('&#128197; Visit Schedule Update')}${sub('{{storeName}}')}`,
        `${p('A store visit has been scheduled:')}
${table(row('Store', '{{storeName}}') + row('Visit Date', '{{visitDate}}') + row('Submitted By', '{{submittedBy}}'))}
${btn('{{viewUrl}}', '#0078d4', 'View Calendar')}`, footer())
};

// =========================================================
// Execute updates
// =========================================================
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
