// location.js — Gestion des revenus locatifs
'use strict';

let _locMonth      = Utils.currentYearMonth();
let _locPropertyId = '';

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  _buildMonthFilter();
  _buildPropertyFilter();
  _renderPage();

  document.getElementById('loc-filter-month').addEventListener('change', e => {
    _locMonth = e.target.value;
    document.getElementById('loc-filter-month').value = _locMonth;
    _renderPage();
  });
  document.getElementById('loc-filter-property').addEventListener('change', e => {
    _locPropertyId = e.target.value;
    _renderPage();
  });
  document.getElementById('btn-add-property').addEventListener('click', () => _openPropertyDrawer(null));
  document.getElementById('btn-add-income').addEventListener('click', () => _openIncomeDrawer(null));
  document.getElementById('loc-overlay').addEventListener('click', _locCloseDrawers);
});

// ── Filtres ──────────────────────────────────────────────────

function _buildMonthFilter() {
  const now  = new Date();
  const end  = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const months = [];
  const incomes = Data.getRentalIncomes();
  const first   = incomes.map(r => r.yearMonth).sort()[0];
  const stopYm  = first || `${now.getFullYear() - 1}-01`;
  for (let d = new Date(end); ; d.setMonth(d.getMonth() - 1)) {
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
    if (ym <= stopYm) break;
  }
  const el = document.getElementById('loc-filter-month');
  el.innerHTML = months.map(ym => {
    const [y, m] = ym.split('-');
    return `<option value="${ym}" ${ym === _locMonth ? 'selected' : ''}>${Utils.MONTHS_LONG[+m - 1]} ${y}</option>`;
  }).join('');
}

