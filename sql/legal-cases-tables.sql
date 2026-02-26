-- Legal Cases Tables for Security Department
-- Created: 2026-02-26

-- Main Legal Cases Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LegalCases')
BEGIN
    CREATE TABLE LegalCases (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CaseType NVARCHAR(50) NOT NULL, -- Theft, Assault, Vandalism, Harassment, Other
        Description NVARCHAR(MAX),
        DateOfIssue DATE,
        AmountStolen DECIMAL(18,2),
        AmountReturned DECIMAL(18,2),
        Verdict NVARCHAR(MAX),
        Status NVARCHAR(50) DEFAULT 'New', -- New, In Progress, Closed
        CreatedBy INT,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME,
        FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
    PRINT 'Created LegalCases table';
END
GO

-- Stores linked to a Legal Case (many-to-many)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LegalCaseStores')
BEGIN
    CREATE TABLE LegalCaseStores (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LegalCaseId INT NOT NULL,
        StoreId INT NOT NULL,
        FOREIGN KEY (LegalCaseId) REFERENCES LegalCases(Id) ON DELETE CASCADE,
        FOREIGN KEY (StoreId) REFERENCES Stores(Id)
    );
    PRINT 'Created LegalCaseStores table';
END
GO

-- Updates/Comments log for Legal Cases (timestamped updates)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LegalCaseUpdates')
BEGIN
    CREATE TABLE LegalCaseUpdates (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        LegalCaseId INT NOT NULL,
        UpdateText NVARCHAR(MAX) NOT NULL,
        CreatedBy INT,
        CreatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (LegalCaseId) REFERENCES LegalCases(Id) ON DELETE CASCADE,
        FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
    PRINT 'Created LegalCaseUpdates table';
END
GO

-- Add form permission
IF NOT EXISTS (SELECT * FROM Forms WHERE Code = 'LEGAL_CASES')
BEGIN
    INSERT INTO Forms (Code, Name, Description, Module, IsActive)
    VALUES ('LEGAL_CASES', 'Legal Cases', 'Security legal cases management', 'security', 1);
    PRINT 'Added LEGAL_CASES form permission';
END
GO

PRINT 'Legal Cases tables setup complete';
