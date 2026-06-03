// etudiants.js — Hub Étudiants + Suivi Qualiopi
'use strict';

// ── Constantes Qualiopi ──────────────────────────────────────────
const QSTEPS = [
  'Prise de contact','Positionnement / analyse','Programme transmis',
  'Devis / contrat envoyé','Document signé reçu','Règlement intérieur transmis',
  "Livret d'accueil transmis",'Entrée en formation','Émargement / présence',
  'Évaluation intermédiaire','Évaluation finale','Attestation de fin',
  'Satisfaction envoyée','Satisfaction reçue','Archivage dossier'
];
const QDOCS = [
  {k:'fiche_rens',l:'Fiche de renseignement'},{k:'positionnement',l:'Fiche de positionnement'},
  {k:'programme',l:'Programme de formation'},{k:'devis',l:'Devis'},
  {k:'contrat',l:'Contrat / convention'},{k:'reglement',l:'Règlement intérieur'},
  {k:'livret',l:"Livret d'accueil"},{k:'planning',l:'Planning'},
  {k:'emargement',l:'Émargements'},{k:'evaluation',l:'Évaluations'},
  {k:'attestation',l:'Attestation de fin'},{k:'bilan',l:'Bilan'},
  {k:'satisfaction',l:'Questionnaire satisfaction'},{k:'justificatifs',l:'Justificatifs complémentaires'}
];
// Modèles téléchargeables (fichiers dans /docs/)
const QDOCS_TEMPLATES = {
  fiche_rens:    [{label:'Fiche individuelle',  file:'fiche_renseignement.docx'}, {label:'Fiche contact', file:'fiche_contact_apprenant.docx'}],
  positionnement:[{label:'Fiche positionnement',file:'fiche_positionnement.docx'}],
  programme:     [{label:'Programme type',      file:'programme_formation.docx'}],
  devis:         [{label:'Convention / devis',  file:'convention_formation.docx'}],
  contrat:       [{label:'Convention',          file:'convention_formation.docx'}, {label:'Contrat pédagogique', file:'contrat_pedagogique.docx'}],
  reglement:     [{label:'Règlement intérieur', file:'reglement_interieur.docx'}],
  livret:        [{label:"Livret d'accueil",    file:'livret_accueil.docx'}],
  planning:      [{label:'Déroulé pédagogique', file:'planning_formation.docx'}],
  emargement:    [{label:'Feuille émargement',  file:'feuille_emargement.docx'}],
  evaluation:    [{label:'Éval. à chaud',       file:'evaluation_chaud.docx'}, {label:'Grille acquis', file:'evaluation_grille_acquis.docx'}],
  attestation:   [{label:'Attestation fin',     file:'attestation_fin_formation.docx'}],
  bilan:         [{label:'Suivi individuel',    file:'bilan_suivi_individuel.docx'}],
  satisfaction:  [{label:'Questionnaire',       file:'questionnaire_satisfaction.docx'}],
  justificatifs: [],
};
const QPHASES = [
  {label:"Phase 1 — Préparation de l'arrivée", icon:'📝', steps:[0,1,2,3,4,5,6],
   docs:['fiche_rens','positionnement','programme','devis','contrat','reglement','livret']},
  {label:'Phase 2 — Formation',                icon:'🎓', steps:[7,8,9,10,11],
   docs:['planning','emargement','evaluation','attestation','bilan']},
  {label:"Phase 3 — Suivi de l'apprenant",     icon:'📊', steps:[12,13,14],
   docs:['satisfaction','justificatifs']},
];
const SC    = {vert:'#22c55e',jaune:'#f59e0b',rouge:'#ef4444',gris:'#94a3b8'};
const SI    = {vert:'✓',jaune:'⋯',rouge:'✗',gris:'—'};
const SL    = {vert:'Terminé',jaune:'En cours',rouge:'Manquant',gris:'N/A'};
const SCY   = ['rouge','jaune','vert','gris'];
const DS    = ['non_cree','cree','envoye','recu','signe','archive'];
const DL    = {non_cree:'Non créé',cree:'Créé',envoye:'Envoyé',recu:'Reçu',signe:'Signé',archive:'Archivé'};
const DC    = {non_cree:'#94a3b8',cree:'#94a3b8',envoye:'#f59e0b',recu:'#f59e0b',signe:'#22c55e',archive:'#22c55e'};

// ── État ────────────────────────────────────────────────────────
let _view  = 'hub';
let _qId   = null;
let _stuId   = null;   // étudiant affiché dans student-detail
let _stuMonth = '';    // filtre mois dans student-detail ('' = tous)
const filters = {search:'',companyId:'',formationId:'',status:''};
let _st = null;

function renderPage() { render(); }
function qScore(s) { return (s.qSteps||[]).filter(v=>v==='vert').length; }
window._openStudentDetail = function(id) { _stuId = id; _stuMonth = ''; _view = 'student-detail'; render(); };
window._setStuMonth = function(mo) { _stuMonth = mo; render(); };

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  const mc = document.getElementById('main-content');
  mc.addEventListener('click',  handleClick);
  mc.addEventListener('change', handleChange);
  mc.addEventListener('input',  e => {
    if (e.target.id !== 'filter-search') return;
    filters.search = e.target.value;
    clearTimeout(_st); _st = setTimeout(render, 200);
  });
});

function handleClick(e) {
  const t = e.target.closest('[data-action]'); if (!t) return;
  const a = t.dataset.action, id = t.dataset.id;
  if (a === 'goto-hub')        { _view='hub';                      render(); }
  if (a === 'goto-students')   { _view='students';                 render(); }
  if (a === 'goto-qualiopi')   { _view='qualiopi';                 render(); }
  if (a === 'q-detail')        { _qId=id; _view='qualiopi-detail'; render(); }
  if (a === 'q-back')          { _view='qualiopi';                 render(); }
  if (a === 'new-student')     { Modals.openStudent(null); }
  if (a === 'open-student')    { Modals.openStudent(id); }
  if (a === 'student-detail')  { _stuId=id; _view='student-detail'; render(); }
  if (a === 'stu-back')        { _view='students';                  render(); }
  if (a === 'reset-filters') {
    filters.search=''; filters.companyId=''; filters.formationId=''; filters.status='';
    render();
  }
  if (a === 'q-step') {
    const s = Data.getStudentById(id); if (!s) return;
    const ph = +t.dataset.phase;
    const steps = [...(s.qSteps||Array(QSTEPS.length).fill('rouge'))];
    const phDone = pi => QPHASES[pi].steps.every(i=>(steps[i]||'rouge')==='vert');
    if (ph===1 && !phDone(0)) return;
    if (ph===2 && !phDone(1)) return;
    const i = +t.dataset.idx;
    steps[i] = SCY[(SCY.indexOf(steps[i]||'rouge')+1)%SCY.length];
    Data.saveStudent({...s, qSteps:steps}); render();
  }
  if (a === 'q-doc') {
    const s = Data.getStudentById(id); if (!s) return;
    const docs = {...(s.qDocs||{})}, k = t.dataset.key;
    docs[k] = DS[(DS.indexOf(docs[k]||'non_cree')+1)%DS.length];
    Data.saveStudent({...s, qDocs:docs}); render();
  }
}
function handleChange(e) {
  if (e.target.id==='filter-company')   { filters.companyId   = e.target.value; render(); }
  if (e.target.id==='filter-formation') { filters.formationId = e.target.value; render(); }
  if (e.target.id==='filter-status')    { filters.status      = e.target.value; render(); }
}

