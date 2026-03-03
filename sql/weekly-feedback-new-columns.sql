-- Weekly Third Party Feedback - Add new columns for expanded form
-- Run on both UAT and Live databases

-- Cleaning Company
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleaningCompany')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleaningCompany NVARCHAR(100);

-- Number of Cleaners
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'NumberOfCleaners')
    ALTER TABLE WeeklyThirdPartyFeedback ADD NumberOfCleaners INT;

-- Cleaners adherence to schedule
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleanersAdherenceToSchedule')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleanersAdherenceToSchedule BIT;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleanersAdherenceComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleanersAdherenceComments NVARCHAR(MAX);

-- Cleaners with uniforms
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleanersWithUniforms')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleanersWithUniforms BIT;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleanersUniformComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleanersUniformComments NVARCHAR(MAX);

-- Cleaners personal hygiene
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleanersPersonalHygiene')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleanersPersonalHygiene BIT;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleanersHygieneComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleanersHygieneComments NVARCHAR(MAX);

-- Deep cleaning performed
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'DeepCleaningPerformed')
    ALTER TABLE WeeklyThirdPartyFeedback ADD DeepCleaningPerformed BIT;

-- Cleaning team abiding by checklist
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleaningTeamAbidingChecklist')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleaningTeamAbidingChecklist BIT;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleaningChecklistComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleaningChecklistComments NVARCHAR(MAX);

-- Cleaning Machine Available
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleaningMachineAvailable')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleaningMachineAvailable BIT;

-- Number of Cleaning Machines
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'NumberOfCleaningMachines')
    ALTER TABLE WeeklyThirdPartyFeedback ADD NumberOfCleaningMachines INT;

-- Cleaning Machine Operational
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleaningMachineOperational')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleaningMachineOperational BIT;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'CleaningMachineComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD CleaningMachineComments NVARCHAR(MAX);

-- General Comments about Cleaning
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'GeneralCleaningComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD GeneralCleaningComments NVARCHAR(MAX);

-- QC Team visiting regularly
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'QCTeamVisitingRegularly')
    ALTER TABLE WeeklyThirdPartyFeedback ADD QCTeamVisitingRegularly BIT;

-- How often QC team visits
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'QCTeamVisitFrequency')
    ALTER TABLE WeeklyThirdPartyFeedback ADD QCTeamVisitFrequency NVARCHAR(200);

-- Response Time Rating (star rating 1-5)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'ResponseTimeRating')
    ALTER TABLE WeeklyThirdPartyFeedback ADD ResponseTimeRating INT;

-- Store Cleanliness Rating (already exists as CleanlinessRating, but keeping for clarity)

-- Porter Services Available
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'PorterServicesAvailable')
    ALTER TABLE WeeklyThirdPartyFeedback ADD PorterServicesAvailable BIT;

-- Porter count available as per schedule
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'PorterCountAsPerSchedule')
    ALTER TABLE WeeklyThirdPartyFeedback ADD PorterCountAsPerSchedule BIT;

-- Porters abiding by schedule
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'PortersAbidingBySchedule')
    ALTER TABLE WeeklyThirdPartyFeedback ADD PortersAbidingBySchedule BIT;

-- Porters with uniforms
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'PortersWithUniforms')
    ALTER TABLE WeeklyThirdPartyFeedback ADD PortersWithUniforms BIT;

-- Porters personal hygiene
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'PortersPersonalHygiene')
    ALTER TABLE WeeklyThirdPartyFeedback ADD PortersPersonalHygiene BIT;

-- Porter Services Comments
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' AND COLUMN_NAME = 'PorterServicesComments')
    ALTER TABLE WeeklyThirdPartyFeedback ADD PorterServicesComments NVARCHAR(MAX);

PRINT 'All columns added successfully!';
