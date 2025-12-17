const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwB49dnXc5wFyia7NTXHfgt0LJm6LX_nZWgssc_yEiY5UO6XtYoB71iUq06MxZ6QprvZA/exec";
const TOKEN = "aleLifeTracker_1999";

let habits = [];
let logs = [];

async function fetchData() {
    try {
        const resp = await fetch(`${SCRIPT_URL}?token=${TOKEN}&action=getAll`);
        const data = await resp.json();
        
        // Salviamo i dati
        habits = data.habits;
        logs = data.logs;
        
        // Renderizziamo la UI
        render();
    } catch (e) {
        console.error("Errore nel caricamento:", e);
    }
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
    // 1. Trova l'elemento cliccato nel DOM
    // Usiamo selettori CSS per trovare la cella specifica
    const cells = document.querySelectorAll('.habit-row');
    let targetCell;
    
    // Cerchiamo la riga corretta e poi la cella corretta
    habits.forEach((h, index) => {
        if (h[0] == id) {
            const row = document.querySelectorAll('.habit-row')[index];
            const days = getWeekDays();
            const dayIndex = days.indexOf(date);
            targetCell = row.querySelectorAll('.cell')[dayIndex];
        }
    });

    if (!targetCell) return;

    // 2. AGGIORNAMENTO OTTIMISTICO (Istantaneo)
    const isChecked = targetCell.classList.contains('checked');
    if (isChecked) {
        targetCell.classList.remove('checked');
        targetCell.classList.add('empty');
        targetCell.innerText = '✕';
    } else {
        targetCell.classList.remove('empty');
        targetCell.classList.add('checked');
        targetCell.innerText = '✓';
    }

    // 3. AGGIORNAMENTO SERVER (In background)
    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", 
            body: JSON.stringify({ 
                token: TOKEN, 
                action: 'toggleHabit', 
                habitId: id, 
                date: date 
            })
        });
        
        // Aggiorniamo silenziosamente i dati locali senza rifare il render totale
        if (isChecked) {
            logs = logs.filter(l => !(l[0] == id && l[1].split('T')[0] === date));
        } else {
            logs.push([id, date, true]);
        }
    } catch (error) {
        // Se il server fallisce, riportiamo la UI allo stato precedente
        alert("Errore di sincronizzazione. Riprova.");
        fetchData(); 
    }
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
