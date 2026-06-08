// factures.js — Suivi factures v1
'use strict';

let _yearMonth   = Utils.currentYearMonth();
let _poleId      = '';   // '' = tous, sinon id du pôle

const PAY_BADGE = {
  paid:   '<span class="status-badge-paid">✓ Payé</span>',
  unpaid: '<span class="status-badge-unpaid">✗ Non payé</span>',
};

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  _buildMonthFilter();
  _buildPoleTabs();
  render();

  document.getElementById('btn-prev-month').addEventListener('click', () => _shiftMonth(-1));
  document.getElementById('btn-next-month').addEventListener('click', () => _shiftMonth(+1));
  document.getElementById('filter-month').addEventListener('change', e => { _yearMonth = e.target.value; render(); });
  document.getElementById('btn-new-invoice').addEventListener('click', () => _openModal(null));
  document.getElementById('inv-cancel').addEventListener('click', _closeModal);
  document.getElementById('inv-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) _closeModal(); });
  document.getElementById('inv-save').addEventListener('click', _saveInvoice);
  document.getElementById('btn-combos').addEventListener('click', _openCombosModal);
  document.getElementById('combo-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('open'); });
  document.getElementById('combo-pay-confirm').addEventListener('click', _confirmComboPayment);
  document.getElementById('btn-close-unpaid').addEventListener('click', () => {
    document.getElementById('section-unpaid').style.display = 'none';
  });
  document.getElementById('pay-modal-close').addEventListener('click', _closePayModal);
  document.getElementById('pay-modal-cancel').addEventListener('click', _closePayModal);
  document.getElementById('pay-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) _closePayModal(); });
  document.getElementById('pay-modal-confirm').addEventListener('click', _confirmPayModal);
});

// ── Filtres ──────────────────────────────────────────────────────────────────

function _buildMonthFilter() {
  const now    = new Date();
  const months = [];
  const end    = new Date(now.getFullYear(), now.getMonth() + 18, 1);
  const firstInv = Data.getInvoices().map(i => i.yearMonth).filter(Boolean).sort()[0];
  const stop   = firstInv || `${now.getFullYear() - 1}-09`;
  for (let d = new Date(end); ; d.setMonth(d.getMonth() - 1)) {
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push(ym);
    if (ym <= stop) break;
  }
  document.getElementById('filter-month').innerHTML = months.map(ym => {
    const [y, m] = ym.split('-');
    return `<option value="${ym}" ${ym === _yearMonth ? 'selected' : ''}>${Utils.MONTHS_LONG[+m-1]} ${y}</option>`;
  }).join('');
}

function _buildPoleTabs() {
  const ownCos = Data.getOwnCompanies();
  const poleIcon = c => { const n=(c.name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); if(n.includes('artem')) return '🎓'; if(n.includes('aster')) return '🌍'; return '🏢'; };
  const tabs = document.getElementById('pole-tabs');
  tabs.innerHTML =
    `<button class="pole-tab ${_poleId===''?'active':''}" data-pole="">Tous</button>` +
    ownCos.map(c => `<button class="pole-tab ${_poleId===c.id?'active':''}" data-pole="${c.id}">${poleIcon(c)} ${Utils.escapeHtml(c.name)}</button>`).join('');
  tabs.querySelectorAll('.pole-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _poleId = btn.dataset.pole;
      tabs.querySelectorAll('.pole-tab').forEach(b => b.classList.toggle('active', b.dataset.pole === _poleId));
      render();
    });
  });
}

