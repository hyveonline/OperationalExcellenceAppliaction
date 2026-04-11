const sql = require('mssql');
const config = { server: 'localhost', database: process.argv[2] || 'OEApp_UAT', user: 'sa', password: 'Kokowawa123@@', options: { encrypt: false, trustServerCertificate: true } };

const newBody = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if mso]>
    <style type="text/css">
        table, td { font-family: Segoe UI, Arial, sans-serif; }
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <!-- Outer wrapper table -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px 10px;">
                <!-- Main container -->
                <table role="presentation" width="650" cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; width: 100%; background-color: #ffffff; border-collapse: collapse;">
                    
                    <!-- RED HEADER -->
                    <tr>
                        <td style="background-color: #dc3545; padding: 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">&#128680; Theft Incident Report</h1>
                            <p style="margin: 8px 0 0 0; font-size: 15px; color: #f8d7da; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</p>
                        </td>
                    </tr>

                    <!-- Body content -->
                    <tr>
                        <td style="padding: 30px;">
                            <p style="margin: 0 0 10px 0; font-size: 15px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">Dear {{recipientName}},</p>
                            <p style="margin: 0 0 25px 0; font-size: 15px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">A theft incident has been reported at <strong>{{storeName}}</strong>. Please review the details below:</p>

                            <!-- VALUE BOXES - Table layout for Outlook -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                <tr>
                                    <!-- Stolen Value - RED -->
                                    <td width="48%" style="background-color: #dc3545; padding: 20px; text-align: center; vertical-align: top;">
                                        <p style="margin: 0; font-size: 12px; color: #f8d7da; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif;">Stolen Value</p>
                                        <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">{{stolenValue}}</p>
                                    </td>
                                    <td width="4%"></td>
                                    <!-- Value Collected - GREEN -->
                                    <td width="48%" style="background-color: #28a745; padding: 20px; text-align: center; vertical-align: top;">
                                        <p style="margin: 0; font-size: 12px; color: #d4edda; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif;">Value Collected</p>
                                        <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: 700; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif;">{{valueCollected}}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- STORE INFORMATION SECTION -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 16px; font-weight: 600; color: #495057; padding-bottom: 10px; border-bottom: 2px solid #dc3545; font-family: 'Segoe UI', Arial, sans-serif;">&#128205; Store Information</td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 10px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Store</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{storeName}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Incident Date</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{incidentDate}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Store Manager</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{storeManager}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Reported By</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{staffName}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- STOLEN ITEMS SECTION -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 16px; font-weight: 600; color: #495057; padding-bottom: 10px; border-bottom: 2px solid #dc3545; font-family: 'Segoe UI', Arial, sans-serif;">&#128230; Stolen Items</td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 10px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; font-size: 14px; color: #333333; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif;">{{stolenItems}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- THIEF INFORMATION SECTION -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 16px; font-weight: 600; color: #495057; padding-bottom: 10px; border-bottom: 2px solid #dc3545; font-family: 'Segoe UI', Arial, sans-serif;">&#128100; Thief Information</td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 10px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa;">
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Name</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{thiefName}} {{thiefSurname}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">ID Card</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{idCard}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Date of Birth</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{dateOfBirth}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Place of Birth</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{placeOfBirth}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Father's Name</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{fatherName}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Mother's Name</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{motherName}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Marital Status</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{maritalStatus}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CAPTURE DETAILS SECTION -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 16px; font-weight: 600; color: #495057; padding-bottom: 10px; border-bottom: 2px solid #dc3545; font-family: 'Segoe UI', Arial, sans-serif;">&#127919; Capture Details</td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 10px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Capture Method</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{captureMethod}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Security Type</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{securityType}}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Security Company</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{outsourceCompany}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- FINANCIAL DETAILS SECTION -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                <tr>
                                    <td style="font-size: 16px; font-weight: 600; color: #495057; padding-bottom: 10px; border-bottom: 2px solid #dc3545; font-family: 'Segoe UI', Arial, sans-serif;">&#128176; Financial Details</td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 10px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666; width: 40%; font-size: 14px; font-family: 'Segoe UI', Arial, sans-serif;">Amount to HO</td>
                                                <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: 600; font-size: 14px; color: #333333; font-family: 'Segoe UI', Arial, sans-serif;">{{amountToHO}}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- VIEW REPORT BUTTON -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="center" style="padding: 25px 0 10px 0;">
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{reportUrl}}" style="height:45px;v-text-anchor:middle;width:220px;" arcsize="18%" strokecolor="#dc3545" fillcolor="#dc3545">
                                            <w:anchorlock/>
                                            <center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;">View Full Report</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="{{reportUrl}}" style="display: inline-block; padding: 14px 30px; background-color: #dc3545; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif;">View Full Report</a>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
                            <p style="margin: 0 0 5px 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">This is an automated notification from the Operational Excellence Application.</p>
                            <p style="margin: 0; font-size: 13px; color: #666666; font-family: 'Segoe UI', Arial, sans-serif;">Report ID: #{{incidentId}} | Submitted: {{submittedAt}}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

async function run() {
    const pool = await sql.connect(config);
    await pool.request()
        .input('k', sql.NVarChar, 'THEFT_INCIDENT_REPORT')
        .input('b', sql.NVarChar, newBody)
        .query('UPDATE EmailTemplates SET BodyTemplate=@b WHERE TemplateKey=@k');
    console.log(`Updated THEFT_INCIDENT_REPORT template on ${config.database} with inline styles`);
    await pool.close();
}
run();
