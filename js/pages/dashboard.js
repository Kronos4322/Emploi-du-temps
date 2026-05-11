// dashboard.js v4
'use strict';

let _dashPole = ''; // '' = tous, sinon poleId

document.addEventListener('DOMContentLoaded', () => {
  Data.init();
  _buildPoleSwitch();
  renderDashboard();
});

// ── Fonctions globales appelées depuis les onclick HTML ───────────

window._setPole = id => { _dashPole = id; _buildPoleSwitch(); renderDashboard(); };

// ── Mémos personnels ─────────────────────────────────────────────

const MEMO_COLORS = ['#f59e0b','#ef4444','#3b82f6','#10b981','#8b5cf6','#64748b'];
window._memoColor = '#f59e0b'; // couleur sélectionnée

function _getMemos() {
  try { return JSON.parse(localStorage.getItem('_edt_memos') || '[]'); } catch { return []; }
}
function _saveMemos(memos) {
  localStorage.setItem('_edt_memos', JSON.stringify(memos));
}

window._addMemo = function() {
  const input = document.getElementById('memo-input');
  const color = window._memoColor || '#f59e0b';
  const text = input?.value?.trim();
  if (!text) return;
  const memos = _getMemos();
  memos.unshift({ id: Date.now().toString(36), text, color, createdAt: Utils.today() });
  _saveMemos(memos);
  input.value = '';
  renderDashboard();
};

window._deleteMemo = function(id) {
  _saveMemos(_getMemos().filter(m => m.id !== id));
  renderDashboard();
};

window._toggleMemoResolved = function(id) {
  const memos = _getMemos();
  const m = memos.find(m => m.id === id);
  if (m) m.resolved = !m.resolved;
  _saveMemos(memos);
  renderDashboard();
};

