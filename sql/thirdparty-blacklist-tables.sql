-- Third Party Blacklisted Staff Tables for Security Department
-- Created: 2026-02-26

-- Main Blacklist Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ThirdPartyBlacklist')
BEGIN
    CREATE TABLE ThirdPartyBlacklist (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Role NVARCHAR(50) NOT NULL, -- Security, Cleaner, Helper, Porter, Valet
        StoreId INT,
        Company NVARCHAR(100), -- Assiyana, Bright, C-Plus, Tandeef, Protectron, I-Secure, Middle East, Forearms, Valet Peak, VPS, Uptown
        EmployeeName NVARCHAR(200) NOT NULL,
        PhoneNumber NVARCHAR(50),
        IncidentDate DATE,
        IncidentDetails NVARCHAR(MAX),
        PunchingMachineId NVARCHAR(100),
        PicturePath NVARCHAR(500),
        ReportedBy INT,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME,
        FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        FOREIGN KEY (ReportedBy) REFERENCES Users(Id)
    );
    PRINT 'Created ThirdPartyBlacklist table';
END
GO

-- Add form permission
IF NOT EXISTS (SELECT * FROM Forms WHERE Code = 'THIRDPARTY_BLACKLIST')
BEGIN
    INSERT INTO Forms (Code, Name, Description, Module, IsActive)
    VALUES ('THIRDPARTY_BLACKLIST', 'Third Party Blacklist', 'Third party blacklisted staff management', 'security-emp', 1);
    PRINT 'Added THIRDPARTY_BLACKLIST form permission';
END
GO

PRINT 'Third Party Blacklist tables setup complete';
