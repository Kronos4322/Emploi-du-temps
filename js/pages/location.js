// location.js — Gestion des revenus locatifs v5
'use strict';

let _locMonth      = '';
let _locPropertyId = '';
let _locCalYear    = new Date().getFullYear();
let _locCalMonth   = new Date().getMonth(); // 0-11

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  _buildMonthFilter();
  _buildPropertyFilter();
  _renderPage();

  document.getElementById('loc-filter-month').addEventListener('change', e => {
    _locMonth = e.target.value;
    _renderPage();
  });
  document.getElementById('loc-filter-property').addEventListener('change', e => {
    _locPropertyId = e.target.value;
    _renderPage();
  });
  document.getElementById('btn-add-property').addEventListener('click', () => _openPropertyDrawer(null));
  document.getElementById('btn-add-income').addEventListener('click', () => _openIncomeDrawer(null));
  document.getElementById('btn-export-csv').addEventListener('click', _exportCsv);
  document.getElementById('loc-overlay').addEventListener('click', _locCloseDrawers);
});

// ── Helpers ──────────────────────────────────────────────────

function _nightsInMonth(r, ym) {
  const [y, m] = ym.split('-').map(Number);
  const daysInM = new Date(y, m, 0).getDate();
  const mStart  = `${ym}-01`;
  const mEnd    = `${ym}-${String(daysInM).padStart(2,'0')}`;
  if (!r.startDate || !r.endDate) return 0;
  if (r.endDate <= mStart || r.startDate > mEnd) return 0;
  let d = new Date(Math.max(new Date(r.startDate+'T00:00:00'), new Date(y, m-1, 1)));
  const end = new Date(Math.min(new Date(r.endDate+'T00:00:00'), new Date(y, m, 0, 23, 59)));
  let n = 0;
  while (d < end) { n++; d.setDate(d.getDate()+1); }
  return n;
}

function _formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// ── Filtres ──────────────────────────────────────────────────

function _buildMonthFilter() {
  const now       = new Date();
  const currentYm = Utils.currentYearMonth();
  const incomes   = Data.getRentalIncomes();
  const existYms  = new Set(incomes.map(r => r.yearMonth).filter(Boolean));
  const months    = new Set();
  for (let i = 0; i <= 24; i++) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  existYms.forEach(ym => months.add(ym));
  const sorted = [...months].sort((a,b) => b.localeCompare(a));
  const el = document.getElementById('loc-filter-month');
  el.innerHTML = `<option value="">Tous les mois</option>` +
    sorted.map(ym => {
      const [y,m] = ym.split('-');
      const isFuture = ym > currentYm;
      const hasData  = existYms.has(ym);
      const label    = `${Utils.MONTHS_LONG[+m-1]} ${y}${isFuture?' (prévu)':''}${hasData?' ●':''}`;
      return `<option value="${ym}" ${ym===_locMonth?'selected':''}>${label}</option>`;
    }).join('');
}

function _buildPropertyFilter() {
  const props = Data.getProperties();
  const el = document.getElementById('loc-filter-property');
  el.innerHTML = '<option value="">Tous les biens</option>' +
    props.map(p => `<option value="${p.id}" ${p.id===_locPropertyId?'selected':''}>${Utils.escapeHtml(p.name)}</option>`).join('');
}

// ── Rendu principal ──────────────────────────────────────────

function _renderPage() {
  _renderKpis();
  _renderProperties();
  _renderCalendar();
  _renderIncomes();
  const el = document.getElementById('loc-month-label');
  if (_locMonth) {
    const [y,m] = _locMonth.split('-');
    el.textContent = `${Utils.MONTHS_LONG[+m-1]} ${y}`;
  } else {
    el.textContent = 'Tous les mois';
  }
}

// ── Navigation calendrier ────────────────────────────────────

window._locCalPrev = () => {
  _locCalMonth--;
  if (_locCalMonth < 0) { _locCalMonth = 11; _locCalYear--; }
  _renderCalendar();
};
window._locCalNext = () => {
  _locCalMonth++;
  if (_locCalMonth > 11) { _locCalMonth = 0; _locCalYear++; }
  _renderCalendar();
};

// ── KPIs ─────────────────────────────────────────────────────

