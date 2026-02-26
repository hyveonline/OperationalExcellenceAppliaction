-- Add Day Off columns to SecurityScheduleEmployees table
-- Run this on both OEApp_UAT and OEApp_Live

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'MondayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD MondayOff BIT DEFAULT 0;
    PRINT 'Added MondayOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'TuesdayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD TuesdayOff BIT DEFAULT 0;
    PRINT 'Added TuesdayOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'WednesdayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD WednesdayOff BIT DEFAULT 0;
    PRINT 'Added WednesdayOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'ThursdayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD ThursdayOff BIT DEFAULT 0;
    PRINT 'Added ThursdayOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'FridayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD FridayOff BIT DEFAULT 0;
    PRINT 'Added FridayOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'SaturdayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD SaturdayOff BIT DEFAULT 0;
    PRINT 'Added SaturdayOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SecurityScheduleEmployees') AND name = 'SundayOff')
BEGIN
    ALTER TABLE SecurityScheduleEmployees ADD SundayOff BIT DEFAULT 0;
    PRINT 'Added SundayOff column';
END

PRINT 'Done - Day Off columns added to SecurityScheduleEmployees';
