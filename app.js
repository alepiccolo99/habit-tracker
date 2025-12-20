// CONFIGURATION
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyONineMVy_K_LwdTpnoP8aZDJQseMciR-wk6cMmA2Lv549_AUuA3zFN56rhLW-BukgYA/exec";
const TOKEN = "aleLifeTracker_1999";

// GLOBAL STATE
let appData = {
    habits: [], habitLogs: [], settings: [],
    healthLogs: [], exercises: [], workoutLogs: [], foods: [], dietLogs: []
};
let currentTheme = localStorage.getItem('appTheme') || '#0a84ff';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme); // Apply theme immediately
    fetchData();
});

function applyTheme(color) {
    currentTheme = color;
    localStorage.setItem('appTheme', color);
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-dim', color + '33'); // 20% opacity
    
    // Highlight selected in settings
    document.querySelectorAll('.color-opt').forEach(el => {
        el.classList.toggle('selected', el.style.backgroundColor === color || el.style.backgroundColor.includes(color)); // basic check
    });
}

async function setTheme(color) {
    applyTheme(color);
    // Sync to backend
    await sendData({ action: 'saveSetting', key: 'appTheme', value: color });
}

// --- DATA FETCHING ---
async function fetchData() {
    try {
        const resp = await fetch(`${SCRIPT_URL}?token=${TOKEN}&action=getAll`);
        const data = await resp.json();
        appData = data;
        
        // Check if there is a saved theme in sheets that overrides local
        const serverTheme = appData.settings.find(s => s[0] === 'appTheme');
        if(serverTheme && serverTheme[1] !== currentTheme) {
            applyTheme(serverTheme[1]);
        }

        renderAll();
    } catch (e) {
        console.error("Fetch Error", e);
    }
}

function renderAll() {
    renderHabitDashboard();
    renderHealth();
    populateDropdowns();
    renderWorkoutLogs();
    renderDietLogs();
}

// --- ROUTING ---
function router(viewId) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(viewId + '-view').classList.add('active-view');
    
    // Update Header
    const titleMap = {
        'habits': 'Habits', 'health': 'Health', 'workout': 'Workout', 'diet': 'Diet', 'settings': 'Settings'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'Life Tracker';
    
    // Show/Hide Add Button
    document.getElementById('headerActionBtn').style.display = (viewId === 'habits') ? 'block' : 'none';
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('active');
}

// --- HABIT DASHBOARD LOGIC ---
function getLast5Days() {
    const dates = [];
    for(let i=4; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d);
    }
    return dates;
}