function _renderKpis() {
  const allIncomes = Data.getRentalIncomes();
  const currentYm  = Utils.currentYearMonth();
  const now        = new Date();
  const displayYm  = _locMonth || currentYm;
  const filtered   = _locPropertyId ? allIncomes.filter(r => r.propertyId === _locPropertyId) : allIncomes;

  // Revenus + nuits du mois affiché
  const dispMonthInc   = filtered.filter(r => r.yearMonth === displayYm);
  const dispMonthTotal = dispMonthInc.reduce((s,r) => s+(r.amount||0), 0);
  const pending        = dispMonthInc.filter(r => r.status!=='received').reduce((s,r) => s+(r.amount||0), 0);

  // Cumul 12 mois glissants
  const cutoff  = new Date(now.getFullYear(), now.getMonth()-11, 1);
  const cutYm   = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}`;
  const yearTotal = filtered.filter(r => r.yearMonth>=cutYm && r.yearMonth<=currentYm).reduce((s,r) => s+(r.amount||0), 0);

  // Taux d'occupation du mois affiché
  const [dy,dm]    = displayYm.split('-').map(Number);
  const daysInMonth = new Date(dy, dm, 0).getDate();
  const nightsBooked = filtered.filter(r => r.startDate && r.endDate).reduce((s,r) => s+_nightsInMonth(r,displayYm), 0);
  const occupancy  = daysInMonth > 0 ? Math.round(nightsBooked/daysInMonth*100) : 0;

  // RevPAN — revenu par nuit effectivement louée
  const revPAN = nightsBooked > 0 ? Math.round(dispMonthTotal/nightsBooked) : 0;

  // Label KPI mois
  const monthLabel = document.getElementById('loc-kpi-month-label');
  if (monthLabel) {
    if (_locMonth) {
      const [ly,lm] = _locMonth.split('-');
      monthLabel.textContent = `${Utils.MONTHS_LONG[+lm-1]} ${ly}`;
    } else {
      monthLabel.textContent = 'Revenus du mois';
    }
  }

  document.getElementById('loc-kpi-total').textContent   = Utils.formatMoney(dispMonthTotal);
  document.getElementById('loc-kpi-year').textContent    = Utils.formatMoney(yearTotal);
  document.getElementById('loc-kpi-props').textContent   = Data.getActiveProperties().length;
  document.getElementById('loc-kpi-pending').textContent = Utils.formatMoney(pending);

  const occEl = document.getElementById('loc-kpi-occ');
  if (occEl) occEl.textContent = `${occupancy} %`;
  const occBar = document.getElementById('loc-kpi-occ-bar');
  if (occBar) occBar.style.width = `${Math.min(occupancy,100)}%`;

  const revPanEl = document.getElementById('loc-kpi-revpan');
  if (revPanEl) revPanEl.textContent = revPAN > 0 ? Utils.formatMoney(revPAN) : '—';

  const pendingCard = document.getElementById('loc-kpi-pending-card');
  if (pendingCard) pendingCard.className = pending > 0 ? 'kpi-card kpi-alert-card' : 'kpi-card';
}

// ── Cartes biens ─────────────────────────────────────────────

function _renderProperties() {
  const props     = Data.getProperties();
  const allInc    = Data.getRentalIncomes();
  const container = document.getElementById('properties-list');

  if (!props.length) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px 20px;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:12px">🏠</div>
      <p style="font-weight:600;margin-bottom:6px">Aucun bien enregistré</p>
      <p style="color:var(--text-muted);font-size:0.87rem;margin-bottom:16px">Ajoutez votre premier bien locatif pour commencer le suivi.</p>
      <button class="btn btn-primary btn-sm" onclick="window._locOpenPropertyDrawer(null)">+ Ajouter un bien</button>
    </div>`;
    return;
  }

  const displayYm = _locMonth || Utils.currentYearMonth();
  const [py,pm]   = displayYm.split('-').map(Number);
  const daysInM   = new Date(py, pm, 0).getDate();
  const TYPE_LABELS = { airbnb:'Airbnb', booking:'Booking', 'long-term':'Longue durée', seasonal:'Saisonnier', other:'Autre' };

  container.innerHTML = props.map(p => {
    const propInc   = allInc.filter(r => r.propertyId === p.id);
    const monthInc  = propInc.filter(r => r.yearMonth === displayYm);
    const monthTotal = monthInc.reduce((s,r) => s+(r.amount||0), 0);

    // Nuits louées ce mois
    const monthNights = propInc.filter(r => r.startDate && r.endDate).reduce((s,r) => s+_nightsInMonth(r,displayYm), 0);
    const propOcc     = daysInM > 0 ? Math.round(monthNights/daysInM*100) : 0;
    const propRevPAN  = monthNights > 0 ? Math.round(monthTotal/monthNights) : 0;

    // Cumul total toutes périodes
    const allTotal = propInc.reduce((s,r) => s+(r.amount||0), 0);

    // Prochaine réservation
    const today = Utils.today();
    const upcoming = propInc.filter(r => r.startDate && r.startDate >= today).sort((a,b) => a.startDate.localeCompare(b.startDate))[0];
    const upcomingLabel = upcoming ? `Prochaine : ${_formatShortDate(upcoming.startDate)}` : '';

    const isInactive = p.active === false;
    const statusBadge = isInactive ? `<span style="font-size:0.68rem;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1px 7px;color:var(--text-muted);margin-left:6px">Inactif</span>` : '';
    const defaultRateLabel = p.defaultRate ? `· ${p.defaultRate}€/nuit` : '';

    // Couleur de la barre d'occupation : vert si >70%, orange si >40%, rouge sinon
    const occColor = propOcc >= 70 ? '#22c55e' : propOcc >= 40 ? '#f97316' : '#ef4444';

    return `<div class="property-card" style="border-left-color:${p.color||'#94a3b8'}${isInactive?';opacity:0.7':''};cursor:pointer" onclick="window._locOpenPropertyDetail('${p.id}')">
      <div class="property-card-header">
        <div class="property-color-dot" style="background:${p.color||'#94a3b8'}"></div>
        <div style="flex:1;min-width:0">
          <div class="property-name">${Utils.escapeHtml(p.name)}${statusBadge}</div>
          <div class="property-meta">${Utils.escapeHtml(p.address||'')}${p.address&&(p.type||defaultRateLabel)?' · ':''}${TYPE_LABELS[p.type]||''}${defaultRateLabel}</div>
        </div>
      </div>
      ${p.notes ? `<div class="property-meta" style="margin-top:4px;font-style:italic">${Utils.escapeHtml(p.notes)}</div>` : ''}

      <!-- Barre d'occupation -->
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">
          <span>Occupation — ${Utils.MONTHS_LONG[pm-1]}</span>
          <span style="font-weight:700;color:${occColor}">${propOcc} %</span>
        </div>
        <div class="property-occ-bar">
          <div class="property-occ-bar-fill" style="width:${propOcc}%;background:${occColor}"></div>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${monthNights} nuit${monthNights>1?'s':''} louée${monthNights>1?'s':''} / ${daysInM} jours</div>
      </div>

      <!-- Stats -->
      <div class="property-kpis">
        <div>
          <div class="property-kpi-val">${Utils.formatMoney(monthTotal)}</div>
          <div class="property-kpi-lbl">Ce mois</div>
        </div>
        <div>
          <div class="property-kpi-val">${Utils.formatMoney(allTotal)}</div>
          <div class="property-kpi-lbl">Total</div>
        </div>
        <div>
          <div class="property-kpi-val">${propRevPAN > 0 ? propRevPAN+'€' : '—'}</div>
          <div class="property-kpi-lbl">RevPAN</div>
        </div>
      </div>

      ${upcomingLabel ? `<div style="margin-top:8px;font-size:0.75rem;color:var(--primary);font-weight:600">📅 ${upcomingLabel}</div>` : ''}

      <div class="property-actions" style="margin-top:10px" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="window._locOpenPropertyDrawer('${p.id}')">✏ Modifier</button>
        <button class="btn btn-ghost btn-sm" onclick="window._locAddIncomeForProp('${p.id}')">+ Revenu</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);margin-left:auto" onclick="window._locDeleteProperty('${p.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ── Calendrier ───────────────────────────────────────────────

function _renderCalendar() {
  const calEl = document.getElementById('loc-calendar');
  const lblEl = document.getElementById('loc-cal-label');
  if (!calEl) return;

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_SH   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  lblEl.textContent = MONTHS_FR[_locCalMonth]+' '+_locCalYear;

  const props    = Data.getProperties();
  const propMap  = {}; props.forEach(p => propMap[p.id] = p);
  const incomes  = Data.getRentalIncomes().filter(r => r.startDate && r.endDate);
  const filtInc  = _locPropertyId ? incomes.filter(r => r.propertyId === _locPropertyId) : incomes;

  const firstDay = new Date(_locCalYear, _locCalMonth, 1);
  const lastDay  = new Date(_locCalYear, _locCalMonth+1, 0);
  const startWd  = (firstDay.getDay()+6)%7;
  const daysInM  = lastDay.getDate();

  // Maps par date
  const checkinMap  = {};  // date → [income]
  const checkoutMap = {};  // date → [income]
  const occupiedMap = {};  // date → [income]  (jours intermédiaires)

  filtInc.forEach(r => {
    const start = r.startDate;
    const end   = r.endDate;
    if (start) { if (!checkinMap[start]) checkinMap[start]=[]; checkinMap[start].push(r); }
    if (end)   { if (!checkoutMap[end]) checkoutMap[end]=[]; checkoutMap[end].push(r); }
    // Jours intermédiaires (entre start et end exclus) — format local, pas UTC
    let d = new Date(start+'T00:00:00');
    d.setDate(d.getDate()+1);
    const endD = new Date(end+'T00:00:00');
    while (d < endD) {
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!occupiedMap[key]) occupiedMap[key] = [];
      occupiedMap[key].push(r);
      d.setDate(d.getDate()+1);
    }
  });

  // En-tête
  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">
    ${DAYS_SH.map((d,i) => `<div style="text-align:center;font-size:0.68rem;font-weight:700;color:${i>=5?'var(--primary)':'var(--text-muted)'};padding:4px 0">${d}</div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;

  for (let i=0; i<startWd; i++) html += '<div></div>';

  const todayStr = Utils.today();
  const pad = n => String(n).padStart(2,'0');

  for (let day=1; day<=daysInM; day++) {
    const dStr      = `${_locCalYear}-${pad(_locCalMonth+1)}-${pad(day)}`;
    const isToday   = dStr === todayStr;
    const dow       = (new Date(dStr+'T00:00:00').getDay()+6)%7; // 0=Lun

    const checkins  = checkinMap[dStr]  || [];
    const checkouts = checkoutMap[dStr] || [];
    const occupied  = occupiedMap[dStr] || [];

    // Nuit réservée = arrivée ou nuit intermédiaire (le jour de départ est libre)
    const nightSold    = checkins.length > 0 || occupied.length > 0;
    const checkoutOnly = checkouts.length > 0 && !nightSold;

    // Couleurs : rouge = réservé, vert = libre, jaune = jour de départ (nuit libre)
    let bg, numColor;
    if (nightSold) {
      bg = '#fecaca'; numColor = '#dc2626';           // rouge visible = réservé
    } else if (checkoutOnly) {
      bg = '#fef08a'; numColor = '#b45309';           // jaune = départ, nuit disponible
    } else {
      bg = '#bbf7d0'; numColor = '#15803d';           // vert visible = libre
    }
    // Aujourd'hui : bordure bleue, on garde le fond couleur
    const border = isToday ? 'border:2px solid #3b82f6;' : '';

    // Barre de couleur en bas = couleur du bien (si réservé)
    const propColor = nightSold
      ? (propMap[(checkins[0]||occupied[0])?.propertyId]?.color || '#ef4444')
      : (checkoutOnly ? (propMap[checkouts[0]?.propertyId]?.color || '#f59e0b') : null);
    // Barre colorée en bas (couleur du bien)
    const strip = propColor
      ? `<div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:${propColor}"></div>`
      : '';

    const cellStyle = `min-height:48px;border-radius:6px;padding:5px 5px 4px;cursor:pointer;border:${isToday?'2px solid #3b82f6':'1px solid rgba(0,0,0,0.08)'};background:${bg};position:relative;overflow:hidden;transition:box-shadow .15s`;

    html += `<div style="${cellStyle}" onclick="window._locCalClick('${dStr}')">
      <div style="font-size:0.76rem;font-weight:${isToday||nightSold?700:400};color:${isToday?'#3b82f6':numColor};line-height:1">${day}</div>
      ${strip}
    </div>`;
  }
  html += '</div>';

  calEl.innerHTML = html;
}

window._locCalClick = function(dateStr) {
  const incomes = Data.getRentalIncomes().filter(r => r.startDate && r.endDate);
  const booked  = incomes.find(r => r.startDate <= dateStr && r.endDate >= dateStr);
  if (booked) { _openIncomeDrawer(booked.id); return; }
  _openIncomeDrawer(null, dateStr);
};

// ── Tableau revenus ──────────────────────────────────────────

function _incomeRow(r, propMap, STATUS) {
  const prop    = propMap[r.propertyId];
  const col     = prop?.color || '#94a3b8';
  const period  = r.startDate && r.endDate
    ? `${_formatShortDate(r.startDate)} → ${_formatShortDate(r.endDate)}`
    : '—';
  const nights  = r.nightsRented != null ? r.nightsRented : '';
  const nightsBadge = nights !== ''
    ? `<span class="loc-nights-badge">${nights} nuit${nights>1?'s':''}</span>`
    : '—';

  const quickRecu = r.status !== 'received'
    ? `<button class="btn btn-ghost btn-xs" style="color:var(--success)" title="Marquer comme reçu" onclick="window._locMarkReceived('${r.id}')">✓</button>`
    : '';

  return `<tr>
    <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name||'—')}</td>
    <td class="loc-period-cell">${period}</td>
    <td class="cell-center">${nightsBadge}</td>
    <td class="cell-money" style="font-weight:600">${Utils.formatMoney(r.amount||0)}</td>
    <td style="font-size:0.82rem">${Utils.escapeHtml(r.platform||'—')}</td>
    <td>${STATUS[r.status]||r.status||''}</td>
    <td style="font-size:0.78rem;color:var(--text-muted)">${Utils.escapeHtml(r.notes||'')}</td>
    <td class="cell-center" style="white-space:nowrap">
      ${quickRecu}
      <button class="btn btn-ghost btn-xs" onclick="window._locOpenIncomeDrawer('${r.id}')">✏</button>
      <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="window._locDeleteIncome('${r.id}')">🗑</button>
    </td>
  </tr>`;
}

function _renderIncomes() {
  let allInc = Data.getRentalIncomes();
  if (_locPropertyId) allInc = allInc.filter(r => r.propertyId === _locPropertyId);
  if (_locMonth)      allInc = allInc.filter(r => r.yearMonth === _locMonth);

  allInc.sort((a,b) => {
    const d = (b.yearMonth||'').localeCompare(a.yearMonth||'');
    return d !== 0 ? d : (a.startDate||'').localeCompare(b.startDate||'');
  });

  const propMap   = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const grandTotal = allInc.reduce((s,r) => s+(r.amount||0), 0);

  const STATUS = {
    received: '<span class="badge badge-success">✓ Reçu</span>',
    pending:  '<span class="badge badge-warning">⏳ En attente</span>',
    partial:  '<span class="badge badge-danger">⚠ Partiel</span>',
  };

  const tbody = document.getElementById('incomes-tbody');

  if (allInc.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state-cell">Aucun revenu enregistré.
      <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="window._locOpenIncomeDrawer(null)">+ Ajouter</button></td></tr>`;
    document.getElementById('incomes-total').innerHTML = `<strong>${Utils.formatMoney(0)}</strong>`;
    return;
  }

  if (_locMonth) {
    tbody.innerHTML = allInc.map(r => _incomeRow(r, propMap, STATUS)).join('');
  } else {
    const byMonth = {};
    allInc.forEach(r => {
      const key = r.yearMonth || '?';
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(r);
    });
    const currentYm = Utils.currentYearMonth();
    let html = '';
    Object.keys(byMonth).sort((a,b) => b.localeCompare(a)).forEach(ym => {
      const rows     = byMonth[ym];
      const subtotal = rows.reduce((s,r) => s+(r.amount||0), 0);
      const nights   = rows.reduce((s,r) => s+(r.nightsRented||0), 0);
      let label = ym === '?' ? 'Date inconnue' : (() => {
        const [y,m] = ym.split('-');
        return `${Utils.MONTHS_LONG[+m-1]} ${y}`;
      })();
      const isFuture = ym > currentYm;
      html += `<tr style="background:var(--bg);border-top:2px solid var(--border)">
        <td colspan="2" style="font-weight:700;font-size:0.88rem;padding:8px 12px;color:var(--text)">
          ${label}${isFuture?' <span style="font-size:0.73rem;color:var(--text-muted);font-weight:400">(prévu)</span>':''}
        </td>
        <td class="cell-center" style="font-size:0.78rem;color:var(--text-muted)">${nights>0?nights+' nuits':''}</td>
        <td class="cell-money" style="font-weight:700;color:var(--primary)">${Utils.formatMoney(subtotal)}</td>
        <td colspan="4" style="font-size:0.78rem;color:var(--text-muted);padding:8px 12px">
          ${rows.length} réservation${rows.length>1?'s':''}
        </td>
      </tr>`;
      rows.forEach(r => { html += _incomeRow(r, propMap, STATUS); });
    });
    tbody.innerHTML = html;
  }

  document.getElementById('incomes-total').innerHTML = `<strong>${Utils.formatMoney(grandTotal)}</strong>`;
}

// ── Drawer Bien ──────────────────────────────────────────────

function _openPropertyDrawer(id) {
  _locCloseDrawers();
  const prop = id ? Data.getPropertyById(id) : null;
  document.getElementById('property-drawer-title').textContent = prop ? 'Modifier le bien' : 'Nouveau bien';
  document.getElementById('prop-id').value           = prop?.id || '';
  document.getElementById('prop-name').value         = prop?.name || '';
  document.getElementById('prop-address').value      = prop?.address || '';
  document.getElementById('prop-type').value         = prop?.type || 'airbnb';
  document.getElementById('prop-color').value        = prop?.color || '#f97316';
  document.getElementById('prop-default-rate').value = prop?.defaultRate != null ? prop.defaultRate : '';
  document.getElementById('prop-notes').value        = prop?.notes || '';
  document.getElementById('prop-active').checked     = prop ? (prop.active !== false) : true;
  document.getElementById('property-drawer').classList.add('open');
  document.getElementById('loc-overlay').classList.add('open');
  setTimeout(() => document.getElementById('prop-name').focus(), 50);
}

function _locSaveProperty(e) {
  e.preventDefault();
  const id = document.getElementById('prop-id').value;
  const rateVal = document.getElementById('prop-default-rate').value;
  const property = {
    id:          id || Utils.uuid(),
    name:        document.getElementById('prop-name').value.trim(),
    address:     document.getElementById('prop-address').value.trim(),
    type:        document.getElementById('prop-type').value,
    color:       document.getElementById('prop-color').value,
    defaultRate: rateVal !== '' ? parseFloat(rateVal) : null,
    notes:       document.getElementById('prop-notes').value.trim(),
    active:      document.getElementById('prop-active').checked,
  };
  Data.saveProperty(property);
  _locCloseDrawers();
  _buildPropertyFilter();
  _renderPage();
}

// ── Drawer Revenu ────────────────────────────────────────────

function _openIncomeDrawer(id, preDate, prePropertyId) {
  _locCloseDrawers();
  const income = id ? Data.getRentalIncomeById(id) : null;
  const props  = Data.getActiveProperties();
  const sel    = document.getElementById('inc-property');
  sel.innerHTML = props.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('');
  if (!props.length) {
    alert('Ajoutez d\'abord un bien avant d\'enregistrer un revenu.');
    return;
  }
  const defaultStart   = income?.startDate || preDate || Utils.today();
  const defaultEnd     = income?.endDate   || '';
  const selectedPropId = income?.propertyId || prePropertyId || props[0]?.id || '';
  const selectedProp   = props.find(p => p.id === selectedPropId);

  document.getElementById('income-drawer-title').textContent = income ? 'Modifier la réservation' : 'Nouvelle réservation';
  document.getElementById('inc-id').value         = income?.id || '';
  document.getElementById('inc-property').value   = selectedPropId;
  document.getElementById('inc-start-date').value = defaultStart;
  document.getElementById('inc-end-date').value   = defaultEnd;
  document.getElementById('inc-amount').value     = income?.amount != null ? income.amount : '';
  document.getElementById('inc-platform').value   = income?.platform || '';
  document.getElementById('inc-nights').value     = income?.nightsRented != null ? income.nightsRented : '';
  document.getElementById('inc-rate').value       = income?.ratePerNight != null ? income.ratePerNight
                                                    : (selectedProp?.defaultRate != null ? selectedProp.defaultRate : '');
  document.getElementById('inc-status').value     = income?.status || 'received';
  document.getElementById('inc-notes').value      = income?.notes || '';
  document.getElementById('inc-calc-hint').textContent = '';
  _locCalcTotal();
  document.getElementById('income-drawer').classList.add('open');
  document.getElementById('loc-overlay').classList.add('open');
  setTimeout(() => document.getElementById('inc-start-date').focus(), 50);
}

// Mise à jour du tarif par défaut quand on change de bien
function _locOnPropertyChange() {
  const propId = document.getElementById('inc-property').value;
  const prop   = Data.getPropertyById(propId);
  const rateEl = document.getElementById('inc-rate');
  // Seulement si le champ tarif est vide
  if (prop?.defaultRate != null && !rateEl.value) {
    rateEl.value = prop.defaultRate;
    _locCalcTotal();
  }
}

function _locCalcTotal() {
  const startVal = document.getElementById('inc-start-date')?.value;
  const endVal   = document.getElementById('inc-end-date')?.value;
  const rate     = parseFloat(document.getElementById('inc-rate')?.value);
  const hint     = document.getElementById('inc-calc-hint');

  let nights = 0;
  if (startVal && endVal && endVal > startVal) {
    nights = Math.round((new Date(endVal+'T00:00:00') - new Date(startVal+'T00:00:00')) / 86400000);
    document.getElementById('inc-nights').value = nights;
  }

  if (nights > 0 && !isNaN(rate) && rate > 0) {
    const total = Math.round(nights * rate * 100) / 100;
    document.getElementById('inc-amount').value = total;
    if (hint) hint.textContent = `${nights} nuit${nights>1?'s':''} × ${rate} € = ${total} €`;
  } else if (nights > 0) {
    if (hint) hint.textContent = `${nights} nuit${nights>1?'s':''}`;
  } else {
    if (hint) hint.textContent = '';
  }
}

function _locSaveIncome(e) {
  e.preventDefault();
  const startDate = document.getElementById('inc-start-date').value;
  const endDate   = document.getElementById('inc-end-date').value;
  if (startDate && endDate && endDate <= startDate) {
    alert('La date de départ doit être postérieure à la date d\'arrivée.');
    return;
  }
  const id        = document.getElementById('inc-id').value;
  const nightsVal = document.getElementById('inc-nights').value;
  const rateVal   = document.getElementById('inc-rate').value;
  const yearMonth = startDate ? startDate.substring(0,7) : '';

  const income = {
    id:           id || Utils.uuid(),
    propertyId:   document.getElementById('inc-property').value,
    startDate,
    endDate,
    yearMonth,
    amount:       parseFloat(document.getElementById('inc-amount').value) || 0,
    platform:     document.getElementById('inc-platform').value.trim(),
    nightsRented: nightsVal !== '' ? parseInt(nightsVal,10) : null,
    ratePerNight: rateVal   !== '' ? parseFloat(rateVal)    : null,
    status:       document.getElementById('inc-status').value,
    notes:        document.getElementById('inc-notes').value.trim(),
  };
  Data.saveRentalIncome(income);
  _locCloseDrawers();
  _locMonth = '';
  _buildMonthFilter();
  _renderPage();
}

// ── Actions rapides ──────────────────────────────────────────

function _locMarkReceived(id) {
  const income = Data.getRentalIncomeById(id);
  if (!income) return;
  Data.saveRentalIncome({...income, status:'received'});
  _renderPage();
  Utils.toast('Paiement marqué comme reçu.', 'success');
}

// ── Supprimer ────────────────────────────────────────────────

function _locDeleteProperty(id) {
  const prop = Data.getPropertyById(id);
  if (!prop) return;
  const incCount = Data.getRentalIncomesByProperty(id).length;
  const msg = incCount > 0
    ? `Supprimer "${prop.name}" et ses ${incCount} entrée(s) de revenus ? Cette action est irréversible.`
    : `Supprimer "${prop.name}" ?`;
  if (!confirm(msg)) return;
  Data.deleteProperty(id);
  _buildPropertyFilter();
  _locPropertyId = '';
  _renderPage();
}

function _locDeleteIncome(id) {
  if (!confirm('Supprimer cette réservation ?')) return;
  Data.deleteRentalIncome(id);
  _renderPage();
}

// ── Export CSV ───────────────────────────────────────────────

function _exportCsv() {
  let incomes = Data.getRentalIncomes();
  if (_locPropertyId) incomes = incomes.filter(r => r.propertyId === _locPropertyId);
  if (_locMonth)      incomes = incomes.filter(r => r.yearMonth === _locMonth);
  const propMap = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const rows = [['Bien','Mois','Arrivée','Départ','Nuits','Tarif/nuit','Montant','Plateforme','Statut','Notes']];
  incomes.forEach(r => {
    const prop = propMap[r.propertyId];
    rows.push([prop?.name||'', r.yearMonth||'', r.startDate||'', r.endDate||'',
      r.nightsRented!=null?r.nightsRented:'', r.ratePerNight!=null?r.ratePerNight:'',
      r.amount||0, r.platform||'', r.status||'', r.notes||'']);
  });
  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `location-${_locMonth||'tous'}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Raccourcis ───────────────────────────────────────────────

function _locCloseDrawers() {
  ['property-drawer','income-drawer','property-detail-drawer'].forEach(id => {
    document.getElementById(id)?.classList.remove('open');
  });
  document.getElementById('loc-overlay').classList.remove('open');
}

function _locAddIncomeForProp(propertyId) {
  _openIncomeDrawer(null, null, propertyId);
}

// ── Détail bien + Charges ────────────────────────────────────

const FB = 'https://emploi-du-temps-97818-default-rtdb.europe-west1.firebasedatabase.app/db';
let _pdPropId    = null;
let _pdDisplayYm = '';

const CAT_LABELS = { eau:'💧 Eau', electricite:'⚡ Électricité', menage:'🧹 Ménage', gardiennage:'🔒 Gardiennage', autre:'📦 Autre' };

async function _loadExpenses(propertyId) {
  try {
    const d = await (await fetch(`${FB}/propertyExpenses.json`)).json();
    return (d || []).filter(e => e && e.propertyId === propertyId);
  } catch { return []; }
}

async function _saveExpenseFB(expense) {
  const all = await (await fetch(`${FB}/propertyExpenses.json`)).json() || [];
  const idx = all.findIndex(e => e?.id === expense.id);
  if (idx >= 0) all[idx] = expense; else all.push(expense);
  await fetch(`${FB}/propertyExpenses.json`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(all) });
  await fetch(`${FB}/_updatedAt.json`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:Date.now().toString() });
}

async function _deleteExpenseFB(id) {
  const all = ((await (await fetch(`${FB}/propertyExpenses.json`)).json()) || []).filter(e => e?.id !== id);
  await fetch(`${FB}/propertyExpenses.json`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(all) });
  await fetch(`${FB}/_updatedAt.json`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:Date.now().toString() });
}

