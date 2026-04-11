// Fix remaining corrupted email template icons in database (batch 2)
// Run: node sql/run-fix-email-template-icons-2.js

const sql = require('mssql');
const config = require('../config/default');
const dbConfig = config.database;

const fixes = [
    {
        key: 'BROADCAST_5DAYS',
        subject: '📅 5 Days Expired Items Check Reminder',
        body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(102, 126, 234, 0.15); color: #667eea; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .checklist { background: #e8f5e9; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .checklist-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .checklist-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 5 Days Expired Items Check</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Daily Compliance Reminder</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">\u23F0 Action Required</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="checklist">
                <strong>📋 Checklist:</strong>
                <div class="checklist-item">\u2705 Check all products within 5 days of expiry</div>
                <div class="checklist-item">\u2705 Update inventory system</div>
                <div class="checklist-item">\u2705 Mark down items as needed</div>
                <div class="checklist-item">\u2705 Submit daily report</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>\u00A9 {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>`
    },
    {
        key: 'BROADCAST_INSPECTION',
        subject: '🔍 Inspection Due Reminder',
        body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0078d4 0%, #00bcf2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(0, 120, 212, 0.15); color: #0078d4; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #0078d4; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #0078d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .prep-list { background: #e3f2fd; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .prep-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .prep-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Inspection Reminder</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Prepare Your Store</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">📋 Inspection Due</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="prep-list">
                <strong>🔍 Preparation Checklist:</strong>
                <div class="prep-item">📁 Gather all required documentation</div>
                <div class="prep-item">🧹 Ensure all areas are clean and organized</div>
                <div class="prep-item">\u2705 Verify compliance with all standards</div>
                <div class="prep-item">👥 Brief your team on inspection expectations</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">View Inspection Schedule</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>\u00A9 {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>`
    },
    {
        key: 'BROADCAST_CLEANING',
        subject: '🧹 Cleaning Checklist Reminder',
        body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(23, 162, 184, 0.15); color: #17a2b8; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #17a2b8; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #17a2b8; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .cleaning-areas { background: #e0f7fa; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .area-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .area-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧹 Cleaning Checklist</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Daily Hygiene Standards</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">🧼 Cleanliness Matters</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="cleaning-areas">
                <strong>🏪 Key Areas to Clean:</strong>
                <div class="area-item">🚪 Entrance & Customer Areas</div>
                <div class="area-item">🍽\uFE0F Food Preparation Surfaces</div>
                <div class="area-item">🚿 Restrooms & Washrooms</div>
                <div class="area-item">🗑\uFE0F Waste Disposal Areas</div>
                <div class="area-item">\u2744\uFE0F Refrigeration Units</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Submit Cleaning Report</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>\u00A9 {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>`
    },
    {
        key: 'BROADCAST_SAFETY',
        subject: '\u26A0\uFE0F Safety Compliance Reminder',
        body: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .reminder-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 16px; font-weight: 600; background: rgba(220, 53, 69, 0.15); color: #dc3545; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .safety-tips { background: #ffebee; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffcdd2; }
        .tip-item { padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .tip-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>\u26A0\uFE0F Safety First</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Your Safety is Our Priority</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="reminder-badge">🦺 Safety Alert</div>
            </div>
            
            <div class="message-box">{{message}}</div>
            
            <div class="safety-tips">
                <strong>🛡\uFE0F Safety Reminders:</strong>
                <div class="tip-item">🔥 Know your fire exit locations</div>
                <div class="tip-item">🧤 Use proper PPE when required</div>
                <div class="tip-item">\u26A1 Report electrical hazards immediately</div>
                <div class="tip-item">🚫 Keep emergency exits clear at all times</div>
                <div class="tip-item">📞 Know emergency contact numbers</div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Review Safety Guidelines</a>
            </div>
        </div>
        <div class="footer">
            <p>Sent by: {{senderName}} | {{sentDate}}</p>
            <p>\u00A9 {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>`
    },
    {
        key: 'DEPARTMENT_ESCALATION',
        subject: '🔔 [{{module}}] Action Required: {{department}} - {{storeName}}',
        body: `<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 650px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 25px; color: white; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 1.5rem;">📋 {{module}} Inspection - Department Escalation</h2>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">An item has been assigned to your department</p>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin-bottom: 20px;">Dear {{departmentName}} Team,</p>
        
        <p style="color: #374151;">An inspection finding has been assigned to your department for follow-up:</p>
        
        <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 140px;">Store</td>
                    <td style="padding: 8px 0; color: #111827; font-weight: 600;">{{storeName}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Document #</td>
                    <td style="padding: 8px 0; color: #111827;">{{documentNumber}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Reference</td>
                    <td style="padding: 8px 0; color: #111827;">{{referenceValue}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Question</td>
                    <td style="padding: 8px 0; color: #111827;">{{questionTitle}}</td>
                </tr>
            </table>
        </div>
        
        <div style="background: #fef2f2; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h4 style="margin: 0 0 10px 0; color: #dc2626;">\u26A0\uFE0F Finding</h4>
            <p style="margin: 0; color: #374151;">{{finding}}</p>
        </div>
        
        <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h4 style="margin: 0 0 10px 0; color: #16a34a;">\u2705 Required Action</h4>
            <p style="margin: 0; color: #374151;">{{correctiveAction}}</p>
        </div>
        
        <table style="width: 100%; margin: 25px 0;">
            <tr>
                <td style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="color: #92400e; font-size: 0.85rem;">Priority</div>
                    <div style="color: #78350f; font-size: 1.1rem; font-weight: 700;">{{priority}}</div>
                </td>
                <td style="width: 15px;"></td>
                <td style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="color: #991b1b; font-size: 0.85rem;">Deadline</div>
                    <div style="color: #7f1d1d; font-size: 1.1rem; font-weight: 700;">{{deadline}}</div>
                </td>
            </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 0.9rem; margin-top: 25px;">
            Escalated by: <strong>{{escalatedByName}}</strong> on {{escalatedAt}}
        </p>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="{{actionPlanUrl}}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Action Plan</a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 0.8rem; text-align: center; margin: 0;">
            This is an automated notification from the {{module}} Inspection System.
        </p>
    </div>
</div>`
    },
    {
        key: 'DEPARTMENT_REMINDER',
        subject: '\u23F0 Reminder: [{{module}}] Pending Action - {{department}} - {{storeName}}',
        body: `<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 650px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 25px; color: white; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 1.5rem;">\u23F0 Reminder: Pending Department Action</h2>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">This item requires your attention</p>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin-bottom: 20px;">Dear {{departmentName}} Team,</p>
        
        <p style="color: #374151;">This is a reminder that the following item is still pending and {{status}}:</p>
        
        <div style="background: #fef3c7; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #92400e; width: 140px;">Store</td>
                    <td style="padding: 8px 0; color: #78350f; font-weight: 600;">{{storeName}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #92400e;">Document #</td>
                    <td style="padding: 8px 0; color: #78350f;">{{documentNumber}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #92400e;">Finding</td>
                    <td style="padding: 8px 0; color: #78350f;">{{finding}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #92400e;">Deadline</td>
                    <td style="padding: 8px 0; color: #dc2626; font-weight: 700;">{{deadline}} ({{daysStatus}})</td>
                </tr>
            </table>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="{{actionPlanUrl}}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: 600;">Take Action Now</a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 0.8rem; text-align: center; margin: 0;">
            This is reminder #{{reminderCount}}. Escalated on {{escalatedAt}}.
        </p>
    </div>
</div>`
    },
    {
        key: 'OE_INSPECTION_REMINDER',
        subject: '\u23F0 [OE] Action Plan Reminder: {{storeName}} - {{documentNumber}} ({{daysUntilDeadline}} days left)',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #3498db, #2980b9); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">\u23F0 OE Action Plan Reminder</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>This is a reminder that the action plan for the following OE inspection is due soon:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr style="background: #e3f2fd;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #2980b9; font-weight: bold;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3e0;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Remaining</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e67e22; font-weight: bold;">{{daysUntilDeadline}} day(s)</td>
            </tr>
        </table>
        
        <p>Please ensure all action items are addressed before the deadline to avoid escalation.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated reminder from the OE Inspection System.</em>
        </p>
    </div>
</div>`
    },
    {
        key: 'OE_INSPECTION_OVERDUE',
        subject: '\u26A0\uFE0F [OE] Action Plan OVERDUE: {{storeName}} - {{documentNumber}} ({{daysOverdue}} days overdue)',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">\u26A0\uFE0F OE Action Plan Overdue</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p><strong style="color: #e67e22;">The action plan deadline has passed.</strong> Please complete the outstanding items immediately to avoid escalation to your Area Manager.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3cd;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #e67e22;"><strong>Action Required:</strong> Complete all outstanding action items as soon as possible.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #e67e22; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Action Plan Now</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated notification from the OE Inspection System.</em>
        </p>
    </div>
</div>`
    },
    {
        key: 'OHS_INSPECTION_REMINDER',
        subject: '\u23F0 [OHS] Safety Action Plan Reminder: {{storeName}} - {{documentNumber}} ({{daysUntilDeadline}} days left)',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #27ae60, #2ecc71); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">\u23F0 OHS Safety Action Plan Reminder</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p>This is a reminder that the <strong>safety action plan</strong> for the following OHS inspection is due soon:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr style="background: #e8f5e9;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #27ae60; font-weight: bold;">{{deadline}}</td>
            </tr>
            <tr style="background: #fff3e0;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Remaining</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e67e22; font-weight: bold;">{{daysUntilDeadline}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #27ae60;"><strong>Safety compliance is critical.</strong> Please ensure all safety action items are addressed before the deadline.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #27ae60; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">View Safety Action Plan</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated reminder from the OHS Safety Inspection System.</em>
        </p>
    </div>
</div>`
    },
    {
        key: 'OHS_INSPECTION_OVERDUE',
        subject: '\u26A0\uFE0F [OHS] Safety Action Plan OVERDUE: {{storeName}} - {{documentNumber}} ({{daysOverdue}} days overdue)',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #e67e22, #d35400); padding: 20px; color: white; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0;">\u26A0\uFE0F OHS Safety Action Plan Overdue</h2>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
        <p>Dear {{recipientName}},</p>
        <p><strong style="color: #e74c3c;">URGENT: The safety action plan deadline has passed.</strong> Please complete the outstanding safety items immediately to maintain compliance and avoid escalation.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Store</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{storeName}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection #</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{documentNumber}}</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Inspection Date</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{inspectionDate}}</td>
            </tr>
            <tr>
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Deadline</strong></td>
                <td style="padding: 12px; border: 1px solid #eee;">{{deadline}}</td>
            </tr>
            <tr style="background: #ffebee;">
                <td style="padding: 12px; border: 1px solid #eee;"><strong>Days Overdue</strong></td>
                <td style="padding: 12px; border: 1px solid #eee; color: #e74c3c; font-weight: bold;">{{daysOverdue}} day(s)</td>
            </tr>
        </table>
        
        <p style="color: #e74c3c;"><strong>\u26A0\uFE0F Safety compliance must not be delayed.</strong> Complete all outstanding safety action items immediately.</p>
        
        <p style="margin-top: 25px;">
            <a href="{{actionPlanUrl}}" style="background: #e67e22; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Safety Action Plan Now</a>
        </p>
        
        <p style="margin-top: 25px;">
            <em style="color: #888;">This is an automated notification from the OHS Safety Inspection System.</em>
        </p>
    </div>
</div>`
    }
];

async function fixTemplates() {
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        console.log('Connected to:', dbConfig.database);

        for (const tmpl of fixes) {
            await pool.request()
                .input('key', sql.NVarChar, tmpl.key)
                .input('subject', sql.NVarChar, tmpl.subject)
                .input('body', sql.NVarChar(sql.MAX), tmpl.body)
                .query('UPDATE EmailTemplates SET SubjectTemplate = @subject, BodyTemplate = @body, UpdatedAt = GETDATE() WHERE TemplateKey = @key');
            console.log('Fixed:', tmpl.key);
        }

        // Verify all
        const result = await pool.request().query('SELECT TemplateKey, LEFT(SubjectTemplate, 80) as Subj FROM EmailTemplates ORDER BY TemplateKey');
        console.log('\n=== All templates after fix ===');
        result.recordset.forEach(r => console.log(r.TemplateKey, '|', r.Subj));
        
        await pool.close();
        console.log('\nDone!');
    } catch(err) {
        console.error('Error:', err.message);
        if (pool) await pool.close();
    }
}

fixTemplates();
