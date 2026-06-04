// finances.js — Rapport financier v12
'use strict';

const RENTAL_POLE = '__rental__';

const _finUrlParams = new URLSearchParams(window.location.search);
let _yearMonth   = Utils.currentYearMonth();
let _companyId   = '';
let _poleId      = _finUrlParams.get('pole') || '';
let _providerIds = [];
const _nowSY     = (() => { const n = new Date(); const y = n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear()-1; return `${y}-${y+1}`; })();
let _schoolYear  = _nowSY;

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilters();
  buildCompanyFilter();
  render();
  renderAnnual();
  renderChart();

  document.getElementById('filter-month').addEventListener('change', e => {
    _yearMonth = e.target.value; render(); renderChart();
  });
  document.getElementById('filter-company').addEventListener('change', e => {
    _companyId = e.target.value; render(); renderChart();
  });
  document.getElementById('filter-pole').addEventListener('change', e => {
    _poleId = e.target.value; buildCompanyFilter(); render(); renderAnnual(); renderChart();
  });
  document.getElementById('filter-year').addEventListener('change', e => {
    _schoolYear = e.target.value; renderAnnual();
  });
  ['chart-group','chart-split','chart-type'].forEach(id =>
    document.getElementById(id).addEventListener('change', renderChart));
  document.getElementById('btn-export-csv').addEventListener('click', () =>
    Data.exportToCsv(_yearMonth, { poleId: _poleId === RENTAL_POLE ? '' : _poleId, companyId: _companyId }));
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    const [y, m] = _yearMonth.split('-');
    const d = new Date(+y, +m - 2, 1);
    _yearMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    document.getElementById('filter-month').value = _yearMonth;
    render(); renderChart();
  });
  document.getElementById('btn-next-month').addEventListener('click', () => {
    const [y, m] = _yearMonth.split('-');
    const d = new Date(+y, +m, 1);
    _yearMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    document.getElementById('filter-month').value = _yearMonth;
    render(); renderChart();
  });
});

// ── Filtres ──────────────────────────────────────────────────────────────────