// ── Render ──────────────────────────────────────────────────────
function render() {
  document.getElementById('main-content').innerHTML =
    _view==='hub'              ? hubHTML()            :
    _view==='students'         ? studentsHTML()       :
    _view==='student-detail'   ? studentDetailHTML()  :
    _view==='qualiopi'         ? qualiopiHTML()       :
    _view==='qualiopi-detail'  ? qDetailHTML()        : '';
}

// ── HUB ─────────────────────────────────────────────────────────
function hubHTML() {
  const all = Data.getStudents();
  const nA  = all.filter(s=>s.status==='active').length;
  const nC  = all.filter(s=>qScore(s)===QSTEPS.length).length;
  const card = (action,ico,title,sub,stats,hov) =>
    `<div data-action="${action}" style="cursor:pointer;background:var(--bg-card);border:2px solid var(--border);border-radius:20px;padding:48px 40px;text-align:center;transition:all .2s"
      onmouseover="this.style.boxShadow='0 8px 40px ${hov}';this.style.borderColor='${hov}'"
      onmouseout="this.style.boxShadow='';this.style.borderColor='var(--border)'">
      <div style="font-size:4rem;margin-bottom:16px">${ico}</div>
      <div style="font-size:1.6rem;font-weight:700;margin-bottom:8px">${title}</div>
      <div style="color:var(--text-muted);margin-bottom:28px">${sub}</div>
      <div style="display:flex;justify-content:center;gap:32px">${stats}</div>
    </div>`;
  const stat = (v,l,c) => `<div><div style="font-size:2.2rem;font-weight:800;color:${c}">${v}</div><div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">${l}</div></div>`;
  const ownCos = Data.getCompanies().filter(c => c.role === 'own');
  const hubTitle = ownCos.length ? ownCos.map(c => c.name).join(' & ') + ' — Formation' : 'Formation';
  return `
  <div class="page-header"><h1 class="page-title">${Utils.escapeHtml(hubTitle)}</h1></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:16px">
    ${card('goto-students','🎓','Étudiants','Gestion des dossiers & fiches',
      stat(all.length,'total','var(--primary)')+stat(nA,'actifs','#22c55e'),'rgba(59,130,246,.25)')}
    ${card('goto-qualiopi','📋','Qualiopi','Suivi qualité & conformité',
      stat(nC,'complets','#22c55e')+stat(all.length-nC,'incomplets','#ef4444'),'rgba(34,197,94,.25)')}
  </div>`;
}

