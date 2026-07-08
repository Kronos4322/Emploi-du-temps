// prestataires.js — Prestataires avec liaisons multi-sociétés
'use strict';

const _excluded = new Set(); // IDs prestataires exclus du récap
let _provMonth = Utils.currentYearMonth(); // mois sélectionné pour les stats
function toggleProvider(id) { _excluded.has(id) ? _excluded.delete(id) : _excluded.add(id); render(); }
function renderPage() { render(); }

// ── Dossier intervenant — documents & statuts ────────────────────
const PDOCS = [
  {k:'cv',          l:'CV / Portfolio'},
  {k:'syllabus',    l:'Syllabus de cours'},
  {k:'fiche_int',   l:'Fiche intervenant'},
  {k:'charte',      l:'Charte Qualiopi'},
  {k:'contrat',     l:"Contrat d'engagement"},
  {k:'diplomes',    l:'Diplômes / certifications'},
  {k:'competences', l:'Référentiel de compétences'},
  {k:'plan_dev',    l:'Plan de développement'},
];
const PDOCS_TEMPLATES = {
  syllabus:    [{label:'Modèle syllabus',   file:'modele_syllabus.docx'}],
  fiche_int:   [{label:'Fiche intervenant', file:'fiche_intervenant.docx'}],
  charte:      [{label:'Charte Qualiopi',   file:'charte_qualiopi_intervenant.docx'}],
  contrat:     [{label:"Contrat d'engagement", file:'contrat_engagement_intervenant.docx'}],
  competences: [{label:'Référentiel',       file:'referentiel_competences.docx'}],
  plan_dev:    [{label:'Plan compétences',  file:'plan_developpement_competences.docx'}],
};
const PDS = ['non_recu','demande','recu','valide','archive'];
const PDL = {non_recu:'Non reçu', demande:'Demandé', recu:'Reçu', valide:'Validé', archive:'Archivé'};
const PDC = {non_recu:'#94a3b8', demande:'#f59e0b', recu:'#3b82f6', valide:'#22c55e', archive:'#22c55e'};

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  document.getElementById('btn-new-provider').addEventListener('click', () =>
    Modals.openProvider(null));
  // Cycling statuts dossier intervenant
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action="p-doc"]');
    if (!t) return;
    e.stopPropagation();
    const p = Data.getProviderById(t.dataset.id); if (!p) return;
    const docs = {...(p.pDocs||{})};
    docs[t.dataset.key] = PDS[(PDS.indexOf(docs[t.dataset.key]||'non_recu')+1) % PDS.length];
    Data.saveProvider({...p, pDocs: docs});
    render();
  });
});