function _buildPropertyFilter() {
  const props = Data.getProperties();
  const el = document.getElementById('loc-filter-property');
  el.innerHTML = '<option value="">Tous les biens</option>' +
    props.map(p => `<option value="${p.id}" ${p.id === _locPropertyId ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('');
}

// ── Rendu principal ──────────────────────────────────────────

function _renderPage() {
  _renderKpis();
  _renderProperties();
  _renderIncomes();
  // Mettre à jour le label mois
  const [y, m] = _locMonth.split('-');
  document.getElementById('loc-month-label').textContent = `${Utils.MONTHS_LONG[+m - 1]} ${y}`;
}

function _renderKpis() {
  const allIncomes   = Data.getRentalIncomes();
  const monthIncomes = allIncomes.filter(r => r.yearMonth === _locMonth);
  const monthTotal   = monthIncomes.reduce((s, r) => s + (r.amount || 0), 0);
  const pending      = monthIncomes.filter(r => r.status !== 'received').reduce((s, r) => s + (r.amount || 0), 0);

  // Revenus 12 derniers mois
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const cutYm  = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
  const yearTotal = allIncomes.filter(r => r.yearMonth >= cutYm).reduce((s, r) => s + (r.amount || 0), 0);

  document.getElementById('loc-kpi-total').textContent   = Utils.formatMoney(monthTotal);
  document.getElementById('loc-kpi-year').textContent    = Utils.formatMoney(yearTotal);
  document.getElementById('loc-kpi-props').textContent   = Data.getActiveProperties().length;
  document.getElementById('loc-kpi-pending').textContent = Utils.formatMoney(pending);

  const pendingCard = document.getElementById('loc-kpi-pending-card');
  if (pendingCard) pendingCard.className = pending > 0 ? 'kpi-card kpi-alert-card' : 'kpi-card kpi-success-card';
}

function _renderProperties() {
  const props   = Data.getProperties();
  const allInc  = Data.getRentalIncomes();
  const container = document.getElementById('properties-list');
  if (!props.length) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Aucun bien enregistré. Cliquez sur "+ Ajouter un bien" pour commencer.</p></div>';
    return;
  }

  container.innerHTML = props.map(p => {
    const incomes  = allInc.filter(r => r.propertyId === p.id);
    const total    = incomes.reduce((s, r) => s + (r.amount || 0), 0);
    const monthInc = incomes.filter(r => r.yearMonth === _locMonth).reduce((s, r) => s + (r.amount || 0), 0);
    const TYPE_LABELS = { airbnb: 'Airbnb', booking: 'Booking', 'long-term': 'Longue durée', seasonal: 'Saisonnier', other: 'Autre' };
    const statusDot = p.active === false ? '<span style="font-size:0.72rem;color:var(--text-muted);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1px 7px;margin-left:4px">Inactif</span>' : '';
    return `<div class="property-card">
      <div class="property-card-header">
        <div class="property-color-dot" style="background:${p.color || '#94a3b8'}"></div>
        <div>
          <div class="property-name">${Utils.escapeHtml(p.name)}${statusDot}</div>
          <div class="property-meta">${Utils.escapeHtml(p.address || '')}${p.address && p.type ? ' · ' : ''}${TYPE_LABELS[p.type] || ''}</div>
        </div>
      </div>
      ${p.notes ? `<div class="property-meta" style="margin-top:6px">${Utils.escapeHtml(p.notes)}</div>` : ''}
      <div class="property-stats">
        <div><div class="property-stat-value">${Utils.formatMoney(monthInc)}</div><div>Ce mois</div></div>
        <div><div class="property-stat-value">${Utils.formatMoney(total)}</div><div>Total</div></div>
        <div><div class="property-stat-value">${incomes.length}</div><div>Entrées</div></div>
      </div>
      <div class="property-actions">
        <button class="btn btn-ghost btn-sm" onclick="window._locOpenPropertyDrawer('${p.id}')">✏ Modifier</button>
        <button class="btn btn-ghost btn-sm" onclick="window._locAddIncomeForProp('${p.id}')">+ Revenu</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="window._locDeleteProperty('${p.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function _renderIncomes() {
  let incomes = Data.getRentalIncomesByMonth(_locMonth);
  if (_locPropertyId) incomes = incomes.filter(r => r.propertyId === _locPropertyId);
  incomes = incomes.sort((a, b) => (a.propertyId || '').localeCompare(b.propertyId || ''));

  const propMap = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const total   = incomes.reduce((s, r) => s + (r.amount || 0), 0);

  const STATUS = {
    received: '<span class="badge badge-success">Reçu</span>',
    pending:  '<span class="badge badge-invoiced">En attente</span>',
    partial:  '<span class="badge badge-danger">Partiel</span>',
  };

  const tbody = document.getElementById('incomes-tbody');
  tbody.innerHTML = incomes.length === 0
    ? `<tr><td colspan="7" class="empty-state-cell">Aucun revenu enregistré pour ce mois.
        <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="window._locOpenIncomeDrawer(null)">+ Ajouter</button></td></tr>`
    : incomes.map(r => {
        const prop = propMap[r.propertyId];
        const col  = prop?.color || '#94a3b8';
        return `<tr>
          <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name || '—')}</td>
          <td>${Utils.escapeHtml(r.platform || '—')}</td>
          <td class="cell-center">${r.nightsRented != null ? r.nightsRented : '—'}</td>
          <td class="cell-money">${Utils.formatMoney(r.amount || 0)}</td>
          <td>${STATUS[r.status] || r.status || ''}</td>
          <td style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(r.notes || '')}</td>
          <td class="cell-center" style="white-space:nowrap">
            <button class="btn btn-ghost btn-xs" onclick="window._locOpenIncomeDrawer('${r.id}')">✏</button>
            <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="window._locDeleteIncome('${r.id}')">🗑</button>
          </td>
        </tr>`;
      }).join('');

  document.getElementById('incomes-total').innerHTML = `<strong>${Utils.formatMoney(total)}</strong>`;
}

// ── Drawer Bien ──────────────────────────────────────────────

function _openPropertyDrawer(id) {
  const prop = id ? Data.getPropertyById(id) : null;
  document.getElementById('property-drawer-title').textContent = prop ? 'Modifier le bien' : 'Nouveau bien';
  document.getElementById('prop-id').value       = prop?.id || '';
  document.getElementById('prop-name').value     = prop?.name || '';
  document.getElementById('prop-address').value  = prop?.address || '';
  document.getElementById('prop-type').value     = prop?.type || 'airbnb';
  document.getElementById('prop-color').value    = prop?.color || '#f97316';
  document.getElementById('prop-notes').value    = prop?.notes || '';
  document.getElementById('prop-active').checked = prop ? (prop.active !== false) : true;

  document.getElementById('property-drawer').classList.add('open');
  document.getElementById('loc-overlay').classList.add('open');
  setTimeout(() => document.getElementById('prop-name').focus(), 50);
}

function _locSaveProperty(e) {
  e.preventDefault();
  const id = document.getElementById('prop-id').value;
  const property = {
    id:      id || Utils.uuid(),
    name:    document.getElementById('prop-name').value.trim(),
    address: document.getElementById('prop-address').value.trim(),
    type:    document.getElementById('prop-type').value,
    color:   document.getElementById('prop-color').value,
    notes:   document.getElementById('prop-notes').value.trim(),
    active:  document.getElementById('prop-active').checked,
  };
  Data.saveProperty(property);
  _locCloseDrawers();
  _buildPropertyFilter();
  _renderPage();
}

// ── Drawer Revenu ────────────────────────────────────────────

function _openIncomeDrawer(id) {
  const income = id ? Data.getRentalIncomeById(id) : null;

  // Remplir la liste des biens
  const props = Data.getActiveProperties();
  const sel   = document.getElementById('inc-property');
  sel.innerHTML = props.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('');
  if (!props.length) {
    alert('Ajoutez d\'abord un bien avant d\'enregistrer un revenu.');
    return;
  }

  document.getElementById('income-drawer-title').textContent = income ? 'Modifier le revenu' : 'Nouveau revenu';
  document.getElementById('inc-id').value       = income?.id || '';
  document.getElementById('inc-property').value = income?.propertyId || props[0]?.id || '';
  document.getElementById('inc-month').value    = income?.yearMonth || _locMonth;
  document.getElementById('inc-amount').value   = income?.amount != null ? income.amount : '';
  document.getElementById('inc-platform').value = income?.platform || '';
  document.getElementById('inc-nights').value   = income?.nightsRented != null ? income.nightsRented : '';
  document.getElementById('inc-status').value   = income?.status || 'received';
  document.getElementById('inc-notes').value    = income?.notes || '';

  document.getElementById('income-drawer').classList.add('open');
  document.getElementById('loc-overlay').classList.add('open');
  setTimeout(() => document.getElementById('inc-amount').focus(), 50);
}

function _locSaveIncome(e) {
  e.preventDefault();
  const id = document.getElementById('inc-id').value;
  const nightsVal = document.getElementById('inc-nights').value;
  const income = {
    id:           id || Utils.uuid(),
    propertyId:   document.getElementById('inc-property').value,
    yearMonth:    document.getElementById('inc-month').value,
    amount:       parseFloat(document.getElementById('inc-amount').value) || 0,
    platform:     document.getElementById('inc-platform').value.trim(),
    nightsRented: nightsVal !== '' ? parseInt(nightsVal, 10) : null,
    status:       document.getElementById('inc-status').value,
    notes:        document.getElementById('inc-notes').value.trim(),
  };
  Data.saveRentalIncome(income);
  _locCloseDrawers();
  // Mettre le filtre mois sur le mois de l'entrée créée
  _locMonth = income.yearMonth;
  document.getElementById('loc-filter-month').value = _locMonth;
  _buildMonthFilter();
  _renderPage();
}

// ── Supprimer ────────────────────────────────────────────────

function _locDeleteProperty(id) {
  const prop = Data.getPropertyById(id);
  if (!prop) return;
  const incCount = Data.getRentalIncomesByProperty(id).length;
  const msg = incCount > 0
    ? `Supprimer "${prop.name}" et ses ${incCount} entrée(s) de revenus ? Cette action est irréversible.`
    : `Supprimer "${prop.name}" ?`;
  if (!confirm(msg)) return;
  Data.deleteProperty(id);
  _buildPropertyFilter();
  _locPropertyId = '';
  _renderPage();
}

function _locDeleteIncome(id) {
  if (!confirm('Supprimer ce revenu ?')) return;
  Data.deleteRentalIncome(id);
  _renderPage();
}

// ── Raccourcis ───────────────────────────────────────────────

function _locCloseDrawers() {
  document.getElementById('property-drawer').classList.remove('open');
  document.getElementById('income-drawer').classList.remove('open');
  document.getElementById('loc-overlay').classList.remove('open');
}

function _locAddIncomeForProp(propertyId) {
  _openIncomeDrawer(null);
  setTimeout(() => {
    document.getElementById('inc-property').value = propertyId;
  }, 60);
}

// Expositions globales (onclick dans le HTML)
window._locCloseDrawers       = _locCloseDrawers;
window._locOpenPropertyDrawer = _openPropertyDrawer;
window._locOpenIncomeDrawer   = _openIncomeDrawer;
window._locSaveProperty       = _locSaveProperty;
window._locSaveIncome         = _locSaveIncome;
window._locDeleteProperty     = _locDeleteProperty;
window._locDeleteIncome       = _locDeleteIncome;
window._locAddIncomeForProp   = _locAddIncomeForProp;
