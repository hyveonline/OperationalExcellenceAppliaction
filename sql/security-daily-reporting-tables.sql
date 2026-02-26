-- Security Daily Reporting Table
-- Created: 2026-02-26

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SecurityDailyReporting')
BEGIN
    CREATE TABLE SecurityDailyReporting (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ReportDate DATE NOT NULL,
        Company NVARCHAR(100),
        StoreId INT,
        GuardName NVARCHAR(200),
        DailyNotes NVARCHAR(MAX),
        SubmittedBy INT,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME,
        FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        FOREIGN KEY (SubmittedBy) REFERENCES Users(Id)
    );
    PRINT 'Created SecurityDailyReporting table';
END
GO

-- Add form permission
IF NOT EXISTS (SELECT * FROM Forms WHERE FormCode = 'SECURITY_DAILY_REPORTING')
BEGIN
    INSERT INTO Forms (FormCode, FormName, Description, ModuleName, FormUrl, IsActive)
    VALUES ('SECURITY_DAILY_REPORTING', 'Security Daily Reporting', 'Security guard daily reporting', 'security-emp', '/security-emp/daily-reporting', 1);
    PRINT 'Added SECURITY_DAILY_REPORTING form permission';
END
GO

PRINT 'Security Daily Reporting setup complete';