function buildCompanyFilter() {
  const el   = document.getElementById('filter-company');
  const prev = _companyId;

  if (_poleId === RENTAL_POLE) {
    const props = Data.getActiveProperties();
    el.innerHTML = '<option value="">Toutes les propriétés</option>' +
      props.map(p => `<option value="${p.id}" ${p.id===prev?'selected':''}>${Utils.escapeHtml(p.name)}</option>`).join('');
    if (prev && !props.find(p => p.id === prev)) { _companyId = ''; el.value = ''; }
    return;
  }

  const clientCos = Data.getClientSchools().filter(co => !_poleId || co.poleId === _poleId);
  el.innerHTML = '<option value="">Toutes les écoles</option><option value="__none__">Sans école associée</option>' +
    clientCos.map(c => `<option value="${c.id}" ${c.id===prev?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('');
  if (prev && prev !== '__none__' && !clientCos.find(c => c.id === prev)) { _companyId = ''; el.value = ''; }
}

function buildFilters() {
  const now    = new Date();
  const months = [];
  const end    = new Date(now.getFullYear(), now.getMonth() + 18, 1);
  const firstMission = Data.getMissions().map(m => m.date).filter(Boolean).sort()[0];
  const stopYm = firstMission ? firstMission.slice(0,7) : `${now.getFullYear()-1}-09`;
  for (let d = new Date(end); ; d.setMonth(d.getMonth() - 1)) {
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push(ym);
    if (ym <= stopYm) break;
  }
  const ownCos = Data.getOwnCompanies();
  const curSY  = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear()-1;
  const schoolYears = [];
  for (let y = curSY + 1; y >= 2024; y--) schoolYears.push(`${y}-${y+1}`);

  document.getElementById('filter-year').innerHTML =
    schoolYears.map(sy => `<option value="${sy}" ${sy===_schoolYear?'selected':''}>Année scolaire ${sy}</option>`).join('');

  document.getElementById('filter-month').innerHTML =
    months.map(ym => {
      const [y, m] = ym.split('-');
      return `<option value="${ym}" ${ym===_yearMonth?'selected':''}>${Utils.MONTHS_LONG[+m-1]} ${y}</option>`;
    }).join('');

  document.getElementById('filter-pole').innerHTML =
    '<option value="">Tous les pôles</option>' +
    ownCos.map(c => `<option value="${c.id}" ${_poleId===c.id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('') +
    `<option value="${RENTAL_POLE}" ${_poleId===RENTAL_POLE?'selected':''}>🏠 Location</option>`;

  document.getElementById('chart-split').innerHTML =
    '<option value="poles">Artémis + Astéria</option>' +
    ownCos.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('') +
    '<option value="schools">Par école</option>' +
    '<option value="rental">🏠 Location seule</option>';

  const checksDiv = document.getElementById('filter-provider-checks');
  const renderProvChecks = () => {
    checksDiv.innerHTML =
      '<span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">Prestataires :</span>' +
      '<button style="font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer;background:var(--primary);color:#fff" onclick="window._allProvs()">Tous</button>' +
      '<button style="font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer" onclick="window._noneProvs()">Aucun</button>' +
      Data.getActiveProviders().map(p => `
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.82rem;white-space:nowrap">
          <input type="checkbox" value="${p.id}" ${_providerIds.includes(p.id)?'checked':''} onchange="window._onProvCheck()">
          ${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}
        </label>`).join('');
  };
  renderProvChecks();
  window._onProvCheck = () => {
    _providerIds = [...checksDiv.querySelectorAll('input:checked')].map(i => i.value);
    renderProviderCosts(); renderChart();
  };
  window._allProvs  = () => { _providerIds = Data.getActiveProviders().map(p => p.id); renderProvChecks(); renderProviderCosts(); renderChart(); };
  window._noneProvs = () => { _providerIds = []; renderProvChecks(); renderProviderCosts(); renderChart(); };
}

// ── Helpers UI mode ──────────────────────────────────────────────────────────

/** Passe en vue "missions" : montre les tables missions, cache les tables rental */
function _activateMissionsView() {
  _el('missions-by-company-table', s => s.display = '');
  _el('rental-by-prop-wrapper',    s => s.display = 'none');
  _el('missions-done-table',       s => s.display = '');
  _el('rental-incomes-wrapper',    s => s.display = 'none');
  _el('fin-rental-kpi-card',       s => s.display = 'none');
  _el('fin-unpaid-card',           s => s.display = '');
  const hpCard = document.getElementById('fin-hours-planned')?.closest?.('.kpi-card');
  if (hpCard) hpCard.style.display = '';
}

/** Passe en vue "location" : cache tout ce qui est missions, montre location */
function _activateRentalView() {
  _el('missions-by-company-table', s => s.display = 'none');
  _el('rental-by-prop-wrapper',    s => s.display = '');
  _el('missions-done-table',       s => s.display = 'none');
  _el('rental-incomes-wrapper',    s => s.display = '');
  _el('fin-rental-kpi-card',       s => s.display = 'none');
  _el('fin-unpaid-card',           s => s.display = 'none');
  _el('section-by-provider',       s => s.display = 'none');
  _el('section-cancelled',         s => s.display = 'none');
  const hpCard = document.getElementById('fin-hours-planned')?.closest?.('.kpi-card');
  if (hpCard) hpCard.style.display = 'none';
}

function _el(id, fn) {
  const el = document.getElementById(id);
  if (el) fn(el.style);
}

function _setKpiLabel(valueId, text) {
  const el = document.getElementById(valueId);
  if (!el) return;
  const label = el.closest?.('.kpi-content')?.querySelector('.kpi-label');
  if (label) label.textContent = text;
}

// ── Render principal ─────────────────────────────────────────────────────────

function render() {
  const isRental = (_poleId === RENTAL_POLE);

  // Filtre prestataires : masqué en mode location
  const filterProvidersDiv = document.getElementById('filter-provider-checks');
  if (filterProvidersDiv) filterProvidersDiv.style.display = isRental ? 'none' : '';

  if (isRental) {
    _activateRentalView();
    renderRentalFull();
    return;
  }

  // ── Mode missions ────────────────────────────────────────────────
  _activateMissionsView();

  const stats     = Data.getFinancialStats({ yearMonth: _yearMonth, companyId: (_companyId && _companyId !== '__none__') ? _companyId : undefined });
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const providers = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const [y, m]    = _yearMonth.split('-');

  const filterByPole = ms => {
    if (!_poleId) return true;
    const co = companies[ms.companyId];
    if (!co) return false;
    if (co.role === 'own') return co.id === _poleId;
    if (co.poleId) return co.poleId === _poleId;
    return false;
  };

  let doneMissions    = stats.done.filter(ms => ms.missionType !== 'personal');
  let plannedMissions = stats.planned.filter(ms => ms.missionType !== 'personal');
  if (_poleId) { doneMissions = doneMissions.filter(filterByPole); plannedMissions = plannedMissions.filter(filterByPole); }
  if (_companyId === '__none__') { doneMissions = []; plannedMissions = []; }

  const poleLabel   = _poleId ? (' — ' + (companies[_poleId]?.name || '')) : '';
  const reportLabel = `Rapport — ${Utils.MONTHS_LONG[+m-1]} ${y}${poleLabel}`;
  document.getElementById('report-title').textContent         = reportLabel;
  document.getElementById('report-title-summary').textContent = reportLabel;

  // KPIs missions
  const doneRevenue    = doneMissions.reduce((s,ms) => s + (ms.duration||0)*(ms.billingRate||0), 0);
  const plannedRevenue = plannedMissions.reduce((s,ms) => s + (ms.duration||0)*(ms.billingRate||0), 0);
  const missionRevenue = Math.round((doneRevenue + plannedRevenue) * 100) / 100;
  const _calcCosts     = list => list.reduce((s,ms) => {
    const pids = ms.providerIds?.length ? ms.providerIds : (ms.providerId ? [ms.providerId] : []);
    return pids.length ? s + (ms.duration||0)*(ms.providerRate||0) : s;
  }, 0);
  const totalCosts  = Math.round((_calcCosts(doneMissions) + _calcCosts(plannedMissions)) * 100) / 100;
  const hoursDone   = doneMissions.reduce((s,ms) => s + (ms.duration||0), 0);
  const hoursPlanned= plannedMissions.reduce((s,ms) => s + (ms.duration||0), 0);
  const unpaidM     = doneMissions.filter(ms => ms.paymentStatus !== 'paid' && ms.status === 'done');
  const unpaidAmt   = unpaidM.reduce((s,ms) => s + (ms.duration||0)*(ms.billingRate||0), 0);

  // Intégration revenus locatifs pour "Tous les pôles"
  const rentalIncomes = !_poleId ? Data.getRentalIncomesByMonth(_yearMonth) : [];
  const rentalTotal   = rentalIncomes.reduce((s, r) => s + (r.amount || 0), 0);
  const totalRevenue  = Math.round((missionRevenue + rentalTotal) * 100) / 100;
  const netMargin     = Math.round((totalRevenue - totalCosts) * 100) / 100;

  // KPI card locatif (visible uniquement "tous les pôles" avec données)
  const rentalKpiCard = document.getElementById('fin-rental-kpi-card');
  if (rentalKpiCard) {
    rentalKpiCard.style.display = (!_poleId && rentalTotal > 0) ? '' : 'none';
    const valEl = document.getElementById('fin-rental-kpi-val');
    if (valEl) valEl.textContent = Utils.formatMoney(rentalTotal);
  }

  // Restaurer labels KPI normaux
  _setKpiLabel('fin-revenue',       'CA total (réalisé + prévu)');
  _setKpiLabel('fin-costs',         'Charges prestataires (réalisé + prévu)');
  _setKpiLabel('fin-margin',        'Marge nette');
  _setKpiLabel('fin-hours-done',    'Heures réalisées');
  _setKpiLabel('fin-hours-planned', 'Heures prévues');

  document.getElementById('fin-revenue').textContent       = Utils.formatMoney(totalRevenue);
  document.getElementById('fin-costs').textContent         = Utils.formatMoney(totalCosts);
  document.getElementById('fin-margin').textContent        = Utils.formatMoney(netMargin);
  document.getElementById('fin-hours-done').textContent    = Utils.formatDuration(hoursDone);
  document.getElementById('fin-hours-planned').textContent = Utils.formatDuration(hoursPlanned);

  const marginCard  = document.getElementById('fin-margin-card');
  marginCard.className = 'kpi-card kpi-large' + (netMargin > 0 ? ' kpi-positive' : netMargin < 0 ? ' kpi-negative' : '');
  const _marginIcon = marginCard.querySelector('.kpi-icon');
  if (_marginIcon) _marginIcon.className = 'kpi-icon ' + (netMargin > 0 ? 'kpi-green' : netMargin < 0 ? 'kpi-red' : 'kpi-gray');

  document.getElementById('fin-unpaid').textContent       = Utils.formatMoney(unpaidAmt);
  document.getElementById('fin-unpaid-label').textContent = `${unpaidM.length} mission${unpaidM.length !== 1 ? 's' : ''} non payée${unpaidM.length !== 1 ? 's' : ''}`;
  document.getElementById('fin-unpaid-card').className = unpaidAmt > 0 ? 'kpi-card kpi-alert-card' : 'kpi-card kpi-success-card';

  // Répartition par école
  const titleEl = document.getElementById('section-by-company-title');
  if (titleEl) titleEl.textContent = 'Répartition par école / client';

  const clientSchools = Data.getClientSchools().filter(co => !_poleId || co.poleId === _poleId);
  const allByCompany  = {};
  clientSchools.forEach(co => { allByCompany[co.id] = { hours: 0, revenue: 0, done: 0, planned: 0 }; });
  allByCompany['__no_school__'] = { hours: 0, revenue: 0, done: 0, planned: 0 };
  doneMissions.forEach(ms => {
    const key = allByCompany[ms.companyId] ? ms.companyId : '__no_school__';
    allByCompany[key].hours += ms.duration || 0;
    allByCompany[key].revenue += (ms.duration||0) * (ms.billingRate||0);
    allByCompany[key].done++;
  });
  plannedMissions.forEach(ms => {
    const key = allByCompany[ms.companyId] ? ms.companyId : '__no_school__';
    allByCompany[key].hours += ms.duration || 0;
    allByCompany[key].revenue += (ms.duration||0) * (ms.billingRate||0);
    allByCompany[key].planned++;
  });
  const byCompanyEntries = Object.entries(allByCompany)
    .filter(([,d]) => d.done + d.planned > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue);
  const displayedRevenue = byCompanyEntries.reduce((s, [, d]) => s + d.revenue, 0);

  const sectionCompany = document.getElementById('section-by-company');
  sectionCompany.style.display = (_companyId === '__none__' || byCompanyEntries.length === 0) ? 'none' : '';
  document.getElementById('tbody-by-company').innerHTML = byCompanyEntries.map(([cid, d]) => {
    const co  = cid === '__no_school__' ? null : companies[cid];
    const col = co ? co.color : '#94a3b8';
    const pct = displayedRevenue > 0 ? Math.round(d.revenue / displayedRevenue * 100) : 0;
    const name = cid === '__no_school__'
      ? '<em style="color:var(--text-muted)">Sans école associée</em>'
      : Utils.escapeHtml(co?.name || '—');
    return `<tr>
      <td><span class="school-dot" style="background:${col}"></span> ${name}</td>
      <td class="cell-center">${d.done}${d.planned > 0 ? ` <span style="color:var(--text-muted);font-size:0.8rem">(+${d.planned} prévu)</span>` : ''}</td>
      <td class="cell-center">${Utils.formatDuration(d.hours)}</td>
      <td class="cell-money">${Utils.formatMoney(d.revenue)}</td>
      <td><div class="progress-bar-wrapper"><div class="progress-bar" style="width:${pct}%;background:${col}"></div><span class="progress-label">${pct}%</span></div></td>
    </tr>`;
  }).join('');
  document.getElementById('total-count').innerHTML   = `<strong>${doneMissions.length + plannedMissions.length}</strong>`;
  document.getElementById('total-hours').innerHTML   = `<strong>${Utils.formatDuration(hoursDone + hoursPlanned)}</strong>`;
  document.getElementById('total-revenue').innerHTML = `<strong>${Utils.formatMoney(displayedRevenue)}</strong>`;

  // Prestataires — recalculés sur les missions filtrées
  const byProvMap = {};
  [...doneMissions, ...plannedMissions].forEach(ms => {
    const pids = ms.providerIds?.length ? ms.providerIds : (ms.providerId ? [ms.providerId] : []);
    pids.forEach(pid => {
      if (!byProvMap[pid]) byProvMap[pid] = { count: 0, hours: 0, cost: 0 };
      byProvMap[pid].count++;
      byProvMap[pid].hours += ms.duration || 0;
      byProvMap[pid].cost  += (ms.duration||0) * (ms.providerRate||0) / pids.length;
    });
  });
  const byProvEntries = Object.entries(byProvMap).filter(([pid]) => providers[pid]);
  document.getElementById('section-by-provider').style.display = byProvEntries.length > 0 ? '' : 'none';
  document.getElementById('tbody-by-provider').innerHTML = byProvEntries.map(([pid, d]) => {
    const p = providers[pid];
    return `<tr>
      <td>${p ? Utils.escapeHtml(p.firstName+' '+p.lastName) : '—'}</td>
      <td>${p ? Utils.escapeHtml(p.specialty || p.subject || '—') : '—'}</td>
      <td class="cell-center">${d.count}</td>
      <td class="cell-center">${Utils.formatDuration(d.hours)}</td>
      <td class="cell-money">${p ? Utils.formatMoney(p.defaultHourlyRate || p.hourlyRate || 0)+'/h' : '—'}</td>
      <td class="cell-money cell-cost">${Utils.formatMoney(d.cost)}</td>
    </tr>`;
  }).join('');

  // Missions réalisées
  doneMissions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const doneSectionEl = document.getElementById('section-done-missions');
  if (doneSectionEl) doneSectionEl.style.display = _companyId === '__none__' ? 'none' : '';
  document.getElementById('done-section-title').textContent = `Missions réalisées / passées (${doneMissions.length})`;
  document.getElementById('tbody-done').innerHTML = doneMissions.length === 0
    ? '<tr><td colspan="7" class="empty-state-cell">Aucune mission réalisée sur cette période.</td></tr>'
    : doneMissions.map(ms => {
      const co  = companies[ms.companyId || ms.schoolId];
      const col = co ? co.color : '#94a3b8';
      const rev = (ms.duration||0) * (ms.billingRate||0);
      const isAutoDone = ms.status === 'planned';
      const PAY = {
        unpaid:   '<span class="badge badge-danger">Non payé</span>',
        invoiced: '<span class="badge badge-invoiced">Facturé (non payé)</span>',
        paid:     '<span class="badge badge-success">Payé</span>',
      };
      const rateLabel  = ms.missionType === 'forfait'
        ? '<span style="font-size:0.75rem;color:var(--text-muted);background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:1px 7px">Forfait</span>'
        : `${Utils.formatMoney(ms.billingRate)}/h`;
      const autoBadge = isAutoDone
        ? ' <span style="font-size:0.7rem;background:var(--warning-light);color:var(--warning);border:1px solid var(--warning);border-radius:10px;padding:1px 6px">Auto</span>'
        : '';
      return `<tr class="table-row" onclick="Modals.openMission('${ms.id}',null,()=>render())">
        <td>${Utils.formatDate(ms.date)}</td>
        <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(ms.title)}${autoBadge}</td>
        <td>${co ? Utils.escapeHtml(co.name) : '—'}</td>
        <td>${Utils.formatDuration(ms.duration)}</td>
        <td class="cell-money">${rateLabel}</td>
        <td class="cell-money">${Utils.formatMoney(rev)}</td>
        <td>${PAY[ms.paymentStatus] || ms.paymentStatus}</td>
      </tr>`;
    }).join('');

  // Missions annulées
  let cancelledMissions = stats.cancelled.filter(ms => ms.missionType !== 'personal');
  if (_poleId) cancelledMissions = cancelledMissions.filter(filterByPole);
  if (_companyId && _companyId !== '__none__') cancelledMissions = cancelledMissions.filter(ms => ms.companyId === _companyId);
  if (_companyId === '__none__') cancelledMissions = [];
  const cancelSection = document.getElementById('section-cancelled');
  cancelSection.style.display = cancelledMissions.length > 0 ? '' : 'none';
  document.getElementById('cancelled-title').textContent = `Missions annulées (${cancelledMissions.length})`;
  document.getElementById('cancelled-list').innerHTML = cancelledMissions.map(ms =>
    `<div class="cancelled-row" onclick="Modals.openMission('${ms.id}',null,()=>render())">
      <span>${Utils.formatDate(ms.date)}</span>
      <span>${Utils.escapeHtml(ms.title)}</span>
      <span>${Utils.formatDuration(ms.duration)}</span>
    </div>`).join('');

  // Section locatif en bas (uniquement "tous les pôles")
  renderRentalSection();
}

// ── Mode Location — vue complète ─────────────────────────────────────────────

function renderRentalFull() {
  const [y, m] = _yearMonth.split('-');
  const reportLabel = `🏠 Location — ${Utils.MONTHS_LONG[+m-1]} ${y}`;
  document.getElementById('report-title').textContent         = reportLabel;
  document.getElementById('report-title-summary').textContent = reportLabel;

  const propMap    = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const allIncomes = Data.getRentalIncomesByMonth(_yearMonth);
  const filtered   = _companyId ? allIncomes.filter(r => r.propertyId === _companyId) : allIncomes;

  const total   = filtered.reduce((s, r) => s + (r.amount || 0), 0);
  const pending = filtered.filter(r => r.status !== 'received').reduce((s, r) => s + (r.amount || 0), 0);
  const activeProps = Data.getActiveProperties().length;

  // Cumul 12 mois glissants
  const now  = new Date();
  const ym12 = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();
  const rolling12 = Data.getRentalIncomes()
    .filter(r => r.yearMonth >= ym12 && r.yearMonth <= _yearMonth && (!_companyId || r.propertyId === _companyId))
    .reduce((s, r) => s + (r.amount || 0), 0);

  // KPIs locatifs
  _setKpiLabel('fin-revenue',    'Revenus du mois');
  _setKpiLabel('fin-costs',      'Montant en attente');
  _setKpiLabel('fin-margin',     'Cumul 12 mois glissants');
  _setKpiLabel('fin-hours-done', 'Biens actifs');
  document.getElementById('fin-revenue').textContent    = Utils.formatMoney(total);
  document.getElementById('fin-costs').textContent      = Utils.formatMoney(pending);
  document.getElementById('fin-margin').textContent     = Utils.formatMoney(rolling12);
  document.getElementById('fin-hours-done').textContent = `${activeProps} bien${activeProps !== 1 ? 's' : ''}`;

  const marginCard = document.getElementById('fin-margin-card');
  marginCard.className = 'kpi-card kpi-large';
  const mi = marginCard.querySelector('.kpi-icon');
  if (mi) mi.className = 'kpi-icon kpi-teal';

  // Tableau par bien
  const sectionCompany = document.getElementById('section-by-company');
  sectionCompany.style.display = '';
  const titleEl = document.getElementById('section-by-company-title');
  if (titleEl) titleEl.textContent = 'Répartition par bien';

  const byProp = {};
  filtered.forEach(r => {
    const key = r.propertyId || '__none__';
    if (!byProp[key]) byProp[key] = { income: 0, nights: 0, entries: [] };
    byProp[key].income += r.amount || 0;
    byProp[key].nights += r.nightsRented || 0;
    byProp[key].entries.push(r);
  });
  const propEntries = Object.entries(byProp).sort((a, b) => b[1].income - a[1].income);
  const propTotal   = propEntries.reduce((s, [, d]) => s + d.income, 0);

  document.getElementById('rental-by-prop-wrapper').style.display = '';
  document.getElementById('tbody-by-prop').innerHTML = propEntries.map(([pid, d]) => {
    const prop = propMap[pid] || null;
    const col  = prop?.color || '#94a3b8';
    const pct  = propTotal > 0 ? Math.round(d.income / propTotal * 100) : 0;
    const plats = [...new Set(d.entries.map(e => e.platform).filter(Boolean))].join(', ') || '—';
    const name  = prop ? Utils.escapeHtml(prop.name) : '<em style="color:var(--text-muted)">Bien inconnu</em>';
    return `<tr>
      <td><span class="school-dot" style="background:${col}"></span> ${name}</td>
      <td>${Utils.escapeHtml(plats)}</td>
      <td class="cell-center">${d.nights || '—'}</td>
      <td class="cell-money">${Utils.formatMoney(d.income)}</td>
      <td><div class="progress-bar-wrapper"><div class="progress-bar" style="width:${pct}%;background:${col}"></div><span class="progress-label">${pct}%</span></div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-state-cell">Aucun revenu ce mois.</td></tr>';

  const totalNights = filtered.reduce((s, r) => s + (r.nightsRented || 0), 0);
  const pni = document.getElementById('total-prop-nights');
  const pri = document.getElementById('total-prop-revenue');
  if (pni) pni.innerHTML = `<strong>${totalNights}</strong>`;
  if (pri) pri.innerHTML = `<strong>${Utils.formatMoney(propTotal)}</strong>`;

  // Tableau détail revenus
  const doneSectionEl = document.getElementById('section-done-missions');
  doneSectionEl.style.display = '';
  document.getElementById('done-section-title').textContent = `Détail des revenus (${filtered.length})`;
  document.getElementById('rental-incomes-wrapper').style.display = '';

  const STATUS_BADGES = {
    received: '<span class="badge badge-success">✓ Reçu</span>',
    pending:  '<span class="badge badge-warning">⏳ En attente</span>',
    partial:  '<span class="badge badge-danger">⚠ Partiel</span>',
  };
  document.getElementById('tbody-rental-incomes').innerHTML = filtered.length === 0
    ? '<tr><td colspan="6" class="empty-state-cell">Aucun revenu locatif ce mois.</td></tr>'
    : filtered.map(r => {
      const prop = propMap[r.propertyId];
      const col  = prop?.color || '#94a3b8';
      return `<tr>
        <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name || '—')}</td>
        <td>${Utils.escapeHtml(r.platform || '—')}</td>
        <td class="cell-center">${r.nightsRented || '—'}</td>
        <td class="cell-money">${Utils.formatMoney(r.amount || 0)}</td>
        <td>${STATUS_BADGES[r.status] || r.status || ''}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${Utils.escapeHtml(r.notes || '')}</td>
      </tr>`;
    }).join('');

  // Masquer la section locative en bas (redondante)
  const rentalSection = document.getElementById('section-rental');
  if (rentalSection) rentalSection.style.display = 'none';
}

// ── Bilan annuel ─────────────────────────────────────────────────────────────

function renderAnnual() {
  const [sy, ey] = _schoolYear.split('-');
  const dateStart = `${sy}-09-01`;
  const dateEnd   = `${ey}-08-31`;
  const ymStart   = dateStart.slice(0, 7);
  const ymEnd     = dateEnd.slice(0, 7);

  // ─ Mode Location ─
  if (_poleId === RENTAL_POLE) {
    const propMap   = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
    const allRental = Data.getRentalIncomes().filter(r => r.yearMonth >= ymStart && r.yearMonth <= ymEnd);
    const filtered  = _companyId ? allRental.filter(r => r.propertyId === _companyId) : allRental;
    const byProp    = {};
    filtered.forEach(r => {
      const key = r.propertyId || '__none__';
      if (!byProp[key]) byProp[key] = { income: 0, months: new Set(), count: 0 };
      byProp[key].income += r.amount || 0;
      byProp[key].months.add(r.yearMonth);
      byProp[key].count++;
    });
    let totalRental = 0;
    document.getElementById('tbody-annual').innerHTML = Object.entries(byProp)
      .sort((a, b) => b[1].income - a[1].income)
      .map(([pid, d]) => {
        const prop = propMap[pid] || null;
        const col  = prop?.color || '#94a3b8';
        totalRental += d.income;
        return `<tr>
          <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name || 'Bien inconnu')}</td>
          <td class="cell-money">—</td>
          <td class="cell-center">${d.count} entrée${d.count>1?'s':''}</td>
          <td class="cell-center">${d.months.size} mois</td>
          <td class="cell-money">${Utils.formatMoney(d.income)}</td>
          <td style="font-size:0.82rem;color:var(--text-muted)">Location</td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" class="empty-state-cell">Aucun revenu locatif sur cette période.</td></tr>';
    document.getElementById('annual-total-count').innerHTML   = `<strong>${filtered.length}</strong>`;
    document.getElementById('annual-total-hours').innerHTML   = `<strong>${[...new Set(filtered.map(r => r.yearMonth))].length} mois</strong>`;
    document.getElementById('annual-total-revenue').innerHTML = `<strong>${Utils.formatMoney(totalRental)}</strong>`;
    document.getElementById('annual-year-label').textContent  = `Année scolaire ${_schoolYear}`;
    const summaryEl = document.getElementById('annual-poles-summary');
    if (summaryEl) summaryEl.textContent = `Location : ${Utils.formatMoney(totalRental)}`;
    return;
  }

  // ─ Mode missions ─
  const coMap  = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const ownCos = Data.getOwnCompanies();

  let all = Data.getMissions().filter(m =>
    m.date && m.date >= dateStart && m.date <= dateEnd && m.status !== 'cancelled' && m.missionType !== 'personal'
  );
  if (_poleId) all = all.filter(m => coMap[m.companyId]?.poleId === _poleId);

  const byCompany = {};
  all.forEach(m => {
    if (!m.companyId) return;
    if (!byCompany[m.companyId]) byCompany[m.companyId] = { count: 0, hours: 0, revenue: 0 };
    byCompany[m.companyId].count++;
    byCompany[m.companyId].hours   += m.duration || 0;
    byCompany[m.companyId].revenue += (m.duration || 0) * (m.billingRate || 0);
  });

  let totalCount = 0, totalHours = 0, totalRevenue = 0;
  const poleRevs = {};
  const rows = Object.entries(byCompany).sort((a, b) => b[1].revenue - a[1].revenue).map(([cid, d]) => {
    const co = coMap[cid];
    if (!co || co.role === 'own') return '';
    const col  = co.color || '#94a3b8';
    const rate = co.defaultBillingRate || 0;
    let viaName = '—';
    if (co.poleId) { viaName = coMap[co.poleId]?.name || '—'; poleRevs[co.poleId] = (poleRevs[co.poleId] || 0) + d.revenue; }
    totalCount += d.count; totalHours += d.hours; totalRevenue += d.revenue;
    return `<tr>
      <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(co.name)}</td>
      <td class="cell-money">${Utils.formatMoney(rate)}/h</td>
      <td class="cell-center">${d.count}</td>
      <td class="cell-center">${Utils.formatDuration(d.hours)}</td>
      <td class="cell-money">${Utils.formatMoney(d.revenue)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${Utils.escapeHtml(viaName)}</td>
    </tr>`;
  }).filter(Boolean);

  // Ligne locatif si "tous les pôles"
  if (!_poleId) {
    const rentalYear = Data.getRentalIncomes().filter(r => r.yearMonth >= ymStart && r.yearMonth <= ymEnd);
    const rentalSum  = rentalYear.reduce((s, r) => s + (r.amount || 0), 0);
    if (rentalSum > 0) {
      totalRevenue += rentalSum;
      rows.push(`<tr style="background:var(--primary-light,#eff6ff)">
        <td><span class="school-dot" style="background:#10b981"></span> 🏠 Revenus locatifs</td>
        <td class="cell-money">—</td>
        <td class="cell-center">${rentalYear.length} entrée${rentalYear.length>1?'s':''}</td>
        <td class="cell-center">—</td>
        <td class="cell-money">${Utils.formatMoney(rentalSum)}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">Locatif</td>
      </tr>`);
    }
  }

  document.getElementById('tbody-annual').innerHTML = rows.join('') || '<tr><td colspan="6" class="empty-state-cell">Aucune mission sur cette période.</td></tr>';
  document.getElementById('annual-total-count').innerHTML   = `<strong>${totalCount}</strong>`;
  document.getElementById('annual-total-hours').innerHTML   = `<strong>${Utils.formatDuration(totalHours)}</strong>`;
  document.getElementById('annual-total-revenue').innerHTML = `<strong>${Utils.formatMoney(totalRevenue)}</strong>`;
  document.getElementById('annual-year-label').textContent  = `Année scolaire ${_schoolYear}`;

  const summaryEl = document.getElementById('annual-poles-summary');
  if (summaryEl) {
    const parts = ownCos.map(o => `${o.name} : ${Utils.formatMoney(poleRevs[o.id]||0)}`);
    if (!_poleId) {
      const rs = Data.getRentalIncomes().filter(r => r.yearMonth >= ymStart && r.yearMonth <= ymEnd).reduce((s,r)=>s+(r.amount||0),0);
      if (rs > 0) parts.push(`Location : ${Utils.formatMoney(rs)}`);
    }
    summaryEl.textContent = parts.join('  |  ');
  }
}

