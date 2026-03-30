/**
 * Fix "Unknown" ResolvedBy/AcknowledgedBy in DepartmentEscalations
 * Run: node fix-unknown-users.js [uat|live]
 */

const sql = require('mssql');
const path = require('path');

const env = process.argv[2] || 'uat';
const envFile = env === 'live' ? '.env.live' : '.env';
require('dotenv').config({ path: path.join(__dirname, envFile) });

console.log(`\n🔧 Fixing Unknown users in ${env.toUpperCase()} database: ${process.env.SQL_DATABASE}\n`);

const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: true }
};

async function fixUnknownUsers() {
    try {
        await sql.connect(config);
        
        // First, check what records have "Unknown"
        const checkResult = await sql.query`
            SELECT Id, DocumentNumber, ReferenceValue, Department, Status, 
                   ResolvedBy, AcknowledgedBy, ResolutionNotes,
                   ResolvedAt, AcknowledgedAt
            FROM DepartmentEscalations 
            WHERE Module = 'OHS' 
              AND (ResolvedBy = 'Unknown' OR AcknowledgedBy = 'Unknown')
        `;
        
        console.log(`Found ${checkResult.recordset.length} records with "Unknown":\n`);
        
        if (checkResult.recordset.length === 0) {
            console.log('✅ No records to fix!');
            await sql.close();
            return;
        }
        
        // Show records
        checkResult.recordset.forEach(r => {
            console.log(`  ID: ${r.Id} | Doc: ${r.DocumentNumber} | Ref: ${r.ReferenceValue}`);
            console.log(`     Dept: ${r.Department} | Status: ${r.Status}`);
            console.log(`     ResolvedBy: ${r.ResolvedBy} | AcknowledgedBy: ${r.AcknowledgedBy}`);
            console.log(`     Notes: ${(r.ResolutionNotes || '').substring(0, 50)}...`);
            console.log('');
        });
        
        // Try to find the actual user from audit trail or use department name as placeholder
        // For now, update to show the department that resolved it
        console.log('Updating records...\n');
        
        // Update ResolvedBy to use Department name if Unknown
        const updateResolved = await sql.query`
            UPDATE DepartmentEscalations 
            SET ResolvedBy = Department + ' Team'
            WHERE Module = 'OHS' 
              AND ResolvedBy = 'Unknown'
              AND Department IS NOT NULL
        `;
        console.log(`✅ Updated ${updateResolved.rowsAffected[0]} ResolvedBy records`);
        
        // Update AcknowledgedBy to use Department name if Unknown
        const updateAcknowledged = await sql.query`
            UPDATE DepartmentEscalations 
            SET AcknowledgedBy = Department + ' Team'
            WHERE Module = 'OHS' 
              AND AcknowledgedBy = 'Unknown'
              AND Department IS NOT NULL
        `;
        console.log(`✅ Updated ${updateAcknowledged.rowsAffected[0]} AcknowledgedBy records`);
        
        console.log('\n✅ Done!');
        await sql.close();
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

fixUnknownUsers();
