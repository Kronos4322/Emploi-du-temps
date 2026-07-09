// finances.js — Rapport financier v12
'use strict';

const RENTAL_POLE = '__rental__';

// Encaissement réel d'une entrée locative (versé réel > montant Airbnb EUR > 0).
// Règle métier : le CA location = encaissements uniquement, jamais les montants estimés.
const _encAmt = r => r.actualAmount ?? r.amountEURairbnb ?? 0;
const _hasEnc = r => r.actualAmount != null || r.amountEURairbnb != null;

// ── Oraux / Jurys HEIP : saisis dans Suivi factures, intégrés au CA ici ───────
// Les jurys dans l'agenda sont à 0 € ; la source de vérité est la section
// "Oraux HEIP" de la page Factures. On les rattache au pôle d'HEIP (Astéria).
const ORAUX_KEY = '__oraux__';
function _orxHeipCo() {
  return Data.getCompanies().find(c => c.role !== 'own' && (c.name||'').toLowerCase().includes('heip')) || null;
}
function _orxPoleId() {
  const h = _orxHeipCo();
  if (h?.poleId) return h.poleId;
  const a = Data.getOwnCompanies().find(c =>
    (c.name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes('aster'));
  return a?.id || null;
}
const _orxSum = list => Math.round((list||[]).reduce((s,o) => s+(o.total||0), 0)*100)/100;
const _orxCount = list => (list||[]).reduce((s,o) => s+(o.count||0), 0);
// Les oraux sont-ils visibles avec les filtres pôle/école actifs ?
function _orxVisible() {
  if (_poleId === RENTAL_POLE) return false;
  if (_poleId && _poleId !== _orxPoleId()) return false;
  if (_companyId === '__none__') return false;
  if (_companyId && _companyId !== _orxHeipCo()?.id) return false;
  return true;
}
function _orxBetween(d1, d2) {
  return (Data.getOraux()||[]).filter(o => o.date && o.date >= d1 && o.date <= d2);
}

const RENTAL_STATUS_BADGES = {
  received: '<span class="badge badge-success">✓ Reçu</span>',
  pending:  '<span class="badge badge-warning">⏳ En attente</span>',
  partial:  '<span class="badge badge-danger">⚠ Partiel</span>',
};

function _matchesPole(m, coMap) {
  if (!_poleId) return true;
  const co = coMap[m.companyId];
  if (!co) return false;
  return co.role === 'own' ? co.id === _poleId : co.poleId === _poleId;
}

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
  renderProviderPartnership();
  renderChart();

  document.getElementById('filter-month').addEventListener('change', e => {
    _yearMonth = e.target.value; render(); renderChart();
  });
  document.getElementById('filter-company').addEventListener('change', e => {
    _companyId = e.target.value; render(); renderChart();
  });
  document.getElementById('filter-pole').addEventListener('change', e => {
    const prevPole = _poleId;
    _poleId = e.target.value;
    // Synchroniser automatiquement le split du graphique avec le mode sélectionné
    const splitEl = document.getElementById('chart-split');
    if (splitEl) {
      if (_poleId === RENTAL_POLE) splitEl.value = 'rental';       // Location → afficher location
      else if (prevPole === RENTAL_POLE) splitEl.value = 'poles';  // retour missions → total pôles
    }
    buildCompanyFilter(); render(); renderAnnual(); renderProviderPartnership(); renderChart();
  });
  document.getElementById('filter-year').addEventListener('change', e => {
    _schoolYear = e.target.value; renderAnnual(); renderProviderPartnership();
    if (document.getElementById('annual-compare-view')?.style.display !== 'none') renderAnnualComparison();
  });
  const _cySel = document.getElementById('filter-compare-year');
  if (_cySel) _cySel.addEventListener('change', renderAnnualComparison);
  ['chart-group','chart-split','chart-type','avg-period-start','avg-period-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderChart);
  });
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (_poleId === RENTAL_POLE) _exportRentalCsv();
    else Data.exportToCsv(_yearMonth, { poleId: _poleId, companyId: _companyId });
  });
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
  const firstMission  = Data.getMissions().map(m => m.date).filter(Boolean).sort()[0];
  const firstRental   = Data.getRentalIncomes().map(r => r.yearMonth).filter(Boolean).sort()[0];
  const firstActivity = [firstMission?.slice(0,7), firstRental].filter(Boolean).sort()[0];
  const stopYm = firstActivity || `${now.getFullYear()-1}-09`;
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

  const compareYearSel = document.getElementById('filter-compare-year');
  if (compareYearSel) {
    const prevCY = compareYearSel.value;
    const defaultCY = `${curSY+1}-${curSY+2}`;
    compareYearSel.innerHTML = schoolYears.map(sy => `<option value="${sy}">${sy}</option>`).join('');
    compareYearSel.value = schoolYears.includes(prevCY) ? prevCY : (schoolYears.includes(defaultCY) ? defaultCY : schoolYears[0]);
  }

  document.getElementById('filter-month').innerHTML =
    months.map(ym => {
      const [y, m] = ym.split('-');
      return `<option value="${ym}" ${ym===_yearMonth?'selected':''}>${Utils.MONTHS_LONG[+m-1]} ${y}</option>`;
    }).join('');

  const polesLabel = ownCos.length > 0 ? ownCos.map(c => Utils.escapeHtml(c.name)).join(' + ') : 'Tous les pôles';
  const _poleIcon  = c => { const n = (c.name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); if (n.includes('artem')) return '🎓'; if (n.includes('aster')) return '🌍'; return '🏢'; };
  document.getElementById('filter-pole').innerHTML =
    '<option value="">📊 Tous les pôles</option>' +
    ownCos.map(c => `<option value="${c.id}" ${_poleId===c.id?'selected':''}>${_poleIcon(c)} ${Utils.escapeHtml(c.name)}</option>`).join('') +
    `<option value="${RENTAL_POLE}" ${_poleId===RENTAL_POLE?'selected':''}>🏠 Location</option>`;

  const _poleIconStr = c => { const n=(c.name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); if(n.includes('artem')) return '🎓'; if(n.includes('aster')) return '🌍'; return '🏢'; };
  const polesLabelFull = ownCos.length > 0 ? ownCos.map(c => `${_poleIconStr(c)} ${Utils.escapeHtml(c.name).toUpperCase()}`).join(' + ') : '📊 TOUS LES PÔLES';
  document.getElementById('chart-split').innerHTML =
    `<option value="poles">${polesLabelFull}</option>` +
    ownCos.map(c => `<option value="${c.id}">${_poleIconStr(c)} ${Utils.escapeHtml(c.name).toUpperCase()}</option>`).join('') +
    '<option value="schools">🏫 Par école</option>' +
    '<option value="rental">🏠 Location seule</option>';

  const checksDiv = document.getElementById('filter-provider-checks');
  const _updateProvSummary = () => {
    const summaryEl = document.getElementById('filter-provider-summary');
    if (!summaryEl) return;
    const total = Data.getActiveProviders().length;
    if (_providerIds.length === 0)     summaryEl.textContent = '— aucun';
    else if (_providerIds.length === total) summaryEl.textContent = '— tous';
    else summaryEl.textContent = `— ${_providerIds.length}/${total} sélectionné${_providerIds.length > 1 ? 's' : ''}`;
  };
  const renderProvChecks = () => {
    checksDiv.innerHTML =
      '<button style="font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer;background:var(--primary);color:#fff;white-space:nowrap" onclick="window._allProvs()">Tous</button>' +
      '<button style="font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer;white-space:nowrap" onclick="window._noneProvs()">Aucun</button>' +
      Data.getActiveProviders().map(p => `
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.82rem;white-space:nowrap">
          <input type="checkbox" value="${p.id}" ${_providerIds.includes(p.id)?'checked':''} onchange="window._onProvCheck()">
          ${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}
        </label>`).join('');
    _updateProvSummary();
  };
  renderProvChecks();
  window._onProvCheck = () => {
    _providerIds = [...checksDiv.querySelectorAll('input:checked')].map(i => i.value);
    _updateProvSummary();
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
  const hpCard = document.getElementById('fin-hours-planned')?.closest?.('.kpi-card');
  if (hpCard) hpCard.style.display = '';
}