// ── Charges prestataires ─────────────────────────────────────────────────────

function renderProviderCosts() {
  const section = document.getElementById('section-provider-costs');
  if (_providerIds.length === 0 || _poleId === RENTAL_POLE) { section.style.display = 'none'; return; }
  section.style.display = '';

  const [sy, ey]  = _schoolYear.split('-');
  const dateStart = `${sy}-09-01`, dateEnd = `${ey}-08-31`;
  const _pcCoMap  = {}; Data.getCompanies().forEach(c => _pcCoMap[c.id] = c);
  const _pcFilter = m => {
    if (!_poleId) return true;
    const co = _pcCoMap[m.companyId];
    if (!co) return false;
    if (co.role === 'own') return co.id === _poleId;
    return co.poleId === _poleId;
  };
  const allM   = Data.getMissions().filter(m => m.status !== 'cancelled' && _pcFilter(m));
  const monthM = allM.filter(m => m.date && m.date.startsWith(_yearMonth));
  const yearM  = allM.filter(m => m.date && m.date >= dateStart && m.date <= dateEnd);
  const provMap = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const hasPid = (m, id) => (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).includes(id);

  let tmC=0,tmR=0,tmI=0,tyC=0,tyR=0,tyI=0;
  const rows = _providerIds.map(pid => {
    const p = provMap[pid]; if (!p) return '';
    const mM = monthM.filter(m => hasPid(m, pid));
    const mY = yearM.filter(m => hasPid(m, pid));
    const mc = mM.reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);
    const mr = mM.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
    const yc = mY.reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);
    const yr = mY.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
    tmC+=mc; tmR+=mr; tmI+=mM.length; tyC+=yc; tyR+=yr; tyI+=mY.length;
    return `<tr>
      <td>${Utils.escapeHtml(p.lastName+' '+p.firstName)}</td>
      <td class="cell-center">${mM.length}</td>
      <td class="cell-money cell-cost">${Utils.formatMoney(mc)}</td>
      <td class="cell-money">${Utils.formatMoney(mr)}</td>
      <td class="cell-money" style="color:${mr-mc>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(mr-mc)}</td>
      <td class="cell-center">${mY.length}</td>
      <td class="cell-money cell-cost">${Utils.formatMoney(yc)}</td>
      <td class="cell-money">${Utils.formatMoney(yr)}</td>
      <td class="cell-money" style="color:${yr-yc>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(yr-yc)}</td>
    </tr>`;
  }).join('');
  document.getElementById('tbody-provider-costs').innerHTML = rows;
  document.getElementById('tfoot-provider-costs').innerHTML = `
    <td><strong>Total</strong></td>
    <td class="cell-center"><strong>${tmI}</strong></td>
    <td class="cell-money cell-cost"><strong>${Utils.formatMoney(tmC)}</strong></td>
    <td class="cell-money"><strong>${Utils.formatMoney(tmR)}</strong></td>
    <td class="cell-money" style="color:${tmR-tmC>=0?'var(--success)':'var(--danger)'}"><strong>${Utils.formatMoney(tmR-tmC)}</strong></td>
    <td class="cell-center"><strong>${tyI}</strong></td>
    <td class="cell-money cell-cost"><strong>${Utils.formatMoney(tyC)}</strong></td>
    <td class="cell-money"><strong>${Utils.formatMoney(tyR)}</strong></td>
    <td class="cell-money" style="color:${tyR-tyC>=0?'var(--success)':'var(--danger)'}"><strong>${Utils.formatMoney(tyR-tyC)}</strong></td>
  `;
}