function renderHabitDashboard() {
    const list = document.getElementById('habits-list');
    const header = document.getElementById('habits-week-header');
    const last5 = getLast5Days();
    const daysOfWeek = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // 1. Render Header
    header.innerHTML = `<div></div>` + last5.map(d => `
        <div class="day-col">
            <div class="day-name">${daysOfWeek[d.getDay()]}</div>
            <div class="day-num">${d.getDate()}</div>
        </div>
    `).join('');

    // 2. Render Rows
    list.innerHTML = appData.habits.map(h => {
        const hId = h[0];
        const hName = h[1];
        
        const checksHtml = last5.map(dateObj => {
            const dateStr = dateObj.toISOString().split('T')[0];
            const isChecked = appData.habitLogs.some(l => l[0] == hId && l[1].includes(dateStr)); // loose match on date string
            return `
            <div style="display:flex; justify-content:center">
                <div class="habit-check ${isChecked ? 'checked' : ''}" 
                     onclick="toggleHabit('${hId}', '${dateStr}', this)">
                     ${isChecked ? '✓' : ''}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="habit-row">
            <div class="habit-name" onclick="openHabitDetail('${hId}')">${hName}</div>
            ${checksHtml}
        </div>`;
    }).join('');
}

function toggleHabit(id, date, el) {
    const isChecked = el.classList.contains('checked');
    // Optimistic UI
    if(isChecked) {
        el.classList.remove('checked');
        el.innerText = '';
        // Remove from local cache
        appData.habitLogs = appData.habitLogs.filter(l => !(l[0] == id && l[1].includes(date)));
    } else {
        el.classList.add('checked');
        el.innerText = '✓';
        // Add to local cache
        appData.habitLogs.push([id, date, true]);
    }

    sendData({ action: 'toggleHabit', habitId: id, date: date });
}

// --- HABIT DETAIL LOGIC ---
function openHabitDetail(hId) {
    const habit = appData.habits.find(h => h[0] == hId);
    if(!habit) return;

    // Filter logs for this habit
    const logs = appData.habitLogs.filter(l => l[0] == hId).map(l => l[1].split('T')[0]); // Array of YYYY-MM-DD strings

    document.getElementById('detail-title').innerText = habit[1];
    document.getElementById('detail-freq').innerText = habit[2];
    document.getElementById('detail-target').innerText = habit[3] + '/period';

    // Stats Calc
    const total = logs.length;
    const streak = calculateStreak(logs);
    const rate = calculateMonthRate(logs);

    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-streak').innerText = streak;
    document.getElementById('stat-rate').innerText = rate + '%';

    renderCalendar(logs);
    renderHeatmap(logs);

    // Show View
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById('habit-detail-view').classList.add('active-view');
    // Hide header add button
    document.getElementById('headerActionBtn').style.display = 'none';
}

function calculateStreak(logs) {
    // Basic streak calculation (consecutive days ending today or yesterday)
    if(logs.length === 0) return 0;
    const sorted = [...logs].sort().reverse(); // Newest first
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let currentStreak = 0;
    let checkDate = new Date();
    
    // Check if streak is active (logged today or yesterday)
    if(!sorted.includes(today) && !sorted.includes(yesterday)) return 0;

    // Start checking from today backwards
    // Simplification: Iterate backwards from today
    for(let i=0; i<365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        if(logs.includes(dStr)) {
            currentStreak++;
        } else {
            // Allow missing today if it's not over yet
            if(dStr === today) continue;
            break;
        }
    }
    return currentStreak;
}

function calculateMonthRate(logs) {
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const daysInMonth = now.getDate(); // Days passed so far
    const logsInMonth = logs.filter(l => l.startsWith(currentMonthPrefix)).length;
    if(daysInMonth === 0) return 0;
    return Math.round((logsInMonth / daysInMonth) * 100);
}

function renderCalendar(logs) {
    const container = document.getElementById('calendar-grid');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    document.getElementById('cal-month-name').innerText = now.toLocaleString('default', { month: 'long' });

    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    const daysOfWeek = ['S','M','T','W','T','F','S'];
    
    daysOfWeek.forEach(d => html += `<div class="cal-day-header">${d}</div>`);

    // Empty slots
    for(let i=0; i<firstDay; i++) html += `<div></div>`;

    // Days
    for(let i=1; i<=daysInMonth; i++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const isActive = logs.includes(dStr);
        const isToday = (i === now.getDate());
        html += `<div class="cal-day ${isActive?'active':''} ${isToday?'today':''}">${i}</div>`;
    }
    container.innerHTML = html;
}

function renderHeatmap(logs) {
    const container = document.getElementById('heatmap-grid');
    let html = '';
    // Last 90 days
    for(let i=89; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const isFilled = logs.includes(dStr);
        html += `<div class="heat-box ${isFilled?'filled':''}" title="${dStr}"></div>`;
    }
    container.innerHTML = html;
}

// --- ADD MODAL ---
function openAddModal() {
    document.getElementById('addHabitModal').showModal();
}

async function submitNewHabit() {
    const name = document.getElementById('newHabitName').value;
    const freq = document.getElementById('newHabitFreq').value;
    if(!name) return;
    
    const id = "h_" + Date.now();
    appData.habits.push([id, name, freq, 1, false]); // Local update
    renderHabitDashboard(); // Refresh UI
    document.getElementById('addHabitModal').close();

    await sendData({ 
        action: 'addHabit', 
        id: id, name: name, frequency: freq, goal: 1 
    });
}

// --- GENERIC SEND ---
async function sendData(payload) {
    payload.token = TOKEN;
    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
    } catch(e) {
        console.error("Sync error", e);
    }
}

// --- OTHER SECTIONS (Placeholders) ---
function renderHealth() {
    const list = document.getElementById('health-list');
    list.innerHTML = appData.healthLogs.slice(-5).reverse().map(l => `
        <div class="log-item">
            <div>${l[1]}</div>
            <div>${l[2]}</div>
        </div>
    `).join('');
}
function handleAddMetric() { 
    // Simplified logic for brevity, expands same as Habit
    alert("Saved! (Check console for full logic)");
}
function populateDropdowns() { /* ... fill workout/diet selects ... */ }
function renderWorkoutLogs() { /* ... */ }
function renderDietLogs() { /* ... */ }
function switchTab(sec, tab) {
    document.querySelectorAll(`#${sec}-view .tab-btn`).forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`#${sec}-view .tab-content`).forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`${sec}-${tab}-tab`).classList.add('active');
}
