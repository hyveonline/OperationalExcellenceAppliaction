-- ====================================================
-- Security Inspection Module - Database Tables
-- Prefix: SEC_ (adapted from OE_ tables)
-- Database: OEApp_UAT and OEApp_Live
-- ====================================================

-- 1. Settings
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionSettings')
CREATE TABLE SEC_InspectionSettings (
    Id INT PRIMARY KEY IDENTITY(1,1),
    SettingKey NVARCHAR(100) NOT NULL UNIQUE,
    SettingValue NVARCHAR(500),
    Description NVARCHAR(500),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2
);

-- 2. Inspections
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_Inspections')
CREATE TABLE SEC_Inspections (
    Id INT PRIMARY KEY IDENTITY(1,1),
    DocumentNumber NVARCHAR(50) NOT NULL UNIQUE,
    StoreId INT,
    StoreName NVARCHAR(200),
    InspectionDate DATE NOT NULL,
    TimeIn TIME,
    TimeOut TIME,
    Inspectors NVARCHAR(500),
    AccompaniedBy NVARCHAR(500),
    Cycle NVARCHAR(10),
    Year INT,
    Status NVARCHAR(50) DEFAULT 'Draft',
    Score DECIMAL(5,2),
    TotalPoints DECIMAL(10,2),
    MaxPoints DECIMAL(10,2),
    Comments NVARCHAR(MAX),
    CreatedBy INT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    CompletedAt DATETIME2,
    ApprovedBy INT,
    ApprovedAt DATETIME2,
    ActionPlanDeadline DATETIME NULL,
    ActionPlanCompletedAt DATETIME NULL,
    TemplateId INT NULL,
    FOREIGN KEY (StoreId) REFERENCES Stores(Id),
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id),
    FOREIGN KEY (ApprovedBy) REFERENCES Users(Id)
);

-- 3. Inspection Sections
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionSections')
CREATE TABLE SEC_InspectionSections (
    Id INT PRIMARY KEY IDENTITY(1,1),
    InspectionId INT NOT NULL,
    SectionName NVARCHAR(200) NOT NULL,
    SectionOrder INT DEFAULT 0,
    SectionIcon NVARCHAR(10),
    TotalPoints DECIMAL(10,2),
    MaxPoints DECIMAL(10,2),
    Score DECIMAL(5,2),
    Status NVARCHAR(50),
    PassingGrade INT DEFAULT 80,
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id) ON DELETE CASCADE
);

-- 4. Inspection Items
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionItems')
CREATE TABLE SEC_InspectionItems (
    Id INT PRIMARY KEY IDENTITY(1,1),
    InspectionId INT NOT NULL,
    SectionName NVARCHAR(200),
    SectionOrder INT DEFAULT 0,
    ItemOrder INT DEFAULT 0,
    ReferenceValue NVARCHAR(50),
    Question NVARCHAR(MAX),
    Coefficient DECIMAL(5,2) DEFAULT 1,
    Answer NVARCHAR(50),
    Score DECIMAL(5,2),
    Finding NVARCHAR(MAX),
    Comment NVARCHAR(MAX),
    CorrectedAction NVARCHAR(MAX),
    Priority NVARCHAR(20),
    HasPicture BIT DEFAULT 0,
    PictureUrl NVARCHAR(500),
    Escalate BIT DEFAULT 0,
    Department NVARCHAR(100),
    AnswerOptions NVARCHAR(200) DEFAULT 'Yes,Partially,No,NA',
    Criteria NVARCHAR(MAX),
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id) ON DELETE CASCADE
);