// ── ÉTUDIANTS ───────────────────────────────────────────────────
function studentsHTML() {
  const cos  = {}; Data.getCompanies().forEach(c=>cos[c.id]=c);
  const fors = {}; Data.getFormations().forEach(f=>fors[f.id]=f);
  const allM = Data.getMissions().filter(m=>m.status!=='cancelled');
  const ownCos = Data.getOwnCompanies().filter(c=>c.hasTraining);
  const allForms = Data.getFormations();
  let st = Data.getStudents();
  if (filters.companyId)   st = st.filter(s=>(s.poleId||s.companyId)===filters.companyId);
  if (filters.formationId) st = st.filter(s=>(s.formationIds||[]).includes(filters.formationId));
  if (filters.status)      st = st.filter(s=>s.status===filters.status);
  if (filters.search) { const q=filters.search.toLowerCase();
    st = st.filter(s=>(s.firstName||'').toLowerCase().includes(q)||(s.lastName||'').toLowerCase().includes(q)||(s.email||'').toLowerCase().includes(q)); }

  const SBL = {active:['Actif','badge-done'],inactive:['Inactif','badge-cancelled'],pending:['En attente','badge-warning']};
  const LBL = {college:'Collège',lycee:'Lycée',superieur:'Supérieur'};
  const prov = {}; Data.getProviders().forEach(p=>prov[p.id]=p);
  const RATE = {college:'rateCollege',lycee:'rateLycee',superieur:'rateSup'};

  const cards = st.length===0
    ? `<div class="empty-page"><div class="empty-icon">🎓</div><h2>Aucun étudiant</h2><button class="btn btn-primary" data-action="new-student">+ Ajouter</button></div>`
    : st.map(s=>{
      const co = cos[s.poleId||s.companyId];
      const col = co?.color||'#3b82f6';
      const ini = ((s.firstName||'')[0]||'?')+((s.lastName||'')[0]||'');
      const [sl,sc] = SBL[s.status]||[s.status,''];
      const ftags = (s.formationIds||[]).map(id=>fors[id]?`<span class="student-formation-tag">${Utils.escapeHtml(fors[id].name)}</span>`:'').join('');
      const sMs   = allM.filter(m=>(m.studentIds||[]).includes(s.id));
      const totH  = sMs.reduce((a,m)=>a+(m.duration||0),0);
      const totR  = sMs.reduce((a,m)=>a+(m.duration||0)*(m.billingRate||0),0);
      const score = qScore(s); const pct = Math.round(score/QSTEPS.length*100);
      const qc    = pct===100?'#22c55e':pct>50?'#f59e0b':'#ef4444';
      const provIds = [...new Set(sMs.map(m=>m.providerId).filter(Boolean))];
      const provStats = provIds.map(pid=>{
        const p=prov[pid]; if(!p) return '';
        const pMs=sMs.filter(m=>m.providerId===pid);
        // On utilise le providerRate de chaque mission (source de vérité), pas le tarif de la fiche prestataire
        const cost=pMs.reduce((a,m)=>a+(m.duration||0)*(m.providerRate||0),0);
        const rev=pMs.reduce((a,m)=>a+(m.duration||0)*(m.billingRate||0),0);
        return `<div style="font-size:0.78rem;margin-top:4px"><strong>${Utils.escapeHtml(p.lastName+' '+p.firstName)}</strong>
          <span style="color:var(--danger);margin-left:6px">Coût: ${Utils.formatMoney(cost)}</span>
          <span style="color:var(--success);margin-left:6px">Facturé: ${Utils.formatMoney(rev)}</span>
          <span style="color:var(--text-muted);margin-left:6px">Marge: ${Utils.formatMoney(rev-cost)}</span></div>`;
      }).join('');
      return `<div class="student-card" data-action="open-student" data-id="${s.id}">
        <div class="student-avatar" style="background:${col}">${ini.toUpperCase()}</div>
        <div class="student-info">
          <div class="student-name">${Utils.escapeHtml(s.firstName+' '+s.lastName)}</div>
          <div class="student-meta">
            ${co?`<span style="color:${col};font-weight:600">${Utils.escapeHtml(co.name)}</span> · `:''}
            <span class="badge ${sc}" style="font-size:0.7rem">${sl}</span>
            ${s.level?`<span style="margin-left:6px;font-size:0.75rem;color:var(--text-muted)">${LBL[s.level]||''}</span>`:''}
          </div>
          ${ftags?`<div class="student-formations">${ftags}</div>`:''}
          ${s.email?`<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">✉ ${Utils.escapeHtml(s.email)}</div>`:''}
          ${s.phone?`<div style="font-size:0.78rem;color:var(--text-muted)">☎ ${Utils.escapeHtml(s.phone)}</div>`:''}
          ${s.entryDate?`<div style="font-size:0.78rem;color:var(--text-muted)">📅 Entrée : ${s.entryDate}</div>`:''}
          ${s.notes?`<div style="font-size:0.78rem;font-style:italic;color:var(--text-muted);margin-top:2px">${Utils.escapeHtml(s.notes)}</div>`:''}
          <div style="margin-top:8px;display:flex;align-items:center;gap:6px" title="Qualiopi ${pct}%">
            <span style="font-size:0.7rem;color:var(--text-muted)">Qualiopi</span>
            <div style="flex:1;max-width:100px;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${qc}"></div></div>
            <span style="font-size:0.7rem;color:${qc};font-weight:600">${pct}%</span>
          </div>
        </div>
        <div style="min-width:200px;text-align:right;padding-left:16px;border-left:1px solid var(--border)">
          <div style="font-size:0.85rem;font-weight:700">${Utils.formatDuration(totH)} total</div>
          <div style="font-size:0.8rem;color:var(--success)">${Utils.formatMoney(totR)} facturé</div>
          ${provStats||'<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">Aucun prestataire</div>'}
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px" onclick="event.stopPropagation()">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();window._openStudentDetail('${s.id}')">📅 Voir les cours</button>
            <div style="position:relative;display:inline-block">
              <button class="btn btn-ghost btn-sm" onclick="window._toggleMenu('smenu-${s.id}')">⋯ Exporter CSV</button>
              <div id="smenu-${s.id}" style="display:none;position:absolute;right:0;top:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);z-index:50;min-width:200px;padding:4px">
                <div style="padding:6px 10px;font-size:0.75rem;color:var(--text-muted);border-bottom:1px solid var(--border);margin-bottom:4px">Exporter les cours</div>
                <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;padding:6px 10px" onclick="_exportStudent('${s.id}','${Utils.currentYearMonth()}')">📥 Ce mois</button>
                <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;padding:6px 10px" onclick="_exportStudent('${s.id}','')">📥 Tout l'historique</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

  const coOpts = '<option value="">Tous les pôles</option>'+ownCos.map(c=>`<option value="${c.id}" ${filters.companyId===c.id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('');
  const fOpts  = '<option value="">Toutes les formations</option>'+allForms.map(f=>`<option value="${f.id}" ${filters.formationId===f.id?'selected':''}>${Utils.escapeHtml(f.name)}</option>`).join('');
  const nA = st.filter(s=>s.status==='active').length, nI = st.filter(s=>s.status==='inactive').length;
  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" data-action="goto-hub">← Retour</button>
      <h1 class="page-title" style="margin:0">Étudiants</h1>
    </div>
    <button class="btn btn-primary" data-action="new-student">+ Nouvel étudiant</button>
  </div>
  <div class="filters-bar">
    <input type="text" id="filter-search" class="form-input filter-search" placeholder="🔍 Rechercher…" value="${Utils.escapeHtml(filters.search)}">
    <select id="filter-company" class="form-input filter-select">${coOpts}</select>
    <select id="filter-formation" class="form-input filter-select">${fOpts}</select>
    <select id="filter-status" class="form-input filter-select">
      <option value="" ${!filters.status?'selected':''}>Tous les statuts</option>
      <option value="active" ${filters.status==='active'?'selected':''}>Actif</option>
      <option value="inactive" ${filters.status==='inactive'?'selected':''}>Inactif</option>
      <option value="pending" ${filters.status==='pending'?'selected':''}>En attente</option>
    </select>
    <button class="btn btn-ghost" data-action="reset-filters">Réinitialiser</button>
  </div>
  <div class="list-summary">${st.length} étudiant${st.length>1?'s':''} · ${nA} actif${nA>1?'s':''} · ${nI} inactif${nI>1?'s':''}</div>
  <div class="cards-grid">${cards}</div>`;
}

// ── DÉTAIL COURS ÉTUDIANT ────────────────────────────────────────
function studentDetailHTML() {
  const s = Data.getStudentById(_stuId);
  if (!s) return '<p>Étudiant introuvable.</p>';

  const cos      = {}; Data.getCompanies().forEach(c => cos[c.id] = c);
  const provMap  = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const subjMap  = {}; (Data.getSubjects()||[]).forEach(x => subjMap[x.id] = x);
  const co       = cos[s.poleId || s.companyId];

  // Palette de couleurs par prof
  const PROF_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  // Toutes les missions liées à cet étudiant, triées par date
  const allMissions = Data.getMissions()
    .filter(m => (m.studentIds || []).includes(s.id) && m.status !== 'cancelled')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Liste des mois disponibles (pour le sélecteur)
  const availMonths = [...new Set(allMissions.map(m => (m.date || '').substring(0, 7)))].sort();

  // Missions filtrées selon le mois sélectionné
  const missions = _stuMonth
    ? allMissions.filter(m => (m.date || '').startsWith(_stuMonth))
    : allMissions;

  const totalH    = missions.reduce((a, m) => a + (m.duration || 0), 0);
  const totalHT   = missions.reduce((a, m) => a + (m.duration || 0) * (m.billingRate  || 0), 0);
  const totalCost = missions.reduce((a, m) => a + (m.duration || 0) * (m.providerRate || 0), 0);
  const totalMarge = totalHT - totalCost;

  if (!missions.length) {
    return `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" data-action="stu-back">← Étudiants</button>
        <h1 class="page-title" style="margin:0">${Utils.escapeHtml(s.firstName + ' ' + s.lastName)}</h1>
      </div>
    </div>
    <div class="empty-page"><div class="empty-icon">📅</div><h2>Aucun cours enregistré</h2></div>`;
  }

  // Identifier tous les profs impliqués (dans l'ordre d'apparition)
  const provOrder = [];
  const provSeen  = new Set();
  missions.forEach(m => {
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : ['__none__']);
    pids.forEach(pid => { if (!provSeen.has(pid)) { provSeen.add(pid); provOrder.push(pid); } });
  });

  // Couleur par prof
  const provColor = {};
  provOrder.forEach((pid, i) => { provColor[pid] = PROF_COLORS[i % PROF_COLORS.length]; });

  // Grouper les missions par prof principal (premier pid)
  const byProv = {};
  missions.forEach(m => {
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : ['__none__']);
    const key  = pids[0];
    if (!byProv[key]) byProv[key] = [];
    byProv[key].push(m);
  });

  // Nom d'un cours : subject > subject texte libre > title
  const courseName = m => {
    if (m.subjectId && subjMap[m.subjectId]) return subjMap[m.subjectId].name;
    if (m.subject) return m.subject;
    if (m.title)   return m.title;
    return '—';
  };

  const provBlocks = provOrder.map(pid => {
    const p    = provMap[pid];
    const pms  = byProv[pid] || [];
    if (!pms.length) return '';
    const col  = provColor[pid];
    const pH   = pms.reduce((a, m) => a + (m.duration || 0), 0);
    const pHT  = pms.reduce((a, m) => a + (m.duration || 0) * (m.billingRate || 0), 0);
    const pCost= pms.reduce((a, m) => a + (m.duration || 0) * (m.providerRate || 0), 0);
    const provName = p ? (p.firstName + ' ' + p.lastName).toUpperCase() : 'INTERVENANT INCONNU';

    const pMarge = pHT - pCost;

    const rows = pms.map(m => {
      const d      = new Date((m.date || '') + 'T00:00:00');
      const dayStr = d.toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'long', year:'numeric' });
      const cours  = courseName(m);
      const h      = m.duration    || 0;
      const pu     = m.billingRate || 0;   // ce qu'on facture à l'étudiant
      const pp     = m.providerRate|| 0;   // ce qu'on paie le prof
      const marge  = (pu - pp) * h;
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:9px 14px;font-size:0.84rem;white-space:nowrap;color:var(--text-muted);min-width:140px">${dayStr}</td>
        <td style="padding:9px 14px;font-size:0.84rem;font-weight:500">${Utils.escapeHtml(cours)}</td>
        <td style="padding:9px 14px;font-size:0.84rem;text-align:right;font-weight:600;color:${col}">${h}h</td>
        <td style="padding:9px 14px;font-size:0.84rem;text-align:right;color:var(--success)">${pu > 0 ? pu.toFixed(2)+' €' : '—'}</td>
        <td style="padding:9px 14px;font-size:0.84rem;text-align:right;color:var(--danger)">${pp > 0 ? pp.toFixed(2)+' €' : '—'}</td>
        <td style="padding:9px 14px;font-size:0.84rem;text-align:right;font-weight:700;color:var(--success)">${h*pu > 0 ? Utils.formatMoney(h*pu) : '—'}</td>
        <td style="padding:9px 14px;font-size:0.84rem;text-align:right;color:var(--danger)">${h*pp > 0 ? Utils.formatMoney(h*pp) : '—'}</td>
        <td style="padding:9px 14px;font-size:0.84rem;text-align:right;font-weight:700;color:${marge>=0?'#10b981':'#ef4444'}">${Utils.formatMoney(marge)}</td>
      </tr>`;
    }).join('');

    return `<div style="margin-bottom:24px;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08)">
      <!-- En-tête prof -->
      <div style="background:${col};padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;color:#fff">
            ${(provName[0]||'?')}
          </div>
          <div>
            <div style="font-weight:800;font-size:0.95rem;color:#fff">${Utils.escapeHtml(provName)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,.75)">${pms.length} séance${pms.length>1?'s':''} · ${pH}h</div>
          </div>
        </div>
        <div style="display:flex;gap:24px;text-align:right">
          <div><div style="font-size:0.68rem;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em">Facturé</div><div style="font-size:1rem;font-weight:800;color:#fff">${Utils.formatMoney(pHT)}</div></div>
          <div><div style="font-size:0.68rem;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em">Coût prof</div><div style="font-size:1rem;font-weight:800;color:rgba(255,255,255,.8)">${pCost > 0 ? Utils.formatMoney(pCost) : '—'}</div></div>
          <div><div style="font-size:0.68rem;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.06em">Marge</div><div style="font-size:1rem;font-weight:800;color:${pMarge>=0?'#86efac':'#fca5a5'}">${Utils.formatMoney(pMarge)}</div></div>
        </div>
      </div>
      <!-- Tableau des séances -->
      <div style="background:var(--bg-card)">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:${col}18;border-bottom:2px solid ${col}40">
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:left;color:${col};letter-spacing:.06em">DATE</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:left;color:${col};letter-spacing:.06em">COURS</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:right;color:${col};letter-spacing:.06em">H</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:right;color:var(--success);letter-spacing:.06em">€/H FACTURÉ</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:right;color:var(--danger);letter-spacing:.06em">€/H PROF</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:right;color:var(--success);letter-spacing:.06em">TOTAL FACTURÉ</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:right;color:var(--danger);letter-spacing:.06em">COÛT PROF</th>
              <th style="padding:8px 14px;font-size:0.7rem;font-weight:700;text-align:right;color:#10b981;letter-spacing:.06em">MARGE</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:${col}10;border-top:2px solid ${col}40">
              <td colspan="2" style="padding:10px 14px;font-weight:700;font-size:0.88rem">Total ${Utils.escapeHtml(provName)}</td>
              <td style="padding:10px 14px;text-align:right;font-weight:800;color:${col}">${pH}h</td>
              <td></td><td></td>
              <td style="padding:10px 14px;text-align:right;font-weight:800;color:var(--success)">${Utils.formatMoney(pHT)}</td>
              <td style="padding:10px 14px;text-align:right;font-weight:800;color:var(--danger)">${pCost > 0 ? Utils.formatMoney(pCost) : '—'}</td>
              <td style="padding:10px 14px;text-align:right;font-weight:800;color:${pMarge>=0?'#10b981':'#ef4444'}">${Utils.formatMoney(pMarge)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  }).join('');

  const SBL = {active:['Actif','#22c55e'],inactive:['Inactif','#94a3b8'],pending:['En attente','#f59e0b']};
  const [sl, sc] = SBL[s.status] || [s.status, '#94a3b8'];

  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" data-action="stu-back">← Étudiants</button>
      <h1 class="page-title" style="margin:0">${Utils.escapeHtml(s.firstName + ' ' + s.lastName)}</h1>
      <span style="font-size:0.78rem;font-weight:600;padding:3px 10px;border-radius:12px;background:${sc}20;color:${sc}">${sl}</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <!-- Sélecteur de mois -->
      <select onchange="window._setStuMonth(this.value)"
        style="padding:6px 12px;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--bg-card);cursor:pointer;min-width:160px">
        <option value="" ${!_stuMonth?'selected':''}>📅 Tous les mois</option>
        ${availMonths.map(mo => {
          const [y, mIdx] = mo.split('-');
          const label = MONTHS_FR[+mIdx-1] + ' ' + y;
          return `<option value="${mo}" ${_stuMonth===mo?'selected':''}>${label}</option>`;
        }).join('')}
      </select>
      <button class="btn btn-ghost" data-action="open-student" data-id="${s.id}">✏ Modifier</button>
      <button class="btn btn-ghost" onclick="_exportStudent('${s.id}','${_stuMonth}')">📥 CSV</button>
      <button class="btn btn-primary" onclick="window._printStudentDetail('${s.id}','${_stuMonth}')">🖨 PDF</button>
    </div>
  </div>

  <!-- Résumé -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px">
    ${co ? `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Pôle</div>
      <div style="font-weight:700;color:${co.color||'var(--primary)'}">${Utils.escapeHtml(co.name)}</div>
    </div>` : ''}
    ${s.email ? `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Email</div>
      <div style="font-size:0.85rem">${Utils.escapeHtml(s.email)}</div>
    </div>` : ''}
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Séances</div>
      <div style="font-size:1.4rem;font-weight:800;color:var(--primary)">${missions.length}</div>
    </div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Total heures</div>
      <div style="font-size:1.4rem;font-weight:800">${totalH}h</div>
    </div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Total facturé</div>
      <div style="font-size:1.4rem;font-weight:800;color:var(--success)">${Utils.formatMoney(totalHT)}</div>
    </div>
  </div>

  <!-- Cours par prof -->
  ${provBlocks}

  <!-- Total général -->
  <div style="background:var(--surface);border:2px solid var(--border);border-radius:12px;padding:18px 22px;margin-top:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)">Total général</div>
        <div style="font-size:0.88rem;color:var(--text-muted);margin-top:2px">${missions.length} séance${missions.length>1?'s':''} · ${totalH}h · ${provOrder.length} intervenant${provOrder.length>1?'s':''}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 18px;text-align:center">
        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--success);margin-bottom:4px">Total facturé</div>
        <div style="font-size:1.4rem;font-weight:800;color:var(--success)">${Utils.formatMoney(totalHT)}</div>
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 18px;text-align:center">
        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--danger);margin-bottom:4px">Coût profs</div>
        <div style="font-size:1.4rem;font-weight:800;color:var(--danger)">${totalCost > 0 ? Utils.formatMoney(totalCost) : '—'}</div>
      </div>
      <div style="background:${totalMarge>=0?'#f0fdf4':'#fef2f2'};border:1px solid ${totalMarge>=0?'#86efac':'#fca5a5'};border-radius:10px;padding:14px 18px;text-align:center">
        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${totalMarge>=0?'#10b981':'#ef4444'};margin-bottom:4px">Marge nette</div>
        <div style="font-size:1.4rem;font-weight:800;color:${totalMarge>=0?'#10b981':'#ef4444'}">${Utils.formatMoney(totalMarge)}</div>
      </div>
    </div>
  </div>`;
}

// ── QUALIOPI DASHBOARD ──────────────────────────────────────────
function qualiopiHTML() {
  const all = Data.getStudents().filter(s=>s.status!=='inactive');
  const cos = {}; Data.getCompanies().forEach(c=>cos[c.id]=c);

  const nC  = all.filter(s=>qScore(s)===QSTEPS.length).length;
  const nMS = all.filter(s=>{const st=s.qSteps||[];return (st[4]||'rouge')!=='vert';}).length;
  const nEV = all.filter(s=>{const st=s.qSteps||[];return (st[10]||'rouge')!=='vert';}).length;
  const nST = all.filter(s=>{const st=s.qSteps||[];return (st[12]||'rouge')!=='vert';}).length;

  const stats = [
    {v:nC,l:'Dossiers complets',c:'#22c55e'},{v:all.length-nC,l:'Incomplets',c:'#ef4444'},
    {v:nMS,l:'Signature manquante',c:'#f59e0b'},{v:nEV,l:'Éval. finale manquante',c:'#f59e0b'},
    {v:nST,l:'Satisfaction manquante',c:'#f59e0b'},
  ].map(s=>`<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center">
    <div style="font-size:2rem;font-weight:800;color:${s.c}">${s.v}</div>
    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">${s.l}</div>
  </div>`).join('');

  const rows = all.map(s=>{
    const co   = cos[s.poleId||s.companyId];
    const score= qScore(s);
    const pct  = Math.round(score/QSTEPS.length*100);
    const col  = pct===100?'#22c55e':pct>50?'#f59e0b':'#ef4444';
    const steps= s.qSteps||[];
    const mini = QSTEPS.map((_,i)=>`<span title="${QSTEPS[i]}" style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${SC[steps[i]||'rouge']}"></span>`).join('');
    const al   = [];
    if((steps[4]||'rouge')!=='vert') al.push('Signature');
    if((steps[10]||'rouge')!=='vert') al.push('Éval. finale');
    if((steps[12]||'rouge')!=='vert') al.push('Satisfaction');
    return `<div style="background:var(--bg-card);border:1px solid ${pct<50?'#ef444430':pct<100?'#f59e0b30':'#22c55e30'};border-radius:12px;padding:14px 20px;margin-bottom:10px;display:flex;align-items:center;gap:16px">
      <div style="min-width:160px">
        <div style="font-weight:600">${Utils.escapeHtml(s.firstName+' '+s.lastName)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${co?Utils.escapeHtml(co.name):''}</div>
      </div>
      <div style="flex:1">
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">${mini}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:7px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:4px"></div></div>
          <span style="font-size:0.8rem;font-weight:700;color:${col};min-width:38px">${pct}%</span>
        </div>
      </div>
      <div style="min-width:150px;display:flex;flex-wrap:wrap;gap:4px">
        ${al.map(a=>`<span style="font-size:0.72rem;color:#f59e0b;background:#f59e0b18;padding:2px 8px;border-radius:4px">⚠ ${a}</span>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" data-action="q-detail" data-id="${s.id}">Détail →</button>
    </div>`;
  }).join('');

  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" data-action="goto-hub">← Retour</button>
      <h1 class="page-title" style="margin:0">Suivi Qualiopi</h1>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px">${stats}</div>
  ${all.length===0?'<div class="empty-page"><div class="empty-icon">📋</div><h2>Aucun étudiant actif</h2></div>':rows}`;
}

