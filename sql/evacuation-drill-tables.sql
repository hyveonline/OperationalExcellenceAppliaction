-- =====================================================
-- Post Evacuation Drill Tables
-- =====================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Main Evacuation Drill table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PostEvacuationDrills')
BEGIN
    CREATE TABLE PostEvacuationDrills (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DrillNumber NVARCHAR(50) NOT NULL,
        DrillDate DATE NOT NULL,
        DrillTime TIME NULL,
        StoreId NVARCHAR(100) NOT NULL,
        StoreName NVARCHAR(255) NOT NULL,
        Shift NVARCHAR(50) NOT NULL,
        
        -- Drill Statistics
        TotalEmployeesInAssembly INT NOT NULL DEFAULT 0,
        ActualEmployeesCount INT NOT NULL DEFAULT 0,
        DrillPercentage AS (
            CASE 
                WHEN ActualEmployeesCount > 0 THEN CAST(TotalEmployeesInAssembly AS DECIMAL(10,2)) / CAST(ActualEmployeesCount AS DECIMAL(10,2)) * 100
                ELSE 0 
            END
        ) PERSISTED,
        
        -- Conductor Details
        ConductedBy NVARCHAR(255) NOT NULL,
        ConductedByEmail NVARCHAR(255) NULL,
        
        -- Additional Notes
        Remarks NVARCHAR(MAX) NULL,
        
        -- Audit fields
        Status NVARCHAR(50) DEFAULT 'Submitted',
        CreatedBy NVARCHAR(255) NOT NULL,
        CreatedByEmail NVARCHAR(255) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        IsActive BIT DEFAULT 1
    );
    
    PRINT 'Created table: PostEvacuationDrills';
END
ELSE
BEGIN
    PRINT 'Table PostEvacuationDrills already exists';
END
GO

-- Action Plan table for evacuation drills
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PostEvacuationActionPlans')
BEGIN
    CREATE TABLE PostEvacuationActionPlans (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DrillId INT NOT NULL FOREIGN KEY REFERENCES PostEvacuationDrills(Id) ON DELETE CASCADE,
        IssueDescription NVARCHAR(MAX) NOT NULL,
        ActionRequired NVARCHAR(MAX) NOT NULL,
        ResponsiblePerson NVARCHAR(255) NOT NULL,
        DueDate DATE NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Open',
        CompletedDate DATE NULL,
        CompletedBy NVARCHAR(255) NULL,
        CompletedRemarks NVARCHAR(MAX) NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_PostEvacuationActionPlans_DrillId ON PostEvacuationActionPlans(DrillId);
    CREATE INDEX IX_PostEvacuationActionPlans_Status ON PostEvacuationActionPlans(Status);
    CREATE INDEX IX_PostEvacuationActionPlans_DueDate ON PostEvacuationActionPlans(DueDate);
    
    PRINT 'Created table: PostEvacuationActionPlans';
END
ELSE
BEGIN
    PRINT 'Table PostEvacuationActionPlans already exists';
END
GO

-- Create indexes for main table
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PostEvacuationDrills_StoreId')
BEGIN
    CREATE INDEX IX_PostEvacuationDrills_StoreId ON PostEvacuationDrills(StoreId);
    CREATE INDEX IX_PostEvacuationDrills_DrillDate ON PostEvacuationDrills(DrillDate);
    CREATE INDEX IX_PostEvacuationDrills_DrillNumber ON PostEvacuationDrills(DrillNumber);
    PRINT 'Created indexes for PostEvacuationDrills';
END
GO

-- Insert sample shifts if needed (for dropdown)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EvacuationDrillShifts')
BEGIN
    CREATE TABLE EvacuationDrillShifts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ShiftName NVARCHAR(100) NOT NULL,
        DisplayOrder INT DEFAULT 0,
        IsActive BIT DEFAULT 1
    );
    
    INSERT INTO EvacuationDrillShifts (ShiftName, DisplayOrder) VALUES
    ('Morning Shift', 1),
    ('Afternoon Shift', 2),
    ('Evening Shift', 3),
    ('Night Shift', 4),
    ('Full Day', 5);
    
    PRINT 'Created table: EvacuationDrillShifts with default values';
END
GO

PRINT 'Post Evacuation Drill tables setup complete!';
