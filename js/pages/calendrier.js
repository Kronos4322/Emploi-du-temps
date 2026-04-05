// calendrier.js — Calendrier multi-sociétés avec filtres et détection de conflits
'use strict';

let _view = 'week';
let _date = Utils.today();
let _filterPoles    = new Set(); // vide = tous
let _filterProviders = new Set(); // vide = tous
let _filterStudents  = new Set(); // vide = tous

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilters();
  renderCalendar();

  document.getElementById('btn-new-course').addEventListener('click', () =>
    Modals.openMission(null, _date, () => renderCalendar()));

  document.getElementById('cal-prev').addEventListener('click',  () => { navPrev(); renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click',  () => { navNext(); renderCalendar(); });
  document.getElementById('cal-today').addEventListener('click', () => { _date = Utils.today(); renderCalendar(); });

  document.querySelectorAll('.cal-view-switcher .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _view = btn.dataset.view;
      document.querySelectorAll('.cal-view-switcher .btn').forEach(b => {
        b.className = b.dataset.view === _view ? 'btn btn-primary' : 'btn btn-ghost';
      });
      renderCalendar();
    });
  });
});

function buildFilters() {
  const ownCos    = Data.getOwnCompanies();
  const clientCos = Data.getClientSchools();
  const providers = Data.getProviders();
  const students  = Data.getStudents().filter(s => s.status !== 'inactive');
  const coMap     = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);

  // ── Boutons pôles (Artémis / Astéria + leurs écoles) ─────
  const polesEl = document.getElementById('filter-poles');
  const allCos  = [{ id:'', name:'Toutes', color:'#64748b' }, ...ownCos, ...clientCos];
  polesEl.innerHTML = allCos.map(c => {
    const active = c.id === '' ? _filterPoles.size === 0 : _filterPoles.has(c.id);
    return `<button class="btn btn-xs" data-cid="${c.id}"
      style="padding:3px 10px;border-radius:12px;border:2px solid ${c.color||'#64748b'};background:${active?(c.color||'#64748b'):'transparent'};color:${active?'#fff':(c.color||'#64748b')};font-size:0.78rem;cursor:pointer"
      onclick="window._calTogglePole('${c.id}')">${Utils.escapeHtml(c.name)}</button>`;
  }).join('');

  // ── Menu prestataires (checkboxes) ───────────────────────
  const provMenu = document.getElementById('cal-prov-menu');
  provMenu.innerHTML = providers.map(p =>
    `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:0.82rem;cursor:pointer;border-radius:4px">
      <input type="checkbox" ${_filterProviders.size===0||_filterProviders.has(p.id)?'checked':''} onchange="window._calToggleProv('${p.id}',this.checked)">
      ${Utils.escapeHtml(p.lastName+' '+p.firstName)}
    </label>`).join('');
  document.getElementById('btn-filter-prov').textContent =
    _filterProviders.size === 0 ? 'Tous ▼' : `${_filterProviders.size} sélectionné(s) ▼`;

  // ── Menu étudiants (checkboxes) ──────────────────────────
  const studMenu = document.getElementById('cal-stud-menu');
  studMenu.innerHTML = students.map(s =>
    `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:0.82rem;cursor:pointer;border-radius:4px">
      <input type="checkbox" ${_filterStudents.size===0||_filterStudents.has(s.id)?'checked':''} onchange="window._calToggleStud('${s.id}',this.checked)">
      ${Utils.escapeHtml(s.lastName+' '+s.firstName)}
    </label>`).join('');
  document.getElementById('btn-filter-stud').textContent =
    _filterStudents.size === 0 ? 'Tous ▼' : `${_filterStudents.size} sélectionné(s) ▼`;
}

window._calTogglePole = id => {
  if (id === '') { _filterPoles.clear(); }
  else { _filterPoles.has(id) ? _filterPoles.delete(id) : _filterPoles.add(id); }
  buildFilters(); renderCalendar();
};
window._calToggleProv = (id, checked) => {
  if (checked) _filterProviders.add(id); else _filterProviders.delete(id);
  document.getElementById('btn-filter-prov').textContent =
    _filterProviders.size === 0 ? 'Tous ▼' : `${_filterProviders.size} sélectionné(s) ▼`;
  renderCalendar();
};
window._calToggleStud = (id, checked) => {
  if (checked) _filterStudents.add(id); else _filterStudents.delete(id);
  document.getElementById('btn-filter-stud').textContent =
    _filterStudents.size === 0 ? 'Tous ▼' : `${_filterStudents.size} sélectionné(s) ▼`;
  renderCalendar();
};
window._calReset = () => {
  _filterPoles.clear(); _filterProviders.clear(); _filterStudents.clear();
  buildFilters(); renderCalendar();
};

