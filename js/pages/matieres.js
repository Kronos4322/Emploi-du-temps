// matieres.js — Référentiel des matières / cours
'use strict';

let _filterSchool = null; // null = toutes
let _filterSearch = '';

function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  document.getElementById('btn-new-subject').addEventListener('click', () => openSubjectModal(null));
});

function render() {
  let subjects  = Data.getSubjects();
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const missions  = Data.getMissions().filter(m => m.status !== 'cancelled');
  const list      = document.getElementById('subjects-list');
  const schools   = Data.getClientSchools();

  // Barre de filtres
  let filterBar = document.getElementById('mat-filter-bar');
  if (!filterBar) {
    filterBar = document.createElement('div');
    filterBar.id = 'mat-filter-bar';
    filterBar.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap';
    list.parentElement.insertBefore(filterBar, list);
  }
  const allSubjects = Data.getSubjects();
  filterBar.innerHTML =
    `<select onchange="window._matSearch(this.value)"
      style="flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.85rem;background:var(--bg-card);cursor:pointer">
      <option value="">— Toutes les matières —</option>
      ${allSubjects.map(s=>`<option value="${s.name}" ${_filterSearch===s.name?'selected':''}>${Utils.escapeHtml(s.name)}</option>`).join('')}
    </select>
    <select onchange="window._matSchool(this.value)"
      style="flex:1;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.85rem;background:var(--bg-card);cursor:pointer">
      <option value="">— Toutes les écoles —</option>
      ${schools.map(co=>`<option value="${co.id}" ${_filterSchool===co.id?'selected':''}>${Utils.escapeHtml(co.name)}</option>`).join('')}
    </select>`;

  window._matSearch = v => { _filterSearch = v; render(); };
  window._matSchool = id => { _filterSchool = id || null; render(); };

  // Appliquer filtres
  if (_filterSchool) subjects = subjects.filter(s => (s.schoolIds||[]).includes(_filterSchool));
  if (_filterSearch) subjects = subjects.filter(s => s.name === _filterSearch);

  if (Data.getSubjects().length === 0) {
    list.innerHTML = `<div class="empty-page"><div class="empty-icon">📖</div><h2>Aucune matière</h2><p>Créez des matières pour les associer aux écoles et missions.</p><button class="btn btn-primary" onclick="openSubjectModal(null)">+ Nouvelle matière</button></div>`;
    return;
  }
  if (subjects.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);padding:20px">Aucune matière pour ce filtre.</p>`;
    return;
  }

  const LEVEL_COLORS = { college:'#f97316', lycee:'#8b5cf6', superieur:'#3b82f6' };
  list.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">${subjects.map(s => {
    const sm      = missions.filter(m => m.subjectId === s.id);
    const done      = sm.filter(m => m.status === 'done');
    const planned   = sm.filter(m => m.status === 'planned');
    const totalH    = sm.reduce((a,m) => a+(m.duration||0), 0);
    const plannedH  = planned.reduce((a,m) => a+(m.duration||0), 0);
    const schoolObjs = (s.schoolIds||[]).map(id => companies[id]).filter(Boolean);
    const color   = LEVEL_COLORS[s.level] || '#64748b';
    const LEVEL_LABEL = {college:'Collège',lycee:'Lycée',superieur:'Supérieur'};
    return `<div onclick="openSubjectModal('${s.id}')" style="background:var(--bg-card);border-radius:var(--radius);overflow:hidden;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.07);transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,.13)'" onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.07)'">
      <div style="background:${color};padding:14px 16px">
        <div style="font-weight:700;font-size:0.92rem;color:#fff;line-height:1.3">${Utils.escapeHtml(s.name)}</div>
        ${s.level ? `<span style="font-size:0.7rem;background:rgba(255,255,255,.25);color:#fff;padding:1px 7px;border-radius:10px;margin-top:4px;display:inline-block">${LEVEL_LABEL[s.level]||s.level}</span>` : ''}
        ${s.classes?.length ? `<span style="font-size:0.7rem;color:rgba(255,255,255,.8);margin-left:4px">${s.classes.join(', ')}</span>` : ''}
      </div>
      <div style="padding:12px 16px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;margin-bottom:10px">
          <div><div style="font-weight:700;font-size:1.1rem;color:${color}">${Utils.formatDuration(totalH)}</div><div style="font-size:0.7rem;color:var(--text-muted)">Volume</div></div>
          <div><div style="font-weight:700;font-size:1.1rem">${done.length}</div><div style="font-size:0.7rem;color:var(--text-muted)">Réalisés</div></div>
          <div><div style="font-weight:700;font-size:1.1rem;color:#d97706">${Utils.formatDuration(plannedH)}</div><div style="font-size:0.7rem;color:var(--text-muted)">À venir</div></div>
        </div>
        ${schoolObjs.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${schoolObjs.map(co=>`<span style="font-size:0.7rem;padding:2px 7px;border-radius:10px;background:${co.color||'var(--surface)'};color:${co.color?Utils.contrastColor(co.color):'var(--text)'}">${Utils.escapeHtml(co.name)}</span>`).join('')}</div>` : ''}
        ${s.notes ? `<div style="margin-top:6px;font-size:0.75rem;font-style:italic;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.escapeHtml(s.notes)}</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openSubjectModal(subjectId) {
  const sub = subjectId ? Data.getSubjects().find(s => s.id === subjectId) : null;
  const isNew = !sub;
  const s = sub || { name:'', color:'#3b82f6', level:'', notes:'', schoolIds:[] };
  const allSchools = Data.getClientSchools();
  const schoolChecks = allSchools.map(co =>
    `<label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
      <input type="checkbox" name="subj-school" value="${co.id}" ${(s.schoolIds||[]).includes(co.id)?'checked':''}> ${Utils.escapeHtml(co.name)}
    </label>`).join('');

  const _CLASS_MAP = {college:['6e','5e','4e','3e'],lycee:['2nde','1ère','Terminale'],superieur:['BTS1','BTS2','B1','B2','B3','M1','M2','MBA']};
  window._sfLevelChange = v => {
    const cls = _CLASS_MAP[v] || [];
    const g = document.getElementById('sf-classes-group');
    g.style.display = cls.length ? '' : 'none';
    document.getElementById('sf-classes-wrap').innerHTML = cls.map(c =>
      `<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem"><input type="checkbox" name="sf-class" value="${c}"> ${c}</label>`
    ).join('');
  };

  Modals._open(`
    <div class="modal-header">
      <h3>${isNew ? 'Nouvelle matière' : 'Modifier la matière'}</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body modal-body-scroll">
      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>Nom *</label>
          <input type="text" id="sf-name" class="form-input" value="${Utils.escapeHtml(s.name)}" placeholder="Ex: Communication, Histoire...">
        </div>
        <div class="form-group">
          <label>Niveau cible</label>
          <select id="sf-level" class="form-input" onchange="window._sfLevelChange(this.value)">
            <option value="" ${!s.level?'selected':''}>— Tous niveaux —</option>
            <option value="college"   ${s.level==='college'?'selected':''}>Collège</option>
            <option value="lycee"     ${s.level==='lycee'?'selected':''}>Lycée</option>
            <option value="superieur" ${s.level==='superieur'?'selected':''}>Supérieur</option>
          </select>
        </div>
        <div class="form-group" id="sf-classes-group" style="${s.level?'':'display:none'}">
          <label>Classes</label>
          <div id="sf-classes-wrap" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius)">
            ${(({'college':['6e','5e','4e','3e'],'lycee':['2nde','1ère','Terminale'],'superieur':['B1','B2','B3','M1','M2','MBA']})[s.level]||[])
              .map(c=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem"><input type="checkbox" name="sf-class" value="${c}" ${(s.classes||[]).includes(c)?'checked':''}> ${c}</label>`).join('')}
          </div>
        </div>
        <div class="form-group form-col-2">
          <label>Écoles associées</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;border:1px solid var(--border);border-radius:var(--radius)">${schoolChecks||'Aucune école client'}</div>
        </div>
        <div class="form-group form-col-2">
          <label>Notes</label>
          <textarea id="sf-notes" class="form-input form-textarea">${Utils.escapeHtml(s.notes||'')}</textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-subj-btn">Supprimer</button>` : ''}
      <div style="flex:1"></div>
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" id="save-subj-btn">${isNew?'Créer':'Enregistrer'}</button>
    </div>
  `);

  document.getElementById('save-subj-btn').addEventListener('click', () => {
    const name = document.getElementById('sf-name').value.trim();
    if (!name) { Utils.toast('Le nom est obligatoire.', 'error'); return; }
    const schoolIds = [...document.querySelectorAll('input[name="subj-school"]:checked')].map(i => i.value);
    Data.saveSubject({ id: s.id || Utils.uuid(), name,
      level:   document.getElementById('sf-level').value,
      classes: [...document.querySelectorAll('input[name="sf-class"]:checked')].map(i=>i.value),
      notes:   document.getElementById('sf-notes').value.trim(),
      schoolIds });
    Utils.toast(isNew ? 'Matière créée.' : 'Matière mise à jour.', 'success');
    Modals.close(); renderPage();
  });

  const delBtn = document.getElementById('del-subj-btn');
  if (delBtn) delBtn.addEventListener('click', () => {
    Data.deleteSubject(s.id);
    Utils.toast('Matière supprimée.', 'success');
    Modals.close(); renderPage();
  });
}
