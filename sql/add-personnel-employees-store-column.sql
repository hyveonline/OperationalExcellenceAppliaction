-- Add Store column to Personnel_Employees table
-- ==================================================

-- =====================================================
-- FOR UAT DATABASE (OEApp_UAT)
-- =====================================================
USE OEApp_UAT;
GO

ALTER TABLE Personnel_Employees 
ADD Store NVARCHAR(200) NULL;
GO

-- =====================================================
-- FOR LIVE DATABASE (OEApp_Live)
-- =====================================================
USE OEApp_Live;
GO

ALTER TABLE Personnel_Employees 
ADD Store NVARCHAR(200) NULL;
GO