function _renderMemos() {
  const memos = _getMemos();
  const open = memos.filter(m => !m.resolved);
  const done = memos.filter(m => m.resolved);
  return `<div class="card" style="border:2px solid #f59e0b20">
    <div class="card-header" style="background:#fffbeb">
      <h2 class="card-title" style="color:#92400e">📌 Mes rappels</h2>
      <span class="badge" style="background:#f59e0b;color:#fff">${open.length}</span>
    </div>
    <div class="card-body">
      <!-- Saisie -->
      <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;gap:5px;align-items:center">
          ${MEMO_COLORS.map((c,i) => `<span data-memo-color="${c}"
            onclick="window._memoColor='${c}';document.querySelectorAll('[data-memo-color]').forEach(s=>s.style.transform=s.dataset.memoColor==='${c}'?'scale(1.35)':'scale(1)')"
            style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${c};cursor:pointer;transition:transform .15s;flex-shrink:0;${i===0?'transform:scale(1.35)':''}"></span>`).join('')}
        </div>
        <input id="memo-input" type="text" class="form-input" placeholder="Ajouter un rappel…" style="flex:1;min-width:140px;font-size:0.85rem;padding:6px 10px"
          onkeydown="if(event.key==='Enter')window._addMemo()">
        <button class="btn btn-primary btn-sm" onclick="window._addMemo()" style="white-space:nowrap">+ Ajouter</button>
      </div>
      <!-- Rappels ouverts -->
      ${open.length === 0
        ? '<p style="font-size:0.82rem;color:var(--text-muted);text-align:center;padding:8px 0">Aucun rappel en cours ✓</p>'
        : open.map(m => `
          <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:8px;background:${m.color}12;border-left:3px solid ${m.color};margin-bottom:6px">
            <button onclick="window._toggleMemoResolved('${m.id}')" title="Marquer résolu" style="background:none;border:2px solid ${m.color};border-radius:50%;width:18px;height:18px;cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;padding:0;color:${m.color};font-size:0.7rem">○</button>
            <span style="flex:1;font-size:0.85rem;line-height:1.4">${Utils.escapeHtml(m.text)}</span>
            <span style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;margin-top:2px">${m.createdAt||''}</span>
            <button onclick="window._deleteMemo('${m.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:0;flex-shrink:0" title="Supprimer">✕</button>
          </div>`).join('')}
      <!-- Résolus (repliables) -->
      ${done.length > 0 ? `
        <details style="margin-top:6px">
          <summary style="font-size:0.75rem;color:var(--text-muted);cursor:pointer;padding:4px 0">✓ ${done.length} résolu${done.length>1?'s':''}</summary>
          <div style="margin-top:6px;opacity:0.6">
            ${done.map(m => `
              <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:var(--surface);margin-bottom:4px">
                <button onclick="window._toggleMemoResolved('${m.id}')" title="Rouvrir" style="background:none;border:2px solid #22c55e;border-radius:50%;width:16px;height:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;color:#22c55e;font-size:0.65rem">✓</button>
                <span style="flex:1;font-size:0.8rem;text-decoration:line-through;color:var(--text-muted)">${Utils.escapeHtml(m.text)}</span>
                <button onclick="window._deleteMemo('${m.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem;padding:0" title="Supprimer">✕</button>
              </div>`).join('')}
          </div>
        </details>` : ''}
    </div>
  </div>`;
}

window._dismissConflict = function(aId, bId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem('_edt_dismissed_conflicts') || '[]');
    dismissed.push({ aId, bId });
    localStorage.setItem('_edt_dismissed_conflicts', JSON.stringify(dismissed));
  } catch {}
  renderDashboard();
};

window._markPaid = function(missionId) {
  const m = Data.getMissionById(missionId);
  if (!m) return;
  Data.saveMission({ ...m, paymentStatus: 'paid' });
  renderDashboard();
};

// ── Switch pôle ──────────────────────────────────────────────────

function _buildPoleSwitch() {
  const ownCos = Data.getOwnCompanies();
  const sw = document.getElementById('pole-switch');
  const btnStyle = (active, color) =>
    `style="padding:4px 14px;border-radius:16px;border:none;cursor:pointer;font-size:0.82rem;font-weight:600;background:${active?(color||'var(--primary)'):'transparent'};color:${active?'#fff':'var(--text-muted)'};"`;
  sw.innerHTML =
    `<button ${btnStyle(!_dashPole, '#64748b')} onclick="window._setPole('')">Tous</button>` +
    ownCos.map(c => `<button ${btnStyle(_dashPole===c.id, c.color)} onclick="window._setPole('${c.id}')">${Utils.escapeHtml(c.name)}</button>`).join('');
}

function _poleFilter(m, coMap) {
  if (!_dashPole) return true;
  const co = coMap[m.companyId];
  if (!co) return false;
  if (co.role === 'own') return co.id === _dashPole;
  return co.poleId === _dashPole;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Retourne true si la mission est en distanciel/visio. */
function _isDistanciel(m) {
  const haystack = [m.title||'', m.location||'', m.missionType||'', m.type||'', m.notes||''].join(' ');
  return /distanc|visio|en ligne|online|zoom|teams|google meet|webex|skype/i.test(haystack);
}

/** Formate une date ISO en "lun. 12 mai" avec mise en avant si aujourd'hui. */
function _dayLabel(iso) {
  const DAYS = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
  const MONTHS = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
  const d = new Date(iso + 'T00:00:00');
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Renvoie les conflits non-ignorés. */
function _visibleConflicts(conflicts) {
  let dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem('_edt_dismissed_conflicts') || '[]'); } catch {}
  return conflicts.filter(({ a, b }) =>
    !dismissed.some(d => (d.aId===a.id && d.bId===b.id) || (d.aId===b.id && d.bId===a.id))
  );
}

/** KPI : valeur principale et sous-label intelligents selon réalisé vs prévu. */
function _kpiMoney(done, planned, color) {
  if (done > 0) {
    // Réalisé disponible : on l'affiche en gros, prévu en petit
    return {
      main: Utils.formatMoney(done),
      mainColor: color,
      sub: `<span style="font-size:0.7rem;color:var(--text-muted)">+${Utils.formatMoney(planned)} prévu</span>`
    };
  } else if (planned > 0) {
    // Aucun réalisé mais du prévu → montrer prévu en gros avec badge
    return {
      main: Utils.formatMoney(planned),
      mainColor: '#94a3b8',
      sub: `<span style="font-size:0.68rem;background:#f1f5f9;color:#64748b;border-radius:4px;padding:1px 6px;font-weight:600">PRÉVU</span>`
    };
  } else {
    return { main: Utils.formatMoney(0), mainColor: 'var(--text-muted)', sub: '' };
  }
}

// ── Render principal ─────────────────────────────────────────────

function renderDashboard() {
  const d = Data.getDashboardData();
  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const provMap = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const ownCos = Data.getOwnCompanies();
  const ym = Utils.currentYearMonth();
  const allM = Data.getMissions().filter(m => m.status !== 'cancelled' && m.date && m.date.startsWith(ym));

  const poleM    = allM.filter(m => _poleFilter(m, coMap));
  const donePole = poleM.filter(m => m.status === 'done');
  const planPole = poleM.filter(m => m.status === 'planned');

  const hDone = donePole.reduce((s,m) => s+(m.duration||0), 0);
  const hPlan = planPole.reduce((s,m) => s+(m.duration||0), 0);
  const hProv = poleM.filter(m => m.providerId||m.providerIds?.length).reduce((s,m) => s+(m.duration||0), 0);

  // CA par pôle
  const caByPole = {};
  ownCos.forEach(p => {
    const pMs = allM.filter(m => {
      const co = coMap[m.companyId];
      if (!co) return false;
      if (co.role === 'own') return co.id === p.id;
      if (co.poleId) return co.poleId === p.id;
      return false;
    });
    caByPole[p.id] = {
      name:    p.name,
      color:   p.color,
      ca:      pMs.filter(m => m.status==='done').reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0),
      planned: pMs.filter(m => m.status==='planned').reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0)
    };
  });

  const charges     = donePole.filter(m => m.providerId||m.providerIds?.length).reduce((s,m) => s+(m.duration||0)*(m.providerRate||0), 0);
  const chargesPlan = planPole.filter(m => m.providerId||m.providerIds?.length).reduce((s,m) => s+(m.duration||0)*(m.providerRate||0), 0);

  // ── KPIs ──────────────────────────────────────────────────────
  const kpiGrid = document.getElementById('kpi-grid');
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
      const v = caByPole[p.id] || { ca:0, planned:0 };
      const kpi = _kpiMoney(v.ca, v.planned, p.color);
      return `<div class="kpi-card">
        <div class="kpi-icon" style="background:${p.color}20;color:${p.color}">💶</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color:${kpi.mainColor}">${kpi.main}</div>
          <div class="kpi-label">CA ${Utils.escapeHtml(p.name)} ${kpi.sub}</div>
        </div>
      </div>`;
    }).join('')}
    ${(()=>{
      const kpi = _kpiMoney(charges, chargesPlan, '#ef4444');
      return `<div class="kpi-card">
        <div class="kpi-icon kpi-red">📤</div>
        <div class="kpi-content">
          <div class="kpi-value" style="color:${kpi.mainColor}">${kpi.main}</div>
          <div class="kpi-label">Charges prestataires ${kpi.sub}</div>
        </div>
      </div>`;
    })()}
    <div class="kpi-card">
      <div class="kpi-icon kpi-gray">🎓</div>
      <div class="kpi-content">
        <div class="kpi-value">${_dashPole ? Data.getStudents().filter(s => s.status!=='inactive'&&(s.poleId===_dashPole||s.companyId===_dashPole)).length : d.activeStudentsCount}</div>
        <div class="kpi-label">Étudiants actifs</div>
      </div>
    </div>
  `;

  // ── Aperçu écoles ─────────────────────────────────────────────
  const compEl = document.getElementById('companies-overview');
  if (compEl) {
    const entries = Object.values(d.byCompany).filter(({company:co}) => co.role !== 'own');
    const filtered = _dashPole ? entries.filter(({company:co}) => {
      if (co.poleId) return co.poleId === _dashPole;
      return false; // société sans poleId → exclure
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

  // ── Prochaines missions — groupées par jour ───────────────────
  const upEl = document.getElementById('upcoming-courses');
  const upFiltered = _dashPole ? d.upcoming.filter(m => _poleFilter(m, coMap)) : d.upcoming;
  if (upFiltered.length === 0) {
    upEl.innerHTML = '<p class="empty-state">Aucune mission prévue prochainement.</p>';
  } else {
    const today = Utils.today();
    // Grouper par date
    const byDate = {};
    upFiltered.forEach(m => { if (!byDate[m.date]) byDate[m.date] = []; byDate[m.date].push(m); });
    upEl.innerHTML = Object.entries(byDate)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([date, missions]) => {
        const isToday = date === today;
        const isTomorrow = (() => { const t=new Date(today+'T00:00:00'); t.setDate(t.getDate()+1); return Utils.localISO(t)===date; })();
        let label = _dayLabel(date);
        if (isToday) label += ' <span style="background:var(--primary);color:#fff;font-size:0.65rem;border-radius:4px;padding:1px 6px;vertical-align:middle;font-weight:700">AUJOURD\'HUI</span>';
        else if (isTomorrow) label += ' <span style="background:#f59e0b;color:#fff;font-size:0.65rem;border-radius:4px;padding:1px 6px;vertical-align:middle;font-weight:700">DEMAIN</span>';
        const headerColor = isToday ? 'var(--primary)' : (isTomorrow ? '#f59e0b' : 'var(--text-muted)');
        const dayHeader = `
          <div style="display:flex;align-items:center;gap:10px;margin:${date===Object.keys(byDate)[0]?'0':'20px'} 0 6px;">
            <span style="font-size:0.8rem;font-weight:700;color:${headerColor};white-space:nowrap">${label}</span>
            <div style="flex:1;height:1px;background:var(--border)"></div>
            <span style="font-size:0.72rem;color:var(--text-muted)">${missions.length} mission${missions.length>1?'s':''}</span>
          </div>`;
        return dayHeader + missions.map(m => missionRow(m, coMap, provMap)).join('');
      }).join('');
  }

  // ── Mémos personnels ─────────────────────────────────────
  _renderAlert('alert-memos', _renderMemos());

  // ── Alertes ──────────────────────────────────────────────────
  const visConflicts = _visibleConflicts(d.conflicts);
  _renderAlert('alert-conflicts', visConflicts.length > 0
    ? `<div class="card card-alert">
        <div class="card-header">
          <h2 class="card-title">🚨 Conflits</h2>
          <span class="badge badge-danger">${visConflicts.length}</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:8px">
          ${visConflicts.map(({providerId,a,b}) => {
            const p = provMap[providerId];
            const isPast = a.date < Utils.today();
            return `<div class="conflict-alert" style="position:relative">
              <div class="conflict-alert-title" style="display:flex;align-items:center;justify-content:space-between">
                <span>⚠ ${p?Utils.escapeHtml(p.firstName+' '+p.lastName):'—'}</span>
                ${isPast ? '<span style="font-size:0.65rem;background:#fef2f2;color:#dc2626;border-radius:4px;padding:1px 6px">passé</span>' : ''}
              </div>
              <div class="conflict-alert-body">${Utils.escapeHtml(a.title)} ↔ ${Utils.escapeHtml(b.title)} — ${Utils.formatDate(a.date)}</div>
              <div style="display:flex;gap:6px;margin-top:6px">
                <button class="btn btn-ghost btn-sm" onclick="Modals.openMission('${a.id}',null,()=>renderDashboard())" style="font-size:0.75rem">✏ Modifier</button>
                <button class="btn btn-ghost btn-sm" onclick="window._dismissConflict('${a.id}','${b.id}')" style="font-size:0.75rem;color:var(--text-muted)">✕ Ignorer</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`
    : '');

  _renderAlert('alert-reschedule', d.toReschedule.length > 0
    ? `<div class="card card-alert">
        <div class="card-header"><h2 class="card-title">⚠ À reprogrammer</h2><span class="badge badge-warning">${d.toReschedule.length}</span></div>
        <div class="card-body">${d.toReschedule.map(m => missionRowCompact(m, coMap)).join('')}</div>
      </div>`
    : '');

  _renderAlert('alert-unpaid', d.unpaid.length > 0
    ? `<div class="card card-alert">
        <div class="card-header">
          <h2 class="card-title">💳 Non payés</h2>
          <span class="badge badge-danger">${d.unpaid.length}</span>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:6px">
          ${d.unpaid.map(m => {
            const co = coMap[m.companyId], color = co ? co.color : '#94a3b8';
            const rev = (m.duration||0)*(m.billingRate||0);
            return `<div class="course-row-compact" style="align-items:flex-start;flex-wrap:wrap;gap:4px">
              <span class="course-dot" style="background:${color};flex-shrink:0;margin-top:3px"></span>
              <span class="course-compact-title" style="flex:1;cursor:pointer" onclick="Modals.openMission('${m.id}',null,()=>renderDashboard())">${Utils.escapeHtml(m.title)}</span>
              <span class="course-compact-date" style="color:var(--text-muted)">${Utils.formatDateShort(m.date)}</span>
              ${rev>0?`<span class="course-compact-amount" style="font-weight:700">${Utils.formatMoney(rev)}</span>`:''}
              <button class="btn btn-ghost btn-sm" onclick="window._markPaid('${m.id}')" style="font-size:0.72rem;color:#10b981;border-color:#10b981;padding:1px 8px;margin-left:auto">✓ Payé</button>
            </div>`;
          }).join('')}
        </div>
      </div>`
    : `<div class="card card-success-light"><div class="card-body"><p class="success-message">✓ Toutes les missions réalisées sont payées.</p></div></div>`);

  // ── Formations en cours ───────────────────────────────────────
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

// ── Helpers render ───────────────────────────────────────────────

function _renderAlert(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function missionRow(m, coMap, provMap) {
  const co = coMap[m.companyId];
  const provIds = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
  const provNames = provIds.map(pid => { const p = provMap[pid]; return p ? p.firstName+' '+p.lastName : ''; }).filter(Boolean).join(', ');
  const color = co ? co.color : '#94a3b8';
  const bg = Utils.lightenColor(color, 0.88);
  const distanciel = _isDistanciel(m);

  return `<div class="course-row" onclick="Modals.openMission('${m.id}',null,()=>renderDashboard())" style="border-left:3px solid ${color};background:${bg}">
    <div class="course-row-main">
      <span class="course-row-title">
        ${Utils.getMissionTypeIcon(m.missionType)} ${Utils.escapeHtml(m.title)}
        ${distanciel ? '<span title="Distanciel / Visio" style="display:inline-flex;align-items:center;justify-content:center;background:#e0f2fe;color:#0284c7;border-radius:6px;padding:0 5px;font-size:0.78rem;margin-left:5px;vertical-align:middle">💻 visio</span>' : ''}
      </span>
      <span class="course-row-time">${m.startTime||''} → ${m.endTime||''} · ${Utils.formatDuration(m.duration)}</span>
    </div>
    <div class="course-row-meta">
      ${co?`<span class="course-school-badge" style="background:${color};color:${Utils.contrastColor(color)}">${Utils.escapeHtml(co.name)}</span>`:''}
      ${provNames?`<span class="course-row-location">👤 ${Utils.escapeHtml(provNames)}</span>`:''}
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