function getFilteredMissions(start, end) {
  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  let missions = Data.getMissionsByDateRange(start, end);
  if (_filterPoles.size > 0) missions = missions.filter(m => {
    const co = coMap[m.companyId];
    if (!co) return false;
    if (_filterPoles.has(co.id)) return true;
    if (co.poleId && _filterPoles.has(co.poleId)) return true;
    return false;
  });
  if (_filterProviders.size > 0) missions = missions.filter(m => _filterProviders.has(m.providerId));
  if (_filterStudents.size > 0)  missions = missions.filter(m => (m.studentIds||[]).some(id => _filterStudents.has(id)));
  return missions;
}

function navPrev() {
  if (_view === 'day')   _date = Utils.addDays(_date, -1);
  if (_view === 'week')  _date = Utils.addDays(_date, -7);
  if (_view === 'month') _date = shiftMonth(_date, -1);
}
function navNext() {
  if (_view === 'day')   _date = Utils.addDays(_date, 1);
  if (_view === 'week')  _date = Utils.addDays(_date, 7);
  if (_view === 'month') _date = shiftMonth(_date, 1);
}
function shiftMonth(iso, delta) {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + delta);
  return Utils.localISO(d);
}

function renderCalendar() {
  document.getElementById('cal-title').textContent = getTitle();
  const body = document.getElementById('calendar-body');
  if (_view === 'day')   body.innerHTML = renderDay(_date);
  if (_view === 'week')  body.innerHTML = renderWeek();
  if (_view === 'month') body.innerHTML = renderMonth();
  const scrollEl = body.querySelector('.week-body, .day-body');
  if (scrollEl) scrollEl.scrollTop = 90;
}

function getTitle() {
  if (_view === 'day') return Utils.formatDateLong(_date);
  if (_view === 'week') {
    const s = Utils.getWeekStart(_date), e = Utils.addDays(s, 6);
    return `Semaine du ${Utils.formatDate(s)} au ${Utils.formatDate(e)}`;
  }
  const d = new Date(_date + 'T00:00:00');
  return `${Utils.monthName(d.getMonth())} ${d.getFullYear()}`;
}

const MIN_H = 7, MAX_H = 22, TOTAL_MINS = (MAX_H - MIN_H) * 60;
function pct(mins) { return ((mins - MIN_H * 60) / TOTAL_MINS * 100).toFixed(2); }

function hourLines() {
  let html = '';
  for (let h = MIN_H; h <= MAX_H; h++) {
    html += `<div class="hour-line" style="top:${pct(h * 60)}%">
      <span class="hour-label">${String(h).padStart(2,'0')}:00</span></div>`;
  }
  return html;
}

// Détecte si une mission est en conflit (même prestataire, même heure, même jour)
function hasConflict(mission, allMissions) {
  if (!mission.providerId) return false;
  return allMissions.some(m => {
    if (m.id === mission.id || m.providerId !== mission.providerId) return false;
    if (m.date !== mission.date || m.status === 'cancelled') return false;
    const aS = Utils.timeToMinutes(mission.startTime), aE = Utils.timeToMinutes(mission.endTime);
    const bS = Utils.timeToMinutes(m.startTime),       bE = Utils.timeToMinutes(m.endTime);
    return aS < bE && bS < aE;
  });
}

