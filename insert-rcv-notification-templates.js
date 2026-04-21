/**
 * Insert RCV Inspection Notification Templates
 * Run: node insert-rcv-notification-templates.js
 */

const sql = require('mssql');

const configs = {
    uat: {
        server: 'localhost',
        database: 'OEApp_UAT',
        user: 'sa',
        password: 'Kokowawa123@@',
        options: { encrypt: false, trustServerCertificate: true }
    },
    live: {
        server: 'localhost',
        database: 'OEApp_Live',
        user: 'sa',
        password: 'Kokowawa123@@',
        options: { encrypt: false, trustServerCertificate: true }
    }
};

const templates = [
    {
        TemplateKey: 'RCV_INSPECTION_REMINDER',
        TemplateName: 'Receiving Audit Reminder Email',
        Module: 'RCV',
        ReportType: 'inspection-reminder',
        SubjectTemplate: '📦 Reminder: Receiving Audit Action Plan Due Soon - {{storeName}} - {{daysUntilDeadline}} Days Left',
        BodyTemplate: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #5c6bc0 0%, #3949ab 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: 700; margin: 15px 0; background: #fff3cd; color: #856404; border: 2px solid #ffc107; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #3949ab; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .warning-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 25px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Action Plan Reminder</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>This is a friendly reminder that the action plan for your Receiving Audit is <strong>due soon</strong>.</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">
                    ⏰ {{daysUntilDeadline}} Days Remaining
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Audit Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label" style="color: #f59e0b; font-weight: 700;">📅 Deadline</td><td class="value" style="color: #f59e0b; font-weight: 700;">{{deadline}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{actionPlanUrl}}" class="btn">📋 View Action Plan</a>
            </div>
            
            <div class="warning-box">
                <strong>⚠️ Important:</strong>
                <p style="margin: 10px 0 0 0; color: #856404;">
                    Please complete all action items before the deadline to avoid escalation to Area Manager.
                </p>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>`
    },
    {
        TemplateKey: 'RCV_INSPECTION_OVERDUE',
        TemplateName: 'Receiving Audit Overdue Email',
        Module: 'RCV',
        ReportType: 'inspection-overdue',
        SubjectTemplate: '🚨 OVERDUE: Receiving Audit Action Plan - {{storeName}} - {{daysOverdue}} Days Overdue',
        BodyTemplate: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .overdue-badge { display: inline-block; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: 700; margin: 15px 0; background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .alert-box { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin-top: 25px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Action Plan Overdue</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>The action plan for your Receiving Audit is <strong>OVERDUE</strong> and requires immediate attention.</p>
            
            <div style="text-align: center;">
                <div class="overdue-badge">
                    ⏰ {{daysOverdue}} Days Overdue
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Audit Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label" style="color: #dc3545; font-weight: 700;">📅 Original Deadline</td><td class="value" style="color: #dc3545; font-weight: 700;">{{deadline}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{actionPlanUrl}}" class="btn">📋 Complete Action Plan Now</a>
            </div>
            
            <div class="alert-box">
                <strong>🚨 Urgent Action Required:</strong>
                <p style="margin: 10px 0 0 0; color: #721c24;">
                    This matter will be escalated to Area Manager if not resolved immediately.
                    Please complete all pending action items as soon as possible.
                </p>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>`
    },
    {
        TemplateKey: 'RCV_INSPECTION_ESCALATION',
        TemplateName: 'Receiving Audit Escalation to Area Manager',
        Module: 'RCV',
        ReportType: 'inspection-escalation',
        SubjectTemplate: '🚨 ESCALATION: Receiving Audit Action Plan Overdue - {{storeName}} - {{daysOverdue}} Days',
        BodyTemplate: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .escalation-badge { display: inline-block; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: 700; margin: 15px 0; background: #ede9fe; color: #5b21b6; border: 2px solid #a78bfa; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .alert-box { background: #ede9fe; border: 1px solid #a78bfa; border-radius: 8px; padding: 15px; margin-top: 25px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Escalation Notice</h1>
            <div class="subtitle">Receiving Audit Action Plan Overdue</div>
        </div>
        <div class="content">
            <p>Dear Area Manager,</p>
            <p>This is to notify you that the action plan for the following Receiving Audit is <strong>overdue</strong> and requires your intervention.</p>
            
            <div style="text-align: center;">
                <div class="escalation-badge">
                    ⏰ {{daysOverdue}} Days Overdue
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Audit Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Original Deadline</td><td class="value" style="color: #dc3545;">{{deadline}}</td></tr>
                <tr><td class="label">Store Manager</td><td class="value">{{storeManager}}</td></tr>
                <tr><td class="label">Pending Items</td><td class="value">{{pendingFindings}} action items</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{actionPlanUrl}}" class="btn">📋 View Action Plan</a>
            </div>
            
            <div class="alert-box">
                <strong>📢 Management Action Required:</strong>
                <p style="margin: 10px 0 0 0; color: #5b21b6;">
                    Please follow up with the store manager to ensure all receiving audit findings are addressed promptly.
                    Unresolved issues may impact product quality and food safety compliance.
                </p>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated escalation from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>`
    }
];

async function insertTemplates(env) {
    const config = configs[env];
    console.log(`\n📦 Inserting RCV notification templates into ${env.toUpperCase()} (${config.database})...`);
    
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        
        for (const template of templates) {
            // Check if exists
            const exists = await pool.request()
                .input('key', sql.NVarChar, template.TemplateKey)
                .query('SELECT 1 FROM EmailTemplates WHERE TemplateKey = @key');
            
            if (exists.recordset.length > 0) {
                console.log(`  ⏭️ ${template.TemplateKey} already exists, skipping`);
                continue;
            }
            
            await pool.request()
                .input('TemplateKey', sql.NVarChar, template.TemplateKey)
                .input('TemplateName', sql.NVarChar, template.TemplateName)
                .input('Module', sql.NVarChar, template.Module)
                .input('ReportType', sql.NVarChar, template.ReportType)
                .input('SubjectTemplate', sql.NVarChar, template.SubjectTemplate)
                .input('BodyTemplate', sql.NVarChar, template.BodyTemplate)
                .query(`
                    INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
                    VALUES (@TemplateKey, @TemplateName, @Module, @ReportType, @SubjectTemplate, @BodyTemplate, 1, GETDATE())
                `);
            console.log(`  ✅ ${template.TemplateKey}`);
        }
        
        await pool.close();
        console.log(`✅ ${env.toUpperCase()} complete!`);
    } catch (err) {
        console.error(`❌ Error in ${env}:`, err.message);
    }
}

async function main() {
    await insertTemplates('uat');
    await insertTemplates('live');
    process.exit(0);
}

main();
