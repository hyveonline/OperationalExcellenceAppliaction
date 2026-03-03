const sql = require('mssql');
const config = require('./config/default');

async function check() {
    const uatPool = await new sql.ConnectionPool({
        server: config.database.server,
        database: 'OEApp_UAT',
        user: config.database.user,
        password: config.database.password,
        options: config.database.options
    }).connect();
    
    const livePool = await new sql.ConnectionPool({
        server: config.database.server,
        database: 'OEApp_Live',
        user: config.database.user,
        password: config.database.password,
        options: config.database.options
    }).connect();
    
    console.log('=== UAT Facility roles ===');
    const uatRoles = await uatPool.request().query("SELECT Id, RoleName FROM UserRoles WHERE RoleName LIKE '%Facility%'");
    uatRoles.recordset.forEach(r => console.log(r.Id + ': ' + r.RoleName));
    
    console.log('\n=== UAT Facility Services Supervisor access ===');
    const uatAccess = await uatPool.request().query(`
        SELECT r.RoleName, rfa.FormCode, rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete 
        FROM RoleFormAccess rfa 
        JOIN UserRoles r ON rfa.RoleId = r.Id 
        WHERE r.RoleName LIKE '%Facility%'
        ORDER BY rfa.FormCode
    `);
    console.log('UAT has ' + uatAccess.recordset.length + ' form permissions:');
    uatAccess.recordset.forEach(a => console.log('  ' + a.FormCode + ': V=' + a.CanView + ' C=' + a.CanCreate + ' E=' + a.CanEdit + ' D=' + a.CanDelete));
    
    console.log('\n=== Live Facility Services Supervisor access ===');
    const liveAccess = await livePool.request().query(`
        SELECT r.RoleName, rfa.FormCode, rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete 
        FROM RoleFormAccess rfa 
        JOIN UserRoles r ON rfa.RoleId = r.Id 
        WHERE r.RoleName LIKE '%Facility%'
        ORDER BY rfa.FormCode
    `);
    console.log('Live has ' + liveAccess.recordset.length + ' form permissions:');
    liveAccess.recordset.forEach(a => console.log('  ' + a.FormCode + ': V=' + a.CanView + ' C=' + a.CanCreate + ' E=' + a.CanEdit + ' D=' + a.CanDelete));
    
    // Find differences
    const liveSet = new Set(liveAccess.recordset.map(a => a.FormCode));
    const uatSet = new Set(uatAccess.recordset.map(a => a.FormCode));
    
    console.log('\n=== In UAT but NOT in Live ===');
    uatAccess.recordset.filter(a => !liveSet.has(a.FormCode)).forEach(a => console.log('  ' + a.FormCode));
    
    console.log('\n=== In Live but NOT in UAT ===');
    liveAccess.recordset.filter(a => !uatSet.has(a.FormCode)).forEach(a => console.log('  ' + a.FormCode));
    
    await uatPool.close();
    await livePool.close();
    process.exit(0);
}

check();