function missionBlock(c, companies, allMissions) {
  const co      = companies[c.companyId];
  const color   = co ? co.color : '#94a3b8';
  const bg      = c.status === 'cancelled' ? '#e2e8f0' : color;
  const fg      = c.status === 'cancelled' ? '#94a3b8' : Utils.contrastColor(color);
  const startM  = Math.max(Utils.timeToMinutes(c.startTime) - MIN_H * 60, 0);
  const endM    = Math.min(Utils.timeToMinutes(c.endTime)   - MIN_H * 60, TOTAL_MINS);
  const top     = (startM / TOTAL_MINS * 100).toFixed(2);
  const height  = Math.max(((endM - startM) / TOTAL_MINS * 100), 1.5).toFixed(2);
  const strike  = c.status === 'cancelled' ? 'text-decoration:line-through' : '';
  const icon    = {cancelled:'✕', postponed:'⚠', moved:'↕', done:'✓'}[c.status] || '';
  const typeIco = Utils.getMissionTypeIcon(c.missionType);
  const conflict = hasConflict(c, allMissions);

  return `<div class="course-block"
       style="top:${top}%;height:${height}%;background:${bg};color:${fg};border-left:3px solid ${color}"
       onclick="event.stopPropagation();Modals.openMission('${c.id}',null,()=>renderCalendar())"
       title="${Utils.escapeHtml(c.title)} — ${c.startTime}–${c.endTime}">
    ${conflict ? '<span class="block-conflict">⚠ Conflit</span>' : ''}
    <div class="block-title" style="${strike}">${icon ? `<span class="block-status-icon">${icon}</span>` : ''}${typeIco} ${Utils.escapeHtml(c.title)}</div>
    ${c.subjectId ? (()=>{ const subj = (Data.getSubjects()||[]).find(s=>s.id===c.subjectId); return subj ? `<div class="block-time" style="opacity:0.85">📖 ${Utils.escapeHtml(subj.name)}</div>` : ''; })() : ''}
    <div class="block-time">${c.startTime}–${c.endTime}</div>
    ${c.type === 'visio' ? '<div class="block-badge">Visio</div>' : ''}
  </div>`;
}

function renderDay(date) {
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const missions  = getFilteredMissions(date, date);
  const allDay    = Data.getMissionsByDateRange(date, date); // pour détection conflits
  const today     = Utils.today();
  const nowPct    = pct(new Date().getHours() * 60 + new Date().getMinutes());
  return `<div class="day-view">
    <div class="day-body" onclick="Modals.openMission(null,'${date}',()=>renderCalendar())">
      <div class="day-time-col" style="position:relative;height:900px">${hourLines()}</div>
      <div class="day-events-col" style="position:relative;height:900px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 59px,var(--border) 59px,var(--border) 60px)">
        ${date === today ? `<div class="now-line" style="top:${nowPct}%;left:0;right:0"></div>` : ''}
        ${missions.map(m => missionBlock(m, companies, allDay)).join('')}
      </div>
    </div>
  </div>`;
}

function renderWeek() {
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const weekStart = Utils.getWeekStart(_date);
  const days      = Array.from({length:7}, (_,i) => Utils.addDays(weekStart, i));
  const missions  = getFilteredMissions(days[0], days[6]);
  const allWeek   = Data.getMissionsByDateRange(days[0], days[6]); // pour conflits
  const today     = Utils.today();
  const nowPct    = pct(new Date().getHours() * 60 + new Date().getMinutes());
  const todayIdx  = days.indexOf(today);

  const headers = days.map(d => {
    const dObj = new Date(d + 'T00:00:00');
    const isToday = d === today;
    return `<div class="week-day-header${isToday ? ' today' : ''}">
      <span class="week-day-name">${Utils.DAYS_SHORT[dObj.getDay()]}</span>
      <span class="week-day-num${isToday ? ' today-circle' : ''}"
            onclick="event.stopPropagation();_date='${d}';_view='day';document.querySelector('[data-view=day]').click()">${dObj.getDate()}</span>
    </div>`;
  }).join('');

  const cols = days.map(d => {
    const dayM = missions.filter(m => m.date === d);
    const allDayM = allWeek.filter(m => m.date === d);
    return `<div class="week-day-col" data-date="${d}"
                 onclick="event.target===this&&Modals.openMission(null,'${d}',()=>renderCalendar())">
      ${dayM.map(m => missionBlock(m, companies, allDayM)).join('')}
    </div>`;
  }).join('');

  return `<div class="week-view">
    <div class="week-header">
      <div class="week-time-gutter"></div>${headers}
    </div>
    <div class="week-body">
      <div class="week-time-col" style="position:relative;height:900px">${hourLines()}</div>
      <div class="week-days-grid" style="position:relative;height:900px">
        ${todayIdx >= 0 ? `<div class="now-line" style="top:${nowPct}%;left:calc(${todayIdx}/7*100%);width:calc(100%/7)"></div>` : ''}
        ${cols}
      </div>
    </div>
  </div>`;
}

