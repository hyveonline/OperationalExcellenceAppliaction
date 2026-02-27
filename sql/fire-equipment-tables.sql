-- Fire Fighting Equipment Register Tables
-- Run on both UAT and Live databases

-- 1. Equipment Types Master List (Admin configurable)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FireEquipmentTypes')
CREATE TABLE FireEquipmentTypes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TypeName NVARCHAR(100) NOT NULL,
    TypeCode NVARCHAR(50),
    Description NVARCHAR(500),
    DefaultWeight NVARCHAR(50),
    SortOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy INT
);

-- Insert default equipment types
IF NOT EXISTS (SELECT 1 FROM FireEquipmentTypes)
BEGIN
    INSERT INTO FireEquipmentTypes (TypeName, TypeCode, DefaultWeight, SortOrder) VALUES
    ('Powder Fire Extinguisher', 'POWDER', '6kg', 1),
    ('CO2 Fire Extinguisher', 'CO2', '2.3kg', 2),
    ('Automatic Fire Extinguisher', 'AUTO', '6kg', 3),
    ('Fire Hose Reel', 'HOSE_REEL', '-', 4),
    ('Manual Call Point', 'MCP', '-', 5),
    ('Trolley Fire Extinguisher', 'TROLLEY', '50kg', 6),
    ('Fire Blanket', 'BLANKET', '-', 7),
    ('FM200', 'FM200', '-', 8),
    ('UL300/WET Chemical', 'WET_CHEM', '22kg', 9),
    ('First Aid Kit', 'FIRST_AID', '-', 10);
END

-- 2. Equipment Registry per Store (Admin sets up predefined equipment for each store)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FireEquipmentRegistry')
CREATE TABLE FireEquipmentRegistry (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    StoreId INT NOT NULL,
    EquipmentTypeId INT FOREIGN KEY REFERENCES FireEquipmentTypes(Id),
    CustomTypeName NVARCHAR(100), -- If using custom type not in master list
    Location NVARCHAR(200) NOT NULL,
    Weight NVARCHAR(50),
    SortOrder INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy INT,
    UpdatedAt DATETIME DEFAULT GETDATE(),
    UpdatedBy INT
);

-- 3. Inspection Header (when user creates a new inspection)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FireEquipmentInspections')
CREATE TABLE FireEquipmentInspections (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    StoreId INT NOT NULL,
    InspectionDate DATE NOT NULL,
    InspectedBy INT NOT NULL,
    InspectorName NVARCHAR(200),
    Status NVARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Approved
    Remarks NVARCHAR(1000),
    CreatedAt DATETIME DEFAULT GETDATE(),
    SubmittedAt DATETIME,
    ApprovedAt DATETIME,
    ApprovedBy INT
);

-- 4. Inspection Details (results for each equipment)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FireEquipmentInspectionDetails')
CREATE TABLE FireEquipmentInspectionDetails (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InspectionId INT NOT NULL FOREIGN KEY REFERENCES FireEquipmentInspections(Id) ON DELETE CASCADE,
    RegistryId INT FOREIGN KEY REFERENCES FireEquipmentRegistry(Id), -- Links to predefined equipment
    EquipmentType NVARCHAR(100), -- Denormalized for history
    Location NVARCHAR(200),
    Weight NVARCHAR(50),
    Cleanliness NVARCHAR(10), -- Y, N, N/A
    CylinderIntegrity NVARCHAR(10), -- Y, N, N/A
    PressureGauge NVARCHAR(10), -- Y, N, N/A
    HoseCondition NVARCHAR(10), -- Y, N, N/A
    LastInspectionDate DATE,
    Remarks NVARCHAR(500),
    NeedsMaintenance BIT DEFAULT 0,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Create indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FireEquipmentRegistry_StoreId')
    CREATE INDEX IX_FireEquipmentRegistry_StoreId ON FireEquipmentRegistry(StoreId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FireEquipmentInspections_StoreId')
    CREATE INDEX IX_FireEquipmentInspections_StoreId ON FireEquipmentInspections(StoreId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FireEquipmentInspections_Date')
    CREATE INDEX IX_FireEquipmentInspections_Date ON FireEquipmentInspections(InspectionDate DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FireEquipmentInspectionDetails_InspectionId')
    CREATE INDEX IX_FireEquipmentInspectionDetails_InspectionId ON FireEquipmentInspectionDetails(InspectionId);

-- Form permission
IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'FIRE_EQUIPMENT')
INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description)
VALUES ('FIRE_EQUIPMENT', 'Fire Equipment Register', 'ohs', '/ohs/fire-equipment', 'Fire Fighting Equipment Inspection Register');

IF NOT EXISTS (SELECT 1 FROM Forms WHERE FormCode = 'FIRE_EQUIPMENT_ADMIN')
INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, Description)
VALUES ('FIRE_EQUIPMENT_ADMIN', 'Fire Equipment Admin', 'admin', '/admin/fire-equipment-setup', 'Fire Equipment Registry Setup and Configuration');

PRINT 'Fire Equipment tables created successfully';
