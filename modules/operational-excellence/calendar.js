/**
 * Store Visit Calendar - Schedule employee store visits
 * Calendar interface with reporting
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
            <title>Store Visit Calendar - ${process.env.APP_NAME || 'OE App'}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }
                
                .header {
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
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
                
                .container { padding: 20px; max-width: 1600px; margin: 0 auto; }
                
                .tabs {
                    display: flex;
                    gap: 5px;
                    margin-bottom: 20px;
                }
                .tab {
                    padding: 12px 24px;
                    cursor: pointer;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-weight: 500;
                    color: #666;
                }
                .tab:hover { background: #f5f5f5; }
                .tab.active { background: #1e3c72; color: white; border-color: #1e3c72; }
                
                .tab-content { display: none; }
                .tab-content.active { display: block; }
                
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
                
                .calendar-actions { display: flex; gap: 10px; }
                .btn-add {
                    padding: 10px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .btn-add:hover { background: #43a047; }
                .btn-recurring {
                    padding: 10px 20px;
                    background: #9C27B0;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .btn-recurring:hover { background: #7B1FA2; }
                
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: #e0e0e0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .calendar-day-header {
                    background: #1e3c72;
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
                    width: 500px;
                    max-width: 95%;
                    max-height: 90vh;
                    overflow-y: auto;
                }
                .modal h3 { margin-bottom: 20px; color: #333; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
                .form-group input, .form-group select, .form-group textarea {
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
                .btn-delete { background: #f44336; color: white; }
                
                /* Reports */
                .report-filters {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }
                .filter-group { display: flex; flex-direction: column; gap: 5px; }
                .filter-group label { font-size: 12px; font-weight: 500; color: #666; }
                .filter-group input, .filter-group select {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                }
                .btn-filter {
                    padding: 8px 20px;
                    background: #1e3c72;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }
                
                .report-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .report-card {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .report-card h4 { color: #666; font-size: 14px; margin-bottom: 10px; }
                .report-card .value { font-size: 32px; font-weight: 700; color: #1e3c72; }
                .report-card .subtitle { font-size: 12px; color: #999; margin-top: 5px; }
                
                .report-table {
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                }
                .report-table table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .report-table th, .report-table td {
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid #eee;
                }
                .report-table th { background: #f8f9fa; font-weight: 600; color: #333; }
                .report-table tr:hover { background: #f5f8ff; }
                
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
                .spinner { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #1e3c72; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📅 Store Visit Calendar</h1>
                <div class="header-nav">
                    <span>Welcome, ${user ? (user.displayName || user.name || 'User') : 'User'}</span>
                    <a href="/dashboard">🏠 Dashboard</a>
                </div>
            </div>
            
            <div class="container">
                <div class="tabs">
                    <div class="tab active" data-tab="calendar">📅 Calendar</div>
                    <div class="tab" data-tab="reports">📊 Reports</div>
                </div>
                
                <!-- Calendar Tab -->
                <div class="tab-content active" id="tab-calendar">
                    <div class="calendar-header">
                        <div class="calendar-nav">
                            <button onclick="prevMonth()">◀ Previous</button>
                            <div class="calendar-title" id="calendarTitle">February 2026</div>
                            <button onclick="nextMonth()">Next ▶</button>
                            <button onclick="goToToday()" style="margin-left: 10px;">Today</button>
                        </div>
                        <div class="calendar-actions">
                            <button class="btn-add" onclick="openAddModal()">➕ Schedule Visit</button>
                            <button class="btn-recurring" onclick="openRecurringModal()">🔄 Recurring Visit</button>
                        </div>
                    </div>
                    <div class="calendar-grid" id="calendarGrid">
                        <!-- Calendar days will be rendered here -->
                    </div>
                </div>
                
                <!-- Reports Tab -->
                <div class="tab-content" id="tab-reports">
                    <div class="report-filters">
                        <div class="filter-group">
                            <label>From Date</label>
                            <input type="date" id="reportFromDate">
                        </div>
                        <div class="filter-group">
                            <label>To Date</label>
                            <input type="date" id="reportToDate">
                        </div>
                        <div class="filter-group">
                            <label>Employee</label>
                            <select id="reportEmployee">
                                <option value="">All Employees</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Store</label>
                            <select id="reportStore">
                                <option value="">All Stores</option>
                            </select>
                        </div>
                        <button class="btn-filter" onclick="loadReports()">🔍 Generate Report</button>
                    </div>
                    
                    <div class="report-cards" id="reportCards">
                        <!-- Summary cards -->
                    </div>
                    
                    <div class="report-table" id="reportTable">
                        <!-- Report data -->
                    </div>
                </div>
            </div>
            
            <div class="loading hidden" id="loading"><div class="spinner"></div></div>
            
            <!-- Recurring Visit Modal -->
            <div class="modal" id="recurringModal">
                <div class="modal-content">
                    <h3>🔄 Schedule Recurring Visits</h3>
                    <div class="form-group">
                        <label>Start Date *</label>
                        <input type="date" id="recurStartDate" required>
                    </div>
                    <div class="form-group">
                        <label>End Date *</label>
                        <input type="date" id="recurEndDate" required>
                    </div>
                    <div class="form-group">
                        <label>Frequency *</label>
                        <select id="recurFrequency">
                            <option value="weekly">Weekly (same day each week)</option>
                            <option value="biweekly">Every 2 Weeks</option>
                            <option value="monthly">Monthly (same day each month)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Employee *</label>
                        <select id="recurEmployee" required>
                            <option value="">-- Select Employee --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Store *</label>
                        <select id="recurStore" required>
                            <option value="">-- Select Store --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Visit Type</label>
                        <select id="recurVisitType">
                            <option value="Inspection">Inspection</option>
                            <option value="Observation">Observation</option>
                            <option value="Follow-up">Follow-up</option>
                            <option value="Training">Training</option>
                            <option value="Audit">Audit</option>
                            <option value="Meeting">Meeting</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea id="recurNotes" placeholder="Additional notes..."></textarea>
                    </div>
                    <div id="recurPreview" style="background:#f5f5f5; padding:10px; border-radius:6px; margin-bottom:15px; display:none;">
                        <strong>📋 Preview:</strong> <span id="recurCount">0</span> visits will be created
                        <div id="recurDates" style="font-size:12px; color:#666; max-height:100px; overflow-y:auto; margin-top:5px;"></div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-cancel" onclick="closeRecurringModal()">Cancel</button>
                        <button class="btn-save" onclick="saveRecurringVisits()" style="background:#9C27B0;">🔄 Create Recurring Visits</button>
                    </div>
                </div>
            </div>
            
            <!-- Add/Edit Visit Modal -->
            <div class="modal" id="visitModal">
                <div class="modal-content">
                    <h3 id="modalTitle">📅 Schedule Store Visit</h3>
                    <input type="hidden" id="visitId">
                    <div class="form-group">
                        <label>Visit Date *</label>
                        <input type="date" id="visitDate" required>
                    </div>
                    <div class="form-group">
                        <label>Employee(s) * <span id="selectedCount" style="font-size:12px; color:#666;">(0 selected)</span></label>
                        <div id="employeeSelectContainer" style="position:relative;">
                            <div id="employeeSelectBtn" onclick="toggleEmployeeDropdown()" style="border:1px solid #ddd; padding:10px; border-radius:6px; cursor:pointer; background:#fff; display:flex; justify-content:space-between; align-items:center;">
                                <span id="employeeSelectText">-- Select Employees --</span>
                                <span>▼</span>
                            </div>
                            <div id="employeeDropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #ddd; border-radius:6px; max-height:250px; overflow-y:auto; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                                <div style="padding:8px; border-bottom:1px solid #eee;">
                                    <input type="text" id="employeeSearch" placeholder="Search employees..." oninput="filterEmployees()" style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">
                                </div>
                                <div id="employeeCheckboxes" style="padding:5px;"></div>
                            </div>
                        </div>
                        <input type="hidden" id="visitEmployee">
                    </div>
                    <div class="form-group">
                        <label>Store *</label>
                        <select id="visitStore" required>
                            <option value="">-- Select Store --</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Visit Type</label>
                        <select id="visitType">
                            <option value="Inspection">Inspection</option>
                            <option value="Observation">Observation</option>
                            <option value="Follow-up">Follow-up</option>
                            <option value="Training">Training</option>
                            <option value="Audit">Audit</option>
                            <option value="Meeting">Meeting</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea id="visitNotes" placeholder="Additional notes..."></textarea>
                    </div>
                    <div class="form-group" id="statusGroup" style="display: none;">
                        <label>Status</label>
                        <select id="visitStatus">
                            <option value="Scheduled">Scheduled</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-delete" id="btnDelete" style="display: none;" onclick="deleteVisit()">🗑️ Delete</button>
                        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                        <button class="btn-save" onclick="saveVisit()">💾 Save</button>
                    </div>
                </div>
            </div>
            
            <script>
                let currentDate = new Date();
                let visits = [];
                let employees = [];
                let stores = [];
                
                // Tab switching
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        tab.classList.add('active');
                        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
                        if (tab.dataset.tab === 'reports') {
                            loadReportFilters();
                        }
                    });
                });
                
                // Initialize
                window.addEventListener('DOMContentLoaded', async () => {
                    await loadEmployeesAndStores();
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
                
                async function loadEmployeesAndStores() {
                    try {
                        const [empRes, storeRes] = await Promise.all([
                            fetch('/operational-excellence/calendar/api/employees'),
                            fetch('/operational-excellence/system-settings/api/stores')
                        ]);
                        employees = await empRes.json();
                        stores = await storeRes.json();
                        
                        // Populate dropdowns
                        const empSelect = document.getElementById('visitEmployee');
                        const storeSelect = document.getElementById('visitStore');
                        const recurEmpSelect = document.getElementById('recurEmployee');
                        const recurStoreSelect = document.getElementById('recurStore');
                        
                        // Build checkbox list for multi-select
                        const checkboxContainer = document.getElementById('employeeCheckboxes');
                        employees.forEach(emp => {
                            const label = document.createElement('label');
                            label.className = 'emp-checkbox-label';
                            label.style.cssText = 'display:flex; align-items:center; padding:8px 10px; cursor:pointer; border-bottom:1px solid #f0f0f0;';
                            label.onmouseover = function() { this.style.background = '#f5f5f5'; };
                            label.onmouseout = function() { this.style.background = '#fff'; };
                            
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.className = 'emp-checkbox';
                            checkbox.value = emp.displayName;
                            checkbox.style.cssText = 'margin-right:10px; width:18px; height:18px;';
                            checkbox.addEventListener('change', updateSelectedEmployees);
                            
                            const text = document.createTextNode(' ' + emp.displayName);
                            label.appendChild(checkbox);
                            label.appendChild(text);
                            checkboxContainer.appendChild(label);
                            recurEmpSelect.innerHTML += '<option value="' + emp.displayName + '">' + emp.displayName + '</option>';
                        });
                        
                        stores.forEach(store => {
                            storeSelect.innerHTML += '<option value="' + store.StoreName + '" data-id="' + store.Id + '">' + store.StoreName + '</option>';
                            recurStoreSelect.innerHTML += '<option value="' + store.StoreName + '">' + store.StoreName + '</option>';
                        });
                    } catch (error) {
                        console.error('Error loading data:', error);
                    }
                }
                
                // Multi-select employee functions
                let selectedEmployees = [];
                
                function toggleEmployeeDropdown() {
                    const dropdown = document.getElementById('employeeDropdown');
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                    if (dropdown.style.display === 'block') {
                        document.getElementById('employeeSearch').focus();
                    }
                }
                
                function filterEmployees() {
                    const search = document.getElementById('employeeSearch').value.toLowerCase();
                    document.querySelectorAll('.emp-checkbox-label').forEach(label => {
                        const name = label.textContent.toLowerCase();
                        label.style.display = name.includes(search) ? 'flex' : 'none';
                    });
                }
                
                function updateSelectedEmployees() {
                    selectedEmployees = [];
                    document.querySelectorAll('.emp-checkbox:checked').forEach(cb => {
                        selectedEmployees.push(cb.value);
                    });
                    
                    document.getElementById('selectedCount').textContent = '(' + selectedEmployees.length + ' selected)';
                    
                    if (selectedEmployees.length === 0) {
                        document.getElementById('employeeSelectText').textContent = '-- Select Employees --';
                    } else if (selectedEmployees.length === 1) {
                        document.getElementById('employeeSelectText').textContent = selectedEmployees[0];
                    } else {
                        document.getElementById('employeeSelectText').textContent = selectedEmployees.length + ' employees selected';
                    }
                    
                    document.getElementById('visitEmployee').value = selectedEmployees.join(',');
                }
                
                function clearEmployeeSelection() {
                    selectedEmployees = [];
                    document.querySelectorAll('.emp-checkbox').forEach(cb => cb.checked = false);
                    document.getElementById('selectedCount').textContent = '(0 selected)';
                    document.getElementById('employeeSelectText').textContent = '-- Select Employees --';
                    document.getElementById('visitEmployee').value = '';
                    document.getElementById('employeeSearch').value = '';
                    filterEmployees();
                }
                
                function setEmployeeSelection(names) {
                    clearEmployeeSelection();
                    const nameArray = Array.isArray(names) ? names : [names];
                    document.querySelectorAll('.emp-checkbox').forEach(cb => {
                        if (nameArray.includes(cb.value)) {
                            cb.checked = true;
                        }
                    });
                    updateSelectedEmployees();
                }
                
                // Close dropdown when clicking outside
                document.addEventListener('click', function(e) {
                    const container = document.getElementById('employeeSelectContainer');
                    if (container && !container.contains(e.target)) {
                        document.getElementById('employeeDropdown').style.display = 'none';
                    }
                });
                
                function renderCalendar() {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                       'July', 'August', 'September', 'October', 'November', 'December'];
                    document.getElementById('calendarTitle').textContent = monthNames[month] + ' ' + year;
                    
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDay = firstDay.getDay(); // 0 = Sunday
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
                        html += '<div class="visit-item ' + statusClass + '" onclick="openEditModal(' + v.Id + ')">';
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
                    // Use Date object for day calculations but format manually
                    const startMonth = month - 1;
                    const startYear = startMonth < 0 ? year - 1 : year;
                    const startMonthAdj = startMonth < 0 ? 11 : startMonth;
                    const startDate = formatDate(startYear, startMonthAdj, 1);
                    
                    // End of next month (day 0 of month+3 gives last day of month+2)
                    const endDateObj = new Date(year, month + 2, 0);
                    const endDate = formatDate(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
                    
                    try {
                        const res = await fetch('/operational-excellence/calendar/api/visits?startDate=' + startDate + '&endDate=' + endDate);
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
                
                function openAddModal(date) {
                    document.getElementById('modalTitle').textContent = '📅 Schedule Store Visit';
                    document.getElementById('visitId').value = '';
                    const today = new Date();
                    document.getElementById('visitDate').value = date || formatDate(today.getFullYear(), today.getMonth(), today.getDate());
                    clearEmployeeSelection();
                    document.getElementById('visitStore').value = '';
                    document.getElementById('visitType').value = 'Inspection';
                    document.getElementById('visitNotes').value = '';
                    document.getElementById('visitStatus').value = 'Scheduled';
                    document.getElementById('statusGroup').style.display = 'none';
                    document.getElementById('btnDelete').style.display = 'none';
                    document.getElementById('visitModal').classList.add('active');
                }
                
                function openEditModal(id) {
                    const visit = visits.find(v => v.Id === id);
                    if (!visit) return;
                    
                    document.getElementById('modalTitle').textContent = '✏️ Edit Store Visit';
                    document.getElementById('visitId').value = visit.Id;
                    document.getElementById('visitDate').value = visit.VisitDate.split('T')[0];
                    setEmployeeSelection(visit.EmployeeName);
                    document.getElementById('visitStore').value = visit.StoreName;
                    document.getElementById('visitType').value = visit.VisitType || 'Inspection';
                    document.getElementById('visitNotes').value = visit.Notes || '';
                    document.getElementById('visitStatus').value = visit.Status || 'Scheduled';
                    document.getElementById('statusGroup').style.display = 'block';
                    document.getElementById('btnDelete').style.display = 'inline-block';
                    document.getElementById('visitModal').classList.add('active');
                }
                
                function closeModal() {
                    document.getElementById('visitModal').classList.remove('active');
                }
                
                async function saveVisit() {
                    const id = document.getElementById('visitId').value;
                    const employeeNames = document.getElementById('visitEmployee').value;
                    const data = {
                        visitDate: document.getElementById('visitDate').value,
                        employeeNames: employeeNames ? employeeNames.split(',') : [],
                        storeName: document.getElementById('visitStore').value,
                        visitType: document.getElementById('visitType').value,
                        notes: document.getElementById('visitNotes').value,
                        status: document.getElementById('visitStatus').value
                    };
                    
                    if (!data.visitDate || data.employeeNames.length === 0 || !data.storeName) {
                        showNotification('Please fill required fields', 'error');
                        return;
                    }
                    
                    showLoading();
                    try {
                        // For edit (single employee), use the old endpoint
                        if (id) {
                            const res = await fetch('/operational-excellence/calendar/api/visits/' + id, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    visitDate: data.visitDate,
                                    employeeName: data.employeeNames[0],
                                    storeName: data.storeName,
                                    visitType: data.visitType,
                                    notes: data.notes,
                                    status: data.status
                                })
                            });
                            const result = await res.json();
                            if (result.success) {
                                showNotification('Visit updated!');
                                closeModal();
                                loadVisits();
                            } else {
                                showNotification(result.error || 'Error saving', 'error');
                            }
                        } else {
                            // For new visits, create one for each employee
                            const res = await fetch('/operational-excellence/calendar/api/visits/bulk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                            const result = await res.json();
                            if (result.success) {
                                const count = data.employeeNames.length;
                                showNotification(count + ' visit(s) scheduled!');
                                closeModal();
                                loadVisits();
                            } else {
                                showNotification(result.error || 'Error saving', 'error');
                            }
                        }
                    } catch (error) {
                        showNotification('Error saving visit', 'error');
                    }
                    hideLoading();
                }
                
                async function deleteVisit() {
                    const id = document.getElementById('visitId').value;
                    if (!id || !confirm('Delete this visit?')) return;
                    
                    showLoading();
                    try {
                        const res = await fetch('/operational-excellence/calendar/api/visits/' + id, { method: 'DELETE' });
                        const result = await res.json();
                        if (result.success) {
                            showNotification('Visit deleted');
                            closeModal();
                            loadVisits();
                        }
                    } catch (error) {
                        showNotification('Error deleting', 'error');
                    }
                    hideLoading();
                }
                
                // Recurring visits
                function openRecurringModal() {
                    const today = new Date();
                    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
                    document.getElementById('recurStartDate').value = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
                    document.getElementById('recurEndDate').value = formatDate(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonth.getDate());
                    document.getElementById('recurFrequency').value = 'weekly';
                    document.getElementById('recurEmployee').value = '';
                    document.getElementById('recurStore').value = '';
                    document.getElementById('recurVisitType').value = 'Inspection';
                    document.getElementById('recurNotes').value = '';
                    document.getElementById('recurPreview').style.display = 'none';
                    document.getElementById('recurringModal').classList.add('active');
                    
                    // Add event listeners for preview
                    ['recurStartDate', 'recurEndDate', 'recurFrequency'].forEach(id => {
                        document.getElementById(id).addEventListener('change', updateRecurPreview);
                    });
                }
                
                function closeRecurringModal() {
                    document.getElementById('recurringModal').classList.remove('active');
                }
                
                function calculateRecurringDates() {
                    const startDate = new Date(document.getElementById('recurStartDate').value);
                    const endDate = new Date(document.getElementById('recurEndDate').value);
                    const frequency = document.getElementById('recurFrequency').value;
                    const dates = [];
                    
                    if (!startDate || !endDate || startDate > endDate) return dates;
                    
                    let current = new Date(startDate);
                    while (current <= endDate) {
                        dates.push(new Date(current));
                        
                        if (frequency === 'weekly') {
                            current.setDate(current.getDate() + 7);
                        } else if (frequency === 'biweekly') {
                            current.setDate(current.getDate() + 14);
                        } else if (frequency === 'monthly') {
                            current.setMonth(current.getMonth() + 1);
                        }
                    }
                    
                    return dates;
                }
                
                function updateRecurPreview() {
                    const dates = calculateRecurringDates();
                    const previewDiv = document.getElementById('recurPreview');
                    const countSpan = document.getElementById('recurCount');
                    const datesDiv = document.getElementById('recurDates');
                    
                    if (dates.length > 0) {
                        previewDiv.style.display = 'block';
                        countSpan.textContent = dates.length;
                        datesDiv.innerHTML = dates.map(d => d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })).join('<br>');
                    } else {
                        previewDiv.style.display = 'none';
                    }
                }
                
                async function saveRecurringVisits() {
                    const data = {
                        startDate: document.getElementById('recurStartDate').value,
                        endDate: document.getElementById('recurEndDate').value,
                        frequency: document.getElementById('recurFrequency').value,
                        employeeName: document.getElementById('recurEmployee').value,
                        storeName: document.getElementById('recurStore').value,
                        visitType: document.getElementById('recurVisitType').value,
                        notes: document.getElementById('recurNotes').value
                    };
                    
                    if (!data.startDate || !data.endDate || !data.employeeName || !data.storeName) {
                        showNotification('Please fill all required fields', 'error');
                        return;
                    }
                    
                    const dates = calculateRecurringDates();
                    if (dates.length === 0) {
                        showNotification('No valid dates in the range', 'error');
                        return;
                    }
                    
                    if (dates.length > 52) {
                        if (!confirm('This will create ' + dates.length + ' visits. Are you sure?')) return;
                    }
                    
                    showLoading();
                    try {
                        const res = await fetch('/operational-excellence/calendar/api/visits/recurring', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        
                        const result = await res.json();
                        if (result.success) {
                            showNotification(result.count + ' recurring visits created!');
                            closeRecurringModal();
                            loadVisits();
                        } else {
                            showNotification(result.error || 'Error creating recurring visits', 'error');
                        }
                    } catch (error) {
                        showNotification('Error creating recurring visits', 'error');
                    }
                    hideLoading();
                }
                
                // Reports
                function loadReportFilters() {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    document.getElementById('reportFromDate').value = formatDate(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate());
                    document.getElementById('reportToDate').value = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
                    
                    // Populate employee filter
                    const empFilter = document.getElementById('reportEmployee');
                    empFilter.innerHTML = '<option value="">All Employees</option>';
                    employees.forEach(emp => {
                        empFilter.innerHTML += '<option value="' + emp.displayName + '">' + emp.displayName + '</option>';
                    });
                    
                    // Populate store filter
                    const storeFilter = document.getElementById('reportStore');
                    storeFilter.innerHTML = '<option value="">All Stores</option>';
                    stores.forEach(store => {
                        storeFilter.innerHTML += '<option value="' + store.StoreName + '">' + store.StoreName + '</option>';
                    });
                    
                    loadReports();
                }
                
                async function loadReports() {
                    showLoading();
                    const params = new URLSearchParams({
                        fromDate: document.getElementById('reportFromDate').value,
                        toDate: document.getElementById('reportToDate').value,
                        employee: document.getElementById('reportEmployee').value,
                        store: document.getElementById('reportStore').value
                    });
                    
                    try {
                        const res = await fetch('/operational-excellence/calendar/api/reports?' + params);
                        const data = await res.json();
                        
                        // Render summary cards
                        document.getElementById('reportCards').innerHTML = \`
                            <div class="report-card">
                                <h4>Total Visits</h4>
                                <div class="value">\${data.summary.totalVisits}</div>
                                <div class="subtitle">Scheduled visits</div>
                            </div>
                            <div class="report-card">
                                <h4>Completed</h4>
                                <div class="value" style="color: #4CAF50;">\${data.summary.completed}</div>
                                <div class="subtitle">\${data.summary.totalVisits > 0 ? Math.round(data.summary.completed / data.summary.totalVisits * 100) : 0}% completion rate</div>
                            </div>
                            <div class="report-card">
                                <h4>Unique Stores</h4>
                                <div class="value">\${data.summary.uniqueStores}</div>
                                <div class="subtitle">Stores visited</div>
                            </div>
                            <div class="report-card">
                                <h4>Active Employees</h4>
                                <div class="value">\${data.summary.uniqueEmployees}</div>
                                <div class="subtitle">Employees with visits</div>
                            </div>
                        \`;
                        
                        // Render table
                        let tableHtml = '<h3 style="padding: 15px; background: #f8f9fa;">📊 Visit Details</h3>';
                        tableHtml += '<table><thead><tr>';
                        tableHtml += '<th>Employee</th><th>Store</th><th>Visits</th><th>Completed</th><th>Pending</th>';
                        tableHtml += '</tr></thead><tbody>';
                        
                        data.details.forEach(row => {
                            tableHtml += '<tr>';
                            tableHtml += '<td>' + row.EmployeeName + '</td>';
                            tableHtml += '<td>' + row.StoreName + '</td>';
                            tableHtml += '<td>' + row.TotalVisits + '</td>';
                            tableHtml += '<td style="color:#4CAF50;">' + row.CompletedVisits + '</td>';
                            tableHtml += '<td style="color:#ff9800;">' + row.PendingVisits + '</td>';
                            tableHtml += '</tr>';
                        });
                        
                        if (data.details.length === 0) {
                            tableHtml += '<tr><td colspan="5" style="text-align:center;color:#999;">No visits found for selected filters</td></tr>';
                        }
                        
                        tableHtml += '</tbody></table>';
                        document.getElementById('reportTable').innerHTML = tableHtml;
                    } catch (error) {
                        console.error('Error loading reports:', error);
                    }
                    hideLoading();
                }
            </script>
        </body>
        </html>
    `);
});

// API: Get employees (from Azure AD or Users table)
router.get('/api/employees', async (req, res) => {
    try {
        const pool = await getPool();
        // Get users who have specific security/OE roles
        const result = await pool.request().query(`
            SELECT DISTINCT u.Id, u.DisplayName as displayName, u.Email as mail
            FROM Users u
            INNER JOIN UserRoleAssignments ura ON ura.UserId = u.Id
            INNER JOIN UserRoles ur ON ur.Id = ura.RoleId
            WHERE u.IsActive = 1
            AND ur.RoleName IN ('Program Lead', 'Regional Security Manager', 'Security Compliance Inspector', 'Security Service Provider', 'Compliance Inspector')
            ORDER BY u.DisplayName
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Error loading employees:', error);
        res.status(500).json({ error: error.message });
    }
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

// API: Create visit
router.post('/api/visits', async (req, res) => {
    try {
        const { visitDate, employeeName, storeName, visitType, notes } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        // Use CONVERT to avoid timezone issues with DATE type
        await pool.request()
            .input('visitDate', sql.NVarChar, visitDate)
            .input('employeeName', sql.NVarChar, employeeName)
            .input('storeName', sql.NVarChar, storeName)
            .input('visitType', sql.NVarChar, visitType || 'Inspection')
            .input('notes', sql.NVarChar, notes || '')
            .input('createdBy', sql.NVarChar, user ? user.displayName : 'System')
            .query(`
                INSERT INTO StoreVisitSchedule (VisitDate, EmployeeName, StoreName, VisitType, Notes, CreatedBy)
                VALUES (CONVERT(DATE, @visitDate), @employeeName, @storeName, @visitType, @notes, @createdBy)
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error creating visit:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Create bulk visits (multiple employees)
router.post('/api/visits/bulk', async (req, res) => {
    try {
        const { visitDate, employeeNames, storeName, visitType, notes } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        if (!employeeNames || !Array.isArray(employeeNames) || employeeNames.length === 0) {
            return res.status(400).json({ error: 'No employees selected' });
        }
        
        // Create a visit for each employee
        for (const employeeName of employeeNames) {
            await pool.request()
                .input('visitDate', sql.NVarChar, visitDate)
                .input('employeeName', sql.NVarChar, employeeName)
                .input('storeName', sql.NVarChar, storeName)
                .input('visitType', sql.NVarChar, visitType || 'Inspection')
                .input('notes', sql.NVarChar, notes || '')
                .input('createdBy', sql.NVarChar, user ? user.displayName : 'System')
                .query(`
                    INSERT INTO StoreVisitSchedule (VisitDate, EmployeeName, StoreName, VisitType, Notes, CreatedBy)
                    VALUES (CONVERT(DATE, @visitDate), @employeeName, @storeName, @visitType, @notes, @createdBy)
                `);
        }
        
        res.json({ success: true, count: employeeNames.length });
    } catch (error) {
        console.error('Error creating bulk visits:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Create recurring visits
router.post('/api/visits/recurring', async (req, res) => {
    try {
        const { startDate, endDate, frequency, employeeName, storeName, visitType, notes } = req.body;
        const user = req.currentUser;
        const pool = await getPool();
        
        // Calculate all dates based on frequency
        const dates = [];
        let current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            dates.push(new Date(current));
            
            if (frequency === 'weekly') {
                current.setDate(current.getDate() + 7);
            } else if (frequency === 'biweekly') {
                current.setDate(current.getDate() + 14);
            } else if (frequency === 'monthly') {
                current.setMonth(current.getMonth() + 1);
            } else {
                break; // Unknown frequency, prevent infinite loop
            }
        }
        
        // Limit to prevent excessive inserts
        if (dates.length > 100) {
            return res.status(400).json({ error: 'Too many visits (max 100). Please reduce the date range.' });
        }
        
        // Insert all visits
        const recurringNote = notes ? notes + ' (Recurring - ' + frequency + ')' : 'Recurring - ' + frequency;
        
        for (const date of dates) {
            // Format date as YYYY-MM-DD string to avoid timezone issues
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const dateStr = y + '-' + m + '-' + d;
            await pool.request()
                .input('visitDate', sql.NVarChar, dateStr)
                .input('employeeName', sql.NVarChar, employeeName)
                .input('storeName', sql.NVarChar, storeName)
                .input('visitType', sql.NVarChar, visitType || 'Inspection')
                .input('notes', sql.NVarChar, recurringNote)
                .input('createdBy', sql.NVarChar, user ? user.displayName : 'System')
                .query(`
                    INSERT INTO StoreVisitSchedule (VisitDate, EmployeeName, StoreName, VisitType, Notes, CreatedBy)
                    VALUES (CONVERT(DATE, @visitDate), @employeeName, @storeName, @visitType, @notes, @createdBy)
                `);
        }
        
        res.json({ success: true, count: dates.length });
    } catch (error) {
        console.error('Error creating recurring visits:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Update visit
router.put('/api/visits/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { visitDate, employeeName, storeName, visitType, notes, status } = req.body;
        const pool = await getPool();
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('visitDate', sql.NVarChar, visitDate)
            .input('employeeName', sql.NVarChar, employeeName)
            .input('storeName', sql.NVarChar, storeName)
            .input('visitType', sql.NVarChar, visitType)
            .input('notes', sql.NVarChar, notes || '')
            .input('status', sql.NVarChar, status)
            .query(`
                UPDATE StoreVisitSchedule SET
                    VisitDate = CONVERT(DATE, @visitDate),
                    EmployeeName = @employeeName,
                    StoreName = @storeName,
                    VisitType = @visitType,
                    Notes = @notes,
                    Status = @status,
                    CompletedAt = CASE WHEN @status = 'Completed' THEN GETDATE() ELSE CompletedAt END,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating visit:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Delete visit
router.delete('/api/visits/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE StoreVisitSchedule SET IsActive = 0 WHERE Id = @id');
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting visit:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Reports
router.get('/api/reports', async (req, res) => {
    try {
        const { fromDate, toDate, employee, store } = req.query;
        const pool = await getPool();
        
        let whereClause = 'WHERE VisitDate BETWEEN @fromDate AND @toDate AND IsActive = 1';
        if (employee) whereClause += ' AND EmployeeName = @employee';
        if (store) whereClause += ' AND StoreName = @store';
        
        // Summary
        const summaryResult = await pool.request()
            .input('fromDate', sql.Date, fromDate)
            .input('toDate', sql.Date, toDate)
            .input('employee', sql.NVarChar, employee || '')
            .input('store', sql.NVarChar, store || '')
            .query(`
                SELECT 
                    COUNT(*) as totalVisits,
                    SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as completed,
                    COUNT(DISTINCT StoreName) as uniqueStores,
                    COUNT(DISTINCT EmployeeName) as uniqueEmployees
                FROM StoreVisitSchedule
                ${whereClause}
            `);
        
        // Details - visits by employee and store
        const detailsResult = await pool.request()
            .input('fromDate', sql.Date, fromDate)
            .input('toDate', sql.Date, toDate)
            .input('employee', sql.NVarChar, employee || '')
            .input('store', sql.NVarChar, store || '')
            .query(`
                SELECT 
                    EmployeeName,
                    StoreName,
                    COUNT(*) as TotalVisits,
                    SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as CompletedVisits,
                    SUM(CASE WHEN Status = 'Scheduled' THEN 1 ELSE 0 END) as PendingVisits
                FROM StoreVisitSchedule
                ${whereClause}
                GROUP BY EmployeeName, StoreName
                ORDER BY EmployeeName, StoreName
            `);
        
        res.json({
            summary: summaryResult.recordset[0],
            details: detailsResult.recordset
        });
    } catch (error) {
        console.error('Error loading reports:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
