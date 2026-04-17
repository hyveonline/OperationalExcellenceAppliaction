const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };
const configLive = { server: 'localhost', database: 'OEApp_Live', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

// All columns referenced in index.js for each SEC_ table
const requiredColumns = {
    'SEC_Inspections': [
        { name: 'Id', type: 'INT IDENTITY(1,1) PRIMARY KEY' },
        { name: 'DocumentNumber', type: 'NVARCHAR(50)' },
        { name: 'StoreId', type: 'INT' },
        { name: 'StoreName', type: 'NVARCHAR(200)' },
        { name: 'InspectionDate', type: 'DATE' },
        { name: 'TimeIn', type: 'NVARCHAR(20) NULL' },
        { name: 'TimeOut', type: 'NVARCHAR(20) NULL' },
        { name: 'Inspectors', type: 'NVARCHAR(500) NULL' },
        { name: 'AccompaniedBy', type: 'NVARCHAR(500) NULL' },
        { name: 'Cycle', type: 'NVARCHAR(50) NULL' },
        { name: 'Year', type: 'INT NULL' },
        { name: 'Status', type: 'NVARCHAR(50) DEFAULT \'Draft\'' },
        { name: 'Score', type: 'DECIMAL(5,2) NULL' },
        { name: 'TotalPoints', type: 'DECIMAL(10,2) NULL' },
        { name: 'MaxPoints', type: 'DECIMAL(10,2) NULL' },
        { name: 'Comments', type: 'NVARCHAR(MAX) NULL' },
        { name: 'TemplateId', type: 'INT NULL' },
        { name: 'CreatedBy', type: 'INT NULL' },
        { name: 'CreatedAt', type: 'DATETIME DEFAULT GETDATE()' },
        { name: 'UpdatedAt', type: 'DATETIME NULL' },
        { name: 'CompletedAt', type: 'DATETIME NULL' },
        { name: 'ApprovedBy', type: 'INT NULL' },
        { name: 'ApprovedAt', type: 'DATETIME NULL' },
        { name: 'ReportGeneratedAt', type: 'DATETIME NULL' },
        { name: 'ReportPath', type: 'NVARCHAR(500) NULL' }
    ],
    'SEC_InspectionSections': [
        { name: 'Id', type: 'INT IDENTITY(1,1) PRIMARY KEY' },
        { name: 'InspectionId', type: 'INT NOT NULL' },
        { name: 'SectionName', type: 'NVARCHAR(200)' },
        { name: 'SectionIcon', type: 'NVARCHAR(20) NULL' },
        { name: 'SectionOrder', type: 'INT DEFAULT 0' },
        { name: 'Score', type: 'DECIMAL(5,2) NULL' },
        { name: 'TotalPoints', type: 'DECIMAL(10,2) NULL' },
        { name: 'MaxPoints', type: 'DECIMAL(10,2) NULL' }
    ],
    'SEC_InspectionItems': [
        { name: 'Deadline', type: 'DATE NULL' }
        // Already checked the rest
    ],
    'SEC_InspectionPictures': [
        { name: 'Id', type: 'INT IDENTITY(1,1) PRIMARY KEY' },
        { name: 'ItemId', type: 'INT' },
        { name: 'InspectionId', type: 'INT' },
        { name: 'FileName', type: 'NVARCHAR(500)' },
        { name: 'OriginalName', type: 'NVARCHAR(500) NULL' },
        { name: 'ContentType', type: 'NVARCHAR(100) NULL' },
        { name: 'PictureType', type: 'NVARCHAR(50) NULL' },
        { name: 'FilePath', type: 'NVARCHAR(500) NULL' },
        { name: 'FileSize', type: 'INT NULL' },
        { name: 'CreatedAt', type: 'DATETIME DEFAULT GETDATE()' }
    ]
};

async function fix(pool, label) {
    // Get all SEC_ tables
    const tablesResult = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'SEC_%' ORDER BY TABLE_NAME");
    console.log(`\n${label} existing SEC_ tables:`, tablesResult.recordset.map(t => t.TABLE_NAME).join(', '));
    
    let added = 0;
    for (const [table, columns] of Object.entries(requiredColumns)) {
        // Check if table exists
        const tableExists = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='${table}'`);
        if (tableExists.recordset.length === 0) {
            console.log(`${label}: TABLE ${table} DOES NOT EXIST - skipping`);
            continue;
        }
        
        // Get existing columns
        const existingCols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}'`);
        const existingSet = new Set(existingCols.recordset.map(c => c.COLUMN_NAME));
        
        for (const col of columns) {
            if (col.type.includes('IDENTITY') || col.type.includes('PRIMARY KEY')) continue; // Skip identity columns
            if (!existingSet.has(col.name)) {
                // For ALTER TABLE, strip DEFAULT and NOT NULL constraints for simplicity
                let alterType = col.type.replace('NOT NULL', 'NULL');
                try {
                    await pool.request().query(`ALTER TABLE ${table} ADD [${col.name}] ${alterType}`);
                    console.log(`${label}: Added ${col.name} (${alterType}) to ${table}`);
                    added++;
                } catch (e) {
                    console.log(`${label}: FAILED to add ${col.name} to ${table}: ${e.message}`);
                }
            }
        }
    }
    
    if (added === 0) console.log(`${label}: All columns are up to date!`);
    return added;
}

(async () => {
    const pool = await sql.connect(config);
    await fix(pool, 'UAT');
    await pool.close();
    
    const pool2 = await sql.connect(configLive);
    await fix(pool2, 'LIVE');
    await pool2.close();
    
    console.log('\nDone');
})().catch(e => console.error(e.message));
