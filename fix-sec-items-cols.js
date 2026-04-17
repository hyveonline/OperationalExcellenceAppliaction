const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };
const configLive = { server: 'localhost', database: 'OEApp_Live', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

const alterSQL = `
    ALTER TABLE SEC_InspectionItems ADD 
        Quantity INT NULL,
        ActualQuantity INT NULL,
        DefaultSeverity NVARCHAR(50) NULL,
        IsQuantitative BIT DEFAULT 0,
        Range1From INT NULL,
        Range1To INT NULL,
        Range2From INT NULL,
        Range2To INT NULL,
        Range3From INT NULL,
        MaintenanceWRNumber NVARCHAR(100) NULL,
        SentToMaintenance BIT DEFAULT 0
`;

(async () => {
    // UAT
    const pool = await sql.connect(config);
    await pool.request().query(alterSQL);
    console.log('UAT: Added missing columns to SEC_InspectionItems');
    await pool.close();
    
    // LIVE
    const pool2 = await sql.connect(configLive);
    await pool2.request().query(alterSQL);
    console.log('LIVE: Added missing columns to SEC_InspectionItems');
    await pool2.close();
})().catch(e => console.error(e.message));
