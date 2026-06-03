// calendrier.js — Calendrier multi-sociétés avec filtres et détection de conflits
'use strict';

let _view = 'week';
let _date = Utils.today();
let _filterPoles    = null; // pôles (entreprises propres)
let _filterCos      = null; // écoles clientes
let _filterProviders = null;
let _filterStudents  = null;

function _initFilters() {
  _filterPoles     = new Set(Data.getOwnCompanies().map(c=>c.id));
  _filterCos       = new Set(Data.getCompanies().filter(c=>c.role!=='own').map(c=>c.id));
  _filterProviders = new Set(Data.getProviders().map(p=>p.id));
  _filterStudents  = new Set(Data.getStudents().filter(s=>s.status!=='inactive').map(s=>s.id));
}

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  _initFilters();
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
        b.setAttribute('aria-pressed', b.dataset.view === _view ? 'true' : 'false');
      });
      renderCalendar();
    });
    btn.setAttribute('aria-pressed', btn.dataset.view === _view ? 'true' : 'false');
  });
});

function _mkChk(name, label, id, checked, fn) {
  return `<label style="display:flex;align-items:center;gap:6px;padding:5px 6px;font-size:0.82rem;cursor:pointer">
    <input type="checkbox" name="${name}" value="${id}" ${checked?'checked':''} onchange="${fn}(this)">
    ${Utils.escapeHtml(label)}</label>`;
}

const _CAL_MENUS = ['cal-pole-menu','cal-co-menu','cal-prov-menu','cal-stud-menu'];
function _closeMenus(exceptId) {
  _CAL_MENUS.forEach(id => { if (id !== exceptId) document.getElementById(id).style.display = 'none'; });
}
window._calToggle = id => {
  _closeMenus(id);
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};
document.addEventListener('click', e => {
  if (!e.target.closest('#btn-filter-pole,#btn-filter-co,#btn-filter-prov,#btn-filter-stud,'+_CAL_MENUS.map(id=>'#'+id).join(','))) _closeMenus(null);
});

function buildFilters() {
  const poles    = Data.getOwnCompanies();
  const schools  = Data.getCompanies().filter(c=>c.role!=='own');
  const providers = Data.getProviders();
  const students  = Data.getStudents().filter(s => s.status !== 'inactive');

  // Pôles
  document.getElementById('cal-pole-list').innerHTML = poles.map(c =>
    _mkChk('cal-pole', c.name, c.id, _filterPoles===null||_filterPoles.has(c.id), 'window._calChkPole')).join('');
  document.getElementById('lbl-pole').textContent = _filterPoles===null||_filterPoles.size>=poles.length?'Tous':(_filterPoles.size?_filterPoles.size+' sél.':'Aucun');

  // Écoles
  document.getElementById('cal-co-list').innerHTML = schools.map(c =>
    _mkChk('cal-co', c.name, c.id, _filterCos===null||_filterCos.has(c.id), 'window._calChkCo')).join('');
  document.getElementById('lbl-co').textContent = _filterCos===null||_filterCos.size>=schools.length?'Toutes':(_filterCos.size?_filterCos.size+' sél.':'Aucune');

  const allPCt = providers.length, allSCt = students.length;
  document.getElementById('cal-prov-list').innerHTML = providers.map(p =>
    _mkChk('cal-prov', p.lastName+' '+p.firstName, p.id, _filterProviders===null||_filterProviders.has(p.id), 'window._calChkProv')).join('');
  document.getElementById('lbl-prov').textContent = _filterProviders===null||_filterProviders.size>=allPCt?'Tous':(_filterProviders.size?_filterProviders.size+' sél.':'Aucun');

  document.getElementById('cal-stud-list').innerHTML = students.map(s =>
    _mkChk('cal-stud', s.lastName+' '+s.firstName, s.id, _filterStudents===null||_filterStudents.has(s.id), 'window._calChkStud')).join('');
  document.getElementById('lbl-stud').textContent = _filterStudents===null||_filterStudents.size>=allSCt?'Tous':(_filterStudents.size?_filterStudents.size+' sél.':'Aucun');
}

window._calChkPole = cb => {
  if (_filterPoles===null) _filterPoles = new Set(Data.getOwnCompanies().map(c=>c.id));
  cb.checked ? _filterPoles.add(cb.value) : _filterPoles.delete(cb.value);
  buildFilters(); renderCalendar();
};
window._calChkCo = cb => {
  if (_filterCos===null) _filterCos = new Set(Data.getCompanies().filter(c=>c.role!=='own').map(c=>c.id));
  cb.checked ? _filterCos.add(cb.value) : _filterCos.delete(cb.value);
  buildFilters(); renderCalendar();
};
window._calChkProv = cb => {
  if (_filterProviders===null) _filterProviders = new Set(Data.getProviders().map(p=>p.id));
  cb.checked ? _filterProviders.add(cb.value) : _filterProviders.delete(cb.value);
  document.getElementById('lbl-prov').textContent = _filterProviders.size?_filterProviders.size+' sél.':'Aucun';
  renderCalendar();
};
window._calChkStud = cb => {
  if (_filterStudents===null) _filterStudents = new Set(Data.getStudents().filter(s=>s.status!=='inactive').map(s=>s.id));
  cb.checked ? _filterStudents.add(cb.value) : _filterStudents.delete(cb.value);
  document.getElementById('lbl-stud').textContent = _filterStudents.size?_filterStudents.size+' sél.':'Aucun';
  renderCalendar();
};

