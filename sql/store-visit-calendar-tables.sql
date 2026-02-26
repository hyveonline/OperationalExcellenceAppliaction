-- Store Visit Calendar - Schedule and track employee store visits
-- Run on both UAT and Live databases

-- Store Visit Schedule table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StoreVisitSchedule')
CREATE TABLE StoreVisitSchedule (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    VisitDate DATE NOT NULL,
    EmployeeId INT NULL,
    EmployeeName NVARCHAR(200) NOT NULL,
    EmployeeEmail NVARCHAR(200),
    StoreId INT NULL,
    StoreName NVARCHAR(200) NOT NULL,
    VisitType NVARCHAR(100), -- Inspection, Follow-up, Training, Audit, Meeting, Other
    Notes NVARCHAR(1000),
    Status NVARCHAR(50) DEFAULT 'Scheduled', -- Scheduled, Completed, Cancelled
    CompletedAt DATETIME,
    CompletedNotes NVARCHAR(1000),
    CreatedBy NVARCHAR(200),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Indexes for faster queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreVisitSchedule_Date')
    CREATE INDEX IX_StoreVisitSchedule_Date ON StoreVisitSchedule(VisitDate);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreVisitSchedule_Employee')
    CREATE INDEX IX_StoreVisitSchedule_Employee ON StoreVisitSchedule(EmployeeName);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreVisitSchedule_Store')
    CREATE INDEX IX_StoreVisitSchedule_Store ON StoreVisitSchedule(StoreName);

-- Form permission
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'STORE_VISIT_CALENDAR')
INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description)
VALUES ('STORE_VISIT_CALENDAR', 'Store Visit Calendar', 'operational-excellence', '/operational-excellence/calendar', 'Schedule and track employee store visits');