async function _openPropertyDetail(propertyId) {
  _locCloseDrawers();
  _pdPropId    = propertyId;
  _pdDisplayYm = _locMonth || Utils.currentYearMonth();
  window._pdPropId = _pdPropId;
  const prop = Data.getPropertyById(propertyId);
  if (!prop) return;
  document.getElementById('pd-title').textContent = prop.name;
  document.getElementById('pd-title').style.borderLeft = `4px solid ${prop.color||'#94a3b8'}`;
  document.getElementById('pd-title').style.paddingLeft = '10px';
  document.getElementById('property-detail-drawer').classList.add('open');
  document.getElementById('loc-overlay').classList.add('open');
  await _renderPropertyDetail();
}

async function _pdChangeMonth(delta) {
  const [y, m] = _pdDisplayYm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  _pdDisplayYm = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  await _renderPropertyDetail();
}

async function _renderPropertyDetail() {
  if (!_pdPropId) return;
  const prop     = Data.getPropertyById(_pdPropId);
  const allInc   = Data.getRentalIncomes().filter(r => r.propertyId === _pdPropId);
  const expenses = await _loadExpenses(_pdPropId);
  const displayYm = _pdDisplayYm || Utils.currentYearMonth();
  const [py,pm]  = displayYm.split('-').map(Number);
  // Mettre à jour le label du mois dans le header
  const mlEl = document.getElementById('pd-month-label');
  if (mlEl) mlEl.textContent = `${Utils.MONTHS_LONG[pm-1]} ${py}`;
  const daysInM  = new Date(py, pm, 0).getDate();

  // Revenus
  const monthInc   = allInc.filter(r => r.yearMonth === displayYm);
  const monthRev   = monthInc.reduce((s,r) => s+(r.amount||0), 0);
  const totalRev   = allInc.reduce((s,r) => s+(r.amount||0), 0);
  const monthNights    = allInc.filter(r=>r.startDate&&r.endDate).reduce((s,r)=>s+_nightsInMonth(r,displayYm),0);
  const propOcc        = daysInM > 0 ? Math.round(monthNights/daysInM*100) : 0;
  // RevPAN global : utilise nightsRented stocké (pas le calcul mensuel qui découpe les séjours)
  const allNightsStored = allInc.reduce((s,r) => s+(r.nightsRented||0), 0);
  const revPAN          = allNightsStored > 0 ? Math.round(totalRev/allNightsStored) : 0;

  // Charges
  const monthExp   = expenses.filter(e => e.yearMonth === displayYm);
  const totalExp   = expenses.reduce((s,e) => s+(e.amount||0), 0);
  const monthExpTotal = monthExp.reduce((s,e) => s+(e.amount||0), 0);
  const occColor   = propOcc >= 70 ? '#22c55e' : propOcc >= 40 ? '#f97316' : '#ef4444';

  // ── KPIs ──
  document.getElementById('pd-kpis').innerHTML = `
    <div style="background:var(--surface);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">${Utils.formatMoney(monthRev)}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Revenus ce mois</div>
    </div>
    <div style="background:var(--surface);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:1.3rem;font-weight:700">${Utils.formatMoney(totalRev)}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Total revenus</div>
    </div>
    <div style="background:var(--surface);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:1.3rem;font-weight:700;color:${occColor}">${propOcc} %</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Taux occupation</div>
      <div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px"><div style="height:4px;width:${propOcc}%;background:${occColor};border-radius:2px"></div></div>
    </div>
    <div style="background:var(--surface);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:1.3rem;font-weight:700">${revPAN > 0 ? revPAN+'€' : '—'}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">RevPAN</div>
    </div>
    <div style="background:#fef2f2;border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:1.3rem;font-weight:700;color:#dc2626">${Utils.formatMoney(totalExp)}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Total charges</div>
    </div>
    <div style="background:${totalRev-totalExp>=0?'#f0fdf4':'#fef2f2'};border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:1.3rem;font-weight:700;color:${totalRev-totalExp>=0?'#16a34a':'#dc2626'}">${Utils.formatMoney(totalRev-totalExp)}</div>
      <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">Revenu net</div>
    </div>`;

  // ── Revenus par mois ──
  const byMonth = {};
  allInc.forEach(r => { const k=r.yearMonth||'?'; if(!byMonth[k]) byMonth[k]=[]; byMonth[k].push(r); });
  const revRows = Object.keys(byMonth).sort((a,b)=>b.localeCompare(a)).map(ym => {
    const [y,m] = ym.split('-');
    const sub   = byMonth[ym].reduce((s,r)=>s+(r.amount||0),0);
    const nights = byMonth[ym].reduce((s,r)=>s+(r.nightsRented||0),0);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.85rem">
      <span style="font-weight:600">${Utils.MONTHS_LONG[+m-1]} ${y}</span>
      <span style="color:var(--text-muted)">${nights} nuit${nights>1?'s':''}</span>
      <span style="font-weight:700;color:var(--primary)">${Utils.formatMoney(sub)}</span>
    </div>`;
  }).join('');
  document.getElementById('pd-revenues').innerHTML = revRows || '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">Aucun revenu enregistré</div>';

  // ── Charges ──
  const expRows = expenses.sort((a,b)=>(b.yearMonth||'').localeCompare(a.yearMonth||'')).map(e => {
    const [y,m] = (e.yearMonth||'').split('-');
    const label = m ? `${Utils.MONTHS_LONG[+m-1]} ${y}` : '—';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.84rem">
      <span style="flex:1">${CAT_LABELS[e.category]||e.category||'—'}</span>
      <span style="color:var(--text-muted);font-size:0.78rem">${label}</span>
      <span style="font-weight:700;color:#dc2626;min-width:70px;text-align:right">−${Utils.formatMoney(e.amount||0)}</span>
      ${e.notes ? `<span style="font-size:0.74rem;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Utils.escapeHtml(e.notes)}">${Utils.escapeHtml(e.notes)}</span>` : ''}
      <button class="btn btn-ghost btn-xs" onclick="window._locEditExpense('${e.id}')">✏</button>
      <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="window._locDeleteExpense('${e.id}')">🗑</button>
    </div>`;
  }).join('');
  document.getElementById('pd-expenses').innerHTML = expRows || '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">Aucune charge enregistrée</div>';
}

