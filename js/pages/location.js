// location.js — Gestion des revenus locatifs
'use strict';

let _locMonth      = '';   // '' = tous les mois
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
  const now       = new Date();
  const currentYm = Utils.currentYearMonth();
  // Collecter tous les mois qui ont un revenu + le mois courant + les 12 derniers mois
  const incomes   = Data.getRentalIncomes();
  const existYms  = new Set(incomes.map(r => r.yearMonth).filter(Boolean));
  // Générer les 24 derniers mois + mois courant
  const months = new Set();
  for (let i = 0; i <= 24; i++) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.add(ym);
  }
  // Inclure aussi les mois qui ont un revenu (même anciens ou futurs)
  existYms.forEach(ym => months.add(ym));
  const sorted = [...months].sort((a, b) => b.localeCompare(a));

  const el = document.getElementById('loc-filter-month');
  el.innerHTML =
    `<option value="" ${_locMonth === '' ? 'selected' : ''}>Tous les mois</option>` +
    sorted.map(ym => {
      const [y, m]  = ym.split('-');
      const isFuture = ym > currentYm;
      const hasData  = existYms.has(ym);
      const label    = `${Utils.MONTHS_LONG[+m - 1]} ${y}${isFuture ? ' (prévu)' : ''}${hasData ? ' ●' : ''}`;
      return `<option value="${ym}" ${ym === _locMonth ? 'selected' : ''}>${label}</option>`;
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
  // Label de la section revenus
  if (_locMonth) {
    const [y, m] = _locMonth.split('-');
    document.getElementById('loc-month-label').textContent = `${Utils.MONTHS_LONG[+m - 1]} ${y}`;
  } else {
    document.getElementById('loc-month-label').textContent = 'Tous les mois';
  }
}

function _renderKpis() {
  const allIncomes = Data.getRentalIncomes();
  const currentYm  = Utils.currentYearMonth();
  const now        = new Date();

  // KPI "Revenus du mois" = toujours le mois courant réel (pas le filtre)
  const curMonthIncomes = allIncomes.filter(r => r.yearMonth === currentYm);
  const curMonthTotal   = curMonthIncomes.reduce((s, r) => s + (r.amount || 0), 0);

  // Pending = tous les revenus non reçus du mois courant
  const pending = curMonthIncomes.filter(r => r.status !== 'received')
                                  .reduce((s, r) => s + (r.amount || 0), 0);

  // Cumul 12 mois glissants (passé seulement)
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const cutYm  = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
  const yearTotal = allIncomes
    .filter(r => r.yearMonth >= cutYm && r.yearMonth <= currentYm)
    .reduce((s, r) => s + (r.amount || 0), 0);

  document.getElementById('loc-kpi-total').textContent   = Utils.formatMoney(curMonthTotal);
  document.getElementById('loc-kpi-year').textContent    = Utils.formatMoney(yearTotal);
  document.getElementById('loc-kpi-props').textContent   = Data.getActiveProperties().length;
  document.getElementById('loc-kpi-pending').textContent = Utils.formatMoney(pending);

  const pendingCard = document.getElementById('loc-kpi-pending-card');
  if (pendingCard) pendingCard.className = pending > 0 ? 'kpi-card kpi-alert-card' : 'kpi-card';
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

function _incomeRow(r, propMap, STATUS) {
  const prop = propMap[r.propertyId];
  const col  = prop?.color || '#94a3b8';
  const nightsLabel = r.nightsRented != null
    ? `${r.nightsRented}${r.ratePerNight != null ? ` × ${Utils.formatMoney(r.ratePerNight)}` : ''}`
    : '—';
  return `<tr>
    <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(prop?.name || '—')}</td>
    <td>${Utils.escapeHtml(r.platform || '—')}</td>
    <td class="cell-center">${nightsLabel}</td>
    <td class="cell-money">${Utils.formatMoney(r.amount || 0)}</td>
    <td>${STATUS[r.status] || r.status || ''}</td>
    <td style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(r.notes || '')}</td>
    <td class="cell-center" style="white-space:nowrap">
      <button class="btn btn-ghost btn-xs" onclick="window._locOpenIncomeDrawer('${r.id}')">Modifier</button>
      <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="window._locDeleteIncome('${r.id}')">Suppr.</button>
    </td>
  </tr>`;
}

function _renderIncomes() {
  let allInc = Data.getRentalIncomes();
  if (_locPropertyId) allInc = allInc.filter(r => r.propertyId === _locPropertyId);
  if (_locMonth)      allInc = allInc.filter(r => r.yearMonth === _locMonth);

  // Tri : date décroissante puis par bien
  allInc.sort((a, b) => {
    const d = b.yearMonth.localeCompare(a.yearMonth);
    return d !== 0 ? d : (a.propertyId || '').localeCompare(b.propertyId || '');
  });

  const propMap = {}; Data.getProperties().forEach(p => propMap[p.id] = p);
  const grandTotal = allInc.reduce((s, r) => s + (r.amount || 0), 0);

  const STATUS = {
    received: '<span class="badge badge-success">✓ Reçu</span>',
    pending:  '<span class="badge badge-warning">⏳ En attente</span>',
    partial:  '<span class="badge badge-danger">⚠ Partiel</span>',
  };

  const tbody = document.getElementById('incomes-tbody');

  if (allInc.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-cell">Aucun revenu enregistré.
      <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="window._locOpenIncomeDrawer(null)">+ Ajouter</button></td></tr>`;
    document.getElementById('incomes-total').innerHTML = `<strong>${Utils.formatMoney(0)}</strong>`;
    return;
  }

  if (_locMonth) {
    // Vue simple (un seul mois sélectionné)
    tbody.innerHTML = allInc.map(r => _incomeRow(r, propMap, STATUS)).join('');
  } else {
    // Vue groupée par mois — c'est la vue principale
    const byMonth = {};
    allInc.forEach(r => {
      if (!byMonth[r.yearMonth]) byMonth[r.yearMonth] = [];
      byMonth[r.yearMonth].push(r);
    });
    const currentYm = Utils.currentYearMonth();
    let html = '';
    Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).forEach(ym => {
      const [y, m]   = ym.split('-');
      const label    = `${Utils.MONTHS_LONG[+m - 1]} ${y}`;
      const isFuture = ym > currentYm;
      const rows     = byMonth[ym];
      const subtotal = rows.reduce((s, r) => s + (r.amount || 0), 0);
      // En-tête de groupe mois
      html += `<tr style="background:var(--bg);border-top:2px solid var(--border)">
        <td colspan="3" style="font-weight:700;font-size:0.9rem;padding:8px 12px;color:var(--text)">
          ${label}${isFuture ? ' <span style="font-size:0.75rem;color:var(--text-muted);font-weight:400">(prévu)</span>' : ''}
        </td>
        <td class="cell-money" style="font-weight:700;color:var(--primary)">${Utils.formatMoney(subtotal)}</td>
        <td colspan="3" style="font-size:0.78rem;color:var(--text-muted);padding:8px 12px">
          ${rows.length} entrée${rows.length > 1 ? 's' : ''}
        </td>
      </tr>`;
      rows.forEach(r => { html += _incomeRow(r, propMap, STATUS); });
    });
    tbody.innerHTML = html;
  }

  document.getElementById('incomes-total').innerHTML = `<strong>${Utils.formatMoney(grandTotal)}</strong>`;
}

// ── Drawer Bien ──────────────────────────────────────────────

function _openPropertyDrawer(id) {
  _locCloseDrawers();
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
  _locCloseDrawers();
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
  document.getElementById('inc-id').value         = income?.id || '';
  document.getElementById('inc-property').value   = income?.propertyId || props[0]?.id || '';
  document.getElementById('inc-month').value      = income?.yearMonth || _locMonth;
  document.getElementById('inc-amount').value     = income?.amount != null ? income.amount : '';
  document.getElementById('inc-platform').value   = income?.platform || '';
  document.getElementById('inc-nights').value     = income?.nightsRented != null ? income.nightsRented : '';
  document.getElementById('inc-rate').value       = income?.ratePerNight != null ? income.ratePerNight : '';
  document.getElementById('inc-status').value     = income?.status || 'received';
  document.getElementById('inc-notes').value      = income?.notes || '';
  document.getElementById('inc-calc-hint').textContent = '';
  _locCalcTotal();

  document.getElementById('income-drawer').classList.add('open');
  document.getElementById('loc-overlay').classList.add('open');
  setTimeout(() => document.getElementById('inc-amount').focus(), 50);
}

function _locCalcTotal() {
  const nights = parseFloat(document.getElementById('inc-nights').value);
  const rate   = parseFloat(document.getElementById('inc-rate').value);
  const hint   = document.getElementById('inc-calc-hint');
  if (!isNaN(nights) && !isNaN(rate) && nights > 0 && rate > 0) {
    const total = Math.round(nights * rate * 100) / 100;
    document.getElementById('inc-amount').value = total;
    if (hint) hint.textContent = `${nights} nuits × ${rate} € = ${total} €`;
  } else {
    if (hint) hint.textContent = '';
  }
}

function _locSaveIncome(e) {
  e.preventDefault();
  const id = document.getElementById('inc-id').value;
  const nightsVal = document.getElementById('inc-nights').value;
  const rateVal   = document.getElementById('inc-rate').value;
  const income = {
    id:            id || Utils.uuid(),
    propertyId:    document.getElementById('inc-property').value,
    yearMonth:     document.getElementById('inc-month').value,
    amount:        parseFloat(document.getElementById('inc-amount').value) || 0,
    platform:      document.getElementById('inc-platform').value.trim(),
    nightsRented:  nightsVal !== '' ? parseInt(nightsVal, 10) : null,
    ratePerNight:  rateVal   !== '' ? parseFloat(rateVal)     : null,
    status:        document.getElementById('inc-status').value,
    notes:         document.getElementById('inc-notes').value.trim(),
  };
  Data.saveRentalIncome(income);
  _locCloseDrawers();
  // Revenir à la vue "Tous les mois" pour voir l'entrée dans son contexte
  _locMonth = '';
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
window._locCalcTotal          = _locCalcTotal;
window._locCloseDrawers       = _locCloseDrawers;
window._locOpenPropertyDrawer = _openPropertyDrawer;
window._locOpenIncomeDrawer   = _openIncomeDrawer;
window._locSaveProperty       = _locSaveProperty;
window._locSaveIncome         = _locSaveIncome;
window._locDeleteProperty     = _locDeleteProperty;
window._locDeleteIncome       = _locDeleteIncome;
window._locAddIncomeForProp   = _locAddIncomeForProp;