// ── QUALIOPI DÉTAIL ─────────────────────────────────────────────
function qDetailHTML() {
  const s = Data.getStudentById(_qId); if (!s) return '<p>Introuvable</p>';
  const co   = Data.getCompanyById(s.poleId||s.companyId);
  const fors = {}; Data.getFormations().forEach(f=>fors[f.id]=f);
  const formNames = (s.formationIds||[]).map(id=>fors[id]?.name||'').filter(Boolean).join(', ');
  const allM = Data.getMissions().filter(m=>(m.studentIds||[]).includes(s.id)&&m.status!=='cancelled');
  const totH = allM.reduce((a,m)=>a+(m.duration||0),0);
  const steps= s.qSteps||[]; const docs = s.qDocs||{};
  const score= qScore(s); const pct = Math.round(score/QSTEPS.length*100);
  const col  = pct===100?'#22c55e':pct>50?'#f59e0b':'#ef4444';

  const phDone = pi => QPHASES[pi].steps.every(i=>(steps[i]||'rouge')==='vert');
  const p0=phDone(0), p1=phDone(1);
  const phUnlocked = [true, p0, p1];

  const phaseBlocks = QPHASES.map((ph,pi)=>{
    const unlocked = phUnlocked[pi];
    const phScore  = ph.steps.filter(i=>(steps[i]||'rouge')==='vert').length;
    const phPct    = Math.round(phScore/ph.steps.length*100);
    const phCol    = phPct===100?'#22c55e':phPct>0?'#f59e0b':'#ef4444';
    const borderCol= phPct===100?'#22c55e30':phPct>0?'#f59e0b30':'var(--border)';

    const rows = ph.steps.map(i=>{
      const v = unlocked ? (steps[i]||'rouge') : 'gris';
      return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
        <span data-action="q-step" data-id="${s.id}" data-idx="${i}" data-phase="${pi}"
          title="${unlocked?'Cliquer pour changer':'Phase précédente à compléter'}"
          style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${SC[v]};color:#fff;font-size:0.78rem;font-weight:700;cursor:${unlocked?'pointer':'default'};flex-shrink:0">${SI[v]}</span>
        <span style="flex:1;font-size:0.87rem;${unlocked?'':'opacity:.45'}">${QSTEPS[i]}</span>
        <span style="font-size:0.72rem;color:var(--text-muted)">${unlocked?SL[v]:'—'}</span>
      </div>`;
    }).join('');

    return `<div style="background:var(--bg-card);border:1px solid ${borderCol};border-radius:14px;padding:20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="font-size:1.4rem">${ph.icon}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.95rem">${ph.label}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <div style="flex:1;max-width:140px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${phPct}%;background:${phCol};border-radius:3px"></div></div>
            <span style="font-size:0.78rem;font-weight:700;color:${phCol}">${phScore}/${ph.steps.length}</span>
          </div>
        </div>
        ${unlocked
          ? `<button class="btn btn-ghost btn-sm" onclick="window._exportPhase('${s.id}',${pi})">📥 Exporter</button>`
          : `<span style="font-size:0.75rem;color:var(--text-muted);background:var(--border);padding:4px 10px;border-radius:6px">🔒 Phase précédente incomplète</span>`}
      </div>
      ${rows}
    </div>`;
  }).join('');

  const docRows = QDOCS.map(d=>{
    const v = docs[d.k]||'non_cree';
    const tpls = QDOCS_TEMPLATES[d.k] || [];
    const dlBtns = tpls.map(t =>
      `<a href="docs/${t.file}" download title="Télécharger ${t.label}"
        style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:12px;background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.7rem;text-decoration:none;white-space:nowrap;flex-shrink:0"
        onclick="event.stopPropagation()">⬇ ${t.label}</a>`
    ).join('');
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <span data-action="q-doc" data-id="${s.id}" data-key="${d.k}"
        style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;background:${DC[v]}20;color:${DC[v]};font-size:0.72rem;font-weight:600;cursor:pointer;min-width:76px;justify-content:center;flex-shrink:0">${DL[v]}</span>
      <span style="flex:1;font-size:0.87rem;min-width:100px">${d.l}</span>
      ${dlBtns ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${dlBtns}</div>` : ''}
    </div>`;
  }).join('');

  const infoItems = [
    s.email&&{k:'Email',v:s.email}, s.phone&&{k:'Tél.',v:s.phone},
    co&&{k:'Structure',v:co.name}, formNames&&{k:'Formation',v:formNames},
    s.entryDate&&{k:'Entrée',v:s.entryDate}, s.financementMode&&{k:'Financement',v:s.financementMode},
    {k:'Séances',v:`${allM.length} · ${Utils.formatDuration(totH)}`},
  ].filter(Boolean).map(i=>`<div>
    <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">${i.k}</div>
    <div style="font-size:0.88rem;margin-top:2px">${Utils.escapeHtml(i.v)}</div>
  </div>`).join('');

  return `
  <div class="page-header">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn btn-ghost btn-sm" data-action="q-back">← Qualiopi</button>
      <h1 class="page-title" style="margin:0">${Utils.escapeHtml(s.firstName+' '+s.lastName)}</h1>
    </div>
    <button class="btn btn-ghost" data-action="open-student" data-id="${s.id}">✏ Modifier le profil</button>
  </div>
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px">
    ${infoItems}
  </div>
  <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
    <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${col};border-radius:5px;transition:width .3s"></div></div>
    <div style="font-size:1rem;font-weight:700;color:${col}">${pct}% — ${score}/${QSTEPS.length} étapes</div>
  </div>
  <div style="display:grid;grid-template-columns:3fr 2fr;gap:16px">
    <div>
      <p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 12px">Cliquez sur ● pour avancer : rouge → jaune → vert → gris. La phase suivante se déverrouille quand toutes les étapes sont vertes.</p>
      ${phaseBlocks}
    </div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px;height:fit-content">
      <h3 style="margin:0 0 4px;font-size:0.95rem">📄 Documents</h3>
      <p style="font-size:0.72rem;color:var(--text-muted);margin:0 0 8px">Cliquez pour faire avancer le statut</p>
      ${docRows}
    </div>
  </div>`;
}

// ── Export PDF détail étudiant ───────────────────────────────────
window._printStudentDetail = function(studentId, month) {
  const s = Data.getStudentById(studentId); if (!s) return;
  const provMap = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const subjMap = {}; (Data.getSubjects()||[]).forEach(x => subjMap[x.id] = x);
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const PROF_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

  let missions = Data.getMissions()
    .filter(m => (m.studentIds||[]).includes(s.id) && m.status !== 'cancelled')
    .sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if (month) missions = missions.filter(m => (m.date||'').startsWith(month));
  if (!missions.length) { alert('Aucune séance à exporter.'); return; }

  const totalH    = missions.reduce((a,m) => a+(m.duration||0), 0);
  const totalHT   = missions.reduce((a,m) => a+(m.duration||0)*(m.billingRate||0), 0);
  const totalCost = missions.reduce((a,m) => a+(m.duration||0)*(m.providerRate||0), 0);
  const totalMarge = totalHT - totalCost;

  const provOrder = []; const provSeen = new Set();
  missions.forEach(m => {
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : ['__none__']);
    pids.forEach(pid => { if (!provSeen.has(pid)) { provSeen.add(pid); provOrder.push(pid); } });
  });
  const provColor = {}; provOrder.forEach((pid,i) => { provColor[pid] = PROF_COLORS[i%PROF_COLORS.length]; });
  const byProv = {};
  missions.forEach(m => {
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : ['__none__']);
    const key = pids[0]; if (!byProv[key]) byProv[key] = []; byProv[key].push(m);
  });
  const courseName = m => {
    if (m.subjectId && subjMap[m.subjectId]) return subjMap[m.subjectId].name;
    return m.subject || m.title || '—';
  };
  const fmt = n => n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

  const monthLabel = month ? (() => { const [y,mi] = month.split('-'); return MONTHS_FR[+mi-1]+' '+y; })() : 'Historique complet';

  const provBlocks = provOrder.map(pid => {
    const p = provMap[pid]; const pms = byProv[pid]||[]; if(!pms.length) return '';
    const col = provColor[pid];
    const pH  = pms.reduce((a,m)=>a+(m.duration||0),0);
    const pHT = pms.reduce((a,m)=>a+(m.duration||0)*(m.billingRate||0),0);
    const pC  = pms.reduce((a,m)=>a+(m.duration||0)*(m.providerRate||0),0);
    const pM  = pHT-pC;
    const provName = p ? (p.firstName+' '+p.lastName).toUpperCase() : 'INCONNU';
    const rows = pms.map(m => {
      const d = new Date((m.date||'')+'T00:00:00');
      const day = d.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
      const h=m.duration||0, pu=m.billingRate||0, pp=m.providerRate||0;
      return `<tr>
        <td>${day}</td><td>${courseName(m)}</td>
        <td class="r">${h}h</td>
        <td class="r g">${pu>0?pu.toFixed(2)+' €':'—'}</td>
        <td class="r r2">${pp>0?pp.toFixed(2)+' €':'—'}</td>
        <td class="r g">${h*pu>0?fmt(h*pu):'—'}</td>
        <td class="r r2">${h*pp>0?fmt(h*pp):'—'}</td>
        <td class="r" style="color:${(pu-pp)*h>=0?'#15803d':'#dc2626'}">${fmt((pu-pp)*h)}</td>
      </tr>`;
    }).join('');
    return `<div class="prof-block">
      <div class="prof-header" style="background:${col}">
        <div><strong>${provName}</strong><br><small>${pms.length} séance${pms.length>1?'s':''} · ${pH}h</small></div>
        <div class="prof-totals">
          <div><div class="lbl">Facturé</div><div class="val">${fmt(pHT)}</div></div>
          <div><div class="lbl">Coût prof</div><div class="val">${pC>0?fmt(pC):'—'}</div></div>
          <div><div class="lbl">Marge</div><div class="val" style="color:${pM>=0?'#bbf7d0':'#fecaca'}">${fmt(pM)}</div></div>
        </div>
      </div>
      <table><thead><tr>
        <th>DATE</th><th>COURS</th><th class="r">H</th>
        <th class="r g">€/H FACT.</th><th class="r r2">€/H PROF</th>
        <th class="r g">FACTURÉ</th><th class="r r2">COÛT</th><th class="r">MARGE</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2"><strong>Total ${provName}</strong></td>
        <td class="r"><strong>${pH}h</strong></td><td></td><td></td>
        <td class="r g"><strong>${fmt(pHT)}</strong></td>
        <td class="r r2"><strong>${pC>0?fmt(pC):'—'}</strong></td>
        <td class="r" style="color:${pM>=0?'#15803d':'#dc2626'}"><strong>${fmt(pM)}</strong></td>
      </tr></tfoot></table>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Cours — ${s.firstName} ${s.lastName} — ${monthLabel}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; color: #1e293b; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 14px; }
    .header h1 { font-size: 14pt; font-weight: 800; }
    .header .sub { font-size: 8pt; color: #64748b; margin-top: 2px; }
    .kpis { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; text-align: center; }
    .kpi .lbl { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
    .kpi .val { font-size: 12pt; font-weight: 800; margin-top: 2px; }
    .kpi.g .val { color: #15803d; } .kpi.r2 .val { color: #dc2626; } .kpi.m .val { color: #0369a1; }
    .prof-block { margin-bottom: 12px; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; page-break-inside: avoid; }
    .prof-header { color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
    .prof-header strong { font-size: 9pt; } .prof-header small { font-size: 7.5pt; opacity: .8; }
    .prof-totals { display: flex; gap: 20px; text-align: right; }
    .prof-totals .lbl { font-size: 6.5pt; opacity: .75; text-transform: uppercase; letter-spacing:.05em; }
    .prof-totals .val { font-size: 9.5pt; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f8fafc; border-bottom: 1px solid #cbd5e1; }
    th { padding: 5px 8px; font-size: 6.5pt; font-weight: 700; text-align: left; color: #64748b; letter-spacing: .06em; }
    td { padding: 5px 8px; font-size: 8pt; border-bottom: 1px solid #f1f5f9; }
    tfoot td { border-top: 2px solid #cbd5e1; border-bottom: none; background: #f8fafc; font-size: 8.5pt; }
    .r { text-align: right; } .g { color: #15803d; } .r2 { color: #dc2626; }
    .total-box { border: 2px solid #1e293b; border-radius: 6px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
    .total-box .t { display: flex; gap: 24px; }
    .total-box .item .lbl { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .total-box .item .val { font-size: 13pt; font-weight: 800; margin-top: 2px; }
  </style></head><body>
  <div class="header">
    <div>
      <h1>${s.firstName.toUpperCase()} ${s.lastName.toUpperCase()}</h1>
      <div class="sub">${monthLabel} · ${missions.length} séance${missions.length>1?'s':''} · ${totalH}h · ${provOrder.length} intervenant${provOrder.length>1?'s':''}</div>
    </div>
    <div style="text-align:right;font-size:7.5pt;color:#64748b">Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
  </div>
  ${provBlocks}
  <div class="total-box">
    <div style="font-weight:700;font-size:9pt">TOTAL GÉNÉRAL</div>
    <div class="t">
      <div class="item"><div class="lbl">Total facturé</div><div class="val" style="color:#15803d">${fmt(totalHT)}</div></div>
      <div class="item"><div class="lbl">Coût profs</div><div class="val" style="color:#dc2626">${totalCost>0?fmt(totalCost):'—'}</div></div>
      <div class="item"><div class="lbl">Marge nette</div><div class="val" style="color:${totalMarge>=0?'#15803d':'#dc2626'}">${fmt(totalMarge)}</div></div>
    </div>
  </div>
  <script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close(); }<\/script>
  </body></html>`;

  const w = window.open('','_blank','width=1100,height=750');
  w.document.write(html);
  w.document.close();
};

// ── Export phase Qualiopi ────────────────────────────────────────
window._exportPhase = function(studentId, phaseIdx) {
  const s = Data.getStudentById(studentId); if (!s) return;
  const co = Data.getCompanyById(s.poleId||s.companyId);
  const ph = QPHASES[phaseIdx]; if (!ph) return;
  const steps = s.qSteps||[];
  const fors = {}; Data.getFormations().forEach(f=>fors[f.id]=f);
  const formNames = (s.formationIds||[]).map(id=>fors[id]?.name||'').filter(Boolean).join(', ');
  const today = new Date().toLocaleDateString('fr-FR');
  const rows = [
    [`SOMMAIRE — ${ph.label}`],
    [`Étudiant : ${s.firstName} ${s.lastName}`],
    [`Structure : ${co?.name||''}`],
    [`Formation : ${formNames}`],
    [`Date d'entrée : ${s.entryDate||'—'}`],
    [`Exporté le : ${today}`],
    [],
    ['Étape','Statut','Date de réalisation (à compléter)'],
    ...ph.steps.map(i=>[QSTEPS[i], SL[steps[i]||'rouge'], '']),
    [],
    ['Documents associés','Statut',''],
    ...ph.docs.map(k=>{ const d=QDOCS.find(x=>x.k===k); return d?[d.l, DL[(s.qDocs||{})[k]||'non_cree'], '']:null; }).filter(Boolean),
  ];
  _downloadCSV(rows, `qualiopi_phase${phaseIdx+1}_${s.lastName}.csv`);
};

// ── Export CSV ───────────────────────────────────────────────────
window._exportStudent = function(studentId, month) {
  const s = Data.getStudents().find(x=>x.id===studentId); if (!s) return;
  const subjects={};(Data.getSubjects()||[]).forEach(x=>subjects[x.id]=x);
  const providers={}; Data.getProviders().forEach(p=>providers[p.id]=p);
  const missions = Data.getMissions().filter(m=>
    (m.studentIds||[]).includes(studentId)&&m.status!=='cancelled'&&
    (!month||(m.date&&m.date.startsWith(month)))
  ).sort((a,b)=>a.date.localeCompare(b.date));
  const DAYS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const rows=[['Date','Jour','Heure début','Heure fin','Durée (h)','Matière','Prestataire',
    'Tarif facturé (€/h)','Total facturé (€)','Tarif prof (€/h)','Coût prof (€)','Marge (€)']];
  missions.forEach(m=>{
    const d=new Date(m.date+'T00:00:00');
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
    const provNames = pids.map(pid => { const p=providers[pid]; return p ? p.firstName+' '+p.lastName : ''; }).filter(Boolean).join(', ');
    const subj=m.subjectId?(subjects[m.subjectId]?.name||m.subject||''):(m.subject||m.title||'');
    const h=m.duration||0, pu=m.billingRate||0, pp=m.providerRate||0;
    rows.push([m.date,DAYS[d.getDay()],m.startTime||'',m.endTime||'',h.toFixed(2),subj,provNames,
      pu.toFixed(2),(h*pu).toFixed(2),pp.toFixed(2),(h*pp).toFixed(2),((h*pu)-(h*pp)).toFixed(2)]);
  });
  const totHT   = missions.reduce((a,m)=>a+(m.duration||0)*(m.billingRate||0),0);
  const totCost = missions.reduce((a,m)=>a+(m.duration||0)*(m.providerRate||0),0);
  rows.push(['','','','','','','','TOTAL FACTURÉ',totHT.toFixed(2),'COÛT PROF',totCost.toFixed(2),(totHT-totCost).toFixed(2)]);
  _downloadCSV(rows,`cours_${s.lastName}_${month||'complet'}.csv`);
};
