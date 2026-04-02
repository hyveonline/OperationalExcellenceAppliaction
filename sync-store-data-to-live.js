/**
 * Sync Store Management Data from UAT to LIVE
 * - Sync TemplateId for stores
 * - Sync StoreManagerAssignments
 * 
 * Run: node sync-store-data-to-live.js
 */

const sql = require('mssql');
const path = require('path');

async function getConfig(env) {
    const envFile = env === 'live' ? '.env.live' : '.env';
    require('dotenv').config({ path: path.join(__dirname, envFile), override: true });
    
    return {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: { encrypt: true, trustServerCertificate: true }
    };
}

async function syncData() {
    console.log('\n🔄 Syncing Store Management Data from UAT to LIVE\n');
    
    // Connect to UAT
    const uatConfig = await getConfig('uat');
    console.log('1. Connecting to UAT:', uatConfig.database);
    const uatPool = await sql.connect(uatConfig);
    
    // Get UAT data
    const uatTemplates = await uatPool.request().query(`
        SELECT s.StoreCode, s.TemplateId, t.TemplateName
        FROM Stores s
        LEFT JOIN OE_InspectionTemplates t ON s.TemplateId = t.Id
        WHERE s.IsActive = 1 AND s.TemplateId IS NOT NULL
    `);
    console.log('   Found', uatTemplates.recordset.length, 'stores with templates');
    
    const uatManagers = await uatPool.request().query(`
        SELECT sma.*, s.StoreCode, u.Email
        FROM StoreManagerAssignments sma
        JOIN Stores s ON sma.StoreId = s.Id
        JOIN Users u ON sma.UserId = u.Id
    `);
    console.log('   Found', uatManagers.recordset.length, 'manager assignments');
    
    await uatPool.close();
    
    // Connect to LIVE
    const liveConfig = await getConfig('live');
    console.log('\n2. Connecting to LIVE:', liveConfig.database);
    const livePool = await new sql.ConnectionPool(liveConfig).connect();
    
    // Get LIVE templates by name (IDs may differ)
    const liveTemplates = await livePool.request().query(`
        SELECT Id, TemplateName FROM OE_InspectionTemplates WHERE IsActive = 1
    `);
    const templateMap = {};
    liveTemplates.recordset.forEach(t => {
        templateMap[t.TemplateName] = t.Id;
    });
    console.log('   LIVE has', Object.keys(templateMap).length, 'templates');
    
    // Sync Template IDs
    console.log('\n3. Syncing Template IDs...');
    let templateUpdated = 0;
    for (const store of uatTemplates.recordset) {
        const liveTemplateId = templateMap[store.TemplateName];
        if (liveTemplateId) {
            await livePool.request()
                .input('storeCode', sql.NVarChar, store.StoreCode)
                .input('templateId', sql.Int, liveTemplateId)
                .query(`UPDATE Stores SET TemplateId = @templateId WHERE StoreCode = @storeCode AND IsActive = 1`);
            templateUpdated++;
        } else {
            console.log(`   ⚠️  Template not found in LIVE: "${store.TemplateName}" for ${store.StoreCode}`);
        }
    }
    console.log(`   ✅ Updated ${templateUpdated} stores with TemplateId`);
    
    // Sync Manager Assignments
    console.log('\n4. Syncing Store Manager Assignments...');
    
    // Get LIVE store and user IDs
    const liveStores = await livePool.request().query(`SELECT Id, StoreCode FROM Stores WHERE IsActive = 1`);
    const storeMap = {};
    liveStores.recordset.forEach(s => { storeMap[s.StoreCode] = s.Id; });
    
    const liveUsers = await livePool.request().query(`SELECT Id, Email FROM Users WHERE IsActive = 1`);
    const userMap = {};
    liveUsers.recordset.forEach(u => { userMap[u.Email.toLowerCase()] = u.Id; });
    
    // Create table if not exists
    await livePool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StoreManagerAssignments')
        CREATE TABLE StoreManagerAssignments (
            Id INT IDENTITY(1,1) PRIMARY KEY,
            StoreId INT NOT NULL,
            UserId INT NOT NULL,
            IsPrimary BIT DEFAULT 0,
            AssignedAt DATETIME DEFAULT GETDATE(),
            CONSTRAINT UQ_StoreManagerAssignment UNIQUE (StoreId, UserId)
        )
    `);
    
    let managersInserted = 0;
    for (const assignment of uatManagers.recordset) {
        const liveStoreId = storeMap[assignment.StoreCode];
        const liveUserId = userMap[assignment.Email.toLowerCase()];
        
        if (liveStoreId && liveUserId) {
            try {
                await livePool.request()
                    .input('storeId', sql.Int, liveStoreId)
                    .input('userId', sql.Int, liveUserId)
                    .input('isPrimary', sql.Bit, assignment.IsPrimary)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM StoreManagerAssignments WHERE StoreId = @storeId AND UserId = @userId)
                        INSERT INTO StoreManagerAssignments (StoreId, UserId, IsPrimary) VALUES (@storeId, @userId, @isPrimary)
                    `);
                managersInserted++;
            } catch (e) {
                console.log(`   ⚠️  Error inserting ${assignment.Email} -> ${assignment.StoreCode}:`, e.message);
            }
        } else {
            if (!liveStoreId) console.log(`   ⚠️  Store not found in LIVE: ${assignment.StoreCode}`);
            if (!liveUserId) console.log(`   ⚠️  User not found in LIVE: ${assignment.Email}`);
        }
    }
    console.log(`   ✅ Inserted ${managersInserted} manager assignments`);
    
    await livePool.close();
    
    console.log('\n✅ Sync Complete!\n');
}

syncData().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
