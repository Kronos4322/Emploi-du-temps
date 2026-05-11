// facturation.js v8
'use strict';

const _urlParams = new URLSearchParams(window.location.search);
let _poleId    = _urlParams.get('pole') || '';
let _yearMonth = Utils.currentYearMonth();

// Sélections actives (null = tous)
let _selSchools   = null; // null=tous, Set=sélection
let _selProviders = null;

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  buildFilters();
  render();
  document.getElementById('btn-export-csv').addEventListener('click', () => Data.exportToCsv(_yearMonth));
});

function buildFilters() {
  const months  = [];
  const end     = new Date(); end.setMonth(end.getMonth() + 18);
  const _fm = Data.getMissions().map(m=>m.date).filter(Boolean).sort()[0];
  const stopYm = _fm ? _fm.slice(0,7) : `${new Date().getFullYear()-1}-09`;
  for (let d = new Date(end); ; d.setMonth(d.getMonth() - 1)) {
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push(ym);
    if (ym <= stopYm) break;
  }
  const ownCos = Data.getOwnCompanies();

  document.getElementById('filter-pole').innerHTML =
    '<option value="">Tous les pôles</option>' +
    ownCos.map(c => `<option value="${c.id}" ${_poleId===c.id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('');
  document.getElementById('filter-pole').addEventListener('change', e => { _poleId = e.target.value; _selSchools = null; _selProviders = null; buildTagFilters(); render(); });

  document.getElementById('filter-month').innerHTML =
    months.map(ym => { const [y,m]=ym.split('-'); return `<option value="${ym}" ${_yearMonth===ym?'selected':''}>${Utils.MONTHS_LONG[+m-1]} ${y}</option>`; }).join('');
  document.getElementById('filter-month').addEventListener('change', e => { _yearMonth = e.target.value; render(); });

  buildTagFilters();
}

function buildTagFilters() {
  const allCos  = {}; Data.getCompanies().forEach(c => allCos[c.id] = c);
  const schools = Data.getClientSchools().filter(co => {
    if (!_poleId) return true;
    if (co.poleId) return co.poleId === _poleId;
    return false; // société sans poleId → exclure du filtre par pôle
  });
  const providers = Data.getProviders().filter(p => !_poleId || !p.poleId || p.poleId === _poleId);

  const schoolTagsEl = document.getElementById('school-tags');
  schoolTagsEl.innerHTML = schools.map(co =>
    `<button class="tag-filter-btn ${!_selSchools||_selSchools.has(co.id)?'active':''}" data-sid="${co.id}"
      style="border-color:${co.color||'var(--border)'};${(!_selSchools||_selSchools.has(co.id))?`background:${co.color||'var(--primary)'};color:#fff`:''}"
      onclick="window._toggleSchool('${co.id}')">${Utils.escapeHtml(co.name)}</button>`
  ).join('');

  const provTagsEl = document.getElementById('provider-tags');
  provTagsEl.innerHTML = providers.map(p =>
    `<button class="tag-filter-btn ${!_selProviders||_selProviders.has(p.id)?'active':''}" data-pid="${p.id}"
      onclick="window._toggleProv('${p.id}')">${Utils.escapeHtml(p.lastName+' '+p.firstName)}</button>`
  ).join('');
}

window._toggleSchool = id => {
  if (!_selSchools) _selSchools = new Set(Data.getClientSchools().map(c=>c.id));
  if (_selSchools.has(id)) _selSchools.delete(id); else _selSchools.add(id);
  buildTagFilters(); render();
};
window._toggleAllSchools = () => { _selSchools = null; buildTagFilters(); render(); };
window._toggleNoneSchools = () => { _selSchools = new Set(); buildTagFilters(); render(); };

window._toggleProv = id => {
  if (!_selProviders) _selProviders = new Set(Data.getProviders().map(p=>p.id));
  if (_selProviders.has(id)) _selProviders.delete(id); else _selProviders.add(id);
  buildTagFilters(); render();
};
window._toggleAllProvs = () => { _selProviders = null; buildTagFilters(); render(); };
window._toggleNoneProvs = () => { _selProviders = new Set(); buildTagFilters(); render(); };

function poleFilter(m) {
  if (!_poleId) return true;
  const allCos = {}; Data.getCompanies().forEach(c => allCos[c.id] = c);
  const co = allCos[m.companyId];
  if (!co) return false;
  if (co.role === 'own') return co.id === _poleId;
  if (co.poleId) return co.poleId === _poleId;
  return false; // société sans poleId → exclure du filtre par pôle
}

function render() {
  const companies = {}; Data.getCompanies().forEach(c => companies[c.id] = c);
  const providers = {}; Data.getProviders().forEach(p => providers[p.id] = p);
  const [y, m]   = _yearMonth.split('-');
  const poleName = _poleId ? (Data.getCompanyById(_poleId)?.name || '') : '';
  const monthLabel = `${Utils.MONTHS_LONG[+m-1]} ${y}${poleName?' — '+poleName:''}`;

  const stats = Data.getFinancialStats({ yearMonth: _yearMonth });
  let doneAll    = stats.done.filter(poleFilter);
  let plannedAll = stats.planned.filter(poleFilter);

  // Filtres école (pour KPIs et section écoles seulement)
  let done    = _selSchools ? doneAll.filter(m => _selSchools.has(m.companyId))    : doneAll;
  let planned = _selSchools ? plannedAll.filter(m => _selSchools.has(m.companyId)) : plannedAll;

  // KPIs
  document.getElementById('billing-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-icon kpi-blue">✓</div><div class="kpi-content">
      <div class="kpi-value">${Utils.formatDuration(done.reduce((s,m)=>s+(m.duration||0),0))}</div>
      <div class="kpi-label">Heures réalisées</div></div></div>
    <div class="kpi-card"><div class="kpi-icon kpi-gray">📅</div><div class="kpi-content">
      <div class="kpi-value">${Utils.formatDuration(planned.reduce((s,m)=>s+(m.duration||0),0))}</div>
      <div class="kpi-label">Heures prévues</div></div></div>
    <div class="kpi-card"><div class="kpi-icon kpi-green">💶</div><div class="kpi-content">
      <div class="kpi-value">${Utils.formatMoney(done.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0))}</div>
      <div class="kpi-label">CA réalisé</div></div></div>
    <div class="kpi-card"><div class="kpi-icon kpi-red">📤</div><div class="kpi-content">
      <div class="kpi-value">${Utils.formatMoney(done.reduce((s,m)=>{const pids=m.providerIds?.length?m.providerIds:(m.providerId?[m.providerId]:[]);return pids.length?s+(m.duration||0)*(m.providerRate||0):s;},0))}</div>
      <div class="kpi-label">Charges prestataires</div></div></div>
    ${(()=>{ const rev=done.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0); const cost=done.reduce((s,m)=>{const pids=m.providerIds?.length?m.providerIds:(m.providerId?[m.providerId]:[]);return pids.length?s+(m.duration||0)*(m.providerRate||0):s;},0); const mg=rev-cost; return `<div class="kpi-card ${mg>=0?'kpi-positive':'kpi-negative'}"><div class="kpi-icon kpi-teal">📊</div><div class="kpi-content"><div class="kpi-value">${Utils.formatMoney(mg)}</div><div class="kpi-label">Marge nette</div></div></div>`; })()}
  `;

  // ── Section prestataires (indépendant du filtre école) ──
  const allFiltered = [...doneAll, ...plannedAll];
  const byProv = {};
  allFiltered.forEach(mi => {
    const pids = mi.providerIds?.length ? mi.providerIds : (mi.providerId ? [mi.providerId] : []);
    if (!pids.length) return;
    pids.forEach(pid => {
      if (_selProviders && !_selProviders.has(pid)) return;
      if (!byProv[pid]) byProv[pid] = { done:{h:0,cost:0,rev:0,n:0}, planned:{h:0,cost:0,rev:0,n:0}, schools:new Set() };
      const b = mi.status==='done' ? byProv[pid].done : byProv[pid].planned;
      b.h += mi.duration||0; b.cost += (mi.duration||0)*(mi.providerRate||0)/pids.length; b.rev += (mi.duration||0)*(mi.billingRate||0); b.n++;
      if (mi.companyId) byProv[pid].schools.add(mi.companyId);
    });
  });

  const provCards = Object.entries(byProv).map(([pid, d]) => {
    const p = providers[pid]; if (!p) return '';
    const totalH = d.done.h + d.planned.h;
    const totalCost = d.done.cost + d.planned.cost;
    const totalRev  = d.done.rev  + d.planned.rev;
    const margin = totalRev - totalCost;
    const coNames = [...d.schools].map(cid=>companies[cid]?.name||'—').join(', ');
    return `<div class="billing-provider-card">
      <div class="billing-provider-header">
        <div><div class="billing-provider-name">${Utils.escapeHtml(p.firstName+' '+p.lastName)}</div>
        <div class="billing-provider-company">${Utils.escapeHtml(coNames)}</div></div>
        <span class="badge ${d.done.n>0?'badge-done':'badge-planned'}">${d.done.n+d.planned.n} mission${d.done.n+d.planned.n>1?'s':''}</span>
      </div>
      <div class="billing-row"><span>Heures (réalisé + prévu)</span><strong>${Utils.formatDuration(totalH)}</strong></div>
      <div class="billing-row"><span>Coût prestataire</span><strong>${Utils.formatMoney(totalCost)}</strong></div>
      <div class="billing-row"><span>CA facturé client</span><strong>${Utils.formatMoney(totalRev)}</strong></div>
      <div class="billing-total-row" style="color:${margin>=0?'var(--success)':'var(--danger)'}"><span>Marge</span><span>${Utils.formatMoney(margin)}</span></div>
    </div>`;
  }).filter(Boolean).join('');

  document.getElementById('billing-by-provider-inner').innerHTML = provCards ||
    '<p class="empty-state">Aucun prestataire sur cette période.</p>';

  // ── Section écoles ──
  const bySchool = {};
  allFiltered.forEach(mi => {
    if (!mi.companyId) return;
    const co = companies[mi.companyId];
    if (!co || co.role==='own') return;
    if (_selSchools && !_selSchools.has(mi.companyId)) return;
    if (!bySchool[mi.companyId]) bySchool[mi.companyId] = { done:{h:0,rev:0,n:0}, planned:{h:0,rev:0,n:0}, unpaid:0 };
    const b = mi.status==='done' ? bySchool[mi.companyId].done : bySchool[mi.companyId].planned;
    b.h += mi.duration||0; b.rev += (mi.duration||0)*(mi.billingRate||0); b.n++;
    if (mi.status==='done' && mi.paymentStatus!=='paid') bySchool[mi.companyId].unpaid++;
  });

  const schoolCards = Object.entries(bySchool).map(([cid, d]) => {
    const co = companies[cid]; if (!co) return '';
    const col = co.color||'#94a3b8';
    const total = d.done.rev + d.planned.rev;
    return `<div class="billing-provider-card">
      <div class="billing-provider-header">
        <div><div class="billing-provider-name"><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(co.name)}</div></div>
        <span class="badge ${d.done.n>0?'badge-done':'badge-planned'}">${d.done.n+d.planned.n} mission${d.done.n+d.planned.n>1?'s':''}</span>
      </div>
      <div class="billing-row"><span>Heures réalisées</span><strong>${Utils.formatDuration(d.done.h)}</strong></div>
      <div class="billing-row"><span>Heures prévues</span><strong>${Utils.formatDuration(d.planned.h)}</strong></div>
      <div class="billing-row"><span>CA réalisé</span><strong>${Utils.formatMoney(d.done.rev)}</strong></div>
      <div class="billing-row"><span>CA prévu</span><strong>${Utils.formatMoney(d.planned.rev)}</strong></div>
      <div class="billing-total-row"><span>Total à facturer</span><span>${Utils.formatMoney(total)}</span></div>
      ${d.unpaid>0?`<div style="margin-top:6px"><span class="badge badge-danger">${d.unpaid} non payé</span></div>`:''}
    </div>`;
  }).filter(Boolean).join('');

  document.getElementById('billing-by-school-inner').innerHTML = (_selSchools && _selSchools.size===0)
    ? '<p class="empty-state">Aucune école sélectionnée.</p>'
    : (schoolCards || '<p class="empty-state">Aucune école sur cette période.</p>');

  // ── Détail missions ──
  const allM = [...done, ...planned].sort((a,b) => Utils.dateCompare(a.date, b.date));
  const totalRev  = allM.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
  const totalCost = allM.reduce((s,m)=>m.providerId?s+(m.duration||0)*(m.providerRate||0):s,0);

  document.getElementById('detail-summary').textContent = `Détail des missions — ${monthLabel} (${allM.length})`;
  document.getElementById('billing-detail-inner').innerHTML = allM.length===0
    ? '<p class="empty-state">Aucune mission.</p>'
    : `<div class="report-table-wrapper"><table class="data-table">
        <thead><tr>
          <th>Date</th><th>Mission</th><th>Société</th><th>Prestataire</th>
          <th class="cell-center">Durée</th><th class="cell-money">Tarif presta.</th>
          <th class="cell-money">Coût presta.</th><th class="cell-money">Tarif fact.</th>
          <th class="cell-money">Revenu</th><th>Statut</th><th>Paiement</th>
        </tr></thead>
        <tbody>${allM.map(mi => {
          const co   = companies[mi.companyId];
          const prov = providers[mi.providerId];
          const col  = co ? co.color : '#94a3b8';
          const rev  = (mi.duration||0)*(mi.billingRate||0);
          const cost = mi.providerId ? (mi.duration||0)*(mi.providerRate||0) : null;
          const SB   = { planned:'<span class="badge badge-planned">Prévu</span>', done:'<span class="badge badge-done">Réalisé</span>', cancelled:'<span class="badge badge-cancelled">Annulé</span>' };
          const PB   = { unpaid:'<span class="badge badge-danger">Non payé</span>', invoiced:'<span class="badge badge-invoiced">Facturé</span>', paid:'<span class="badge badge-success">Payé</span>' };
          return `<tr class="table-row" onclick="Modals.openMission('${mi.id}',null,()=>render())">
            <td>${Utils.formatDate(mi.date)}</td>
            <td><span class="school-dot" style="background:${col}"></span> ${Utils.escapeHtml(mi.title)}</td>
            <td>${co?Utils.escapeHtml(co.name):'—'}</td>
            <td>${prov?Utils.escapeHtml(prov.firstName+' '+prov.lastName):'—'}</td>
            <td class="cell-center">${Utils.formatDuration(mi.duration)}</td>
            <td class="cell-money">${mi.providerRate?Utils.formatMoney(mi.providerRate)+'/h':'—'}</td>
            <td class="cell-money cell-cost">${cost!==null?Utils.formatMoney(cost):'—'}</td>
            <td class="cell-money">${Utils.formatMoney(mi.billingRate)}/h</td>
            <td class="cell-money">${mi.status!=='cancelled'?Utils.formatMoney(rev):'—'}</td>
            <td>${SB[mi.status]||mi.status}</td>
            <td>${PB[mi.paymentStatus]||mi.paymentStatus}</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr class="table-total">
          <td colspan="4"><strong>Total</strong></td>
          <td class="cell-center"><strong>${Utils.formatDuration(allM.reduce((s,m)=>s+(m.duration||0),0))}</strong></td>
          <td></td>
          <td class="cell-money cell-cost"><strong>${Utils.formatMoney(totalCost)}</strong></td>
          <td></td>
          <td class="cell-money"><strong>${Utils.formatMoney(totalRev)}</strong></td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table></div>`;
}
