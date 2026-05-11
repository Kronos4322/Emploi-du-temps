// formations.js — Gestion des formations (DIFE, certifications, ateliers...)
'use strict';

const filters = { search: '', companyId: '', status: '' };
let searchTimeout = null;

function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilters();
  render();

  document.getElementById('btn-new-formation').addEventListener('click', () =>
    Modals.openFormation(null));

  document.getElementById('filter-search').addEventListener('input', e => {
    filters.search = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(render, 200);
  });
  document.getElementById('filter-company').addEventListener('change', e => { filters.companyId = e.target.value; render(); });
  document.getElementById('filter-status').addEventListener('change',  e => { filters.status    = e.target.value; render(); });
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    filters.search = ''; filters.companyId = ''; filters.status = '';
    document.getElementById('filter-search').value  = '';
    document.getElementById('filter-company').value = '';
    document.getElementById('filter-status').value  = '';
    render();
  });
});

function buildFilters() {
  const companies = Data.getCompanies();
  document.getElementById('filter-company').innerHTML =
    '<option value="">Toutes les sociétés</option>' +
    companies.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
}

function getFiltered() {
  let formations = Data.getFormations();
  if (filters.companyId) formations = formations.filter(f => f.companyId === filters.companyId);
  if (filters.status)    formations = formations.filter(f => f.status    === filters.status);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    formations = formations.filter(f =>
      (f.name||'').toLowerCase().includes(q) ||
      (f.type||'').toLowerCase().includes(q) ||
      (f.notes||'').toLowerCase().includes(q));
  }
  return formations;
}

function render() {
  const filtered   = getFiltered();
  const companies  = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const providers  = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const students   = {}; Data.getStudents().forEach(s => students[s.id] = s);

  const totalH = filtered.reduce((s, f) => s + (f.totalHours||0), 0);
  const allMissions = Data.getMissions(); // hissé hors du reduce pour éviter N+1
  const filteredIds = new Set(filtered.map(f => f.id));
  const doneH  = allMissions
    .filter(m => m.status === 'done' && filteredIds.has(m.formationId))
    .reduce((s, m) => s + (m.duration||0), 0);
  document.getElementById('list-summary').textContent =
    `${filtered.length} formation${filtered.length > 1 ? 's' : ''} · ${doneH}h réalisées / ${totalH}h prévues`;

  const grid = document.getElementById('formations-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-page">
      <div class="empty-icon">📚</div>
      <h2>Aucune formation trouvée</h2>
      <p>Créez des formations pour suivre vos programmes (DIFE, certifications, ateliers…).</p>
      <button class="btn btn-primary" onclick="Modals.openFormation()">+ Créer une formation</button>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(f => formationCard(f, companies, providers, students)).join('');
}

function formationCard(f, companies, providers, students) {
  const co      = companies[f.companyId];
  const color   = co ? co.color : '#3b82f6';
  const statusLabel = Utils.getFormationStatusLabel(f.status);
  const statusClass = Utils.getFormationStatusClass(f.status);

  const provNames = (f.providerIds||[]).map(pid => {
    const p = providers[pid];
    return p ? Utils.escapeHtml(p.firstName + ' ' + p.lastName) : '';
  }).filter(Boolean).join(', ');

  const stuCount = (f.studentIds||[]).length;

  // Missions liées à cette formation (déclarées avant utilisation)
  const linkedMissions = Data.getMissions().filter(m => m.formationId === f.id);
  const doneMissions   = linkedMissions.filter(m => m.status === 'done');
  const realHours      = doneMissions.reduce((s, m) => s + (m.duration||0), 0);
  const pct            = f.totalHours > 0 ? Math.round(realHours / f.totalHours * 100) : 0;

  return `<div class="formation-card" onclick="Modals.openFormation('${f.id}')">
    <div class="formation-card-header">
      <div>
        <div class="formation-card-title">${Utils.escapeHtml(f.name)}</div>
        <div class="formation-card-company">
          ${co ? `<span style="color:${color};font-weight:600">${Utils.escapeHtml(co.name)}</span>` : ''}
          ${f.type ? ` · <span class="company-type-badge">${Utils.escapeHtml(f.type)}</span>` : ''}
        </div>
      </div>
      <span class="badge ${statusClass}">${statusLabel}</span>
    </div>
    <div class="formation-card-body">
      <div class="formation-progress">
        <div class="formation-progress-label">
          <span>${Utils.formatDuration(realHours)} réalisées</span>
          <span>${pct}% / ${f.totalHours}h</span>
        </div>
        <div class="formation-progress-bar-bg">
          <div class="formation-progress-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>

      <div class="formation-stats">
        <div class="formation-stat">
          <div class="formation-stat-value">${f.totalHours}h</div>
          <div class="formation-stat-label">Volume total</div>
        </div>
        <div class="formation-stat">
          <div class="formation-stat-value">${linkedMissions.length}</div>
          <div class="formation-stat-label">Séances</div>
        </div>
        <div class="formation-stat">
          <div class="formation-stat-value" style="color:${color}">${Utils.formatDuration(realHours)}</div>
          <div class="formation-stat-label">Heures réelles</div>
        </div>
        <div class="formation-stat">
          <div class="formation-stat-value">${stuCount}</div>
          <div class="formation-stat-label">Étudiant${stuCount > 1 ? 's' : ''}</div>
        </div>
      </div>

      ${f.startDate ? `<div class="school-info-row" style="margin-top:8px;font-size:0.8rem">
        📅 ${Utils.formatDate(f.startDate)}${f.endDate ? ` → ${Utils.formatDate(f.endDate)}` : ''}
      </div>` : ''}
      ${provNames ? `<div class="school-info-row" style="font-size:0.8rem">👤 ${provNames}</div>` : ''}
      ${f.notes ? `<div class="school-info-row school-notes" style="font-size:0.8rem">${Utils.escapeHtml(f.notes)}</div>` : ''}
      <button class="btn btn-sm btn-ghost" style="width:100%;margin-top:10px"
        onclick="event.stopPropagation();Modals.openMission(null,null,renderPage,{companyId:'${f.companyId}',formationId:'${f.id}',studentIds:${JSON.stringify(f.studentIds||[])}})">
        + Nouvelle séance
      </button>
    </div>
  </div>`;
}
