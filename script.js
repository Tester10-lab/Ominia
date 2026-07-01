/* ================================================================
   OMINIA Event Planner — script.js
   Version 2.0.0 | Mobile-first premium event management
   ================================================================ */

// ────────────────────────────────────────────────────────────────
// 1. CONSTANTS & CONFIG
// ────────────────────────────────────────────────────────────────
const APP_NAME    = 'OMINIA Event Planner';
const STORAGE_KEY = 'ominia-event-planner';
const OLD_KEY     = 'july-2026-club-event-planner';
const THEME_KEY   = 'ominia-theme';

const CAT_COLORS = {
  Meeting:     '#6366f1',
  Workshop:    '#8b5cf6',
  Competition: '#f59e0b',
  Social:      '#10b981',
  Personal:    '#ec4899',
  Other:       '#6b7280',
};

// ────────────────────────────────────────────────────────────────
// 2. APPLICATION STATE
// ────────────────────────────────────────────────────────────────
let events       = [];
let currentView  = 'month';
let viewDate     = new Date();
let editingId    = null;
let activeDateKey = null;
let activeFilter  = null;
let draggedId     = null;
let guestList     = [];

// ────────────────────────────────────────────────────────────────
// 3. FIREBASE & STORAGE
// ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCYStvpM4WGuQPmIl2lef91Ukz-f3bpjxk",
  authDomain: "omnia-400aa.firebaseapp.com",
  projectId: "omnia-400aa",
  storageBucket: "omnia-400aa.firebasestorage.app",
  messagingSenderId: "951110501992",
  appId: "1:951110501992:web:cc21f7c0c1c9cd407d5ddd",
  measurementId: "G-FS0LCWX1WN"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let unsubscribeEvents = null;

function loadEventsLocally() {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (raw) {
      const old = JSON.parse(raw);
      const migrated = old.map(e => buildEvent({
        ...e,
        time: e.time || '09:00',
        endTime: e.time || '10:00',
        category: e.category || 'Other',
        color: CAT_COLORS[e.category] || '#6366f1',
        priority: e.priority || 'Medium',
      }));
      localStorage.removeItem(OLD_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    const samples = buildSampleEvents();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
    return samples;
  } catch (err) {
    return [];
  }
}

function saveEventsLocally() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (err) {
    showToast('Storage limit reached.', 'error');
  }
}

async function syncLocalToCloud(user) {
  const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (local.length > 0) {
    const batch = db.batch();
    local.forEach(ev => {
      const docRef = db.collection('users').doc(user.uid).collection('events').doc(ev.id);
      batch.set(docRef, ev);
    });
    try {
      await batch.commit();
      localStorage.removeItem(STORAGE_KEY);
    } catch(e) { console.error('Sync failed', e); }
  }
}

function setupAuth() {
  const authBtn = document.getElementById('authBtn');
  const authOverlay = document.getElementById('authOverlay');
  
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      authBtn.textContent = 'Sign Out';
      authOverlay.classList.add('hidden');
      
      syncLocalToCloud(user).then(() => {
        if (unsubscribeEvents) unsubscribeEvents();
        unsubscribeEvents = db.collection('users').doc(user.uid).collection('events')
          .onSnapshot(snapshot => {
            events = snapshot.docs.map(doc => doc.data());
            events.forEach(scheduleReminder);
            renderAll();
          }, err => console.error("Listen error:", err));
      });
    } else {
      currentUser = null;
      authBtn.textContent = 'Sign In';
      if (unsubscribeEvents) unsubscribeEvents();
      
      events = loadEventsLocally();
      events.forEach(scheduleReminder);
      renderAll();
    }
  });

  authBtn.addEventListener('click', () => {
    if (currentUser) {
      auth.signOut();
    } else {
      authOverlay.classList.remove('hidden');
    }
  });

  document.getElementById('googleSignInBtn').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => showToast(err.message, 'error'));
  });

  document.getElementById('authCloseBtn').addEventListener('click', () => {
    authOverlay.classList.add('hidden');
  });
}

function buildSampleEvents() {
  const today    = dateKey(new Date());
  const tomorrow = dateKey(addDays(new Date(), 1));
  const dayAfter = dateKey(addDays(new Date(), 3));
  return [
    buildEvent({ title: 'Team Kickoff Meeting',   date: today,    time: '09:00', endTime: '10:00', category: 'Meeting',     priority: 'High',   color: '#6366f1', venue: 'Conference Room A', organizer: 'OMINIA Team',    notes: 'Welcome to OMINIA Event Planner! Tap any event to edit it, or use the + button to add new ones.' }),
    buildEvent({ title: 'Product Design Workshop', date: tomorrow, time: '14:00', endTime: '16:30', category: 'Workshop',    priority: 'Medium', color: '#8b5cf6', venue: 'Innovation Lab',    organizer: 'Design Team',    notes: 'Bring your laptop and wireframes.' }),
    buildEvent({ title: 'Annual Sports Day',       date: dayAfter, time: '08:00', endTime: '18:00', category: 'Competition', priority: 'High',   color: '#f59e0b', venue: 'University Field',  organizer: 'Sports Committee' }),
  ];
}

// ────────────────────────────────────────────────────────────────
// 4. DATE UTILITIES
// ────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function weekStart(d) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); // Monday
  return r;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function isToday(d) { return sameDay(d, new Date()); }

