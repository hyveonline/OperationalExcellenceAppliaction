const sql = require('mssql');
const dbConfig = { server: 'localhost', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

async function run() {
  const createGallery = `
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'OHS_InspectionGallery') AND type = 'U')
    BEGIN
      CREATE TABLE OHS_InspectionGallery (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AuditId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(500) NOT NULL,
        OriginalName NVARCHAR(255),
        FileSize INT,
        UploadedBy NVARCHAR(100),
        UploadedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_OHS_InspectionGallery_Audit FOREIGN KEY (AuditId) 
          REFERENCES OHS_Inspections(Id) ON DELETE CASCADE
      );
      CREATE INDEX IX_OHS_InspectionGallery_AuditId ON OHS_InspectionGallery(AuditId);
      PRINT 'Created table OHS_InspectionGallery';
    END
    ELSE PRINT 'OHS_InspectionGallery already exists';
  `;

  const createLinks = `
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'OHS_InspectionGalleryLinks') AND type = 'U')
    BEGIN
      CREATE TABLE OHS_InspectionGalleryLinks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        GalleryPictureId INT NOT NULL,
        ResponseId INT NOT NULL,
        PictureType NVARCHAR(20) NOT NULL DEFAULT 'Finding',
        AssignedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_OHS_GalleryLinks_Gallery FOREIGN KEY (GalleryPictureId) 
          REFERENCES OHS_InspectionGallery(Id) ON DELETE CASCADE,
        CONSTRAINT FK_OHS_GalleryLinks_Item FOREIGN KEY (ResponseId) 
          REFERENCES OHS_InspectionItems(Id) ON DELETE NO ACTION
      );
      CREATE INDEX IX_OHS_GalleryLinks_GalleryPictureId ON OHS_InspectionGalleryLinks(GalleryPictureId);
      CREATE INDEX IX_OHS_GalleryLinks_ResponseId ON OHS_InspectionGalleryLinks(ResponseId);
      CREATE UNIQUE INDEX IX_OHS_GalleryLinks_Unique ON OHS_InspectionGalleryLinks(GalleryPictureId, ResponseId, PictureType);
      PRINT 'Created table OHS_InspectionGalleryLinks';
    END
    ELSE PRINT 'OHS_InspectionGalleryLinks already exists';
  `;

  for (const db of ['OEApp_UAT', 'OEApp_Live']) {
    console.log('--- ' + db + ' ---');
    const pool = await sql.connect({...dbConfig, database: db});
    await pool.request().batch(createGallery);
    await pool.request().batch(createLinks);
    await pool.close();
  }
  console.log('Done!');
}
run().catch(e => { console.error(e); process.exit(1); });