/** Passe en vue "location" : cache tout ce qui est missions, montre location */
function _activateRentalView() {
  _el('missions-by-company-table', s => s.display = 'none');
  _el('rental-by-prop-wrapper',    s => s.display = '');
  _el('missions-done-table',       s => s.display = 'none');
  _el('rental-incomes-wrapper',    s => s.display = '');
  _el('fin-pole-kpi-row',          s => s.display = 'none');
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

// ── Helper : rendu d'une ligne école dans le tableau de répartition ──────────

function _mkSchoolRow(cid, d, companies, displayedRevenue) {
  const isOraux = cid === ORAUX_KEY;
  const co  = (cid === '__no_school__' || isOraux) ? null : companies[cid];
  const col = isOraux ? '#0ea5e9' : (co ? co.color : '#94a3b8');
  const pct = displayedRevenue > 0 ? Math.round(d.revenue / displayedRevenue * 100) : 0;
  const name = cid === '__no_school__'
    ? '<em style="color:var(--text-muted)">Sans école associée</em>'
    : isOraux
      ? `🎓 Oraux / Jurys HEIP <span style="font-size:0.75rem;color:var(--text-muted)">(suivi factures)</span>`
      : Utils.escapeHtml(co?.name || '—');
  const countCell = isOraux
    ? `${d.done} <span style="color:var(--text-muted);font-size:0.8rem">oraux</span>`
    : `${d.done}${d.planned > 0 ? ` <span style="color:var(--text-muted);font-size:0.8rem">(+${d.planned} prévu)</span>` : ''}`;
  return `<tr>
    <td><span class="school-dot" style="background:${col}"></span> ${name}</td>
    <td class="cell-center">${countCell}</td>
    <td class="cell-center">${isOraux ? '—' : Utils.formatDuration(d.hours)}</td>
    <td class="cell-money">${Utils.formatMoney(d.revenue)}</td>
    <td><div class="progress-bar-wrapper"><div class="progress-bar" style="width:${pct}%;background:${col}"></div><span class="progress-label">${pct}%</span></div></td>
  </tr>`;
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

  let doneMissions    = stats.done.filter(ms => ms.missionType !== 'personal');
  let plannedMissions = stats.planned.filter(ms => ms.missionType !== 'personal');
  if (_poleId) { doneMissions = doneMissions.filter(m => _matchesPole(m, companies)); plannedMissions = plannedMissions.filter(m => _matchesPole(m, companies)); }
  if (_companyId === '__none__') { doneMissions = []; plannedMissions = []; }

  const poleLabel   = _poleId ? (' — ' + (companies[_poleId]?.name || '')) : '';
  const reportLabel = `Rapport — ${Utils.MONTHS_LONG[+m-1]} ${y}${poleLabel}`;
  document.getElementById('report-title').textContent         = reportLabel;
  document.getElementById('report-title-summary').textContent = reportLabel;

  // KPIs missions
  const doneRevenue    = doneMissions.reduce((s,ms) => s + (ms.duration||0)*(ms.billingRate||0), 0);
  const plannedRevenue = plannedMissions.reduce((s,ms) => s + (ms.duration||0)*(ms.billingRate||0), 0);
  const missionRevenue = Math.round((doneRevenue + plannedRevenue) * 100) / 100;
  // providerRate = tarif individuel PAR intervenant → coût = durée × tarif × nb prestataires
  const _calcCosts     = list => list.reduce((s,ms) => {
    const pids = ms.providerIds?.length ? ms.providerIds : (ms.providerId ? [ms.providerId] : []);
    return pids.length ? s + (ms.duration||0)*(ms.providerRate||0)*pids.length : s;
  }, 0);
  const totalCosts  = Math.round((_calcCosts(doneMissions) + _calcCosts(plannedMissions)) * 100) / 100;
  const hoursDone   = doneMissions.reduce((s,ms) => s + (ms.duration||0), 0);
  const hoursPlanned= plannedMissions.reduce((s,ms) => s + (ms.duration||0), 0);
  // Intégration revenus locatifs pour "Tous les pôles"
  const rentalIncomes = !_poleId ? Data.getRentalIncomesByMonth(_yearMonth) : [];
  const rentalTotal   = rentalIncomes.reduce((s, r) => s + _encAmt(r), 0);
  // Oraux / Jurys HEIP du mois (source : Suivi factures)
  const orauxList  = _orxVisible() ? Data.getOrauxByMonth(_yearMonth) : [];
  const orauxTotal = _orxSum(orauxList);
  const totalRevenue  = Math.round((missionRevenue + rentalTotal + orauxTotal) * 100) / 100;
  const netMargin     = Math.round((totalRevenue - totalCosts) * 100) / 100;

  // ── Ligne CA par pôle (mode "Tous les pôles") ──────────────────────────────
  const poleKpiRow = document.getElementById('fin-pole-kpi-row');
  const ownCosForKpi = Data.getOwnCompanies();
  if (poleKpiRow) {
    if (!_poleId) {
      // Calculer le CA par pôle sur les missions du mois (réalisé + prévu)
      const allMonthMs = [...doneMissions, ...plannedMissions];
      const poleCards = ownCosForKpi.map(pole => {
        let rev = Math.round(allMonthMs
          .filter(ms => companies[ms.companyId]?.poleId === pole.id)
          .reduce((s, ms) => s + (ms.duration||0)*(ms.billingRate||0), 0) * 100) / 100;
        // Les oraux HEIP comptent dans le CA du pôle d'HEIP (Astéria)
        if (pole.id === _orxPoleId()) rev = Math.round((rev + orauxTotal) * 100) / 100;
        return `<div class="kpi-card">
          <div class="kpi-icon" style="background:${pole.color}20;color:${pole.color}">💶</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatMoney(rev)}</div>
            <div class="kpi-label">CA ${Utils.escapeHtml(pole.name)}</div>
          </div>
        </div>`;
      }).join('');
      const rentalCard = rentalTotal > 0 ? `<div class="kpi-card">
          <div class="kpi-icon kpi-green">🏠</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatMoney(rentalTotal)}</div>
            <div class="kpi-label">CA Location</div>
          </div>
        </div>` : '';
      poleKpiRow.style.display = '';
      poleKpiRow.innerHTML = poleCards + rentalCard;
    } else {
      poleKpiRow.style.display = 'none';
    }
  }
  // Restaurer labels KPI normaux (label locatif si tous les pôles avec revenus)
  const caLabel = (!_poleId && rentalTotal > 0) ? 'CA total (missions + locatif)' : 'CA total (réalisé + prévu)';
  _setKpiLabel('fin-revenue',       caLabel);
  _setKpiLabel('fin-costs',         'Charges prestataires (réalisé + prévu)');
  _setKpiLabel('fin-margin',        (!_poleId && rentalTotal > 0) ? 'Marge nette (missions + locatif)' : 'Marge nette');
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

  // Ligne Oraux HEIP (rattachée au pôle Astéria dans le tableau groupé)
  if (orauxTotal > 0) {
    byCompanyEntries.push([ORAUX_KEY, { hours: 0, revenue: orauxTotal, done: _orxCount(orauxList), planned: 0 }]);
  }
  // Ajouter ligne locative si "tous les pôles" avec des revenus → rend le footer cohérent avec le KPI
  if (!_poleId && rentalTotal > 0) {
    byCompanyEntries.push(['__rental__', { hours: 0, revenue: rentalTotal, done: 0, planned: 0 }]);
  }
  const displayedRevenue = byCompanyEntries.reduce((s, [, d]) => s + d.revenue, 0);

  const sectionCompany = document.getElementById('section-by-company');
  sectionCompany.style.display = (_companyId === '__none__' || byCompanyEntries.length === 0) ? 'none' : '';

  if (!_poleId) {
    // ── Mode "Tous les pôles" : tableau groupé par pôle avec sous-totaux ──────
    let tableHtml = '';
    ownCosForKpi.forEach(pole => {
      const poleEntries = byCompanyEntries.filter(([cid]) => {
        if (cid === '__no_school__' || cid === '__rental__') return false;
        if (cid === ORAUX_KEY) return pole.id === _orxPoleId(); // oraux HEIP → bloc Astéria
        return companies[cid]?.poleId === pole.id;
      });
      if (poleEntries.length === 0) return;
      const poleSub = Math.round(poleEntries.reduce((s, [, d]) => s + d.revenue, 0) * 100) / 100;
      const lightBg = Utils.lightenColor(pole.color, 0.93);
      tableHtml += `<tr style="background:${lightBg};border-top:2px solid ${pole.color}50">
        <td colspan="5" style="padding:6px 12px;font-size:0.82rem;font-weight:700;color:${pole.color}">
          <span class="school-dot" style="background:${pole.color}"></span>
          ${Utils.escapeHtml(pole.name)}
          <span style="float:right;font-weight:600">${Utils.formatMoney(poleSub)}</span>
        </td>
      </tr>`;
      tableHtml += poleEntries.map(([cid, d]) => _mkSchoolRow(cid, d, companies, displayedRevenue)).join('');
    });
    // Missions sans école associée
    const nseEntry = byCompanyEntries.find(([cid]) => cid === '__no_school__');
    if (nseEntry && nseEntry[1].done + nseEntry[1].planned > 0) {
      tableHtml += _mkSchoolRow('__no_school__', nseEntry[1], companies, displayedRevenue);
    }
    // Revenus locatifs — couleurs teal distinctes, cohérentes avec l'identité Location
    if (rentalTotal > 0) {
      const pct    = displayedRevenue > 0 ? Math.round(rentalTotal / displayedRevenue * 100) : 0;
      const locBg  = '#ccfbf1'; // teal-100 — fond plus saturé pour distinguer des lignes blanches
      const locHdr = '#0d9488'; // teal-600 — texte header lisible
      const locRow = '#f0fdfa'; // teal-50 — fond ligne data, légèrement différent du header
      tableHtml += `<tr style="background:${locBg};border-top:2px solid #10b98180">
        <td colspan="5" style="padding:6px 12px;font-size:0.82rem;font-weight:700;color:${locHdr}">
          <span class="school-dot" style="background:#10b981"></span>
          🏠 Location
          <span style="float:right;font-weight:600;color:${locHdr}">${Utils.formatMoney(rentalTotal)}</span>
        </td>
      </tr>
      <tr style="background:${locRow}">
        <td style="padding-left:24px"><span class="school-dot" style="background:#10b981;opacity:0.6"></span> <span style="color:var(--text-muted);font-style:italic">Revenus locatifs</span></td>
        <td class="cell-center" style="color:var(--text-muted)">—</td>
        <td class="cell-center" style="color:var(--text-muted)">—</td>
        <td class="cell-money" style="color:${locHdr};font-weight:600">${Utils.formatMoney(rentalTotal)}</td>
        <td><div class="progress-bar-wrapper"><div class="progress-bar" style="width:${pct}%;background:#10b981"></div><span class="progress-label" style="color:${locHdr}">${pct}%</span></div></td>
      </tr>`;
    }
    document.getElementById('tbody-by-company').innerHTML = tableHtml;
  } else {
    // ── Mode pôle spécifique : liste plate ────────────────────────────────────
    document.getElementById('tbody-by-company').innerHTML = byCompanyEntries
      .map(([cid, d]) => _mkSchoolRow(cid, d, companies, displayedRevenue))
      .join('');
  }
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
      byProvMap[pid].cost  += (ms.duration||0) * (ms.providerRate||0);
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
      const PAY = {
        unpaid:   '<span class="badge badge-danger">Non payé</span>',
        invoiced: '<span class="badge badge-invoiced">Facturé (non payé)</span>',
        paid:     '<span class="badge badge-success">Payé</span>',
      };
      const rateLabel  = ms.missionType === 'forfait'
        ? '<span style="font-size:0.75rem;color:var(--text-muted);background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:1px 7px">Forfait</span>'
        : `${Utils.formatMoney(ms.billingRate)}/h`;
      return `<tr class="table-row" onclick="Modals.openMission('${ms.id}',null,()=>render())">
        <td>${Utils.formatDate(ms.date)}</td>
        <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(ms.title)}</td>
        <td>${co ? Utils.escapeHtml(co.name) : '—'}</td>
        <td>${Utils.formatDuration(ms.duration)}</td>
        <td class="cell-money">${rateLabel}</td>
        <td class="cell-money">${Utils.formatMoney(rev)}</td>
        <td>${PAY[ms.paymentStatus] || ms.paymentStatus}</td>
      </tr>`;
    }).join('');

  // Missions annulées
  let cancelledMissions = stats.cancelled.filter(ms => ms.missionType !== 'personal');
  if (_poleId) cancelledMissions = cancelledMissions.filter(m => _matchesPole(m, companies));
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

  // Charges prestataires : recharger si la section est ouverte et des prestataires sont sélectionnés
  if (_providerIds.length > 0) renderProviderCosts();

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

  const total   = filtered.reduce((s, r) => s + _encAmt(r), 0);
  const pending = filtered.filter(r => !_hasEnc(r)).reduce((s, r) => s + (r.amount || 0), 0);
  const activeProps = Data.getActiveProperties().length;

  // Cumul 12 mois glissants
  const now  = new Date();
  const ym12 = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();
  const rolling12 = Data.getRentalIncomes()
    .filter(r => r.yearMonth >= ym12 && r.yearMonth <= _yearMonth && (!_companyId || r.propertyId === _companyId))
    .reduce((s, r) => s + _encAmt(r), 0);

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
    byProp[key].income += _encAmt(r);
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

  document.getElementById('tbody-rental-incomes').innerHTML = filtered.length === 0
    ? '<tr><td colspan="6" class="empty-state-cell">Aucun revenu locatif ce mois.</td></tr>'
    : filtered.map(r => {
      const prop = propMap[r.propertyId];
      const col  = prop?.color || '#94a3b8';
      return `<tr>
        <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name || '—')}</td>
        <td>${Utils.escapeHtml(r.platform || '—')}</td>
        <td class="cell-center">${r.nightsRented || '—'}</td>
        <td class="cell-money">${_hasEnc(r) ? Utils.formatMoney(_encAmt(r)) : `<span style="color:var(--text-muted)" title="Estimation — aucun encaissement saisi">(${Utils.formatMoney(r.amount || 0)})</span>`}</td>
        <td>${RENTAL_STATUS_BADGES[r.status] || r.status || ''}</td>
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

  // Mettre à jour les en-têtes du tableau annuel selon le mode
  const annualThead = document.querySelector('#tbody-annual')?.closest('table')?.querySelector('thead tr');

  // ─ Mode Location ─
  if (_poleId === RENTAL_POLE) {
    if (annualThead) annualThead.innerHTML = '<th>Bien</th><th class="cell-money">—</th><th class="cell-center">Entrées</th><th class="cell-center">Mois actifs</th><th class="cell-money">CA total</th><th>Type</th>';
    const propMap   = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
    const allRental = Data.getRentalIncomes().filter(r => r.yearMonth >= ymStart && r.yearMonth <= ymEnd);
    const filtered  = _companyId ? allRental.filter(r => r.propertyId === _companyId) : allRental;
    const byProp    = {};
    filtered.forEach(r => {
      const key = r.propertyId || '__none__';
      if (!byProp[key]) byProp[key] = { income: 0, months: new Set(), count: 0 };
      byProp[key].income += _encAmt(r);
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
  if (annualThead) annualThead.innerHTML = '<th>École / Client</th><th class="cell-money">Tarif/h</th><th class="cell-center">Missions</th><th class="cell-center">Heures</th><th class="cell-money">CA total</th><th>Via</th>';
  const coMap  = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const ownCos = Data.getOwnCompanies();

  let all = Data.getMissions().filter(m =>
    m.date && m.date >= dateStart && m.date <= dateEnd &&
    (m.status === 'done' || m.status === 'planned') && m.missionType !== 'personal'
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

  // Ligne Oraux / Jurys HEIP (suivi factures) — rattachés au pôle Astéria
  if (_orxVisible()) {
    const orxYear = _orxBetween(dateStart, dateEnd);
    const orxSum  = _orxSum(orxYear);
    if (orxSum > 0) {
      totalRevenue += orxSum;
      const orxPole = _orxPoleId();
      if (orxPole) poleRevs[orxPole] = (poleRevs[orxPole] || 0) + orxSum;
      const viaName = orxPole ? (coMap[orxPole]?.name || '—') : '—';
      rows.push(`<tr style="background:#f0f9ff">
        <td><span class="school-dot" style="background:#0ea5e9"></span> 🎓 Oraux / Jurys HEIP <span style="font-size:0.75rem;color:var(--text-muted)">(suivi factures)</span></td>
        <td class="cell-money">—</td>
        <td class="cell-center">${orxYear.length} session${orxYear.length>1?'s':''}</td>
        <td class="cell-center">${_orxCount(orxYear)} oraux</td>
        <td class="cell-money">${Utils.formatMoney(orxSum)}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${Utils.escapeHtml(viaName)}</td>
      </tr>`);
    }
  }

  // Ligne locatif si "tous les pôles"
  if (!_poleId) {
    const rentalYear = Data.getRentalIncomes().filter(r => r.yearMonth >= ymStart && r.yearMonth <= ymEnd);
    const rentalSum  = rentalYear.reduce((s, r) => s + _encAmt(r), 0);
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
      const rs = Data.getRentalIncomes().filter(r => r.yearMonth >= ymStart && r.yearMonth <= ymEnd).reduce((s,r)=>s+_encAmt(r),0);
      if (rs > 0) parts.push(`Location : ${Utils.formatMoney(rs)}`);
    }
    summaryEl.textContent = parts.join('  |  ');
  }
}

// ── Mode bilan / comparaison ─────────────────────────────────────────────────

function setAnnualMode(mode) {
  const isBilan = mode === 'bilan';
  document.getElementById('annual-bilan-view').style.display   = isBilan ? '' : 'none';
  document.getElementById('annual-compare-view').style.display = isBilan ? 'none' : '';
  const wrap = document.getElementById('compare-year-wrap');
  if (wrap) wrap.style.display = isBilan ? 'none' : 'flex';
  const btnB = document.getElementById('btn-annual-bilan');
  const btnC = document.getElementById('btn-annual-compare');
  if (btnB) { btnB.style.background = isBilan ? 'var(--primary)' : 'transparent'; btnB.style.color = isBilan ? '#fff' : 'var(--text-muted)'; }
  if (btnC) { btnC.style.background = isBilan ? 'transparent' : 'var(--primary)'; btnC.style.color = isBilan ? 'var(--text-muted)' : '#fff'; }
  if (!isBilan) renderAnnualComparison();
}

function renderAnnualComparison() {
  const [syA, eyA] = _schoolYear.split('-');
  const dateStartA = `${syA}-09-01`, dateEndA = `${eyA}-08-31`;
  const ymStartA = dateStartA.slice(0,7), ymEndA = dateEndA.slice(0,7);

  const compareYearSel = document.getElementById('filter-compare-year');
  const compareYear = compareYearSel?.value || `${parseInt(syA)+1}-${parseInt(eyA)+1}`;
  const [syB, eyB] = compareYear.split('-');
  const dateStartB = `${syB}-09-01`, dateEndB = `${eyB}-08-31`;
  const ymStartB = dateStartB.slice(0,7), ymEndB = dateEndB.slice(0,7);

  const hA = document.getElementById('compare-header-a');
  const hB = document.getElementById('compare-header-b');
  if (hA) hA.textContent = _schoolYear;
  if (hB) hB.textContent = compareYear;

  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);

  const aggMissions = (dateStart, dateEnd) => {
    let ms = Data.getMissions().filter(m =>
      m.date && m.date >= dateStart && m.date <= dateEnd &&
      (m.status === 'done' || m.status === 'planned') && m.missionType !== 'personal'
    );
    if (_poleId) ms = ms.filter(m => coMap[m.companyId]?.poleId === _poleId);
    const by = {};
    ms.forEach(m => {
      if (!m.companyId) return;
      if (!by[m.companyId]) by[m.companyId] = { count: 0, hours: 0, revenue: 0 };
      by[m.companyId].count++;
      by[m.companyId].hours   += m.duration || 0;
      by[m.companyId].revenue += (m.duration || 0) * (m.billingRate || 0);
    });
    return by;
  };

  const dataA = aggMissions(dateStartA, dateEndA);
  const dataB = aggMissions(dateStartB, dateEndB);
  const allIds = [...new Set([...Object.keys(dataA), ...Object.keys(dataB)])];

  const rows = allIds
    .map(id => {
      const co = coMap[id];
      if (!co || co.role === 'own') return null;
      const a = dataA[id] || { count: 0, hours: 0, revenue: 0 };
      const b = dataB[id] || { count: 0, hours: 0, revenue: 0 };
      return { co, a, b, inA: a.hours > 0, inB: b.hours > 0 };
    })
    .filter(Boolean)
    .sort((x, y) => {
      const xMissing = x.inA && !x.inB, yMissing = y.inA && !y.inB;
      if (xMissing !== yMissing) return xMissing ? -1 : 1;
      return y.a.revenue - x.a.revenue;
    });

  let totA = {count:0,hours:0,revenue:0}, totB = {count:0,hours:0,revenue:0};

  const tbody = document.getElementById('tbody-compare');
  if (!tbody) return;
  tbody.innerHTML = rows.map(({co, a, b, inA, inB}) => {
    totA.count += a.count; totA.hours += a.hours; totA.revenue += a.revenue;
    totB.count += b.count; totB.hours += b.hours; totB.revenue += b.revenue;
    const deltaH = b.hours - a.hours;
    let statut, statColor;
    if (inA && inB)   { statut = '✓ Actif';             statColor = 'var(--success)'; }
    else if (inA)     { statut = '⚠ Non repositionné';  statColor = '#f97316'; }
    else              { statut = '🆕 Nouveau';            statColor = '#3b82f6'; }
    const rowBg = (!inB && inA) ? 'background:rgba(249,115,22,0.07)' : (!inA && inB) ? 'background:rgba(59,130,246,0.07)' : '';
    const dStr  = deltaH === 0 ? '—' : `${deltaH > 0 ? '+' : '-'}${Utils.formatDuration(Math.abs(deltaH))}`;
    const dCol  = deltaH > 0 ? 'var(--success)' : deltaH < 0 ? 'var(--danger)' : 'var(--text-muted)';
    return `<tr style="${rowBg}">
      <td><span class="school-dot" style="background:${co.color||'#94a3b8'}"></span> ${Utils.escapeHtml(co.name)}</td>
      <td class="cell-center">${a.count||'—'}</td>
      <td class="cell-center">${a.hours>0?Utils.formatDuration(a.hours):'—'}</td>
      <td class="cell-money">${a.revenue>0?Utils.formatMoney(a.revenue):'—'}</td>
      <td class="cell-center">${b.count||'—'}</td>
      <td class="cell-center">${b.hours>0?Utils.formatDuration(b.hours):'—'}</td>
      <td class="cell-money">${b.revenue>0?Utils.formatMoney(b.revenue):'—'}</td>
      <td class="cell-center" style="color:${dCol};font-weight:600">${dStr}</td>
      <td class="cell-center" style="color:${statColor};font-size:0.82rem;font-weight:600">${statut}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" class="empty-state-cell">Aucune donnée sur ces périodes.</td></tr>';

  // Oraux / Jurys HEIP (suivi factures)
  if (_orxVisible()) {
    const orxA = _orxSum(_orxBetween(dateStartA, dateEndA));
    const orxB = _orxSum(_orxBetween(dateStartB, dateEndB));
    if (orxA > 0 || orxB > 0) {
      totA.revenue += orxA; totB.revenue += orxB;
      const dO = orxB - orxA;
      tbody.innerHTML += `<tr style="background:#f0f9ff">
        <td><span class="school-dot" style="background:#0ea5e9"></span> 🎓 Oraux / Jurys HEIP</td>
        <td class="cell-center">—</td><td class="cell-center">—</td>
        <td class="cell-money">${orxA>0?Utils.formatMoney(orxA):'—'}</td>
        <td class="cell-center">—</td><td class="cell-center">—</td>
        <td class="cell-money">${orxB>0?Utils.formatMoney(orxB):'—'}</td>
        <td class="cell-center" style="color:${dO>=0?'var(--success)':'var(--danger)'};font-weight:600">${dO===0?'—':(dO>0?'+':'-')+Utils.formatMoney(Math.abs(dO))}</td>
        <td></td>
      </tr>`;
    }
  }

  // Revenus locatifs (si tous pôles)
  if (!_poleId) {
    const rentA = Data.getRentalIncomes().filter(r=>r.yearMonth>=ymStartA&&r.yearMonth<=ymEndA).reduce((s,r)=>s+_encAmt(r),0);
    const rentB = Data.getRentalIncomes().filter(r=>r.yearMonth>=ymStartB&&r.yearMonth<=ymEndB).reduce((s,r)=>s+_encAmt(r),0);
    if (rentA > 0 || rentB > 0) {
      totA.revenue += rentA; totB.revenue += rentB;
      const dR = rentB - rentA;
      tbody.innerHTML += `<tr style="background:var(--primary-light,#eff6ff)">
        <td><span class="school-dot" style="background:#10b981"></span> 🏠 Revenus locatifs</td>
        <td class="cell-center">—</td><td class="cell-center">—</td>
        <td class="cell-money">${rentA>0?Utils.formatMoney(rentA):'—'}</td>
        <td class="cell-center">—</td><td class="cell-center">—</td>
        <td class="cell-money">${rentB>0?Utils.formatMoney(rentB):'—'}</td>
        <td class="cell-center" style="color:${dR>=0?'var(--success)':'var(--danger)'};font-weight:600">${dR===0?'—':(dR>0?'+':'-')+Utils.formatMoney(Math.abs(dR))}</td>
        <td></td>
      </tr>`;
    }
  }

  const totDH = totB.hours - totA.hours;
  const tfoot = document.getElementById('tfoot-compare');
  if (tfoot) tfoot.innerHTML = `
    <td><strong>Total</strong></td>
    <td class="cell-center"><strong>${totA.count}</strong></td>
    <td class="cell-center"><strong>${Utils.formatDuration(totA.hours)}</strong></td>
    <td class="cell-money"><strong>${Utils.formatMoney(totA.revenue)}</strong></td>
    <td class="cell-center"><strong>${totB.count}</strong></td>
    <td class="cell-center"><strong>${Utils.formatDuration(totB.hours)}</strong></td>
    <td class="cell-money"><strong>${Utils.formatMoney(totB.revenue)}</strong></td>
    <td class="cell-center" style="color:${totDH>=0?'var(--success)':'var(--danger)'};font-weight:700">${totDH>=0?'+':'-'}${Utils.formatDuration(Math.abs(totDH))}</td>
    <td></td>`;
}

// ── Charges prestataires ─────────────────────────────────────────────────────

function renderProviderCosts() {
  const section = document.getElementById('section-provider-costs');
  if (_providerIds.length === 0 || _poleId === RENTAL_POLE) { section.style.display = 'none'; return; }
  section.style.display = '';

  const [sy, ey]  = _schoolYear.split('-');
  const dateStart = `${sy}-09-01`, dateEnd = `${ey}-08-31`;
  const _pcCoMap = {}; Data.getCompanies().forEach(c => _pcCoMap[c.id] = c);
  const allM     = Data.getMissions().filter(m =>
    (m.status === 'done' || m.status === 'planned') && m.missionType !== 'personal' && _matchesPole(m, _pcCoMap));
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

// ── Bilan par prestataire (réseau EVOL = écoles qui travaillent avec EVOL) ────
// Le rattachement au réseau EVOL se fait par ÉCOLE : une école est "EVOL"
// dès qu'au moins une de ses missions est taguée réseau EVOL (EVOL Agency ou
// un freelance). Ensuite TOUTES les missions de cette école comptent EVOL,
// ce qui rattrape les missions non/mal taguées (ex : CNAM, Cours particuliers).
// USAC reste hors EVOL car aucune de ses missions n'est taguée EVOL.
const EVOL_NETWORK_KEY  = 'evol-network';
const EVOL_NETWORK_NAME = '🤝 EVOL Agency (réseau)';
function _isEvolNetworkProvider(p) {
  const st = (p.structure || '').trim().toLowerCase();
  return p.id === 'prov-evol' || st === 'freelance' || st.includes('evol');
}
// Ensemble des écoles travaillant avec EVOL (≥ 1 mission taguée réseau EVOL)
function _getEvolSchoolIds() {
  const provById = {}; Data.getProviders().forEach(p => provById[p.id] = p);
  const set = new Set();
  Data.getMissions().forEach(m => {
    if (m.status === 'cancelled' || !m.companyId) return;
    const pids = (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []));
    if (pids.some(id => { const p = provById[id]; return p && _isEvolNetworkProvider(p); })) set.add(m.companyId);
  });
  return set;
}

function renderProviderPartnership() {
  const section = document.getElementById('section-provider-partnership');
  if (!section) return;
  if (_poleId === RENTAL_POLE) { section.style.display = 'none'; return; }
  section.style.display = '';

  const [sy, ey]  = _schoolYear.split('-');
  const dateStart = `${sy}-09-01`, dateEnd = `${ey}-08-31`;
  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const provById = {}; Data.getProviders().forEach(p => provById[p.id] = p);
  const evolSchools = _getEvolSchoolIds();

  // Missions de l'année scolaire (réalisé + prévu), filtrées par pôle actif
  const yearM = Data.getMissions().filter(m =>
    m.date && m.date >= dateStart && m.date <= dateEnd &&
    m.status !== 'cancelled' && m.missionType !== 'personal' && _matchesPole(m, coMap)
  );
  // CA total de l'année (base du pourcentage)
  const totalCA = yearM.reduce((s,m) => s + (m.duration||0)*(m.billingRate||0), 0);

  // Attribution UNIQUE : chaque mission est rattachée à un seul groupe.
  // EVOL si l'école travaille avec EVOL (ou mission directement taguée EVOL),
  // sinon au premier prestataire, sinon "Sans prestataire".
  const NONE_KEY = '__none__', NONE_NAME = 'Sans prestataire (missions directes)';
  const groups = {};
  let tN=0, tH=0, tR=0;
  yearM.forEach(m => {
    const pids = (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []));
    const h = m.duration||0, rev = h*(m.billingRate||0);
    tN++; tH+=h; tR+=rev;
    // Déterminer le groupe unique de la mission
    const taggedEvol = pids.some(id => { const p = provById[id]; return p && _isEvolNetworkProvider(p); });
    let gkey, gname;
    if ((m.companyId && evolSchools.has(m.companyId)) || taggedEvol) {
      gkey = EVOL_NETWORK_KEY; gname = EVOL_NETWORK_NAME;       // école EVOL
    } else {
      // premier prestataire non-EVOL, sinon "Sans prestataire"
      let first = null;
      for (const id of pids) { const p = provById[id]; if (p) { first = p; break; } }
      if (first) { gkey = first.id; gname = ([first.firstName, first.lastName].filter(Boolean).join(' ') || first.structure || 'Prestataire'); }
      else { gkey = NONE_KEY; gname = NONE_NAME; }
    }
    if (!groups[gkey]) groups[gkey] = { name: gname, n:0, h:0, rev:0 };
    groups[gkey].n++; groups[gkey].h+=h; groups[gkey].rev+=rev;
  });

  const rows = Object.values(groups).map(g => ({
    ...g, pct: totalCA > 0 ? (g.rev/totalCA*100) : 0
  })).sort((a,b) => b.rev - a.rev);

  const tbody = document.getElementById('tbody-provider-partnership');
  tbody.innerHTML = rows.map(r => `<tr>
    <td><strong>${Utils.escapeHtml(r.name)}</strong></td>
    <td class="cell-center">${r.n}</td>
    <td class="cell-center">${Utils.formatDuration(r.h)}</td>
    <td class="cell-money">${Utils.formatMoney(r.rev)}</td>
    <td class="cell-center" style="font-weight:600">${r.pct.toFixed(1)} %</td>
  </tr>`).join('') || '<tr><td colspan="5" class="empty-state-cell">Aucune mission sur cette année.</td></tr>';

  const tPct = totalCA > 0 ? (tR/totalCA*100) : 0;
  const tfoot = document.getElementById('tfoot-provider-partnership');
  if (tfoot) tfoot.innerHTML = `
    <td><strong>Total</strong></td>
    <td class="cell-center"><strong>${tN}</strong></td>
    <td class="cell-center"><strong>${Utils.formatDuration(tH)}</strong></td>
    <td class="cell-money"><strong>${Utils.formatMoney(tR)}</strong></td>
    <td class="cell-center"><strong>${tPct.toFixed(0)} %</strong></td>`;

  const lbl = document.getElementById('pp-year-label');
  if (lbl) lbl.textContent = _schoolYear;
  const sum = document.getElementById('pp-summary');
  if (sum) sum.textContent = rows.length ? `  ·  ${rows.length} ligne${rows.length>1?'s':''}  ·  CA total année : ${Utils.formatMoney(totalCA)}` : '';
}