function fmtLong(k) {
  return parseKey(k).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtShort(k) {
  return parseKey(k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTime(t) {
  if (!t) return 'All day';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
function toMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function localTZ()       { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
function localTZOffset() {
  const off  = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const h    = Math.floor(Math.abs(off) / 60);
  const m    = Math.abs(off) % 60;
  return `GMT${sign}${pad(h)}:${pad(m)}`;
}

// ────────────────────────────────────────────────────────────────
// 5. EVENT MODEL
// ────────────────────────────────────────────────────────────────
function buildEvent(p = {}) {
  const color = p.color || CAT_COLORS[p.category] || '#6366f1';
  return {
    id:        crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title:     p.title     || 'Untitled Event',
    date:      p.date      || dateKey(new Date()),
    endDate:   p.endDate   || p.date || dateKey(new Date()),
    time:      p.time      || '09:00',
    endTime:   p.endTime   || '10:00',
    allDay:    p.allDay    || false,
    venue:     p.venue     || '',
    organizer: p.organizer || '',
    category:  p.category  || 'Other',
    color,
    priority:  p.priority  || 'Medium',
    status:    p.status    || 'Upcoming',
    notes:     p.notes     || '',
    recurring: p.recurring || { freq: 'none', until: '' },
    reminder:  p.reminder  !== undefined ? p.reminder : 15,
    guests:    p.guests    || [],
    budget:    p.budget    || { amount: 0, currency: 'USD' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Resolve events for a given date (including recurring expansions)
function eventsForDate(dk) {
  const direct = events.filter(e => e.date === dk);
  const recur  = events.filter(e => {
    if (e.recurring.freq === 'none') return false;
    if (e.date === dk) return false;
    return matchesRecurring(e, dk);
  }).map(e => ({ ...e, date: dk, _instance: true }));
  return sortEvs([...direct, ...recur]);
}

function matchesRecurring(ev, dk) {
  const origin = parseKey(ev.date);
  const target = parseKey(dk);
  if (target <= origin) return false;
  if (ev.recurring.until) {
    const until = parseKey(ev.recurring.until);
    if (target > until) return false;
  }
  const diffDays = Math.round((target - origin) / 86400000);
  switch (ev.recurring.freq) {
    case 'daily':   return true;
    case 'weekly':  return diffDays % 7 === 0;
    case 'monthly': return target.getDate() === origin.getDate();
    case 'yearly':  return target.getDate() === origin.getDate() && target.getMonth() === origin.getMonth();
    default: return false;
  }
}

function sortEvs(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.time || '').localeCompare(b.time || '');
  });
}

function applyFilter(list) {
  return activeFilter ? list.filter(e => e.category === activeFilter) : list;
}

// ────────────────────────────────────────────────────────────────
// 6. THEME MANAGER
// ────────────────────────────────────────────────────────────────
function initTheme() {
  const saved  = localStorage.getItem(THEME_KEY);
  const sysDrk = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (sysDrk ? 'dark' : 'light'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem(THEME_KEY)) setTheme(e.matches ? 'dark' : 'light');
  });
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
}
function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem(THEME_KEY, next);
  showToast(next === 'dark' ? '🌙 Dark mode on' : '☀️ Light mode on', 'info', 2000);
}

// ────────────────────────────────────────────────────────────────
// 7. VIEW MANAGEMENT
// ────────────────────────────────────────────────────────────────
function setView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  document.querySelectorAll('.bn-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.nav === view);
  });
  updateTitle();
  renderView();
}

function renderView() {
  switch (currentView) {
    case 'month':  renderMonth();  break;
    case 'week':   renderWeek();   break;
    case 'day':    renderDay();    break;
    case 'agenda': renderAgenda(); break;
  }
}

