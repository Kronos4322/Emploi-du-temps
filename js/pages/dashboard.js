// dashboard.js v3
'use strict';

let _dashPole = ''; // '' = tous, sinon poleId

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  _buildPoleSwitch();
  renderDashboard();
  document.getElementById('btn-new-course').addEventListener('click', () =>
    Modals.openMission(null, null, () => renderDashboard()));
});

function _buildPoleSwitch() {
  const ownCos = Data.getOwnCompanies();
  const sw = document.getElementById('pole-switch');
  const btnStyle = (active, color) =>
    `style="padding:4px 14px;border-radius:16px;border:none;cursor:pointer;font-size:0.82rem;font-weight:600;background:${active?(color||'var(--primary)'):'transparent'};color:${active?'#fff':'var(--text-muted)'};"`;
  sw.innerHTML =
    `<button ${btnStyle(!_dashPole, '#64748b')} onclick="window._setPole('')">Tous</button>` +
    ownCos.map(c => `<button ${btnStyle(_dashPole===c.id, c.color)} onclick="window._setPole('${c.id}')">${Utils.escapeHtml(c.name)}</button>`).join('');
}
window._setPole = id => { _dashPole = id; _buildPoleSwitch(); renderDashboard(); };

function _poleFilter(m, coMap) {
  if (!_dashPole) return true;
  const co = coMap[m.companyId];
  if (!co) return false;
  if (co.role === 'own') return co.id === _dashPole;
  return co.poleId === _dashPole;
}

