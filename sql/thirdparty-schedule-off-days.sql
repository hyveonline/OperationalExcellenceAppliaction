-- Add Day Off columns to ThirdpartyScheduleEmployees table
-- Run this on both OEApp_UAT and OEApp_Live

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'MonOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD MonOff BIT DEFAULT 0;
    PRINT 'Added MonOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'TueOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD TueOff BIT DEFAULT 0;
    PRINT 'Added TueOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'WedOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD WedOff BIT DEFAULT 0;
    PRINT 'Added WedOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'ThuOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD ThuOff BIT DEFAULT 0;
    PRINT 'Added ThuOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'FriOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD FriOff BIT DEFAULT 0;
    PRINT 'Added FriOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'SatOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD SatOff BIT DEFAULT 0;
    PRINT 'Added SatOff column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ThirdpartyScheduleEmployees') AND name = 'SunOff')
BEGIN
    ALTER TABLE ThirdpartyScheduleEmployees ADD SunOff BIT DEFAULT 0;
    PRINT 'Added SunOff column';
END

PRINT 'Done - Day Off columns added to ThirdpartyScheduleEmployees';
