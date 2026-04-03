/**
 * Fix corrupted emoji icons in Forms table
 * The emojis were double-encoded as UTF-8
 * 
 * Usage: node fix-form-icons.js [live|uat]
 */

const env = process.argv[2] || 'live';
require('dotenv').config({ path: env === 'uat' ? '.env' : '.env.live' });
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_Live',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

// Fixed icon mappings
const iconFixes = [
    // Internal Investigations
    { formCode: 'SECURITY_INTERNAL_INVESTIGATIONS', dashboardIcon: '🔍', dashboardCategoryIcon: '🔒' },
    // Post Visit Report
    { formCode: 'SECURITY_POST_VISIT_REPORT', dashboardCategoryIcon: '🔒' },
    // Lost and Found
    { formCode: 'STORES_LOST_AND_FOUND', dashboardIcon: '📦', storesPageIcon: '📦' },
    // Five Days Entry
    { formCode: 'FIVE_DAYS_ENTRY', storesPageIcon: '📋' },
    // Complaint
    { formCode: 'COMPLAINT', storesPageIcon: '📝' },
    // Extra Cleaning
    { formCode: 'EXTRA_CLEANING', storesPageIcon: '🧹' },
    // OHS Incident
    { formCode: 'OHS_INCIDENT', storesPageIcon: '⚠️' },
    // Evacuation Drill
    { formCode: 'EVACUATION_DRILL', storesPageIcon: '🚨' },
    // Theft Incident
    { formCode: 'THEFT_INCIDENT', storesPageIcon: '🚨' },
    // Weekly Feedback
    { formCode: 'WEEKLY_FEEDBACK', storesPageIcon: '📝' }
];

async function fixIcons() {
    console.log('Using database:', config.database);
    console.log('Connecting...\n');
    
    try {
        const pool = await sql.connect(config);
        
        console.log('=== Fixing Form Icons ===\n');
        
        for (const fix of iconFixes) {
            const updates = [];
            const params = [];
            
            if (fix.dashboardIcon) {
                updates.push('DashboardIcon = @dashboardIcon');
                params.push({ name: 'dashboardIcon', value: fix.dashboardIcon });
            }
            if (fix.dashboardCategoryIcon) {
                updates.push('DashboardCategoryIcon = @dashboardCategoryIcon');
                params.push({ name: 'dashboardCategoryIcon', value: fix.dashboardCategoryIcon });
            }
            if (fix.storesPageIcon) {
                updates.push('StoresPageIcon = @storesPageIcon');
                params.push({ name: 'storesPageIcon', value: fix.storesPageIcon });
            }
            
            if (updates.length > 0) {
                const request = pool.request().input('formCode', sql.NVarChar, fix.formCode);
                params.forEach(p => request.input(p.name, sql.NVarChar, p.value));
                
                const query = `UPDATE Forms SET ${updates.join(', ')} WHERE FormCode = @formCode`;
                const result = await request.query(query);
                
                const icons = params.map(p => `${p.name}=${p.value}`).join(', ');
                console.log(`✓ ${fix.formCode}: ${icons} (${result.rowsAffected[0]} rows)`);
            }
        }
        
        // Verify the fixes
        console.log('\n=== Verification ===\n');
        const forms = await pool.request().query(`
            SELECT FormCode, FormName, DashboardIcon, DashboardCategoryIcon, StoresPageIcon
            FROM Forms 
            WHERE FormCode IN (${iconFixes.map(f => `'${f.formCode}'`).join(',')})
            ORDER BY FormName
        `);
        
        forms.recordset.forEach(f => {
            console.log(`${f.FormCode}:`);
            console.log(`  DashboardIcon: ${f.DashboardIcon || '(none)'}`);
            console.log(`  DashboardCategoryIcon: ${f.DashboardCategoryIcon || '(none)'}`);
            console.log(`  StoresPageIcon: ${f.StoresPageIcon || '(none)'}`);
        });
        
        await pool.close();
        console.log('\nDone! Icons fixed successfully.');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

fixIcons();
