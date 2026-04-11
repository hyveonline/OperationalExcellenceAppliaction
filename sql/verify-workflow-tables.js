const sql = require('mssql');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config', 'default'));

async function verify() {
    const query = `
        SELECT t.name AS TableName, SUM(ps.row_count) AS [Rows]
        FROM sys.tables t
        JOIN sys.dm_db_partition_stats ps ON t.object_id = ps.object_id
        WHERE t.name LIKE 'Workflow%' AND ps.index_id IN (0,1)
        GROUP BY t.name ORDER BY t.name
    `;

    // UAT
    const p1 = await sql.connect({ ...config.database, database: 'OEApp_UAT' });
    const r1 = await p1.request().query(query);
    console.log('=== OEApp_UAT ===');
    console.table(r1.recordset);
    await p1.close();

    // LIVE
    const p2 = await sql.connect({ ...config.database, database: 'OEApp_Live' });
    const r2 = await p2.request().query(query);
    console.log('=== OEApp_Live ===');
    console.table(r2.recordset);
    await p2.close();
}

verify().catch(e => console.error(e));
