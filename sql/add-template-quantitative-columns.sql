-- Add quantitative range columns to OE_InspectionTemplateItems
-- These columns store the ranges for auto-grading based on quantity

USE OEApp_UAT;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'IsQuantitative')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD IsQuantitative BIT DEFAULT 0;
    PRINT 'Added IsQuantitative column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range1From')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range1From INT NULL;
    PRINT 'Added Range1From column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range1To')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range1To INT NULL;
    PRINT 'Added Range1To column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range2From')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range2From INT NULL;
    PRINT 'Added Range2From column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range2To')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range2To INT NULL;
    PRINT 'Added Range2To column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range3From')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range3From INT NULL;
    PRINT 'Added Range3From column to OE_InspectionTemplateItems';
END
GO

PRINT 'UAT: OE_InspectionTemplateItems quantitative columns added successfully';
GO

-- Also add to OE_InspectionItems (for audit data)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'IsQuantitative')
BEGIN
    ALTER TABLE OE_InspectionItems ADD IsQuantitative BIT DEFAULT 0;
    PRINT 'Added IsQuantitative column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range1From')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range1From INT NULL;
    PRINT 'Added Range1From column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range1To')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range1To INT NULL;
    PRINT 'Added Range1To column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range2From')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range2From INT NULL;
    PRINT 'Added Range2From column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range2To')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range2To INT NULL;
    PRINT 'Added Range2To column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range3From')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range3From INT NULL;
    PRINT 'Added Range3From column to OE_InspectionItems';
END
GO

PRINT 'UAT: OE_InspectionItems quantitative columns added successfully';
GO

-- ================================================
-- LIVE DATABASE
-- ================================================

USE OEApp_Live;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'IsQuantitative')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD IsQuantitative BIT DEFAULT 0;
    PRINT 'Added IsQuantitative column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range1From')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range1From INT NULL;
    PRINT 'Added Range1From column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range1To')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range1To INT NULL;
    PRINT 'Added Range1To column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range2From')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range2From INT NULL;
    PRINT 'Added Range2From column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range2To')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range2To INT NULL;
    PRINT 'Added Range2To column to OE_InspectionTemplateItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionTemplateItems') AND name = 'Range3From')
BEGIN
    ALTER TABLE OE_InspectionTemplateItems ADD Range3From INT NULL;
    PRINT 'Added Range3From column to OE_InspectionTemplateItems';
END
GO

PRINT 'LIVE: OE_InspectionTemplateItems quantitative columns added successfully';
GO

-- Also add to OE_InspectionItems (for audit data)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'IsQuantitative')
BEGIN
    ALTER TABLE OE_InspectionItems ADD IsQuantitative BIT DEFAULT 0;
    PRINT 'Added IsQuantitative column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range1From')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range1From INT NULL;
    PRINT 'Added Range1From column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range1To')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range1To INT NULL;
    PRINT 'Added Range1To column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range2From')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range2From INT NULL;
    PRINT 'Added Range2From column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range2To')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range2To INT NULL;
    PRINT 'Added Range2To column to OE_InspectionItems';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('OE_InspectionItems') AND name = 'Range3From')
BEGIN
    ALTER TABLE OE_InspectionItems ADD Range3From INT NULL;
    PRINT 'Added Range3From column to OE_InspectionItems';
END
GO

PRINT 'LIVE: OE_InspectionItems quantitative columns added successfully';
GO
