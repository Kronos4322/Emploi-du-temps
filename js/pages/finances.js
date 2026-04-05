// finances.js — Rapport financier
'use strict';

const _finUrlParams = new URLSearchParams(window.location.search);
let _yearMonth   = Utils.currentYearMonth();
let _companyId   = '';
let _poleId      = _finUrlParams.get('pole') || '';
let _providerIds = []; // [] = tous
// Année scolaire : format "2025-2026" (1 sept → 31 août)
const _nowSY     = (() => { const n = new Date(); const y = n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear()-1; return `${y}-${y+1}`; })();
let _schoolYear  = _nowSY;

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilters();
  render();
  renderAnnual();
  renderChart();
  // section prestataires masquée jusqu'à sélection

  buildCompanyFilter();
  document.getElementById('filter-month').addEventListener('change',   e => { _yearMonth = e.target.value; render(); });
  document.getElementById('filter-company').addEventListener('change', e => { _companyId = e.target.value; render(); renderChart(); });
  document.getElementById('filter-pole').addEventListener('change',    e => { _poleId = e.target.value; buildCompanyFilter(); render(); renderAnnual(); renderChart(); });
  document.getElementById('filter-year').addEventListener('change',    e => { _schoolYear = e.target.value; renderAnnual(); });
  ['chart-group','chart-split','chart-type'].forEach(id =>
    document.getElementById(id).addEventListener('change', renderChart));
  document.getElementById('btn-export-csv').addEventListener('click', () => Data.exportToCsv(_yearMonth));
  document.getElementById('btn-print').addEventListener('click', () => window.print());
});

