// cours.js — Liste des missions avec filtres avancés
'use strict';

const filters = {
  search: '', yearMonth: Utils.currentYearMonth(),
  companyId: '', providerId: '', missionType: '', status: '', paymentStatus: ''
};
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilterOptions();
  render();

  document.getElementById('btn-new-course').addEventListener('click', () =>
    Modals.openMission(null, null, () => { buildFilterOptions(); render(); }));

  document.getElementById('filter-search').addEventListener('input', e => {
    filters.search = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(render, 200);
  });
  document.getElementById('filter-month').addEventListener('change',   e => { filters.yearMonth    = e.target.value; render(); });
  document.getElementById('filter-company').addEventListener('change', e => { filters.companyId    = e.target.value; render(); });
  document.getElementById('filter-provider').addEventListener('change',e => { filters.providerId   = e.target.value; render(); });
  document.getElementById('filter-mtype').addEventListener('change',   e => { filters.missionType  = e.target.value; render(); });
  document.getElementById('filter-status').addEventListener('change',  e => { filters.status       = e.target.value; render(); });
  document.getElementById('filter-payment').addEventListener('change', e => { filters.paymentStatus= e.target.value; render(); });
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    filters.search = ''; filters.yearMonth = Utils.currentYearMonth();
    filters.companyId = ''; filters.providerId = ''; filters.missionType = '';
    filters.status = ''; filters.paymentStatus = '';
    document.getElementById('filter-search').value   = '';
    document.getElementById('filter-month').value    = filters.yearMonth;
    document.getElementById('filter-company').value  = '';
    document.getElementById('filter-provider').value = '';
    document.getElementById('filter-mtype').value    = '';
    document.getElementById('filter-status').value   = '';
    document.getElementById('filter-payment').value  = '';
    render();
  });
});

function buildFilterOptions() {
  const months    = Utils.getRecentMonths(24);
  const companies = Data.getCompanies();
  const providers = Data.getProviders();

  document.getElementById('filter-month').innerHTML =
    '<option value="">Tous les mois</option>' +
    months.map(ym => {
      const [y, m] = ym.split('-');
      return `<option value="${ym}" ${filters.yearMonth === ym ? 'selected' : ''}>${Utils.MONTHS_LONG[+m-1]} ${y}</option>`;
    }).join('');

  document.getElementById('filter-company').innerHTML =
    '<option value="">Toutes les sociétés</option>' +
    companies.map(c => `<option value="${c.id}" ${filters.companyId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('');

  document.getElementById('filter-provider').innerHTML =
    '<option value="">Tous les prestataires</option>' +
    providers.map(p => `<option value="${p.id}" ${filters.providerId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}</option>`).join('');

  document.getElementById('filter-mtype').innerHTML =
    '<option value="">Tous les types</option>' +
    Object.entries(Utils.MISSION_TYPES).map(([k, v]) =>
      `<option value="${k}" ${filters.missionType === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
    ).join('');
}

// Expose renderPage for modals callback
function renderPage() { buildFilterOptions(); render(); }

function getFiltered() {
  let missions = Data.getMissionsSorted();
  if (filters.yearMonth)    missions = missions.filter(m => m.date && m.date.startsWith(filters.yearMonth));
  if (filters.companyId)    missions = missions.filter(m => m.companyId   === filters.companyId);
  if (filters.providerId)   missions = missions.filter(m => m.providerId  === filters.providerId);
  if (filters.missionType)  missions = missions.filter(m => m.missionType === filters.missionType);
  if (filters.status)       missions = missions.filter(m => m.status       === filters.status);
  if (filters.paymentStatus)missions = missions.filter(m => m.paymentStatus=== filters.paymentStatus);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    missions = missions.filter(m =>
      (m.title||'').toLowerCase().includes(q) || (m.subject||'').toLowerCase().includes(q) ||
      (m.location||'').toLowerCase().includes(q) || (m.notes||'').toLowerCase().includes(q));
  }
  return missions;
}

