const sql = require('mssql');
const config = { server: 'localhost', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run(db) {
    const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();

    // 1. Create Categories table
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionTemplateCategories')
        CREATE TABLE SEC_InspectionTemplateCategories (
            Id INT PRIMARY KEY IDENTITY(1,1),
            SectionId INT NOT NULL,
            CategoryName NVARCHAR(200) NOT NULL,
            CategoryOrder INT DEFAULT 0,
            IsActive BIT DEFAULT 1,
            FOREIGN KEY (SectionId) REFERENCES SEC_InspectionTemplateSections(Id) ON DELETE CASCADE
        )
    `);
    console.log(db + ': SEC_InspectionTemplateCategories created');

    // 2. Add CategoryId and SubCategory to template items
    const cols = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'SEC_InspectionTemplateItems'
    `);
    const colNames = cols.recordset.map(c => c.COLUMN_NAME);

    if (!colNames.includes('CategoryId')) {
        await pool.request().query(`
            ALTER TABLE SEC_InspectionTemplateItems ADD CategoryId INT NULL
        `);
        console.log(db + ': Added CategoryId to template items');
    }

    if (!colNames.includes('SubCategory')) {
        await pool.request().query(`
            ALTER TABLE SEC_InspectionTemplateItems ADD SubCategory NVARCHAR(200) NULL
        `);
        console.log(db + ': Added SubCategory to template items');
    }

    // 3. Add CategoryId and SubCategory to runtime inspection items
    const inspCols = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'SEC_InspectionItems'
    `);
    const inspColNames = inspCols.recordset.map(c => c.COLUMN_NAME);

    if (!inspColNames.includes('CategoryId')) {
        await pool.request().query(`ALTER TABLE SEC_InspectionItems ADD CategoryId INT NULL`);
    }
    if (!inspColNames.includes('CategoryName')) {
        await pool.request().query(`ALTER TABLE SEC_InspectionItems ADD CategoryName NVARCHAR(200) NULL`);
    }
    if (!inspColNames.includes('SubCategory')) {
        await pool.request().query(`ALTER TABLE SEC_InspectionItems ADD SubCategory NVARCHAR(200) NULL`);
    }
    console.log(db + ': Updated SEC_InspectionItems');

    // 4. Add Categories table for runtime inspection sections
    await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SEC_InspectionCategories')
        CREATE TABLE SEC_InspectionCategories (
            Id INT PRIMARY KEY IDENTITY(1,1),
            InspectionId INT NOT NULL,
            SectionId INT NOT NULL,
            CategoryName NVARCHAR(200) NOT NULL,
            CategoryOrder INT DEFAULT 0,
            TotalPoints DECIMAL(10,2),
            MaxPoints DECIMAL(10,2),
            Score DECIMAL(5,2),
            FOREIGN KEY (InspectionId) REFERENCES SEC_Inspections(Id) ON DELETE CASCADE
        )
    `);
    console.log(db + ': SEC_InspectionCategories created');

    await pool.close();
}

(async () => {
    await run('OEApp_UAT');
    await run('OEApp_Live');
    console.log('Done!');
})().catch(e => { console.error(e); process.exit(1); });
