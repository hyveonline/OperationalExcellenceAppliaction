-- Add IsRepetitive field to OHS_InspectionItems table
-- Run on both UAT and Live databases

-- Add IsRepetitive column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OHS_InspectionItems') AND name = 'IsRepetitive')
BEGIN
    ALTER TABLE OHS_InspectionItems ADD IsRepetitive BIT NULL DEFAULT 0;
    PRINT 'Added IsRepetitive column to OHS_InspectionItems';
END
ELSE
BEGIN
    PRINT 'IsRepetitive column already exists in OHS_InspectionItems';
END
GO

PRINT 'OHS Inspection repetitive field migration complete';