function render() {
  const providers   = Data.getProviders();
  // Cohérence globale : réalisé/prévu uniquement, hors événements personnels
  const allMissions = Data.getMissions().filter(m =>
    (m.status === 'done' || m.status === 'planned') && m.missionType !== 'personal');
  const allMissionsWithProv = allMissions.filter(m => m.providerId || m.providerIds?.length);
  const list        = document.getElementById('providers-list');

  if (providers.length === 0) {
    list.innerHTML = `<div class="empty-page">
      <div class="empty-icon">👤</div>
      <h2>Aucun prestataire enregistré</h2>
      <p>Ajoutez des intervenants pour les associer à vos missions et suivre leurs coûts.</p>
      <button class="btn btn-primary" onclick="Modals.openProvider()">+ Ajouter un prestataire</button>
    </div>`;
    return;
  }

  // ── Barre de filtre + sélecteur de mois ───────────────────
  let filterBar = document.getElementById('prov-filter-bar');
  if (!filterBar) {
    filterBar = document.createElement('div');
    filterBar.id = 'prov-filter-bar';
    filterBar.style.cssText = 'margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    list.parentElement.insertBefore(filterBar, list);
  }

  // Mois disponibles depuis les missions
  const availMonths = [...new Set(
    Data.getMissions().map(m => m.date?.substring(0,7)).filter(Boolean)
  )].sort().reverse();
  if (!availMonths.includes(_provMonth)) availMonths.unshift(_provMonth);

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = m => { const [y,mo]=m.split('-'); return `${MONTHS_FR[+mo-1]} ${y}`; };

  const activeCount = providers.filter(p => !_excluded.has(p.id)).length;
  filterBar.innerHTML = `
    <div style="position:relative;flex:1;min-width:180px">
      <button class="btn btn-ghost btn-sm" onclick="var p=document.getElementById('prov-filter-panel');p.style.display=p.style.display==='none'?'block':'none'" style="width:100%;text-align:left;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:8px 14px;font-size:0.85rem">
        👥 Récap — <b>${activeCount} / ${providers.length}</b> prestataires ▼
      </button>
      <div id="prov-filter-panel" style="display:none;position:absolute;top:100%;left:0;z-index:40;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-md);padding:10px 14px;min-width:240px">
        <div style="display:flex;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <button class="btn btn-xs btn-ghost" onclick="window._provAll()">Tous</button>
          <button class="btn btn-xs btn-ghost" onclick="window._provNone()">Aucun</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto">
          ${providers.map(p=>`<label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;padding:3px 0">
            <input type="checkbox" value="${p.id}" ${!_excluded.has(p.id)?'checked':''} onchange="window._provToggle('${p.id}')">
            ${Utils.escapeHtml(p.lastName+' '+p.firstName)}
          </label>`).join('')}
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:6px 12px">
      <span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">📅 Mois :</span>
      <select id="prov-month-select" style="border:none;background:transparent;font-size:0.88rem;font-weight:600;color:var(--text-primary);cursor:pointer;outline:none" onchange="window._setProvMonth(this.value)">
        ${availMonths.map(m => `<option value="${m}" ${m===_provMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}
      </select>
    </div>`;

  window._provToggle = id => { _excluded.has(id) ? _excluded.delete(id) : _excluded.add(id); render(); };
  window._provAll = () => { _excluded.clear(); render(); };
  window._provNone = () => { providers.forEach(p => _excluded.add(p.id)); render(); };
  window._setProvMonth = m => { _provMonth = m; render(); };

  // ── Totaux globaux ─────────────────────────────────────────
  const cm = _provMonth;
  const inclProvIds = new Set(providers.filter(p => !_excluded.has(p.id)).map(p => p.id));
  const _mProvIds = m => m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
  const inclMonth = allMissionsWithProv.filter(m => _mProvIds(m).some(pid => inclProvIds.has(pid)) && m.date && m.date.startsWith(cm));
  const inclAll   = allMissionsWithProv.filter(m => _mProvIds(m).some(pid => inclProvIds.has(pid)));
  // Pour les missions multi-prestataires : multiplier le coût par le nb de profs inclus
  // (providerRate = tarif individuel par intervenant)
  const _mCost = (m, filtPids) => {
    const pids = _mProvIds(m);
    const n = filtPids ? pids.filter(pid => filtPids.has(pid)).length : pids.length;
    return (m.duration||0) * (m.providerRate||0) * Math.max(n, 1);
  };
  const totMonthCost  = inclMonth.reduce((s,m) => s + _mCost(m, inclProvIds), 0);
  const totMonthRev   = inclMonth.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
  const totMonthH     = inclMonth.reduce((s,m) => s+(m.duration||0), 0);
  const totMonthCount = inclMonth.length;
  const totAllCost    = inclAll.reduce((s,m) => s + _mCost(m, inclProvIds), 0);
  const totAllRev     = inclAll.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
  const totAllH       = inclAll.reduce((s,m) => s+(m.duration||0), 0);
  const totAllCount   = inclAll.length;

  const summary = `<div class="report-section" style="margin-bottom:24px">
    <h3 class="section-title">Récapitulatif global</h3>
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
      <div class="kpi-card"><div class="kpi-content">
        <div class="kpi-label" style="margin-bottom:4px">${monthLabel(cm)}${cm===Utils.currentYearMonth()?' (mois en cours)':''}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div><div class="kpi-value" style="font-size:1rem;color:var(--danger)">${Utils.formatMoney(totMonthCost)}</div><div class="kpi-label">Charges (${totMonthCount} interv. · ${Utils.formatDuration(totMonthH)})</div></div>
          <div><div class="kpi-value" style="font-size:1rem;color:var(--success)">${Utils.formatMoney(totMonthRev - totMonthCost)}</div><div class="kpi-label">Marge brute</div></div>
          <div><div class="kpi-value" style="font-size:1rem">${Utils.formatMoney(totMonthRev)}</div><div class="kpi-label">CA facturé</div></div>
        </div>
      </div></div>
      <div class="kpi-card"><div class="kpi-content">
        <div class="kpi-label" style="margin-bottom:4px">Total cumulé</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div><div class="kpi-value" style="font-size:1rem;color:var(--danger)">${Utils.formatMoney(totAllCost)}</div><div class="kpi-label">Charges (${totAllCount} interv. · ${Utils.formatDuration(totAllH)})</div></div>
          <div><div class="kpi-value" style="font-size:1rem;color:var(--success)">${Utils.formatMoney(totAllRev - totAllCost)}</div><div class="kpi-label">Marge brute</div></div>
          <div><div class="kpi-value" style="font-size:1rem">${Utils.formatMoney(totAllRev)}</div><div class="kpi-label">CA facturé</div></div>
        </div>
      </div></div>
    </div>
  </div>`;

  // Mémoriser les dossiers ouverts avant le re-render
  const openDossiers = new Set([...document.querySelectorAll('details[id^="dossier-"][open]')].map(d => d.id));
  list.innerHTML = summary + providers.map(p => providerCard(p, allMissions, allMissionsWithProv)).join('');
  // Rétablir l'état ouvert après le re-render
  openDossiers.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
}

function _exportProvider(providerId, month) {
  const provider = Data.getProviderById(providerId);
  const subjects = {}; (Data.getSubjects()||[]).forEach(s => subjects[s.id] = s);
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const students = {}; Data.getStudents().forEach(s => students[s.id] = s);
  const missions = Data.getMissions().filter(m =>
    (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).includes(providerId) &&
    m.status !== 'cancelled' &&
    (!month || (m.date && m.date.startsWith(month)))
  ).sort((a,b) => (a.date||'').localeCompare(b.date||''));

  const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const rows = [['Date','Jour','Heure début','Heure fin','Durée (h)','École / Étudiant','Matière','Tarif prestataire (€/h)','Total prestataire (€)','Tarif facturation (€/h)','Total facturé (€)']];
  missions.forEach(m => {
    const d = new Date(m.date + 'T00:00:00');
    const co = companies[m.companyId];
    const studs = (m.studentIds||[]).map(id => { const s = students[id]; return s ? s.firstName+' '+s.lastName : ''; }).filter(Boolean).join(', ');
    const who = studs || (co ? co.name : '');
    const subj = m.subjectId ? (subjects[m.subjectId]?.name || m.subject || '') : (m.subject || m.title || '');
    const rate = m.providerRate || 0;
    const bRate = m.billingRate || 0;
    const dur = m.duration || 0;
    rows.push([m.date, DAYS[d.getDay()], m.startTime||'', m.endTime||'', dur.toFixed(2), who, subj, rate.toFixed(2), (dur*rate).toFixed(2), bRate.toFixed(2), (dur*bRate).toFixed(2)]);
  });
  const total = missions.reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);
  rows.push(['','','','','','','','TOTAL',total.toFixed(2),'','']);

  _downloadCSV(rows, `interventions_${provider.lastName}_${month||'complet'}.csv`);
}

// ── Dossier intervenant ──────────────────────────────────────────
function providerDossier(provider) {
  const docs  = provider.pDocs || {};
  const total = PDOCS.length;
  const done  = PDOCS.filter(d => ['valide','archive'].includes(docs[d.k]||'non_recu')).length;
  const pct   = Math.round(done / total * 100);
  const col   = done === 0 ? '#ef4444' : done === total ? '#22c55e' : '#f59e0b';

  const rows = PDOCS.map(d => {
    const v    = docs[d.k] || 'non_recu';
    const tpls = PDOCS_TEMPLATES[d.k] || [];
    const dlBtns = tpls.map(t =>
      `<a href="docs/${t.file}" download title="Télécharger ${t.label}"
          onclick="event.stopPropagation()"
          style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:12px;background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.7rem;text-decoration:none;white-space:nowrap;flex-shrink:0">⬇ ${t.label}</a>`
    ).join('');
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <span data-action="p-doc" data-id="${provider.id}" data-key="${d.k}"
        style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;background:${PDC[v]}20;color:${PDC[v]};font-size:0.72rem;font-weight:600;cursor:pointer;min-width:80px;justify-content:center;flex-shrink:0;user-select:none"
        title="Cliquer pour changer le statut">${PDL[v]}</span>
      <span style="flex:1;font-size:0.87rem;min-width:100px">${d.l}</span>
      ${dlBtns ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${dlBtns}</div>` : ''}
    </div>`;
  }).join('');

  return `<details id="dossier-${provider.id}" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
    <summary style="cursor:pointer;display:flex;align-items:center;gap:10px;list-style:none;user-select:none;padding-bottom:2px">
      <span style="font-size:0.85rem;font-weight:600;white-space:nowrap">📁 Dossier intervenant</span>
      <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width .3s"></div>
      </div>
      <span style="font-size:0.78rem;font-weight:700;color:${col};white-space:nowrap">${done}/${total}</span>
      <span style="font-size:0.75rem;color:var(--text-muted)">▼</span>
    </summary>
    <div style="margin-top:8px">
      <p style="font-size:0.72rem;color:var(--text-muted);margin:0 0 6px">Cliquez sur un statut pour le faire avancer · Non reçu → Demandé → Reçu → Validé → Archivé</p>
      ${rows}
    </div>
  </details>`;
}

