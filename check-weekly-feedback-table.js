const sql = require('mssql');
const config = require('./config/default');

async function check() {
    const pool = await new sql.ConnectionPool({
        server: config.database.server,
        database: 'OEApp_UAT',
        user: config.database.user,
        password: config.database.password,
        options: config.database.options
    }).connect();
    
    const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'WeeklyThirdPartyFeedback' 
        ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Current WeeklyThirdPartyFeedback columns:');
    cols.recordset.forEach(c => {
        console.log('  ' + c.COLUMN_NAME + ' - ' + c.DATA_TYPE + (c.CHARACTER_MAXIMUM_LENGTH ? '(' + c.CHARACTER_MAXIMUM_LENGTH + ')' : ''));
    });
    
    await pool.close();
}

check();
