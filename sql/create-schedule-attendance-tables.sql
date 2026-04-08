-- Schedule and Attendance Tables
-- UAT Database: OEApp_UAT
-- LIVE Database: OEApp_Live

-- =====================================================
-- RUN ON UAT DATABASE FIRST
-- =====================================================

-- Main Employees Table
CREATE TABLE Personnel_Employees (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Company NVARCHAR(100) NOT NULL,
    EmployeeId NVARCHAR(50) NULL,
    PhoneNumber NVARCHAR(50) NULL,
    Name NVARCHAR(100) NOT NULL,
    Position NVARCHAR(100) NULL,
    IsActive BIT DEFAULT 1,
    CreatedBy NVARCHAR(200) NULL,
    CreatedById NVARCHAR(100) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- Weekly Schedule Table
CREATE TABLE Personnel_EmployeeSchedule (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL FOREIGN KEY REFERENCES Personnel_Employees(Id),
    WeekStartDate DATE NOT NULL,
    
    -- Monday
    MondayFrom1 NVARCHAR(10) NULL,
    MondayTo1 NVARCHAR(10) NULL,
    MondayFrom2 NVARCHAR(10) NULL,
    MondayTo2 NVARCHAR(10) NULL,
    MondayActualIn NVARCHAR(10) NULL,
    MondayActualOut NVARCHAR(10) NULL,
    MondayOff BIT DEFAULT 0,
    
    -- Tuesday
    TuesdayFrom1 NVARCHAR(10) NULL,
    TuesdayTo1 NVARCHAR(10) NULL,
    TuesdayFrom2 NVARCHAR(10) NULL,
    TuesdayTo2 NVARCHAR(10) NULL,
    TuesdayActualIn NVARCHAR(10) NULL,
    TuesdayActualOut NVARCHAR(10) NULL,
    TuesdayOff BIT DEFAULT 0,
    
    -- Wednesday
    WednesdayFrom1 NVARCHAR(10) NULL,
    WednesdayTo1 NVARCHAR(10) NULL,
    WednesdayFrom2 NVARCHAR(10) NULL,
    WednesdayTo2 NVARCHAR(10) NULL,
    WednesdayActualIn NVARCHAR(10) NULL,
    WednesdayActualOut NVARCHAR(10) NULL,
    WednesdayOff BIT DEFAULT 0,
    
    -- Thursday
    ThursdayFrom1 NVARCHAR(10) NULL,
    ThursdayTo1 NVARCHAR(10) NULL,
    ThursdayFrom2 NVARCHAR(10) NULL,
    ThursdayTo2 NVARCHAR(10) NULL,
    ThursdayActualIn NVARCHAR(10) NULL,
    ThursdayActualOut NVARCHAR(10) NULL,
    ThursdayOff BIT DEFAULT 0,
    
    -- Friday
    FridayFrom1 NVARCHAR(10) NULL,
    FridayTo1 NVARCHAR(10) NULL,
    FridayFrom2 NVARCHAR(10) NULL,
    FridayTo2 NVARCHAR(10) NULL,
    FridayActualIn NVARCHAR(10) NULL,
    FridayActualOut NVARCHAR(10) NULL,
    FridayOff BIT DEFAULT 0,
    
    -- Saturday
    SaturdayFrom1 NVARCHAR(10) NULL,
    SaturdayTo1 NVARCHAR(10) NULL,
    SaturdayFrom2 NVARCHAR(10) NULL,
    SaturdayTo2 NVARCHAR(10) NULL,
    SaturdayActualIn NVARCHAR(10) NULL,
    SaturdayActualOut NVARCHAR(10) NULL,
    SaturdayOff BIT DEFAULT 0,
    
    -- Sunday
    SundayFrom1 NVARCHAR(10) NULL,
    SundayTo1 NVARCHAR(10) NULL,
    SundayFrom2 NVARCHAR(10) NULL,
    SundayTo2 NVARCHAR(10) NULL,
    SundayActualIn NVARCHAR(10) NULL,
    SundayActualOut NVARCHAR(10) NULL,
    SundayOff BIT DEFAULT 0,
    
    -- Status
    Status NVARCHAR(20) DEFAULT 'Draft',
    SubmittedAt DATETIME NULL,
    SubmittedBy NVARCHAR(200) NULL,
    
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT UQ_Employee_Week UNIQUE (EmployeeId, WeekStartDate)
);

-- Indexes
CREATE INDEX IX_Personnel_Employees_Company ON Personnel_Employees(Company);
CREATE INDEX IX_Personnel_Employees_IsActive ON Personnel_Employees(IsActive);
CREATE INDEX IX_Personnel_EmployeeSchedule_Week ON Personnel_EmployeeSchedule(WeekStartDate);

PRINT 'Tables created successfully';