const STATUS_BADGES = {
  planned:   '<span class="badge badge-planned">Prévu</span>',
  done:      '<span class="badge badge-done">Réalisé</span>',
  cancelled: '<span class="badge badge-cancelled">Annulé</span>',
  postponed: '<span class="badge badge-warning">Reporté</span>',
  moved:     '<span class="badge badge-warning">Déplacé</span>'
};
const PAYMENT_BADGES = {
  unpaid:   '<span class="badge badge-danger">Non payé</span>',
  invoiced: '<span class="badge badge-invoiced">Facturé</span>',
  paid:     '<span class="badge badge-success">Payé</span>'
};

function render() {
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const providers = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const filtered  = getFiltered();

  const totalHours   = filtered.reduce((s, m) => s + (m.duration||0), 0);
  const totalRevenue = filtered.filter(m => m.status === 'done').reduce((s, m) => s + (m.duration||0) * (m.billingRate||0), 0);
  document.getElementById('list-summary').textContent =
    `${filtered.length} mission${filtered.length > 1 ? 's' : ''} · ${Utils.formatDuration(totalHours)} au total · ${Utils.formatMoney(totalRevenue)} réalisé`;

  const tbody = document.getElementById('courses-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="empty-state-cell">Aucune mission trouvée.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const co       = companies[m.companyId];
    const provider = providers[m.providerId];
    const color    = co ? co.color : '#94a3b8';
    const revenue  = (m.duration||0) * (m.billingRate||0);
    const cost     = m.providerId ? (m.duration||0) * (m.providerRate||0) : null;
    const typeInfo = Utils.MISSION_TYPES[m.missionType] || { label: m.missionType || '—', icon: '📌' };
    return `<tr class="table-row${m.status==='cancelled'?' row-cancelled':''}"
                onclick="Modals.openMission('${m.id}',null,()=>{buildFilterOptions();render();})">
      <td class="cell-date">${Utils.formatDate(m.date)}</td>
      <td class="cell-title">
        <div class="title-with-dot">
          <span class="school-dot" style="background:${color}"></span>
          <span>${Utils.escapeHtml(m.title)}</span>
          ${m.type==='visio'?'<span class="badge badge-visio badge-sm">Visio</span>':''}
          ${m.recurringGroupId?'<span class="badge badge-recurring badge-sm" title="Récurrent">↺</span>':''}
        </div>
        ${m.subject?`<div class="cell-subtitle">${Utils.escapeHtml(m.subject)}${m.level?' · '+Utils.escapeHtml(m.level):''}</div>`:''}
      </td>
      <td><span class="mission-type-pill">${typeInfo.icon} ${typeInfo.label}</span></td>
      <td>${co?`<span class="school-tag" style="background:${Utils.lightenColor(color)};color:${color};border:1px solid ${color}">${Utils.escapeHtml(co.name)}</span>`:'—'}</td>
      <td class="cell-time">${m.startTime} – ${m.endTime}</td>
      <td class="cell-center">${Utils.formatDuration(m.duration)}</td>
      <td>${STATUS_BADGES[m.status]||m.status}</td>
      <td>${PAYMENT_BADGES[m.paymentStatus]||m.paymentStatus}</td>
      <td class="cell-money">${m.status!=='cancelled'?Utils.formatMoney(revenue):'—'}</td>
      <td class="cell-provider">${provider?Utils.escapeHtml(provider.lastName+' '+provider.firstName):'—'}</td>
      <td class="cell-money cell-cost">${cost!==null?Utils.formatMoney(cost):'—'}</td>
      <td class="cell-actions" onclick="event.stopPropagation()">
        <button class="btn-icon-sm btn-icon-danger" onclick="deleteMission('${m.id}')" title="Supprimer">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function deleteMission(id) {
  Modals.confirm('Supprimer cette mission définitivement ?', () => {
    Data.deleteMission(id);
    Utils.toast('Mission supprimée.', 'success');
    render();
  });
}
