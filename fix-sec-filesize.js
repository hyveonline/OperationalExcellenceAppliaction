const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };
const configLive = { server: 'localhost', database: 'OEApp_Live', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

const tables = ['SEC_InspectionPictures', 'SEC_InspectionGallery', 'SEC_InspectionGalleryLinks'];

async function fix(pool, label) {
    for (const table of tables) {
        const exists = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='${table}'`);
        if (exists.recordset.length === 0) {
            console.log(`${label}: ${table} does not exist - skipping`);
            continue;
        }
        const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}'`);
        console.log(`${label}: ${table} columns: ${cols.recordset.map(c => c.COLUMN_NAME).join(', ')}`);
    }
    
    // Check and add FileSize to SEC_InspectionPictures
    const picCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionPictures' AND COLUMN_NAME='FileSize'");
    if (picCols.recordset.length === 0) {
        await pool.request().query("ALTER TABLE SEC_InspectionPictures ADD FileSize INT NULL");
        console.log(`${label}: Added FileSize to SEC_InspectionPictures`);
    }
    
    // Check and add FileSize to SEC_InspectionGallery
    const galCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionGallery' AND COLUMN_NAME='FileSize'");
    if (galCols.recordset.length === 0) {
        await pool.request().query("ALTER TABLE SEC_InspectionGallery ADD FileSize INT NULL");
        console.log(`${label}: Added FileSize to SEC_InspectionGallery`);
    }
}

(async () => {
    const pool = await sql.connect(config);
    await fix(pool, 'UAT');
    await pool.close();
    
    const pool2 = await sql.connect(configLive);
    await fix(pool2, 'LIVE');
    await pool2.close();
    
    console.log('Done');
})().catch(e => console.error(e.message));
