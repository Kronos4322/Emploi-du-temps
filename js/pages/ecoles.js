// ecoles.js — Gestion des sociétés / structures
'use strict';

function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  document.getElementById('btn-new-school').addEventListener('click', () =>
    Modals.openCompany(null));
});

function render() {
  const allMissions   = Data.getMissions();
  const ownCompanies  = Data.getOwnCompanies();
  const clientSchools = Data.getClientSchools();
  const allStudents   = Data.getStudents();
  const allProviders  = Data.getProviders();
  const container     = document.getElementById('schools-grid');

  if (ownCompanies.length === 0 && clientSchools.length === 0) {
    container.innerHTML = `<div class="empty-page">
      <div class="empty-icon">🏢</div><h2>Aucune structure enregistrée</h2>
      <button class="btn btn-primary" onclick="Modals.openCompany()">+ Ajouter</button>
    </div>`;
    return;
  }

  let html = '';

  // ── Une section hiérarchique par société propre ──────────────
  ownCompanies.forEach(own => {
    const color = own.color || '#3b82f6';
    const schools      = clientSchools.filter(c => c.poleId === own.id && (c.category||'school') === 'school');
    const institutions = clientSchools.filter(c => c.poleId === own.id && c.category === 'institution');
    const provs        = allProviders.filter(p => p.poleId === own.id);
    const studs        = allStudents.filter(s => (s.poleId || s.companyId) === own.id);

    html += `<details class="section-block" style="border-left:4px solid ${color};padding-left:12px;margin-bottom:32px" open>
      <summary class="section-block-header" style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h2 class="section-block-title" style="color:${color};margin:0">🏛 ${Utils.escapeHtml(own.name)}</h2>
        <button class="btn btn-sm btn-ghost" onclick="event.preventDefault();event.stopPropagation();Modals.openCompany('${own.id}')">✎ Modifier</button>
      </summary>
      <div class="cards-grid-inner" style="margin-bottom:12px">${companyCard(own, allMissions)}</div>`;

    html += `<details class="subsection-block" open><summary class="subsection-header" style="cursor:pointer;list-style:none">🏫 Écoles (${schools.length}) <button class="btn btn-xs btn-ghost" onclick="event.preventDefault();event.stopPropagation();Modals.openCompany(null)">+ Ajouter</button></summary>
      ${schools.length ? `<div class="cards-grid-inner">${schools.map(c => companyCard(c, allMissions)).join('')}</div>` : '<p class="empty-state-sm">Aucune école rattachée</p>'}
    </details>`;

    html += `<details class="subsection-block" open><summary class="subsection-header" style="cursor:pointer;list-style:none">🏛 Institutions (${institutions.length}) <button class="btn btn-xs btn-ghost" onclick="event.preventDefault();event.stopPropagation();Modals.openCompany(null)">+ Ajouter</button></summary>
      ${institutions.length ? `<div class="cards-grid-inner">${institutions.map(c => companyCard(c, allMissions)).join('')}</div>` : '<p class="empty-state-sm">Aucune institution rattachée</p>'}
    </details>`;

    html += `<details class="subsection-block" open><summary class="subsection-header" style="cursor:pointer;list-style:none">🎓 Apprenants (${studs.length}) <a href="etudiants.html" class="btn btn-xs btn-ghost" onclick="event.stopPropagation()">Voir tous →</a></summary>
      ${studs.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${studs.map(s=>`<span class="badge badge-planned" style="cursor:pointer" onclick="Modals.openStudent('${s.id}')">${Utils.escapeHtml(s.lastName+' '+s.firstName)}</span>`).join('')}</div>` : '<p class="empty-state-sm">Aucun apprenant rattaché</p>'}
    </details>`;

    html += `<details class="subsection-block" open><summary class="subsection-header" style="cursor:pointer;list-style:none">👤 Prestataires (${provs.length}) <a href="prestataires.html" class="btn btn-xs btn-ghost" onclick="event.stopPropagation()">Voir tous →</a></summary>
      ${provs.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${provs.map(p=>`<span class="badge badge-done" style="cursor:pointer" onclick="Modals.openProvider('${p.id}')">${Utils.escapeHtml(p.lastName+' '+p.firstName)}</span>`).join('')}</div>` : '<p class="empty-state-sm">Aucun prestataire rattaché</p>'}
    </details>`;

    html += `</details>`;
  });

  // ── Non rattachées ───────────────────────────────────────────
  const unlinked = clientSchools.filter(c => !c.poleId);
  if (unlinked.length > 0) {
    html += `<div class="section-block" style="border-left:4px solid #94a3b8;padding-left:12px">
      <div class="section-block-header">
        <h2 class="section-block-title" style="color:#94a3b8">⚠ Non rattachées (${unlinked.length})</h2>
        <span style="font-size:0.8rem;color:var(--text-muted)">Cliquez pour assigner à une société</span>
      </div>
      <div class="cards-grid-inner">${unlinked.map(c => companyCard(c, allMissions)).join('')}</div>
    </div>`;
  }

  container.innerHTML = html;
}