-- 5. Templates
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionTemplates')
CREATE TABLE SEC_InspectionTemplates (
    Id INT PRIMARY KEY IDENTITY(1,1),
    TemplateName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    IsActive BIT DEFAULT 1,
    IsDefault BIT DEFAULT 0,
    CreatedBy INT,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

-- 6. Template Sections
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionTemplateSections')
CREATE TABLE SEC_InspectionTemplateSections (
    Id INT PRIMARY KEY IDENTITY(1,1),
    TemplateId INT NOT NULL,
    SectionName NVARCHAR(200) NOT NULL,
    SectionIcon NVARCHAR(10),
    SectionOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    PassingGrade INT DEFAULT 80,
    FOREIGN KEY (TemplateId) REFERENCES SEC_InspectionTemplates(Id) ON DELETE CASCADE
);

-- 7. Template Items
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionTemplateItems')
CREATE TABLE SEC_InspectionTemplateItems (
    Id INT PRIMARY KEY IDENTITY(1,1),
    SectionId INT NOT NULL,
    ReferenceValue NVARCHAR(50),
    Question NVARCHAR(MAX) NOT NULL,
    Coefficient DECIMAL(5,2) DEFAULT 1,
    AnswerOptions NVARCHAR(200) DEFAULT 'Yes,Partially,No,NA',
    Criteria NVARCHAR(MAX),
    ItemOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    IsQuantitative BIT DEFAULT 0,
    Range1From INT NULL,
    Range1To INT NULL,
    Range2From INT NULL,
    Range2To INT NULL,
    Range3From INT NULL,
    DefaultSeverity NVARCHAR(20) DEFAULT 'Medium',
    Quantity INT NULL,
    FOREIGN KEY (SectionId) REFERENCES SEC_InspectionTemplateSections(Id) ON DELETE CASCADE
);

-- 8. Action Items
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionActionItems')
CREATE TABLE SEC_InspectionActionItems (
    Id INT PRIMARY KEY IDENTITY(1,1),
    InspectionId INT NOT NULL,
    SectionName NVARCHAR(200),
    ReferenceValue NVARCHAR(50),
    Finding NVARCHAR(MAX),
    SuggestedAction NVARCHAR(MAX),
    Action NVARCHAR(MAX),
    Responsible NVARCHAR(200),
    Department NVARCHAR(100),
    Deadline DATE,
    Priority NVARCHAR(20) DEFAULT 'Medium',
    Status NVARCHAR(50) DEFAULT 'Open',
    CompletionDate DATE,
    CompletionNotes NVARCHAR(MAX),
    BeforeImageUrl NVARCHAR(500),
    AfterImageUrl NVARCHAR(500),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2,
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id) ON DELETE CASCADE
);

-- 9. Pictures
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionPictures')
CREATE TABLE SEC_InspectionPictures (
    Id INT PRIMARY KEY IDENTITY(1,1),
    ItemId INT NOT NULL,
    InspectionId INT NOT NULL,
    FileName NVARCHAR(255),
    ContentType NVARCHAR(100),
    PictureType NVARCHAR(50),
    FileData NVARCHAR(MAX),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ItemId) REFERENCES SEC_InspectionItems(Id) ON DELETE CASCADE
);

-- 10. Gallery
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionGallery')
CREATE TABLE SEC_InspectionGallery (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    AuditId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    OriginalName NVARCHAR(255),
    FileSize INT,
    UploadedBy NVARCHAR(100),
    UploadedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AuditId) REFERENCES SEC_Inspections(Id) ON DELETE CASCADE
);

-- 11. Gallery Links
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionGalleryLinks')
CREATE TABLE SEC_InspectionGalleryLinks (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    GalleryPictureId INT NOT NULL,
    ResponseId INT NOT NULL,
    PictureType NVARCHAR(20) NOT NULL DEFAULT 'Finding',
    AssignedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (GalleryPictureId) REFERENCES SEC_InspectionGallery(Id) ON DELETE CASCADE,
    FOREIGN KEY (ResponseId) REFERENCES SEC_InspectionItems(Id) ON DELETE NO ACTION
);

