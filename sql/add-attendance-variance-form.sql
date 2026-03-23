-- Add Attendance Variance form to FormRegistry
-- Run on both UAT and Live databases

USE OEApp_UAT;
GO

-- Check if form already exists
IF NOT EXISTS (SELECT 1 FROM FormRegistry WHERE Route = '/operational-excellence/attendance-variance')
BEGIN
    INSERT INTO FormRegistry (
        FormName, 
        FormDescription, 
        Route, 
        Icon, 
        Category, 
        SortOrder, 
        IsActive, 
        RequiresAuth,
        CreatedAt
    )
    VALUES (
        'Schedule vs Attendance Variance',
        'Compare scheduled shifts with actual attendance to identify variances (No Show, Late, Early Leave, Ghost, Overtime)',
        '/operational-excellence/attendance-variance',
        'chart-timeline-variant-shimmer',
        'Operational Excellence',
        85,
        1,
        1,
        GETDATE()
    );
    PRINT 'Attendance Variance form added to FormRegistry';
END
ELSE
BEGIN
    PRINT 'Attendance Variance form already exists in FormRegistry';
END
GO

-- Add permissions for admin roles
-- First, get the form ID
DECLARE @FormId INT;
SELECT @FormId = Id FROM FormRegistry WHERE Route = '/operational-excellence/attendance-variance';

-- Add to UserRoles for OE Admin role if it exists
IF EXISTS (SELECT 1 FROM UserRoles WHERE RoleName LIKE '%OE%Admin%' OR RoleName LIKE '%Operational%Excellence%')
BEGIN
    -- Check if UserRolePermissions table exists and has FormId column
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRolePermissions')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM UserRolePermissions WHERE FormId = @FormId)
        BEGIN
            INSERT INTO UserRolePermissions (RoleId, FormId, CanView, CanCreate, CanEdit, CanDelete)
            SELECT r.Id, @FormId, 1, 0, 0, 0
            FROM UserRoles r
            WHERE r.RoleName LIKE '%OE%Admin%' OR r.RoleName LIKE '%Operational%Excellence%';
            PRINT 'Permissions added for OE Admin roles';
        END
    END
END
GO

PRINT 'Setup complete for UAT database';
GO

-- Now do the same for Live database
USE OEApp_Live;
GO

IF NOT EXISTS (SELECT 1 FROM FormRegistry WHERE Route = '/operational-excellence/attendance-variance')
BEGIN
    INSERT INTO FormRegistry (
        FormName, 
        FormDescription, 
        Route, 
        Icon, 
        Category, 
        SortOrder, 
        IsActive, 
        RequiresAuth,
        CreatedAt
    )
    VALUES (
        'Schedule vs Attendance Variance',
        'Compare scheduled shifts with actual attendance to identify variances (No Show, Late, Early Leave, Ghost, Overtime)',
        '/operational-excellence/attendance-variance',
        'chart-timeline-variant-shimmer',
        'Operational Excellence',
        85,
        1,
        1,
        GETDATE()
    );
    PRINT 'Attendance Variance form added to FormRegistry (Live)';
END
ELSE
BEGIN
    PRINT 'Attendance Variance form already exists in FormRegistry (Live)';
END
GO

-- Add permissions for admin roles in Live
DECLARE @FormIdLive INT;
SELECT @FormIdLive = Id FROM FormRegistry WHERE Route = '/operational-excellence/attendance-variance';

IF EXISTS (SELECT 1 FROM UserRoles WHERE RoleName LIKE '%OE%Admin%' OR RoleName LIKE '%Operational%Excellence%')
BEGIN
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserRolePermissions')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM UserRolePermissions WHERE FormId = @FormIdLive)
        BEGIN
            INSERT INTO UserRolePermissions (RoleId, FormId, CanView, CanCreate, CanEdit, CanDelete)
            SELECT r.Id, @FormIdLive, 1, 0, 0, 0
            FROM UserRoles r
            WHERE r.RoleName LIKE '%OE%Admin%' OR r.RoleName LIKE '%Operational%Excellence%';
            PRINT 'Permissions added for OE Admin roles (Live)';
        END
    END
END
GO

PRINT 'Setup complete for Live database';
GO
