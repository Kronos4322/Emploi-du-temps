// prestataires.js — Prestataires avec liaisons multi-sociétés
'use strict';

const _excluded = new Set(); // IDs prestataires exclus du récap
function toggleProvider(id) { _excluded.has(id) ? _excluded.delete(id) : _excluded.add(id); render(); }
function renderPage() { render(); }

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  render();
  document.getElementById('btn-new-provider').addEventListener('click', () =>
    Modals.openProvider(null));
});

function render() {
  const providers   = Data.getProviders();
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled');
  const allMissionsWithProv = allMissions.filter(m => m.providerId);
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

  // ── Barre de filtre ────────────────────────────────────────
  let filterBar = document.getElementById('prov-filter-bar');
  if (!filterBar) {
    filterBar = document.createElement('div');
    filterBar.id = 'prov-filter-bar';
    filterBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px;padding:12px 16px;background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border)';
    list.parentElement.insertBefore(filterBar, list);
  }
  filterBar.innerHTML =
    `<span style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap">Récap :</span>
    <button class="btn btn-xs btn-ghost" onclick="window._provAll()">Tous</button>
    <button class="btn btn-xs btn-ghost" onclick="window._provNone()">Aucun</button>
    ${providers.map(p=>`<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;cursor:pointer;white-space:nowrap">
      <input type="checkbox" value="${p.id}" ${!_excluded.has(p.id)?'checked':''} onchange="window._provToggle('${p.id}')">
      ${Utils.escapeHtml(p.firstName+' '+p.lastName)}
    </label>`).join('')}`;
  window._provToggle = id => { _excluded.has(id) ? _excluded.delete(id) : _excluded.add(id); render(); };
  window._provAll = () => { _excluded.clear(); render(); };
  window._provNone = () => { providers.forEach(p => _excluded.add(p.id)); render(); };

  // ── Totaux globaux ─────────────────────────────────────────
  const cm = Utils.currentYearMonth();
  const inclProvIds = new Set(providers.filter(p => !_excluded.has(p.id)).map(p => p.id));
  const inclMonth = allMissionsWithProv.filter(m => inclProvIds.has(m.providerId) && m.date && m.date.startsWith(cm));
  const inclAll   = allMissionsWithProv.filter(m => inclProvIds.has(m.providerId));
  const totMonthCost  = inclMonth.reduce((s,m) => s+(m.duration||0)*(m.providerRate||0), 0);
  const totMonthRev   = inclMonth.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
  const totMonthH     = inclMonth.reduce((s,m) => s+(m.duration||0), 0);
  const totMonthCount = inclMonth.length;
  const totAllCost    = inclAll.reduce((s,m) => s+(m.duration||0)*(m.providerRate||0), 0);
  const totAllRev     = inclAll.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
  const totAllH       = inclAll.reduce((s,m) => s+(m.duration||0), 0);
  const totAllCount   = inclAll.length;

  const summary = `<div class="report-section" style="margin-bottom:24px">
    <h3 class="section-title">Récapitulatif global</h3>
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
      <div class="kpi-card"><div class="kpi-content">
        <div class="kpi-label" style="margin-bottom:4px">Ce mois — ${Utils.MONTHS_LONG[+cm.split('-')[1]-1]}</div>
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

  list.innerHTML = summary + providers.map(p => providerCard(p, allMissions, allMissionsWithProv)).join('');
}

function providerCard(provider, allMissions, allMissionsWithProv) {
  const links = Data.getProviderLinksByProvider(provider.id);
  const linkedCoIds = new Set(links.map(l => l.companyId));
  const rawDirect = allMissions.filter(m => m.providerId === provider.id);
  // Agence = flag explicite uniquement (ex: Agency Evol)
  const isBillingAgency = !!provider.isAgency;
  const directMissions = rawDirect;

  const missions   = isBillingAgency
    ? allMissions.filter(m => linkedCoIds.has(m.companyId))
    : directMissions;
  const done       = missions.filter(m => m.status === 'done');
  const planned    = missions.filter(m => m.status === 'planned');
  const active     = missions;
  const totalH     = active.reduce((s, m) => s + (m.duration||0), 0);
  const totalCost  = isBillingAgency ? 0 : active.reduce((s, m) => s + (m.duration||0)*(m.providerRate||0), 0);
  const totalRev   = active.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const totalMargin = totalRev - totalCost;
  const cm         = Utils.currentYearMonth();
  const monthAll   = active.filter(m => m.date && m.date.startsWith(cm));
  const monthDone  = monthAll.filter(m => m.status === 'done');
  const monthHDone = monthDone.reduce((s, m) => s + (m.duration||0), 0);
  const monthHPlan = monthAll.filter(m => m.status === 'planned').reduce((s, m) => s + (m.duration||0), 0);
  const monthH     = monthHDone + monthHPlan;
  const monthCost  = isBillingAgency ? 0 : monthAll.reduce((s, m) => s + (m.duration||0)*(m.providerRate||0), 0);
  const monthRev   = monthAll.reduce((s, m) => s + (m.duration||0)*(m.billingRate||0), 0);
  const monthMargin = monthRev - monthCost;
  const upcoming   = planned.filter(m => m.date >= Utils.today()).length;
  const initials   = ((provider.firstName||'')[0]||'?') + ((provider.lastName||'')[0]||'');

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
          <div class="provider-stat-value">${upcoming}</div>
          <div class="provider-stat-label">Missions prévues</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${Utils.formatDuration(monthH)}</div>
          <div class="provider-stat-label">Ce mois (h)</div>
        </div>
        <div class="provider-stat highlight">
          <div class="provider-stat-value">${Utils.formatMoney(monthCost)}</div>
          <div class="provider-stat-label">Coût ce mois</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value">${Utils.formatMoney(monthRev)}</div>
          <div class="provider-stat-label">CA ce mois</div>
        </div>
        <div class="provider-stat">
          <div class="provider-stat-value" style="color:${monthMargin>=0?'var(--success)':'var(--danger)'}">${Utils.formatMoney(monthMargin)}</div>
          <div class="provider-stat-label">Marge mois</div>
        </div>
      </div>
      <div class="provider-stats" style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border)">
        <div class="provider-stat">
          <div class="provider-stat-value">${done.length} <span style="font-size:0.7rem;color:var(--text-muted)">(+${planned.length} prévu)</span></div>
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
    </div>
    <div class="provider-card-actions">
      <button class="btn btn-ghost btn-sm" onclick="Modals.openProvider('${provider.id}')">Modifier</button>
      <button class="btn btn-ghost btn-sm" onclick="Modals.openProviderLink(null,'${provider.id}')">+ Lien société</button>
      <button class="btn btn-sm ${isExcluded ? 'btn-primary' : 'btn-ghost'}" onclick="toggleProvider('${provider.id}')" title="${isExcluded ? 'Inclure dans le récap' : 'Exclure du récap'}">${isExcluded ? '+ Inclure' : '— Exclure'}</button>
    </div>
  </div>`;
}
