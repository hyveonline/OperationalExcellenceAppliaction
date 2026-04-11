-- =============================================
-- Workflow Engine Schema
-- Phase 1: Configuration + Runtime Tables
-- =============================================

-- =============================================
-- TABLE 1: WorkflowDefinitions
-- One row per module/form that has a workflow
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowDefinitions')
BEGIN
    CREATE TABLE WorkflowDefinitions (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        FormCode        NVARCHAR(100) NOT NULL,         -- e.g. 'THEFT_INCIDENT', 'OHS_INCIDENT', 'EXTRA_CLEANING'
        FormName        NVARCHAR(255) NOT NULL,         -- Display name: 'Theft Incident Report'
        ModulePath      NVARCHAR(500) NULL,             -- Route path: '/stores/theft-incident'
        WorkflowType    NVARCHAR(50) NOT NULL,          -- 'EMAIL_ONLY', 'APPROVAL', 'EMAIL_AND_APPROVAL', 'NONE'
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedBy       INT NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedBy       INT NULL,
        UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_WorkflowDefinitions_FormCode UNIQUE (FormCode)
    );
    PRINT 'Created table: WorkflowDefinitions';
END
GO

-- =============================================
-- TABLE 2: WorkflowSteps
-- Ordered steps for each workflow definition
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowSteps')
BEGIN
    CREATE TABLE WorkflowSteps (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        WorkflowId      INT NOT NULL,                    -- FK → WorkflowDefinitions
        StepOrder       INT NOT NULL,                    -- 1, 2, 3...
        StepName        NVARCHAR(200) NOT NULL,          -- 'Submit', 'Area Manager Approval', 'Send Email'
        StepType        NVARCHAR(50) NOT NULL,           -- 'SUBMIT', 'APPROVAL', 'EMAIL', 'STATUS_CHANGE', 'NOTIFICATION'
        -- For APPROVAL steps
        ApprovalMethod  NVARCHAR(50) NULL,               -- 'PUBLIC_LINK', 'IN_APP', 'BOTH'
        AllowedActions  NVARCHAR(500) NULL,              -- JSON: ["Approve","Reject","RequestInfo","Delegate"]
        -- For EMAIL steps
        EmailTemplateKey NVARCHAR(100) NULL,             -- FK → EmailTemplates.TemplateKey
        -- For STATUS_CHANGE steps
        TargetStatus    NVARCHAR(100) NULL,              -- The status to set: 'Under Review', 'Approved', 'Closed'
        -- General
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowSteps_WorkflowId FOREIGN KEY (WorkflowId)
            REFERENCES WorkflowDefinitions(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_WorkflowSteps_WorkflowId ON WorkflowSteps(WorkflowId);
    PRINT 'Created table: WorkflowSteps';
END
GO

-- =============================================
-- TABLE 3: WorkflowStepRecipients
-- Who receives email or is assigned for approval at each step
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowStepRecipients')
BEGIN
    CREATE TABLE WorkflowStepRecipients (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        StepId          INT NOT NULL,                    -- FK → WorkflowSteps
        RecipientType   NVARCHAR(50) NOT NULL,           -- 'USER', 'ROLE', 'STORE_ASSIGNMENT', 'SUBMITTER', 'SUBMITTER_MANAGER', 'FORM_FIELD'
        -- For USER type: specific user
        UserId          INT NULL,
        UserEmail       NVARCHAR(200) NULL,
        -- For ROLE type: all users with this role
        RoleId          INT NULL,
        RoleName        NVARCHAR(100) NULL,
        -- For STORE_ASSIGNMENT type: whoever is assigned to submitter's store
        AssignmentRole  NVARCHAR(100) NULL,              -- 'AreaManager', 'HeadOfOps', 'StoreManager'
        -- For FORM_FIELD type: email comes from the submitted form data
        FieldName       NVARCHAR(200) NULL,              -- The form field that contains the email
        -- Email routing
        EmailTarget     NVARCHAR(10) NOT NULL DEFAULT 'TO', -- 'TO' or 'CC'
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowStepRecipients_StepId FOREIGN KEY (StepId)
            REFERENCES WorkflowSteps(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_WorkflowStepRecipients_StepId ON WorkflowStepRecipients(StepId);
    PRINT 'Created table: WorkflowStepRecipients';
END
GO

-- =============================================
-- TABLE 4: WorkflowStatusMappings
-- Maps workflow status labels to each module's existing status column
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowStatusMappings')
BEGIN
    CREATE TABLE WorkflowStatusMappings (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        WorkflowId      INT NOT NULL,                    -- FK → WorkflowDefinitions
        StatusLabel     NVARCHAR(100) NOT NULL,          -- Display label: 'Pending', 'Under Review', 'Approved'
        StatusOrder     INT NOT NULL,                    -- Display order
        IsFinal         BIT NOT NULL DEFAULT 0,          -- Is this a terminal status?
        IsDefault       BIT NOT NULL DEFAULT 0,          -- Initial status on submit?
        StatusColor     NVARCHAR(20) NULL,               -- CSS color: '#ff9800', '#4caf50'
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowStatusMappings_WorkflowId FOREIGN KEY (WorkflowId)
            REFERENCES WorkflowDefinitions(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_WorkflowStatusMappings_WorkflowId ON WorkflowStatusMappings(WorkflowId);
    PRINT 'Created table: WorkflowStatusMappings';
END
GO

-- =============================================
-- TABLE 5: WorkflowInstances
-- One row per submission that triggers a workflow
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowInstances')
BEGIN
    CREATE TABLE WorkflowInstances (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        WorkflowId      INT NOT NULL,                    -- FK → WorkflowDefinitions
        FormCode        NVARCHAR(100) NOT NULL,          -- Denormalized for fast queries
        RecordId        INT NOT NULL,                    -- The ID of the submitted record in its module table
        RecordTable     NVARCHAR(200) NOT NULL,          -- Source table: 'TheftIncidents', 'OHSIncidents'
        CurrentStepId   INT NULL,                        -- FK → WorkflowSteps (current active step)
        CurrentStatus   NVARCHAR(100) NOT NULL DEFAULT 'Initiated',
        SubmittedBy     INT NOT NULL,                    -- FK → Users
        SubmittedByEmail NVARCHAR(200) NOT NULL,
        SubmittedByName NVARCHAR(200) NULL,
        StoreId         INT NULL,                        -- Store context (for store-assignment lookups)
        StoreName       NVARCHAR(200) NULL,
        MetaData        NVARCHAR(MAX) NULL,              -- JSON: extra form data for email placeholders
        CompletedAt     DATETIME2 NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowInstances_WorkflowId FOREIGN KEY (WorkflowId)
            REFERENCES WorkflowDefinitions(Id),
        CONSTRAINT FK_WorkflowInstances_CurrentStepId FOREIGN KEY (CurrentStepId)
            REFERENCES WorkflowSteps(Id)
    );
    CREATE INDEX IX_WorkflowInstances_WorkflowId ON WorkflowInstances(WorkflowId);
    CREATE INDEX IX_WorkflowInstances_FormCode ON WorkflowInstances(FormCode);
    CREATE INDEX IX_WorkflowInstances_RecordId ON WorkflowInstances(RecordId);
    CREATE INDEX IX_WorkflowInstances_SubmittedBy ON WorkflowInstances(SubmittedBy);
    CREATE INDEX IX_WorkflowInstances_CurrentStatus ON WorkflowInstances(CurrentStatus);
    PRINT 'Created table: WorkflowInstances';
END
GO

-- =============================================
-- TABLE 6: WorkflowInstanceSteps
-- Tracks each step's execution for a specific instance
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowInstanceSteps')
BEGIN
    CREATE TABLE WorkflowInstanceSteps (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        InstanceId      INT NOT NULL,                    -- FK → WorkflowInstances
        StepId          INT NOT NULL,                    -- FK → WorkflowSteps
        StepOrder       INT NOT NULL,
        StepName        NVARCHAR(200) NOT NULL,
        StepType        NVARCHAR(50) NOT NULL,
        Status          NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'InProgress', 'Completed', 'Skipped', 'Rejected'
        -- For APPROVAL steps
        AssignedTo      NVARCHAR(200) NULL,              -- Email of assigned approver
        AssignedToName  NVARCHAR(200) NULL,
        Action          NVARCHAR(50) NULL,               -- 'Approved', 'Rejected', 'RequestedInfo', 'Delegated'
        ActionBy        NVARCHAR(200) NULL,              -- Email of person who took action
        ActionByName    NVARCHAR(200) NULL,
        Comments        NVARCHAR(MAX) NULL,
        DelegatedTo     NVARCHAR(200) NULL,              -- If delegated, the new assignee
        -- For EMAIL steps
        EmailSentTo     NVARCHAR(MAX) NULL,              -- JSON array of recipients
        EmailSentAt     DATETIME2 NULL,
        EmailError      NVARCHAR(MAX) NULL,              -- If email failed
        -- Timestamps
        StartedAt       DATETIME2 NULL,
        CompletedAt     DATETIME2 NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowInstanceSteps_InstanceId FOREIGN KEY (InstanceId)
            REFERENCES WorkflowInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_WorkflowInstanceSteps_StepId FOREIGN KEY (StepId)
            REFERENCES WorkflowSteps(Id)
    );
    CREATE INDEX IX_WorkflowInstanceSteps_InstanceId ON WorkflowInstanceSteps(InstanceId);
    CREATE INDEX IX_WorkflowInstanceSteps_Status ON WorkflowInstanceSteps(Status);
    CREATE INDEX IX_WorkflowInstanceSteps_AssignedTo ON WorkflowInstanceSteps(AssignedTo);
    PRINT 'Created table: WorkflowInstanceSteps';
END
GO

-- =============================================
-- TABLE 7: WorkflowAuditLog
-- Immutable log of every action in every workflow
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowAuditLog')
BEGIN
    CREATE TABLE WorkflowAuditLog (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        InstanceId      INT NOT NULL,                    -- FK → WorkflowInstances
        StepId          INT NULL,                        -- FK → WorkflowSteps (NULL for system events)
        Action          NVARCHAR(100) NOT NULL,          -- 'WORKFLOW_STARTED', 'STEP_COMPLETED', 'EMAIL_SENT', 'APPROVED', 'REJECTED', 'DELEGATED', 'STATUS_CHANGED'
        ActionBy        NVARCHAR(200) NULL,              -- Email/name of actor
        ActionByName    NVARCHAR(200) NULL,
        Details         NVARCHAR(MAX) NULL,              -- JSON: step-specific details
        PreviousStatus  NVARCHAR(100) NULL,
        NewStatus       NVARCHAR(100) NULL,
        IpAddress       NVARCHAR(50) NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowAuditLog_InstanceId FOREIGN KEY (InstanceId)
            REFERENCES WorkflowInstances(Id)
    );
    CREATE INDEX IX_WorkflowAuditLog_InstanceId ON WorkflowAuditLog(InstanceId);
    CREATE INDEX IX_WorkflowAuditLog_CreatedAt ON WorkflowAuditLog(CreatedAt);
    PRINT 'Created table: WorkflowAuditLog';
END
GO

-- =============================================
-- TABLE 8: WorkflowConditions
-- Optional rules to skip/modify steps based on form data
-- (Generalized version of ApprovalRules)
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowConditions')
BEGIN
    CREATE TABLE WorkflowConditions (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        StepId          INT NOT NULL,                    -- FK → WorkflowSteps
        FieldName       NVARCHAR(200) NOT NULL,          -- Form field to evaluate: 'Category', 'Amount', 'StoreRegion'
        Operator        NVARCHAR(50) NOT NULL,           -- 'equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in'
        Value           NVARCHAR(500) NOT NULL,          -- Comparison value
        ActionOnMatch   NVARCHAR(50) NOT NULL,           -- 'SKIP', 'EXECUTE', 'ADD_STEP'
        Priority        INT NOT NULL DEFAULT 0,
        IsActive        BIT NOT NULL DEFAULT 1,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WorkflowConditions_StepId FOREIGN KEY (StepId)
            REFERENCES WorkflowSteps(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_WorkflowConditions_StepId ON WorkflowConditions(StepId);
    PRINT 'Created table: WorkflowConditions';
END
GO

-- =============================================
-- SEED DATA: Pre-populate WorkflowDefinitions
-- for all modules (inactive by default)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM WorkflowDefinitions WHERE FormCode = 'THEFT_INCIDENT')
BEGIN
    INSERT INTO WorkflowDefinitions (FormCode, FormName, ModulePath, WorkflowType, IsActive)
    VALUES
        ('THEFT_INCIDENT',          'Theft Incident Report',           '/stores/theft-incident',              'NONE', 0),
        ('EXTRA_CLEANING',          'Extra Third-Party Support',       '/stores/extra-cleaning',              'NONE', 0),
        ('PRODUCTION_EXTRAS',       'Production Extras Request',       '/stores/production-extras',           'NONE', 0),
        ('OHS_INCIDENT',            'OHS A&I Reporting',               '/stores/ohs-incident',                'NONE', 0),
        ('COMPLAINT',               'Complaint',                       '/stores/complaint',                   'NONE', 0),
        ('EVACUATION_DRILL',        'Post Evacuation Drill',           '/stores/evacuation-drill',            'NONE', 0),
        ('WEEKLY_FEEDBACK',         'Weekly Third-Party Feedback',     '/stores/weekly-feedback',             'NONE', 0),
        ('FIRE_EQUIPMENT',          'Fire Equipment Inspection',       '/ohs/fire-equipment',                 'NONE', 0),
        ('ORA_ASSESSMENT',          'Overall Risk Assessment',         '/ohs/ora',                            'NONE', 0),
        ('CAMERA_REQUEST',          'Camera Request',                  '/security-emp/camera-request',        'NONE', 0),
        ('POST_VISIT_REPORT',       'Post Visit Report',               '/security-emp/post-visit-report',     'NONE', 0),
        ('LEGAL_CASES',             'Legal Cases',                     '/security-emp/legal-cases',           'NONE', 0),
        ('INTERNAL_INVESTIGATIONS', 'Internal Investigations',         '/security-emp/internal-investigations','NONE', 0),
        ('LOST_AND_FOUND',          'Lost and Found',                  '/stores/lost-and-found',              'NONE', 0),
        ('DAILY_REPORTING',         'Security Daily Reporting',        '/security-emp/daily-reporting',       'NONE', 0);
    PRINT 'Seeded 15 WorkflowDefinitions (all inactive by default)';
END
GO

PRINT '========================================';
PRINT 'Workflow Engine Schema - Complete';
PRINT '8 tables created, 15 modules seeded';
PRINT '========================================';
GO
