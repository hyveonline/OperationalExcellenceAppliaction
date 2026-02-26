-- Master Table - Third Party Staff Management
-- Run on both UAT and Live databases

-- Master Table Entries (Base data for each staff entry)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MasterTableEntries')
CREATE TABLE MasterTableEntries (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Category NVARCHAR(50) NOT NULL, -- Security, Valet, Cleaning, Helpers
    Code NVARCHAR(50),
    Scheme NVARCHAR(100),
    Branch NVARCHAR(200),
    Company NVARCHAR(200),
    Role NVARCHAR(100),
    Shifts NVARCHAR(50),
    Remarks NVARCHAR(500),
    -- Extra fields for Cleaning category
    MachinesOwner NVARCHAR(200),
    MachineName NVARCHAR(200),
    CreatedBy NVARCHAR(100),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1
);

-- Monthly data for each entry (Count, Salary per month)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MasterTableMonthlyData')
CREATE TABLE MasterTableMonthlyData (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EntryId INT NOT NULL FOREIGN KEY REFERENCES MasterTableEntries(Id) ON DELETE CASCADE,
    Year INT NOT NULL,
    Month INT NOT NULL, -- 1-12
    StaffCount DECIMAL(10,2) DEFAULT 0,
    Salary DECIMAL(10,2) DEFAULT 0,
    -- TotalCost is calculated: Count * Salary
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_Entry_Year_Month UNIQUE (EntryId, Year, Month)
);

-- Track which months are active for the year (manual month addition)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MasterTableActiveMonths')
CREATE TABLE MasterTableActiveMonths (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Category NVARCHAR(50) NOT NULL, -- Security, Valet, Cleaning, Helpers
    Year INT NOT NULL,
    Month INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_Category_Year_Month UNIQUE (Category, Year, Month)
);

-- Form permission
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'MASTER_TABLE')
INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description)
VALUES ('MASTER_TABLE', 'Master Table', 'operational-excellence', '/operational-excellence/master-table', 'Third Party Staff Master Table Management');