// ── Graphique temporel ───────────────────────────────────────────────────────

let _chartInstance = null;

function renderChart() {
  const group   = document.getElementById('chart-group').value;
  const split   = document.getElementById('chart-split').value;
  const ctype   = document.getElementById('chart-type').value;
  const isRental = (_poleId === RENTAL_POLE);

  if (ctype === 'pie') { renderPieChart(); return; }
  if (isRental || split === 'rental') { _renderRentalChart(group, ctype); return; }

  const coMap       = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const ownCos      = Data.getOwnCompanies();
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled' && m.date && m.missionType !== 'personal');

  // Labels temporels
  let labels = [];
  if (group === 'month') {
    const _fm  = allMissions.map(m=>m.date).sort()[0];
    const start = _fm ? new Date(_fm.slice(0,7)+'-01') : new Date(new Date().getFullYear()-1, 8, 1);
    const end   = new Date(); end.setMonth(end.getMonth() + 18);
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1))
      labels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  } else {
    const curSY = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear()-1;
    for (let y = 2024; y <= curSY + 1; y++) labels.push(`${y}-${y+1}`);
  }

  const mKey = m => {
    if (group === 'month') return m.date.slice(0,7);
    const [yr, mo] = [parseInt(m.date.slice(0,4)), parseInt(m.date.slice(5,7))];
    return `${mo>=9?yr:yr-1}-${mo>=9?yr+1:yr}`;
  };
  const rKey = r => {
    if (group === 'month') return r.yearMonth;
    const [ry, rm] = r.yearMonth.split('-').map(Number);
    return `${rm>=9?ry:ry-1}-${rm>=9?ry+1:ry}`;
  };

  const poleFilterFn = m => {
    if (!_poleId) return true;
    const co = coMap[m.companyId];
    if (!co) return false;
    return co.role === 'own' ? co.id === _poleId : co.poleId === _poleId;
  };
  let missions = allMissions.filter(poleFilterFn);
  if (_companyId && _companyId !== '__none__') missions = missions.filter(m => m.companyId === _companyId);
  const noSchools = _companyId === '__none__';

  const COLORS = ['#3b82f6','#f97316','#10b981','#8b5cf6','#ef4444','#06b6d4','#f59e0b','#84cc16'];
  let datasets = [];

  if (!noSchools) {
    const makePoleDataset = (pole, i) => ({
      label: pole.name,
      data: labels.map(lbl => {
        const ms = missions.filter(m => mKey(m) === lbl && coMap[m.companyId]?.poleId === pole.id);
        return Math.round(ms.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0)*100)/100;
      }),
      backgroundColor: (pole.color||COLORS[i])+'99',
      borderColor: pole.color||COLORS[i],
      borderWidth: 2, fill: ctype==='line',
    });

    if (split === 'poles') {
      if (ownCos.length > 1) {
        const allMonthlyRev = labels.map(lbl =>
          Math.round(missions.filter(m => mKey(m) === lbl).reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0)*100)/100
        );
        // Label dynamique selon les pôles réels
        const totalLabel = ownCos.map(c => c.name).join(' + ');
        datasets.push({
          label: `Total (${totalLabel})`,
          data: allMonthlyRev,
          backgroundColor: '#8b5cf699', borderColor: '#8b5cf6', borderWidth: 2,
          fill: ctype === 'line', pointRadius: ctype === 'line' ? 3 : 0, tension: 0.3,
        });
        // Moyenne
        const first = allMonthlyRev.findIndex(v => v > 0);
        const last  = allMonthlyRev.reduce((l, v, i) => v > 0 ? i : l, -1);
        if (first >= 0) {
          const slice = allMonthlyRev.slice(first, last + 1);
          const avg   = Math.round(slice.reduce((s,v)=>s+v,0)/slice.length*100)/100;
          datasets.push({
            label: `Moyenne mensuelle (${Utils.formatMoney(avg)})`,
            data: allMonthlyRev.map((_, i) => (i>=first&&i<=last)?avg:null),
            borderColor: '#f97316', borderWidth: 2, borderDash: [8,4],
            backgroundColor: 'transparent', pointRadius: 0, tension: 0, fill: false,
            type: 'line', order: -1, spanGaps: false,
          });
        }
        // Dataset locatif si "tous les pôles"
        if (!_poleId) {
          const allRental  = Data.getRentalIncomes();
          const rentalData = labels.map(lbl => Math.round(allRental.filter(r => rKey(r) === lbl).reduce((s,r) => s+(r.amount||0), 0)*100)/100);
          if (rentalData.some(v => v > 0)) {
            datasets.push({
              label: '🏠 Location',
              data: rentalData,
              backgroundColor: '#10b98160', borderColor: '#10b981', borderWidth: 2,
              borderDash: [5,3], fill: false, type: 'line', pointRadius: 3, tension: 0.3,
            });
          }
        }
      } else {
        ownCos.forEach((pole, i) => datasets.push(makePoleDataset(pole, i)));
      }
    } else if (split === 'schools') {
      const schools = Data.getClientSchools().filter(co => !_poleId || co.poleId === _poleId);
      schools.forEach((co, i) => {
        const data = labels.map(lbl =>
          Math.round(missions.filter(m => m.companyId===co.id && mKey(m)===lbl).reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0)*100)/100
        );
        if (data.every(v=>v===0)) return;
        datasets.push({ label: co.name, data, backgroundColor: (co.color||COLORS[i%COLORS.length])+'99', borderColor: co.color||COLORS[i%COLORS.length], borderWidth: 2, fill: false });
      });
    } else {
      const pole = ownCos.find(p => p.id === split);
      if (pole) datasets.push(makePoleDataset(pole, ownCos.indexOf(pole)));
    }
  }

  if (_providerIds.length > 0) {
    const allProvM = allMissions.filter(m => {
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      return pids.some(pid => _providerIds.includes(pid)) && poleFilterFn(m);
    });
    const costData = labels.map(lbl => Math.round(allProvM.filter(m=>mKey(m)===lbl).reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0)*100)/100);
    const revData  = labels.map(lbl => Math.round(allProvM.filter(m=>mKey(m)===lbl).reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0)*100)/100);
    datasets.push({ label: 'Sorties prestataires', data: costData, backgroundColor: '#ef444460', borderColor: '#ef4444', borderWidth: 2, borderDash: [5,3], fill: false });
    datasets.push({ label: 'Entrées (via prestataires)', data: revData, backgroundColor: '#10b98160', borderColor: '#10b981', borderWidth: 2, borderDash: [5,3], fill: false });
  }

  const MONTHS_ABBR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const readableLabels = labels.map(lbl => {
    if (group === 'month') { const [y,m] = lbl.split('-'); return `${MONTHS_ABBR[+m-1]} ${y}`; }
    return `AS ${lbl}`;
  });

  const ctx = document.getElementById('fin-chart').getContext('2d');
  if (_chartInstance) _chartInstance.destroy();
  _chartInstance = new Chart(ctx, {
    type: ctype,
    data: { labels: readableLabels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Utils.formatMoney(c.parsed.y)}` } } },
      scales: { y: { ticks: { callback: v => Utils.formatMoney(v) }, beginAtZero: true } }
    }
  });
}

/** Graphique dédié aux revenus locatifs */
function _renderRentalChart(group, ctype) {
  const propMap   = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const allRental = Data.getRentalIncomes();
  const filtered  = _companyId ? allRental.filter(r => r.propertyId === _companyId) : allRental;
  const props     = _companyId ? Data.getProperties().filter(p => p.id === _companyId) : Data.getActiveProperties();
  if (!filtered.length) { if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; } return; }

  let labels = [];
  if (group === 'month') {
    const firstYm = filtered.map(r => r.yearMonth).sort()[0];
    const start   = new Date(firstYm + '-01');
    const end     = new Date(); end.setMonth(end.getMonth() + 3);
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth()+1))
      labels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  } else {
    const curSY = new Date().getMonth()>=8?new Date().getFullYear():new Date().getFullYear()-1;
    for (let y=2024; y<=curSY+1; y++) labels.push(`${y}-${y+1}`);
  }

  const rKey = r => {
    if (group === 'month') return r.yearMonth;
    const [ry, rm] = r.yearMonth.split('-').map(Number);
    return `${rm>=9?ry:ry-1}-${rm>=9?ry+1:ry}`;
  };
  const COLORS  = ['#10b981','#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#f59e0b','#84cc16'];
  const datasets = [];
  props.forEach((prop, i) => {
    const data = labels.map(lbl => Math.round(filtered.filter(r=>r.propertyId===prop.id&&rKey(r)===lbl).reduce((s,r)=>s+(r.amount||0),0)*100)/100);
    if (data.every(v=>v===0)) return;
    datasets.push({ label: prop.name, data, backgroundColor: (prop.color||COLORS[i%COLORS.length])+'99', borderColor: prop.color||COLORS[i%COLORS.length], borderWidth: 2, fill: false });
  });
  if (props.length > 1) {
    const td = labels.map(lbl => Math.round(filtered.filter(r=>rKey(r)===lbl).reduce((s,r)=>s+(r.amount||0),0)*100)/100);
    if (td.some(v=>v>0)) datasets.unshift({ label: 'Total', data: td, backgroundColor: '#64748b99', borderColor: '#64748b', borderWidth: 2, fill: false, type: 'line', pointRadius: 3, tension: 0.3 });
  }
  const MONTHS_ABBR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const readableLabels = labels.map(lbl => { if(group==='month'){const[y,m]=lbl.split('-');return`${MONTHS_ABBR[+m-1]} ${y}`;}return`AS ${lbl}`; });
  const ctx = document.getElementById('fin-chart').getContext('2d');
  if (_chartInstance) _chartInstance.destroy();
  _chartInstance = new Chart(ctx, {
    type: ctype === 'bar' ? 'bar' : 'line',
    data: { labels: readableLabels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Utils.formatMoney(c.parsed.y)}` } } },
      scales: { y: { ticks: { callback: v => Utils.formatMoney(v) }, beginAtZero: true } }
    }
  });
}