function renderMonth() {
  const d     = new Date(_date + 'T00:00:00');
  const year  = d.getFullYear(), month = d.getMonth();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);

  let startWD = first.getDay(); startWD = startWD === 0 ? 6 : startWD - 1;
  const gridStart = new Date(first); gridStart.setDate(1 - startWD);
  const endWD = last.getDay();
  const gridEnd = new Date(last); gridEnd.setDate(last.getDate() + (endWD === 0 ? 0 : 7 - endWD));

  const rangeStart = Utils.localISO(gridStart);
  const rangeEnd   = Utils.localISO(gridEnd);
  const allM  = getFilteredMissions(rangeStart, rangeEnd);
  const allM2 = Data.getMissionsByDateRange(rangeStart, rangeEnd); // pour conflits
  const byDate = {};
  allM.forEach(m => { if (!byDate[m.date]) byDate[m.date] = []; byDate[m.date].push(m); });
  const conflictDates = new Set();
  allM2.forEach(m => { if (hasConflict(m, allM2)) conflictDates.add(m.date); });

  const today = Utils.today();
  const dayNames = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  let cells = '';
  let cur = new Date(gridStart);
  while (cur <= gridEnd) {
    const iso = Utils.localISO(cur);
    const isMonth = cur.getMonth() === month;
    const isToday = iso === today;
    const dayM = byDate[iso] || [];
    const hasConf = conflictDates.has(iso);
    const MAX = 4;
    const events = dayM.slice(0,MAX).map(m => {
      const co  = companies[m.companyId];
      const col = co ? co.color : '#94a3b8';
      const bg  = m.status === 'cancelled' ? '#e2e8f0' : col;
      const fg  = m.status === 'cancelled' ? '#94a3b8' : Utils.contrastColor(col);
      return `<div class="month-event" style="background:${bg};color:${fg};${m.status==='cancelled'?'text-decoration:line-through':''}"
                   onclick="event.stopPropagation();Modals.openMission('${m.id}',null,()=>renderCalendar())"
                   title="${Utils.escapeHtml(m.title)} — ${m.startTime||''}${m.endTime?' → '+m.endTime:''}">${Utils.getMissionTypeIcon(m.missionType)} ${Utils.escapeHtml(m.title)}</div>`;
    }).join('');
    const hiddenTitles = dayM.slice(MAX).map(m=>`• ${m.startTime||''} ${Utils.escapeHtml(m.title)}`).join('&#10;');
    const more = dayM.length > MAX
      ? `<div class="month-more" title="${hiddenTitles}" onclick="event.stopPropagation();_date='${iso}';_view='day';document.querySelector('[data-view=day]').click()">+${dayM.length - MAX} voir tout →</div>`
      : '';
    // Ronds de couleur : prestataires + étudiants impliqués ce jour
    const provMap2 = {}; Data.getProviders().forEach(p => provMap2[p.id] = p);
    const studMap2 = {}; Data.getStudents().forEach(s => studMap2[s.id] = s);
    const dots = [];
    [...new Set(dayM.map(m=>m.providerId).filter(Boolean))].slice(0,4).forEach(pid => {
      const co = companies[dayM.find(m=>m.providerId===pid)?.companyId];
      dots.push(`<span title="${provMap2[pid]?provMap2[pid].lastName:''}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${co?co.color:'#94a3b8'};border:1px solid rgba(0,0,0,0.15)"></span>`);
    });
    const studIds = [...new Set(dayM.flatMap(m=>m.studentIds||[]))].slice(0,4);
    studIds.forEach(sid => {
      const s = studMap2[sid]; if (!s) return;
      const co = companies[s.poleId||s.companyId];
      dots.push(`<span title="${s?s.lastName:''}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${co?Utils.lightenColor(co.color,0.4):'#c7d2fe'};border:1px solid ${co?co.color:'#818cf8'}"></span>`);
    });

    cells += `<div class="month-cell${!isMonth?' other-month':''}${isToday?' today':''}"
                   onclick="_date='${iso}';_view='day';document.querySelector('[data-view=day]').click()">
      <div class="month-cell-header">
        <span class="month-day-num${isToday?' today-circle':''}">${cur.getDate()}</span>
        <span>${dayM.length > 0 ? `<span class="month-day-count">${dayM.length}</span>` : ''}${hasConf ? '<span style="color:var(--danger);font-size:0.7rem" title="Conflit de planning">⚠</span>' : ''}</span>
      </div>
      <div class="month-cell-events">${events}${more}</div>
      ${dots.length > 0 ? `<div style="display:flex;gap:3px;flex-wrap:wrap;padding:2px 4px 4px;justify-content:flex-end">${dots.join('')}</div>` : ''}
    </div>`;
    cur.setDate(cur.getDate() + 1);
  }

  return `<div class="month-view">
    <div class="month-header">${dayNames.map(n => `<div class="month-day-name">${n}</div>`).join('')}</div>
    <div class="month-grid">${cells}</div>
  </div>`;
}
