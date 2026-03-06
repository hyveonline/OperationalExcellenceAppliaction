-- Add Notes column to Security_AttendanceEntries table
-- Run on both OEApp_UAT and OEApp_Live databases

-- Check if column exists, if not add it
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'Security_AttendanceEntries' 
               AND COLUMN_NAME = 'Notes')
BEGIN
    ALTER TABLE Security_AttendanceEntries ADD Notes NVARCHAR(500) NULL;
    PRINT 'Notes column added to Security_AttendanceEntries';
END
ELSE
BEGIN
    PRINT 'Notes column already exists in Security_AttendanceEntries';
END
GO
