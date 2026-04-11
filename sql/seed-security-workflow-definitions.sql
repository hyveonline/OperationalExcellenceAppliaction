-- Seed additional security & missing modules into WorkflowDefinitions
-- Run on both UAT (OEApp_UAT) and LIVE (OEApp_Live)

-- Only insert if they don't already exist
IF NOT EXISTS (SELECT 1 FROM WorkflowDefinitions WHERE FormCode = 'BLACKLIST')
BEGIN
    INSERT INTO WorkflowDefinitions (FormCode, FormName, ModulePath, WorkflowType, IsActive)
    VALUES
        ('BLACKLIST',               'Third Party Blacklist',            '/security-emp/blacklist',                  'NONE', 0),
        ('ATTENDANCE_REPORT',       'Attendance Report',                '/security-services/attendance-report',     'NONE', 0),
        ('CLEANING_CHECKLIST',      'Cleaning Checklist',               '/security-services/cleaning-checklist',    'NONE', 0),
        ('DAILY_TASKS',             'Daily Tasks',                      '/security-services/daily-tasks',           'NONE', 0),
        ('DELIVERY_LOG',            'Delivery Log',                     '/security-services/delivery-log',          'NONE', 0),
        ('ENTRANCE_FORM',           'Entrance Form',                    '/security-services/entrance-form',         'NONE', 0),
        ('PARKING_VIOLATION',       'Parking Violation',                '/security-services/parking-violation',     'NONE', 0),
        ('PATROL_SHEET',            'Patrol Sheet',                     '/security-services/patrol-sheet',          'NONE', 0),
        ('SECURITY_CHECKLIST',      'Security Checklist',               '/security-services/security-checklist',    'NONE', 0),
        ('VISITOR_CARS',            'Visitor Cars',                     '/security-services/visitor-cars',          'NONE', 0),
        ('WEEKLY_SCHEDULE',         'Weekly Cleaning Schedule',         '/security-services/weekly-schedule',       'NONE', 0),
        ('FIVE_DAYS',               'Five Days Expired Items',          '/stores/five-days',                        'NONE', 0),
        ('SEC_DAILY_TASKS',         'Daily Tasks (Admin)',              '/security/daily-tasks',                    'NONE', 0);
    PRINT 'Seeded 13 additional WorkflowDefinitions';
END
ELSE
    PRINT 'Additional WorkflowDefinitions already exist';
GO
