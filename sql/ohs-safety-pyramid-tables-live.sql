-- =====================================================
-- OHS Safety Pyramid Tables - LIVE
-- Database: OEApp_Live
-- Creates tables for Safety Pyramid tracking
-- =====================================================

USE OEApp_Live;
GO

-- =====================================================
-- OHS Severity Levels (Safety Pyramid Levels)
-- 7 levels from Near Miss (bottom) to Fatality (top)
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSSeverityLevels')
BEGIN
    CREATE TABLE OHSSeverityLevels (
        Id INT PRIMARY KEY IDENTITY(1,1),
        LevelName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500),
        ColorHex NVARCHAR(20),
        PyramidOrder INT NOT NULL, -- 1 = top (Fatality), 7 = bottom (Near Miss)
        IsLagging BIT DEFAULT 1, -- 1 = Lagging Indicator, 0 = Leading Indicator
        ReportedBy NVARCHAR(100), -- HR Personnel or Store Management
        IncludeInRIR BIT DEFAULT 0, -- Included in Recordable Incident Rate
        IncludeInLTIR BIT DEFAULT 0, -- Included in Lost Time Injury Rate
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert the 7 pyramid levels (top to bottom)
    INSERT INTO OHSSeverityLevels (LevelName, Description, ColorHex, PyramidOrder, IsLagging, ReportedBy, IncludeInRIR, IncludeInLTIR) VALUES 
        ('Fatality', 'A work-related incident resulting in loss of life', '#000000', 1, 1, 'HR Personnel', 1, 1),
        ('Irreversible', 'An injury causing lasting impairment affecting the employee''s ability to perform normal work', '#8B0000', 2, 1, 'HR Personnel', 1, 1),
        ('Lost-Time', 'An injury that results in the employee missing one or more full workdays', '#DC143C', 3, 1, 'HR Personnel', 1, 1),
        ('Restricted Work', 'An injury where the employee can work but with temporary limitations or modified duties', '#FF6347', 4, 1, 'HR Personnel', 1, 0),
        ('Medical Treatment', 'An injury requiring professional medical treatment beyond first aid', '#FF8C00', 5, 1, 'HR Personnel', 1, 0),
        ('First Aid', 'A minor injury treated on-site with basic medical care and no lost work time', '#FFD700', 6, 1, 'HR Personnel', 0, 0),
        ('Near Miss', 'An event that could have caused injury or damage but did not due to chance or timely intervention', '#228B22', 7, 0, 'Store Management', 0, 0);
    
    PRINT 'OHSSeverityLevels table created with default values';
END
GO

-- =====================================================
-- Add SeverityLevelId to OHSIncidents table
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OHSIncidents') AND name = 'SeverityLevelId')
BEGIN
    ALTER TABLE OHSIncidents ADD SeverityLevelId INT NULL;
    
    -- Add foreign key constraint
    ALTER TABLE OHSIncidents ADD CONSTRAINT FK_OHSIncidents_SeverityLevel 
        FOREIGN KEY (SeverityLevelId) REFERENCES OHSSeverityLevels(Id);
    
    CREATE INDEX IX_OHSIncidents_SeverityLevelId ON OHSIncidents(SeverityLevelId);
    
    PRINT 'SeverityLevelId column added to OHSIncidents table';
END
GO

-- =====================================================
-- Add LostWorkDays to OHSIncidents table
-- For tracking days lost due to injury
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OHSIncidents') AND name = 'LostWorkDays')
BEGIN
    ALTER TABLE OHSIncidents ADD LostWorkDays INT NULL DEFAULT 0;
    
    PRINT 'LostWorkDays column added to OHSIncidents table';
END
GO

-- =====================================================
-- OHS Store Man-Hours
-- Monthly man-hours by store for RIR/LTIR calculations
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OHSStoreManHours')
BEGIN
    CREATE TABLE OHSStoreManHours (
        Id INT PRIMARY KEY IDENTITY(1,1),
        StoreId INT NOT NULL,
        StoreName NVARCHAR(200) NOT NULL,
        Year INT NOT NULL,
        Month INT NOT NULL,
        TotalEmployees INT DEFAULT 0,
        TotalHoursWorked DECIMAL(12,2) DEFAULT 0,
        Notes NVARCHAR(500),
        EnteredByUserId NVARCHAR(255),
        EnteredByName NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        UpdatedBy NVARCHAR(255),
        
        CONSTRAINT UQ_OHSStoreManHours_StoreYearMonth UNIQUE (StoreId, Year, Month)
    );
    
    CREATE INDEX IX_OHSStoreManHours_StoreId ON OHSStoreManHours(StoreId);
    CREATE INDEX IX_OHSStoreManHours_YearMonth ON OHSStoreManHours(Year, Month);
    
    PRINT 'OHSStoreManHours table created';
END
GO

-- =====================================================
-- Update OHSInjuryTypes to map to Severity Levels
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OHSInjuryTypes') AND name = 'DefaultSeverityLevelId')
BEGIN
    ALTER TABLE OHSInjuryTypes ADD DefaultSeverityLevelId INT NULL;
    
    -- Map Fatality injury type to Fatality severity level
    UPDATE OHSInjuryTypes SET DefaultSeverityLevelId = 1 WHERE InjuryTypeName = 'Fatality';
    
    PRINT 'DefaultSeverityLevelId column added to OHSInjuryTypes table';
END
GO

PRINT 'OHS Safety Pyramid Tables setup completed successfully';
GO
