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

// ── Export Planning mensuel ──────────────────────────────────────

window._showPlanningExport = function() {
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled');
  const months = [...new Set(allMissions.map(m => m.date?.substring(0,7)).filter(Boolean))].sort().reverse();
  if (!months.length) { Utils.toast('Aucune mission trouvée.', 'info'); return; }

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = m => { const [y,mo] = m.split('-'); return `${MONTHS_FR[+mo-1]} ${y}`; };
  const currentM  = Utils.currentYearMonth();
  const providers = Data.getProviders().slice().sort((a,b) => (a.lastName+a.firstName).localeCompare(b.lastName+b.firstName));

  Modals._open(`
    <div class="modal-header">
      <h3>📄 Exporter un planning mensuel</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body modal-body-scroll" style="padding:24px;display:flex;flex-direction:column;gap:16px">
      <p style="color:var(--text-muted);font-size:0.88rem;margin:0">
        Génère un document imprimable (style agenda) pour le mois sélectionné.
      </p>

      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>Mois</label>
          <select id="planning-month-sel" class="form-input">
            ${months.map(m => `<option value="${m}" ${m===currentM?'selected':''}>${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-col-2">
          <label>Pôle (optionnel)</label>
          <select id="planning-pole-sel" class="form-input">
            <option value="">Tous les pôles</option>
            ${Data.getOwnCompanies().map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label style="margin-bottom:8px;display:block">Prestataire(s) — laisser vide pour tous</label>
        <div style="border:1px solid var(--border);border-radius:8px;max-height:180px;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;padding:2px 0;border-bottom:1px solid var(--border);margin-bottom:2px">
            <input type="checkbox" id="planning-prov-all" checked style="width:auto" onchange="document.querySelectorAll('.planning-prov-chk').forEach(c=>c.checked=this.checked)">
            <strong>Tous les prestataires</strong>
          </label>
          ${providers.map(p => `<label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer;padding:2px 0">
            <input type="checkbox" class="planning-prov-chk" value="${p.id}" checked style="width:auto"
              onchange="document.getElementById('planning-prov-all').checked=[...document.querySelectorAll('.planning-prov-chk')].every(c=>c.checked)">
            ${Utils.escapeHtml(p.lastName+' '+p.firstName)}${p.structure?` <span style="color:var(--text-muted);font-size:0.78rem">— ${Utils.escapeHtml(p.structure)}</span>`:''}
          </label>`).join('')}
        </div>
      </div>

      <div class="form-group" style="margin:0">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal">
          <input type="checkbox" id="planning-cancelled" style="width:auto">
          Inclure les missions annulées
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="window._generatePlanning()">🖨 Générer & Imprimer</button>
    </div>
  `);
};

window._generatePlanning = function() {
  const month         = document.getElementById('planning-month-sel')?.value;
  const poleId        = document.getElementById('planning-pole-sel')?.value || '';
  const inclCancelled = document.getElementById('planning-cancelled')?.checked || false;

  // Prestataires sélectionnés (null = tous)
  const checkedProvs = [...document.querySelectorAll('.planning-prov-chk:checked')].map(c => c.value);
  const allChecked   = document.getElementById('planning-prov-all')?.checked;
  const provFilter   = allChecked ? null : new Set(checkedProvs); // null = pas de filtre

  Modals.close();
  if (!month) return;

  const MONTHS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR    = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const DAYS_SHORT = ['DIM.','LUN.','MAR.','MER.','JEU.','VEN.','SAM.'];
  const [yr, mo]   = month.split('-');
  const monthName  = `${MONTHS_FR[+mo-1]} ${yr}`;

  const coMap   = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const provMap = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const ownCos  = Data.getOwnCompanies();

  // Filtrer les missions du mois
  let missions = Data.getMissions().filter(m => m.date && m.date.startsWith(month));
  if (!inclCancelled) missions = missions.filter(m => m.status !== 'cancelled');
  if (poleId) missions = missions.filter(m => {
    const co = coMap[m.companyId]; if (!co) return false;
    if (co.role === 'own') return co.id === poleId;
    return co.poleId === poleId;
  });
  // Filtre prestataires
  if (provFilter !== null) {
    missions = missions.filter(m => {
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      // Garder si au moins un prestataire sélectionné est impliqué
      return pids.some(pid => provFilter.has(pid));
    });
  }
  missions.sort((a, b) => (a.date + (a.startTime||'')).localeCompare(b.date + (b.startTime||'')));

  if (!missions.length) { Utils.toast('Aucune mission trouvée pour ces critères.', 'info'); return; }

  // Grouper par date
  const byDate = {};
  missions.forEach(m => { if (!byDate[m.date]) byDate[m.date] = []; byDate[m.date].push(m); });

  // Totaux
  const totalH     = missions.reduce((s,m) => s+(m.duration||0), 0);
  const totalRev   = missions.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
  const totalCost  = missions.reduce((s,m) => {
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
    return pids.length ? s+(m.duration||0)*(m.providerRate||0) : s;
  }, 0);
  const doneCount  = missions.filter(m => m.status==='done').length;
  const planCount  = missions.filter(m => m.status==='planned').length;

  const settings  = Data.getSettings();
  const respName  = settings.responsableName || ownCos.map(c=>c.name).join(' & ');
  const poleLabel = poleId ? (coMap[poleId]?.name||'') : ownCos.map(c=>c.name).join(' & ');

  // Palettes statuts
  const statusBadge = s => s==='done' ? '✓' : s==='cancelled' ? '✗' : '';
  const statusColor = s => s==='done' ? '#22c55e' : s==='cancelled' ? '#ef4444' : '#3b82f6';

  // Générer les lignes par jour
  const dayRows = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date, ms]) => {
    const d = new Date(date + 'T00:00:00');
    const dayNum  = d.getDate();
    const dayName = DAYS_FR[d.getDay()];
    const dayShort = DAYS_SHORT[d.getDay()];
    const dayH    = ms.reduce((s,m)=>s+(m.duration||0),0);
    const dayAmt  = ms.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);

    const missionLines = ms.map(m => {
      const co = coMap[m.companyId];
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      const provNames = pids.map(pid => { const p=provMap[pid]; return p?p.lastName+' '+p.firstName:''; }).filter(Boolean).join(', ');
      const time = m.startTime && m.endTime
        ? `De ${m.startTime.replace(':','h')} à ${m.endTime.replace(':','h')}`
        : (m.startTime ? `À ${m.startTime.replace(':','h')}` : '—');
      const loc = m.location || '';
      const badge = statusBadge(m.status);
      const bColor = statusColor(m.status);
      const isCancelled = m.status === 'cancelled';
      const lineAmt = (m.duration||0) * (m.billingRate||0);
      return `<tr class="${isCancelled?'cancelled':''}">
        <td class="td-time">${time}</td>
        <td class="td-dot"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${co?co.color:'#94a3b8'};flex-shrink:0"></span></td>
        <td class="td-title">
          <span class="mission-title">${badge?`<span style="color:${bColor};font-weight:700;margin-right:4px">${badge}</span>`:''}${m.title}</span>
          ${co?`<span class="mission-school">${co.name}</span>`:''}
          ${loc?`<span class="mission-loc">📍 ${loc}</span>`:''}
          ${provNames?`<span class="mission-prov">👤 ${provNames}</span>`:''}
        </td>
        <td class="td-duration">${Utils.formatDuration(m.duration)}<br><span style="font-size:7.5pt;color:#94a3b8;font-weight:400">${m.billingRate||0}€/h</span></td>
        <td class="td-amount">${Utils.formatMoney(lineAmt)}</td>
      </tr>`;
    }).join('');

    return `<tbody class="day-group">
      <tr class="day-header">
        <td colspan="4">
          <span class="day-num">${dayNum}</span>
          <span class="day-name">${dayName.toUpperCase()}</span>
          <span class="day-total">${Utils.formatDuration(dayH)}</span>
        </td>
        <td style="background:#f8fafc;padding:7px 10px;border-top:2px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-align:right;font-size:9pt;font-weight:700;color:#475569;white-space:nowrap">${Utils.formatMoney(dayAmt)}</td>
      </tr>
      ${missionLines}
    </tbody>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Planning ${monthName} — ${poleLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; background: #fff; padding: 18mm 16mm; }

    /* En-tête */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e293b; padding-bottom: 10px; margin-bottom: 18px; }
    .doc-title   { font-size: 20pt; font-weight: 800; letter-spacing: -0.5px; }
    .doc-month   { font-size: 13pt; font-weight: 600; color: #3b82f6; }
    .doc-meta    { text-align: right; font-size: 9pt; color: #64748b; line-height: 1.6; }

    /* Tableau */
    table { width: 100%; border-collapse: collapse; }

    /* Entête de jour */
    .day-header td { background: #f8fafc; padding: 8px 10px; border-top: 2px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    .day-num  { font-size: 16pt; font-weight: 800; color: #1e293b; margin-right: 8px; }
    .day-name { font-size: 9pt; font-weight: 700; color: #64748b; letter-spacing: 0.08em; }
    .day-total{ float: right; font-size: 9pt; font-weight: 600; color: #64748b; background: #e2e8f0; border-radius: 10px; padding: 1px 8px; margin-top: 4px; }

    /* Lignes missions */
    .td-time     { width: 130px; padding: 7px 10px 7px 18px; font-size: 9.5pt; color: #475569; vertical-align: top; white-space: nowrap; }
    .td-dot      { width: 18px; padding: 10px 4px 0; vertical-align: top; }
    .td-title    { padding: 7px 10px; vertical-align: top; }
    .td-duration { width: 52px; padding: 7px 6px 7px 4px; font-size: 9pt; color: #64748b; text-align: right; vertical-align: top; white-space: nowrap; font-weight: 600; }
    .td-amount   { width: 80px; padding: 7px 10px 7px 4px; font-size: 9pt; color: #1e293b; text-align: right; vertical-align: top; white-space: nowrap; font-weight: 700; }

    .mission-title  { display: block; font-weight: 600; font-size: 10pt; color: #1e293b; }
    .mission-school { display: block; font-size: 9pt; color: #3b82f6; margin-top: 1px; }
    .mission-loc    { display: block; font-size: 8.5pt; color: #94a3b8; margin-top: 1px; }
    .mission-prov   { display: block; font-size: 8.5pt; color: #64748b; margin-top: 1px; }

    tr:nth-child(even) td { background: #fafbfc; }
    .cancelled td { opacity: 0.45; text-decoration: line-through; }

    /* Pied de page */
    .doc-footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .footer-kpi { text-align: center; background: #f8fafc; border-radius: 8px; padding: 10px; }
    .footer-kpi .val { font-size: 15pt; font-weight: 800; color: #1e293b; }
    .footer-kpi .lbl { font-size: 8pt; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
    .footer-sign { margin-top: 20px; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }

    @media print {
      body { padding: 12mm 10mm; }
      .no-print { display: none !important; }
      .day-group { break-inside: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="background:#3b82f6;color:#fff;padding:10px 18px;border-radius:8px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
    <span>📄 Planning <strong>${monthName}</strong> — Prêt à imprimer</span>
    <button onclick="window.print()" style="background:#fff;color:#3b82f6;border:none;border-radius:6px;padding:6px 16px;font-weight:700;cursor:pointer;font-size:0.9rem">🖨 Imprimer / Sauvegarder PDF</button>
  </div>

  <div class="doc-header">
    <div>
      <div class="doc-title">Planning mensuel</div>
      <div class="doc-month">${monthName}${poleId ? ' — '+poleLabel : ''}</div>
    </div>
    <div class="doc-meta">
      ${respName}<br>
      ${poleLabel}<br>
      Généré le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
    </div>
  </div>

  <table>
    ${dayRows}
  </table>

  <div class="doc-footer">
    <div class="footer-kpi"><div class="val">${planCount}</div><div class="lbl">Missions prévues</div></div>
    <div class="footer-kpi"><div class="val">${Utils.formatDuration(totalH)}</div><div class="lbl">Heures totales</div></div>
    <div class="footer-kpi"><div class="val">${Utils.formatMoney(totalRev)}</div><div class="lbl">CA facturé</div></div>
  </div>

  <div class="footer-sign">${respName === poleLabel ? respName : respName+' — '+poleLabel} — Planning ${monthName}</div>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
};

// ══════════════════════════════════════════════════════════════════
// GÉNÉRATION DE FACTURE
// ══════════════════════════════════════════════════════════════════

window._selectInvoiceEmetteur = function(id) {
  document.getElementById('inv-emetteur').value = id;
  Data.getOwnCompanies().forEach(c => {
    const btn = document.getElementById('inv-emit-' + c.id);
    if (!btn) return;
    const active = c.id === id;
    btn.style.background = active ? c.color : 'transparent';
    btn.style.color      = active ? '#fff'  : c.color;
    btn.style.borderColor = c.color;
  });
};

window._showInvoiceExport = function() {
  const missions = Data.getMissions().filter(m => m.status !== 'cancelled');
  const months   = [...new Set(missions.map(m => m.date?.substring(0,7)).filter(Boolean))].sort().reverse();
  if (!months.length) { Utils.toast('Aucune mission trouvée.', 'info'); return; }

  const ownCos   = Data.getOwnCompanies();
  const providers = Data.getProviders().slice().sort((a,b) =>
    (a.structure||a.lastName).localeCompare(b.structure||b.lastName));
  const settings  = Data.getSettings();

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = m => { const [y,mo] = m.split('-'); return `${MONTHS_FR[+mo-1]} ${y}`; };

  // Délai par défaut depuis les settings
  const defaultDelay = settings.invoicePaymentDelay || '45 jours';
  const delayOptions = ['30 jours','45 jours','60 jours','À réception']
    .map(d => `<option value="${d}" ${d===defaultDelay?'selected':''}>${d}</option>`).join('');

  const missingInfo = !settings.siret || !settings.iban;

  // Pôle actif dans le dashboard → pré-sélectionner la société
  const defaultEmetteurId = (_dashPole && ownCos.find(c => c.id === _dashPole))
    ? _dashPole : (ownCos[0]?.id || '');

  // Pilules sociétés émettrices
  const emetteurPills = ownCos.map((c, i) => {
    const active = c.id === defaultEmetteurId;
    return `<button type="button" id="inv-emit-${c.id}"
      onclick="window._selectInvoiceEmetteur('${c.id}')"
      style="padding:7px 18px;border-radius:20px;border:2px solid ${c.color};
             background:${active ? c.color : 'transparent'};
             color:${active ? '#fff' : c.color};
             font-weight:700;cursor:pointer;font-size:0.9rem;transition:all 0.15s">
      ${Utils.escapeHtml(c.name)}
    </button>`;
  }).join('');

  Modals._open(`
    <div class="modal-header">
      <h3>📋 Préparer une facture</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body modal-body-scroll" style="padding:24px;display:flex;flex-direction:column;gap:16px">

      ${missingInfo ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;font-size:0.85rem;color:#92400e;display:flex;gap:8px;align-items:center">
        <span>⚠️</span>
        <span>SIRET / IBAN non configurés — la facture sera incomplète.
        <a href="parametres.html" style="color:#92400e;font-weight:700;text-decoration:underline">Configurer →</a></span>
      </div>` : ''}

      <!-- Société émettrice -->
      <div>
        <div style="font-size:0.82rem;font-weight:600;color:var(--text-muted);margin-bottom:8px">Société émettrice</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${emetteurPills}
        </div>
        <input type="hidden" id="inv-emetteur" value="${defaultEmetteurId}">
      </div>

      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>Mois de facturation</label>
          <select id="inv-month" class="form-input">
            ${months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-col-2">
          <label>Facturer à (destinataire)</label>
          <select id="inv-prov" class="form-input">
            ${providers.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.structure||p.lastName+' '+p.firstName)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="form-group" style="margin:0">
          <label>N° facture</label>
          <input type="number" id="inv-num" class="form-input" placeholder="47" min="1">
        </div>
        <div class="form-group" style="margin:0">
          <label>Date de facture</label>
          <input type="date" id="inv-date" class="form-input" value="${Utils.today()}">
        </div>
        <div class="form-group" style="margin:0">
          <label>Délai de paiement</label>
          <select id="inv-delay" class="form-input">${delayOptions}</select>
        </div>
      </div>

      <div class="form-group" style="margin:0">
        <label>Référence client <span style="color:var(--text-muted);font-size:0.8rem">(optionnel)</span></label>
        <input type="text" id="inv-ref" class="form-input" placeholder="ex: EVOL0611052025">
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="window._generateInvoice()">📋 Générer la facture</button>
    </div>
  `);
};

window._generateInvoice = function() {
  const month  = document.getElementById('inv-month')?.value;
  const provId = document.getElementById('inv-prov')?.value;
  const invNum = document.getElementById('inv-num')?.value.trim();
  const invDate= document.getElementById('inv-date')?.value;
  const delay  = document.getElementById('inv-delay')?.value;
  const ref    = document.getElementById('inv-ref')?.value.trim();

  if (!month || !provId) { Utils.toast('Champs requis manquants.', 'error'); return; }

  const [iy,im,id2] = (invDate||Utils.today()).split('-');
  const invDateFr = `${id2}/${im}/${iy}`;

  const MONTHS_FR   = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const MONTHS_SH   = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  const [y, mo]     = month.split('-');
  const monthName   = `${MONTHS_FR[+mo-1]} ${y}`;

  const provider = Data.getProviders().find(p => p.id === provId);
  if (!provider) { Utils.toast('Prestataire introuvable.', 'error'); return; }

  const emetteurId = document.getElementById('inv-emetteur')?.value || '';
  const ownCos   = Data.getOwnCompanies();
  const coMap    = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const settings = Data.getSettings();

  // Infos de la société émettrice sélectionnée
  const ourCo    = ownCos.find(c => c.id === emetteurId) || ownCos[0];
  const ourName  = ourCo?.name || settings.responsableName || 'Artémis Prépa';
  const ourAddr  = ourCo?.address || '';
  const ourPhone = ourCo?.phone || '';
  const ourEmail = ourCo?.email || '';
  const siret      = settings.siret      || '';
  const iban       = settings.iban       || '';
  const bic        = settings.bic        || '';
  const codebanque = settings.codebanque || '';
  const clerib     = settings.clerib     || '';
  const numcompte  = settings.numcompte  || '';
  const bankname   = settings.bankname   || '';

  // Filtre missions : mois + prestataire (non annulées)
  let missions = Data.getMissions().filter(m => {
    if (!m.date || !m.date.startsWith(month)) return false;
    if (m.status === 'cancelled') return false;
    const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
    return pids.includes(provId);
  });
  missions.sort((a,b) => (a.date+(a.startTime||'')).localeCompare(b.date+(b.startTime||'')));

  if (!missions.length) {
    Utils.toast('Aucune mission pour ce prestataire sur ce mois.', 'info');
    return;
  }

  // Totaux
  const totalH  = missions.reduce((s,m) => s+(m.duration||0), 0);
  const totalHT = missions.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);

  // Lignes du tableau
  const rows = missions.map(m => {
    const co    = coMap[m.companyId];
    const d     = new Date(m.date + 'T00:00:00');
    const day   = String(d.getDate()).padStart(2,'0') + ' ' + MONTHS_SH[d.getMonth()];
    const title = m.title || '';
    const school = co?.name || '';
    const qty   = m.duration || 0;
    const pu    = m.billingRate || 0;
    const total = qty * pu;
    const qtyStr = qty % 1 === 0 ? qty.toFixed(2).replace('.',',') : String(qty).replace('.',',');
    return `<tr>
      <td class="col-date">${day}</td>
      <td class="col-qty">${qtyStr}</td>
      <td class="col-desc">${Utils.escapeHtml(title)}${school?`<br><span class="school-name">${Utils.escapeHtml(school)}</span>`:''}</td>
      <td class="col-pu">${pu.toFixed(2).replace('.',',')} €</td>
      <td class="col-tot">${Utils.formatMoney(total)}</td>
    </tr>`;
  }).join('');

  // Adresse prestataire multi-lignes
  const provName = provider.structure || `${provider.lastName} ${provider.firstName}`;
  const provAddr = provider.address || '';
  const provContact = [provider.email, provider.phone].filter(Boolean).join(' — ');

  // Infos "De" multi-lignes
  const ourLines = [ourAddr, ourPhone && ourEmail ? `${ourEmail} — ${ourPhone}` : (ourEmail||ourPhone), siret ? `SIRET : ${siret}` : ''].filter(Boolean);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture${invNum?' #'+invNum:''} — ${ourName} — ${monthName}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:11pt; color:#1e293b; background:#fff; padding:18mm 16mm; }

    /* Barre d'impression */
    .no-print { background:#3b82f6; color:#fff; padding:10px 18px; border-radius:8px; margin-bottom:22px;
                display:flex; align-items:center; justify-content:space-between; }
    .no-print button { background:#fff; color:#3b82f6; border:none; border-radius:6px; padding:6px 16px; font-weight:700; cursor:pointer; }

    /* En-tête */
    .inv-header { display:flex; justify-content:space-between; align-items:flex-start;
                  border-bottom:3px solid #1e293b; padding-bottom:18px; margin-bottom:26px; }
    .inv-from .company-name { font-size:17pt; font-weight:800; letter-spacing:-0.5px; margin-bottom:6px; }
    .inv-from .company-info { font-size:9pt; color:#64748b; line-height:1.8; }
    .inv-meta { text-align:right; }
    .inv-word { font-size:26pt; font-weight:800; color:#3b82f6; letter-spacing:-1px; }
    .inv-num  { font-size:10.5pt; color:#64748b; margin-top:3px; }
    .inv-dates{ font-size:9pt; color:#475569; margin-top:10px; line-height:1.7; }

    /* Parties */
    .inv-parties { display:flex; gap:20px; margin-bottom:22px; }
    .party { flex:1; background:#f8fafc; border-radius:8px; padding:14px 16px; }
    .party-tag  { font-size:7.5pt; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.12em; margin-bottom:5px; }
    .party-name { font-size:11.5pt; font-weight:700; margin-bottom:4px; }
    .party-info { font-size:9pt; color:#64748b; line-height:1.7; }

    /* Ref */
    .inv-ref { background:#eff6ff; border-left:3px solid #3b82f6; padding:8px 14px; margin-bottom:22px;
               font-size:9.5pt; color:#1e40af; }

    /* Tableau */
    table { width:100%; border-collapse:collapse; }
    thead th { background:#1e293b; color:#fff; padding:9px 12px; font-size:8.5pt;
               font-weight:700; text-transform:uppercase; letter-spacing:0.07em; text-align:left; }
    thead th.r { text-align:right; }
    tbody td { padding:9px 12px; border-bottom:1px solid #f1f5f9; vertical-align:middle; font-size:10pt; }
    tbody tr:nth-child(even) td { background:#fafbfc; }

    .col-date { width:70px; font-weight:600; white-space:nowrap; }
    .col-qty  { width:65px; text-align:right; }
    .col-desc { }
    .col-pu   { width:85px; text-align:right; }
    .col-tot  { width:95px; text-align:right; font-weight:700; }
    .school-name { font-size:8.5pt; color:#64748b; }

    /* Pied de tableau */
    tfoot td { padding:9px 12px; }
    .tf-sep td { border-top:2px solid #e2e8f0; padding-top:10px; }
    .tf-tva   { font-size:8pt; color:#94a3b8; font-style:italic; }
    .tf-ttc td { background:#1e293b; color:#fff; font-weight:700; border-radius:0 0 6px 6px; }
    .tf-ttc .col-tot { font-size:14pt; }
    .tf-label { text-align:right; color:#64748b; font-size:9.5pt; }
    .tf-label-w { color:#aaa; font-size:9pt; }

    /* Pied de page */
    .inv-footer { margin-top:28px; padding-top:14px; border-top:1px solid #e2e8f0;
                  font-size:8.5pt; color:#94a3b8; line-height:1.8; }

    @media print {
      body { padding:12mm 10mm; font-size:10pt; }
      .no-print { display:none !important; }
      tr { break-inside:avoid; }
    }
  </style>
</head>
<body>

<div class="no-print">
  <span>📋 Facture${invNum?' #'+invNum:''} — ${Utils.escapeHtml(ourName)} — ${monthName}</span>
  <button onclick="window.print()">🖨 Imprimer / Sauvegarder PDF</button>
</div>

<div class="inv-header">
  <div class="inv-from">
    <div class="company-name">${Utils.escapeHtml(ourName)}</div>
    <div class="company-info">${ourLines.join('<br>')}</div>
  </div>
  <div class="inv-meta">
    <div class="inv-word">FACTURE</div>
    ${invNum ? `<div class="inv-num">N° de facture : ${invNum}</div>` : ''}
    <div class="inv-dates">
      Date : <strong>${invDateFr}</strong><br>
      ${ref ? `Réf client : <strong>${ref}</strong><br>` : ''}
      Délai : ${delay || '45 jours'} après réception
    </div>
  </div>
</div>

<div class="inv-parties">
  <div class="party">
    <div class="party-tag">De</div>
    <div class="party-name">${Utils.escapeHtml(ourName)}</div>
    <div class="party-info">${ourAddr ? Utils.escapeHtml(ourAddr)+'<br>' : ''}${siret ? 'SIRET : '+siret : ''}</div>
  </div>
  <div class="party">
    <div class="party-tag">Facturer à</div>
    <div class="party-name">${Utils.escapeHtml(provName)}</div>
    <div class="party-info">${provAddr ? Utils.escapeHtml(provAddr)+'<br>' : ''}${provContact ? Utils.escapeHtml(provContact) : ''}</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th class="col-date">Date</th>
      <th class="col-qty r">Qté (h)</th>
      <th class="col-desc">Description</th>
      <th class="col-pu r">P.U. HT</th>
      <th class="col-tot r">Total HT</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr class="tf-sep">
      <td colspan="3" class="tf-tva">Total : ${Utils.formatDuration(totalH)} heures</td>
      <td class="tf-label">Sous-total HT</td>
      <td class="col-tot">${Utils.formatMoney(totalHT)}</td>
    </tr>
    <tr>
      <td colspan="3"></td>
      <td class="tf-label">Exonération TVA</td>
      <td class="col-tot" style="color:#94a3b8">—</td>
    </tr>
    <tr class="tf-ttc">
      <td colspan="3"></td>
      <td class="tf-label-w">TOTAL TTC À PAYER</td>
      <td class="col-tot">${Utils.formatMoney(totalHT)}</td>
    </tr>
  </tfoot>
</table>

${(iban || codebanque) ? `<div class="inv-footer">
  <strong>Coordonnées bancaires :</strong><br>
  ${iban ? 'IBAN : '+iban+'<br>' : ''}
  ${(codebanque||clerib||numcompte) ? `CODE BANQUE : ${codebanque}&nbsp;&nbsp;—&nbsp;&nbsp;CLÉ RIB : ${clerib}&nbsp;&nbsp;—&nbsp;&nbsp;N° COMPTE : ${numcompte}<br>` : ''}
  ${bic ? 'BIC : '+bic+'<br>' : ''}
  ${bankname ? bankname+'<br>' : ''}
  <br>
  TVA non applicable — article 293 B du CGI &nbsp;|&nbsp; Délais de paiement : ${delay||'45 jours'} après réception
</div>` : `<div class="inv-footer">
  TVA non applicable — article 293 B du CGI &nbsp;|&nbsp; Délais de paiement : ${delay||'45 jours'} après réception
</div>`}

</body>
</html>`;

  Modals.close();
  const w = window.open('', '_blank', 'width=900,height=750');
  w.document.write(html);
  w.document.close();
};
