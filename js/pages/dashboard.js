// dashboard.js v5
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
  const allM = Data.getMissions().filter(m =>
    (m.status === 'done' || m.status === 'planned') && m.date && m.date.startsWith(ym) && m.missionType !== 'personal');

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

  // providerRate = tarif individuel PAR intervenant
  const _nProv      = m => (m.providerIds?.length ? m.providerIds.length : (m.providerId ? 1 : 0));
  const charges     = donePole.reduce((s,m) => s+(m.duration||0)*(m.providerRate||0)*_nProv(m), 0);
  const chargesPlan = planPole.reduce((s,m) => s+(m.duration||0)*(m.providerRate||0)*_nProv(m), 0);

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

  // ── Aperçu écoles — année scolaire (1 sept → 31 août) ────────
  const compEl = document.getElementById('companies-overview');
  if (compEl) {
    // Calcul de l'année scolaire courante
    const _now     = new Date();
    const _today   = Utils.today();
    const _yr      = _now.getMonth() >= 8 ? _now.getFullYear() : _now.getFullYear() - 1;
    const _yearStart = `${_yr}-09-01`;           // 1er septembre
    const _yearEnd   = `${_yr+1}-08-31`;         // 31 août suivant

    const allMissions = Data.getMissions().filter(m =>
      (m.status === 'done' || m.status === 'planned') && m.missionType !== 'personal');

    const entries = Object.values(d.byCompany).filter(({company:co}) => co.role !== 'own');
    const filtered = _dashPole ? entries.filter(({company:co}) => {
      if (co.poleId) return co.poleId === _dashPole;
      return false;
    }) : entries;

    compEl.innerHTML = filtered.map(({company:co}) => {
      const lightBg = Utils.lightenColor(co.color, 0.88);

      // Missions de cette école sur l'année scolaire
      const yearMs = allMissions.filter(m =>
        m.companyId === co.id && m.date >= _yearStart && m.date <= _yearEnd
      );
      // Faites = status 'done' OU date strictement passée (même règle que les stats financières)
      const doneMs  = yearMs.filter(m => m.status === 'done' || (m.status === 'planned' && m.date < _today));
      const restMs  = yearMs.filter(m => m.status === 'planned' && m.date >= _today);

      const hTotal  = yearMs.reduce((s,m) => s+(m.duration||0), 0);
      const hDone   = doneMs.reduce((s,m) => s+(m.duration||0), 0);
      const hRest   = restMs.reduce((s,m) => s+(m.duration||0), 0);

      // Barre de progression
      const pct   = hTotal > 0 ? Math.round(hDone / hTotal * 100) : 0;
      const barCol = pct === 100 ? '#22c55e' : pct > 50 ? co.color : '#f59e0b';

      return `<div class="company-mini-card" style="background:${lightBg};border:1px solid ${co.color}40" onclick="location.href='ecoles.html'">
        <div class="company-mini-name" style="color:${co.color}">${Utils.escapeHtml(co.name)}</div>
        <div class="company-mini-stats">
          <div class="company-mini-stat"><span>H prévues</span><strong style="color:${co.color}">${Utils.formatDuration(hTotal)}</strong></div>
          <div class="company-mini-stat"><span>H faites</span><strong style="color:#22c55e">${Utils.formatDuration(hDone)}</strong></div>
          <div class="company-mini-stat"><span>H restantes</span><strong style="color:#f59e0b">${Utils.formatDuration(hRest)}</strong></div>
        </div>
        ${hTotal > 0 ? `<div style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-bottom:2px">
            <span>${pct}% réalisé</span><span>Année scolaire ${_yr}/${_yr+1}</span>
          </div>
          <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barCol};border-radius:3px;transition:width .3s"></div>
          </div>
        </div>` : ''}
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
    const _allMsForm = Data.getMissions();
    formEl.innerHTML = d.activeFormations.length > 0
      ? d.activeFormations.map(f => {
          const co = Data.getCompanyById(f.companyId);
          // Heures réalisées calculées depuis les missions (le champ stocké completedHours peut être périmé)
          const realH = Math.round(_allMsForm
            .filter(m => m.formationId === f.id && m.status === 'done')
            .reduce((s,m) => s+(m.duration||0), 0) * 100) / 100;
          const pct = f.totalHours > 0 ? Math.round(realH/f.totalHours*100) : 0;
          const color = co ? co.color : '#3b82f6';
          return `<div class="course-row-compact" onclick="location.href='formations.html'" style="cursor:pointer">
            <span class="course-dot" style="background:${color}"></span>
            <span class="course-compact-title">${Utils.escapeHtml(f.name)}</span>
            <span class="course-compact-date">${realH}h / ${f.totalHours}h (${pct}%)</span>
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
  if (!months.length) { Utils.toast('Aucune mission trouvée.', 'success'); return; }

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const monthLabel = m => { const [y,mo] = m.split('-'); return `${MONTHS_FR[+mo-1]} ${y}`; };
  const currentM  = Utils.currentYearMonth();
  const providers = Data.getProviders().slice().sort((a,b) => ((a.lastName||'')+(a.firstName||'')).localeCompare((b.lastName||'')+(b.firstName||'')));

  Modals._open(`
    <div class="modal-header">
      <h3>📄 Exporter un planning</h3>
      <button class="modal-close" onclick="Modals.close()">✕</button>
    </div>
    <div class="modal-body modal-body-scroll" style="padding:24px;display:flex;flex-direction:column;gap:16px">
      <p style="color:var(--text-muted);font-size:0.88rem;margin:0">
        Génère un document imprimable pour un mois, une plage de dates, ou la totalité de l'emploi du temps.
      </p>

      <div class="form-group">
        <label style="margin-bottom:8px;display:block">Période</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" id="plan-mode-all"   onclick="window._setPlanMode('all')">📋 Tout</button>
          <button class="btn btn-sm btn-ghost"   id="plan-mode-range" onclick="window._setPlanMode('range')">📅 Plage</button>
          <button class="btn btn-sm btn-ghost"   id="plan-mode-month" onclick="window._setPlanMode('month')">🗓 Mois unique</button>
        </div>
      </div>

      <div id="plan-range-row" style="display:none;gap:12px" class="form-grid">
        <div class="form-group form-col-2">
          <label>De</label>
          <select id="planning-from-sel" class="form-input">
            ${months.slice().reverse().map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-col-2">
          <label>À</label>
          <select id="planning-to-sel" class="form-input">
            ${months.map(m => `<option value="${m}" ${m===currentM?'selected':''}>${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="plan-month-row" style="display:none" class="form-group">
        <label>Mois</label>
        <select id="planning-month-sel" class="form-input">
          ${months.map(m => `<option value="${m}" ${m===currentM?'selected':''}>${monthLabel(m)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>Pôle (optionnel)</label>
        <select id="planning-pole-sel" class="form-input">
          <option value="">Tous les pôles</option>
          ${Data.getOwnCompanies().map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <div class="form-grid">
        <div class="form-group form-col-2">
          <label>École / société (optionnel)</label>
          <select id="planning-school-sel" class="form-input">
            <option value="">Toutes les écoles</option>
            ${Data.getClientSchools().slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(c =>
              `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-col-2">
          <label>Matière (optionnel)</label>
          <select id="planning-subject-sel" class="form-input">
            <option value="">Toutes les matières</option>
            ${(() => {
              const subj = (Data.getSubjects()||[]).slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','fr'));
              const eco  = subj.filter(s => s.category !== 'particuliers');
              const part = subj.filter(s => s.category === 'particuliers');
              const opt  = s => `<option value="${s.id}">${Utils.escapeHtml((s.name||'').toUpperCase())}</option>`;
              return (eco.length  ? `<optgroup label="🏫 Cours écoles">${eco.map(opt).join('')}</optgroup>`  : '')
                   + (part.length ? `<optgroup label="👤 Cours particuliers">${part.map(opt).join('')}</optgroup>` : '');
            })()}
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

      <div class="form-group" style="margin:0;display:flex;flex-direction:column;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal">
          <input type="checkbox" id="planning-cancelled" style="width:auto">
          Inclure les missions annulées
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal">
          <input type="checkbox" id="planning-show-amounts" checked style="width:auto">
          Afficher les montants
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      <button class="btn btn-primary" onclick="window._generatePlanning()">🖨 Générer & Imprimer</button>
    </div>
  `);
  // Initialiser le mode par défaut après ouverture
  setTimeout(() => window._setPlanMode('all'), 0);
};

window._setPlanMode = function(mode) {
  ['all','range','month'].forEach(m => {
    const btn = document.getElementById('plan-mode-'+m);
    if (btn) { btn.className = 'btn btn-sm ' + (m === mode ? 'btn-primary' : 'btn-ghost'); }
  });
  const rangeRow = document.getElementById('plan-range-row');
  const monthRow = document.getElementById('plan-month-row');
  if (rangeRow) rangeRow.style.display = mode === 'range' ? 'flex' : 'none';
  if (monthRow) monthRow.style.display = mode === 'month' ? 'block' : 'none';
  if (document.getElementById('planning-mode')) document.getElementById('planning-mode').value = mode;
  else {
    const inp = document.createElement('input');
    inp.type = 'hidden'; inp.id = 'planning-mode'; inp.value = mode;
    document.querySelector('.modal-body')?.appendChild(inp);
  }
};

window._generatePlanning = function() {
  const mode          = document.getElementById('planning-mode')?.value || 'all';
  const isAll         = mode === 'all';
  const isRange       = mode === 'range';
  const monthFrom     = isRange ? (document.getElementById('planning-from-sel')?.value || '') : (document.getElementById('planning-month-sel')?.value || '');
  const monthTo       = isRange ? (document.getElementById('planning-to-sel')?.value   || '') : monthFrom;
  const poleId        = document.getElementById('planning-pole-sel')?.value || '';
  const schoolId      = document.getElementById('planning-school-sel')?.value || '';
  const subjectId     = document.getElementById('planning-subject-sel')?.value || '';
  const inclCancelled = document.getElementById('planning-cancelled')?.checked || false;
  const showAmounts   = document.getElementById('planning-show-amounts')?.checked !== false;

  const checkedProvs = [...document.querySelectorAll('.planning-prov-chk:checked')].map(c => c.value);
  const allChecked   = document.getElementById('planning-prov-all')?.checked;
  const provFilter   = allChecked ? null : new Set(checkedProvs);

  Modals.close();
  if (!isAll && !monthFrom) return;

  const MONTHS_FR  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR    = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const monthLabel = m => { const [y,mo] = m.split('-'); return `${MONTHS_FR[+mo-1]} ${y}`; };

  // Libellé de la période pour le titre
  const mTo     = (isRange && monthTo && monthTo >= monthFrom) ? monthTo : monthFrom;
  const monthName = isAll    ? 'Emploi du temps complet'
                  : isRange  ? `${monthLabel(monthFrom)} → ${monthLabel(mTo)}`
                  :             monthLabel(monthFrom);

  const coMap   = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const provMap = {}; Data.getProviders().forEach(p => provMap[p.id] = p);
  const ownCos  = Data.getOwnCompanies();

  let missions = Data.getMissions().filter(m => {
    if (!m.date) return false;
    if (isAll)   return true;
    const ym = m.date.substring(0,7);
    if (isRange) return ym >= monthFrom && ym <= mTo;
    return m.date.startsWith(monthFrom);
  });
  if (!inclCancelled) missions = missions.filter(m => m.status !== 'cancelled');
  if (poleId) missions = missions.filter(m => {
    const co = coMap[m.companyId]; if (!co) return false;
    return co.role === 'own' ? co.id === poleId : co.poleId === poleId;
  });
  if (schoolId)  missions = missions.filter(m => m.companyId === schoolId);
  if (subjectId) missions = missions.filter(m => m.subjectId === subjectId);
  if (provFilter !== null) {
    missions = missions.filter(m => {
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      return pids.some(pid => provFilter.has(pid));
    });
  }
  missions.sort((a, b) => (a.date + (a.startTime||'')).localeCompare(b.date + (b.startTime||'')));

  if (!missions.length) { Utils.toast('Aucune mission trouvée pour ces critères.', 'success'); return; }

  const settings  = Data.getSettings();
  const respName  = settings.responsableName || ownCos.map(c=>c.name).join(' & ');
  const poleLabel = poleId ? (coMap[poleId]?.name||'') : ownCos.map(c=>c.name).join(' & ');
  const schoolName  = schoolId  ? (coMap[schoolId]?.name || '') : '';
  const subjectName = subjectId ? ((Data.getSubjects()||[]).find(s => s.id === subjectId)?.name || '') : '';
  const filterLabel = [schoolName, subjectName].filter(Boolean).join(' · ');

  const statusBadge = s => s==='done' ? '✓' : s==='cancelled' ? '✗' : '';
  const statusColor = s => s==='done' ? '#22c55e' : s==='cancelled' ? '#ef4444' : '#3b82f6';

  // Générer les lignes d'une liste de missions groupées par date
  function buildDayRows(ms) {
    const byDate = {};
    ms.forEach(m => { if (!byDate[m.date]) byDate[m.date] = []; byDate[m.date].push(m); });
    return Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date, dayMs]) => {
      const d      = new Date(date + 'T00:00:00');
      const dayH   = dayMs.reduce((s,m)=>s+(m.duration||0),0);
      const dayAmt = dayMs.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
      const missionLines = dayMs.map(m => {
        const co   = coMap[m.companyId];
        const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
        const provNames = pids.map(pid => { const p=provMap[pid]; return p?p.lastName+' '+p.firstName:''; }).filter(Boolean).join(', ');
        const time = m.startTime && m.endTime
          ? `De ${m.startTime.replace(':','h')} à ${m.endTime.replace(':','h')}`
          : (m.startTime ? `À ${m.startTime.replace(':','h')}` : '—');
        const badge       = statusBadge(m.status);
        const bColor      = statusColor(m.status);
        const isCancelled = m.status === 'cancelled';
        const lineAmt     = (m.duration||0) * (m.billingRate||0);
        return `<tr class="${isCancelled?'cancelled':''}">
          <td class="td-time">${time}</td>
          <td class="td-dot"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${co?co.color:'#94a3b8'};flex-shrink:0"></span></td>
          <td class="td-title">
            <span class="mission-title">${badge?`<span style="color:${bColor};font-weight:700;margin-right:4px">${badge}</span>`:''}${Utils.escapeHtml(m.title)}</span>
            ${co?`<span class="mission-school">${Utils.escapeHtml(co.name)}</span>`:''}
            ${m.location?`<span class="mission-loc">📍 ${Utils.escapeHtml(m.location)}</span>`:''}
            ${provNames?`<span class="mission-prov">👤 ${Utils.escapeHtml(provNames)}</span>`:''}
          </td>
          <td class="td-duration">${Utils.formatDuration(m.duration)}${showAmounts?`<br><span style="font-size:7.5pt;color:#94a3b8;font-weight:400">${m.billingRate||0}€/h</span>`:''}</td>
          ${showAmounts ? `<td class="td-amount">${Utils.formatMoney(lineAmt)}</td>` : ''}
        </tr>`;
      }).join('');
      return `<tbody class="day-group">
        <tr class="day-header">
          <td colspan="${showAmounts?4:5}">
            <span class="day-num">${d.getDate()}</span>
            <span class="day-name">${DAYS_FR[d.getDay()].toUpperCase()}</span>
            <span class="day-total">${Utils.formatDuration(dayH)}</span>
          </td>
          ${showAmounts ? `<td style="background:#f8fafc;padding:7px 10px;border-top:2px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-align:right;font-size:9pt;font-weight:700;color:#475569;white-space:nowrap">${Utils.formatMoney(dayAmt)}</td>` : ''}
        </tr>
        ${missionLines}
      </tbody>`;
    }).join('');
  }

  // En mode "toutes périodes" : une section par mois avec sous-total + récap
  function buildAllMonthsSections() {
    const msByMonth = {};
    missions.forEach(m => {
      const ym = m.date.substring(0,7);
      if (!msByMonth[ym]) msByMonth[ym] = [];
      msByMonth[ym].push(m);
    });
    return Object.entries(msByMonth).sort(([a],[b])=>a.localeCompare(b)).map(([ym, ms]) => {
      const mH   = ms.reduce((s,m)=>s+(m.duration||0),0);
      const mRev = ms.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
      return `
        <tr class="month-separator">
          <td colspan="5">
            <span class="month-sep-name">${monthLabel(ym)}</span>
            <span class="month-sep-stats">${Utils.formatDuration(mH)}${showAmounts ? ` — ${Utils.formatMoney(mRev)}` : ''}</span>
          </td>
        </tr>
        ${buildDayRows(ms)}
        <tbody><tr class="month-subtotal">
          <td colspan="${showAmounts?3:4}" style="text-align:right;padding:8px 10px;font-size:8.5pt;color:#64748b;font-style:italic">Sous-total ${monthLabel(ym)}</td>
          <td style="padding:8px 6px;text-align:right;font-size:9pt;font-weight:700;color:#475569">${Utils.formatDuration(mH)}</td>
          ${showAmounts ? `<td style="padding:8px 10px;text-align:right;font-size:9pt;font-weight:700;color:#1e293b">${Utils.formatMoney(mRev)}</td>` : ''}
        </tr></tbody>`;
    }).join('');
  }

  const tableContent = (isAll || isRange) ? buildAllMonthsSections() : buildDayRows(missions);

  const totalH    = missions.reduce((s,m) => s+(m.duration||0), 0);
  const totalRev  = missions.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);
  const doneCount = missions.filter(m => m.status==='done').length;
  const planCount = missions.filter(m => m.status==='planned').length;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${monthName} — ${poleLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; background: #fff; padding: 18mm 16mm; }

    .doc-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e293b; padding-bottom: 10px; margin-bottom: 18px; }
    .doc-title   { font-size: 20pt; font-weight: 800; letter-spacing: -0.5px; }
    .doc-month   { font-size: 13pt; font-weight: 600; color: #3b82f6; }
    .doc-meta    { text-align: right; font-size: 9pt; color: #64748b; line-height: 1.6; }

    table { width: 100%; border-collapse: collapse; }

    /* Séparateur de mois (mode complet) */
    .month-separator td { background: #1e293b; color: #fff; padding: 10px 14px; }
    .month-sep-name  { font-size: 12pt; font-weight: 800; letter-spacing: 0.02em; }
    .month-sep-stats { float: right; font-size: 9pt; font-weight: 400; opacity: 0.75; margin-top: 3px; }
    .month-subtotal td { background: #f1f5f9; border-top: 2px solid #cbd5e1; }

    .day-header td { background: #f8fafc; padding: 8px 10px; border-top: 2px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
    .day-num  { font-size: 16pt; font-weight: 800; color: #1e293b; margin-right: 8px; }
    .day-name { font-size: 9pt; font-weight: 700; color: #64748b; letter-spacing: 0.08em; }
    .day-total{ float: right; font-size: 9pt; font-weight: 600; color: #64748b; background: #e2e8f0; border-radius: 10px; padding: 1px 8px; margin-top: 4px; }

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

    .doc-footer { margin-top: 24px; padding-top: 14px; border-top: 2px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .footer-kpi { text-align: center; background: #f8fafc; border-radius: 8px; padding: 10px; }
    .footer-kpi .val { font-size: 15pt; font-weight: 800; color: #1e293b; }
    .footer-kpi .lbl { font-size: 8pt; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
    .footer-sign { margin-top: 20px; font-size: 9pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }

    @media print {
      body { padding: 12mm 10mm; }
      .no-print { display: none !important; }
      .day-group { break-inside: avoid; }
      .month-separator { break-before: page; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="background:#3b82f6;color:#fff;padding:10px 18px;border-radius:8px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
    <span>📄 <strong>${monthName}</strong>${poleId?' — '+poleLabel:''}${filterLabel?' — '+filterLabel:''} — Prêt à imprimer</span>
    <button onclick="window.print()" style="background:#fff;color:#3b82f6;border:none;border-radius:6px;padding:6px 16px;font-weight:700;cursor:pointer;font-size:0.9rem">🖨 Imprimer / Sauvegarder PDF</button>
  </div>

  <div class="doc-header">
    <div>
      <div class="doc-title">${isAll ? 'Emploi du temps' : isRange ? 'Planning' : 'Planning mensuel'}</div>
      <div class="doc-month">${monthName}${poleId ? ' — '+poleLabel : ''}${filterLabel ? ' — '+filterLabel : ''}</div>
    </div>
    <div class="doc-meta">
      ${respName}<br>
      ${poleLabel}<br>
      Généré le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
    </div>
  </div>

  <table>
    ${tableContent}
  </table>

  <div class="doc-footer">
    <div class="footer-kpi"><div class="val">${planCount}</div><div class="lbl">Missions prévues</div></div>
    <div class="footer-kpi"><div class="val">${Utils.formatDuration(totalH)}</div><div class="lbl">Heures totales</div></div>
    ${showAmounts ? `<div class="footer-kpi"><div class="val">${Utils.formatMoney(totalRev)}</div><div class="lbl">CA total</div></div>` : ''}
  </div>

  <div class="footer-sign">${respName === poleLabel ? respName : respName+' — '+poleLabel} — ${monthName}</div>

</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { Utils.toast('Autorisez les pop-ups pour ce site.', 'error'); return; }
  w.document.write(html);
  w.document.close();
};

// ══════════════════════════════════════════════════════════════════
// GÉNÉRATION DE FACTURE
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// ── MODULE FACTURE — réécrit proprement ───────────────────────────
// ══════════════════════════════════════════════════════════════════

const _INV_MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const _INV_MONTHS_SH = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
const _invMonthLabel = m => { const [y,mo] = m.split('-'); return _INV_MONTHS_FR[+mo-1]+' '+y; };

// ── 1. Filtrage des missions (YYYY-MM range) ──────────────────────
window._getInvMissions = function(monthFrom, monthTo, destRaw) {
  if (arguments.length === 2) { destRaw = monthTo; monthTo = monthFrom; } // rétrocompat
  if (!monthFrom || !destRaw) return [];
  if (!monthTo || monthTo < monthFrom) monthTo = monthFrom;

  const sep    = '::';
  const si     = destRaw.indexOf(sep);
  if (si < 0) return [];
  const dtype  = destRaw.substring(0, si);
  const did    = destRaw.substring(si + sep.length);

  // Plage YYYY-MM — fonctionne aussi avec YYYY-MM-DD (préfixe)
  const inRange = m => {
    const ym = (m.date||'').substring(0, monthFrom.length);
    return ym >= monthFrom && ym <= monthTo;
  };

  // Statuts non facturables : annulé, reporté, déplacé (= travail non effectué à cette date)
  const billable = m => !['cancelled','postponed','moved'].includes(m.status) && m.missionType !== 'personal';

  let missions = [];
  if (dtype === 'co') {
    missions = Data.getMissions().filter(m =>
      billable(m) && inRange(m) && m.companyId === did);
  } else {
    const p = Data.getProviders().find(p => p.id === did);
    const pname = p ? ([p.firstName, p.lastName].filter(Boolean).join(' ') || p.structure || '') : '';
    if (!pname) return [];
    const kws = n => new Set((n||'').toLowerCase().replace(/[^a-z0-9]/g,' ').split(/\s+/).filter(w=>w.length>=4));
    const sk = kws(pname); const ids = new Set([did]);
    Data.getProviders().forEach(pr => { const n=[pr.firstName,pr.lastName].filter(Boolean).join(' ')||pr.structure||''; if([...kws(n)].some(w=>sk.has(w))) ids.add(pr.id); });
    missions = Data.getMissions().filter(m => {
      if (!billable(m) || !inRange(m)) return false;
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      return pids.some(pid => ids.has(pid));
    });
  }
  missions.sort((a,b) => (a.date+(a.startTime||'')).localeCompare(b.date+(b.startTime||'')));
  return missions;
};

// ── 2. Construire les options du select "Facturer à" ──────────────
function _buildDestSelect(from, to, selected) {
  const allM = Data.getMissions().filter(m => {
    if (m.status === 'cancelled') return false;
    const ym = (m.date||'').substring(0,7);
    return ym >= from && ym <= to;
  });
  const cntP = {}, cntC = {};
  allM.forEach(m => {
    (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).forEach(pid => { cntP[pid]=(cntP[pid]||0)+1; });
    if (m.companyId) cntC[m.companyId]=(cntC[m.companyId]||0)+1;
  });
  const opt = (val, lbl, n) => '<option value="'+val+'"'+(val===selected?' selected':'')+'>'+Utils.escapeHtml(lbl)+(n?' ('+n+' mission'+(n>1?'s':'')+')':'')+'</option>';
  const provs = Data.getProviders().slice().sort((a,b)=>((a.lastName||'')+(a.firstName||'')).localeCompare((b.lastName||'')+(b.firstName||'')));
  const cos   = Data.getCompanies().filter(c=>c.role!=='own').sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const pOpts = provs.map(p=>{ const fn=[p.firstName,p.lastName].filter(Boolean).join(' '); const hs=p.structure&&p.structure!==fn&&p.structure!==p.lastName; return opt('prov::'+p.id, fn?(fn+(hs?' — '+p.structure:'')):(p.structure||'Inconnu'), cntP[p.id]||0); }).join('');
  const cOpts = cos.map(c=>opt('co::'+c.id, c.name, cntC[c.id]||0)).join('');
  return (pOpts?'<optgroup label="Agences / Prestataires">'+pOpts+'</optgroup>':'')+
         (cOpts?'<optgroup label="Sociétés clientes">'+cOpts+'</optgroup>':'');
}

// ── 3. Mise à jour de l'aperçu ────────────────────────────────────
window._updateInvPreview = function() {
  const box  = document.getElementById('inv-preview'); if (!box) return;
  const fromRaw = document.getElementById('inv-from')?.value || '';
  const toRaw   = document.getElementById('inv-to')?.value   || fromRaw;
  const dest    = document.getElementById('inv-dest')?.value || '';
  if (!fromRaw || !dest) { box.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem">Sélectionnez un destinataire…</p>'; return; }
  // _getInvMissions accepte YYYY-MM-DD (isFullDate=true → comparaison directe)
  const ms = window._getInvMissions(fromRaw, toRaw < fromRaw ? fromRaw : toRaw, dest);
  if (!ms.length) { box.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem">Aucune mission pour cette période.</p>'; return; }
  const totalH  = ms.reduce((s,m)=>s+(m.duration||0),0);
  const totalHT = ms.reduce((s,m)=>s+(m.duration||0)*(m.billingRate||0),0);
  const cos = {}; Data.getCompanies().forEach(c=>cos[c.id]=c);
  const rows = ms.map(m=>{ const co=cos[m.companyId]; return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span>'+Utils.escapeHtml(m.date)+' — '+Utils.escapeHtml(m.title||'')+(co?' <span style="color:var(--text-muted)">'+Utils.escapeHtml(co.name)+'</span>':'')+'</span><span style="font-weight:600">'+Utils.formatMoney((m.duration||0)*(m.billingRate||0))+'</span></div>'; }).join('');
  box.innerHTML='<div style="font-size:0.8rem;font-weight:700;color:var(--primary);margin-bottom:6px">'+ms.length+' mission'+(ms.length>1?'s':'')+' · '+Utils.formatDuration(totalH)+' · '+Utils.formatMoney(totalHT)+'</div>'+rows;
};

// ── 4. Mise à jour du select destination quand la période change ──
// Lit les dates YYYY-MM-DD des inputs, convertit en YYYY-MM pour le filtre
window._updateInvDest = function() {
  const fromFull = document.getElementById('inv-from')?.value; if (!fromFull) return;
  const toFull   = document.getElementById('inv-to')?.value   || fromFull;
  // Normaliser : accepte YYYY-MM ou YYYY-MM-DD
  const norm = s => s.length >= 7 ? s.substring(0,7) : s;
  const from = norm(fromFull), to = norm(toFull < fromFull ? fromFull : toFull);
  const sel  = document.getElementById('inv-dest'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = _buildDestSelect(from, to, prev);
  window._updateInvPreview();
};

// ── 5. Raccourcis période ─────────────────────────────────────────
window._invSetPeriod = function(type, offset) {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmtDate = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  let from, to;
  if (type === 'month') {
    const d  = new Date(now.getFullYear(), now.getMonth()+(offset||0), 1);
    const d2 = new Date(d.getFullYear(), d.getMonth()+1, 0); // dernier jour du mois
    from = fmtDate(d); to = fmtDate(d2);
  } else if (type === 'months3') {
    from = fmtDate(new Date(now.getFullYear(), now.getMonth()-2, 1));
    to   = fmtDate(new Date(now.getFullYear(), now.getMonth()+1, 0));
  } else if (type === 'year') {
    from = now.getFullYear()+'-01-01';
    to   = now.getFullYear()+'-12-31';
  }
  const fEl=document.getElementById('inv-from'), tEl=document.getElementById('inv-to');
  if (fEl && from) fEl.value=from;
  if (tEl && to)   tEl.value=to;
  window._updateInvDest();
};

// ── 6. Ouvrir le modal ────────────────────────────────────────────
window._showInvoiceExport = function() {
  const allMissions = Data.getMissions().filter(m => m.status !== 'cancelled');
  const months = [...new Set(allMissions.map(m=>(m.date||'').substring(0,7)).filter(Boolean))].sort().reverse();
  if (!months.length) { Utils.toast('Aucune mission trouvée.', 'success'); return; }

  const ownCos   = Data.getOwnCompanies();
  const settings = Data.getSettings();
  const defaultDelay = settings.invoicePaymentDelay || '45 jours';

  const currentM    = Utils.currentYearMonth();
  const pad = n => String(n).padStart(2,'0');
  // Dates par défaut : 1er du mois courant → aujourd'hui
  const now2 = new Date();
  const defaultDateFrom = currentM + '-01';
  const defaultDateTo   = Utils.today();

  const defaultEmId = (_dashPole && ownCos.find(c=>c.id===_dashPole)) ? _dashPole : (ownCos[0]?.id||'');
  const emOpts = ownCos.map(c=>'<option value="'+c.id+'"'+(c.id===defaultEmId?' selected':'')+'>'+Utils.escapeHtml(c.name)+'</option>').join('');
  const delayOpts = ['30 jours','45 jours','60 jours','À réception'].map(d=>'<option value="'+d+'"'+(d===defaultDelay?' selected':'')+'>'+d+'</option>').join('');
  const destOpts  = _buildDestSelect(defaultDateFrom.substring(0,7), defaultDateTo.substring(0,7), '');
  const warn = (!settings.siret&&!settings.iban) ? '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;font-size:0.85rem;color:#92400e">⚠️ SIRET / IBAN non configurés — <a href="parametres.html" style="color:#92400e;font-weight:700">Paramètres →</a></div>' : '';

  Modals._open(
    '<div class="modal-header"><h3>📋 Préparer une facture</h3><button class="modal-close" onclick="Modals.close()">✕</button></div>'+
    '<div class="modal-body modal-body-scroll" style="padding:20px;display:flex;flex-direction:column;gap:14px">'+
      warn+
      '<div class="form-grid">'+
        '<div class="form-group form-col-2"><label>Société émettrice</label><select id="inv-emetteur" class="form-input">'+emOpts+'</select></div>'+
        '<div class="form-group form-col-2" style="display:flex;flex-direction:column;justify-content:flex-end">'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">'+
            '<button type="button" class="btn btn-ghost btn-sm" onclick="window._invSetPeriod(\'month\',0)">Ce mois</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" onclick="window._invSetPeriod(\'month\',-1)">Mois préc.</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" onclick="window._invSetPeriod(\'months3\')">3 mois</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" onclick="window._invSetPeriod(\'year\')">Année</button>'+
          '</div>'+
        '</div>'+
        '<div class="form-group form-col-2"><label>Du</label>'+
          '<input type="date" id="inv-from" class="form-input" value="'+defaultDateFrom+'" onchange="window._updateInvDest()"></div>'+
        '<div class="form-group form-col-2"><label>Au</label>'+
          '<input type="date" id="inv-to" class="form-input" value="'+defaultDateTo+'" onchange="window._updateInvDest()"></div>'+
      '</div>'+
      '<button type="button" class="btn btn-primary" style="width:100%;margin-top:-8px" onclick="window._updateInvDest()">🔍 Afficher les missions de cette période</button>'+
      '<div class="form-group" style="margin:0"><label>Facturer à</label><select id="inv-dest" class="form-input" onchange="window._updateInvPreview()">'+destOpts+'</select></div>'+
      '<div><div style="font-size:0.8rem;font-weight:600;color:var(--text-muted);margin-bottom:6px">Missions incluses</div><div id="inv-preview" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:10px 14px;background:var(--bg)"><p style="color:var(--text-muted);font-size:0.85rem">Chargement…</p></div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
        '<div class="form-group" style="margin:0"><label>N° facture</label><input type="number" id="inv-num" class="form-input" placeholder="47" min="1"></div>'+
        '<div class="form-group" style="margin:0"><label>Date de facture</label><input type="date" id="inv-date" class="form-input" value="'+Utils.today()+'"></div>'+
        '<div class="form-group" style="margin:0"><label>Délai de paiement</label><select id="inv-delay" class="form-input">'+delayOpts+'</select></div>'+
      '</div>'+
      '<div class="form-group" style="margin:0"><label>Référence client <span style="color:var(--text-muted);font-size:0.8rem">(optionnel)</span></label><input type="text" id="inv-ref" class="form-input" placeholder="ex: EVOL0611052025"></div>'+
    '</div>'+
    '<div class="modal-footer"><button class="btn btn-ghost" onclick="Modals.close()">Annuler</button><button class="btn btn-primary" onclick="window._generateInvoice()">📋 Générer la facture</button></div>'
  );
  setTimeout(() => window._updateInvPreview(), 100);
};

// ── 7. Générer la facture ─────────────────────────────────────────
window._generateInvoice = function() {
  const emetteurId = document.getElementById('inv-emetteur')?.value || '';
  const dateFrom   = document.getElementById('inv-from')?.value || '';
  const dateTo     = document.getElementById('inv-to')?.value   || dateFrom;
  const destRaw    = document.getElementById('inv-dest')?.value || '';
  const invNum     = document.getElementById('inv-num')?.value?.trim() || '';
  const invDate    = document.getElementById('inv-date')?.value || Utils.today();
  const delay      = document.getElementById('inv-delay')?.value || '45 jours';
  const ref        = document.getElementById('inv-ref')?.value?.trim() || '';

  if (!dateFrom || !destRaw) { Utils.toast('Sélectionnez une période et un destinataire.', 'error'); return; }

  const sep = '::'; const si = destRaw.indexOf(sep);
  const destType = destRaw.substring(0, si);
  const destId   = destRaw.substring(si + sep.length);

  // Label période : si même mois → "Juin 2026", sinon "01/04 – 30/06/2026"
  const df = new Date(dateFrom+'T00:00:00'), dt = new Date(dateTo+'T00:00:00');
  const sameMonth = dateFrom.substring(0,7) === dateTo.substring(0,7);
  const [y, mo] = dateFrom.split('-');
  const fmtFr = d => String(d.getDate()).padStart(2,'0')+'/'+(d.getMonth()+1 < 10?'0':'')+(d.getMonth()+1);
  const monthName = sameMonth
    ? _INV_MONTHS_FR[+mo-1]+' '+y
    : fmtFr(df)+' – '+fmtFr(dt)+'/'+dt.getFullYear();

  const [iy,im,id2] = invDate.split('-');
  const invDateFr   = id2+'/'+im+'/'+iy;

  const coMap = {}; Data.getCompanies().forEach(c => coMap[c.id] = c);
  const em = window._resolveInvoiceEmitter(emetteurId);   // nom, adresse, SIRET, banque

  let destName='', destAddr='', destContact='', destSiret='';
  if (destType === 'prov') {
    const p = Data.getProviders().find(p => p.id === destId);
    if (p) { const fn=[p.firstName,p.lastName].filter(Boolean).join(' '); destName=fn||p.structure||'Inconnu'; destAddr=p.address||''; destContact=[p.email,p.phone].filter(Boolean).join(' — '); destSiret=p.siret||''; }
  } else {
    const c = Data.getCompanies().find(c => c.id === destId);
    if (c) { destName=c.name; destAddr=c.address||''; destContact=[c.email,c.phone].filter(Boolean).join(' — '); destSiret=c.siret||''; }
  }
  if (!destName) { Utils.toast('Destinataire introuvable.', 'error'); return; }

  let missions = window._getInvMissions(dateFrom, dateTo, destRaw);
  if (!missions.length) { Utils.toast('Aucune mission pour ce destinataire sur cette période.', 'info'); return; }

  const totalH  = missions.reduce((s,m) => s+(m.duration||0), 0);
  const totalHT = missions.reduce((s,m) => s+(m.duration||0)*(m.billingRate||0), 0);

  const rows = missions.map(m => {
    const co    = coMap[m.companyId];
    const d     = new Date(m.date+'T00:00:00');
    const day   = isNaN(d.getTime())
      ? (m.date || '—')
      : String(d.getDate()).padStart(2,'0')+' '+_INV_MONTHS_SH[d.getMonth()];
    const title = m.title || '';
    const school= co?.name || '';
    const qty   = m.duration || 0;
    const pu    = m.billingRate || 0;
    const qtyStr= qty % 1 === 0 ? qty.toFixed(2).replace('.',',') : String(qty).replace('.',',');
    return '<tr><td class="col-date">'+day+'</td><td class="col-qty">'+qtyStr+'</td><td class="col-desc">'+Utils.escapeHtml(title)+(school?' <span class="school-name">— '+Utils.escapeHtml(school)+'</span>':'')+'</td><td class="col-pu">'+pu.toFixed(2).replace('.',',')+' €</td><td class="col-tot">'+Utils.formatMoney(qty*pu)+'</td></tr>';
  }).join('');

  window._buildInvoiceDocument({
    ...em,
    destName, destAddr, destContact, destSiret,
    invNum, invDateFr, ref, delay, monthName,
    qtyHeader: 'Qté (H)',
    rowsHTML: rows,
    extraFootRow: `<tr class="tf-sep"><td colspan="3"></td><td class="tf-label">Total heures effectuées</td><td class="col-tot">${Utils.formatDuration(totalH)}</td></tr>`,
    totalHT,
  });
};