// ── Camembert ────────────────────────────────────────────────────────────────

function renderPieChart() {
  const isRental = (_poleId === RENTAL_POLE);
  const COLORS   = ['#8b5cf6','#3b82f6','#10b981','#f97316','#ef4444','#06b6d4','#f59e0b','#84cc16','#ec4899','#14b8a6','#a855f7','#64748b','#f43f5e','#0ea5e9','#22c55e'];

  if (isRental) {
    // Camembert locatif par bien
    const propMap    = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
    const allIncomes = Data.getRentalIncomes();
    const filtered   = _companyId ? allIncomes.filter(r=>r.propertyId===_companyId) : allIncomes;
    const byProp = {};
    filtered.forEach(r => {
      const key = r.propertyId || '__none__';
      if (!byProp[key]) byProp[key] = { name: propMap[r.propertyId]?.name||'Inconnu', total: 0, color: propMap[r.propertyId]?.color };
      byProp[key].total += r.amount || 0;
    });
    const sorted = Object.values(byProp).map(e=>({...e,total:Math.round(e.total*100)/100})).filter(e=>e.total>0).sort((a,b)=>b.total-a.total);
    _buildDoughnut(sorted, COLORS);
    return;
  }

  // Camembert missions
  const coMap       = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled' && m.date && m.missionType !== 'personal');
  const poleFilterFn = m => {
    if (!_poleId) return true;
    const co = coMap[m.companyId];
    if (!co) return false;
    return co.role === 'own' ? co.id === _poleId : co.poleId === _poleId;
  };
  let missions = allMissions.filter(poleFilterFn);
  if (_companyId === '__none__') missions = [];
  else if (_companyId) missions = missions.filter(m => m.companyId === _companyId);

  const clientIds = new Set(Data.getClientSchools().map(c => c.id));
  const bySchool  = {};
  missions.forEach(m => {
    if (!clientIds.has(m.companyId)) return;
    const co = coMap[m.companyId]; if (!co) return;
    if (!bySchool[m.companyId]) bySchool[m.companyId] = { name: co.name, total: 0, color: co.color };
    bySchool[m.companyId].total += (m.duration||0) * (m.billingRate||0);
  });
  const sorted = Object.values(bySchool).map(e=>({...e,total:Math.round(e.total*100)/100})).filter(e=>e.total>0).sort((a,b)=>b.total-a.total);

  // Tranche locative si "tous les pôles"
  if (!_poleId) {
    const rentalSum = Data.getRentalIncomes().reduce((s,r)=>s+(r.amount||0),0);
    if (rentalSum > 0) sorted.push({ name: '🏠 Location', total: Math.round(rentalSum*100)/100, color: '#10b981' });
  }
  _buildDoughnut(sorted, COLORS);
}

