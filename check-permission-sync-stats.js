// Quick diagnostic script to check UAT vs Live differences
const sql = require('mssql');
const config = require('./config/default');

const uatDbConfig = {
    server: config.database.server,
    database: 'OEApp_UAT',
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

const liveDbConfig = {
    server: config.database.server,
    database: 'OEApp_Live',
    user: config.database.user,
    password: config.database.password,
    options: config.database.options
};

async function checkDifferences() {
    let uatPool = null;
    let livePool = null;
    
    try {
        console.log('Connecting to databases...\n');
        uatPool = await new sql.ConnectionPool(uatDbConfig).connect();
        livePool = await new sql.ConnectionPool(liveDbConfig).connect();
        
        // Check Roles
        console.log('=== ROLES ===');
        const uatRoles = await uatPool.request().query('SELECT Id, RoleName, Description, CategoryId FROM UserRoles ORDER BY RoleName');
        const liveRoles = await livePool.request().query('SELECT Id, RoleName, Description, CategoryId FROM UserRoles ORDER BY RoleName');
        
        const uatRolesMap = new Map(uatRoles.recordset.map(r => [r.RoleName, r]));
        const liveRolesMap = new Map(liveRoles.recordset.map(r => [r.RoleName, r]));
        
        let rolesMissingLive = 0;
        let rolesDifferent = 0;
        
        uatRolesMap.forEach((uat, name) => {
            const live = liveRolesMap.get(name);
            if (!live) {
                rolesMissingLive++;
                console.log(`  MISSING on Live: ${name}`);
            } else if (uat.Description !== live.Description || uat.CategoryId !== live.CategoryId) {
                rolesDifferent++;
                console.log(`  DIFFERENT: ${name}`);
                console.log(`    UAT: Description="${uat.Description}", CategoryId=${uat.CategoryId}`);
                console.log(`    Live: Description="${live.Description}", CategoryId=${live.CategoryId}`);
            }
        });
        
        console.log(`\n  Total UAT: ${uatRoles.recordset.length}, Live: ${liveRoles.recordset.length}`);
        console.log(`  Missing on Live: ${rolesMissingLive}, Different: ${rolesDifferent}`);
        console.log(`  Badge should show: ${rolesMissingLive + rolesDifferent}`);
        
        // Check Forms
        console.log('\n=== FORMS ===');
        const uatForms = await uatPool.request().query('SELECT FormCode, FormName, ModuleName, FormUrl FROM Forms ORDER BY FormCode');
        const liveForms = await livePool.request().query('SELECT FormCode, FormName, ModuleName, FormUrl FROM Forms ORDER BY FormCode');
        
        const uatFormsMap = new Map(uatForms.recordset.map(f => [f.FormCode, f]));
        const liveFormsMap = new Map(liveForms.recordset.map(f => [f.FormCode, f]));
        
        let formsMissingLive = 0;
        let formsDifferent = 0;
        
        uatFormsMap.forEach((uat, code) => {
            const live = liveFormsMap.get(code);
            if (!live) {
                formsMissingLive++;
                console.log(`  MISSING on Live: ${code} - ${uat.FormName}`);
            }
        });
        
        console.log(`\n  Total UAT: ${uatForms.recordset.length}, Live: ${liveForms.recordset.length}`);
        console.log(`  Missing on Live: ${formsMissingLive}, Different: ${formsDifferent}`);
        console.log(`  Badge should show: ${formsMissingLive + formsDifferent}`);
        
        // Check RoleFormAccess
        console.log('\n=== ROLE FORM ACCESS ===');
        const uatAccess = await uatPool.request().query(`
            SELECT rfa.RoleId, r.RoleName, rfa.FormCode, rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete
            FROM RoleFormAccess rfa
            JOIN UserRoles r ON rfa.RoleId = r.Id
        `);
        const liveAccess = await livePool.request().query(`
            SELECT rfa.RoleId, r.RoleName, rfa.FormCode, rfa.CanView, rfa.CanCreate, rfa.CanEdit, rfa.CanDelete
            FROM RoleFormAccess rfa
            JOIN UserRoles r ON rfa.RoleId = r.Id
        `);
        
        const uatAccessMap = new Map();
        uatAccess.recordset.forEach(a => uatAccessMap.set(`${a.RoleName}|${a.FormCode}`, a));
        const liveAccessMap = new Map();
        liveAccess.recordset.forEach(a => liveAccessMap.set(`${a.RoleName}|${a.FormCode}`, a));
        
        let accessMissingLive = 0;
        let accessDifferent = 0;
        
        uatAccessMap.forEach((uat, key) => {
            const live = liveAccessMap.get(key);
            if (!live) {
                accessMissingLive++;
                console.log(`  MISSING on Live: ${key}`);
            } else if (uat.CanView !== live.CanView || uat.CanCreate !== live.CanCreate || 
                       uat.CanEdit !== live.CanEdit || uat.CanDelete !== live.CanDelete) {
                accessDifferent++;
                console.log(`  DIFFERENT: ${key}`);
                console.log(`    UAT: View=${uat.CanView}, Create=${uat.CanCreate}, Edit=${uat.CanEdit}, Delete=${uat.CanDelete}`);
                console.log(`    Live: View=${live.CanView}, Create=${live.CanCreate}, Edit=${live.CanEdit}, Delete=${live.CanDelete}`);
            }
        });
        
        console.log(`\n  Total UAT: ${uatAccess.recordset.length}, Live: ${liveAccess.recordset.length}`);
        console.log(`  Missing on Live: ${accessMissingLive}, Different: ${accessDifferent}`);
        console.log(`  Badge should show: ${accessMissingLive + accessDifferent}`);
        
        // Check Users
        console.log('\n=== USERS ===');
        const uatUsers = await uatPool.request().query(`SELECT Email, DisplayName, RoleId FROM Users WHERE IsActive = 1`);
        const liveUsers = await livePool.request().query(`SELECT Email, DisplayName, RoleId FROM Users WHERE IsActive = 1`);
        console.log(`  Total Active - UAT: ${uatUsers.recordset.length}, Live: ${liveUsers.recordset.length}`);
        
        // Check Brands
        console.log('\n=== BRANDS ===');
        const uatBrands = await uatPool.request().query(`SELECT BrandCode, BrandName FROM Brands`);
        const liveBrands = await livePool.request().query(`SELECT BrandCode, BrandName FROM Brands`);
        console.log(`  Total - UAT: ${uatBrands.recordset.length}, Live: ${liveBrands.recordset.length}`);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        if (uatPool) await uatPool.close();
        if (livePool) await livePool.close();
        process.exit(0);
    }
}

checkDifferences();
