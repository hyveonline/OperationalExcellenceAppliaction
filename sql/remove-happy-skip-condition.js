const sql = require('mssql');
const config = { server: 'localhost', database: process.argv[2] || 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(config);
    
    // Check existing conditions
    const res = await pool.request().query(`
        SELECT wc.Id, wc.FieldName, wc.Operator, wc.Value, wc.ActionOnMatch, ws.StepName 
        FROM WorkflowConditions wc 
        JOIN WorkflowSteps ws ON wc.StepId = ws.Id 
        JOIN WorkflowDefinitions wd ON ws.WorkflowId = wd.Id 
        WHERE wd.FormCode = 'EXTRA_CLEANING'
    `);
    console.log('Current conditions:', JSON.stringify(res.recordset, null, 2));
    
    // Delete the "skip AM for happy stores" condition if it exists
    const del = await pool.request().query(`
        DELETE wc FROM WorkflowConditions wc
        JOIN WorkflowSteps ws ON wc.StepId = ws.Id
        JOIN WorkflowDefinitions wd ON ws.WorkflowId = wd.Id
        WHERE wd.FormCode = 'EXTRA_CLEANING'
          AND wc.FieldName = 'store' 
          AND wc.Value = 'happy' 
          AND wc.ActionOnMatch = 'SKIP'
    `);
    console.log(`Removed ${del.rowsAffected[0]} "skip AM for Happy" condition(s) on ${config.database}`);
    
    await pool.close();
}
run();