function updateTitle() {
  const el = document.getElementById('calTitle');
  switch (currentView) {
    case 'month':
      el.textContent = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      break;
    case 'week': {
      const mon = weekStart(viewDate);
      const sun = addDays(mon, 6);
      el.textContent = mon.getMonth() === sun.getMonth()
        ? `${mon.toLocaleDateString('en-US',{month:'long'})} ${mon.getDate()}–${sun.getDate()}, ${mon.getFullYear()}`
        : `${mon.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${sun.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
      break;
    }
    case 'day':
      el.textContent = viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      break;
    case 'agenda':
      el.textContent = 'All Events';
      break;
  }
}

function navPrev() {
  if (currentView === 'month') viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  else if (currentView === 'week') viewDate = addDays(viewDate, -7);
  else if (currentView === 'day')  viewDate = addDays(viewDate, -1);
  else { viewDate = addDays(viewDate, -30); }
  updateTitle(); renderView();
}
function navNext() {
  if (currentView === 'month') viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  else if (currentView === 'week') viewDate = addDays(viewDate, 7);
  else if (currentView === 'day')  viewDate = addDays(viewDate, 1);
  else { viewDate = addDays(viewDate, 30); }
  updateTitle(); renderView();
}
function navToday() {
  viewDate = new Date();
  updateTitle(); renderView();
}

function renderAll() {
  renderView();
  renderSidebar();
}

// ────────────────────────────────────────────────────────────────
// 8. MONTH VIEW
// ────────────────────────────────────────────────────────────────
function renderMonth() {
  const container = document.getElementById('calView');
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const days  = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Mon=0
  const cells  = Math.ceil((offset + days) / 7) * 7;

  const grid = el('div', 'month-grid');
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', viewDate.toLocaleDateString('en-US',{month:'long',year:'numeric'}));

  // Weekday headers
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
    const h = el('div', 'month-wday');
    h.setAttribute('role', 'columnheader');
    h.textContent = d;
    grid.appendChild(h);
  });

  for (let i = 0; i < cells; i++) {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > days) {
      const blank = el('div', 'month-cell mc-empty');
      blank.setAttribute('role', 'gridcell');
      grid.appendChild(blank);
      continue;
    }

    const date  = new Date(year, month, dayNum);
    const dk    = dateKey(date);
    const dayEvs = applyFilter(eventsForDate(dk));

    const cell = el('button', 'month-cell');
    cell.type  = 'button';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${fmtLong(dk)}, ${dayEvs.length} event${dayEvs.length !== 1 ? 's' : ''}`);
    cell.dataset.date = dk;

    if (isToday(date)) cell.classList.add('mc-today');

    const num = el('span', 'cell-num');
    num.textContent = dayNum;
    cell.appendChild(num);

    if (dayEvs.length) {
      const bl = el('div', 'badge-list');
      dayEvs.slice(0, 3).forEach(ev => {
        const pill = el('span', 'ev-pill');
        pill.textContent = ev.allDay ? ev.title : `${fmtTime(ev.time)} ${ev.title}`;
        pill.style.background = hex2rgba(ev.color, 0.14);
        pill.style.color = ev.color;
        pill.draggable = true;
        pill.dataset.eventId = ev.id;
        pill.addEventListener('dragstart', onDragStart);
        pill.addEventListener('click', e => { e.stopPropagation(); openModal(dk, ev.id); });
        bl.appendChild(pill);
      });
      if (dayEvs.length > 3) {
        const more = el('span', 'more-pill');
        more.textContent = `+${dayEvs.length - 3} more`;
        bl.appendChild(more);
      }
      cell.appendChild(bl);
    }

    cell.addEventListener('click', () => openModal(dk));
    cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('mc-drag-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('mc-drag-over'));
    cell.addEventListener('drop', e => onDrop(e, dk));
    grid.appendChild(cell);
  }

  container.innerHTML = '';
  container.appendChild(grid);
}

// ────────────────────────────────────────────────────────────────
// 9. WEEK VIEW
// ────────────────────────────────────────────────────────────────
function renderWeek() {
  const container = document.getElementById('calView');
  const mon  = weekStart(viewDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const HOUR = 60; // px per hour
  const TOTAL = 24 * HOUR;

  const wrap = el('div', 'week-wrap');

  // Header
  const head = el('div', 'week-head');
  head.appendChild(el('div', 'wh-corner'));
  days.forEach(d => {
    const c = el('div', 'wh-cell' + (isToday(d) ? ' wh-today' : ''));
    const lbl = el('span', 'wh-label');
    lbl.textContent = d.toLocaleDateString('en-US', { weekday: 'short' });
    const num = el('span', 'wh-num');
    num.textContent = d.getDate();
    c.appendChild(lbl); c.appendChild(num);
    head.appendChild(c);
  });
  wrap.appendChild(head);

  // Body
  const body = el('div', 'week-body');

  // Time column
  const tCol = el('div', 'time-col');
  for (let h = 0; h < 24; h++) {
    const lbl = el('div', 't-label');
    lbl.textContent = h === 0 ? '' : `${h}:00`;
    tCol.appendChild(lbl);
  }
  body.appendChild(tCol);

  // Day columns
  days.forEach(d => {
    const dk  = dateKey(d);
    const col = el('div', 'day-col');
    col.style.height = `${TOTAL}px`;
    col.dataset.date = dk;

    // Grid rows
    for (let h = 0; h < 24; h++) {
      const row = el('div', 'h-row');
      row.addEventListener('click', () => {
        openModal(dk);
        setTimeout(() => {
          document.getElementById('evTime').value = `${pad(h)}:00`;
          document.getElementById('evEndTime').value = `${pad(h + 1)}:00`;
        }, 50);
      });
      col.appendChild(row);
    }

    // Events
    applyFilter(eventsForDate(dk)).forEach(ev => {
      if (ev.allDay) return;
      const start = toMinutes(ev.time);
      const end   = Math.max(toMinutes(ev.endTime) || start + 60, start + 20);
      const top    = (start / 1440) * TOTAL;
      const height = Math.max(((end - start) / 1440) * TOTAL, 20);

      const evEl = el('div', 'w-event');
      evEl.style.top    = `${top}px`;
      evEl.style.height = `${height}px`;
      evEl.style.background = hex2rgba(ev.color, 0.17);
      evEl.style.color = ev.color;
      evEl.style.borderLeftColor = ev.color;
      evEl.title = `${ev.title} — ${fmtTime(ev.time)}`;

      const t = el('span'); t.textContent = ev.title; t.style.display = 'block';
      if (height > 34) {
        const m = el('span');
        m.style.cssText = 'display:block;font-size:0.7rem;opacity:0.8;margin-top:2px';
        m.textContent = fmtTime(ev.time);
        evEl.appendChild(t); evEl.appendChild(m);
      } else {
        evEl.appendChild(t);
      }

      evEl.addEventListener('click', e => { e.stopPropagation(); openModal(dk, ev.id); });
      col.appendChild(evEl);
    });

    // Now-line
    if (isToday(d)) addNowLine(col, TOTAL);

    body.appendChild(col);
  });

  wrap.appendChild(body);
  container.innerHTML = '';
  container.appendChild(wrap);
  setTimeout(() => { container.scrollTop = 8 * HOUR; }, 30);
}

// ────────────────────────────────────────────────────────────────
// 10. DAY VIEW
// ────────────────────────────────────────────────────────────────
function renderDay() {
  const container = document.getElementById('calView');
  const dk    = dateKey(viewDate);
  const HOUR  = 64;
  const TOTAL = 24 * HOUR;

  const wrap = el('div', 'day-wrap');

  const head = el('div', 'day-head');
  const num  = el('div', 'day-head-num');
  num.textContent = viewDate.getDate();
  const name = el('div', 'day-head-name');
  name.textContent = viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', year: 'numeric' });
  head.appendChild(num); head.appendChild(name);
  if (isToday(viewDate)) num.style.color = 'var(--accent)';
  wrap.appendChild(head);

  const body = el('div', 'day-body');

  // Time column
  const tCol = el('div', 'time-col');
  for (let h = 0; h < 24; h++) {
    const lbl = el('div', 't-label');
    lbl.style.height = `${HOUR}px`;
    lbl.textContent = h === 0 ? '' : `${h}:00`;
    tCol.appendChild(lbl);
  }
  body.appendChild(tCol);

  // Main column
  const col = el('div', 'day-col');
  col.style.height = `${TOTAL}px`;
  col.style.position = 'relative';
  col.dataset.date = dk;

  for (let h = 0; h < 24; h++) {
    const row = el('div', 'h-row');
    row.style.height = `${HOUR}px`;
    row.addEventListener('click', () => {
      openModal(dk);
      setTimeout(() => {
        document.getElementById('evTime').value = `${pad(h)}:00`;
        document.getElementById('evEndTime').value = `${pad(Math.min(h + 1, 23))}:00`;
      }, 50);
    });
    col.appendChild(row);
  }

  applyFilter(eventsForDate(dk)).forEach(ev => {
    if (ev.allDay) return;
    const start  = toMinutes(ev.time);
    const end    = Math.max(toMinutes(ev.endTime) || start + 60, start + 30);
    const top    = (start / 1440) * TOTAL;
    const height = Math.max(((end - start) / 1440) * TOTAL, 30);

    const evEl = el('div', 'w-event');
    evEl.style.top    = `${top}px`;
    evEl.style.height = `${height}px`;
    evEl.style.left   = '4px'; evEl.style.right = '8px';
    evEl.style.background = hex2rgba(ev.color, 0.17);
    evEl.style.color = ev.color;
    evEl.style.borderLeftColor = ev.color;

    const t = el('strong'); t.textContent = ev.title; t.style.display = 'block';
    const m = el('span');
    m.style.cssText = 'display:block;font-size:0.76rem;margin-top:3px;opacity:0.8';
    m.textContent = `${fmtTime(ev.time)} – ${fmtTime(ev.endTime)}`;
    if (ev.venue) {
      const v = el('span');
      v.style.cssText = 'display:block;font-size:0.73rem;margin-top:2px;opacity:0.7';
      v.textContent = ev.venue;
      evEl.appendChild(t); evEl.appendChild(m); evEl.appendChild(v);
    } else {
      evEl.appendChild(t); evEl.appendChild(m);
    }

    evEl.addEventListener('click', e => { e.stopPropagation(); openModal(dk, ev.id); });
    col.appendChild(evEl);
  });

  if (isToday(viewDate)) addNowLine(col, TOTAL);

  body.appendChild(col);
  wrap.appendChild(body);
  container.innerHTML = '';
  container.appendChild(wrap);
  setTimeout(() => { container.scrollTop = 8 * HOUR; }, 30);
}

function addNowLine(col, TOTAL) {
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const line   = el('div', 'now-line');
  line.style.top = `${(nowMin / 1440) * TOTAL}px`;
  const dot = el('div', 'now-dot');
  line.appendChild(dot);
  col.appendChild(line);
}

// ────────────────────────────────────────────────────────────────
// 11. AGENDA VIEW
// ────────────────────────────────────────────────────────────────
function renderAgenda() {
  const container = document.getElementById('calView');
  const wrap = el('div', 'agenda-wrap');

  // Collect all events + recurring expansions for next 90 days
  const today = new Date();
  const byDate = {};

  sortEvs(applyFilter(events)).forEach(ev => {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);

    if (ev.recurring.freq !== 'none') {
      for (let i = 1; i <= 90; i++) {
        const dk = dateKey(addDays(today, i));
        if (matchesRecurring(ev, dk)) {
          if (!byDate[dk]) byDate[dk] = [];
          if (!byDate[dk].some(x => x.id === ev.id))
            byDate[dk].push({ ...ev, date: dk, _instance: true });
        }
      }
    }
  });

  const dates = Object.keys(byDate).sort();
  if (!dates.length) {
    wrap.appendChild(buildEmpty('No events yet', 'Use the + button to create your first event.'));
  } else {
    dates.forEach(dk => {
      const d       = parseKey(dk);
      const section = el('div', 'agenda-section');

      // Day header
      const dayHdr = el('div', 'agenda-day-hdr');
      const badge  = el('div', 'a-date-badge' + (isToday(d) ? ' a-today' : ''));
      const dayNum = el('span', 'a-day-num');  dayNum.textContent = d.getDate();
      const dayNm  = el('span', 'a-day-name'); dayNm.textContent = d.toLocaleDateString('en-US',{weekday:'short'});
      badge.appendChild(dayNum); badge.appendChild(dayNm);
      const divider = el('div', 'a-divider');
      const mLbl = el('span', 'a-month-lbl');
      mLbl.textContent = d.toLocaleDateString('en-US',{month:'short',year:'numeric'});
      dayHdr.appendChild(badge); dayHdr.appendChild(divider); dayHdr.appendChild(mLbl);
      section.appendChild(dayHdr);

      // Events
      const evList = el('div', 'agenda-events');
      byDate[dk].forEach(ev => {
        const item = el('div', 'a-event');
        item.style.borderLeftColor = ev.color;

        const timeEl = el('div', 'a-ev-time');
        timeEl.textContent = ev.allDay ? 'All day' : fmtTime(ev.time);

        const body = el('div', 'a-ev-body');
        const t = el('div', 'a-ev-title'); t.textContent = ev.title;
        const parts = [ev.venue, ev.organizer].filter(Boolean);
        const m = el('div', 'a-ev-meta'); m.textContent = parts.join(' • ');
        const chips = el('div', 'a-ev-chips');

        const catChip = el('span', 'a-chip');
        catChip.style.background = hex2rgba(ev.color, 0.14);
        catChip.style.color = ev.color;
        catChip.textContent = ev.category;
        chips.appendChild(catChip);

        if (ev.priority === 'High') {
          const pChip = el('span', 'a-chip');
          pChip.style.cssText = 'background:var(--danger-soft);color:var(--danger)';
          pChip.textContent = '🔴 High';
          chips.appendChild(pChip);
        }
        if (ev.status && ev.status !== 'Upcoming') {
          const sChip = el('span', 'a-chip');
          sChip.style.cssText = 'background:var(--panel-3);color:var(--muted)';
          sChip.textContent = ev.status;
          chips.appendChild(sChip);
        }

        body.appendChild(t);
        if (parts.length) body.appendChild(m);
        body.appendChild(chips);
        item.appendChild(timeEl);
        item.appendChild(body);
        item.addEventListener('click', () => openModal(dk, ev.id));
        evList.appendChild(item);
      });

      section.appendChild(evList);
      wrap.appendChild(section);
    });
  }

  container.innerHTML = '';
  container.appendChild(wrap);
}

// ────────────────────────────────────────────────────────────────
// 12. SIDEBAR
// ────────────────────────────────────────────────────────────────
function renderSidebar() {
  renderStats();
  renderFilterChips();
  renderUpcoming();
}

function renderStats() {
  const today = dateKey(new Date());
  const wMon  = dateKey(weekStart(new Date()));
  const wSun  = dateKey(addDays(weekStart(new Date()), 6));
  setText('statTotal',     events.length);
  setText('statToday',     events.filter(e => e.date === today).length);
  setText('statThisWeek',  events.filter(e => e.date >= wMon && e.date <= wSun).length);
  setText('eventCount',    events.length);
}

function renderFilterChips() {
  const wrap = document.getElementById('filterChips');
  wrap.innerHTML = '';
  const all = el('button', 'fchip' + (!activeFilter ? ' active' : ''));
  all.textContent = 'All';
  all.addEventListener('click', () => { activeFilter = null; renderAll(); });
  wrap.appendChild(all);

  Object.keys(CAT_COLORS).forEach(cat => {
    const chip = el('button', 'fchip' + (activeFilter === cat ? ' active' : ''));
    chip.textContent = cat;
    if (activeFilter === cat) {
      chip.style.background = CAT_COLORS[cat];
      chip.style.borderColor = CAT_COLORS[cat];
      chip.style.color = 'white';
    }
    chip.addEventListener('click', () => {
      activeFilter = (activeFilter === cat) ? null : cat;
      renderAll();
    });
    wrap.appendChild(chip);
  });
}

function renderUpcoming() {
  const wrap  = document.getElementById('upcomingList');
  const today = dateKey(new Date());
  const list  = sortEvs(applyFilter(events).filter(e => e.date >= today)).slice(0, 15);

  wrap.innerHTML = '';
  if (!list.length) {
    const p = el('p');
    p.style.cssText = 'color:var(--muted);font-size:0.82rem;text-align:center;padding:14px 0';
    p.textContent = 'No upcoming events';
    wrap.appendChild(p);
    return;
  }
  list.forEach(ev => {
    const item = el('div', 'up-item');
    item.style.borderLeftColor = ev.color;
    const t = el('div', 'up-title'); t.textContent = ev.title;
    const m = el('div', 'up-meta');
    m.textContent = `${fmtShort(ev.date)}${ev.allDay ? ', All day' : ` • ${fmtTime(ev.time)}`}`;
    item.appendChild(t); item.appendChild(m);
    item.addEventListener('click', () => {
      viewDate = parseKey(ev.date);
      setView('month');
      setTimeout(() => openModal(ev.date, ev.id), 250);
    });
    wrap.appendChild(item);
  });
}

// ────────────────────────────────────────────────────────────────
// 13. EVENT MODAL
// ────────────────────────────────────────────────────────────────
function openModal(dk, eventId) {
  activeDateKey = dk;
  editingId     = null;
  guestList     = [];

  // Reset form
  document.getElementById('eventForm').reset();
  switchTab('details');
  document.getElementById('recurUntilRow').style.display = 'none';
  document.getElementById('timeRow').style.display = 'grid';
  document.getElementById('dupEventBtn').style.display = 'none';
  document.getElementById('saveAsNewBtn').style.display = 'none';
  document.getElementById('guestChips').innerHTML = '';
  document.getElementById('evGuests').value = '';
  document.getElementById('budgetDisplay').style.display = 'none';
  document.getElementById('evColor').value = '#6366f1';
  document.getElementById('colorPreview').style.background = '#6366f1';
  document.getElementById('colorHex').textContent = '#6366f1';

  // Set default date values
  if (dk) {
    document.getElementById('evDate').value    = dk;
    document.getElementById('evEndDate').value = dk;
  }

  // Render day events panel
  renderDayPanel(dk);

  // Edit mode
  if (eventId) {
    const ev = events.find(e => e.id === eventId);
    if (ev) {
      editingId = ev.id;
      document.getElementById('modalTitle').textContent = 'Edit Event';
      document.getElementById('dupEventBtn').style.display = 'flex';
      document.getElementById('saveAsNewBtn').style.display = 'inline-flex';
      fillForm(ev);
    }
  } else {
    document.getElementById('modalTitle').textContent = 'New Event';
    document.getElementById('saveAsNewBtn').style.display = 'none';
    document.getElementById('evDate').value = dk || dateKey(new Date());
  }

  const modal = document.getElementById('eventModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('evTitle').focus(), 80);
}

function closeModal() {
  document.getElementById('eventModal').classList.add('hidden');
  document.body.style.overflow = '';
  editingId = null; activeDateKey = null; guestList = [];
}

function fillForm(ev) {
  setVal('evTitle',     ev.title);
  setVal('evDate',      ev.date);
  setVal('evEndDate',   ev.endDate || ev.date);
  setVal('evTime',      ev.time    || '09:00');
  setVal('evEndTime',   ev.endTime || '10:00');
  document.getElementById('evAllDay').checked = ev.allDay || false;
  setVal('evCategory',  ev.category || 'Other');
  setVal('evPriority',  ev.priority || 'Medium');
  setVal('evStatus',    ev.status   || 'Upcoming');
  setVal('evColor',     ev.color    || '#6366f1');
  document.getElementById('colorPreview').style.background = ev.color || '#6366f1';
  document.getElementById('colorHex').textContent = ev.color || '#6366f1';
  setVal('evVenue',     ev.venue    || '');
  setVal('evOrganizer', ev.organizer || '');
  setVal('evReminder',  ev.reminder !== undefined ? ev.reminder : 15);
  setVal('evRecurring', ev.recurring?.freq || 'none');
  setVal('evRecurUntil',ev.recurring?.until || '');
  setVal('evBudget',    ev.budget?.amount || '');
  setVal('evCurrency',  ev.budget?.currency || 'USD');
  setVal('evNotes',     ev.notes || '');

  if (ev.allDay) document.getElementById('timeRow').style.display = 'none';
  if (ev.recurring?.freq !== 'none') document.getElementById('recurUntilRow').style.display = 'grid';

  if (ev.budget?.amount > 0) {
    const d = document.getElementById('budgetDisplay');
    d.style.display = 'block';
    d.textContent = `Budget: ${ev.budget.currency} ${parseFloat(ev.budget.amount).toFixed(2)}`;
  }

  guestList = [...(ev.guests || [])];
  renderGuests();
}

function renderDayPanel(dk) {
  const panel = document.getElementById('dayEvPanel');
  const list  = document.getElementById('eventList');
  const title = document.getElementById('dayEvPanelTitle');
  const evs   = dk ? eventsForDate(dk) : [];

  title.textContent = dk ? `Events on ${fmtShort(dk)}` : 'Events';

  if (!evs.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  list.innerHTML = '';

  evs.forEach(ev => {
    const card = el('div', 'ev-card');
    const bar  = el('div', 'ev-card-bar');
    bar.style.background = ev.color;

    const body = el('div', 'ev-card-body');
    const t = el('div', 'ev-card-title'); t.textContent = ev.title;
    const m = el('div', 'ev-card-meta');
    m.textContent = ev.allDay ? 'All day' : `${fmtTime(ev.time)}${ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ''}`;
    body.appendChild(t); body.appendChild(m);

    const acts = el('div', 'ev-card-acts');

    const editBtn = el('button', 'ev-act ev-act-edit');
    editBtn.type = 'button'; editBtn.title = 'Edit'; editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => {
      editingId = ev.id;
      document.getElementById('modalTitle').textContent = 'Edit Event';
      document.getElementById('dupEventBtn').style.display = 'flex';
      fillForm(ev);
      switchTab('details');
      document.getElementById('evTitle').focus();
    });

    const dupBtn = el('button', 'ev-act ev-act-dup');
    dupBtn.type = 'button'; dupBtn.title = 'Duplicate'; dupBtn.textContent = '📋';
    dupBtn.addEventListener('click', () => { dupEvent(ev.id); });

    const delBtn = el('button', 'ev-act ev-act-del');
    delBtn.type = 'button'; delBtn.title = 'Delete'; delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete "${ev.title}"?`)) delEvent(ev.id);
    });

    acts.appendChild(editBtn); acts.appendChild(dupBtn); acts.appendChild(delBtn);
    card.appendChild(bar); card.appendChild(body); card.appendChild(acts);
    list.appendChild(card);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.mtab').forEach(t => {
    const on = t.dataset.tab === tab;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    const on = p.id === `tab-${tab}`;
    p.classList.toggle('active', on);
    p.style.display = on ? 'flex' : 'none';
  });
}

// ────────────────────────────────────────────────────────────────
// 14. CRUD OPERATIONS
// ────────────────────────────────────────────────────────────────
function addEvent(payload) {
  const ev = buildEvent(payload);
  events.push(ev);
  
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).collection('events').doc(ev.id).set(ev);
  } else {
    saveEventsLocally();
  }
  
  scheduleReminder(ev);
  renderAll();
  showToast(`✅ "${ev.title}" saved!`, 'success');
  return ev;
}

function editEvent(id, payload) {
  const i = events.findIndex(e => e.id === id);
  if (i === -1) return;
  events[i] = { ...events[i], ...payload, updatedAt: new Date().toISOString() };
  
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).collection('events').doc(id).update(events[i]);
  } else {
    saveEventsLocally();
  }
  
  scheduleReminder(events[i]);
  renderAll();
  showToast(`✏️ "${events[i].title}" updated!`, 'success');
}

function delEvent(id) {
  const ev = events.find(e => e.id === id);
  events = events.filter(e => e.id !== id);
  
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).collection('events').doc(id).delete();
  } else {
    saveEventsLocally();
  }
  
  renderAll();
  if (activeDateKey) renderDayPanel(activeDateKey);
  showToast(`🗑️ "${ev?.title || 'Event'}" deleted.`, 'info');
}

function dupEvent(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  const copy = buildEvent({ ...ev, title: `${ev.title} (Copy)`, createdAt: undefined });
  events.push(copy);
  
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).collection('events').doc(copy.id).set(copy);
  } else {
    saveEventsLocally();
  }
  
  renderAll();
  if (activeDateKey) renderDayPanel(activeDateKey);
  showToast('📋 Event duplicated!', 'success');
}

// ────────────────────────────────────────────────────────────────
// 15. FORM SUBMISSION
// ────────────────────────────────────────────────────────────────
function handleSubmit(e) {
  e.preventDefault();
  const fd     = new FormData(document.getElementById('eventForm'));
  const allDay = document.getElementById('evAllDay').checked;
  const color  = document.getElementById('evColor').value;

  const payload = {
    title:     (fd.get('title')    || '').trim(),
    date:      fd.get('date')      || activeDateKey || dateKey(new Date()),
    endDate:   fd.get('endDate')   || fd.get('date'),
    time:      allDay ? '' : (fd.get('time')    || '09:00'),
    endTime:   allDay ? '' : (fd.get('endTime') || '10:00'),
    allDay,
    venue:     (fd.get('venue')     || '').trim(),
    organizer: (fd.get('organizer') || '').trim(),
    category:  fd.get('category')  || 'Other',
    color,
    priority:  fd.get('priority')  || 'Medium',
    status:    fd.get('status')    || 'Upcoming',
    notes:     (fd.get('notes')    || '').trim(),
    recurring: {
      freq:  fd.get('recurring') || 'none',
      until: fd.get('recurUntil') || '',
    },
    reminder:  parseInt(fd.get('reminder') || '0', 10),
    guests:    [...guestList],
    budget: {
      amount:   parseFloat(fd.get('budget') || '0') || 0,
      currency: fd.get('currency') || 'USD',
    },
  };

  if (!payload.title) {
    showToast('Please enter an event title.', 'error');
    document.getElementById('evTitle').focus();
    return;
  }

  if (editingId) {
    editEvent(editingId, payload);
  } else {
    addEvent(payload);
  }

  closeModal();
}

// ────────────────────────────────────────────────────────────────
// 16. GUESTS
// ────────────────────────────────────────────────────────────────
function renderGuests() {
  const wrap = document.getElementById('guestChips');
  wrap.innerHTML = '';
  guestList.forEach(email => {
    const chip = el('div', 'g-chip');
    const txt  = el('span'); txt.textContent = email;
    const rm   = el('span', 'g-chip-rm'); rm.textContent = '×';
    rm.addEventListener('click', () => {
      guestList = guestList.filter(x => x !== email);
      renderGuests();
    });
    chip.appendChild(txt); chip.appendChild(rm);
    wrap.appendChild(chip);
  });
  document.getElementById('evGuests').value = guestList.join(',');
}

// ────────────────────────────────────────────────────────────────
// 17. DRAG & DROP
// ────────────────────────────────────────────────────────────────
function onDragStart(e) {
  draggedId = e.currentTarget.dataset.eventId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedId);
}
function onDrop(e, dk) {
  e.preventDefault();
  e.currentTarget.classList.remove('mc-drag-over');
  if (!draggedId) return;
  const ev = events.find(x => x.id === draggedId);
  draggedId = null;
  if (!ev || ev.date === dk) return;
  editEvent(ev.id, { date: dk, endDate: dk });
  showToast('📅 Event moved!', 'success');
}

// ────────────────────────────────────────────────────────────────
// 18. SEARCH
// ────────────────────────────────────────────────────────────────
function openSearch() {
  document.getElementById('searchOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('searchInput').value = '';
  renderSearchResults('');
  setTimeout(() => document.getElementById('searchInput').focus(), 60);
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}
function renderSearchResults(q) {
  const cat  = document.getElementById('searchCategory').value;
  const prio = document.getElementById('searchPriority').value;
  const wrap = document.getElementById('searchResults');
  wrap.innerHTML = '';
  const term = q.toLowerCase().trim();

  const results = events.filter(ev => {
    const matchQ = !term ||
      ev.title.toLowerCase().includes(term) ||
      (ev.venue      || '').toLowerCase().includes(term) ||
      (ev.organizer  || '').toLowerCase().includes(term) ||
      (ev.notes      || '').toLowerCase().includes(term);
    return matchQ && (!cat || ev.category === cat) && (!prio || ev.priority === prio);
  });

  if (!results.length) {
    const p = el('p');
    p.style.cssText = 'text-align:center;color:var(--muted);padding:28px;font-size:0.88rem';
    p.textContent = term ? 'No events match your search.' : 'Start typing to search events…';
    wrap.appendChild(p);
    return;
  }

  sortEvs(results).forEach(ev => {
    const item = el('div', 'sr-item');
    item.style.borderLeftColor = ev.color;
    const t = el('div', 'sr-title'); t.textContent = ev.title;
    const m = el('div', 'sr-meta');
    m.textContent = `${fmtLong(ev.date)} • ${ev.allDay ? 'All day' : fmtTime(ev.time)}${ev.venue ? ` • ${ev.venue}` : ''}`;
    item.appendChild(t); item.appendChild(m);
    item.addEventListener('click', () => {
      closeSearch();
      viewDate = parseKey(ev.date);
      setView('month');
      setTimeout(() => openModal(ev.date, ev.id), 280);
    });
    wrap.appendChild(item);
  });
}

// ────────────────────────────────────────────────────────────────
// 19. NOTIFICATIONS & REMINDERS
// ────────────────────────────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported in this browser.', 'warn');
    return;
  }
  if (Notification.permission === 'granted') {
    showToast('Notifications are already enabled!', 'info');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') showToast('🔔 Notifications enabled!', 'success');
  else showToast('Notifications blocked. Enable them in browser settings.', 'warn');
}

function scheduleReminder(ev) {
  if (!ev.reminder || ev.reminder === 0 || !ev.date || !ev.time || ev.allDay) return;
  const [h, m] = ev.time.split(':').map(Number);
  const evTime = parseKey(ev.date);
  evTime.setHours(h, m, 0, 0);
  const fireAt = new Date(evTime.getTime() - ev.reminder * 60000);
  const delay  = fireAt.getTime() - Date.now();
  if (delay < 0) return;

  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification(`⏰ ${APP_NAME} — Reminder`, {
        body: `"${ev.title}" starts in ${ev.reminder} minute${ev.reminder === 1 ? '' : 's'}${ev.venue ? `\n📍 ${ev.venue}` : ''}`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="18" fill="%236366f1"/></svg>',
        tag: ev.id,
      });
    } else {
      showToast(`⏰ Reminder: "${ev.title}" in ${ev.reminder} min`, 'warn', 5000);
    }
  }, delay);
}

// ────────────────────────────────────────────────────────────────
// 20. TOAST NOTIFICATIONS
// ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3400) {
  const wrap  = document.getElementById('toastContainer');
  const toast = el('div', `toast ${type}`);
  toast.textContent = msg;
  wrap.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ────────────────────────────────────────────────────────────────
// 21. UTILITIES
// ────────────────────────────────────────────────────────────────
function el(tag, cls = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function setText(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
}
function setVal(id, v) {
  const e = document.getElementById(id);
  if (e) e.value = v;
}
function hex2rgba(hex, a) {
  if (!hex || hex.length < 7) return `rgba(99,102,241,${a})`;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function buildEmpty(title, desc) {
  const d = el('div', 'empty-state');
  d.innerHTML = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><h3>${title}</h3><p>${desc}</p>`;
  return d;
}

// ────────────────────────────────────────────────────────────────
// 22. EVENT LISTENERS
// ────────────────────────────────────────────────────────────────
function initListeners() {
  // Calendar navigation
  document.getElementById('prevBtn').addEventListener('click', navPrev);
  document.getElementById('nextBtn').addEventListener('click', navNext);
  document.getElementById('todayBtn').addEventListener('click', navToday);

  // View switcher tabs
  document.querySelectorAll('.view-btn').forEach(b =>
    b.addEventListener('click', () => setView(b.dataset.view))
  );

  // Bottom nav
  document.querySelectorAll('.bn-btn').forEach(b =>
    b.addEventListener('click', () => {
      const nav = b.dataset.nav;
      if (nav === 'search') { openSearch(); return; }
      if (nav === 'today')  { navToday(); return; }
      setView(nav);
    })
  );

  // FAB
  document.getElementById('fab').addEventListener('click', () =>
    openModal(dateKey(new Date()))
  );

  // Modal close
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('eventModal').addEventListener('click', e => {
    if (e.target === document.getElementById('eventModal')) closeModal();
  });

  // Duplicate
  document.getElementById('dupEventBtn').addEventListener('click', () => {
    if (editingId) { dupEvent(editingId); closeModal(); }
  });

  // Form submit & reset
  document.getElementById('eventForm').addEventListener('submit', handleSubmit);
  document.getElementById('resetForm').addEventListener('click', () => {
    if (confirm('Clear form?')) {
      document.getElementById('eventForm').reset();
      editingId = null; guestList = [];
      document.getElementById('modalTitle').textContent = 'New Event';
      document.getElementById('dupEventBtn').style.display = 'none';
      document.getElementById('saveAsNewBtn').style.display = 'none';
      document.getElementById('evDate').value = activeDateKey || dateKey(new Date());
      document.getElementById('evEndDate').value = activeDateKey || dateKey(new Date());
      document.getElementById('evColor').value = '#6366f1';
      document.getElementById('colorPreview').style.background = '#6366f1';
      document.getElementById('colorHex').textContent = '#6366f1';
      document.getElementById('guestChips').innerHTML = '';
      document.getElementById('budgetDisplay').style.display = 'none';
      document.getElementById('recurUntilRow').style.display = 'none';
      document.getElementById('timeRow').style.display = 'grid';
      renderGuests();
    }
  });

  document.getElementById('saveAsNewBtn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('saveBtn').click();
  });

  // Modal tabs
  document.querySelectorAll('.mtab').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab))
  );

  // Color picker sync
  document.getElementById('evColor').addEventListener('input', function() {
    document.getElementById('colorPreview').style.background = this.value;
    document.getElementById('colorHex').textContent = this.value;
  });

  // All day toggle
  document.getElementById('evAllDay').addEventListener('change', function() {
    document.getElementById('timeRow').style.display = this.checked ? 'none' : 'grid';
  });

  // Recurring freq toggle
  document.getElementById('evRecurring').addEventListener('change', function() {
    document.getElementById('recurUntilRow').style.display =
      this.value !== 'none' ? 'grid' : 'none';
  });

  // Budget live display
  function updateBudgetDisplay() {
    const amt = parseFloat(document.getElementById('evBudget').value) || 0;
    const cur = document.getElementById('evCurrency').value;
    const d   = document.getElementById('budgetDisplay');
    if (amt > 0) { d.style.display = 'block'; d.textContent = `Budget: ${cur} ${amt.toFixed(2)}`; }
    else { d.style.display = 'none'; }
  }
  document.getElementById('evBudget').addEventListener('input', updateBudgetDisplay);
  document.getElementById('evCurrency').addEventListener('change', updateBudgetDisplay);

  // Date change sync
  document.getElementById('evDate').addEventListener('change', function(e) {
    const newDate = e.target.value;
    if (newDate) {
      const endDateInput = document.getElementById('evEndDate');
      if (endDateInput.value < newDate) {
        endDateInput.value = newDate;
      }
      renderDayPanel(newDate);
    }
  });

  document.getElementById('evEndDate').addEventListener('change', function(e) {
    const newEndDate = e.target.value;
    const startDate = document.getElementById('evDate').value;
    if (newEndDate && startDate && newEndDate < startDate) {
      this.value = startDate;
      showToast('End date cannot be before start date.', 'warn');
    }
  });

  // Category color sync
  document.getElementById('evCategory').addEventListener('change', function(e) {
    const color = CAT_COLORS[e.target.value] || '#6366f1';
    document.getElementById('evColor').value = color;
    document.getElementById('colorPreview').style.background = color;
    document.getElementById('colorHex').textContent = color;
  });

  // Guest input handling
  const guestInput = document.getElementById('evGuestInput');
  const addGuest = () => {
    const email = guestInput.value.trim().replace(/,$/, '');
    if (email && !guestList.includes(email)) {
      guestList.push(email);
      renderGuests();
    }
    guestInput.value = '';
  };

  guestInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addGuest();
    }
  });
  guestInput.addEventListener('input', function(e) {
    if (this.value.includes(',')) {
      this.value = this.value.replace(/,/g, '');
      addGuest();
    }
  });
  guestInput.addEventListener('blur', function() {
    if (this.value.trim()) addGuest();
  });

  // Search
  document.getElementById('searchTrigger').addEventListener('click', openSearch);
  document.getElementById('searchClose').addEventListener('click', closeSearch);
  document.getElementById('searchOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('searchOverlay')) closeSearch();
  });
  document.getElementById('searchInput').addEventListener('input', function() {
    renderSearchResults(this.value);
  });
  document.getElementById('searchCategory').addEventListener('change', function() {
    renderSearchResults(document.getElementById('searchInput').value);
  });
  document.getElementById('searchPriority').addEventListener('change', function() {
    renderSearchResults(document.getElementById('searchInput').value);
  });

  // Theme & notifications
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('notifBtn').addEventListener('click', requestNotifPermission);

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(tag);

    // Escape always works
    if (e.key === 'Escape') {
      if (!document.getElementById('searchOverlay').classList.contains('hidden')) { closeSearch(); return; }
      if (!document.getElementById('eventModal').classList.contains('hidden'))   { closeModal(); return; }
    }

    if (inInput) return; // don't fire shortcuts while typing

    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); return; }
    switch (e.key) {
      case 'n': case 'N': openModal(dateKey(new Date())); break;
      case 't': case 'T': navToday(); break;
      case 'm': case 'M': setView('month'); break;
      case 'w': case 'W': setView('week'); break;
      case 'd': case 'D': setView('day'); break;
      case 'a': case 'A': setView('agenda'); break;
      case 'ArrowLeft':  navPrev(); break;
      case 'ArrowRight': navNext(); break;
    }
  });

  // Drag cleanup
  document.addEventListener('dragend', () => { draggedId = null; });
}

// ────────────────────────────────────────────────────────────────
// 23. INIT
// ────────────────────────────────────────────────────────────────
function init() {
  // Theme (before render, eliminates flash)
  initTheme();

  // Timezone badge
  const tzEl = document.getElementById('tzBadge');
  tzEl.textContent = localTZOffset();
  tzEl.title = `Timezone: ${localTZ()}`;

  // Setup Auth (This handles loading events and initial render via onAuthStateChanged)
  setupAuth();
  updateTitle();

  // Wire up all event listeners
  initListeners();

  // Hide splash, reveal app after animation
  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
    const app = document.getElementById('app');
    app.classList.remove('app-hidden');
    app.removeAttribute('aria-hidden');
    document.getElementById('splash').setAttribute('aria-hidden', 'true');
  }, 1900);
}

document.addEventListener('DOMContentLoaded', init);