-- 12. Schedule
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionSchedule')
CREATE TABLE SEC_InspectionSchedule (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InspectorId INT NOT NULL,
    StoreId INT NOT NULL,
    TemplateId INT NOT NULL,
    ScheduledDate DATE NOT NULL,
    Notes NVARCHAR(500) NULL,
    Status NVARCHAR(50) DEFAULT 'Scheduled',
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (InspectorId) REFERENCES Users(Id),
    FOREIGN KEY (StoreId) REFERENCES Stores(Id),
    FOREIGN KEY (TemplateId) REFERENCES SEC_InspectionTemplates(Id),
    FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

-- 13. Verification
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_ActionItemVerification')
CREATE TABLE SEC_ActionItemVerification (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ActionItemId INT NOT NULL,
    InspectionId INT NOT NULL,
    VerifiedBy INT NOT NULL,
    VerificationStatus NVARCHAR(50) NOT NULL,
    VerificationNotes NVARCHAR(1000) NULL,
    VerificationPictureUrl NVARCHAR(500) NULL,
    VerifiedAt DATETIME NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (ActionItemId) REFERENCES SEC_InspectionActionItems(Id),
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id),
    FOREIGN KEY (VerifiedBy) REFERENCES Users(Id)
);

-- 14. Verification Email Log
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_VerificationEmailLog')
CREATE TABLE SEC_VerificationEmailLog (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InspectionId INT NOT NULL,
    ActionItemId INT NULL,
    SentTo NVARCHAR(500) NOT NULL,
    SentBy INT NOT NULL,
    EmailType NVARCHAR(50) NOT NULL,
    SentAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id),
    FOREIGN KEY (SentBy) REFERENCES Users(Id)
);

-- 15. Escalation Settings
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_EscalationSettings')
CREATE TABLE SEC_EscalationSettings (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SettingKey NVARCHAR(100) NOT NULL UNIQUE,
    SettingValue NVARCHAR(500) NOT NULL,
    Description NVARCHAR(500),
    UpdatedBy INT,
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- 16. Action Plan Escalations
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_ActionPlanEscalations')
CREATE TABLE SEC_ActionPlanEscalations (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InspectionId INT NOT NULL,
    EscalatedToUserId INT NOT NULL,
    EscalationLevel INT DEFAULT 1,
    EscalationReason NVARCHAR(500),
    EscalatedAt DATETIME DEFAULT GETDATE(),
    NotifiedByEmail BIT DEFAULT 0,
    NotifiedInApp BIT DEFAULT 0,
    ResolvedAt DATETIME NULL,
    ResolvedBy INT NULL,
    Status NVARCHAR(50) DEFAULT 'Pending',
    Notes NVARCHAR(1000),
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id),
    FOREIGN KEY (EscalatedToUserId) REFERENCES Users(Id)
);

-- 17. Brand Responsibles for Security
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_BrandResponsibles')
CREATE TABLE SEC_BrandResponsibles (
    Id INT PRIMARY KEY IDENTITY(1,1),
    BrandId INT NOT NULL,
    AreaManagerId INT NULL,
    HeadOfOpsId INT NULL,
    Notes NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy INT NULL,
    UpdatedAt DATETIME2 NULL,
    UpdatedBy INT NULL,
    FOREIGN KEY (BrandId) REFERENCES Brands(Id),
    FOREIGN KEY (AreaManagerId) REFERENCES Users(Id),
    FOREIGN KEY (HeadOfOpsId) REFERENCES Users(Id)
);

-- 18. Fridge Readings (keep for any measurable readings in security context)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_FridgeReadings')
CREATE TABLE SEC_FridgeReadings (
    Id INT PRIMARY KEY IDENTITY(1,1),
    InspectionId INT NOT NULL,
    DocumentNumber NVARCHAR(50),
    ReadingType NVARCHAR(20),
    UnitTemp NVARCHAR(20),
    DisplayTemp NVARCHAR(20),
    ProbeTemp NVARCHAR(20),
    Issue NVARCHAR(MAX),
    SectionName NVARCHAR(200),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id) ON DELETE CASCADE
);

-- Seed default settings
INSERT INTO SEC_InspectionSettings (SettingKey, SettingValue, Description)
VALUES 
('DOCUMENT_PREFIX', 'GMRL-SEC', 'Document number prefix for security inspections'),
('PASSING_SCORE', '80', 'Default passing score percentage');

-- Seed escalation defaults
INSERT INTO SEC_EscalationSettings (SettingKey, SettingValue, Description)
VALUES ('ActionPlanDeadlineDays', '14', 'Default action plan deadline in days');

PRINT 'Security Inspection tables created successfully!';