window._calSelectAllPole  = () => { _filterPoles=new Set(Data.getOwnCompanies().map(c=>c.id));                                                  buildFilters(); renderCalendar(); };
window._calSelectNonePole = () => { _filterPoles=new Set();                                                                                     buildFilters(); renderCalendar(); };
window._calSelectAllCo    = () => { _filterCos=new Set(Data.getCompanies().filter(c=>c.role!=='own').map(c=>c.id));                             buildFilters(); renderCalendar(); };
window._calSelectNoneCo   = () => { _filterCos=new Set();                                                                                       buildFilters(); renderCalendar(); };
window._calSelectAllProv  = () => { _filterProviders=new Set(Data.getProviders().map(p=>p.id));                                                  buildFilters(); renderCalendar(); };
window._calSelectNoneProv = () => { _filterProviders=new Set();                                                                                  buildFilters(); renderCalendar(); };
window._calSelectAllStud  = () => { _filterStudents=new Set(Data.getStudents().filter(s=>s.status!=='inactive').map(s=>s.id));                   buildFilters(); renderCalendar(); };
window._calSelectNoneStud = () => { _filterStudents=new Set();                                                                                   buildFilters(); renderCalendar(); };
window._calReset = () => { _initFilters(); buildFilters(); renderCalendar(); };

function getFilteredMissions(start, end) {
  let missions = Data.getMissionsByDateRange(start, end);
  const allProvCt = Data.getProviders().length;
  const allStudCt = Data.getStudents().filter(s=>s.status!=='inactive').length;
  const allP = _filterProviders.size >= allProvCt;
  const allS = _filterStudents.size  >= allStudCt;

  if (!allP || !allS) {
    // Filtre perso (prov/stud spécifiques) → override pôle/école
    return missions.filter(m => {
      const mp = !allP && (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).some(pid => _filterProviders.has(pid));
      const ms = !allS && (m.studentIds||[]).some(id=>_filterStudents.has(id));
      return mp || ms;
    });
  }

  // Tous prov + tous étudiants → filtre pôle + école
  const polesAll  = _filterPoles.size >= Data.getOwnCompanies().length;
  const schoolsAll = _filterCos.size  >= Data.getCompanies().filter(c=>c.role!=='own').length;
  if (polesAll && schoolsAll) return missions;

  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  return missions.filter(m => {
    const co = coMap[m.companyId]; if (!co) return false;
    // Pôle OK :
    //  - société own → vérifie si son propre ID est dans le filtre pôle
    //  - école avec poleId → vérifie le pôle parent
    //  - école sans poleId → toujours OK (non-rattachée = visible dans tous les pôles)
    const poleOk = polesAll || (
      co.role === 'own'  ? _filterPoles.has(co.id) :
      co.poleId          ? _filterPoles.has(co.poleId) :
      true               // école non-rattachée → passe toujours
    );
    // École OK :
    //  - toutes sélectionnées → OK
    //  - école cliente → vérifier si elle est dans le filtre
    //  - société own → visible seulement si son pôle est sélectionné
    const coOk = schoolsAll || _filterCos.has(m.companyId) ||
      (co.role === 'own' && _filterPoles.has(co.id));
    return poleOk && coOk;
  });
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

  // Badge revenu mensuel (seulement en vue mois)
  const revEl = document.getElementById('cal-revenue');
  if (revEl) {
    if (_view === 'month') {
      const ym = _date.slice(0, 7);
      const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled' && m.date);
      const monthRev = Math.round(
        allMissions
          .filter(m => m.date.slice(0, 7) === ym)
          .reduce((s, m) => s + (m.duration || 0) * (m.billingRate || 0), 0) * 100
      ) / 100;
      if (monthRev > 0) {
        revEl.textContent = Utils.formatMoney(monthRev);
        revEl.style.setProperty('display', 'inline-block', 'important');
      } else {
        revEl.style.setProperty('display', 'none', 'important');
      }
    } else {
      revEl.style.setProperty('display', 'none', 'important');
    }
  }

  const body = document.getElementById('calendar-body');
  if (_view === 'day')   body.innerHTML = renderDay(_date);
  if (_view === 'week')  body.innerHTML = renderWeek();
  if (_view === 'month') body.innerHTML = renderMonth();
  const scrollEl = body.querySelector('.week-body, .day-body');
  if (scrollEl) scrollEl.scrollTop = 60; // 8h00 = (8-7) × 60px/h
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

// Détecte si une mission est en conflit (prestataire commun, même heure, même jour)
function hasConflict(mission, allMissions) {
  const mProvIds = mission.providerIds?.length ? mission.providerIds : (mission.providerId ? [mission.providerId] : []);
  if (!mProvIds.length) return false;
  return allMissions.some(m => {
    if (m.id === mission.id || m.date !== mission.date || m.status === 'cancelled') return false;
    const oProvIds = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
    if (!oProvIds.some(pid => mProvIds.includes(pid))) return false;
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
    ${(c.studentIds||[]).length > 0 ? (()=>{
      const stus = (c.studentIds||[]).slice(0,2).map(sid => { const st=Data.getStudentById(sid); return st ? st.firstName+' '+st.lastName : ''; }).filter(Boolean);
      return stus.length ? `<div class="block-time" style="opacity:0.85">👤 ${Utils.escapeHtml(stus.join(', '))}${(c.studentIds||[]).length>2?' +'+((c.studentIds||[]).length-2):''}</div>` : '';
    })() : ''}
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
  // Hissé hors de la boucle pour éviter N+1 (31 appels → 1)
  const provMap2 = {}; Data.getProviders().forEach(p => provMap2[p.id] = p);
  const studMap2 = {}; Data.getStudents().forEach(s => studMap2[s.id] = s);

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
    const dots = [];
    [...new Set(dayM.flatMap(m => m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])))].slice(0,4).forEach(pid => {
      const co = companies[dayM.find(m => (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).includes(pid))?.companyId];
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
