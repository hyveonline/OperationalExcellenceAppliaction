-- =============================================
-- Receiving Audit Module - Database Setup
-- Run on BOTH UAT and LIVE databases
-- =============================================

-- 1. Settings Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionSettings')
BEGIN
    CREATE TABLE RCV_InspectionSettings (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SettingKey NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue NVARCHAR(500),
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    INSERT INTO RCV_InspectionSettings (SettingKey, SettingValue, Description) VALUES
    ('DOCUMENT_PREFIX', 'GMRL-RCV', 'Document number prefix'),
    ('PASSING_SCORE', '80', 'Overall passing score percentage'),
    ('SECTION_PASSING_SCORE', '80', 'Section passing score percentage'),
    ('DEFAULT_DEADLINE_DAYS', '7', 'Default days for action plan deadline');
END
GO

-- 2. Templates Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionTemplates')
BEGIN
    CREATE TABLE RCV_InspectionTemplates (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateName NVARCHAR(255) NOT NULL,
        Description NVARCHAR(500),
        IsActive BIT DEFAULT 1,
        IsDefault BIT DEFAULT 0,
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
END
GO

-- 3. Template Sections Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionTemplateSections')
BEGIN
    CREATE TABLE RCV_InspectionTemplateSections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TemplateId INT NOT NULL REFERENCES RCV_InspectionTemplates(Id),
        SectionName NVARCHAR(255) NOT NULL,
        SectionIcon NVARCHAR(50),
        SectionOrder INT DEFAULT 1,
        PassingGrade INT DEFAULT 80,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- 4. Template Items Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionTemplateItems')
BEGIN
    CREATE TABLE RCV_InspectionTemplateItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        SectionId INT NOT NULL REFERENCES RCV_InspectionTemplateSections(Id),
        ReferenceValue NVARCHAR(50),
        Question NVARCHAR(MAX) NOT NULL,
        Coefficient DECIMAL(5,2) DEFAULT 1,
        Quantity INT,
        AnswerOptions NVARCHAR(500) DEFAULT 'Yes,Partially,No,NA',
        Criteria NVARCHAR(MAX),
        ItemOrder INT DEFAULT 1,
        IsQuantitative BIT DEFAULT 0,
        Range1From INT,
        Range1To INT,
        Range2From INT,
        Range2To INT,
        Range3From INT,
        DefaultSeverity NVARCHAR(50),
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- 5. Main Inspections Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_Inspections')
BEGIN
    CREATE TABLE RCV_Inspections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        DocumentNumber NVARCHAR(50) NOT NULL UNIQUE,
        StoreId INT,
        StoreName NVARCHAR(255),
        InspectionDate DATE,
        TimeIn TIME,
        TimeOut TIME,
        Inspectors NVARCHAR(500),
        AccompaniedBy NVARCHAR(500),
        Cycle INT DEFAULT 1,
        Year INT,
        Status NVARCHAR(50) DEFAULT 'Draft',
        Score DECIMAL(5,2),
        TotalPoints DECIMAL(10,2),
        MaxPoints DECIMAL(10,2),
        Comments NVARCHAR(MAX),
        TemplateId INT,
        CreatedBy INT,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        CompletedAt DATETIME2,
        ApprovedBy INT,
        ApprovedAt DATETIME2,
        ActionPlanDeadline DATETIME2
    );
    
    CREATE INDEX IX_RCV_Inspections_DocumentNumber ON RCV_Inspections(DocumentNumber);
    CREATE INDEX IX_RCV_Inspections_StoreId ON RCV_Inspections(StoreId);
    CREATE INDEX IX_RCV_Inspections_Status ON RCV_Inspections(Status);
    CREATE INDEX IX_RCV_Inspections_InspectionDate ON RCV_Inspections(InspectionDate);
END
GO

-- 6. Inspection Sections Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionSections')
BEGIN
    CREATE TABLE RCV_InspectionSections (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL REFERENCES RCV_Inspections(Id),
        SectionName NVARCHAR(255),
        SectionIcon NVARCHAR(50),
        SectionOrder INT DEFAULT 1,
        Score DECIMAL(5,2),
        TotalPoints DECIMAL(10,2),
        MaxPoints DECIMAL(10,2),
        Status NVARCHAR(50)
    );
END
GO

-- 7. Inspection Items Table  
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionItems')
BEGIN
    CREATE TABLE RCV_InspectionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL REFERENCES RCV_Inspections(Id),
        SectionName NVARCHAR(255),
        SectionOrder INT,
        ItemOrder INT,
        ReferenceValue NVARCHAR(50),
        Question NVARCHAR(MAX),
        Coefficient DECIMAL(5,2) DEFAULT 1,
        Quantity INT,
        ActualQuantity INT,
        AnswerOptions NVARCHAR(500),
        Answer NVARCHAR(50),
        Score DECIMAL(5,2),
        Finding NVARCHAR(MAX),
        Comment NVARCHAR(MAX),
        CorrectedAction NVARCHAR(MAX),
        Priority NVARCHAR(50),
        Escalate BIT DEFAULT 0,
        Department NVARCHAR(100),
        HasPicture BIT DEFAULT 0,
        PictureUrl NVARCHAR(500),
        Criteria NVARCHAR(MAX),
        DefaultSeverity NVARCHAR(50),
        IsQuantitative BIT DEFAULT 0,
        Range1From INT,
        Range1To INT,
        Range2From INT,
        Range2To INT,
        Range3From INT,
        Deadline DATE
    );
    
    CREATE INDEX IX_RCV_InspectionItems_InspectionId ON RCV_InspectionItems(InspectionId);
