-- =====================================================
-- Daily Tasks Management Tables
-- For Multi-Zone Team and Fixed Area Team task tracking
-- =====================================================

-- Team Types (Multi-Zone, Fixed Area)
CREATE TABLE DailyTask_TeamTypes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TeamTypeName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    AgentCount INT DEFAULT 4,
    IsActive BIT DEFAULT 1,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL
);

-- Insert default team types
INSERT INTO DailyTask_TeamTypes (TeamTypeName, Description, AgentCount, SortOrder) VALUES
('Multi-Zone Team', 'Team that rotates across multiple zones based on time slots', 4, 1),
('Fixed Area Team', 'Team assigned to fixed areas with daily task checklists', 8, 2);
GO

-- Time Slots (for Multi-Zone Team schedule)
CREATE TABLE DailyTask_TimeSlots (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SlotName NVARCHAR(100) NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    Description NVARCHAR(200) NULL,
    IsBreak BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Insert default time slots for Multi-Zone Team
INSERT INTO DailyTask_TimeSlots (SlotName, StartTime, EndTime, Description, IsBreak, SortOrder) VALUES
('7AM to 10AM', '07:00', '10:00', 'Offices and Glasses', 0, 1),
('10AM to 12PM', '10:00', '12:00', 'Morning Tasks', 0, 2),
('12PM to 1PM', '12:00', '13:00', 'Break', 1, 3),
('1PM to 3:30PM', '13:00', '15:30', 'Afternoon Tasks', 0, 4),
('3:30PM to 4PM', '15:30', '16:00', 'End of Day Tasks', 0, 5);
GO

-- Task Items (reusable task types for Fixed Area Team)
CREATE TABLE DailyTask_TaskItems (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TaskName NVARCHAR(200) NOT NULL,
    TaskDescription NVARCHAR(500) NULL,
    TaskIcon NVARCHAR(10) NULL,
    IsActive BIT DEFAULT 1,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Insert default task items for Fixed Area Team
INSERT INTO DailyTask_TaskItems (TaskName, TaskDescription, TaskIcon, SortOrder) VALUES
('Trash Bins', 'Empty and clean trash bins', '🗑️', 1),
('Soap Dispenser', 'Refill soap dispensers', '🧴', 2),
('Napkins Dispenser', 'Refill napkin/tissue dispensers', '🧻', 3),
('Offices', 'Clean and organize office spaces', '🏢', 4),
('Closets/Ground/Wall/Glass', 'Clean closets, floors, walls, and glass surfaces', '🧹', 5),
('Canteen', 'Clean and sanitize canteen area', '🍽️', 6),
('Toilets and Kitchens', 'Clean and sanitize toilets and kitchen areas', '🚻', 7);
GO

-- Zones/Areas (HR, Finance, Commercial, NokNok, Development, etc.)
CREATE TABLE DailyTask_Zones (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TeamTypeId INT NOT NULL,
    ZoneName NVARCHAR(200) NOT NULL,
    ZoneDescription NVARCHAR(500) NULL,
    AgentCount INT DEFAULT 1,
    IsActive BIT DEFAULT 1,
    SortOrder INT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Zones_TeamType FOREIGN KEY (TeamTypeId) REFERENCES DailyTask_TeamTypes(Id)
);

CREATE INDEX IX_DailyTask_Zones_TeamType ON DailyTask_Zones(TeamTypeId);

-- Insert default zones for Multi-Zone Team (TeamTypeId = 1)
INSERT INTO DailyTask_Zones (TeamTypeId, ZoneName, ZoneDescription, AgentCount, SortOrder) VALUES
(1, 'Finance', 'Finance Department Zone', 1, 1),
(1, 'HR', 'Human Resources Department Zone', 1, 2),
(1, 'Commercial', 'Commercial Department Zone', 1, 3),
(1, 'NokNok', 'NokNok Area Zone', 1, 4),
(1, 'Development', 'Development Department Zone', 1, 5);

-- Insert default zones for Fixed Area Team (TeamTypeId = 2)
INSERT INTO DailyTask_Zones (TeamTypeId, ZoneName, ZoneDescription, AgentCount, SortOrder) VALUES
(2, 'HR', 'Human Resources Area', 1, 1),
(2, 'Finance', 'Finance Area', 2, 2),
(2, 'Commercial', 'Commercial Area', 1, 3),
(2, 'NokNok And Meeting Rooms', 'NokNok and Meeting Rooms Area', 1, 4),
(2, '2nd Floor Kitchen and Toilets', 'Second Floor Kitchen and Toilets', 2, 5),
(2, 'Development / Commercial Entrance / Hallway / Commercial Guests Toilets', 'Development and Commercial Entrance Areas', 1, 6);
GO

-- Zone Task Mapping (which tasks apply to which zones - for Fixed Area Team)
-- IsApplicable = 1 means task is applicable, 0 means N/A (shown grayed out)
CREATE TABLE DailyTask_ZoneTaskMapping (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ZoneId INT NOT NULL,
    TaskItemId INT NOT NULL,
    IsApplicable BIT DEFAULT 1,
    Notes NVARCHAR(200) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_ZoneTaskMapping_Zone FOREIGN KEY (ZoneId) REFERENCES DailyTask_Zones(Id),
    CONSTRAINT FK_ZoneTaskMapping_TaskItem FOREIGN KEY (TaskItemId) REFERENCES DailyTask_TaskItems(Id),
    CONSTRAINT UQ_ZoneTaskMapping UNIQUE (ZoneId, TaskItemId)
);

CREATE INDEX IX_DailyTask_ZoneTaskMapping_Zone ON DailyTask_ZoneTaskMapping(ZoneId);
GO

-- Insert default zone-task mappings for Fixed Area Team zones
-- Get Fixed Area zones and create mappings
DECLARE @ZoneId INT, @TaskItemId INT;

-- HR (all tasks applicable)
SELECT @ZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'HR' AND TeamTypeId = 2;
INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
SELECT @ZoneId, Id, 1 FROM DailyTask_TaskItems;

-- Finance (all tasks applicable)
SELECT @ZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'Finance' AND TeamTypeId = 2;
INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
SELECT @ZoneId, Id, 1 FROM DailyTask_TaskItems;

-- Commercial (Soap Dispenser and Napkins Dispenser are N/A)
SELECT @ZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'Commercial' AND TeamTypeId = 2;
INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
SELECT @ZoneId, Id, CASE WHEN TaskName IN ('Soap Dispenser', 'Napkins Dispenser') THEN 0 ELSE 1 END 
FROM DailyTask_TaskItems;

-- NokNok And Meeting Rooms (Soap, Napkins, Canteen, Toilets are N/A)
SELECT @ZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'NokNok And Meeting Rooms' AND TeamTypeId = 2;
INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
SELECT @ZoneId, Id, CASE WHEN TaskName IN ('Soap Dispenser', 'Napkins Dispenser', 'Canteen', 'Toilets and Kitchens') THEN 0 ELSE 1 END 
FROM DailyTask_TaskItems;

-- 2nd Floor Kitchen and Toilets (Offices is N/A)
SELECT @ZoneId = Id FROM DailyTask_Zones WHERE ZoneName = '2nd Floor Kitchen and Toilets' AND TeamTypeId = 2;
INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
SELECT @ZoneId, Id, CASE WHEN TaskName = 'Offices' THEN 0 ELSE 1 END 
FROM DailyTask_TaskItems;

-- Development / Commercial Entrance (Canteen is N/A)
SELECT @ZoneId = Id FROM DailyTask_Zones WHERE ZoneName LIKE 'Development / Commercial%' AND TeamTypeId = 2;
INSERT INTO DailyTask_ZoneTaskMapping (ZoneId, TaskItemId, IsApplicable)
SELECT @ZoneId, Id, CASE WHEN TaskName = 'Canteen' THEN 0 ELSE 1 END 
FROM DailyTask_TaskItems;
GO

-- Zone Time Slot Tasks (for Multi-Zone Team - task descriptions per zone and time slot)
CREATE TABLE DailyTask_ZoneTimeSlotTasks (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ZoneId INT NOT NULL,
    TimeSlotId INT NOT NULL,
    TaskDescription NVARCHAR(500) NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_ZoneTimeSlotTasks_Zone FOREIGN KEY (ZoneId) REFERENCES DailyTask_Zones(Id),
    CONSTRAINT FK_ZoneTimeSlotTasks_TimeSlot FOREIGN KEY (TimeSlotId) REFERENCES DailyTask_TimeSlots(Id),
    CONSTRAINT UQ_ZoneTimeSlotTasks UNIQUE (ZoneId, TimeSlotId)
);

CREATE INDEX IX_DailyTask_ZoneTimeSlotTasks_Zone ON DailyTask_ZoneTimeSlotTasks(ZoneId);
GO

-- Insert default time slot tasks for Multi-Zone zones
DECLARE @FinanceZoneId INT, @HRZoneId INT, @CommercialZoneId INT, @NokNokZoneId INT, @DevZoneId INT;
DECLARE @Slot1 INT, @Slot2 INT, @Slot3 INT, @Slot4 INT, @Slot5 INT;

SELECT @FinanceZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'Finance' AND TeamTypeId = 1;
SELECT @HRZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'HR' AND TeamTypeId = 1;
SELECT @CommercialZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'Commercial' AND TeamTypeId = 1;
SELECT @NokNokZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'NokNok' AND TeamTypeId = 1;
SELECT @DevZoneId = Id FROM DailyTask_Zones WHERE ZoneName = 'Development' AND TeamTypeId = 1;

SELECT @Slot1 = Id FROM DailyTask_TimeSlots WHERE SlotName = '7AM to 10AM';
SELECT @Slot2 = Id FROM DailyTask_TimeSlots WHERE SlotName = '10AM to 12PM';
SELECT @Slot3 = Id FROM DailyTask_TimeSlots WHERE SlotName = '12PM to 1PM';
SELECT @Slot4 = Id FROM DailyTask_TimeSlots WHERE SlotName = '1PM to 3:30PM';
SELECT @Slot5 = Id FROM DailyTask_TimeSlots WHERE SlotName = '3:30PM to 4PM';

-- Finance Zone tasks
INSERT INTO DailyTask_ZoneTimeSlotTasks (ZoneId, TimeSlotId, TaskDescription) VALUES
(@FinanceZoneId, @Slot1, 'Offices and Glasses'),
(@FinanceZoneId, @Slot2, '3rd Floor Finance Canteen and Balcony'),
(@FinanceZoneId, @Slot3, 'Break'),
(@FinanceZoneId, @Slot4, 'One sides stairs and elevators Finance side'),
(@FinanceZoneId, @Slot5, 'Empty The Trash Bins');

-- HR Zone tasks
INSERT INTO DailyTask_ZoneTimeSlotTasks (ZoneId, TimeSlotId, TaskDescription) VALUES
(@HRZoneId, @Slot1, 'Offices and Glasses'),
(@HRZoneId, @Slot2, '3rd Floor HR Canteen and Balcony'),
(@HRZoneId, @Slot3, 'Break'),
(@HRZoneId, @Slot4, 'One sides stairs and elevators HR side'),
(@HRZoneId, @Slot5, 'Empty The Trash Bins');

-- Commercial Zone tasks
INSERT INTO DailyTask_ZoneTimeSlotTasks (ZoneId, TimeSlotId, TaskDescription) VALUES
(@CommercialZoneId, @Slot1, 'Offices and Glasses'),
(@CommercialZoneId, @Slot2, '2nd Floor Entrance to the corner side'),
(@CommercialZoneId, @Slot3, 'Break'),
(@CommercialZoneId, @Slot4, 'Basement 1 Entrance to the corner side'),
(@CommercialZoneId, @Slot5, 'Empty The Trash Bins');

-- NokNok Zone tasks
INSERT INTO DailyTask_ZoneTimeSlotTasks (ZoneId, TimeSlotId, TaskDescription) VALUES
(@NokNokZoneId, @Slot1, 'Offices and Glasses'),
(@NokNokZoneId, @Slot2, 'Basement 2 Hallway and Control Room'),
(@NokNokZoneId, @Slot3, 'Break'),
(@NokNokZoneId, @Slot4, '2nd Floor Entrance Facade'),
(@NokNokZoneId, @Slot5, 'Empty The Trash Bins');

-- Development Zone tasks
INSERT INTO DailyTask_ZoneTimeSlotTasks (ZoneId, TimeSlotId, TaskDescription) VALUES
(@DevZoneId, @Slot1, 'Offices and Glasses'),
(@DevZoneId, @Slot2, 'Basement 3 Parking'),
(@DevZoneId, @Slot3, 'Break'),
(@DevZoneId, @Slot4, 'Basement 4 Parking'),
(@DevZoneId, @Slot5, 'Empty The Trash Bins');
GO

-- Agent Assignments (pre-assign agents/users to zones)
CREATE TABLE DailyTask_AgentAssignments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ZoneId INT NOT NULL,
    UserId INT NOT NULL,
    AssignedBy INT NULL,
    AssignedAt DATETIME DEFAULT GETDATE(),
    IsActive BIT DEFAULT 1,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_AgentAssignments_Zone FOREIGN KEY (ZoneId) REFERENCES DailyTask_Zones(Id),
    CONSTRAINT FK_AgentAssignments_User FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_AgentAssignments_AssignedBy FOREIGN KEY (AssignedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_DailyTask_AgentAssignments_Zone ON DailyTask_AgentAssignments(ZoneId);
CREATE INDEX IX_DailyTask_AgentAssignments_User ON DailyTask_AgentAssignments(UserId);
GO

-- Daily Task Entries (one shared entry per zone per date range)
CREATE TABLE DailyTask_Entries (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ZoneId INT NOT NULL,
    TeamTypeId INT NOT NULL,
    DateFrom DATE NOT NULL,
    DateTo DATE NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Active',
    CreatedById INT NULL,
    CreatedByName NVARCHAR(200) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Entries_Zone FOREIGN KEY (ZoneId) REFERENCES DailyTask_Zones(Id),
    CONSTRAINT FK_Entries_TeamType FOREIGN KEY (TeamTypeId) REFERENCES DailyTask_TeamTypes(Id),
    CONSTRAINT FK_Entries_CreatedBy FOREIGN KEY (CreatedById) REFERENCES Users(Id)
);

CREATE INDEX IX_DailyTask_Entries_Zone ON DailyTask_Entries(ZoneId);
CREATE INDEX IX_DailyTask_Entries_Dates ON DailyTask_Entries(DateFrom, DateTo);
GO

-- Entry Details for Fixed Area Team (task item completions)
CREATE TABLE DailyTask_EntryDetails_FixedArea (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EntryId INT NOT NULL,
    TaskItemId INT NOT NULL,
    DayOfWeek INT NOT NULL, -- 1=Monday, 2=Tuesday, etc.
    IsCompleted BIT DEFAULT 0,
    CompletedById INT NULL,
    CompletedByName NVARCHAR(200) NULL,
    CompletedAt DATETIME NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_EntryDetailsFixed_Entry FOREIGN KEY (EntryId) REFERENCES DailyTask_Entries(Id),
    CONSTRAINT FK_EntryDetailsFixed_TaskItem FOREIGN KEY (TaskItemId) REFERENCES DailyTask_TaskItems(Id),
    CONSTRAINT FK_EntryDetailsFixed_CompletedBy FOREIGN KEY (CompletedById) REFERENCES Users(Id)
);

CREATE INDEX IX_DailyTask_EntryDetailsFixed_Entry ON DailyTask_EntryDetails_FixedArea(EntryId);
GO

-- Entry Details for Multi-Zone Team (time slot completions)
CREATE TABLE DailyTask_EntryDetails_MultiZone (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EntryId INT NOT NULL,
    TimeSlotId INT NOT NULL,
    TaskDate DATE NOT NULL,
    IsCompleted BIT DEFAULT 0,
    CompletedById INT NULL,
    CompletedByName NVARCHAR(200) NULL,
    CompletedAt DATETIME NULL,
    Notes NVARCHAR(500) NULL,
    CONSTRAINT FK_EntryDetailsMulti_Entry FOREIGN KEY (EntryId) REFERENCES DailyTask_Entries(Id),
    CONSTRAINT FK_EntryDetailsMulti_TimeSlot FOREIGN KEY (TimeSlotId) REFERENCES DailyTask_TimeSlots(Id),
    CONSTRAINT FK_EntryDetailsMulti_CompletedBy FOREIGN KEY (CompletedById) REFERENCES Users(Id)
);

CREATE INDEX IX_DailyTask_EntryDetailsMulti_Entry ON DailyTask_EntryDetails_MultiZone(EntryId);
CREATE INDEX IX_DailyTask_EntryDetailsMulti_Date ON DailyTask_EntryDetails_MultiZone(TaskDate);
GO

-- =====================================================
-- Views for easier querying
-- =====================================================

-- View: Multi-Zone Team Schedule
CREATE VIEW vw_DailyTask_MultiZoneSchedule AS
SELECT 
    z.Id AS ZoneId,
    z.ZoneName,
    z.AgentCount,
    ts.Id AS TimeSlotId,
    ts.SlotName,
    ts.StartTime,
    ts.EndTime,
    ts.IsBreak,
    ztst.TaskDescription,
    tt.TeamTypeName
FROM DailyTask_Zones z
JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
LEFT JOIN DailyTask_ZoneTimeSlotTasks ztst ON z.Id = ztst.ZoneId
LEFT JOIN DailyTask_TimeSlots ts ON ztst.TimeSlotId = ts.Id
WHERE z.TeamTypeId = 1 AND z.IsActive = 1
GO

-- View: Fixed Area Team Task Matrix
CREATE VIEW vw_DailyTask_FixedAreaMatrix AS
SELECT 
    z.Id AS ZoneId,
    z.ZoneName,
    z.AgentCount,
    ti.Id AS TaskItemId,
    ti.TaskName,
    ti.TaskIcon,
    ISNULL(ztm.IsApplicable, 1) AS IsApplicable,
    tt.TeamTypeName
FROM DailyTask_Zones z
JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
CROSS JOIN DailyTask_TaskItems ti
LEFT JOIN DailyTask_ZoneTaskMapping ztm ON z.Id = ztm.ZoneId AND ti.Id = ztm.TaskItemId
WHERE z.TeamTypeId = 2 AND z.IsActive = 1 AND ti.IsActive = 1
GO

-- View: Agent Zone Assignments with details
CREATE VIEW vw_DailyTask_AgentAssignments AS
SELECT 
    aa.Id,
    aa.ZoneId,
    z.ZoneName,
    z.AgentCount AS ExpectedAgents,
    tt.Id AS TeamTypeId,
    tt.TeamTypeName,
    aa.UserId,
    u.DisplayName AS AgentName,
    u.Email AS AgentEmail,
    aa.IsActive,
    aa.AssignedAt
FROM DailyTask_AgentAssignments aa
JOIN DailyTask_Zones z ON aa.ZoneId = z.Id
JOIN DailyTask_TeamTypes tt ON z.TeamTypeId = tt.Id
JOIN Users u ON aa.UserId = u.Id
WHERE aa.IsActive = 1
GO

PRINT 'Daily Tasks tables created successfully!';
