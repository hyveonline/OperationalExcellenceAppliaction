// Run workflow engine schema on specified database
// Usage: set SQL_DATABASE env variable then run
const sql = require('mssql');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config', 'default'));

async function run() {
    const dbName = config.database.database;
    console.log(`\n=== Running Workflow Engine Schema on: ${dbName} ===\n`);

    try {
        const pool = await sql.connect(config.database);

        // Table 1: WorkflowDefinitions
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowDefinitions')
            BEGIN
                CREATE TABLE WorkflowDefinitions (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    FormCode        NVARCHAR(100) NOT NULL,
                    FormName        NVARCHAR(255) NOT NULL,
                    ModulePath      NVARCHAR(500) NULL,
                    WorkflowType    NVARCHAR(50) NOT NULL,
                    IsActive        BIT NOT NULL DEFAULT 1,
                    CreatedBy       INT NULL,
                    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    UpdatedBy       INT NULL,
                    UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT UQ_WorkflowDefinitions_FormCode UNIQUE (FormCode)
                );
                PRINT 'Created table: WorkflowDefinitions';
            END
            ELSE PRINT 'Table WorkflowDefinitions already exists';
        `);
        console.log('✓ WorkflowDefinitions');

        // Table 2: WorkflowSteps
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowSteps')
            BEGIN
                CREATE TABLE WorkflowSteps (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    WorkflowId      INT NOT NULL,
                    StepOrder       INT NOT NULL,
                    StepName        NVARCHAR(200) NOT NULL,
                    StepType        NVARCHAR(50) NOT NULL,
                    ApprovalMethod  NVARCHAR(50) NULL,
                    AllowedActions  NVARCHAR(500) NULL,
                    EmailTemplateKey NVARCHAR(100) NULL,
                    TargetStatus    NVARCHAR(100) NULL,
                    IsActive        BIT NOT NULL DEFAULT 1,
                    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_WorkflowSteps_WorkflowId FOREIGN KEY (WorkflowId)
                        REFERENCES WorkflowDefinitions(Id) ON DELETE CASCADE
                );
                CREATE INDEX IX_WorkflowSteps_WorkflowId ON WorkflowSteps(WorkflowId);
                PRINT 'Created table: WorkflowSteps';
            END
            ELSE PRINT 'Table WorkflowSteps already exists';
        `);
        console.log('✓ WorkflowSteps');

        // Table 3: WorkflowStepRecipients
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowStepRecipients')
            BEGIN
                CREATE TABLE WorkflowStepRecipients (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    StepId          INT NOT NULL,
                    RecipientType   NVARCHAR(50) NOT NULL,
                    UserId          INT NULL,
                    UserEmail       NVARCHAR(200) NULL,
                    RoleId          INT NULL,
                    RoleName        NVARCHAR(100) NULL,
                    AssignmentRole  NVARCHAR(100) NULL,
                    FieldName       NVARCHAR(200) NULL,
                    EmailTarget     NVARCHAR(10) NOT NULL DEFAULT 'TO',
                    IsActive        BIT NOT NULL DEFAULT 1,
                    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_WorkflowStepRecipients_StepId FOREIGN KEY (StepId)
                        REFERENCES WorkflowSteps(Id) ON DELETE CASCADE
                );
                CREATE INDEX IX_WorkflowStepRecipients_StepId ON WorkflowStepRecipients(StepId);
                PRINT 'Created table: WorkflowStepRecipients';
            END
            ELSE PRINT 'Table WorkflowStepRecipients already exists';
        `);
        console.log('✓ WorkflowStepRecipients');

        // Table 4: WorkflowStatusMappings
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowStatusMappings')
            BEGIN
                CREATE TABLE WorkflowStatusMappings (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    WorkflowId      INT NOT NULL,
                    StatusLabel     NVARCHAR(100) NOT NULL,
                    StatusOrder     INT NOT NULL,
                    IsFinal         BIT NOT NULL DEFAULT 0,
                    IsDefault       BIT NOT NULL DEFAULT 0,
                    StatusColor     NVARCHAR(20) NULL,
                    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_WorkflowStatusMappings_WorkflowId FOREIGN KEY (WorkflowId)
                        REFERENCES WorkflowDefinitions(Id) ON DELETE CASCADE
                );
                CREATE INDEX IX_WorkflowStatusMappings_WorkflowId ON WorkflowStatusMappings(WorkflowId);
                PRINT 'Created table: WorkflowStatusMappings';
            END
            ELSE PRINT 'Table WorkflowStatusMappings already exists';
        `);
        console.log('✓ WorkflowStatusMappings');

        // Table 5: WorkflowInstances
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowInstances')
            BEGIN
                CREATE TABLE WorkflowInstances (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    WorkflowId      INT NOT NULL,
                    FormCode        NVARCHAR(100) NOT NULL,
                    RecordId        INT NOT NULL,
                    RecordTable     NVARCHAR(200) NOT NULL,
                    CurrentStepId   INT NULL,
                    CurrentStatus   NVARCHAR(100) NOT NULL DEFAULT 'Initiated',
                    SubmittedBy     INT NOT NULL,
                    SubmittedByEmail NVARCHAR(200) NOT NULL,
                    SubmittedByName NVARCHAR(200) NULL,
                    StoreId         INT NULL,
                    StoreName       NVARCHAR(200) NULL,
                    MetaData        NVARCHAR(MAX) NULL,
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
            ELSE PRINT 'Table WorkflowInstances already exists';
        `);
        console.log('✓ WorkflowInstances');

        // Table 6: WorkflowInstanceSteps
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowInstanceSteps')
            BEGIN
                CREATE TABLE WorkflowInstanceSteps (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    InstanceId      INT NOT NULL,
                    StepId          INT NOT NULL,
                    StepOrder       INT NOT NULL,
                    StepName        NVARCHAR(200) NOT NULL,
                    StepType        NVARCHAR(50) NOT NULL,
                    Status          NVARCHAR(50) NOT NULL DEFAULT 'Pending',
                    AssignedTo      NVARCHAR(200) NULL,
                    AssignedToName  NVARCHAR(200) NULL,
                    Action          NVARCHAR(50) NULL,
                    ActionBy        NVARCHAR(200) NULL,
                    ActionByName    NVARCHAR(200) NULL,
                    Comments        NVARCHAR(MAX) NULL,
                    DelegatedTo     NVARCHAR(200) NULL,
                    EmailSentTo     NVARCHAR(MAX) NULL,
                    EmailSentAt     DATETIME2 NULL,
                    EmailError      NVARCHAR(MAX) NULL,
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
            ELSE PRINT 'Table WorkflowInstanceSteps already exists';
        `);
        console.log('✓ WorkflowInstanceSteps');

        // Table 7: WorkflowAuditLog
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowAuditLog')
            BEGIN
                CREATE TABLE WorkflowAuditLog (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    InstanceId      INT NOT NULL,
                    StepId          INT NULL,
                    Action          NVARCHAR(100) NOT NULL,
                    ActionBy        NVARCHAR(200) NULL,
                    ActionByName    NVARCHAR(200) NULL,
                    Details         NVARCHAR(MAX) NULL,
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
            ELSE PRINT 'Table WorkflowAuditLog already exists';
        `);
        console.log('✓ WorkflowAuditLog');

        // Table 8: WorkflowConditions
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowConditions')
            BEGIN
                CREATE TABLE WorkflowConditions (
                    Id              INT IDENTITY(1,1) PRIMARY KEY,
                    StepId          INT NOT NULL,
                    FieldName       NVARCHAR(200) NOT NULL,
                    Operator        NVARCHAR(50) NOT NULL,
                    Value           NVARCHAR(500) NOT NULL,
                    ActionOnMatch   NVARCHAR(50) NOT NULL,
                    Priority        INT NOT NULL DEFAULT 0,
                    IsActive        BIT NOT NULL DEFAULT 1,
                    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT FK_WorkflowConditions_StepId FOREIGN KEY (StepId)
                        REFERENCES WorkflowSteps(Id) ON DELETE CASCADE
                );
                CREATE INDEX IX_WorkflowConditions_StepId ON WorkflowConditions(StepId);
                PRINT 'Created table: WorkflowConditions';
            END
            ELSE PRINT 'Table WorkflowConditions already exists';
        `);
        console.log('✓ WorkflowConditions');

        // Seed: WorkflowDefinitions for all 15 modules
        const result = await pool.request().query(`SELECT COUNT(*) as cnt FROM WorkflowDefinitions`);
        if (result.recordset[0].cnt === 0) {
            await pool.request().query(`
                INSERT INTO WorkflowDefinitions (FormCode, FormName, ModulePath, WorkflowType, IsActive)
                VALUES
                    (N'THEFT_INCIDENT',          N'Theft Incident Report',           N'/stores/theft-incident',              N'NONE', 0),
                    (N'EXTRA_CLEANING',          N'Extra Third-Party Support',       N'/stores/extra-cleaning',              N'NONE', 0),
                    (N'PRODUCTION_EXTRAS',       N'Production Extras Request',       N'/stores/production-extras',           N'NONE', 0),
                    (N'OHS_INCIDENT',            N'OHS A&I Reporting',               N'/stores/ohs-incident',                N'NONE', 0),
                    (N'COMPLAINT',               N'Complaint',                       N'/stores/complaint',                   N'NONE', 0),
                    (N'EVACUATION_DRILL',        N'Post Evacuation Drill',           N'/stores/evacuation-drill',            N'NONE', 0),
                    (N'WEEKLY_FEEDBACK',         N'Weekly Third-Party Feedback',     N'/stores/weekly-feedback',             N'NONE', 0),
                    (N'FIRE_EQUIPMENT',          N'Fire Equipment Inspection',       N'/ohs/fire-equipment',                 N'NONE', 0),
                    (N'ORA_ASSESSMENT',          N'Overall Risk Assessment',         N'/ohs/ora',                            N'NONE', 0),
                    (N'CAMERA_REQUEST',          N'Camera Request',                  N'/security-emp/camera-request',        N'NONE', 0),
                    (N'POST_VISIT_REPORT',       N'Post Visit Report',               N'/security-emp/post-visit-report',     N'NONE', 0),
                    (N'LEGAL_CASES',             N'Legal Cases',                     N'/security-emp/legal-cases',           N'NONE', 0),
                    (N'INTERNAL_INVESTIGATIONS', N'Internal Investigations',         N'/security-emp/internal-investigations',N'NONE', 0),
                    (N'LOST_AND_FOUND',          N'Lost and Found',                  N'/stores/lost-and-found',              N'NONE', 0),
                    (N'DAILY_REPORTING',         N'Security Daily Reporting',        N'/security-emp/daily-reporting',       N'NONE', 0)
            `);
            console.log('✓ Seeded 15 WorkflowDefinitions (all inactive)');
        } else {
            console.log('✓ WorkflowDefinitions already seeded (' + result.recordset[0].cnt + ' rows)');
        }

        console.log(`\n=== Schema complete on ${dbName} ===`);
        console.log('Tables created: 8');
        console.log('Modules seeded: 15');

        await pool.close();
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}

run();
