/**
 * Insert Receiving Audit Email Templates
 * Run: node insert-rcv-email-templates.js [uat|live|both]
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
        TemplateKey: 'RCV_FULL',
        TemplateName: 'Receiving Audit Full Report Email',
        Module: 'RCV',
        ReportType: 'full',
        SubjectTemplate: '📦 Receiving Audit Report - {{storeName}} - {{documentNumber}} ({{totalScore}}%)',
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
        .score-badge { display: inline-block; padding: 10px 25px; border-radius: 25px; font-size: 20px; font-weight: 700; margin: 15px 0; }
        .score-pass { background: rgba(40, 167, 69, 0.15); color: #28a745; }
        .score-fail { background: rgba(220, 53, 69, 0.15); color: #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #3949ab; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Receiving Audit Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Please find below the summary of the Receiving Audit conducted at your store:</p>
            
            <div style="text-align: center;">
                <div class="score-badge {{scoreClass}}">
                    {{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Audit Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Auditor</td><td class="value">{{auditors}}</td></tr>
                <tr><td class="label">Status</td><td class="value">{{status}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📄 View Full Report</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the report and ensure all receiving procedures are followed.</p>
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
        TemplateKey: 'RCV_ACTION_PLAN',
        TemplateName: 'Receiving Audit Action Plan Email',
        Module: 'RCV',
        ReportType: 'action-plan',
        SubjectTemplate: '📦 Receiving Audit Action Plan - {{storeName}} - {{totalFindings}} Findings',
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
        .findings-grid { display: table; width: 100%; margin: 20px 0; }
        .finding-stat { display: table-cell; text-align: center; padding: 15px; }
        .finding-stat .count { font-size: 28px; font-weight: 700; }
        .finding-stat .count.total { color: #333; }
        .finding-stat .count.high { color: #dc3545; }
        .finding-stat .count.medium { color: #fd7e14; }
        .finding-stat .count.low { color: #ffc107; }
        .finding-stat .label { font-size: 12px; color: #666; margin-top: 5px; }
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
            <h1>📦 Receiving Audit Action Plan</h1>
            <div class="subtitle">{{storeName}} - {{documentNumber}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Following the Receiving Audit at your store, the following findings require your <strong>attention</strong>:</p>
            
            <div class="findings-grid">
                <div class="finding-stat">
                    <div class="count total">{{totalFindings}}</div>
                    <div class="label">Total Findings</div>
                </div>
                <div class="finding-stat">
                    <div class="count high">{{highFindings}}</div>
                    <div class="label">High Priority</div>
                </div>
                <div class="finding-stat">
                    <div class="count medium">{{mediumFindings}}</div>
                    <div class="label">Medium Priority</div>
                </div>
                <div class="finding-stat">
                    <div class="count low">{{lowFindings}}</div>
                    <div class="label">Low Priority</div>
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Audit Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Auditor</td><td class="value">{{auditors}}</td></tr>
                <tr><td class="label">Overall Score</td><td class="value">{{totalScore}}%</td></tr>
                <tr><td class="label" style="color: #dc3545; font-weight: 700;">📅 Action Required By</td><td class="value" style="color: #dc3545; font-weight: 700;">{{deadline}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{actionPlanUrl}}" class="btn">📋 View Action Plan</a>
            </div>
            
            <div class="warning-box">
                <strong>⚠️ Important:</strong>
                <p style="margin: 10px 0 0 0; color: #856404;">
                    High-priority findings must be addressed <strong>promptly</strong>.
                    Proper receiving procedures ensure product quality and food safety.
                    Escalation to Area Manager will occur if findings remain unresolved.
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
        TemplateKey: 'RCV_ESCALATION',
        TemplateName: 'Receiving Audit Escalation Email',
        Module: 'RCV',
        ReportType: 'escalation',
        SubjectTemplate: '🚨 ESCALATION: Receiving Audit Action Plan Overdue - {{storeName}} - {{daysOverdue}} Days',
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
            <h1>🚨 ESCALATION NOTICE</h1>
            <div class="subtitle">Receiving Audit Action Plan Overdue</div>
        </div>
        <div class="content">
            <p>Dear Area Manager,</p>
            <p>This is to notify you that the action plan for the following Receiving Audit is <strong>overdue</strong> and requires your immediate attention:</p>
            
            <div style="text-align: center;">
                <div class="overdue-badge">
                    ⏰ {{daysOverdue}} Days Overdue
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Audit Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Original Deadline</td><td class="value" style="color: #dc3545;">{{deadline}}</td></tr>
                <tr><td class="label">Pending Findings</td><td class="value">{{pendingFindings}} items</td></tr>
                <tr><td class="label">Store Manager</td><td class="value">{{storeManager}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{actionPlanUrl}}" class="btn">📋 View Action Plan</a>
            </div>
            
            <div class="alert-box">
                <strong>🚨 Action Required:</strong>
                <p style="margin: 10px 0 0 0; color: #721c24;">
                    Please follow up with the store manager to ensure all findings are addressed immediately.
                    Unresolved receiving issues may impact product quality and food safety compliance.
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
    console.log(`\n📦 Inserting RCV templates into ${env.toUpperCase()} (${config.database})...`);
    
    try {
        const pool = await new sql.ConnectionPool(config).connect();
        
        for (const template of templates) {
            const result = await pool.request()
                .input('TemplateKey', sql.NVarChar, template.TemplateKey)
                .input('TemplateName', sql.NVarChar, template.TemplateName)
                .input('Module', sql.NVarChar, template.Module)
                .input('ReportType', sql.NVarChar, template.ReportType)
                .input('SubjectTemplate', sql.NVarChar, template.SubjectTemplate)
                .input('BodyTemplate', sql.NVarChar, template.BodyTemplate)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = @TemplateKey)
                    BEGIN
                        INSERT INTO EmailTemplates (TemplateKey, TemplateName, Module, ReportType, SubjectTemplate, BodyTemplate, IsActive, CreatedAt)
                        VALUES (@TemplateKey, @TemplateName, @Module, @ReportType, @SubjectTemplate, @BodyTemplate, 1, GETDATE())
                    END
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
    const arg = process.argv[2] || 'both';
    
    if (arg === 'uat' || arg === 'both') {
        await insertTemplates('uat');
    }
    if (arg === 'live' || arg === 'both') {
        await insertTemplates('live');
    }
    
    process.exit(0);
}

main();