function buildCompanyFilter() {
  const allCos = {}; Data.getCompanies().forEach(c => allCos[c.id] = c);
  const clientCos = Data.getClientSchools().filter(co => {
    if (!_poleId) return true;
    if (co.poleId) return co.poleId === _poleId;
    const pole = Data.getCompanyById(_poleId);
    return pole ? (pole.defaultBillingRate === 35 ? co.defaultBillingRate === 35 : co.defaultBillingRate !== 35) : true;
  });
  const el = document.getElementById('filter-company');
  const prev = _companyId;
  el.innerHTML = '<option value="">Toutes les écoles</option><option value="__none__">— Aucune école —</option>' +
    clientCos.map(c => `<option value="${c.id}" ${c.id===prev?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('');
  // Reset si l'école sélectionnée n'appartient plus au pôle
  if (prev && prev !== '__none__' && !clientCos.find(c => c.id === prev)) {
    _companyId = '';
    el.value = '';
  }
}

function buildFilters() {
  const months = [];
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 18, 1);
  const firstMission = Data.getMissions().map(m => m.date).filter(Boolean).sort()[0];
  const stopYm = firstMission ? firstMission.slice(0,7) : `${now.getFullYear()-1}-09`;
  for (let d = new Date(end); ; d.setMonth(d.getMonth() - 1)) {
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push(ym);
    if (ym <= stopYm) break;
  }
  const ownCos = Data.getOwnCompanies();

  // Années scolaires : de 2024-2025 à l'an prochain
  const nowN = new Date(); const curSY = nowN.getMonth() >= 8 ? nowN.getFullYear() : nowN.getFullYear()-1;
  const schoolYears = [];
  for (let y = curSY + 1; y >= 2024; y--) schoolYears.push(`${y}-${y+1}`);
  document.getElementById('filter-year').innerHTML =
    schoolYears.map(sy => `<option value="${sy}" ${sy === _schoolYear ? 'selected' : ''}>Année scolaire ${sy}</option>`).join('');

  document.getElementById('filter-month').innerHTML =
    months.map(ym => {
      const [y, m] = ym.split('-');
      return `<option value="${ym}" ${ym === _yearMonth ? 'selected' : ''}>${Utils.MONTHS_LONG[+m-1]} ${y}</option>`;
    }).join('');

  document.getElementById('filter-pole').innerHTML =
    '<option value="">Tous les pôles</option>' +
    ownCos.map(c => `<option value="${c.id}" ${_poleId===c.id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('');

  // Chart split : dynamique par pôle
  document.getElementById('chart-split').innerHTML =
    '<option value="poles">Tous les pôles</option>' +
    ownCos.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('') +
    '<option value="schools">Par école</option>';

  const checksDiv = document.getElementById('filter-provider-checks');
  const renderProvChecks = () => {
    checksDiv.innerHTML =
      '<span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">Prestataires :</span>' +
      '<button style="font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer;background:var(--primary);color:#fff" onclick="window._allProvs()">Tous</button>' +
      '<button style="font-size:0.75rem;padding:2px 8px;border-radius:12px;border:1px solid var(--border);cursor:pointer" onclick="window._noneProvs()">Aucun</button>' +
      Data.getProviders().map(p => `
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.82rem;white-space:nowrap">
          <input type="checkbox" value="${p.id}" ${_providerIds.includes(p.id)?'checked':''} onchange="window._onProvCheck()">
          ${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}
        </label>`).join('');
  };
  renderProvChecks();
  window._onProvCheck = () => {
    _providerIds = [...checksDiv.querySelectorAll('input:checked')].map(i => i.value);
    renderProviderCosts();
    renderChart();
  };
  window._allProvs = () => {
    _providerIds = Data.getProviders().map(p => p.id);
    renderProvChecks(); renderProviderCosts(); renderChart();
  };
  window._noneProvs = () => {
    _providerIds = [];
    renderProvChecks(); renderProviderCosts(); renderChart();
  };
}

function render() {
  const stats     = Data.getFinancialStats({ yearMonth: _yearMonth, companyId: (_companyId && _companyId !== '__none__') ? _companyId : undefined });
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const providers = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const [y, m]    = _yearMonth.split('-');

  // Filtre pôle par poleId de l'école, avec fallback billingRate
  let doneMissions    = stats.done;
  let plannedMissions = stats.planned;
  if (_poleId) {
    const allCos = {}; Data.getCompanies().forEach(c => allCos[c.id] = c);
    const pole = Data.getCompanyById(_poleId);
    const filterByPole = m => {
      const co = allCos[m.companyId];
      if (!co) return false;
      if (co.role === 'own') return co.id === _poleId;
      if (co.poleId) return co.poleId === _poleId;
      if (!pole) return false;
      return pole.defaultBillingRate === 35 ? m.billingRate === 35 : m.billingRate !== 35;
    };
    doneMissions    = doneMissions.filter(filterByPole);
    plannedMissions = plannedMissions.filter(filterByPole);
  }
  // Aucune école → aucune mission école
  if (_companyId === '__none__') { doneMissions = []; plannedMissions = []; }

  const reportLabel = `Rapport — ${Utils.MONTHS_LONG[+m-1]} ${y}${_poleId ? ' — ' + (companies[_poleId]?.name || '') : ''}`;
  document.getElementById('report-title').textContent = reportLabel;
  document.getElementById('report-title-summary').textContent = reportLabel;

  // KPIs — réalisé + prévu
  const doneRevenue    = doneMissions.reduce((s,m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const plannedRevenue = plannedMissions.reduce((s,m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const totalRevenue   = Math.round((doneRevenue + plannedRevenue) * 100) / 100;
  const totalCosts     = doneMissions.reduce((s,m) => m.providerId ? s + (m.duration||0)*(m.providerRate||0) : s, 0);
  const netMargin      = Math.round((doneRevenue - totalCosts) * 100) / 100;
  const hoursDone      = doneMissions.reduce((s,m) => s + (m.duration||0), 0);
  const hoursPlanned   = plannedMissions.reduce((s,m) => s + (m.duration||0), 0);
  const unpaidM        = doneMissions.filter(m => m.paymentStatus !== 'paid');
  const unpaidAmt      = unpaidM.reduce((s,m) => s + (m.duration||0)*(m.billingRate||0), 0);

  document.getElementById('fin-revenue').textContent       = Utils.formatMoney(totalRevenue);
  document.getElementById('fin-costs').textContent         = Utils.formatMoney(totalCosts);
  document.getElementById('fin-margin').textContent        = Utils.formatMoney(netMargin);
  document.getElementById('fin-hours-done').textContent    = Utils.formatDuration(hoursDone);
  document.getElementById('fin-hours-planned').textContent = Utils.formatDuration(hoursPlanned);

  const marginCard = document.getElementById('fin-margin-card');
  marginCard.className = 'kpi-card kpi-large ' + (netMargin >= 0 ? 'kpi-positive' : 'kpi-negative');

  const unpaidCard = document.getElementById('fin-unpaid-card');
  document.getElementById('fin-unpaid').textContent       = Utils.formatMoney(unpaidAmt);
  document.getElementById('fin-unpaid-label').textContent = `${unpaidM.length} mission${unpaidM.length !== 1 ? 's' : ''} non payée${unpaidM.length !== 1 ? 's' : ''}`;
  unpaidCard.className = unpaidAmt > 0 ? 'kpi-card kpi-alert-card' : 'kpi-card kpi-success-card';

  // Répartition par école — filtrée par pôle si sélectionné
  const allCosMap2 = companies;
  const clientSchools = Data.getClientSchools().filter(co => {
    if (!_poleId) return true;
    if (co.poleId) return co.poleId === _poleId;
    // fallback billingRate
    const pole = Data.getCompanyById(_poleId);
    return pole ? (pole.defaultBillingRate === 35 ? co.defaultBillingRate === 35 : co.defaultBillingRate !== 35) : true;
  });
  const allByCompany  = {};
  clientSchools.forEach(co => { allByCompany[co.id] = { hours: 0, revenue: 0, done: 0, planned: 0 }; });
  doneMissions.forEach(m => {
    if (allByCompany[m.companyId]) {
      allByCompany[m.companyId].hours   += m.duration || 0;
      allByCompany[m.companyId].revenue += (m.duration||0) * (m.billingRate||0);
      allByCompany[m.companyId].done++;
    }
  });
  plannedMissions.forEach(m => {
    if (allByCompany[m.companyId]) {
      allByCompany[m.companyId].hours   += m.duration || 0;
      allByCompany[m.companyId].revenue += (m.duration||0) * (m.billingRate||0);
      allByCompany[m.companyId].planned++;
    }
  });
  const byCompanyEntries = Object.entries(allByCompany).filter(([,d]) => d.done + d.planned > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue);
  const sectionCompany   = document.getElementById('section-by-company');
  sectionCompany.style.display = (_companyId === '__none__' || byCompanyEntries.length === 0) ? 'none' : '';
  document.getElementById('tbody-by-company').innerHTML = byCompanyEntries.map(([cid, d]) => {
    const co  = companies[cid];
    const col = co ? co.color : '#94a3b8';
    const pct = totalRevenue > 0 ? Math.round(d.revenue / totalRevenue * 100) : 0;
    return `<tr>
      <td><span class="school-dot" style="background:${col}"></span> ${co ? Utils.escapeHtml(co.name) : '—'}</td>
      <td class="cell-center">${d.done}${d.planned > 0 ? ` <span style="color:var(--text-muted);font-size:0.8rem">(+${d.planned} prévu)</span>` : ''}</td>
      <td class="cell-center">${Utils.formatDuration(d.hours)}</td>
      <td class="cell-money">${Utils.formatMoney(d.revenue)}</td>
      <td><div class="progress-bar-wrapper"><div class="progress-bar" style="width:${pct}%;background:${col}"></div><span class="progress-label">${pct}%</span></div></td>
    </tr>`;
  }).join('');
  const allCount = doneMissions.length + plannedMissions.length;
  const allHours = hoursDone + hoursPlanned;
  document.getElementById('total-count').innerHTML   = `<strong>${allCount}</strong>`;
  document.getElementById('total-hours').innerHTML   = `<strong>${Utils.formatDuration(allHours)}</strong>`;
  document.getElementById('total-revenue').innerHTML = `<strong>${Utils.formatMoney(totalRevenue)}</strong>`;

  // Prestataires — filtrés par pôle
  const byProvEntries = Object.entries(stats.byProvider).filter(([pid]) => {
    if (!_poleId) return true;
    const prov = providers[pid];
    if (!prov) return false;
    if (prov.poleId) return prov.poleId === _poleId;
    return true; // pas de poleId → afficher dans tous les pôles
  });
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

  // Missions réalisées — masquées si "aucune école"
  const doneSectionEl = document.getElementById('section-done-missions');
  if (doneSectionEl) doneSectionEl.style.display = _companyId === '__none__' ? 'none' : '';
  document.getElementById('done-section-title').textContent = `Missions réalisées (${doneMissions.length})`;
  document.getElementById('tbody-done').innerHTML = doneMissions.length === 0
    ? '<tr><td colspan="7" class="empty-state-cell">Aucune mission réalisée sur cette période.</td></tr>'
    : doneMissions.map(m => {
      const co  = companies[m.companyId || m.schoolId];
      const col = co ? co.color : '#94a3b8';
      const rev = (m.duration||0) * (m.billingRate||0);
      const PAY = { unpaid:'<span class="badge badge-danger">Non payé</span>', invoiced:'<span class="badge badge-invoiced">Facturé</span>', paid:'<span class="badge badge-success">Payé</span>' };
      return `<tr class="table-row" onclick="Modals.openMission('${m.id}',null,()=>render())">
        <td>${Utils.formatDate(m.date)}</td>
        <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(m.title)}</td>
        <td>${co ? Utils.escapeHtml(co.name) : '—'}</td>
        <td>${Utils.formatDuration(m.duration)}</td>
        <td class="cell-money">${Utils.formatMoney(m.billingRate)}/h</td>
        <td class="cell-money">${Utils.formatMoney(rev)}</td>
        <td>${PAY[m.paymentStatus]||m.paymentStatus}</td>
      </tr>`;
    }).join('');

  // Annulées
  const cancelSection = document.getElementById('section-cancelled');
  cancelSection.style.display = stats.cancelled.length > 0 ? '' : 'none';
  document.getElementById('cancelled-title').textContent = `Missions annulées (${stats.cancelled.length})`;
  document.getElementById('cancelled-list').innerHTML = stats.cancelled.map(m =>
    `<div class="cancelled-row" onclick="Modals.openMission('${m.id}',null,()=>render())">
      <span>${Utils.formatDate(m.date)}</span>
      <span>${Utils.escapeHtml(m.title)}</span>
      <span>${Utils.formatDuration(m.duration)}</span>
    </div>`).join('');
}

function renderAnnual() {
  const [sy, ey]  = _schoolYear.split('-');
  const dateStart = `${sy}-09-01`;
  const dateEnd   = `${ey}-08-31`;

  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const ownCos = Data.getOwnCompanies();

  let all = Data.getMissions().filter(m => m.date && m.date >= dateStart && m.date <= dateEnd && m.status !== 'cancelled');

  // Filtre pôle
  if (_poleId) {
    const pole = Data.getCompanyById(_poleId);
    all = all.filter(m => {
      const school = coMap[m.companyId];
      if (school?.poleId) return school.poleId === _poleId;
      if (!pole) return false;
      return pole.defaultBillingRate === 35 ? m.billingRate === 35 : m.billingRate !== 35;
    });
  }

  const byCompany = {};
  all.forEach(m => {
    if (!m.companyId) return;
    if (!byCompany[m.companyId]) byCompany[m.companyId] = { count: 0, hours: 0, revenue: 0 };
    byCompany[m.companyId].count++;
    byCompany[m.companyId].hours   += m.duration || 0;
    byCompany[m.companyId].revenue += (m.duration || 0) * (m.billingRate || 0);
  });

  const entries = Object.entries(byCompany).sort((a, b) => b[1].revenue - a[1].revenue);
  let totalCount = 0, totalHours = 0, totalRevenue = 0;
  const poleRevs = {}; // poleId → revenue

  const rows = entries.map(([cid, d]) => {
    const co  = coMap[cid];
    if (!co || co.role === 'own') return '';
    const col = co.color || '#94a3b8';
    const rate = co.defaultBillingRate || 0;
    // Déterminer la société racine
    let viaName = '—';
    if (co.poleId) {
      const pole = coMap[co.poleId];
      viaName = pole ? pole.name : '—';
      poleRevs[co.poleId] = (poleRevs[co.poleId] || 0) + d.revenue;
    } else {
      // fallback billingRate
      const p = ownCos.find(o => o.defaultBillingRate === 35 ? rate === 35 : rate !== 35);
      if (p) { viaName = p.name; poleRevs[p.id] = (poleRevs[p.id] || 0) + d.revenue; }
    }
    totalCount += d.count; totalHours += d.hours; totalRevenue += d.revenue;
    return `<tr>
      <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(co.name)}</td>
      <td class="cell-money">${Utils.formatMoney(rate)}/h</td>
      <td class="cell-center">${d.count}</td>
      <td class="cell-center">${Utils.formatDuration(d.hours)}</td>
      <td class="cell-money">${Utils.formatMoney(d.revenue)}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${Utils.escapeHtml(viaName)}</td>
    </tr>`;
  }).filter(Boolean).join('') || '<tr><td colspan="6" class="empty-state-cell">Aucune mission sur cette période.</td></tr>';

  document.getElementById('tbody-annual').innerHTML = rows;
  document.getElementById('annual-total-count').innerHTML   = `<strong>${totalCount}</strong>`;
  document.getElementById('annual-total-hours').innerHTML   = `<strong>${Utils.formatDuration(totalHours)}</strong>`;
  document.getElementById('annual-total-revenue').innerHTML = `<strong>${Utils.formatMoney(totalRevenue)}</strong>`;

  // Totaux par pôle
  const artemis = ownCos.find(o => o.defaultBillingRate === 35);
  const asteria  = ownCos.find(o => o.defaultBillingRate !== 35);
  const artVal = Utils.formatMoney(artemis ? (poleRevs[artemis.id]||0) : 0);
  const astVal = Utils.formatMoney(asteria ? (poleRevs[asteria.id]||0) : 0);
  const summaryEl = document.getElementById('annual-poles-summary');
  if (summaryEl) summaryEl.textContent = `${artemis?.name||'Artémis'} : ${artVal}  |  ${asteria?.name||'Astéria'} : ${astVal}`;
  document.getElementById('annual-year-label').textContent = `Année scolaire ${_schoolYear}`;
}

function renderProviderCosts() {
  const section = document.getElementById('section-provider-costs');
  if (_providerIds.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';

  const [sy, ey]  = _schoolYear.split('-');
  const dateStart = `${sy}-09-01`, dateEnd = `${ey}-08-31`;
  const allM      = Data.getMissions().filter(m => m.status !== 'cancelled');
  const monthM    = allM.filter(m => m.date && m.date.startsWith(_yearMonth));
  const yearM     = allM.filter(m => m.date && m.date >= dateStart && m.date <= dateEnd);
  const provMap   = {}; Data.getProviders().forEach(p => provMap[p.id] = p);

  let tmC=0,tmR=0,tmI=0, tyC=0,tyR=0,tyI=0;
  const rows = _providerIds.map(pid => {
    const p = provMap[pid]; if (!p) return '';
    const mM = monthM.filter(m => m.providerId === pid);
    const mY = yearM.filter(m => m.providerId === pid);
    const mc = mM.reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);
    const mr = mM.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
    const yc = mY.reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);
    const yr = mY.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
    tmC+=mc; tmR+=mr; tmI+=mM.length; tyC+=yc; tyR+=yr; tyI+=mY.length;
    const mm=mr-mc, ym=yr-yc;
    return `<tr>
      <td>${Utils.escapeHtml(p.lastName+' '+p.firstName)}</td>
      <td class="cell-center">${mM.length}</td>
      <td class="cell-money cell-cost">${Utils.formatMoney(mc)}</td>
      <td class="cell-money">${Utils.formatMoney(mr)}</td>
      <td class="cell-money" style="color:${mm>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(mm)}</td>
      <td class="cell-center">${mY.length}</td>
      <td class="cell-money cell-cost">${Utils.formatMoney(yc)}</td>
      <td class="cell-money">${Utils.formatMoney(yr)}</td>
      <td class="cell-money" style="color:${ym>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(ym)}</td>
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

let _chartInstance = null;

function renderChart() {
  const group = document.getElementById('chart-group').value;   // 'month' | 'year'
  const split = document.getElementById('chart-split').value;   // 'poles' | 'schools'
  const ctype = document.getElementById('chart-type').value;    // 'bar' | 'line'

  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const ownCos = Data.getOwnCompanies();
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled' && m.date);

  // Construire les labels (périodes)
  let labels = [];
  if (group === 'month') {
    const _fm = Data.getMissions().map(m=>m.date).filter(Boolean).sort()[0];
    const start = _fm ? new Date(_fm.slice(0,7)+'-01') : new Date(new Date().getFullYear()-1, 8, 1);
    const end   = new Date(); end.setMonth(end.getMonth() + 18);
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      labels.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
  } else {
    // Années scolaires disponibles
    const nowN = new Date(); const curSY = nowN.getMonth() >= 8 ? nowN.getFullYear() : nowN.getFullYear()-1;
    for (let y = 2024; y <= curSY + 1; y++) labels.push(`${y}-${y+1}`);
  }

  // Fonction de clé pour une mission
  const missionKey = m => {
    if (group === 'month') return m.date.slice(0,7);
    const d = m.date; const y = parseInt(d.slice(0,4)); const mo = parseInt(d.slice(5,7));
    const sy = mo >= 9 ? y : y - 1;
    return `${sy}-${sy+1}`;
  };

  // Filtre pôle
  const poleFilterFn = m => {
    if (!_poleId) return true;
    const co = coMap[m.companyId];
    if (!co) return false;
    if (co.role === 'own') return co.id === _poleId;
    if (co.poleId) return co.poleId === _poleId;
    const pole = coMap[_poleId];
    return pole ? (pole.defaultBillingRate===35 ? m.billingRate===35 : m.billingRate!==35) : true;
  };
  let missions = allMissions.filter(poleFilterFn);

  // Filtre école (si __none__ ou companyId set)
  const noSchools = _companyId === '__none__';
  if (_companyId && !noSchools) missions = missions.filter(m => m.companyId === _companyId);

  let datasets = [];
  const COLORS = ['#3b82f6','#f97316','#10b981','#8b5cf6','#ef4444','#06b6d4','#f59e0b','#84cc16'];

  if (!noSchools) {
    const makePoleDataset = (pole, i) => {
      const data = labels.map(lbl => {
        const ms = missions.filter(m => {
          if (missionKey(m) !== lbl) return false;
          const school = coMap[m.companyId];
          if (school?.poleId) return school.poleId === pole.id;
          return pole.defaultBillingRate === 35 ? m.billingRate === 35 : m.billingRate !== 35;
        });
        return Math.round(ms.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0)*100)/100;
      });
      return { label: pole.name, data, backgroundColor: (pole.color||COLORS[i])+'99', borderColor: pole.color||COLORS[i], borderWidth:2, fill: ctype==='line' };
    };

    if (split === 'poles') {
      ownCos.forEach((pole, i) => datasets.push(makePoleDataset(pole, i)));
    } else if (split === 'schools') {
      const schools = Data.getClientSchools().filter(co => {
        if (!_poleId) return true;
        if (co.poleId) return co.poleId === _poleId;
        const pole = coMap[_poleId];
        return pole ? (pole.defaultBillingRate === 35 ? co.defaultBillingRate === 35 : co.defaultBillingRate !== 35) : true;
      });
      schools.forEach((co, i) => {
        const data = labels.map(lbl =>
          Math.round(missions.filter(m => m.companyId===co.id && missionKey(m)===lbl)
            .reduce((s,m) => s+(m.duration||0)*(m.billingRate||0),0)*100)/100
        );
        if (data.every(v=>v===0)) return;
        datasets.push({ label: co.name, data, backgroundColor: (co.color||COLORS[i%COLORS.length])+'99', borderColor: co.color||COLORS[i%COLORS.length], borderWidth:2, fill:false });
      });
    } else {
      // split = ID d'un pôle spécifique
      const pole = ownCos.find(p => p.id === split);
      if (pole) datasets.push(makePoleDataset(pole, ownCos.indexOf(pole)));
    }
  }

  // Datasets prestataires sélectionnés — filtrés aussi par pôle
  if (_providerIds.length > 0) {
    const allProvM = allMissions.filter(m => _providerIds.includes(m.providerId) && poleFilterFn(m));
    const costData = labels.map(lbl => Math.round(allProvM.filter(m=>missionKey(m)===lbl).reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0)*100)/100);
    const revData  = labels.map(lbl => Math.round(allProvM.filter(m=>missionKey(m)===lbl).reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0)*100)/100);
    datasets.push({ label: 'Sorties prestataires', data: costData, backgroundColor: '#ef444460', borderColor: '#ef4444', borderWidth:2, borderDash:[5,3], fill:false });
    datasets.push({ label: 'Entrées (via prestataires)', data: revData, backgroundColor: '#10b98160', borderColor: '#10b981', borderWidth:2, borderDash:[5,3], fill:false });
  }

  // Libellés lisibles
  const MONTHS_ABBR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const readableLabels = labels.map(lbl => {
    if (group === 'month') {
      const [y,m] = lbl.split('-');
      return `${MONTHS_ABBR[+m-1]} ${y}`;
    }
    return `AS ${lbl}`;
  });

  const ctx = document.getElementById('fin-chart').getContext('2d');
  if (_chartInstance) _chartInstance.destroy();
  _chartInstance = new Chart(ctx, {
    type: ctype,
    data: { labels: readableLabels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: {
        label: ctx => `${ctx.dataset.label}: ${Utils.formatMoney(ctx.parsed.y)}`
      }}},
      scales: { y: { ticks: { callback: v => Utils.formatMoney(v) }, beginAtZero: true } }
    }
  });
}
