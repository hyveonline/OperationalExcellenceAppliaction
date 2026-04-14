const sql = require('mssql');

async function addForm(db) {
    const pool = await new sql.ConnectionPool({
        server: 'localhost', database: db, user: 'sa', password: 'Kokowawa123@@',
        options: { encrypt: false, trustServerCertificate: true }
    }).connect();

    const check = await pool.request().query(`SELECT Id FROM Forms WHERE FormCode = 'SECURITY_INSPECTION'`);
    if (check.recordset.length > 0) {
        console.log(db + ': Form already exists');
        await pool.close();
        return;
    }

    await pool.request().query(`
        INSERT INTO Forms (FormCode, FormName, ModuleName, FormUrl, DashboardCategory, DashboardCategoryIcon, DashboardCategoryColor, DashboardIcon, DashboardTitle, DashboardDescription, ShowOnDashboard, IsActive, Description, DashboardSortOrder, CategorySortOrder) 
        VALUES ('SECURITY_INSPECTION', 'Security Inspection', 'Security Department', '/security-inspection', 'Security Department', N'🔒', '#343a40', N'🔍', 'Security Inspection', 'Security department store inspections, audits and action plans', 1, 1, 'Security department store inspections and audits', 1, 4)
    `);
    console.log(db + ': Form added to dashboard');
    await pool.close();
}

(async () => {
    await addForm('OEApp_UAT');
    await addForm('OEApp_Live');
    console.log('Done!');
})().catch(e => console.error(e.message));
