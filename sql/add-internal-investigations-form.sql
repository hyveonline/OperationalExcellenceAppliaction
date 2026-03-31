-- Add Internal Investigations Module for Security Department
-- Run on both UAT and Live databases

USE OEApp_UAT;
GO

-- Create InternalInvestigations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InternalInvestigations')
BEGIN
    CREATE TABLE InternalInvestigations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SecurityTeamReps NVARCHAR(MAX) NULL,  -- JSON array of user IDs
        HRReps NVARCHAR(500) NULL,            -- Free text for HR representatives
        StoreId INT NULL,
        CaseTopic NVARCHAR(500) NULL,
        EmployeeNames NVARCHAR(MAX) NULL,
        Currency NVARCHAR(10) DEFAULT 'LBP',  -- LBP or USD
        AmountStolen DECIMAL(18,2) NULL,
        AmountCollected DECIMAL(18,2) NULL,
        ActionTaken NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) DEFAULT 'New',
        CreatedBy INT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_InternalInvestigations_Store FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        CONSTRAINT FK_InternalInvestigations_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
    PRINT 'InternalInvestigations table created successfully!';
END
ELSE
BEGIN
    PRINT 'InternalInvestigations table already exists.';
END
GO

-- Add the form to Forms registry for dashboard
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_INTERNAL_INVESTIGATIONS')
BEGIN
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_INTERNAL_INVESTIGATIONS', 'Internal Investigations', 'Security Department', '/security-emp/internal-investigations', 'Internal investigations tracking for security department', 1, 'internal-investigations', N'🔍', 'Security Department', N'🔒', '#343a40', 'Internal Investigations', 'Track and manage internal investigations', 1, 4, 7);
    
    PRINT 'Internal Investigations form added to Forms registry successfully!';
END
ELSE
BEGIN
    PRINT 'Internal Investigations form already exists in Forms registry.';
END
GO

PRINT 'UAT setup complete!';
GO

-- Now do the same for Live database
USE OEApp_Live;
GO

-- Create InternalInvestigations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InternalInvestigations')
BEGIN
    CREATE TABLE InternalInvestigations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SecurityTeamReps NVARCHAR(MAX) NULL,  -- JSON array of user IDs
        HRReps NVARCHAR(500) NULL,            -- Free text for HR representatives
        StoreId INT NULL,
        CaseTopic NVARCHAR(500) NULL,
        EmployeeNames NVARCHAR(MAX) NULL,
        Currency NVARCHAR(10) DEFAULT 'LBP',  -- LBP or USD
        AmountStolen DECIMAL(18,2) NULL,
        AmountCollected DECIMAL(18,2) NULL,
        ActionTaken NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) DEFAULT 'New',
        CreatedBy INT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_InternalInvestigations_Store FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        CONSTRAINT FK_InternalInvestigations_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
    PRINT 'InternalInvestigations table created successfully!';
END
ELSE
BEGIN
    PRINT 'InternalInvestigations table already exists.';
END
GO

-- Add the form to Forms registry for dashboard
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'SECURITY_INTERNAL_INVESTIGATIONS')
BEGIN
    INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description, IsActive, MenuId, DashboardIcon, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardTitle, DashboardDescription, ShowOnDashboard, CategorySortOrder, DashboardSortOrder)
    VALUES ('SECURITY_INTERNAL_INVESTIGATIONS', 'Internal Investigations', 'Security Department', '/security-emp/internal-investigations', 'Internal investigations tracking for security department', 1, 'internal-investigations', N'🔍', 'Security Department', N'🔒', '#343a40', 'Internal Investigations', 'Track and manage internal investigations', 1, 4, 7);
    
    PRINT 'Internal Investigations form added to Forms registry successfully!';
END
ELSE
BEGIN
    PRINT 'Internal Investigations form already exists in Forms registry.';
END
GO

PRINT 'Live setup complete!';
GO
