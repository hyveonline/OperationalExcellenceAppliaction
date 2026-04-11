const sql = require('mssql');
const config = { server: 'localhost', database: 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(config);
    const r = await pool.request().query(`
        SELECT TemplateKey, BodyTemplate, IsActive 
        FROM EmailTemplates 
        ORDER BY TemplateKey
    `);
    
    for (const t of r.recordset) {
        const body = t.BodyTemplate || '';
        // Strip MSO conditional comments before checking
        const bodyNoMso = body.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/gi, '')
                              .replace(/<!--\[if !mso\]><!-->([\s\S]*?)<!--<!\[endif\]-->/gi, '');
        const hasStyleBlock = /<style[\s>]/i.test(bodyNoMso);
        const hasLinearGradient = /linear-gradient/i.test(bodyNoMso);
        const hasCssClasses = /class="/i.test(bodyNoMso);
        const hasDivLayout = /<div[^>]*style[^>]*(?:max-width|margin.*auto)/i.test(bodyNoMso);
        const hasInlineBlock = /display:\s*inline-block/i.test(bodyNoMso);
        const usesTable = /<table/i.test(body);
        const hasShortHex = /#[0-9a-f]{3}[;"\s]/i.test(bodyNoMso);
        
        const issues = [];
        if (hasStyleBlock) issues.push('<style> block');
        if (hasLinearGradient) issues.push('linear-gradient');
        if (hasCssClasses) issues.push('CSS classes');
        if (hasDivLayout) issues.push('div-based layout');
        if (hasInlineBlock) issues.push('inline-block');
        if (hasShortHex) issues.push('3-digit hex colors');
        if (!usesTable && body.length > 100) issues.push('NO tables (div only)');
        
        const status = issues.length > 0 ? '❌ NEEDS FIX' : '✅ OK';
        console.log(`\n=== ${t.TemplateKey} (Active: ${t.IsActive}) ===`);
        console.log(`  Length: ${body.length} chars`);
        console.log(`  Status: ${status}`);
        if (issues.length > 0) console.log(`  Issues: ${issues.join(', ')}`);
        console.log(`  Preview: ${body.substring(0, 150).replace(/\n/g, ' ')}`);
    }
    
    await pool.close();
}
run();
