/**
 * Department Escalation Setup
 * Ensures all required tables and sample data exist
 * Created: 2026-03-15
 */

-- ==========================================
-- 1. Ensure DepartmentContacts table exists
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DepartmentContacts')
BEGIN
    CREATE TABLE DepartmentContacts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        DepartmentName NVARCHAR(100) NOT NULL,
        ContactEmail NVARCHAR(255) NOT NULL,
        ContactName NVARCHAR(255),
        ContactRole NVARCHAR(100),                      -- Head, Deputy, Coordinator, etc.
        ReceiveOverdueAlerts BIT DEFAULT 1,
        ReceiveEscalationAlerts BIT DEFAULT 1,
        IsActive BIT DEFAULT 1,
        SortOrder INT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT UQ_DepartmentContacts UNIQUE (DepartmentName, ContactEmail)
    );
    PRINT 'DepartmentContacts table created';
    
    CREATE INDEX IX_DepartmentContacts_Dept ON DepartmentContacts(DepartmentName);
END
GO

-- ==========================================
-- 2. Ensure DepartmentEscalations table exists
-- This tracks items escalated to departments
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DepartmentEscalations')
BEGIN
    CREATE TABLE DepartmentEscalations (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Module NVARCHAR(20) NOT NULL,                   -- 'OE' or 'OHS'
        InspectionId INT NOT NULL,
        ResponseId INT NOT NULL,                        -- ID from OE_InspectionResponses or OHS_InspectionResponses
        ItemId INT,                                     -- Template item ID
        StoreId INT,
        StoreName NVARCHAR(200),
        DocumentNumber NVARCHAR(100),
        
        -- Item details
        ReferenceValue NVARCHAR(50),
        QuestionTitle NVARCHAR(MAX),
        Finding NVARCHAR(MAX),
        CorrectiveAction NVARCHAR(MAX),
        Priority NVARCHAR(20),
        
        -- Department assignment
        Department NVARCHAR(100) NOT NULL,
        Deadline DATE,
        
        -- Escalation details
        EscalatedBy INT,                                -- User ID who escalated
        EscalatedByName NVARCHAR(255),
        EscalatedByEmail NVARCHAR(255),
        EscalatedAt DATETIME2 DEFAULT GETDATE(),
        
        -- Status tracking
        Status NVARCHAR(50) DEFAULT 'Pending',          -- Pending, Acknowledged, InProgress, Resolved, Closed
        AcknowledgedAt DATETIME2,
        AcknowledgedBy NVARCHAR(255),
        ResolvedAt DATETIME2,
        ResolvedBy NVARCHAR(255),
        ResolutionNotes NVARCHAR(MAX),
        
        -- Notification tracking
        NotificationSentAt DATETIME2,
        LastReminderSentAt DATETIME2,
        ReminderCount INT DEFAULT 0,
        
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        -- Prevent duplicate escalations for same response
        CONSTRAINT UQ_DepartmentEscalations_Response UNIQUE (Module, ResponseId)
    );
    PRINT 'DepartmentEscalations table created';
    
    CREATE INDEX IX_DeptEscalations_Module ON DepartmentEscalations(Module);
    CREATE INDEX IX_DeptEscalations_Department ON DepartmentEscalations(Department);
    CREATE INDEX IX_DeptEscalations_Status ON DepartmentEscalations(Status);
    CREATE INDEX IX_DeptEscalations_Deadline ON DepartmentEscalations(Deadline);
END
GO

-- ==========================================
-- 3. Add Deadline column to response tables if missing
-- ==========================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionResponses') AND name = 'Deadline')
BEGIN
    ALTER TABLE OE_InspectionResponses ADD Deadline DATE NULL;
    PRINT 'Added Deadline column to OE_InspectionResponses';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OHS_InspectionResponses') AND name = 'Deadline')
BEGIN
    ALTER TABLE OHS_InspectionResponses ADD Deadline DATE NULL;
    PRINT 'Added Deadline column to OHS_InspectionResponses';
END
GO

-- ==========================================
-- 4. Insert sample department contacts
-- (Update these with real contacts)
-- ==========================================
IF NOT EXISTS (SELECT 1 FROM DepartmentContacts WHERE DepartmentName = 'Maintenance')
BEGIN
    INSERT INTO DepartmentContacts (DepartmentName, ContactEmail, ContactName, ContactRole, SortOrder)
    VALUES 
        ('Maintenance', 'maintenance@spinneys-lebanon.com', 'Maintenance Team', 'Head', 1),
        ('HR', 'hr@spinneys-lebanon.com', 'HR Team', 'Head', 2),
        ('Safety', 'safety@spinneys-lebanon.com', 'Safety Team', 'Head', 3),
        ('Operations', 'operations@spinneys-lebanon.com', 'Operations Team', 'Head', 4),
        ('Management', 'management@spinneys-lebanon.com', 'Management Team', 'Head', 5);
    PRINT 'Added sample department contacts';
END
GO

-- ==========================================
-- 5. Email template for department escalation
-- ==========================================
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'DEPARTMENT_ESCALATION')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, SubjectTemplate, BodyTemplate, IsActive)
    VALUES (
        'DEPARTMENT_ESCALATION',
        'Department Escalation Notification',
        '🔔 [{{module}}] Action Required: {{department}} - {{storeName}}',
        N'<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 650px; margin: 0 auto;">
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
            <h4 style="margin: 0 0 10px 0; color: #dc2626;">⚠️ Finding</h4>
            <p style="margin: 0; color: #374151;">{{finding}}</p>
        </div>
        
        <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <h4 style="margin: 0 0 10px 0; color: #16a34a;">✅ Required Action</h4>
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
</div>',
        1
    );
    PRINT 'Added DEPARTMENT_ESCALATION email template';
END
GO

-- ==========================================
-- 6. Email template for department reminder
-- ==========================================
IF NOT EXISTS (SELECT 1 FROM EmailTemplates WHERE TemplateKey = 'DEPARTMENT_REMINDER')
BEGIN
    INSERT INTO EmailTemplates (TemplateKey, TemplateName, SubjectTemplate, BodyTemplate, IsActive)
    VALUES (
        'DEPARTMENT_REMINDER',
        'Department Escalation Reminder',
        '⏰ Reminder: [{{module}}] Pending Action - {{department}} - {{storeName}}',
        N'<div style="font-family: Segoe UI, Arial, sans-serif; max-width: 650px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 25px; color: white; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 1.5rem;">⏰ Reminder: Pending Department Action</h2>
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
</div>',
        1
    );
    PRINT 'Added DEPARTMENT_REMINDER email template';
END
GO

PRINT 'Department Escalation setup completed!';
