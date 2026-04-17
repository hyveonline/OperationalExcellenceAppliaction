const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };
const configLive = { server: 'localhost', database: 'OEApp_Live', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function fix(pool, label) {
    const needed = [
        { name: 'FilePath', type: 'NVARCHAR(500) NULL' },
        { name: 'OriginalName', type: 'NVARCHAR(500) NULL' }
    ];
    
    for (const col of needed) {
        const exists = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SEC_InspectionPictures' AND COLUMN_NAME='${col.name}'`);
        if (exists.recordset.length === 0) {
            await pool.request().query(`ALTER TABLE SEC_InspectionPictures ADD ${col.name} ${col.type}`);
            console.log(`${label}: Added ${col.name} to SEC_InspectionPictures`);
        } else {
            console.log(`${label}: ${col.name} already exists`);
        }
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