function providerCard(provider, allMissions, allMissionsWithProv) {
  const links = Data.getProviderLinksByProvider(provider.id);
  const linkedCoIds = new Set(links.map(l => l.companyId));
  const rawDirect = allMissions.filter(m => (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).includes(provider.id));
  // Agence = flag explicite uniquement (ex: Agency Evol)
  const isBillingAgency = !!provider.isAgency;
  const directMissions = rawDirect;

  const missions   = isBillingAgency
    ? allMissions.filter(m => linkedCoIds.has(m.companyId))
    : directMissions;
  const done       = missions.filter(m => m.status === 'done');
  const planned    = missions.filter(m => m.status === 'planned');
  const active     = missions;
  const cm         = _provMonth;
  const monthAll   = active.filter(m => m.date && m.date.startsWith(cm));

  // Pour les missions multi-prestataires, le coût de CE prestataire = providerRate × duration
  // (providerRate est le tarif individuel de chaque intervenant, pas un tarif partagé)
  const _provCost = m => (m.duration||0) * (m.providerRate||0);
  const totalH      = active.reduce((s, m) => s + (m.duration||0), 0);
  const totalCost   = isBillingAgency ? 0 : active.reduce((s, m) => s + _provCost(m), 0);
  const totalRev    = active.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const totalMargin = totalRev - totalCost;
  const monthHDone  = monthAll.filter(m => m.status === 'done').reduce((s, m) => s + (m.duration||0), 0);
  const monthHPlan  = monthAll.filter(m => m.status === 'planned').reduce((s, m) => s + (m.duration||0), 0);
  const monthH      = monthHDone + monthHPlan;
  const monthCost   = isBillingAgency ? 0 : monthAll.reduce((s, m) => s + _provCost(m), 0);
  const monthRev    = monthAll.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const monthMargin = monthRev - monthCost;
  // Missions "à venir" = planned dans le mois sélectionné ou dans le futur
  const monthPlanned = monthAll.filter(m => m.status === 'planned').length;
  const upcoming     = planned.filter(m => m.date >= Utils.today()).length;
  const initials     = ((provider.firstName||'')[0]||'?') + ((provider.lastName||'')[0]||'');

  // Liaisons avec sociétés
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const linkedCoStr = links.map(l => {
    const co = companies[l.companyId];
    return co ? `<span class="school-tag" style="background:${Utils.lightenColor(co.color)};color:${co.color};border:1px solid ${co.color}">${Utils.escapeHtml(co.name)} · ${Utils.formatMoney(l.hourlyRate)}/h</span>` : '';
  }).filter(Boolean).join(' ');

  // Conflits
  const conflicts = Data.getConflictsForProvider(provider.id);

  const defaultRate = provider.defaultHourlyRate || provider.hourlyRate || 0;
  const isExcluded  = _excluded.has(provider.id);

  return `<div class="provider-card${provider.active === false ? ' provider-inactive' : ''}" style="${isExcluded ? 'opacity:0.45;' : ''}">
    <div class="provider-card-left">
      <div class="provider-avatar">${initials.toUpperCase()}</div>
    </div>
    <div class="provider-card-main">
      <div class="provider-card-header">
        <div>
          <h3 class="provider-name">${Utils.escapeHtml(provider.firstName + ' ' + provider.lastName)}</h3>
          <div class="provider-meta">
            ${provider.structure  ? `<span class="provider-structure">${Utils.escapeHtml(provider.structure)}</span>` : ''}
            ${provider.specialty || provider.subject ? `<span class="provider-subject">${Utils.escapeHtml(provider.specialty || provider.subject)}</span>` : ''}
            ${provider.active === false ? '<span class="badge badge-inactive">Inactif</span>' : ''}
            ${conflicts.length > 0 ? `<span class="badge badge-danger">⚠ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        <div class="provider-rate-badge">
          <span class="rate-label">Tarif défaut</span>
          <span class="rate-value">${Utils.formatMoney(defaultRate)}/h</span>
        </div>
      </div>

      <div class="provider-contact">
        ${provider.phone ? `<span>📞 ${Utils.escapeHtml(provider.phone)}</span>` : ''}
        ${provider.email ? `<span>✉ ${Utils.escapeHtml(provider.email)}</span>` : ''}
      </div>

      ${linkedCoStr ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${linkedCoStr}</div>` : ''}
      ${provider.notes ? `<div class="provider-notes">${Utils.escapeHtml(provider.notes)}</div>` : ''}

      <div class="provider-stats">
        <div class="provider-stat">
          <div class="provider-stat-value">${monthAll.length}${monthPlanned > 0 ? `<span style="font-size:0.7rem;color:var(--text-muted)"> (${monthPlanned} prévu)</span>` : ''}</div>
          <div class="provider-stat-label">${Utils.MONTHS_LONG[+cm.split('-')[1]-1]} (missions)</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${Utils.formatDuration(monthH)}</div>
          <div class="provider-stat-label">${Utils.MONTHS_LONG[+cm.split('-')[1]-1]} (h)</div>
        </div>
        <div class="provider-stat highlight">
          <div class="provider-stat-value">${isBillingAgency ? '<span style="font-size:0.75rem;color:var(--text-muted)">Agence</span>' : Utils.formatMoney(monthCost)}</div>
          <div class="provider-stat-label">Coût ${Utils.MONTHS_LONG[+cm.split('-')[1]-1]}</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${Utils.formatMoney(monthRev)}</div>
          <div class="provider-stat-label">CA ${Utils.MONTHS_LONG[+cm.split('-')[1]-1]}</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value" style="color:${monthMargin>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(monthMargin)}</div>
          <div class="provider-stat-label">Marge ${Utils.MONTHS_LONG[+cm.split('-')[1]-1]}</div>
        </div>
      </div>
      <div class="provider-stats" style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border)">
        <div class="provider-stat">
          <div class="provider-stat-value">${done.length} <span style="font-size:0.7rem;color:var(--text-muted)">(+${upcoming} à venir)</span></div>
          <div class="provider-stat-label">Missions</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${Utils.formatDuration(totalH)}</div>
          <div class="provider-stat-label">Total heures</div>
        </div>
        <div class="provider-stat highlight">
          <div class="provider-stat-value">${Utils.formatMoney(totalCost)}</div>
          <div class="provider-stat-label">Coût total</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${Utils.formatMoney(totalRev)}</div>
          <div class="provider-stat-label">CA total</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value" style="color:${totalMargin>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(totalMargin)}</div>
          <div class="provider-stat-label">Marge totale</div>
        </div>
      </div>
      ${providerDossier(provider)}
    </div>
    <div class="provider-card-actions">
      <button class="btn btn-ghost btn-sm" onclick="Modals.openProvider('${provider.id}')">Modifier</button>
      <button class="btn btn-ghost btn-sm" onclick="Modals.openProviderLink(null,'${provider.id}')">+ Lien société</button>
      <button class="btn btn-sm ${isExcluded ? 'btn-primary' : 'btn-ghost'}" onclick="toggleProvider('${provider.id}')" title="${isExcluded ? 'Inclure dans le récap' : 'Exclure du récap'}">${isExcluded ? '+ Inclure' : '— Exclure'}</button>
      <div style="position:relative;display:inline-block">
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();window._toggleMenu('pmenu-${provider.id}')">⋯</button>
        <div id="pmenu-${provider.id}" style="display:none;position:absolute;right:0;top:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);z-index:50;min-width:200px;padding:4px">
          <div style="padding:6px 10px;font-size:0.75rem;color:var(--text-muted);border-bottom:1px solid var(--border);margin-bottom:4px">Exporter les interventions</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;padding:6px 10px" onclick="event.stopPropagation();_exportProvider('${provider.id}','${Utils.currentYearMonth()}')">📥 Ce mois (${Utils.MONTHS_LONG[+Utils.currentYearMonth().split('-')[1]-1]})</button>
          <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;padding:6px 10px" onclick="event.stopPropagation();_exportProvider('${provider.id}','')">📥 Tout l'historique</button>
        </div>
      </div>
    </div>
  </div>`;
}
