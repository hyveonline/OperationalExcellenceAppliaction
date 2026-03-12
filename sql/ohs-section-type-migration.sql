-- =====================================================
-- Add SectionType column to OHS_InspectionTemplateSections
-- Database: OEApp_UAT
-- Migration: Add support for different section types (checklist vs freetext)
-- =====================================================

USE OEApp_UAT;
GO

-- Add SectionType column if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE Name = 'SectionType' 
    AND Object_ID = Object_ID('OHS_InspectionTemplateSections')
)
BEGIN
    ALTER TABLE OHS_InspectionTemplateSections
    ADD SectionType NVARCHAR(50) DEFAULT 'checklist';
    
    PRINT 'Added SectionType column to OHS_InspectionTemplateSections';
    
    -- Update existing sections to be 'checklist' type
    UPDATE OHS_InspectionTemplateSections
    SET SectionType = 'checklist'
    WHERE SectionType IS NULL;
END
ELSE
BEGIN
    PRINT 'SectionType column already exists';
END
GO

-- Also add to inspection responses table for storing freetext responses
IF NOT EXISTS (
    SELECT * FROM sys.tables WHERE name = 'OHS_InspectionSectionResponses'
)
BEGIN
    CREATE TABLE OHS_InspectionSectionResponses (
        Id INT PRIMARY KEY IDENTITY(1,1),
        InspectionId INT NOT NULL,
        SectionId INT NOT NULL,
        DepartmentId INT,
        ResponseText NVARCHAR(MAX),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        
        CONSTRAINT FK_OHS_SectionResponses_Inspection 
            FOREIGN KEY (InspectionId) REFERENCES OHS_Inspections(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_OHS_SectionResponses_InspectionId ON OHS_InspectionSectionResponses(InspectionId);
    CREATE INDEX IX_OHS_SectionResponses_SectionId ON OHS_InspectionSectionResponses(SectionId);
    
    PRINT 'Created OHS_InspectionSectionResponses table for freetext responses';
END
GO
