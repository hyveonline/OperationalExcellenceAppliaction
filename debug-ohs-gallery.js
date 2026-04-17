const sql = require('mssql');
const dbConfig = { server: 'localhost', user: 'sa', password: 'Kokowawa123@@', database: 'OEApp_UAT', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
    const pool = await sql.connect(dbConfig);
    
    // Find audit
    const audit = await pool.request().query(`SELECT Id, DocumentNumber, Status FROM OHS_Inspections WHERE DocumentNumber LIKE '%0062%' OR Id=68`);
    console.log('Audit:', audit.recordset);
    
    // Check gallery pictures for audit 68
    const gallery = await pool.request().query(`SELECT g.Id, g.AuditId, g.OriginalName, g.FilePath FROM OHS_InspectionGallery g WHERE g.AuditId = 68`);
    console.log('Gallery pictures:', gallery.recordset);
    
    // Check gallery links
    const links = await pool.request().query(`
        SELECT l.Id, l.GalleryPictureId, l.ResponseId, l.PictureType, 
               i.Question, i.Answer, i.SectionName
        FROM OHS_InspectionGalleryLinks l
        JOIN OHS_InspectionItems i ON i.Id = l.ResponseId
        WHERE i.InspectionId = 68
    `);
    console.log('Gallery links:');
    console.table(links.recordset);
    
    // Check direct pictures
    const direct = await pool.request().query(`SELECT p.Id, p.ItemId, p.PictureType, p.OriginalName FROM OHS_InspectionPictures p JOIN OHS_InspectionItems i ON p.ItemId=i.Id WHERE i.InspectionId=68`);
    console.log('Direct pictures:', direct.recordset);
    
    // Full UNION query (what the report uses)
    const full = await pool.request().input('auditId', sql.Int, 68).query(`
        SELECT p.Id, p.ItemId, p.FileName, p.ContentType, p.PictureType, p.FilePath, p.OriginalName, p.FileSize
        FROM OHS_InspectionPictures p
        INNER JOIN OHS_InspectionItems i ON p.ItemId = i.Id
        WHERE i.InspectionId = @auditId
        UNION ALL
        SELECT g.Id + 1000000 as Id, l.ResponseId as ItemId, g.FileName, 'image/jpeg' as ContentType, 
               l.PictureType, g.FilePath, g.OriginalName, g.FileSize
        FROM OHS_InspectionGalleryLinks l
        INNER JOIN OHS_InspectionGallery g ON g.Id = l.GalleryPictureId
        INNER JOIN OHS_InspectionItems i ON i.Id = l.ResponseId
        WHERE i.InspectionId = @auditId
        ORDER BY ItemId, Id
    `);
    console.log('Full UNION query results:');
    console.table(full.recordset);
    
    await pool.close();
}
run().catch(e => console.error(e));
