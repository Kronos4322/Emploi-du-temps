// patrimoine.js — Gestion du patrimoine : entités, comptes, parts sociales, immobilier
'use strict';

const ENTITY_TYPES = {
  societe: { label: 'Société',   icon: '🏢' },
  sci:     { label: 'SCI',       icon: '🏛' },
  perso:   { label: 'Personnel', icon: '👤' },
  autre:   { label: 'Autre',     icon: '📦' },
};

const ASSET_KINDS = {
  bank:     { label: 'Compte bancaire', icon: '🏦', plural: 'Comptes bancaires' },
  shares:   { label: 'Parts sociales',  icon: '📜', plural: 'Parts sociales' },
  property: { label: 'Bien immobilier', icon: '🏠', plural: 'Immobilier' },
};

const ENTITY_COLORS = ['#7c3aed','#0891b2','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#64748b'];

function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  document.getElementById('btn-add-entity').addEventListener('click', () => openEntityModal(null));
});

// ── Valorisation d'un actif ──────────────────────────────────────
// bank     → montant du compte
// shares   → nb de parts × valeur unitaire
// property → valeur estimée (brut) ; net = brut − capital restant dû
function assetGross(a) {
  if (a.kind === 'shares')   return Math.round((a.sharesCount||0) * (a.shareValue||0) * 100) / 100;
  if (a.kind === 'property') return a.propertyValue || 0;
  return a.amount || 0;
}
function assetNet(a) {
  if (a.kind === 'property') return Math.round(((a.propertyValue||0) - (a.loanRemaining||0)) * 100) / 100;
  return assetGross(a);
}

function render() {
  const entities = Data.getWealthEntities();
  const assets   = Data.getWealthAssets();

  // ── KPIs globaux ───────────────────────────────────────────────
  const banks  = assets.filter(a => a.kind === 'bank');
  const shares = assets.filter(a => a.kind === 'shares');
  const props  = assets.filter(a => a.kind === 'property');
  const mobilier    = Math.round((banks.reduce((s,a)=>s+assetGross(a),0) + shares.reduce((s,a)=>s+assetGross(a),0))*100)/100;
  const immoBrut    = Math.round(props.reduce((s,a)=>s+assetGross(a),0)*100)/100;
  const credits     = Math.round(props.reduce((s,a)=>s+(a.loanRemaining||0),0)*100)/100;
  const immoNet     = Math.round((immoBrut - credits)*100)/100;
  const totalNet    = Math.round((mobilier + immoNet)*100)/100;

  document.getElementById('wealth-kpis').innerHTML = `
    <div class="kpi-card kpi-large ${totalNet >= 0 ? 'kpi-positive' : 'kpi-negative'}">
      <div class="kpi-icon kpi-green">💰</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(totalNet)}</div>
        <div class="kpi-label">Patrimoine net total</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-blue">🏦</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(mobilier)}</div>
        <div class="kpi-label">Mobilier (comptes + parts)</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-teal">🏠</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(immoNet)}</div>
        <div class="kpi-label">Immobilier net ${credits > 0 ? `<span style="font-size:0.7rem;color:var(--text-muted)">(${Utils.formatMoney(immoBrut)} − ${Utils.formatMoney(credits)} de crédit)</span>` : ''}</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-purple">🏢</div>
      <div class="kpi-content">
        <div class="kpi-value">${entities.length}</div>
        <div class="kpi-label">Entité${entities.length > 1 ? 's' : ''}</div>
      </div>
    </div>`;

  // ── Cartes entités ─────────────────────────────────────────────
  const list = document.getElementById('entities-list');
  if (entities.length === 0) {
    list.innerHTML = `<div class="empty-page">
      <div class="empty-icon">💰</div>
      <h2>Aucune entité patrimoniale</h2>
      <p>Créez vos structures (Artémis, Astéria, patrimoine personnel, SCI…) puis ajoutez-y comptes bancaires, parts sociales et biens immobiliers.</p>
      <button class="btn btn-primary" onclick="openEntityModal(null)">+ Ajouter une entité</button>
    </div>`;
    return;
  }
  list.innerHTML = entities.map(e => entityCard(e, assets.filter(a => a.entityId === e.id))).join('');
}