function _shiftMonth(delta) {
  const [y, m] = _yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  _yearMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  // Met à jour le select
  const sel = document.getElementById('filter-month');
  if ([...sel.options].some(o => o.value === _yearMonth)) {
    sel.value = _yearMonth;
  } else {
    // Ajouter l'option si hors plage
    const [y2, m2] = _yearMonth.split('-');
    const opt = document.createElement('option');
    opt.value = _yearMonth;
    opt.textContent = `${Utils.MONTHS_LONG[+m2-1]} ${y2}`;
    // Insérer au bon endroit (ordre décroissant)
    const before = [...sel.options].find(o => o.value < _yearMonth);
    sel.insertBefore(opt, before || null);
    sel.value = _yearMonth;
  }
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  const invoices  = Data.getInvoicesByMonth(_yearMonth, _poleId);
  const ownCos    = Data.getOwnCompanies();
  const poleMap   = {}; ownCos.forEach(c => poleMap[c.id] = c);
  const [y, m]    = _yearMonth.split('-');

  // KPIs
  const total   = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const paid    = invoices.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
  const unpaid  = total - paid;
  const kpiRow  = document.getElementById('kpi-row');
  kpiRow.innerHTML = `
    <div class="kpi-card kpi-large">
      <div class="kpi-icon kpi-green">💶</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(total)}</div>
        <div class="kpi-label">Total facturé — ${Utils.MONTHS_LONG[+m-1]} ${y}</div>
      </div>
    </div>
    <div class="kpi-card kpi-large kpi-positive">
      <div class="kpi-icon kpi-green">✓</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(paid)}</div>
        <div class="kpi-label">Payé (${invoices.filter(i=>i.paymentStatus==='paid').length} facture${invoices.filter(i=>i.paymentStatus==='paid').length!==1?'s':''})</div>
      </div>
    </div>
    <div class="kpi-card kpi-large ${unpaid > 0 ? 'kpi-negative' : ''}">
      <div class="kpi-icon ${unpaid > 0 ? 'kpi-red' : 'kpi-gray'}">⏳</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(unpaid)}</div>
        <div class="kpi-label">En attente (${invoices.filter(i=>i.paymentStatus!=='paid').length} facture${invoices.filter(i=>i.paymentStatus!=='paid').length!==1?'s':''})</div>
      </div>
    </div>`;

  // Tableau
  const tbody = document.getElementById('invoices-tbody');
  const tfoot = document.getElementById('invoices-tfoot');

  if (invoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state-cell">Aucune facture ce mois.</td></tr>';
    tfoot.innerHTML = '';
    document.getElementById('combo-bar').style.display = 'none';
    renderUnpaid();
    return;
  }

  // Bouton combinaisons — visible si ≥2 impayées ce mois
  const unpaidThisMonth = invoices.filter(i => i.paymentStatus !== 'paid');
  const comboBar = document.getElementById('combo-bar');
  if (unpaidThisMonth.length >= 2) {
    comboBar.style.display = 'flex';
    document.getElementById('combo-hint').textContent =
      `${unpaidThisMonth.length} factures non payées → ${(1 << unpaidThisMonth.length) - 1} combinaisons possibles`;
  } else {
    comboBar.style.display = 'none';
  }

  tbody.innerHTML = invoices.map(inv => {
    const pole = poleMap[inv.poleId];
    const poleCol  = pole?.color || '#94a3b8';
    const poleName = pole ? Utils.escapeHtml(pole.name) : '—';
    return `<tr>
      <td><strong>${Utils.escapeHtml(inv.number || '—')}</strong></td>
      <td>${Utils.escapeHtml(inv.reference || '—')}</td>
      <td>
        <span class="school-dot" style="background:${poleCol}" title="${poleName}"></span>
        ${Utils.escapeHtml(inv.clientName || '—')}
        <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px">${poleName}</span>
      </td>
      <td class="cell-money"><strong>${Utils.formatMoney(inv.amount || 0)}</strong></td>
      <td>${Utils.formatDate(inv.sentDate) || '—'}</td>
      <td>
        ${inv.paymentStatus === 'paid'
          ? `<span class="status-badge-paid" style="cursor:pointer" onclick="_togglePayment('${inv.id}')" title="Cliquer pour repasser en Non payé">✓ Payé</span>
             ${inv.paidDate ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px">📅 ${Utils.formatDate(inv.paidDate)}${inv.paymentRef ? '<br>🔖 ' + Utils.escapeHtml(inv.paymentRef) : ''}</div>` : ''}`
          : `<span class="status-badge-unpaid" style="cursor:pointer" onclick="_openPayModal('${inv.id}')" title="Cliquer pour enregistrer le paiement">✗ Non payé</span>`
        }
      </td>
      <td>
        <div class="inv-actions">
          <button onclick="_openModal('${inv.id}')">Modifier</button>
          <button class="danger" onclick="_deleteInvoice('${inv.id}')">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Totaux par pôle
  const byPole = {};
  invoices.forEach(inv => {
    if (!byPole[inv.poleId]) byPole[inv.poleId] = { total: 0, paid: 0, count: 0 };
    byPole[inv.poleId].total += inv.amount || 0;
    if (inv.paymentStatus === 'paid') byPole[inv.poleId].paid += inv.amount || 0;
    byPole[inv.poleId].count++;
  });
  const poleFooter = Object.entries(byPole).map(([pid, d]) => {
    const pole = poleMap[pid];
    if (!pole) return '';
    return `<tr class="total-row">
      <td colspan="3" style="color:${pole.color||'var(--text)'}"><strong>${Utils.escapeHtml(pole.name)}</strong> (${d.count})</td>
      <td class="cell-money"><strong>${Utils.formatMoney(d.total)}</strong></td>
      <td colspan="3" style="font-size:0.82rem;color:var(--text-muted)">
        Payé : ${Utils.formatMoney(d.paid)} — En attente : ${Utils.formatMoney(d.total - d.paid)}
      </td>
    </tr>`;
  }).join('');
  tfoot.innerHTML = poleFooter + `<tr class="total-row" style="border-top:2px solid var(--primary)">
    <td colspan="3"><strong>TOTAL</strong></td>
    <td class="cell-money"><strong>${Utils.formatMoney(total)}</strong></td>
    <td colspan="3" style="font-size:0.82rem;color:var(--text-muted)">
      Payé : ${Utils.formatMoney(paid)} — En attente : ${Utils.formatMoney(unpaid)}
    </td>
  </tr>`;

  renderUnpaid();
}

// ── Combinaisons de virement ─────────────────────────────────────────────────

let _comboData        = []; // [{subset, total}] — calculé une fois à l'ouverture
let _comboMatchSubset = []; // factures de la combinaison actuellement surlignée

function _openCombosModal() {
  const invoices = Data.getInvoicesByMonth(_yearMonth, _poleId).filter(i => i.paymentStatus !== 'paid');
  if (invoices.length < 2) return;

  // Assigner une lettre à chaque facture (A, B, C, …)
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const labeled = invoices.map((inv, idx) => ({ ...inv, letter: LETTERS[idx] || `#${idx+1}` }));

  const [y, m] = _yearMonth.split('-');
  document.getElementById('combo-modal-subtitle').textContent =
    `${Utils.MONTHS_LONG[+m-1]} ${y} — ${invoices.length} factures impayées`;
  document.getElementById('combo-search').value = '';

  // Générer toutes les combinaisons non vides (2^n − 1)
  _comboData = [];
  const n = labeled.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = labeled.filter((_, j) => mask & (1 << j));
    const total  = Math.round(subset.reduce((s, i) => s + (i.amount || 0), 0) * 100) / 100;
    _comboData.push({ mask, subset, total });
  }
  // Trier par taille de combinaison puis par montant croissant
  _comboData.sort((a, b) => a.subset.length - b.subset.length || a.total - b.total);

  _renderComboRows('');
  document.getElementById('combo-modal-overlay').classList.add('open');
}

function _renderComboRows(searchVal) {
  const searchAmt = parseFloat((searchVal||'').toString().replace(',', '.')) || null;
  const EPS = 0.01;
  _comboMatchSubset = [];

  document.getElementById('combo-tbody').innerHTML = _comboData.map(({ subset, total }) => {
    const match = searchAmt !== null && Math.abs(total - searchAmt) < EPS;
    if (match) _comboMatchSubset = subset;
    const lettersHtml = subset.map(i =>
      `<span class="combo-letter">${i.letter}</span>`
    ).join('');
    const detailHtml = subset.map(i =>
      `<span style="font-size:0.78rem;color:var(--text-muted)">${Utils.escapeHtml(i.number||'?')} ${Utils.escapeHtml(i.clientName||'')} (${Utils.formatMoney(i.amount||0)})</span>`
    ).join('<span style="color:var(--border);margin:0 2px">+</span>');
    return `<tr class="combo-row${match ? ' highlight' : ''}">
      <td><span class="combo-label">${lettersHtml}</span></td>
      <td style="font-size:0.82rem">${detailHtml}</td>
      <td class="cell-money" style="font-weight:700;font-size:1rem${match?';color:#92400e':''}">
        ${Utils.formatMoney(total)}${match ? ' ✓' : ''}
      </td>
    </tr>`;
  }).join('');

  // Panneau de validation
  const panel = document.getElementById('combo-pay-panel');
  if (_comboMatchSubset.length > 0) {
    panel.style.display = '';
    document.getElementById('combo-pay-date').value = Utils.today();
    const names = [...new Set(_comboMatchSubset.map(i => i.clientName||'?'))].join(', ');
    const total = Math.round(_comboMatchSubset.reduce((s,i)=>s+(i.amount||0),0)*100)/100;
    document.getElementById('combo-pay-summary').textContent =
      `${_comboMatchSubset.length} facture${_comboMatchSubset.length>1?'s':''} — ${names} — ${Utils.formatMoney(total)}`;
  } else {
    panel.style.display = 'none';
  }
}

window._filterCombos = function() {
  _renderComboRows(document.getElementById('combo-search').value);
};

function _confirmComboPayment() {
  if (_comboMatchSubset.length === 0) return;
  const payDate = document.getElementById('combo-pay-date').value;
  const payRef  = document.getElementById('combo-pay-ref').value.trim();
  if (!payDate) { alert('Merci de saisir la date de paiement.'); return; }

  _comboMatchSubset.forEach(inv => {
    const full = Data.getInvoices().find(i => i.id === inv.id);
    if (full) {
      full.paymentStatus   = 'paid';
      full.paidDate        = payDate;
      full.paymentRef      = payRef || null;
      Data.saveInvoice(full);
    }
  });

  document.getElementById('combo-modal-overlay').classList.remove('open');
  render();
}

// ── Impayés globaux ───────────────────────────────────────────────────────────

function renderUnpaid() {
  const ownCos  = Data.getOwnCompanies();
  const poleMap = {}; ownCos.forEach(c => poleMap[c.id] = c);

  const allUnpaid = Data.getInvoices().filter(i =>
    i.paymentStatus !== 'paid' && (!_poleId || i.poleId === _poleId)
  );

  const section = document.getElementById('section-unpaid');
  if (allUnpaid.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';

  const grandTotal = allUnpaid.reduce((s, i) => s + (i.amount || 0), 0);
  document.getElementById('unpaid-global-total').textContent = Utils.formatMoney(grandTotal);

  // Grouper par pôle
  const byPole = {};
  allUnpaid.forEach(inv => {
    if (!byPole[inv.poleId]) byPole[inv.poleId] = [];
    byPole[inv.poleId].push(inv);
  });

  let rows = '';
  Object.entries(byPole).forEach(([pid, list]) => {
    const pole = poleMap[pid];
    const col  = pole?.color || '#94a3b8';
    const poleTotal = list.reduce((s, i) => s + (i.amount || 0), 0);
    // En-tête de groupe pôle
    rows += `<tr style="background:${col}15;border-top:2px solid ${col}50">
      <td colspan="7" style="padding:6px 12px;font-size:0.82rem;font-weight:700;color:${col}">
        <span class="school-dot" style="background:${col}"></span>
        ${pole ? Utils.escapeHtml(pole.name) : '—'} — ${list.length} facture${list.length!==1?'s':''}
        <span style="float:right">${Utils.formatMoney(poleTotal)}</span>
      </td>
    </tr>`;
    // Lignes factures
    list.sort((a,b) => (a.sentDate||'').localeCompare(b.sentDate||'')).forEach(inv => {
      const [y, m] = (inv.yearMonth||'----').split('-');
      const monthLabel = y !== '----' ? `${Utils.MONTHS_LONG[+m-1]} ${y}` : '—';
      rows += `<tr>
        <td><strong>${Utils.escapeHtml(inv.number || '—')}</strong></td>
        <td>${Utils.escapeHtml(inv.reference || '—')}</td>
        <td>${Utils.escapeHtml(inv.clientName || '—')}</td>
        <td class="cell-money"><strong>${Utils.formatMoney(inv.amount || 0)}</strong></td>
        <td>${Utils.formatDate(inv.sentDate) || '—'}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${monthLabel}</td>
        <td>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button style="font-size:0.78rem;padding:3px 10px;border-radius:12px;border:1px solid var(--border);cursor:pointer;background:var(--bg-card);color:var(--text);white-space:nowrap"
                    onclick="_openModal('${inv.id}')">Modifier</button>
            <button style="font-size:0.78rem;padding:3px 10px;border-radius:12px;border:1px solid #16a34a;cursor:pointer;background:#f0fdf4;color:#16a34a;white-space:nowrap"
                    onclick="_openPayModal('${inv.id}')">✓ Marquer payé</button>
          </div>
        </td>
      </tr>`;
    });
  });

  document.getElementById('unpaid-tbody').innerHTML = rows;
  document.getElementById('unpaid-tfoot').innerHTML = `
    <tr class="total-row" style="border-top:2px solid var(--danger,#dc2626)">
      <td colspan="3"><strong>TOTAL IMPAYÉS</strong></td>
      <td class="cell-money" style="color:var(--danger,#dc2626)"><strong>${Utils.formatMoney(grandTotal)}</strong></td>
      <td colspan="3"></td>
    </tr>`;
}

// ── Paiement manuel (badge "Non payé" → modale) ───────────────────────────────

window._openPayModal = function(id) {
  const inv = Data.getInvoices().find(i => i.id === id);
  if (!inv) return;
  document.getElementById('pay-modal-id').value    = id;
  document.getElementById('pay-modal-date').value  = Utils.today();
  document.getElementById('pay-modal-ref').value   = '';
  document.getElementById('pay-modal-desc').textContent =
    `Facture n°${inv.number || '?'} — ${inv.clientName || '?'} — ${Utils.formatMoney(inv.amount || 0)}`;
  document.getElementById('pay-modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('pay-modal-date').focus(), 50);
};

function _closePayModal() {
  document.getElementById('pay-modal-overlay').classList.remove('open');
}

function _confirmPayModal() {
  const id      = document.getElementById('pay-modal-id').value;
  const payDate = document.getElementById('pay-modal-date').value;
  const payRef  = document.getElementById('pay-modal-ref').value.trim();
  if (!payDate) { alert('Merci de saisir la date de paiement.'); return; }
  const inv = Data.getInvoices().find(i => i.id === id);
  if (!inv) return;
  inv.paymentStatus = 'paid';
  inv.paidDate      = payDate;
  inv.paymentRef    = payRef || null;
  Data.saveInvoice(inv);
  _closePayModal();
  render();
}

// ── Toggle : repasser en "Non payé" (depuis badge Payé) ───────────────────────

window._togglePayment = function(id) {
  const inv = Data.getInvoices().find(i => i.id === id);
  if (!inv) return;
  if (!confirm(`Repasser la facture n°${inv.number || '?'} en "Non payé" ?`)) return;
  inv.paymentStatus = 'unpaid';
  inv.paidDate      = null;
  inv.paymentRef    = null;
  Data.saveInvoice(inv);
  render();
};

// ── Suppression ───────────────────────────────────────────────────────────────

window._deleteInvoice = function(id) {
  const inv = Data.getInvoices().find(i => i.id === id);
  if (!inv) return;
  if (!confirm(`Supprimer la facture ${inv.number || '(sans numéro)'} — ${Utils.formatMoney(inv.amount)} ?`)) return;
  Data.deleteInvoice(id);
  render();
};

// ── Modal ─────────────────────────────────────────────────────────────────────

window._openModal = function(id) {
  const inv  = id ? Data.getInvoices().find(i => i.id === id) : null;
  const ownCos = Data.getOwnCompanies();
  const poleIcon = c => { const n=(c.name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); if(n.includes('artem')) return '🎓'; if(n.includes('aster')) return '🌍'; return '🏢'; };

  document.getElementById('inv-modal-title').textContent = inv ? 'Modifier la facture' : 'Nouvelle facture';
  document.getElementById('inv-id').value         = inv?.id || '';
  document.getElementById('inv-number').value     = inv?.number || '';
  document.getElementById('inv-reference').value  = inv?.reference || '';
  document.getElementById('inv-client').value     = inv?.clientName || '';
  document.getElementById('inv-amount').value     = inv?.amount ?? '';
  document.getElementById('inv-date').value       = inv?.sentDate || _yearMonth + '-01';
  document.getElementById('inv-status').value     = inv?.paymentStatus || 'unpaid';

  const poleSelect = document.getElementById('inv-pole');
  poleSelect.innerHTML = ownCos.map(c =>
    `<option value="${c.id}" ${(inv?.poleId || _poleId || ownCos[0]?.id) === c.id ? 'selected' : ''}>${poleIcon(c)} ${Utils.escapeHtml(c.name)}</option>`
  ).join('');

  document.getElementById('inv-modal-overlay').classList.add('open');
  document.getElementById('inv-number').focus();
};

function _closeModal() {
  document.getElementById('inv-modal-overlay').classList.remove('open');
}

function _saveInvoice() {
  const sentDate = document.getElementById('inv-date').value;
  const yearMonth = sentDate ? sentDate.slice(0, 7) : _yearMonth;

  const inv = {
    id:            document.getElementById('inv-id').value || Utils.uuid(),
    poleId:        document.getElementById('inv-pole').value,
    number:        document.getElementById('inv-number').value.trim(),
    reference:     document.getElementById('inv-reference').value.trim(),
    clientName:    document.getElementById('inv-client').value.trim(),
    amount:        parseFloat(document.getElementById('inv-amount').value) || 0,
    sentDate,
    yearMonth,
    paymentStatus: document.getElementById('inv-status').value,
  };

  if (!inv.clientName) { alert('Le nom du client est obligatoire.'); return; }

  Data.saveInvoice(inv);
  _closeModal();
  // Si la facture est sur un autre mois, naviguer vers ce mois
  if (inv.yearMonth !== _yearMonth) {
    _yearMonth = inv.yearMonth;
    document.getElementById('filter-month').value = _yearMonth;
  }
  render();
}
