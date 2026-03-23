/**
 * Security Employee Calendar - View and update store visit status
 * Read-only schedule view with status update capability
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');

// Database configuration
const dbConfig = {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'OEApp_UAT',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'Kokowawa123@@',
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_TRUST_CERT === 'true'
    },
    pool: {
        max: 50,
        min: 5,
        idleTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000
    }
};

let poolPromise = null;
let pool = null;

async function getPool() {
    if (pool && pool.connected) return pool;
    if (pool && !pool.connected) { poolPromise = null; pool = null; }
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).then(newPool => {
            pool = newPool;
            pool.on('error', err => { poolPromise = null; pool = null; });
            return pool;
        }).catch(err => { poolPromise = null; pool = null; throw err; });
    }
    return poolPromise;
}

// Main calendar page
router.get('/', async (req, res) => {
    const user = req.currentUser;
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Visit Schedule - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }
                
                .header {
                    background: linear-gradient(135deg, #37474f 0%, #455a64 100%);
                    color: white;
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header h1 { font-size: 22px; }
                .header-nav { display: flex; gap: 15px; align-items: center; }
                .header-nav a {
                    color: white;
                    text-decoration: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.15);
                }
                .header-nav a:hover { background: rgba(255,255,255,0.25); }
                
                .container { padding: 20px; max-width: 1400px; margin: 0 auto; }
                
                /* Calendar Styles */
                .calendar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    background: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .calendar-nav { display: flex; gap: 10px; align-items: center; }
                .calendar-nav button {
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .calendar-nav button:hover { background: #f5f5f5; }
                .calendar-title { font-size: 20px; font-weight: 600; min-width: 200px; text-align: center; }
                
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: #e0e0e0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .calendar-day-header {
                    background: #37474f;
                    color: white;
                    padding: 12px;
                    text-align: center;
                    font-weight: 600;
                }
                .calendar-day {
                    background: white;
                    min-height: 120px;
                    padding: 8px;
                    vertical-align: top;
                }
                .calendar-day.other-month { background: #f5f5f5; }
                .calendar-day.today { background: #e3f2fd; }
                .day-number {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 5px;
                    color: #333;
                }
                .calendar-day.other-month .day-number { color: #999; }
                .calendar-day.today .day-number { color: #1e3c72; }
                
                .visit-item {
                    background: #e8f5e9;
                    border-left: 3px solid #4CAF50;
                    padding: 4px 8px;
                    margin-bottom: 4px;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .visit-item:hover { background: #c8e6c9; }
                .visit-item.completed { background: #e0e0e0; border-left-color: #9e9e9e; }
                .visit-item.cancelled { background: #ffebee; border-left-color: #f44336; text-decoration: line-through; }
                .visit-employee { font-weight: 600; color: #333; }
                .visit-store { color: #666; }
                
                /* Modal */
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal.active { display: flex; }
                .modal-content {
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    width: 450px;
                    max-width: 95%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .modal h3 { margin-bottom: 20px; color: #333; }
                .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; }
                .detail-label { font-size: 12px; color: #666; margin-bottom: 3px; }
                .detail-value { font-size: 15px; color: #333; font-weight: 500; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
                .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                }
                .form-group textarea { min-height: 80px; resize: vertical; }
                .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
                .modal-actions button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .btn-save { background: #4CAF50; color: white; }
                .btn-cancel { background: #f5f5f5; color: #333; }
                
                .status-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-scheduled { background: #e3f2fd; color: #1976d2; }
                .status-completed { background: #e8f5e9; color: #388e3c; }
                .status-cancelled { background: #ffebee; color: #d32f2f; }
                
                .notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    padding: 15px 25px;
                    border-radius: 8px;
                    color: white;
                    z-index: 2000;
                    animation: slideIn 0.3s ease;
                }
                .notification.success { background: #4CAF50; }
                .notification.error { background: #f44336; }
                @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                
                .loading { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); display: flex; justify-content: center; align-items: center; z-index: 3000; }
                .loading.hidden { display: none; }
                .spinner { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #37474f; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                
                .legend {
                    display: flex;
                    gap: 20px;
                    margin-top: 15px;
                    padding: 10px;
                    background: white;
                    border-radius: 8px;
                }
                .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
                .legend-color { width: 16px; height: 16px; border-radius: 3px; border-left: 3px solid; }
                .legend-scheduled { background: #e8f5e9; border-left-color: #4CAF50; }
                .legend-completed { background: #e0e0e0; border-left-color: #9e9e9e; }
                .legend-cancelled { background: #ffebee; border-left-color: #f44336; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📅 Visit Schedule</h1>
                <div class="header-nav">
                    <span>Welcome, ${user ? (user.displayName || user.name || 'User') : 'User'}</span>
                    <a href="/dashboard">🏠 Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="calendar-header">
                    <div class="calendar-nav">
                        <button onclick="prevMonth()">◀ Previous</button>
                        <div class="calendar-title" id="calendarTitle">February 2026</div>
                        <button onclick="nextMonth()">Next ▶</button>
                        <button onclick="goToToday()" style="margin-left: 10px;">Today</button>
                    </div>
                </div>
                <div class="calendar-grid" id="calendarGrid">
                    <!-- Calendar days will be rendered here -->
                </div>
                <div class="legend">
                    <div class="legend-item"><div class="legend-color legend-scheduled"></div> Scheduled</div>
                    <div class="legend-item"><div class="legend-color legend-completed"></div> Completed</div>
                    <div class="legend-item"><div class="legend-color legend-cancelled"></div> Cancelled</div>
                </div>
            </div>
            
            <div class="loading hidden" id="loading"><div class="spinner"></div></div>
            
            <!-- Visit Detail Modal -->
            <div class="modal" id="visitModal">
                <div class="modal-content">
                    <h3>📋 Visit Details</h3>
                    <input type="hidden" id="visitId">
                    <div class="detail-row">
                        <div class="detail-label">Date</div>
                        <div class="detail-value" id="detailDate">-</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Employee</div>
                        <div class="detail-value" id="detailEmployee">-</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Store</div>
                        <div class="detail-value" id="detailStore">-</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Visit Type</div>
                        <div class="detail-value" id="detailType">-</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Notes</div>
                        <div class="detail-value" id="detailNotes">-</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Current Status</div>
                        <div class="detail-value"><span class="status-badge" id="detailStatus">-</span></div>
                    </div>
                    <hr style="margin: 20px 0;">
                    <div class="form-group">
                        <label>Update Status</label>
                        <select id="newStatus">
                            <option value="Scheduled">📅 Scheduled</option>
                            <option value="Completed">✅ Completed</option>
                            <option value="Cancelled">❌ Cancelled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status Notes (optional)</label>
                        <textarea id="statusNotes" placeholder="Add any notes about the status update..."></textarea>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-cancel" onclick="closeModal()">Close</button>
                        <button class="btn-save" onclick="updateStatus()">💾 Update Status</button>
                    </div>
                </div>
            </div>
            
            <script>
                let currentDate = new Date();
                let visits = [];
                
                window.addEventListener('DOMContentLoaded', async () => {
                    renderCalendar();
                    loadVisits();
                });
                
                function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
                function hideLoading() { document.getElementById('loading').classList.add('hidden'); }
                
                function showNotification(message, type = 'success') {
                    const notif = document.createElement('div');
                    notif.className = 'notification ' + type;
                    notif.textContent = message;
                    document.body.appendChild(notif);
                    setTimeout(() => notif.remove(), 3000);
                }
                
                function renderCalendar() {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                       'July', 'August', 'September', 'October', 'November', 'December'];
                    document.getElementById('calendarTitle').textContent = monthNames[month] + ' ' + year;
                    
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDay = firstDay.getDay();
                    const daysInMonth = lastDay.getDate();
                    
                    const today = new Date();
                    const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
                    
                    let html = '';
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    dayNames.forEach(d => {
                        html += '<div class="calendar-day-header">' + d + '</div>';
                    });
                    
                    // Previous month days
                    const prevMonth = new Date(year, month, 0);
                    const prevMonthDays = prevMonth.getDate();
                    for (let i = startDay - 1; i >= 0; i--) {
                        const day = prevMonthDays - i;
                        const dateStr = formatDate(year, month - 1, day);
                        html += '<div class="calendar-day other-month" data-date="' + dateStr + '">';
                        html += '<div class="day-number">' + day + '</div>';
                        html += renderVisitsForDate(dateStr);
                        html += '</div>';
                    }
                    
                    // Current month days
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = formatDate(year, month, day);
                        const isToday = dateStr === todayStr;
                        html += '<div class="calendar-day' + (isToday ? ' today' : '') + '" data-date="' + dateStr + '">';
                        html += '<div class="day-number">' + day + '</div>';
                        html += renderVisitsForDate(dateStr);
                        html += '</div>';
                    }
                    
                    // Next month days
                    const totalCells = startDay + daysInMonth;
                    const remainingCells = (7 - (totalCells % 7)) % 7;
                    for (let day = 1; day <= remainingCells; day++) {
                        const dateStr = formatDate(year, month + 1, day);
                        html += '<div class="calendar-day other-month" data-date="' + dateStr + '">';
                        html += '<div class="day-number">' + day + '</div>';
                        html += renderVisitsForDate(dateStr);
                        html += '</div>';
                    }
                    
                    document.getElementById('calendarGrid').innerHTML = html;
                }
                
                function formatDate(year, month, day) {
                    // Manually format to avoid timezone issues with toISOString()
                    const y = year;
                    const m = String(month + 1).padStart(2, '0');
                    const d = String(day).padStart(2, '0');
                    return y + '-' + m + '-' + d;
                }
                
                function renderVisitsForDate(dateStr) {
                    const dayVisits = visits.filter(v => v.VisitDate && v.VisitDate.split('T')[0] === dateStr);
                    let html = '';
                    dayVisits.forEach(v => {
                        const statusClass = v.Status === 'Completed' ? 'completed' : (v.Status === 'Cancelled' ? 'cancelled' : '');
                        html += '<div class="visit-item ' + statusClass + '" onclick="openVisitModal(' + v.Id + ')">';
                        html += '<div class="visit-employee">' + v.EmployeeName + '</div>';
                        html += '<div class="visit-store">' + v.StoreName + '</div>';
                        html += '</div>';
                    });
                    return html;
                }
                
                async function loadVisits() {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    // Get start of previous month and end of next month
                    const startMonth = month - 1;
                    const startYear = startMonth < 0 ? year - 1 : year;
                    const startMonthAdj = startMonth < 0 ? 11 : startMonth;
                    const startDate = formatDate(startYear, startMonthAdj, 1);
                    
                    // End of next month
                    const endDateObj = new Date(year, month + 2, 0);
                    const endDate = formatDate(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
                    
                    try {
                        const res = await fetch('/security-emp/calendar/api/visits?startDate=' + startDate + '&endDate=' + endDate);
                        visits = await res.json();
                        renderCalendar();
                    } catch (error) {
                        console.error('Error loading visits:', error);
                    }
                }
                
                function prevMonth() {
                    currentDate.setMonth(currentDate.getMonth() - 1);
                    loadVisits();
                }
                
                function nextMonth() {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    loadVisits();
                }
                
                function goToToday() {
                    currentDate = new Date();
                    loadVisits();
                }
                
                function openVisitModal(id) {
                    const visit = visits.find(v => v.Id === id);
                    if (!visit) return;
                    
                    document.getElementById('visitId').value = visit.Id;
                    document.getElementById('detailDate').textContent = new Date(visit.VisitDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    document.getElementById('detailEmployee').textContent = visit.EmployeeName;
                    document.getElementById('detailStore').textContent = visit.StoreName;
                    document.getElementById('detailType').textContent = visit.VisitType || 'Not specified';
                    document.getElementById('detailNotes').textContent = visit.Notes || 'No notes';
                    
                    const statusBadge = document.getElementById('detailStatus');
                    statusBadge.textContent = visit.Status;
                    statusBadge.className = 'status-badge status-' + visit.Status.toLowerCase();
                    
                    document.getElementById('newStatus').value = visit.Status;
                    document.getElementById('statusNotes').value = '';
                    
                    document.getElementById('visitModal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('visitModal').classList.remove('active');
                }
                
                async function updateStatus() {
                    const id = document.getElementById('visitId').value;
                    const status = document.getElementById('newStatus').value;
                    const notes = document.getElementById('statusNotes').value;
                    
                    showLoading();
                    try {
                        const res = await fetch('/security-emp/calendar/api/visits/' + id + '/status', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status, notes })
                        });
                        
                        const result = await res.json();
                        if (result.success) {
                            showNotification('Status updated to ' + status);
                            closeModal();
                            loadVisits();
                        } else {
                            showNotification(result.error || 'Error updating status', 'error');
                        }
                    } catch (error) {
                        showNotification('Error updating status', 'error');
                    }
                    hideLoading();
                }
            </script>
        </body>
        </html>
    `);
});

// API: Get visits for date range
router.get('/api/visits', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('startDate', sql.NVarChar, startDate)
            .input('endDate', sql.NVarChar, endDate)
            .query(`
                SELECT Id, CONVERT(VARCHAR(10), VisitDate, 120) as VisitDate, 
                       EmployeeName, StoreName, VisitType, Notes, Status, IsActive,
                       CreatedBy, CreatedAt, UpdatedAt, CompletedAt
                FROM StoreVisitSchedule 
                WHERE VisitDate BETWEEN CONVERT(DATE, @startDate) AND CONVERT(DATE, @endDate)
                AND IsActive = 1
                ORDER BY VisitDate, EmployeeName
            `);
        
        res.json(result.recordset);
    } catch (error) {
        console.error('Error loading visits:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Update visit status
router.put('/api/visits/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        // Append status notes to existing notes
        const updateNotes = notes ? ` | Status update (${new Date().toLocaleDateString()}): ${notes}` : '';
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .input('updateNotes', sql.NVarChar, updateNotes)
            .input('updatedBy', sql.NVarChar, user ? user.displayName : 'System')
            .query(`
                UPDATE StoreVisitSchedule SET
                    Status = @status,
                    Notes = ISNULL(Notes, '') + @updateNotes,
                    CompletedAt = CASE WHEN @status = 'Completed' THEN GETDATE() ELSE CompletedAt END,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