function entityCard(e, assets) {
  const color = e.color || '#64748b';
  const type  = ENTITY_TYPES[e.type] || ENTITY_TYPES.autre;
  const net   = Math.round(assets.reduce((s,a)=>s+assetNet(a),0)*100)/100;

  const sections = Object.entries(ASSET_KINDS).map(([kind, k]) => {
    const items = assets.filter(a => a.kind === kind);
    const sub   = Math.round(items.reduce((s,a)=>s+assetNet(a),0)*100)/100;
    const rows  = items.map(a => {
      let detail = '';
      if (a.kind === 'shares') {
        detail = `<span style="font-size:0.75rem;color:var(--text-muted)">${a.sharesCount||0} part${(a.sharesCount||0)>1?'s':''} × ${Utils.formatMoney(a.shareValue||0)}</span>`;
      } else if (a.kind === 'property' && (a.loanRemaining||0) > 0) {
        detail = `<span style="font-size:0.75rem;color:var(--text-muted)">valeur ${Utils.formatMoney(a.propertyValue||0)} − crédit ${Utils.formatMoney(a.loanRemaining)}</span>`;
      }
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:0.88rem">${Utils.escapeHtml(a.name)}
          ${a.notes ? `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic"> — ${Utils.escapeHtml(a.notes)}</span>` : ''}
          ${detail ? '<br>'+detail : ''}
        </span>
        <span style="font-weight:700;font-size:0.92rem;white-space:nowrap;color:${assetNet(a) >= 0 ? 'var(--text)' : 'var(--danger)'}">${Utils.formatMoney(assetNet(a))}</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px" onclick="openAssetModal('${e.id}','${kind}','${a.id}')">✏</button>
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;color:var(--danger)" onclick="deleteAsset('${a.id}')">🗑</button>
      </div>`;
    }).join('');
    return `<div style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
        <span style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">${k.icon} ${k.plural}</span>
        ${items.length ? `<span style="font-size:0.8rem;font-weight:700;color:${color}">${Utils.formatMoney(sub)}</span>` : ''}
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;padding:1px 8px;font-size:0.75rem" onclick="openAssetModal('${e.id}','${kind}',null)">+ Ajouter</button>
      </div>
      ${rows || `<div style="font-size:0.8rem;color:var(--text-muted);font-style:italic;padding:4px 0">Aucun élément</div>`}
    </div>`;
  }).join('');

  return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px">
    <div style="background:${color};padding:14px 20px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:1.2rem">${type.icon}</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:1rem;color:#fff">${Utils.escapeHtml(e.name)}</div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,.8)">${type.label}${e.notes ? ' · ' + Utils.escapeHtml(e.notes) : ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.68rem;color:rgba(255,255,255,.7);text-transform:uppercase">Valeur nette</div>
        <div style="font-size:1.15rem;font-weight:800;color:#fff">${Utils.formatMoney(net)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-left:8px">
        <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4)" onclick="openEntityModal('${e.id}')">✏ Modifier</button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.3);font-size:0.75rem" onclick="deleteEntity('${e.id}')">🗑 Supprimer</button>
      </div>
    </div>
    <div style="padding:8px 20px 16px">${sections}</div>
  </div>`;
}

// ── Modale entité ────────────────────────────────────────────────
window.openEntityModal = function(id) {
  const e = id ? Data.getWealthEntityById(id) : null;
  const isNew = !e;
  const swatches = ENTITY_COLORS.map(c => `<button type="button" class="color-swatch${(e?.color||ENTITY_COLORS[0])===c?' selected':''}" style="background:${c}" data-color="${c}"
    onclick="document.getElementById('ent-color').value='${c}';this.parentNode.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('selected'));this.classList.add('selected')"></button>`).join('');
  const typeOpts = Object.entries(ENTITY_TYPES).map(([v,t]) =>
    `<option value="${v}" ${e?.type===v?'selected':''}>${t.icon} ${t.label}</option>`).join('');

  Modals._open(`
    <div class="modal-header">
      <h3>${isNew ? 'Nouvelle entité patrimoniale' : 'Modifier l\'entité'}</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>Nom *</label>
          <input type="text" id="ent-name" class="form-input" value="${Utils.escapeHtml(e?.name||'')}" placeholder="Ex : SCI Les Écureuils, Compte perso…">
        </div>
        <div class="form-group form-col-2">
          <label>Type</label>
          <select id="ent-type" class="form-input">${typeOpts}</select>
        </div>
        <div class="form-group form-col-2">
          <label>Couleur</label>
          <input type="hidden" id="ent-color" value="${e?.color||ENTITY_COLORS[0]}">
          <div style="display:flex;flex-wrap:wrap;gap:6px">${swatches}</div>
        </div>
        <div class="form-group form-col-2">
          <label>Notes</label>
          <input type="text" id="ent-notes" class="form-input" value="${Utils.escapeHtml(e?.notes||'')}" placeholder="Optionnel">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="saveEntity(${id?`'${id}'`:'null'})">Enregistrer</button>
    </div>
  `);
};

window.saveEntity = function(id) {
  const name = document.getElementById('ent-name')?.value.trim();
  if (!name) { Utils.toast('Le nom est requis.', 'error'); return; }
  const existing = id ? Data.getWealthEntityById(id) : null;
  Data.saveWealthEntity({
    ...(existing || {}),
    id:    id || Utils.uuid(),
    name,
    type:  document.getElementById('ent-type')?.value || 'autre',
    color: document.getElementById('ent-color')?.value || ENTITY_COLORS[0],
    notes: document.getElementById('ent-notes')?.value.trim() || '',
  });
  Modals.close();
  render();
};

window.deleteEntity = function(id) {
  const e = Data.getWealthEntityById(id);
  if (!e) return;
  const count = Data.getWealthAssets(id).length;
  Modals.confirm(`Supprimer "${e.name}"${count ? ` et ses ${count} élément(s)` : ''} ? Cette action est irréversible.`, () => {
    Data.deleteWealthEntity(id);
    render();
  }, 'Supprimer', true);
};

// ── Modale actif (compte / parts / bien) ─────────────────────────
window.openAssetModal = function(entityId, kind, assetId) {
  const a = assetId ? Data.getWealthAssetById(assetId) : null;
  kind = a?.kind || kind || 'bank';
  const k = ASSET_KINDS[kind];
  const ent = Data.getWealthEntityById(entityId);
  const isNew = !a;

  const placeholders = {
    bank:     'Ex : CCP, Livret excédents, Compte courant…',
    shares:   'Ex : Parts SCI Les Écureuils',
    property: 'Ex : Appartement Marrakech — Guéliz',
  };

  let fields = '';
  if (kind === 'bank') {
    fields = `<div class="form-group form-col-2">
      <label>Solde actuel (€) *</label>
      <input type="number" id="as-amount" class="form-input" step="0.01" value="${a?.amount ?? ''}" placeholder="0.00">
    </div>`;
  } else if (kind === 'shares') {
    fields = `
      <div class="form-group form-col-2">
        <label>Nombre de parts *</label>
        <input type="number" id="as-shares-count" class="form-input" step="1" min="0" value="${a?.sharesCount ?? ''}" placeholder="0">
      </div>
      <div class="form-group form-col-2">
        <label>Valeur unitaire (€) *</label>
        <input type="number" id="as-share-value" class="form-input" step="0.01" min="0" value="${a?.shareValue ?? ''}" placeholder="0.00">
      </div>
      <div class="form-group form-col-2">
        <label>Valeur totale</label>
        <div id="as-shares-total" style="padding:8px 0;font-weight:700">${Utils.formatMoney((a?.sharesCount||0)*(a?.shareValue||0))}</div>
      </div>`;
  } else {
    fields = `
      <div class="form-group form-col-2">
        <label>Valeur estimée du bien (€) *</label>
        <input type="number" id="as-prop-value" class="form-input" step="100" min="0" value="${a?.propertyValue ?? ''}" placeholder="0">
      </div>
      <div class="form-group form-col-2">
        <label>Capital restant dû (crédit, €)</label>
        <input type="number" id="as-loan" class="form-input" step="100" min="0" value="${a?.loanRemaining ?? ''}" placeholder="0 si aucun crédit">
      </div>
      <div class="form-group form-col-2">
        <label>Valeur nette</label>
        <div id="as-prop-net" style="padding:8px 0;font-weight:700">${Utils.formatMoney((a?.propertyValue||0)-(a?.loanRemaining||0))}</div>
      </div>`;
  }

  Modals._open(`
    <div class="modal-header">
      <h3>${k.icon} ${isNew ? k.label : 'Modifier — ' + Utils.escapeHtml(a.name)} <span style="font-size:0.8rem;color:var(--text-muted)">· ${Utils.escapeHtml(ent?.name||'')}</span></h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>Nom *</label>
          <input type="text" id="as-name" class="form-input" value="${Utils.escapeHtml(a?.name||'')}" placeholder="${placeholders[kind]}">
        </div>
        ${fields}
        <div class="form-group form-col-2">
          <label>Notes</label>
          <input type="text" id="as-notes" class="form-input" value="${Utils.escapeHtml(a?.notes||'')}" placeholder="Optionnel">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="saveAsset('${entityId}','${kind}',${assetId?`'${assetId}'`:'null'})">Enregistrer</button>
    </div>
  `);

  // Aperçus dynamiques
  if (kind === 'shares') {
    const upd = () => {
      const c = parseFloat(document.getElementById('as-shares-count')?.value)||0;
      const v = parseFloat(document.getElementById('as-share-value')?.value)||0;
      const el = document.getElementById('as-shares-total');
      if (el) el.textContent = Utils.formatMoney(Math.round(c*v*100)/100);
    };
    ['as-shares-count','as-share-value'].forEach(i => document.getElementById(i)?.addEventListener('input', upd));
  } else if (kind === 'property') {
    const upd = () => {
      const v = parseFloat(document.getElementById('as-prop-value')?.value)||0;
      const l = parseFloat(document.getElementById('as-loan')?.value)||0;
      const el = document.getElementById('as-prop-net');
      if (el) el.textContent = Utils.formatMoney(Math.round((v-l)*100)/100);
    };
    ['as-prop-value','as-loan'].forEach(i => document.getElementById(i)?.addEventListener('input', upd));
  }
};

window.saveAsset = function(entityId, kind, assetId) {
  const name = document.getElementById('as-name')?.value.trim();
  if (!name) { Utils.toast('Le nom est requis.', 'error'); return; }
  const existing = assetId ? Data.getWealthAssetById(assetId) : null;
  const asset = {
    ...(existing || {}),
    id: assetId || Utils.uuid(),
    entityId, kind, name,
    notes: document.getElementById('as-notes')?.value.trim() || '',
  };
  if (kind === 'bank') {
    asset.amount = parseFloat(document.getElementById('as-amount')?.value) || 0;
  } else if (kind === 'shares') {
    asset.sharesCount = parseFloat(document.getElementById('as-shares-count')?.value) || 0;
    asset.shareValue  = parseFloat(document.getElementById('as-share-value')?.value) || 0;
  } else if (kind === 'property') {
    asset.propertyValue = parseFloat(document.getElementById('as-prop-value')?.value) || 0;
    asset.loanRemaining = parseFloat(document.getElementById('as-loan')?.value) || 0;
  }
  Data.saveWealthAsset(asset);
  Modals.close();
  render();
};

window.deleteAsset = function(id) {
  const a = Data.getWealthAssetById(id);
  if (!a) return;
  Modals.confirm(`Supprimer "${a.name}" (${Utils.formatMoney(assetNet(a))}) ?`, () => {
    Data.deleteWealthAsset(id);
    render();
  }, 'Supprimer', true);
};