function _locOpenExpenseForm(expense) {
  const isEdit = !!expense;
  const ym = expense?.yearMonth || (_locMonth || Utils.currentYearMonth());
  Modals._open(`
    <div class="modal-header">
      <h3 style="font-size:0.9rem">${isEdit ? 'Modifier la charge' : 'Ajouter une charge'}</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body" style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Catégorie</label>
        <select id="exp-cat" class="form-input">
          ${Object.entries(CAT_LABELS).map(([v,l])=>`<option value="${v}" ${expense?.category===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Mois</label>
        <input type="month" id="exp-ym" class="form-input" value="${ym}">
      </div>
      <div class="form-group">
        <label class="form-label">Montant (€)</label>
        <input type="number" id="exp-amount" class="form-input" min="0" step="0.01" value="${expense?.amount||''}" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input type="text" id="exp-notes" class="form-input" value="${Utils.escapeHtml(expense?.notes||'')}" placeholder="Optionnel">
      </div>
      <input type="hidden" id="exp-id" value="${expense?.id||''}">
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="window._locSaveExpense()">Enregistrer</button>
    </div>`);
}

async function _locSaveExpense() {
  const id     = document.getElementById('exp-id').value || Utils.uuid();
  const amount = parseFloat(document.getElementById('exp-amount').value);
  if (!amount || isNaN(amount)) { alert('Montant requis.'); return; }
  const expense = {
    id, propertyId: _pdPropId,
    category: document.getElementById('exp-cat').value,
    yearMonth: document.getElementById('exp-ym').value,
    amount,
    notes: document.getElementById('exp-notes').value.trim(),
    updatedAt: Date.now()
  };
  Modals.close();
  await _saveExpenseFB(expense);
  await _renderPropertyDetail();
  Utils.toast('Charge enregistrée.', 'success');
}

function _locEditExpense(id) {
  _loadExpenses(_pdPropId).then(all => {
    const exp = all.find(e => e.id === id);
    if (exp) _locOpenExpenseForm(exp);
  });
}

async function _locDeleteExpense(id) {
  if (!confirm('Supprimer cette charge ?')) return;
  await _deleteExpenseFB(id);
  await _renderPropertyDetail();
}

function _downloadPropertyPDF() {
  const prop = Data.getPropertyById(_pdPropId);
  if (!prop) return;
  const allInc = Data.getRentalIncomes().filter(r => r.propertyId === _pdPropId);
  const allYms = [...new Set(allInc.map(r=>r.yearMonth).filter(Boolean))].sort();
  const defFrom = allYms[0] || Utils.currentYearMonth();
  const defTo   = allYms[allYms.length-1] || Utils.currentYearMonth();

  Modals._open(`
    <div class="modal-header">
      <h3 style="font-size:0.9rem">📥 Générer le rapport PDF</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body" style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Mois de début</label>
          <input type="month" id="pdf-from" class="form-input" value="${defFrom}">
        </div>
        <div class="form-group">
          <label class="form-label">Mois de fin</label>
          <input type="month" id="pdf-to" class="form-input" value="${defTo}">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="window._generatePDF()">Générer</button>
    </div>`);
}

async function _generatePDF() {
  const fromYm = document.getElementById('pdf-from')?.value;
  const toYm   = document.getElementById('pdf-to')?.value;
  if (!fromYm || !toYm || toYm < fromYm) { alert('Période invalide.'); return; }
  Modals.close();

  // Ouvrir la fenêtre AVANT tout await — sinon le popup blocker l'intercepte
  const w = window.open('', '_blank', 'width=960,height=750');
  if (!w) { Utils.toast('Autorisez les popups pour ce site pour générer le PDF.', 'info'); return; }
  w.document.write('<html><body style="font-family:Arial;padding:30px;color:#555">Génération du rapport…</body></html>');

  const prop     = Data.getPropertyById(_pdPropId);
  const allInc   = Data.getRentalIncomes().filter(r => r.propertyId === _pdPropId);
  const expenses = await _loadExpenses(_pdPropId);

  // Générer TOUS les mois de la plage sélectionnée
  const months = [];
  let _cur = fromYm;
  while (_cur <= toYm) {
    months.push(_cur);
    const [_y,_m] = _cur.split('-').map(Number);
    const _next = new Date(_y, _m, 1);
    _cur = `${_next.getFullYear()}-${String(_next.getMonth()+1).padStart(2,'0')}`;
  }

  const TYPE_LABELS = { airbnb:'Airbnb', booking:'Booking', 'long-term':'Longue durée', seasonal:'Saisonnier', other:'Autre' };

  const rows = months.map(ym => {
    const [y,m] = ym.split('-').map(Number);
    const dim   = new Date(y, m, 0).getDate();
    const mInc  = allInc.filter(r => r.yearMonth === ym);
    const rev   = mInc.reduce((s,r) => s+(r.amount||0), 0);
    const nights = allInc.filter(r=>r.startDate&&r.endDate).reduce((s,r)=>s+_nightsInMonth(r,ym),0);
    const occ   = dim > 0 ? Math.round(nights/dim*100) : 0;
    const exp   = expenses.filter(e => e.yearMonth === ym).reduce((s,e) => s+(e.amount||0), 0);
    const net   = rev - exp;
    // RevPAN : utilise nightsRented stocké (fiable) plutôt que le calcul mensuel
    const storedNights = mInc.reduce((s,r) => s+(r.nightsRented||0), 0);
    const revpan = storedNights > 0 ? Math.round(rev/storedNights) : 0;
    return { label:`${Utils.MONTHS_LONG[m-1]} ${y}`, nights, occ, rev, exp, net, revpan };
  });

  const totNights = rows.reduce((s,r)=>s+r.nights,0);
  const totRev    = rows.reduce((s,r)=>s+r.rev,0);
  const totExp    = rows.reduce((s,r)=>s+r.exp,0);
  const totNet    = totRev - totExp;
  const avgOcc    = rows.length > 0 ? Math.round(rows.reduce((s,r)=>s+r.occ,0)/rows.length) : 0;
  const avgRevPAN = totNights > 0 ? Math.round(totRev/totNights) : 0;

  const fmt = v => v.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';

  const tableRows = rows.map(r => `<tr>
    <td>${r.label}</td>
    <td style="text-align:center">${r.nights}</td>
    <td style="text-align:center">${r.occ} %</td>
    <td style="text-align:right">${fmt(r.rev)}</td>
    <td style="text-align:right;color:#dc2626">${r.exp>0?'−'+fmt(r.exp):'—'}</td>
    <td style="text-align:right;font-weight:700;color:${r.net>=0?'#16a34a':'#dc2626'}">${fmt(r.net)}</td>
    <td style="text-align:center">${r.revpan>0?r.revpan+' €':'—'}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Rapport — ${prop.name}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11pt;margin:20mm;color:#222}
    h1{font-size:16pt;margin-bottom:4px}
    h2{font-size:11pt;color:#555;font-weight:400;margin-top:0;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#f1f5f9;font-size:9pt;text-align:left;padding:7px 10px;border-bottom:2px solid #cbd5e1}
    td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:10pt}
    tr:hover td{background:#f8fafc}
    .total{background:#f1f5f9;font-weight:700}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
    .kpi{background:#f8fafc;border-radius:8px;padding:12px;text-align:center;border:1px solid #e2e8f0}
    .kpi-val{font-size:15pt;font-weight:700}
    .kpi-lbl{font-size:8pt;color:#64748b;margin-top:3px}
    @media print{button{display:none}}
  </style></head><body>
  <h1>${prop.name}</h1>
  <h2>${prop.address||''}${prop.address&&prop.type?' · ':''}${TYPE_LABELS[prop.type]||''} — Rapport de synthèse</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val" style="color:#2563eb">${fmt(totRev)}</div><div class="kpi-lbl">Revenus totaux</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#dc2626">−${fmt(totExp)}</div><div class="kpi-lbl">Charges totales</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${totNet>=0?'#16a34a':'#dc2626'}">${fmt(totNet)}</div><div class="kpi-lbl">Revenu net</div></div>
    <div class="kpi"><div class="kpi-val">${avgOcc} %</div><div class="kpi-lbl">Taux occupation moyen</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Mois</th><th style="text-align:center">Nuits</th><th style="text-align:center">Occupation</th>
      <th style="text-align:right">Revenus</th><th style="text-align:right">Charges</th>
      <th style="text-align:right">Net</th><th style="text-align:center">RevPAN</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr class="total">
      <td>TOTAL / MOYENNE</td>
      <td style="text-align:center">${totNights}</td>
      <td style="text-align:center">${avgOcc} %</td>
      <td style="text-align:right">${fmt(totRev)}</td>
      <td style="text-align:right;color:#dc2626">−${fmt(totExp)}</td>
      <td style="text-align:right;color:${totNet>=0?'#16a34a':'#dc2626'}">${fmt(totNet)}</td>
      <td style="text-align:center">${avgRevPAN > 0 ? avgRevPAN+' €' : '—'}</td>
    </tr></tfoot>
  </table>
  <p style="margin-top:20px;font-size:8pt;color:#94a3b8">Généré le ${new Date().toLocaleDateString('fr-FR')} — Emploi du temps</p>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

// Expositions globales
window._locCalcTotal          = _locCalcTotal;
window._locOnPropertyChange   = _locOnPropertyChange;
window._locCloseDrawers       = _locCloseDrawers;
window._locOpenPropertyDrawer = _openPropertyDrawer;
window._locOpenIncomeDrawer   = _openIncomeDrawer;
window._locSaveProperty       = _locSaveProperty;
window._locSaveIncome         = _locSaveIncome;
window._locDeleteProperty     = _locDeleteProperty;
window._locDeleteIncome       = _locDeleteIncome;
window._locMarkReceived       = _locMarkReceived;
window._locAddIncomeForProp   = _locAddIncomeForProp;
window._locExportCsv          = _exportCsv;
window._locOpenPropertyDetail = _openPropertyDetail;
window._locOpenExpenseForm    = _locOpenExpenseForm;
window._pdChangeMonth         = _pdChangeMonth;
window._downloadPropertyPDF  = _downloadPropertyPDF;
window._generatePDF          = _generatePDF;
window._locSaveExpense        = _locSaveExpense;
window._locEditExpense        = _locEditExpense;
window._locDeleteExpense      = _locDeleteExpense;
