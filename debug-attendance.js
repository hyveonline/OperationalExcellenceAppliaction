/**
 * Debug attendance variance - check data matching
 */

require('dotenv').config({ path: '.env' }); // UAT
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    }
};

async function debug() {
    console.log('Database:', config.database);
    
    try {
        const pool = await sql.connect(config);
        
        // Check attendance records for GNG Dbayeh Waterfront
        console.log('\n=== ThirdpartyAttendance Records (Mar 31 - Apr 5, 2026) ===');
        const attendance = await pool.request().query(`
            SELECT StoreName, AttendanceDate, FirstName, LastName, TimeIn, TimeOut, Company
            FROM ThirdpartyAttendance 
            WHERE AttendanceDate BETWEEN '2026-03-31' AND '2026-04-05'
            AND StoreName LIKE '%Dbayeh%'
            ORDER BY AttendanceDate, FirstName
        `);
        
        if (attendance.recordset.length === 0) {
            console.log('NO ATTENDANCE RECORDS FOUND for Dbayeh stores!');
        } else {
            console.log('Found', attendance.recordset.length, 'records:');
            attendance.recordset.forEach(r => {
                console.log(`  ${r.AttendanceDate.toISOString().split('T')[0]} | ${r.StoreName} | ${r.FirstName} ${r.LastName} | ${r.TimeIn} - ${r.TimeOut}`);
            });
        }
        
        // Check schedule for same period
        console.log('\n=== ThirdpartySchedules (overlapping Mar 31 - Apr 5) ===');
        const schedules = await pool.request().query(`
            SELECT s.Id, s.StoreName, s.FromDate, s.ToDate, 
                   e.EmployeeName, e.CompanyName, e.MonFrom, e.MonTo
            FROM ThirdpartySchedules s
            JOIN ThirdpartyScheduleEmployees e ON s.Id = e.ScheduleId
            WHERE s.StoreName LIKE '%Dbayeh%'
            AND s.ToDate >= '2026-03-31' AND s.FromDate <= '2026-04-05'
        `);
        
        if (schedules.recordset.length === 0) {
            console.log('NO SCHEDULES FOUND for Dbayeh stores!');
        } else {
            console.log('Found', schedules.recordset.length, 'schedule entries:');
            schedules.recordset.forEach(r => {
                console.log(`  Schedule ${r.Id}: ${r.StoreName} | ${r.FromDate?.toISOString().split('T')[0]} to ${r.ToDate?.toISOString().split('T')[0]}`);
                console.log(`    Employee: ${r.EmployeeName} (${r.CompanyName}) | Mon: ${r.MonFrom}-${r.MonTo}`);
            });
        }
        
        // Check ALL attendance stores
        console.log('\n=== All Unique Store Names in ThirdpartyAttendance ===');
        const stores = await pool.request().query(`
            SELECT DISTINCT StoreName FROM ThirdpartyAttendance WHERE AttendanceDate >= '2026-03-01' ORDER BY StoreName
        `);
        stores.recordset.forEach(s => console.log('  ' + s.StoreName));
        
        await pool.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

debug();
