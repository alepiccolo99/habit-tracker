const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwB49dnXc5wFyia7NTXHfgt0LJm6LX_nZWgssc_yEiY5UO6XtYoB71iUq06MxZ6QprvZA/exec";
const TOKEN = "aleLifeTracker_1999";

let habits = [];
let logs = [];

async function fetchData() {
    const resp = await fetch(`${SCRIPT_URL}?token=${TOKEN}&action=getAll`);
    const data = await resp.json();
    habits = data.habits;
    logs = data.logs;
    render();
}

function getWeekDays() {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) { // Mostriamo 5 giorni come da screenshot
        const d = new Date();
        d.setDate(now.getDate() - (4 - i));
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}

function render() {
    const list = document.getElementById('habits-list');
    const header = document.getElementById('week-header');
    const days = getWeekDays();

    // Render Header Giorni
    header.innerHTML = '<div class="habit-name-spacer"></div>' + 
        days.map(d => `<div>${new Date(d).toLocaleDateString('en', {weekday:'short'})}<br>${new Date(d).getDate()}</div>`).join('');

    // Render Righe Habit
    list.innerHTML = habits.map(h => `
        <div class="habit-row">
            <div class="habit-label">${h[1]}</div>
            ${days.map(d => {
                const isChecked = logs.some(l => l[0] == h[0] && l[1].split('T')[0] === d);
                return `<div class="cell ${isChecked ? 'checked' : 'empty'}" onclick="toggleHabit('${h[0]}', '${d}')">
                    ${isChecked ? '✓' : '✕'}
                </div>`;
            }).join('')}
        </div>
    `).join('');
}

async function toggleHabit(id, date) {
    // Ottimismo UI: cambia subito il check localmente
    await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // Necessario per Google Script
        body: JSON.stringify({ token: TOKEN, action: 'toggleHabit', habitId: id, date: date })
    });
    fetchData(); // Ricarica per conferma
}

async function addNewHabit() {
    const name = document.getElementById('newHabitName').value;
    if(!name) return;
    await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ token: TOKEN, action: 'addHabit', name: name })
    });
    document.getElementById('newHabitName').value = '';
    fetchData();
}

fetchData();
