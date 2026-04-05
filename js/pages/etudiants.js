// etudiants.js — Gestion des étudiants (module Artémis)
'use strict';

const filters = { search: '', companyId: '', formationId: '', status: '' };
let searchTimeout = null;

function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilters();
  render();

  document.getElementById('btn-new-student').addEventListener('click', () =>
    Modals.openStudent(null));

  document.getElementById('filter-search').addEventListener('input', e => {
    filters.search = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(render, 200);
  });
  document.getElementById('filter-company').addEventListener('change',   e => { filters.companyId   = e.target.value; render(); });
  document.getElementById('filter-formation').addEventListener('change', e => { filters.formationId  = e.target.value; render(); });
  document.getElementById('filter-status').addEventListener('change',    e => { filters.status       = e.target.value; render(); });
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    filters.search = ''; filters.companyId = ''; filters.formationId = ''; filters.status = '';
    document.getElementById('filter-search').value    = '';
    document.getElementById('filter-company').value   = '';
    document.getElementById('filter-formation').value = '';
    document.getElementById('filter-status').value    = '';
    render();
  });
});

function buildFilters() {
  const companies  = Data.getOwnCompanies();
  const formations = Data.getFormations();

  document.getElementById('filter-company').innerHTML =
    '<option value="">Tous les pôles</option>' +
    companies.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');

  document.getElementById('filter-formation').innerHTML =
    '<option value="">Toutes les formations</option>' +
    formations.map(f => `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`).join('');
}

function getFiltered() {
  let students = Data.getStudents();
  if (filters.companyId)   students = students.filter(s => s.companyId === filters.companyId);
  if (filters.formationId) students = students.filter(s => (s.formationIds||[]).includes(filters.formationId));
  if (filters.status)      students = students.filter(s => s.status === filters.status);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    students = students.filter(s =>
      (s.firstName||'').toLowerCase().includes(q) ||
      (s.lastName||'').toLowerCase().includes(q)  ||
      (s.email||'').toLowerCase().includes(q)     ||
      (s.notes||'').toLowerCase().includes(q));
  }
  return students;
}

function render() {
  const filtered   = getFiltered();
  const companies  = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const formations = {}; Data.getFormations().forEach(f => formations[f.id] = f);
  const providers  = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled');

  const active   = filtered.filter(s => s.status === 'active').length;
  const inactive = filtered.filter(s => s.status === 'inactive').length;
  document.getElementById('list-summary').textContent =
    `${filtered.length} étudiant${filtered.length > 1 ? 's' : ''} · ${active} actif${active > 1 ? 's' : ''} · ${inactive} inactif${inactive > 1 ? 's' : ''}`;

  const grid = document.getElementById('students-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-page">
      <div class="empty-icon">🎓</div>
      <h2>Aucun étudiant trouvé</h2>
      <p>Ajoutez des étudiants pour les associer aux formations Artémis.</p>
      <button class="btn btn-primary" onclick="Modals.openStudent()">+ Ajouter un étudiant</button>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => studentCard(s, companies, formations, providers, allMissions)).join('');
}

window._exportStudent = function(studentId, month) {
  const s = Data.getStudents().find(x => x.id === studentId); if (!s) return;
  const subjects = {}; (Data.getSubjects()||[]).forEach(x => subjects[x.id] = x);
  const providers = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const missions = Data.getMissions().filter(m =>
    (m.studentIds||[]).includes(studentId) && m.status !== 'cancelled' &&
    (!month || (m.date && m.date.startsWith(month)))
  ).sort((a,b) => a.date.localeCompare(b.date));
  const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const rows = [['Date','Jour','Heure début','Heure fin','Durée (h)','Matière','Prestataire','Tarif facturation (€/h)','Total facturé (€)']];
  missions.forEach(m => {
    const d = new Date(m.date + 'T00:00:00');
    const prov = providers[m.providerId];
    const subj = m.subjectId ? (subjects[m.subjectId]?.name || m.subject || '') : (m.subject || m.title || '');
    const dur = m.duration || 0;
    const bRate = m.billingRate || 0;
    rows.push([m.date, DAYS[d.getDay()], m.startTime||'', m.endTime||'', dur.toFixed(2), subj, prov ? prov.firstName+' '+prov.lastName : '', bRate.toFixed(2), (dur*bRate).toFixed(2)]);
  });
  const total = missions.reduce((a,m)=>a+(m.duration||0)*(m.billingRate||0),0);
  rows.push(['','','','','','','','TOTAL',total.toFixed(2)]);
  _downloadCSV(rows, `cours_${s.lastName}_${month||'complet'}.csv`);
}

