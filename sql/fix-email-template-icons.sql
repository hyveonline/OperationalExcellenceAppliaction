-- Fix Corrupted Email Template Icons
-- Problem: Emoji characters inserted without N'' prefix get corrupted in SQL Server
-- Solution: UPDATE all affected templates with proper N'' Unicode prefix
-- Run on: UAT and LIVE databases
-- Date: 2026-04-11

USE OEApp_UAT;  -- Change to OEApp_Live for LIVE
GO

-- 1. Fix OE_FULL template
UPDATE EmailTemplates
SET SubjectTemplate = N'📋 OE Inspection Report - {{storeName}} - {{documentNumber}} ({{totalScore}}%)',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: {{brandGradient}}; color: white; padding: 30px; text-align: center; }
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
        .btn { display: inline-block; padding: 14px 30px; background: {{brandColor}}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 OE Inspection Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Please find below the summary of the Operational Excellence inspection conducted at your store:</p>
            
            <div style="text-align: center;">
                <div class="score-badge {{scoreClass}}">
                    {{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{auditors}}</td></tr>
                <tr><td class="label">Status</td><td class="value">{{status}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📄 View Full Report</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the report and address any findings within the required timeframe.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OE_FULL';
PRINT 'Fixed OE_FULL template';
GO

-- 2. Fix OE_ACTION_PLAN template
UPDATE EmailTemplates
SET SubjectTemplate = N'📝 OE Action Plan Required - {{storeName}} - {{totalFindings}} Findings ({{highFindings}} High)',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: {{brandGradient}}; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .findings-grid { display: table; width: 100%; margin: 20px 0; }
        .finding-stat { display: table-cell; text-align: center; padding: 15px; }
        .finding-stat .count { font-size: 32px; font-weight: 700; }
        .finding-stat .count.total { color: #333; }
        .finding-stat .count.high { color: #dc3545; }
        .finding-stat .count.medium { color: #fd7e14; }
        .finding-stat .count.low { color: #ffc107; }
        .finding-stat .label { font-size: 12px; color: #666; margin-top: 5px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: {{brandColor}}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .deadline-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 OE Action Plan</h1>
            <div class="subtitle">{{storeName}} - {{documentNumber}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Following the Operational Excellence inspection at your store, please find below the findings that require your attention:</p>
            
            <div class="findings-grid">
                <div class="finding-stat"><div class="count total">{{totalFindings}}</div><div class="label">Total</div></div>
                <div class="finding-stat"><div class="count high">{{highFindings}}</div><div class="label">High</div></div>
                <div class="finding-stat"><div class="count medium">{{mediumFindings}}</div><div class="label">Medium</div></div>
                <div class="finding-stat"><div class="count low">{{lowFindings}}</div><div class="label">Low</div></div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}}</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{auditDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{auditors}}</td></tr>
            </table>
            
            <div class="deadline-box">
                ⏰ <strong>Deadline:</strong> Please complete all corrective actions by {{deadline}}
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📋 View Action Plan</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OE_ACTION_PLAN';
PRINT 'Fixed OE_ACTION_PLAN template';
GO

-- 3. Fix OHS_FULL template
UPDATE EmailTemplates
SET SubjectTemplate = N'🦺 OHS Inspection Report - {{storeName}} - {{documentNumber}} ({{totalScore}}%)',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 30px; text-align: center; }
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
        .btn { display: inline-block; padding: 14px 30px; background: #e17055; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🦺 OHS Inspection Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Please find below the summary of the Occupational Health & Safety inspection conducted at your store:</p>
            
            <div style="text-align: center;">
                <div class="score-badge {{scoreClass}}">
                    {{scoreIcon}} Score: {{totalScore}}% ({{scoreStatus}})
                </div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{inspectionDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{inspectors}}</td></tr>
                <tr><td class="label">Status</td><td class="value">{{status}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📄 View Full Report</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the report and ensure all safety standards are maintained.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from the OHS Inspection System.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OHS_FULL';
PRINT 'Fixed OHS_FULL template';
GO

-- 4. Fix OHS_ACTION_PLAN template
UPDATE EmailTemplates
SET SubjectTemplate = N'⚠️ OHS Action Plan Required - {{storeName}} - {{totalFindings}} Safety Findings',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e17055 0%, #d63031 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .findings-grid { display: table; width: 100%; margin: 20px 0; }
        .finding-stat { display: table-cell; text-align: center; padding: 15px; }
        .finding-stat .count { font-size: 28px; font-weight: 700; }
        .finding-stat .count.total { color: #333; }
        .finding-stat .count.critical { color: #7c3aed; }
        .finding-stat .count.high { color: #dc3545; }
        .finding-stat .count.medium { color: #fd7e14; }
        .finding-stat .count.low { color: #ffc107; }
        .finding-stat .label { font-size: 11px; color: #666; margin-top: 5px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #e17055; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .urgent-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ OHS Action Plan</h1>
            <div class="subtitle">{{storeName}} - {{documentNumber}}</div>
        </div>
        <div class="content">
            <p>Dear Store Manager,</p>
            <p>Following the OHS inspection at your store, the following safety findings require <strong>immediate attention</strong>:</p>
            
            <div class="findings-grid">
                <div class="finding-stat"><div class="count total">{{totalFindings}}</div><div class="label">Total</div></div>
                <div class="finding-stat"><div class="count critical">{{criticalFindings}}</div><div class="label">Critical</div></div>
                <div class="finding-stat"><div class="count high">{{highFindings}}</div><div class="label">High</div></div>
                <div class="finding-stat"><div class="count medium">{{mediumFindings}}</div><div class="label">Medium</div></div>
                <div class="finding-stat"><div class="count low">{{lowFindings}}</div><div class="label">Low</div></div>
            </div>
            
            <div class="urgent-box">
                🚨 <strong>Safety Priority:</strong> Critical and High priority items must be addressed within 48 hours.
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}}</td></tr>
                <tr><td class="label">Inspection Date</td><td class="value">{{inspectionDate}}</td></tr>
                <tr><td class="label">Inspector</td><td class="value">{{inspectors}}</td></tr>
            </table>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{reportUrl}}" class="btn">📋 View Action Plan</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the OHS Inspection System.</p>
            <p>© {{year}} GMRL Group</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OHS_ACTION_PLAN';
PRINT 'Fixed OHS_ACTION_PLAN template';
GO

-- 5. Fix OE_VERIFICATION_SUBMITTED template
UPDATE EmailTemplates
SET BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .verification-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 18px; font-weight: 700; background: rgba(40, 167, 69, 0.15); color: #28a745; margin: 15px 0; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .btn { display: inline-block; padding: 14px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .info-box { background: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Verification Submitted</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            <p>An action item verification has been submitted for your review:</p>
            
            <div style="text-align: center;">
                <div class="verification-badge">⏳ Pending Review</div>
            </div>
            
            <table class="details-table">
                <tr><td class="label">Document Number</td><td class="value">{{documentNumber}}</td></tr>
                <tr><td class="label">Store</td><td class="value">{{storeName}} ({{storeCode}})</td></tr>
                <tr><td class="label">Section</td><td class="value">{{sectionName}}</td></tr>
                <tr><td class="label">Finding</td><td class="value">{{findingDescription}}</td></tr>
                <tr><td class="label">Submitted By</td><td class="value">{{submittedBy}}</td></tr>
                <tr><td class="label">Submitted At</td><td class="value">{{submittedAt}}</td></tr>
            </table>
            
            <div class="info-box">
                <strong>📝 Verification Notes:</strong><br>
                {{verificationNotes}}
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
                <a href="{{verificationUrl}}" class="btn">🔍 Review Verification</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Please review the submitted verification and approve or reject it accordingly.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL Apps</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OE_VERIFICATION_SUBMITTED';
PRINT 'Fixed OE_VERIFICATION_SUBMITTED template';
GO

-- 6. Fix THEFT_INCIDENT_REPORT template
UPDATE EmailTemplates
SET BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .alert-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 18px; font-weight: 700; background: rgba(220, 53, 69, 0.15); color: #dc3545; margin: 15px 0; }
        .section { margin: 25px 0; }
        .section-title { font-size: 16px; font-weight: 600; color: #495057; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 40%; }
        .details-table .value { font-weight: 600; }
        .value-box { display: inline-block; padding: 20px 30px; background: linear-gradient(135deg, #dc3545 0%, #a71d2a 100%); color: white; border-radius: 12px; margin: 10px 5px; text-align: center; }
        .value-box .amount { font-size: 28px; font-weight: 700; }
        .value-box .label { font-size: 12px; opacity: 0.9; }
        .collected-box { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .thief-info { background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Theft Incident Report</h1>
            <div class="subtitle">{{storeName}}</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            <p>A theft incident has been reported at <strong>{{storeName}}</strong>. Please review the details below:</p>
            
            <div style="text-align: center; margin: 25px 0;">
                <div class="value-box">
                    <div class="label">STOLEN VALUE</div>
                    <div class="amount">{{currency}} {{stolenValue}}</div>
                </div>
                <div class="value-box collected-box">
                    <div class="label">VALUE COLLECTED</div>
                    <div class="amount">{{currency}} {{valueCollected}}</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">📍 Store Information</div>
                <table class="details-table">
                    <tr><td class="label">Store</td><td class="value">{{storeName}}</td></tr>
                    <tr><td class="label">Incident Date</td><td class="value">{{incidentDate}}</td></tr>
                    <tr><td class="label">Store Manager</td><td class="value">{{storeManager}}</td></tr>
                    <tr><td class="label">Reported By</td><td class="value">{{staffName}}</td></tr>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">📦 Stolen Items</div>
                <div class="info-box">
                    {{stolenItems}}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">👤 Thief Information</div>
                <div class="thief-info">
                    <table class="details-table">
                        <tr><td class="label">Name</td><td class="value">{{thiefName}} {{thiefSurname}}</td></tr>
                        <tr><td class="label">ID Card</td><td class="value">{{idCard}}</td></tr>
                        <tr><td class="label">Date of Birth</td><td class="value">{{dateOfBirth}}</td></tr>
                        <tr><td class="label">Place of Birth</td><td class="value">{{placeOfBirth}}</td></tr>
                        <tr><td class="label">Father''s Name</td><td class="value">{{fatherName}}</td></tr>
                        <tr><td class="label">Mother''s Name</td><td class="value">{{motherName}}</td></tr>
                        <tr><td class="label">Marital Status</td><td class="value">{{maritalStatus}}</td></tr>
                    </table>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">🎯 Capture Details</div>
                <table class="details-table">
                    <tr><td class="label">Capture Method</td><td class="value">{{captureMethod}}</td></tr>
                    <tr><td class="label">Security Type</td><td class="value">{{securityType}}</td></tr>
                    <tr><td class="label">Security Company</td><td class="value">{{outsourceCompany}}</td></tr>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">💰 Financial Details</div>
                <table class="details-table">
                    <tr><td class="label">Amount to HO</td><td class="value">{{currency}} {{amountToHO}}</td></tr>
                </table>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{reportUrl}}" class="btn">View Full Report</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated notification from the Operational Excellence Application.</p>
            <p>Report ID: #{{incidentId}} | Submitted: {{submittedAt}}</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'THEFT_INCIDENT_REPORT';
PRINT 'Fixed THEFT_INCIDENT_REPORT template';
GO

-- 7. Fix BROADCAST_MESSAGE template
UPDATE EmailTemplates
SET BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0078d4 0%, #00bcf2 100%); color: white; padding: 30px; text-align: center; }
        .header.high-priority { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); }
        .header h1 { margin: 0; font-size: 24px; }
        .header .subtitle { margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .priority-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
        .priority-normal { background: #e3f2fd; color: #1976d2; }
        .priority-high { background: #ffebee; color: #c62828; }
        .message-box { background: #f8f9fa; border-left: 4px solid #0078d4; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; white-space: pre-wrap; }
        .message-box.high-priority { border-left-color: #dc3545; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .details-table td { padding: 12px; border-bottom: 1px solid #eee; }
        .details-table .label { color: #666; width: 30%; }
        .details-table .value { font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .btn { display: inline-block; padding: 14px 30px; background: #0078d4; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header {{priorityClass}}">
            <h1>📢 {{title}}</h1>
            <div class="subtitle">Announcement from {{senderName}}</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <span class="priority-badge {{priorityBadgeClass}}">{{priorityLabel}}</span>
            </div>
            
            <div class="message-box {{priorityBoxClass}}">{{message}}</div>
            
            <table class="details-table">
                <tr><td class="label">From</td><td class="value">{{senderName}}</td></tr>
                <tr><td class="label">Date</td><td class="value">{{sentDate}}</td></tr>
                <tr><td class="label">Priority</td><td class="value">{{priority}}</td></tr>
            </table>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated announcement from the Operational Excellence Application.</p>
            <p>© {{year}} GMRL - All Rights Reserved</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'BROADCAST_MESSAGE';
PRINT 'Fixed BROADCAST_MESSAGE template';
GO

-- 8. Fix FIVEDAYS_INITIATE template
UPDATE EmailTemplates
SET SubjectTemplate = N'📅 5 Days Cycle Started - Begin Recording Expired Items',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .message-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
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
            <h1>📅 5 Days Cycle Started</h1>
            <div style="margin-top: 8px; opacity: 0.9;">Time to Record Expired Items</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <p>The 5 Days Expired Items cycle has <strong>officially started</strong> for {{storeName}}!</p>
            
            <div class="message-box">
                <strong>📋 Your Task:</strong><br>
                Record ALL expired items found in your store during this 5-day period.
            </div>
            
            <div class="checklist">
                <strong>Daily Checklist:</strong>
                <div class="checklist-item">✅ Check all shelves for expired products</div>
                <div class="checklist-item">✅ Check refrigerated items</div>
                <div class="checklist-item">✅ Check backstock area</div>
                <div class="checklist-item">✅ Record findings in the system</div>
            </div>
            
            <p><strong>Cycle End Date:</strong> {{cycleEndDate}}</p>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Open 5 Days Form</a>
            </div>
        </div>
        <div class="footer">
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'FIVEDAYS_INITIATE';
PRINT 'Fixed FIVEDAYS_INITIATE template';
GO

-- 9. Fix FIVEDAYS_DAILY template
UPDATE EmailTemplates
SET SubjectTemplate = N'📋 Day {{dayNumber}} Reminder - 5 Days Expired Items',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .day-badge { display: inline-block; padding: 12px 25px; border-radius: 25px; font-size: 18px; font-weight: 600; background: rgba(102, 126, 234, 0.15); color: #667eea; margin: 15px 0; }
        .message-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .btn { display: inline-block; padding: 14px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .progress { background: #e9ecef; border-radius: 10px; height: 20px; margin: 20px 0; }
        .progress-bar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; border-radius: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Day {{dayNumber}} of 5</h1>
            <div style="margin-top: 8px; opacity: 0.9;">5 Days Expired Items Check</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div style="text-align: center;">
                <div class="day-badge">Day {{dayNumber}} / 5</div>
            </div>
            
            <div class="progress">
                <div class="progress-bar" style="width: {{progressPercent}}%;"></div>
            </div>
            
            <div class="message-box">
                {{message}}
            </div>
            
            <p><strong>Your entries so far:</strong> {{entryCount}} items recorded</p>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Continue Recording</a>
            </div>
        </div>
        <div class="footer">
            <p>Store: {{storeName}} | Sent: {{sentDate}}</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'FIVEDAYS_DAILY';
PRINT 'Fixed FIVEDAYS_DAILY template';
GO

-- 10. Fix FIVEDAYS_OVERDUE template
UPDATE EmailTemplates
SET SubjectTemplate = N'🚨 WARNING: Missing 5 Days Data - Audit Impact',
    BodyTemplate = N'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .warning-box { background: #ffebee; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .btn { display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        .impact-list { background: #fff3cd; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107; }
        .impact-item { padding: 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 OVERDUE WARNING</h1>
            <div style="margin-top: 8px; opacity: 0.9;">5 Days Entries Missing</div>
        </div>
        <div class="content">
            <p>Dear {{recipientName}},</p>
            
            <div class="warning-box">
                <strong>⚠️ Your 5 Days cycle submissions are OVERDUE!</strong><br><br>
                The cycle ended on {{cycleEndDate}} and we have not received complete submissions from {{storeName}}.
            </div>
            
            <div class="impact-list">
                <strong>⚡ This WILL affect your store:</strong>
                <div class="impact-item">❌ Negative mark on upcoming store audit</div>
                <div class="impact-item">❌ Compliance score reduction</div>
                <div class="impact-item">❌ Area Manager notification</div>
            </div>
            
            <p><strong>Days overdue:</strong> {{daysOverdue}}</p>
            <p><strong>Entries recorded:</strong> {{entryCount}} ({{status}})</p>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{dashboardUrl}}" class="btn">Complete Now</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated compliance warning.</p>
            <p>© {{year}} GMRL - Operational Excellence</p>
        </div>
    </div>
</body>
</html>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'FIVEDAYS_OVERDUE';
PRINT 'Fixed FIVEDAYS_OVERDUE template';
GO

-- 11. Fix OE_INSPECTION_ESCALATION template (in case fix-escalation-templates.sql wasn't run)
UPDATE EmailTemplates
SET SubjectTemplate = N'🚨 [OE] ESCALATION: Action Plan Requires Attention - {{storeName}} - {{documentNumber}}',
    BodyTemplate = N'<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center;">
        <h2 style="margin: 0;">🚨 OE Action Plan Escalation</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">{{storeName}}</p>
    </div>
    <div style="padding: 30px;">
        <p>Dear {{recipientName}},</p>
        <p>An OE Inspection action plan has been <strong>escalated</strong> and requires immediate attention:</p>
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <strong>⚠️ Escalation Level: {{escalationLevel}}</strong><br>
            This action plan has exceeded the allowed timeframe.
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666; width: 40%;">Document</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{documentNumber}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Store</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{storeName}} ({{storeCode}})</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Inspection Date</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{auditDate}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Days Overdue</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #dc3545;">{{daysOverdue}} days</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Open Findings</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{openFindings}} remaining</td></tr>
        </table>
        <div style="text-align: center; margin: 25px 0;">
            <a href="{{reportUrl}}" style="display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Action Plan</a>
        </div>
        <p style="color: #666; font-size: 14px;">Please take immediate action to resolve the outstanding findings.</p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px;">
        <p>This is an automated escalation from the Operational Excellence Application.</p>
        <p>© {{year}} GMRL Group</p>
    </div>
</div>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OE_INSPECTION_ESCALATION';
PRINT 'Fixed OE_INSPECTION_ESCALATION template';
GO

-- 12. Fix OHS_INSPECTION_ESCALATION template (in case fix-escalation-templates.sql wasn't run)
UPDATE EmailTemplates
SET SubjectTemplate = N'🚨 [OHS] ESCALATION: Safety Action Plan Requires Attention - {{storeName}} - {{documentNumber}}',
    BodyTemplate = N'<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #c0392b 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center;">
        <h2 style="margin: 0;">🚨 OHS Safety Escalation</h2>
        <p style="margin: 8px 0 0; opacity: 0.9;">{{storeName}}</p>
    </div>
    <div style="padding: 30px;">
        <p>Dear {{recipientName}},</p>
        <p>An OHS Safety action plan has been <strong>escalated</strong> and requires immediate attention:</p>
        <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <strong>⚠️ Escalation Level: {{escalationLevel}}</strong><br>
            This safety action plan has exceeded the allowed timeframe.
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666; width: 40%;">Document</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{documentNumber}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Store</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{storeName}} ({{storeCode}})</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Inspection Date</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{inspectionDate}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Days Overdue</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #dc3545;">{{daysOverdue}} days</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">Open Findings</td><td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 600;">{{openFindings}} remaining</td></tr>
        </table>
        <div style="text-align: center; margin: 25px 0;">
            <a href="{{reportUrl}}" style="display: inline-block; padding: 14px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Safety Plan</a>
        </div>
        <p style="color: #666; font-size: 14px;">Please take immediate action to resolve the outstanding safety findings.</p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px;">
        <p>This is an automated escalation from the OHS Inspection System.</p>
        <p>© {{year}} GMRL Group</p>
    </div>
</div>',
    UpdatedAt = GETDATE()
WHERE TemplateKey = 'OHS_INSPECTION_ESCALATION';
PRINT 'Fixed OHS_INSPECTION_ESCALATION template';
GO

PRINT '=== All email template icons fixed! ===';