function renderDashboard() {
  const d = Data.getDashboardData();
  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const provMap = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const ownCos = Data.getOwnCompanies();
  const ym = Utils.currentYearMonth();
  const allM = Data.getMissions().filter(m => m.status !== 'cancelled' && m.date && m.date.startsWith(ym));

  // Missions filtrées par pôle
  const poleM = allM.filter(m => _poleFilter(m, coMap));
  const donePole = poleM.filter(m => m.status === 'done');
  const planPole = poleM.filter(m => m.status === 'planned');

  // Heures pôle (missions + prestataires)
  const hDone = donePole.reduce((s,m)=>s+(m.duration||0),0);
  const hPlan = planPole.reduce((s,m)=>s+(m.duration||0),0);
  // Heures prestataires (missions du pôle avec providerId)
  const hProv = poleM.filter(m=>m.providerId).reduce((s,m)=>s+(m.duration||0),0);

  // CA par pôle (toujours les deux)
  const caByPole = {};
  ownCos.forEach(p => {
    const ms = allM.filter(m => _poleFilter(m, {...coMap, _override: p.id}));
    // On recalcule sans override : CA de chaque pôle indépendamment
    const pMs = allM.filter(m => {
      const co = coMap[m.companyId];
      if (!co) return false;
      if (co.role === 'own') return co.id === p.id;
      if (co.poleId) return co.poleId === p.id;
      return p.defaultBillingRate === 35 ? m.billingRate === 35 : m.billingRate !== 35;
    });
    caByPole[p.id] = { name: p.name, color: p.color,
      ca:     pMs.filter(m=>m.status==='done').reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0),
      planned:pMs.filter(m=>m.status==='planned').reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0)
    };
  });

  // Charges prestataires du pôle ce mois
  const charges = donePole.filter(m=>m.providerId).reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);
  const chargesPlan = planPole.filter(m=>m.providerId).reduce((s,m)=>s+(m.duration||0)*(m.providerRate||0),0);

  // ── KPIs ──
  const kpiGrid = document.getElementById('kpi-grid');
  const poleLabel = _dashPole ? (coMap[_dashPole]?.name||'') : 'tous pôles';
  kpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon kpi-purple">⏱</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatDuration(hDone+hPlan)}</div>
        <div class="kpi-label">Heures ce mois <span style="font-size:0.7rem;color:var(--text-muted)">(${Utils.formatDuration(hDone)} réalisées)</span></div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-blue">👤</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatDuration(hProv)}</div>
        <div class="kpi-label">Heures prestataires</div>
      </div>
    </div>
    ${ownCos.map(p => {
      const v = caByPole[p.id]||{ca:0,planned:0};
      return `<div class="kpi-card">
        <div class="kpi-icon" style="background:${p.color}20;color:${p.color}">💶</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color:${p.color}">${Utils.formatMoney(v.ca)}</div>
          <div class="kpi-label">CA ${Utils.escapeHtml(p.name)} <span style="font-size:0.7rem;color:var(--text-muted)">(+${Utils.formatMoney(v.planned)} prévu)</span></div>
        </div>
      </div>`;
    }).join('')}
    <div class="kpi-card">
      <div class="kpi-icon kpi-red">📤</div>
      <div class="kpi-content">
        <div class="kpi-value">${Utils.formatMoney(charges)}</div>
        <div class="kpi-label">Charges prestataires <span style="font-size:0.7rem;color:var(--text-muted)">(+${Utils.formatMoney(chargesPlan)} prévu)</span></div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-gray">🎓</div>
      <div class="kpi-content">
        <div class="kpi-value">${_dashPole ? Data.getStudents().filter(s => s.status !== 'inactive' && (s.poleId === _dashPole || s.companyId === _dashPole)).length : d.activeStudentsCount}</div>
        <div class="kpi-label">Étudiants actifs</div>
      </div>
    </div>
  `;

  // ── Aperçu écoles (sans sociétés propres) ──
  const compEl = document.getElementById('companies-overview');
  if (compEl) {
    const entries = Object.values(d.byCompany).filter(({company:co}) => co.role !== 'own');
    const filtered = _dashPole ? entries.filter(({company:co}) => {
      if (co.poleId) return co.poleId === _dashPole;
      const pole = coMap[_dashPole];
      return pole ? (pole.defaultBillingRate===35 ? co.defaultBillingRate===35 : co.defaultBillingRate!==35) : true;
    }) : entries;
    compEl.innerHTML = filtered.map(({company:co, planned, done, hoursPlanned, hoursDone}) => {
      const lightBg = Utils.lightenColor(co.color, 0.88);
      return `<div class="company-mini-card" style="background:${lightBg};border:1px solid ${co.color}40" onclick="location.href='ecoles.html'">
        <div class="company-mini-name" style="color:${co.color}">${Utils.escapeHtml(co.name)}</div>
        <div class="company-mini-stats">
          <div class="company-mini-stat"><span>Prévues</span><strong>${planned}</strong></div>
          <div class="company-mini-stat"><span>Réalisées</span><strong>${done}</strong></div>
          <div class="company-mini-stat"><span>H prévues</span><strong>${Utils.formatDuration(hoursPlanned)}</strong></div>
        </div>
      </div>`;
    }).join('') || '<p class="empty-state">Aucune école.</p>';
  }

  // ── Prochaines missions ──
  const upEl = document.getElementById('upcoming-courses');
  const upFiltered = _dashPole ? d.upcoming.filter(m => _poleFilter(m, coMap)) : d.upcoming;
  upEl.innerHTML = upFiltered.length === 0
    ? '<p class="empty-state">Aucune mission prévue prochainement.</p>'
    : upFiltered.map(m => missionRow(m, coMap, provMap)).join('');

  // ── Alertes ──
  _renderAlert('alert-conflicts', d.conflicts.length > 0 ? `<div class="card card-alert"><div class="card-header"><h2 class="card-title">🚨 Conflits</h2><span class="badge badge-danger">${d.conflicts.length}</span></div><div class="card-body">${d.conflicts.map(({providerId,a,b})=>{const p=provMap[providerId];return`<div class="conflict-alert"><div class="conflict-alert-title">⚠ ${p?p.firstName+' '+p.lastName:'—'}</div><div class="conflict-alert-body">${Utils.escapeHtml(a.title)} ↔ ${Utils.escapeHtml(b.title)} — ${Utils.formatDate(a.date)}</div></div>`;}).join('')}</div></div>` : '');
  _renderAlert('alert-reschedule', d.toReschedule.length > 0 ? `<div class="card card-alert"><div class="card-header"><h2 class="card-title">⚠ À reprogrammer</h2><span class="badge badge-warning">${d.toReschedule.length}</span></div><div class="card-body">${d.toReschedule.map(m=>missionRowCompact(m,coMap)).join('')}</div></div>` : '');
  _renderAlert('alert-unpaid', d.unpaid.length > 0
    ? `<div class="card card-alert"><div class="card-header"><h2 class="card-title">💳 Non payés</h2><span class="badge badge-danger">${d.unpaid.length}</span></div><div class="card-body">${d.unpaid.map(m=>missionRowCompact(m,coMap)).join('')}</div></div>`
    : `<div class="card card-success-light"><div class="card-body"><p class="success-message">✓ Toutes les missions réalisées sont payées.</p></div></div>`);

  // ── Formations ──
  const formEl = document.getElementById('active-formations');
  if (formEl) {
    formEl.innerHTML = d.activeFormations.length > 0
      ? d.activeFormations.map(f => {
          const co = Data.getCompanyById(f.companyId);
          const pct = f.totalHours > 0 ? Math.round(f.completedHours/f.totalHours*100) : 0;
          const color = co ? co.color : '#3b82f6';
          return `<div class="course-row-compact" onclick="location.href='formations.html'" style="cursor:pointer">
            <span class="course-dot" style="background:${color}"></span>
            <span class="course-compact-title">${Utils.escapeHtml(f.name)}</span>
            <span class="course-compact-date">${f.completedHours}h / ${f.totalHours}h (${pct}%)</span>
          </div>`;
        }).join('')
      : '<p class="empty-state">Aucune formation active.</p>';
  }
}

function _renderAlert(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function missionRow(m, coMap, provMap) {
  const co = coMap[m.companyId], prov = provMap[m.providerId];
  const color = co ? co.color : '#94a3b8';
  const bg = Utils.lightenColor(color, 0.88);
  return `<div class="course-row" onclick="Modals.openMission('${m.id}',null,()=>renderDashboard())" style="border-left:3px solid ${color};background:${bg}">
    <div class="course-row-main">
      <span class="course-row-title">${Utils.getMissionTypeIcon(m.missionType)} ${Utils.escapeHtml(m.title)}</span>
      <span class="course-row-time">${m.startTime} → ${m.endTime} · ${Utils.formatDuration(m.duration)}</span>
    </div>
    <div class="course-row-meta">
      <span class="course-row-date">${Utils.formatDateShort(m.date)}</span>
      ${co?`<span class="course-school-badge" style="background:${color};color:${Utils.contrastColor(color)}">${Utils.escapeHtml(co.name)}</span>`:''}
      ${prov?`<span class="course-row-location">👤 ${Utils.escapeHtml(prov.firstName+' '+prov.lastName)}</span>`:''}
    </div>
  </div>`;
}

function missionRowCompact(m, coMap) {
  const co = coMap[m.companyId], color = co ? co.color : '#94a3b8';
  const rev = (m.duration||0)*(m.billingRate||0);
  return `<div class="course-row-compact" onclick="Modals.openMission('${m.id}',null,()=>renderDashboard())">
    <span class="course-dot" style="background:${color}"></span>
    <span class="course-compact-title">${Utils.escapeHtml(m.title)}</span>
    <span class="course-compact-date">${Utils.formatDateShort(m.date)}</span>
    ${rev>0?`<span class="course-compact-amount">${Utils.formatMoney(rev)}</span>`:''}
  </div>`;
}