const LEVEL_LABELS = { college:'Collège', lycee:'Lycée', superieur:'Supérieur' };
const LEVEL_RATE   = { college:'rateCollege', lycee:'rateLycee', superieur:'rateSup' };

function studentCard(s, companies, formations, providers, allMissions) {
  const co       = companies[s.poleId || s.companyId];
  const color    = co ? co.color : '#3b82f6';
  const initials = ((s.firstName||'')[0]||'?') + ((s.lastName||'')[0]||'');
  const formTags = (s.formationIds||[]).map(fid => {
    const f = formations[fid];
    return f ? `<span class="student-formation-tag">${Utils.escapeHtml(f.name)}</span>` : '';
  }).filter(Boolean).join('');
  const STATUS_LABELS = { active: ['Actif','badge-done'], inactive: ['Inactif','badge-cancelled'], pending: ['En attente','badge-warning'] };
  const [statusLabel, statusClass] = STATUS_LABELS[s.status] || [s.status, ''];

  // Missions liées à cet étudiant (via studentIds)
  const sMissions = allMissions.filter(m => (m.studentIds||[]).includes(s.id));
  const totalH    = sMissions.reduce((a,m) => a+(m.duration||0), 0);
  const totalRev  = sMissions.reduce((a,m) => a+(m.duration||0)*(m.billingRate||0), 0);

  // Prestataires impliqués
  const provIds   = [...new Set(sMissions.map(m=>m.providerId).filter(Boolean))];
  const provStats = provIds.map(pid => {
    const p    = providers[pid]; if (!p) return '';
    const pMs  = sMissions.filter(m => m.providerId === pid);
    const rateKey = LEVEL_RATE[s.level];
    const rate  = (rateKey && p[rateKey]) || p.defaultHourlyRate || 0;
    const cost  = pMs.reduce((a,m) => a+(m.duration||0)*rate, 0);
    const rev   = pMs.reduce((a,m) => a+(m.duration||0)*(m.billingRate||0), 0);
    return `<div style="font-size:0.8rem;margin-top:4px;color:var(--text)">
      <strong>${Utils.escapeHtml(p.lastName+' '+p.firstName)}</strong>
      <span style="color:var(--danger);margin-left:6px">Coût: ${Utils.formatMoney(cost)}</span>
      <span style="color:var(--success);margin-left:6px">Facturé: ${Utils.formatMoney(rev)}</span>
      <span style="color:var(--text-muted);margin-left:6px">Marge: ${Utils.formatMoney(rev-cost)}</span>
    </div>`;
  }).join('');

  return `<div class="student-card" onclick="Modals.openStudent('${s.id}')">
    <div class="student-avatar" style="background:${color}">${initials.toUpperCase()}</div>
    <div class="student-info">
      <div class="student-name">${Utils.escapeHtml(s.firstName + ' ' + s.lastName)}</div>
      <div class="student-meta">
        ${co ? `<span style="color:${color};font-weight:600">${Utils.escapeHtml(co.name)}</span> · ` : ''}
        <span class="badge ${statusClass}" style="font-size:0.7rem">${statusLabel}</span>
        ${s.level ? `<span style="margin-left:6px;font-size:0.75rem;color:var(--text-muted)">${LEVEL_LABELS[s.level]||''}</span>` : ''}
      </div>
      ${formTags ? `<div class="student-formations">${formTags}</div>` : ''}
      ${s.notes ? `<div class="student-meta" style="margin-top:4px;font-style:italic">${Utils.escapeHtml(s.notes)}</div>` : ''}
    </div>
    <div style="min-width:200px;text-align:right;padding-left:16px;border-left:1px solid var(--border)">
      <div style="font-size:0.85rem;font-weight:700">${Utils.formatDuration(totalH)} total</div>
      <div style="font-size:0.8rem;color:var(--success)">${Utils.formatMoney(totalRev)} facturé</div>
      ${provStats || '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">Aucun prestataire</div>'}
      <div style="position:relative;display:inline-block;margin-top:8px" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="window._toggleMenu('smenu-${s.id}')">⋯ Exporter</button>
        <div id="smenu-${s.id}" style="display:none;position:absolute;right:0;top:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);z-index:50;min-width:200px;padding:4px">
          <div style="padding:6px 10px;font-size:0.75rem;color:var(--text-muted);border-bottom:1px solid var(--border);margin-bottom:4px">Exporter les cours</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;padding:6px 10px" onclick="_exportStudent('${s.id}','${Utils.currentYearMonth()}')">📥 Ce mois</button>
          <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;padding:6px 10px" onclick="_exportStudent('${s.id}','')">📥 Tout l'historique</button>
        </div>
      </div>
    </div>
  </div>`;
}
