-- Add new fields to TheftIncidents table
-- Run this on both UAT and Live databases

-- 1. Add ThiefCaught field (Yes/No) - Required
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'TheftIncidents') AND name = 'ThiefCaught')
BEGIN
    ALTER TABLE TheftIncidents ADD ThiefCaught NVARCHAR(10) NULL;
    PRINT 'Added ThiefCaught column';
END

-- 2. Add Offense field (First offense / Repeated)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'TheftIncidents') AND name = 'Offense')
BEGIN
    ALTER TABLE TheftIncidents ADD Offense NVARCHAR(50) NULL;
    PRINT 'Added Offense column';
END

-- 3. Add separate currency fields for each value
-- Currency for Stolen Value
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'TheftIncidents') AND name = 'StolenValueCurrency')
BEGIN
    ALTER TABLE TheftIncidents ADD StolenValueCurrency NVARCHAR(10) DEFAULT 'USD';
    PRINT 'Added StolenValueCurrency column';
END

-- Currency for Value Collected  
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'TheftIncidents') AND name = 'ValueCollectedCurrency')
BEGIN
    ALTER TABLE TheftIncidents ADD ValueCollectedCurrency NVARCHAR(10) DEFAULT 'USD';
    PRINT 'Added ValueCollectedCurrency column';
END

-- Currency for Amount to HO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'TheftIncidents') AND name = 'AmountToHOCurrency')
BEGIN
    ALTER TABLE TheftIncidents ADD AmountToHOCurrency NVARCHAR(10) DEFAULT 'USD';
    PRINT 'Added AmountToHOCurrency column';
END

-- Migrate existing Currency values to new fields (for existing records)
UPDATE TheftIncidents 
SET StolenValueCurrency = ISNULL(Currency, 'USD'),
    ValueCollectedCurrency = ISNULL(Currency, 'USD'),
    AmountToHOCurrency = ISNULL(Currency, 'USD')
WHERE StolenValueCurrency IS NULL OR ValueCollectedCurrency IS NULL OR AmountToHOCurrency IS NULL;

PRINT 'Migration complete - new fields added to TheftIncidents table';