END
GO

-- 8. Pictures Table (metadata only - files stored on disk)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionPictures')
BEGIN
    CREATE TABLE RCV_InspectionPictures (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ItemId INT REFERENCES RCV_InspectionItems(Id),
        InspectionId INT REFERENCES RCV_Inspections(Id),
        FileName NVARCHAR(500),
        OriginalName NVARCHAR(500),
        ContentType NVARCHAR(100),
        PictureType NVARCHAR(50) DEFAULT 'Finding',
        FilePath NVARCHAR(500),
        FileSize INT,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_RCV_InspectionPictures_ItemId ON RCV_InspectionPictures(ItemId);
END
GO

-- 9. Action Items Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionActionItems')
BEGIN
    CREATE TABLE RCV_InspectionActionItems (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT REFERENCES RCV_Inspections(Id),
        ReferenceValue NVARCHAR(50),
        SectionName NVARCHAR(255),
        Finding NVARCHAR(MAX),
        SuggestedAction NVARCHAR(MAX),
        Action NVARCHAR(MAX),
        Responsible NVARCHAR(255),
        Department NVARCHAR(100),
        Deadline DATE,
        Priority NVARCHAR(50) DEFAULT 'Medium',
        Status NVARCHAR(50) DEFAULT 'Open',
        CompletionDate DATE,
        CompletionNotes NVARCHAR(MAX),
        BeforeImageUrl NVARCHAR(500),
        AfterImageUrl NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    CREATE INDEX IX_RCV_ActionItems_InspectionId ON RCV_InspectionActionItems(InspectionId);
END
GO

-- 10. Action Item Verification Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_ActionItemVerification')
BEGIN
    CREATE TABLE RCV_ActionItemVerification (
        Id INT PRIMARY KEY IDENTITY(1,1),
        ActionItemId INT REFERENCES RCV_InspectionActionItems(Id),
        InspectionId INT REFERENCES RCV_Inspections(Id),
        VerifiedBy INT,
        VerificationStatus NVARCHAR(50),
        VerificationNotes NVARCHAR(MAX),
        VerificationPictureUrl NVARCHAR(500),
        VerifiedAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2
    );
    
    CREATE INDEX IX_RCV_Verification_ActionItemId ON RCV_ActionItemVerification(ActionItemId);
END
GO

-- 11. Register in Forms table for dashboard
IF NOT EXISTS (SELECT * FROM Forms WHERE FormCode = 'RCV_AUDIT')
BEGIN
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId,
        DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor,
        DashboardTitle, DashboardDescription, CategorySortOrder, DashboardSortOrder, ShowOnDashboard)
    VALUES ('RCV_AUDIT', 'Receiving Audit', 'Receiving Audit', '/receiving-audit', 
        'Receiving area audit inspections', 1, 'receiving-audit',
        N'📦', 'Inspection & Audit', N'🔍', '#3b82f6',
        'Receiving Audit', 'Receiving area audit inspections', 3, 6, 1);
END
GO

IF NOT EXISTS (SELECT * FROM Forms WHERE FormCode = 'RCV_AUDIT_TEMPLATES')
BEGIN
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId,
        DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor,
        DashboardTitle, DashboardDescription, CategorySortOrder, DashboardSortOrder, ShowOnDashboard)
    VALUES ('RCV_AUDIT_TEMPLATES', 'Receiving Audit Templates', 'Receiving Audit', '/receiving-audit/template-builder',
        'Manage receiving audit templates', 1, 'receiving-audit-templates',
        N'📋', 'Inspection & Audit', N'🔍', '#3b82f6',
        'RCV Templates', 'Manage receiving audit templates', 3, 7, 1);
END
GO

PRINT 'Receiving Audit tables created successfully!';
GO

-- 12. Fridge Readings Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_FridgeReadings')
BEGIN
    CREATE TABLE RCV_FridgeReadings (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT REFERENCES RCV_Inspections(Id),
        ItemId INT REFERENCES RCV_InspectionItems(Id),
        DisplayTemp DECIMAL(10,2),
        ProbeTemp DECIMAL(10,2),
        Issue NVARCHAR(MAX),
        IsCompliant BIT DEFAULT 1,
        Picture NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_RCV_FridgeReadings_InspectionId ON RCV_FridgeReadings(InspectionId);
END
GO

-- 13. Gallery Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionGallery')
BEGIN
    CREATE TABLE RCV_InspectionGallery (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT REFERENCES RCV_Inspections(Id),
        FileName NVARCHAR(500),
        FilePath NVARCHAR(500),
        OriginalName NVARCHAR(500),
        FileSize INT,
        UploadedBy NVARCHAR(255),
        UploadedAt DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_RCV_InspectionGallery_InspectionId ON RCV_InspectionGallery(InspectionId);
END
GO

-- 14. Gallery Links Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RCV_InspectionGalleryLinks')
BEGIN
    CREATE TABLE RCV_InspectionGalleryLinks (
        Id INT PRIMARY KEY IDENTITY(1,1),
        GalleryPictureId INT REFERENCES RCV_InspectionGallery(Id),
        ResponseId INT REFERENCES RCV_InspectionItems(Id),
        PictureType NVARCHAR(50) DEFAULT 'Finding',
        AssignedAt DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_RCV_GalleryLinks_GalleryPictureId ON RCV_InspectionGalleryLinks(GalleryPictureId);
    CREATE INDEX IX_RCV_GalleryLinks_ResponseId ON RCV_InspectionGalleryLinks(ResponseId);
END
GO

PRINT 'Gallery and Fridge tables created successfully!';
