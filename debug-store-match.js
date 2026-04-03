/**
 * Debug store manager data matching
 */

require('dotenv').config({ path: '.env' }); // UAT
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

async function debug() {
    console.log('Database:', config.database);
    
    try {
        const pool = await sql.connect(config);
        
        // Find test user
        console.log('\n=== Looking for test users ===');
        const users = await pool.request().query(`
            SELECT TOP 10 u.Id, u.DisplayName, u.Email 
            FROM Users u 
            WHERE u.DisplayName LIKE '%test%' OR u.Email LIKE '%test%' OR u.DisplayName LIKE '%sptes%'
            ORDER BY u.DisplayName
        `);
        console.log('Test users:');
        users.recordset.forEach(u => console.log(`  ${u.Id}: ${u.DisplayName} (${u.Email})`));
        
        // Find GNG Awkar related stores
        console.log('\n=== Stores with GNG or Awkar ===');
        const stores = await pool.request().query(`
            SELECT Id, StoreName FROM Stores 
            WHERE StoreName LIKE '%GNG%' OR StoreName LIKE '%Awkar%'
        `);
        stores.recordset.forEach(s => console.log(`  ${s.Id}: ${s.StoreName}`));
        
        // Find MasterTable entries with GNG or Awkar
        console.log('\n=== MasterTable Branch names with GNG or Awkar ===');
        const branches = await pool.request().query(`
            SELECT DISTINCT Branch FROM MasterTableEntries 
            WHERE IsActive = 1 AND (Branch LIKE '%GNG%' OR Branch LIKE '%Awkar%')
        `);
        if (branches.recordset.length === 0) {
            console.log('  No matching branches found!');
        } else {
            branches.recordset.forEach(b => console.log(`  ${b.Branch}`));
        }
        
        // Check all unique branches
        console.log('\n=== All unique Branch names in MasterTable ===');
        const allBranches = await pool.request().query(`
            SELECT DISTINCT Branch FROM MasterTableEntries WHERE IsActive = 1 ORDER BY Branch
        `);
        allBranches.recordset.forEach(b => console.log(`  ${b.Branch}`));
        
        // Check all store names
        console.log('\n=== All Store names ===');
        const allStores = await pool.request().query(`
            SELECT Id, StoreName FROM Stores WHERE IsActive = 1 ORDER BY StoreName
        `);
        allStores.recordset.forEach(s => console.log(`  ${s.Id}: ${s.StoreName}`));
        
        await pool.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

debug();