// ── Graphique temporel ───────────────────────────────────────────────────────

let _chartInstance = null;

function renderChart() {
  const group   = document.getElementById('chart-group').value;
  const split   = document.getElementById('chart-split').value;
  const ctype   = document.getElementById('chart-type').value;
  const isRental = (_poleId === RENTAL_POLE);

  // Peupler les selects de période pour la moyenne (années sep→août)
  const avgStartSel = document.getElementById('avg-period-start');
  const avgEndSel   = document.getElementById('avg-period-end');
  const _curSY = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const _syOpts = [];
  for (let y = 2024; y <= _curSY + 1; y++) _syOpts.push(`${y}-${y+1}`);
  let avgStart = '', avgEnd = '';
  if (avgStartSel && avgEndSel && _syOpts.length > 0) {
    if (avgStartSel.children.length !== _syOpts.length) {
      const prevS = avgStartSel.value, prevE = avgEndSel.value;
      avgStartSel.innerHTML = _syOpts.map(o => `<option value="${o}">${o}</option>`).join('');
      avgEndSel.innerHTML   = _syOpts.map(o => `<option value="${o}">${o}</option>`).join('');
      avgStartSel.value = _syOpts.includes(prevS) ? prevS : _syOpts[0];
      avgEndSel.value   = _syOpts.includes(prevE) ? prevE : (_syOpts[_syOpts.length - 2] || _syOpts[0]);
    }
    avgStart = avgStartSel.value || _syOpts[0];
    avgEnd   = avgEndSel.value   || _syOpts[_syOpts.length - 1];
  }
  const _sYr = avgStart ? parseInt(avgStart.split('-')[0]) : 2024;
  const _eYr = avgEnd   ? parseInt(avgEnd.split('-')[0])   : _curSY;
  const inAvgPeriod = lbl => {
    if (!avgStart || !avgEnd) return true;
    return group === 'month'
      ? lbl >= `${_sYr}-09` && lbl <= `${_eYr + 1}-08`
      : lbl >= avgStart && lbl <= avgEnd;
  };

  if (ctype === 'pie') { renderPieChart(); return; }
  if (isRental || split === 'rental') { _renderRentalChart(group, ctype); return; }

  const coMap       = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const ownCos      = Data.getOwnCompanies();
  const allMissions = Data.getMissions().filter(m =>
    (m.status === 'done' || m.status === 'planned') && m.date && m.missionType !== 'personal'
  );

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
  const oKey = o => {
    const ym = o.yearMonth || (o.date||'').slice(0,7);
    if (group === 'month') return ym;
    const [oy, om] = ym.split('-').map(Number);
    return `${om>=9?oy:oy-1}-${om>=9?oy+1:oy}`;
  };
  // Oraux HEIP par période (vides si les filtres actifs les excluent)
  const allOraux      = _orxVisible() ? (Data.getOraux()||[]).filter(o => o.date) : [];
  const orauxMonthly  = labels.map(lbl => _orxSum(allOraux.filter(o => oKey(o) === lbl)));

  let missions = allMissions.filter(m => _matchesPole(m, coMap));
  if (_companyId && _companyId !== '__none__') missions = missions.filter(m => m.companyId === _companyId);
  const noSchools = _companyId === '__none__';

  const COLORS = ['#3b82f6','#f97316','#10b981','#8b5cf6','#ef4444','#06b6d4','#f59e0b','#84cc16'];
  let datasets = [];

  if (!noSchools) {
    // makePoleDataset travaille sur allMissions (pas missions filtré par _companyId)
    // pour toujours afficher le CA réel du pôle, indépendamment du filtre école actif
    const makePoleDataset = (pole, i) => {
      const baseColor = pole.color || COLORS[i];
      const isOrxPole = pole.id === _orxPoleId();
      const data = labels.map((lbl, li) => {
        const ms = allMissions.filter(m => {
          if (mKey(m) !== lbl) return false;
          const co = coMap[m.companyId];
          if (!co) return false;
          return co.role === 'own' ? co.id === pole.id : co.poleId === pole.id;
        });
        const base = ms.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
        // Le CA du pôle d'HEIP inclut les oraux (suivi factures)
        return Math.round((base + (isOrxPole ? orauxMonthly[li] : 0))*100)/100;
      });
      return {
        label: pole.name, data,
        backgroundColor: labels.map(lbl => lbl === _yearMonth ? baseColor : baseColor+'99'),
        borderColor: labels.map(lbl => lbl === _yearMonth ? baseColor : baseColor+'99'),
        borderWidth: labels.map(lbl => lbl === _yearMonth ? 3 : 2),
        fill: ctype === 'line',
      };
    };

    if (split === 'poles') {
      if (ownCos.length > 1) {
        // Missions par mois (tous pôles)
        const missionMonthlyRev = labels.map(lbl =>
          Math.round(missions.filter(m => mKey(m) === lbl).reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0)*100)/100
        );

        // Revenus locatifs par mois (si "tous les pôles")
        let rentalMonthly = labels.map(() => 0);
        let hasRental = false;
        if (!_poleId) {
          const allRental = Data.getRentalIncomes();
          rentalMonthly = labels.map(lbl =>
            Math.round(allRental.filter(r => rKey(r) === lbl).reduce((s,r) => s+(r.actualAmount??r.amountEURairbnb??0), 0)*100)/100
          );
          hasRental = rentalMonthly.some(v => v > 0);
        }

        // Barres = missions + oraux HEIP + location (accumulé)
        const totalMonthlyRev = labels.map((_, i) => Math.round((missionMonthlyRev[i] + orauxMonthly[i] + rentalMonthly[i]) * 100) / 100);
        const totalLabel = ownCos.map(c => c.name).join(' + ');
        const barLabel   = hasRental ? `Total (${totalLabel} + Location)` : `Total (${totalLabel})`;

        datasets.push({
          label: barLabel,
          data: totalMonthlyRev,
          backgroundColor: labels.map(lbl => lbl === _yearMonth ? '#8b5cf6' : '#8b5cf699'),
          borderColor: labels.map(lbl => lbl === _yearMonth ? '#6d28d9' : '#8b5cf6'),
          borderWidth: labels.map(lbl => lbl === _yearMonth ? 3 : 2),
          fill: ctype === 'line', pointRadius: ctype === 'line' ? 3 : 0, tension: 0.3,
        });

        // ── Moyenne missions uniquement (orange) ──────────────────────────────
        const periodMIdx = labels.map((lbl,i) => inAvgPeriod(lbl) && missionMonthlyRev[i] > 0 ? i : -1).filter(i=>i>=0);
        if (periodMIdx.length > 0) {
          const avgM = Math.round(periodMIdx.reduce((s,i)=>s+missionMonthlyRev[i],0)/periodMIdx.length*100)/100;
          datasets.push({
            label: `Moy. missions (${Utils.formatMoney(avgM)})`,
            data: labels.map((lbl) => inAvgPeriod(lbl) ? avgM : null),
            borderColor: '#f97316', borderWidth: 2, borderDash: [8,4],
            backgroundColor: 'transparent', pointRadius: 0, tension: 0, fill: false,
            type: 'line', order: -1, spanGaps: false,
          });
        }

        // ── Moyenne totale missions + location (teal) — toujours affichée
        const periodTIdx = labels.map((lbl,i) => inAvgPeriod(lbl) && totalMonthlyRev[i] > 0 ? i : -1).filter(i=>i>=0);
        if (periodTIdx.length > 0) {
          const avgT = Math.round(periodTIdx.reduce((s,i)=>s+totalMonthlyRev[i],0)/periodTIdx.length*100)/100;
          datasets.push({
            label: `Moy. totale (${Utils.formatMoney(avgT)})`,
            data: labels.map((lbl) => inAvgPeriod(lbl) ? avgT : null),
            borderColor: '#10b981', borderWidth: 2, borderDash: [5,3],
            backgroundColor: 'transparent', pointRadius: 0, tension: 0, fill: false,
            type: 'line', order: -2, spanGaps: false,
          });
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
      if (orauxMonthly.some(v => v > 0)) {
        datasets.push({ label: '🎓 Oraux HEIP', data: orauxMonthly, backgroundColor: '#0ea5e999', borderColor: '#0ea5e9', borderWidth: 2, fill: false });
      }
    } else {
      const pole = ownCos.find(p => p.id === split);
      if (pole) datasets.push(makePoleDataset(pole, ownCos.indexOf(pole)));
    }
  }

  if (_providerIds.length > 0) {
    const allProvM = allMissions.filter(m => {
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      return pids.some(pid => _providerIds.includes(pid)) && _matchesPole(m, coMap);
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
    const _fm   = Data.getMissions().filter(m => m.date).map(m => m.date).sort()[0];
    const start = _fm ? new Date(_fm.slice(0,7)+'-01') : new Date(new Date().getFullYear()-1, 8, 1);
    const end   = new Date(); end.setMonth(end.getMonth() + 18);
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
  // Palette Location : teal/vert cohérent avec l'identité visuelle Location (#10b981)
  const LOC_COLORS = ['#10b981','#0891b2','#059669','#14b8a6','#22c55e','#06b6d4','#0284c7','#16a34a'];
  const datasets = [];
  props.forEach((prop, i) => {
    const data = labels.map(lbl => Math.round(filtered.filter(r=>r.propertyId===prop.id&&rKey(r)===lbl).reduce((s,r)=>s+(r.actualAmount??r.amountEURairbnb??0),0)*100)/100);
    if (data.every(v=>v===0)) return;
    // Utiliser la couleur de la propriété si définie et non-orange par défaut, sinon teal
    const col = (prop.color && prop.color !== '#f97316') ? prop.color : LOC_COLORS[i % LOC_COLORS.length];
    datasets.push({
      label: prop.name, data,
      backgroundColor: labels.map(lbl => lbl === _yearMonth ? col : col+'99'),
      borderColor: col, borderWidth: labels.map(lbl => lbl === _yearMonth ? 3 : 2), fill: false,
    });
  });
  if (props.length > 1) {
    const td = labels.map(lbl => Math.round(filtered.filter(r=>rKey(r)===lbl).reduce((s,r)=>s+(r.actualAmount??r.amountEURairbnb??0),0)*100)/100);
    if (td.some(v=>v>0)) datasets.unshift({ label: 'Total Location', data: td, backgroundColor: '#10b98160', borderColor: '#10b981', borderWidth: 2, fill: false, type: 'line', pointRadius: 3, tension: 0.3 });
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
      byProp[key].total += _encAmt(r);
    });
    const sorted = Object.values(byProp).map(e=>({...e,total:Math.round(e.total*100)/100})).filter(e=>e.total>0).sort((a,b)=>b.total-a.total);
    _buildDoughnut(sorted, COLORS);
    return;
  }

  // Camembert missions — scoped sur l'année scolaire sélectionnée (rupture sept → août)
  const [psy, pey]  = _schoolYear.split('-');
  const pieStart    = `${psy}-09-01`, pieEnd = `${pey}-08-31`;
  const pieYmStart  = pieStart.slice(0,7), pieYmEnd = pieEnd.slice(0,7);
  const coMap       = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const allMissions = Data.getMissions().filter(m =>
    (m.status === 'done' || m.status === 'planned') && m.date && m.missionType !== 'personal' &&
    m.date >= pieStart && m.date <= pieEnd
  );
  let missions = allMissions.filter(m => _matchesPole(m, coMap));
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

  // Tranche Oraux / Jurys HEIP (suivi factures)
  if (_orxVisible()) {
    const orxSum = _orxSum(_orxBetween(pieStart, pieEnd));
    if (orxSum > 0) sorted.push({ name: '🎓 Oraux HEIP', total: orxSum, color: '#0ea5e9' });
  }
  // Tranche locative si "tous les pôles"
  if (!_poleId) {
    const rentalSum = Data.getRentalIncomes()
      .filter(r => r.yearMonth >= pieYmStart && r.yearMonth <= pieYmEnd)
      .reduce((s,r)=>s+_encAmt(r),0);
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

// ── Export CSV revenus locatifs ───────────────────────────────────────────────

function _exportRentalCsv() {
  const propMap = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  let incomes = Data.getRentalIncomes();
  if (_companyId) incomes = incomes.filter(r => r.propertyId === _companyId);
  incomes.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

  const STATUS_FR = { received: 'Reçu', pending: 'En attente', partial: 'Partiel' };
  const rows = [['Mois', 'Bien', 'Plateforme', 'Nuits louées', 'Estimé (€)', 'Encaissé (€)', 'Statut', 'Notes']];
  incomes.forEach(r => {
    const prop = propMap[r.propertyId];
    rows.push([
      r.yearMonth || '',
      prop?.name || '',
      r.platform || '',
      r.nightsRented ?? '',
      (r.amount || 0).toFixed(2).replace('.', ','),
      _hasEnc(r) ? _encAmt(r).toFixed(2).replace('.', ',') : '',
      STATUS_FR[r.status] || r.status || '',
      r.notes || '',
    ]);
  });
  const name = _companyId && propMap[_companyId] ? `-${propMap[_companyId].name.replace(/\s+/g,'_')}` : '';
  window._downloadCSV(rows, `revenus-locatifs${name}.csv`);
}

// ── Section locative en bas (mode "Tous les pôles" uniquement) ───────────────

function renderRentalSection() {
  const section = document.getElementById('section-rental');
  if (!section) return;
  // Masquer si un pôle spécifique est sélectionné (missions ou location)
  if (_poleId) { section.style.display = 'none'; return; }

  const allMonthIncomes = Data.getRentalIncomesByMonth(_yearMonth);
  if (allMonthIncomes.length === 0) { section.style.display = 'none'; return; }
  // N'afficher que les encaissements réellement reçus (non 0€)
  const incomes = allMonthIncomes.filter(r => r.actualAmount != null || r.amountEURairbnb != null);
  section.style.display = '';

  const propMap = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const [y, m]  = _yearMonth.split('-');
  document.getElementById('rental-month-label').textContent = `${Utils.MONTHS_LONG[+m-1]} ${y}`;

  const total   = incomes.reduce((s,r) => s+(r.actualAmount??r.amountEURairbnb??0), 0);
  const pending = allMonthIncomes.filter(r=>r.actualAmount==null&&r.amountEURairbnb==null).reduce((s,r)=>s+(r.amount||0), 0);
  const propIds = [...new Set(allMonthIncomes.map(r=>r.propertyId).filter(Boolean))];

  // Libellés "encaissements réels"
  const totalLbl = document.querySelector('#section-rental .kpi-label:first-of-type');
  if (totalLbl) totalLbl.textContent = 'Encaissé';
  const pendLbl = document.querySelector('#section-rental .kpi-card:last-child .kpi-label');
  if (pendLbl) pendLbl.textContent = 'En attente';

  document.getElementById('rental-total').textContent   = Utils.formatMoney(total);
  document.getElementById('rental-count').textContent   = propIds.length;
  document.getElementById('rental-pending').textContent = Utils.formatMoney(pending);

  document.getElementById('rental-tbody').innerHTML = incomes.length === 0
    ? `<tr><td colspan="6" class="empty-state-cell" style="color:var(--text-muted);font-style:italic">Aucun encaissement reçu ce mois.</td></tr>`
    : incomes.map(r => {
      const prop = propMap[r.propertyId];
      const col  = prop?.color || '#94a3b8';
      return `<tr>
        <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name||'—')}</td>
        <td>${Utils.escapeHtml(r.platform||'—')}</td>
        <td class="cell-center">${r.nightsRented||'—'}</td>
        <td class="cell-money">${Utils.formatMoney(r.actualAmount??r.amountEURairbnb??r.amount??0)}</td>
        <td>${RENTAL_STATUS_BADGES[r.status]||r.status||''}</td>
        <td class="cell-center"><a href="location.html" style="font-size:0.8rem;color:var(--primary)">Voir</a></td>
      </tr>`;
    }).join('');
  document.getElementById('rental-tfoot-total').innerHTML = `<strong>${Utils.formatMoney(total)}</strong>`;
}
