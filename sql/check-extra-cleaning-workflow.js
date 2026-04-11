const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(config);
    
    // 1. Workflow Definition
    const wd = await pool.request().query(`SELECT * FROM WorkflowDefinitions WHERE FormCode = 'EXTRA_CLEANING'`);
    console.log('\n=== WORKFLOW DEFINITION ===');
    console.log(JSON.stringify(wd.recordset[0], null, 2));
    
    const wfId = wd.recordset[0].Id;
    
    // 2. Steps
    const steps = await pool.request().query(`SELECT * FROM WorkflowSteps WHERE WorkflowId = ${wfId} ORDER BY StepOrder`);
    console.log('\n=== WORKFLOW STEPS ===');
    for (const s of steps.recordset) {
        console.log(`  Step ${s.StepOrder}: ${s.StepName} (Type: ${s.StepType}, Method: ${s.ApprovalMethod}, Active: ${s.IsActive})`);
        console.log(`    Actions: ${s.AllowedActions}`);
        
        // 3. Recipients for this step
        const recip = await pool.request().query(`SELECT * FROM WorkflowStepRecipients WHERE StepId = ${s.Id}`);
        for (const r of recip.recordset) {
            console.log(`    Recipient: ${r.RecipientType} → ${r.FieldName || r.RoleId || r.Email} (${r.EmailTarget}, Active: ${r.IsActive})`);
        }
        
        // 4. Conditions for this step
        const conds = await pool.request().query(`SELECT * FROM WorkflowConditions WHERE StepId = ${s.Id}`);
        for (const c of conds.recordset) {
            console.log(`    Condition: IF ${c.FieldName} ${c.Operator} '${c.Value}' → ${c.ActionOnMatch} (Active: ${c.IsActive})`);
        }
    }
    
    // 5. Status Mappings
    const sm = await pool.request().query(`SELECT * FROM WorkflowStatusMappings WHERE WorkflowId = ${wfId} ORDER BY DisplayOrder`);
    console.log('\n=== STATUS MAPPINGS ===');
    for (const s of sm.recordset) {
        console.log(`  ${s.StatusKey}: "${s.DisplayLabel}" (color: ${s.Color}, final: ${s.IsFinal})`);
    }
    
    await pool.close();
}
run();