function _buildDoughnut(sorted, COLORS) {
  const grand = sorted.reduce((s,e)=>s+e.total,0);
  const ctx   = document.getElementById('fin-chart').getContext('2d');
  if (_chartInstance) _chartInstance.destroy();
  _chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(e => e.name),
      datasets: [{ data: sorted.map(e => e.total), backgroundColor: sorted.map((e,i) => e.color||COLORS[i%COLORS.length]), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 12 }, padding: 14 } },
        tooltip: { callbacks: { label: c => { const pct=((c.parsed/grand)*100).toFixed(1); return ` ${c.label} : ${Utils.formatMoney(c.parsed)} (${pct}%)`; } } }
      }
    }
  });
}

// ── Section locative en bas (mode "Tous les pôles" uniquement) ───────────────

function renderRentalSection() {
  const section = document.getElementById('section-rental');
  if (!section) return;
  // Masquer si un pôle spécifique est sélectionné (missions ou location)
  if (_poleId) { section.style.display = 'none'; return; }

  const incomes = Data.getRentalIncomesByMonth(_yearMonth);
  if (incomes.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';

  const propMap = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const [y, m]  = _yearMonth.split('-');
  document.getElementById('rental-month-label').textContent = `${Utils.MONTHS_LONG[+m-1]} ${y}`;

  const total   = incomes.reduce((s,r) => s+(r.amount||0), 0);
  const pending = incomes.filter(r=>r.status!=='received').reduce((s,r)=>s+(r.amount||0), 0);
  const propIds = [...new Set(incomes.map(r=>r.propertyId).filter(Boolean))];
  document.getElementById('rental-total').textContent   = Utils.formatMoney(total);
  document.getElementById('rental-count').textContent   = propIds.length;
  document.getElementById('rental-pending').textContent = Utils.formatMoney(pending);

  const STATUS = {
    received: '<span class="badge badge-success">✓ Reçu</span>',
    pending:  '<span class="badge badge-warning">⏳ En attente</span>',
    partial:  '<span class="badge badge-danger">⚠ Partiel</span>',
  };
  document.getElementById('rental-tbody').innerHTML = incomes.map(r => {
    const prop = propMap[r.propertyId];
    const col  = prop?.color || '#94a3b8';
    return `<tr>
      <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name||'—')}</td>
      <td>${Utils.escapeHtml(r.platform||'—')}</td>
      <td class="cell-center">${r.nightsRented||'—'}</td>
      <td class="cell-money">${Utils.formatMoney(r.amount||0)}</td>
      <td>${STATUS[r.status]||r.status||''}</td>
      <td class="cell-center"><a href="location.html" style="font-size:0.8rem;color:var(--primary)">Voir</a></td>
    </tr>`;
  }).join('');
  document.getElementById('rental-tfoot-total').innerHTML = `<strong>${Utils.formatMoney(total)}</strong>`;
}