function companyCard(co, allMissions) {
  let missions;
  if (co.role === 'own') {
    const allCos = {}; Data.getCompanies().forEach(c => allCos[c.id] = c);
    missions = allMissions.filter(m => {
      const school = allCos[m.companyId];
      if (school?.poleId) return school.poleId === co.id;
      return false; // société sans poleId → exclure du filtre par pôle
    });
  } else {
    missions = allMissions.filter(m => m.companyId === co.id);
  }
  const done      = missions.filter(m => m.status === 'done');
  const planned   = missions.filter(m => m.status === 'planned');
  const currentMonth = Utils.currentYearMonth();
  const monthMissions = missions.filter(m => m.date && m.date.startsWith(currentMonth));
  // Pour les sociétés propres, montrer le total de tous les contrats (réalisés + prévus)
  const totalHours   = co.role === 'own'
    ? missions.reduce((s, m) => s + (m.duration||0), 0)
    : done.reduce((s, m) => s + (m.duration||0), 0);
  const totalRevenue = co.role === 'own'
    ? missions.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0)
    : done.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const monthRevenue = monthMissions.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0);

  const providerLinks = Data.getProviderLinksByCompany(co.id);
  const providerCount = new Set(providerLinks.map(l => l.providerId)).size;
  const typeLabel     = Utils.COMPANY_TYPES[co.type] || co.type || '';
  const textColor     = Utils.contrastColor(co.color);
  const roleLabel     = Utils.COMPANY_ROLES[co.role] || '';

  return `<div class="school-card" onclick="Modals.openCompany('${co.id}')">
    <div class="school-card-header" style="background:${co.color};color:${textColor}">
      <div class="school-color-dot" style="background:${co.color};border:2px solid ${textColor}40"></div>
      <div class="school-card-title">
        <h3>${Utils.escapeHtml(co.name)}</h3>
        ${typeLabel ? `<span class="school-contact">${Utils.escapeHtml(typeLabel)}</span>` : ''}
        ${co.contact ? `<span class="school-contact">${Utils.escapeHtml(co.contact)}</span>` : ''}
      </div>
      <button class="btn-edit-school" style="color:${textColor}" onclick="event.stopPropagation();Modals.openCompany('${co.id}')">✎</button>
    </div>
    <div class="school-card-body">
      ${co.address ? `<div class="school-info-row">📍 ${Utils.escapeHtml(co.address)}</div>` : ''}
      ${co.email   ? `<div class="school-info-row">✉ ${Utils.escapeHtml(co.email)}</div>` : ''}
      ${co.defaultBillingRate ? `<div class="school-info-row">💶 Tarif : ${Utils.formatMoney(co.defaultBillingRate)}/h</div>` : ''}
      ${co.notes   ? `<div class="school-info-row school-notes">${Utils.escapeHtml(co.notes)}</div>` : ''}
      ${(co.subjectIds||[]).length > 0 ? (()=>{ const allSubj=Data.getSubjects(); return `<div class="school-info-row" style="flex-wrap:wrap;gap:4px;display:flex">${co.subjectIds.map(sid=>{ const subj=allSubj.find(s=>s.id===sid); return subj?`<span class="school-tag" style="font-size:0.72rem;padding:1px 6px;background:${subj.color||'var(--surface)'};color:${subj.color?'#fff':'inherit'};border:1px solid var(--border)">${Utils.escapeHtml(subj.name)}</span>`:''; }).filter(Boolean).join('')}</div>`; })() : ''}
      <div class="school-stats">
        <div class="school-stat">
          <div class="school-stat-value">${missions.length}</div>
          <div class="school-stat-label">Total missions</div>
        </div>
        <div class="school-stat">
          <div class="school-stat-value">${planned.length}</div>
          <div class="school-stat-label">Prévues</div>
        </div>
        <div class="school-stat">
          <div class="school-stat-value">${providerCount}</div>
          <div class="school-stat-label">Prestataires</div>
        </div>
        <div class="school-stat">
          <div class="school-stat-value" style="color:${co.color}">${Utils.formatMoney(monthRevenue)}</div>
          <div class="school-stat-label">Ce mois</div>
        </div>
        <div class="school-stat">
          <div class="school-stat-value">${Utils.formatDuration(totalHours)}</div>
          <div class="school-stat-label">Heures total</div>
        </div>
        <div class="school-stat">
          <div class="school-stat-value">${Utils.formatMoney(totalRevenue)}</div>
          <div class="school-stat-label">CA total</div>
        </div>
      </div>
    </div>
  </div>`;
}
