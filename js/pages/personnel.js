// personnel.js — Gestion du personnel interne (salaires fixes mensuels)
'use strict';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  document.getElementById('btn-add-staff').addEventListener('click', () => openStaffModal(null));
});

// ── Rendu principal ──────────────────────────────────────────────
function render() {
  const list   = document.getElementById('staff-list');
  const staff  = Data.getInternalStaff();
  const now    = new Date();
  const curM   = Utils.currentYearMonth(); // 'YYYY-MM'

  if (!staff.length) {
    list.innerHTML = `
      <div class="empty-page">
        <div class="empty-icon">👥</div>
        <h2>Aucun membre du personnel interne</h2>
        <p>Ajoutez les membres du personnel payés mensuellement (secrétaire, assistant, etc.)</p>
        <button class="btn btn-primary" onclick="openStaffModal(null)">+ Ajouter un membre</button>
      </div>`;
    return;
  }

  list.innerHTML = staff.map(s => staffCard(s, curM)).join('');
}

// ── Carte d'un membre ────────────────────────────────────────────
function staffCard(s, curM) {
  const color    = s.color || '#6366f1';
  const ini      = ((s.name||'')[0]||'?').toUpperCase();
  const payments = s.payments || [];

  // 12 derniers mois (du plus récent au plus ancien)
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const lbl = MONTHS_FR[d.getMonth()]+' '+d.getFullYear();
    const pay = payments.find(p => p.month === ym) || { month: ym, amount: s.monthlyCost || 0, paid: false, note: '' };
    months.push({ ym, lbl, pay });
  }

  const totalPaid   = months.filter(m => m.pay.paid).reduce((s,m) => s+(+m.pay.amount||0), 0);
  const totalUnpaid = months.filter(m => !m.pay.paid).reduce((s,m) => s+(+m.pay.amount||0), 0);

  const monthRows = months.map(({ ym, lbl, pay }) => {
    const isCur   = ym === curM;
    const badgeCl = pay.paid ? '#22c55e' : (ym <= curM ? '#ef4444' : '#94a3b8');
    const badgeLbl= pay.paid ? 'Payé' : (ym <= curM ? 'Non payé' : 'À venir');
    return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="min-width:130px;font-size:0.85rem;font-weight:${isCur?700:400}">${lbl}${isCur?' <span style="font-size:0.7rem;background:#3b82f6;color:#fff;border-radius:4px;padding:1px 6px">En cours</span>':''}</div>
      <div style="flex:1;font-size:0.88rem;font-weight:600">${Utils.formatMoney(+pay.amount||0)}</div>
      <span style="font-size:0.72rem;font-weight:700;padding:2px 10px;border-radius:12px;background:${badgeCl}20;color:${badgeCl}">${badgeLbl}</span>
      ${pay.note ? `<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic">${Utils.escapeHtml(pay.note)}</span>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="togglePayment('${s.id}','${ym}',${!pay.paid})">
        ${pay.paid ? '↩ Annuler' : '✓ Marquer payé'}
      </button>
    </div>`;
  }).join('');

  return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px">
    <!-- En-tête -->
    <div style="background:${color};padding:14px 20px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;color:#fff">${ini}</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:1rem;color:#fff">${Utils.escapeHtml(s.name)}</div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,.8)">${Utils.escapeHtml(s.role||'')} · ${Utils.formatMoney(s.monthlyCost||0)}/mois</div>
      </div>
      <div style="text-align:right;display:flex;gap:8px">
        <div style="text-align:right">
          <div style="font-size:0.68rem;color:rgba(255,255,255,.7);text-transform:uppercase">Payé (12 mois)</div>
          <div style="font-size:1rem;font-weight:800;color:#fff">${Utils.formatMoney(totalPaid)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:0.68rem;color:rgba(255,255,255,.7);text-transform:uppercase">Dû</div>
          <div style="font-size:1rem;font-weight:800;color:#fca5a5">${Utils.formatMoney(totalUnpaid)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-left:8px">
          <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4)" onclick="openStaffModal('${s.id}')">✏ Modifier</button>
          <button class="btn btn-sm" style="background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.3);font-size:0.75rem" onclick="deleteStaff('${s.id}')">🗑 Supprimer</button>
        </div>
      </div>
    </div>
    <!-- Historique paiements -->
    <div style="padding:16px 20px">
      <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Historique 12 mois</div>
      ${monthRows}
    </div>
  </div>`;
}

// ── Toggle paiement ───────────────────────────────────────────────
window.togglePayment = function(staffId, month, paid) {
  const s = Data.getInternalStaffById(staffId); if (!s) return;
  const payments = [...(s.payments||[])];
  const idx = payments.findIndex(p => p.month === month);
  if (idx >= 0) {
    payments[idx] = { ...payments[idx], paid };
  } else {
    payments.push({ month, amount: s.monthlyCost || 0, paid, note: '' });
  }
  Data.saveInternalStaff({ ...s, payments });
  render();
};

// ── Modal ajout/modification ──────────────────────────────────────
window.openStaffModal = function(id) {
  const s = id ? Data.getInternalStaffById(id) : null;
  const isNew = !s;
  const COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
  const swatches = COLORS.map(c => `<button type="button" class="color-swatch${(s?.color||COLORS[0])===c?' selected':''}" style="background:${c}" data-color="${c}" title="${c}" onclick="document.getElementById('staff-color').value='${c}';this.parentNode.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('selected'));this.classList.add('selected')"></button>`).join('');

  Modals._open(`
    <div class="modal-header">
      <h3>${isNew?'Nouveau membre du personnel':'Modifier le membre'}</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>Nom *</label>
          <input type="text" id="staff-name" class="form-input" value="${Utils.escapeHtml(s?.name||'')}" placeholder="Ex : Secrétariat">
        </div>
        <div class="form-group form-col-2">
          <label>Rôle / Poste</label>
          <input type="text" id="staff-role" class="form-input" value="${Utils.escapeHtml(s?.role||'')}" placeholder="Ex : Secrétaire administrative">
        </div>
        <div class="form-group form-col-2">
          <label>Salaire mensuel (€)</label>
          <input type="number" id="staff-cost" class="form-input" value="${s?.monthlyCost||''}" min="0" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group form-col-2">
          <label>Couleur</label>
          <input type="hidden" id="staff-color" value="${s?.color||COLORS[0]}">
          <div style="display:flex;flex-wrap:wrap;gap:6px">${swatches}</div>
        </div>
        <div class="form-group form-col-2">
          <label>Notes</label>
          <textarea id="staff-notes" class="form-input" rows="2" placeholder="Informations complémentaires…">${Utils.escapeHtml(s?.notes||'')}</textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="saveStaff(${id?`'${id}'`:'null'})">Enregistrer</button>
    </div>
  `);
};

window.saveStaff = function(id) {
  const name = document.getElementById('staff-name')?.value.trim();
  if (!name) { Utils.toast('Le nom est requis.', 'error'); return; }
  const existing = id ? Data.getInternalStaffById(id) : null;
  Data.saveInternalStaff({
    id:          id || Utils.uuid(),
    name,
    role:        document.getElementById('staff-role')?.value.trim() || '',
    monthlyCost: parseFloat(document.getElementById('staff-cost')?.value) || 0,
    color:       document.getElementById('staff-color')?.value || '#6366f1',
    notes:       document.getElementById('staff-notes')?.value.trim() || '',
    payments:    existing?.payments || [],
  });
  Modals.close();
  render();
};

window.deleteStaff = function(id) {
  Modals.confirm('Supprimer ce membre du personnel ?', () => {
    Data.deleteInternalStaff(id);
    render();
  }, 'Supprimer', true);
};
