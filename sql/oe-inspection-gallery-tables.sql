-- OE Inspection Gallery Tables
-- Created: 2026-03-23
-- Purpose: Gallery feature for inspection pictures - upload first, assign to items later

-- Gallery Pictures Table (stores uploaded pictures)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'OE_InspectionGallery') AND type = 'U')
BEGIN
    CREATE TABLE OE_InspectionGallery (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AuditId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(500) NOT NULL,
        OriginalName NVARCHAR(255),
        FileSize INT,
        UploadedBy NVARCHAR(100),
        UploadedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_OE_InspectionGallery_Audit FOREIGN KEY (AuditId) 
            REFERENCES OE_Inspections(Id) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_OE_InspectionGallery_AuditId ON OE_InspectionGallery(AuditId);
    PRINT 'Created table OE_InspectionGallery';
END
GO

-- Gallery Links Table (links pictures to items with type)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'OE_InspectionGalleryLinks') AND type = 'U')
BEGIN
    CREATE TABLE OE_InspectionGalleryLinks (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        GalleryPictureId INT NOT NULL,
        ResponseId INT NOT NULL,  -- Links to OE_InspectionItems.Id
        PictureType NVARCHAR(20) NOT NULL DEFAULT 'Finding', -- Finding, Good, Corrective
        AssignedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_OE_GalleryLinks_Gallery FOREIGN KEY (GalleryPictureId) 
            REFERENCES OE_InspectionGallery(Id) ON DELETE CASCADE,
        CONSTRAINT FK_OE_GalleryLinks_Item FOREIGN KEY (ResponseId) 
            REFERENCES OE_InspectionItems(Id) ON DELETE NO ACTION
    );
    
    CREATE INDEX IX_OE_GalleryLinks_GalleryPictureId ON OE_InspectionGalleryLinks(GalleryPictureId);
    CREATE INDEX IX_OE_GalleryLinks_ResponseId ON OE_InspectionGalleryLinks(ResponseId);
    
    -- Allow same picture to be assigned to multiple items
    CREATE UNIQUE INDEX IX_OE_GalleryLinks_Unique ON OE_InspectionGalleryLinks(GalleryPictureId, ResponseId, PictureType);
    
    PRINT 'Created table OE_InspectionGalleryLinks';
END
GO

PRINT 'Gallery tables setup complete!';
