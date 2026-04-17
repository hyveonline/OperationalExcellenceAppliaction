const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };
const configLive = { server: 'localhost', database: 'OEApp_Live', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

(async () => {
    // UAT
    const pool = await sql.connect(config);
    
    // Check if Deadline column exists on SEC_InspectionItems
    const colCheck = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionItems' AND COLUMN_NAME='Deadline'");
    if (colCheck.recordset.length === 0) {
        await pool.request().query("ALTER TABLE SEC_InspectionItems ADD Deadline DATE NULL");
        console.log('UAT: Added Deadline column to SEC_InspectionItems');
    } else {
        console.log('UAT: Deadline column already exists');
    }
    
    // Check if SEC_FridgeReadings exists
    const tableCheck = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='SEC_FridgeReadings'");
    if (tableCheck.recordset.length === 0) {
        await pool.request().query(`
            CREATE TABLE SEC_FridgeReadings (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                InspectionId INT NOT NULL,
                FridgeNumber NVARCHAR(100),
                UnitTemp DECIMAL(5,2) NULL,
                DisplayTemp DECIMAL(5,2) NULL,
                ProbeTemp DECIMAL(5,2) NULL,
                Issue NVARCHAR(500) NULL,
                IsCompliant BIT DEFAULT 1,
                CreatedAt DATETIME DEFAULT GETDATE()
            )
        `);
        console.log('UAT: Created SEC_FridgeReadings table');
    } else {
        console.log('UAT: SEC_FridgeReadings already exists');
    }
    
    await pool.close();
    
    // LIVE
    const pool2 = await sql.connect(configLive);
    
    const colCheck2 = await pool2.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionItems' AND COLUMN_NAME='Deadline'");
    if (colCheck2.recordset.length === 0) {
        await pool2.request().query("ALTER TABLE SEC_InspectionItems ADD Deadline DATE NULL");
        console.log('LIVE: Added Deadline column to SEC_InspectionItems');
    } else {
        console.log('LIVE: Deadline column already exists');
    }
    
    const tableCheck2 = await pool2.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='SEC_FridgeReadings'");
    if (tableCheck2.recordset.length === 0) {
        await pool2.request().query(`
            CREATE TABLE SEC_FridgeReadings (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                InspectionId INT NOT NULL,
                FridgeNumber NVARCHAR(100),
                UnitTemp DECIMAL(5,2) NULL,
                DisplayTemp DECIMAL(5,2) NULL,
                ProbeTemp DECIMAL(5,2) NULL,
                Issue NVARCHAR(500) NULL,
                IsCompliant BIT DEFAULT 1,
                CreatedAt DATETIME DEFAULT GETDATE()
            )
        `);
        console.log('LIVE: Created SEC_FridgeReadings table');
    } else {
        console.log('LIVE: SEC_FridgeReadings already exists');
    }
    
    await pool2.close();
})().catch(e => console.error(e.message));
