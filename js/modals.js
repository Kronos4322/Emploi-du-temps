// ============================================================
// modals.js — Gestion des modales : mission, société, prestataire,
//             étudiant, formation, lien prestataire-société
// ============================================================

const Modals = {

  // ── Infrastructure modale ────────────────────────────────────

  _open(html, onReady) {
    const existing = document.getElementById('modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    // I3 — stocker le handler pour pouvoir le retirer proprement à la fermeture
    if (this._escH) document.removeEventListener('keydown', this._escH);
    this._escH = e => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escH);
    if (onReady) onReady(overlay.querySelector('.modal-box'));
  },

  close() {
    const o = document.getElementById('modal-overlay');
    if (o) o.remove();
    // I3 — retirer le listener Escape pour éviter la fuite
    if (this._escH) { document.removeEventListener('keydown', this._escH); this._escH = null; }
  },

  // ── Confirmation ─────────────────────────────────────────────

  confirm(message, onConfirm, confirmLabel = 'Supprimer', danger = true) {
    this._open(`
      <div class="modal-header">
        <h3>Confirmation</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body">
        <p class="confirm-message">${Utils.escapeHtml(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-btn">${Utils.escapeHtml(confirmLabel)}</button>
      </div>
    `);
    document.getElementById('confirm-btn').addEventListener('click', () => { this.close(); onConfirm(); });
  },

  // ── Modale Mission ───────────────────────────────────────────

  openCourse(missionId = null, defaultDate = null, onDone = null) {
    return this.openMission(missionId, defaultDate, onDone);
  },

  openMission(missionId = null, defaultDate = null, onDone = null, defaults = {}) {
    const mission    = missionId ? Data.getMissionById(missionId) : null;
    const companies  = Data.getCompanies();
    const providers  = Data.getProviders();
    const students   = Data.getStudents();
    const formations = Data.getFormations();
    const settings   = Data.getSettings();
    const isNew      = !mission;

    // Pré-remplissage depuis la formation ou autre contexte
    const preCompany = defaults.companyId || companies[0]?.id || '';
    const preCo      = Data.getCompanyById(preCompany);
    const preBillingRate = preCo?.defaultBillingRate || settings.defaultBillingRate || 50;

    const m = mission || {
      title: '', missionType: defaults.missionType || 'course', subject: '', level: '', type: 'presential',
      companyId: preCompany,
      providerId: defaults.providerId || '',
      providerIds: defaults.providerIds || (defaults.providerId ? [defaults.providerId] : []),
      date: defaultDate || Utils.today(), startTime: '09:00', endTime: '10:00', duration: 1,
      location: '', room: '', notes: '', adminNotes: '',
      status: 'planned', paymentStatus: 'unpaid',
      billingRate: preBillingRate, providerRate: 0,
      recurringGroupId: null, formationId: defaults.formationId || '', studentIds: defaults.studentIds || [],
    };

    const typeOptions = Object.entries(Utils.MISSION_TYPES).map(([k, v]) =>
      `<option value="${k}" ${m.missionType === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
    ).join('');

    const companyOptions = companies.map(c =>
      `<option value="${c.id}" ${m.companyId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
    ).join('');

    const currentProvIds = Array.isArray(m.providerIds) && m.providerIds.length
      ? m.providerIds
      : (m.providerId ? [m.providerId] : []);
    const currentProvSummary = currentProvIds.length > 0
      ? currentProvIds.map(pid => { const p = providers.find(x => x.id === pid); return p ? Utils.escapeHtml(p.lastName + ' ' + p.firstName) : ''; }).filter(Boolean).join(', ')
      : '— Aucun prestataire —';
    const provCheckboxes = providers.map(p =>
      `<label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;padding:2px 0"><input type="checkbox" name="mf-provider-chk" value="${p.id}" data-name="${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}" ${currentProvIds.includes(p.id) ? 'checked' : ''} onchange="window._mfProvChange()">${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}</label>`
    ).join('');

    const formationOptions = `<option value="">— Aucune formation —</option>` +
      formations.map(f =>
        `<option value="${f.id}" ${m.formationId === f.id ? 'selected' : ''}>${Utils.escapeHtml(f.name)}</option>`
      ).join('');

    const subjects = Data.getSubjects();
    const _subjLvl = l => l ? ' ('+ ({college:'Collège',lycee:'Lycée',superieur:'Sup'}[l]||l) +')' : '';
    const _subjOpt = s => `<option value="${s.id}" ${m.subjectId === s.id ? 'selected' : ''}>${Utils.escapeHtml(s.name.toUpperCase())}${_subjLvl(s.level)}</option>`;
    const _ecoles  = subjects.filter(s => s.category !== 'particuliers');
    const _parts   = subjects.filter(s => s.category === 'particuliers');
    const subjectOptions = `<option value="">— Aucune matière —</option>` +
      (_ecoles.length  ? `<optgroup label="🏫 Cours écoles">${_ecoles.map(_subjOpt).join('')}</optgroup>` : '') +
      (_parts.length   ? `<optgroup label="👤 Cours particuliers">${_parts.map(_subjOpt).join('')}</optgroup>` : '');

    this._open(`
      <div class="modal-header">
        <h3>${isNew ? 'Nouvelle mission' : 'Modifier la mission'}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body modal-body-scroll">
        <div class="form-grid">

          <!-- SECTION 1 : Quoi -->
          <div class="form-group form-col-2" style="margin-bottom:0">
            <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:8px">📋 Quoi</div>
          </div>
          <div class="form-group form-col-2">
            <label>Titre *</label>
            <input type="text" id="mf-title" class="form-input" value="${Utils.escapeHtml(m.title)}" placeholder="Ex: Formation Droit du travail — Séance 1">
          </div>
          <div class="form-group">
            <label>Matière</label>
            <select id="mf-subject" class="form-input">${subjectOptions}</select>
          </div>
          <div class="form-group">
            <label>Thème libre</label>
            <input type="text" id="mf-subject-text" class="form-input" value="${Utils.escapeHtml(m.subject || '')}" placeholder="Ex: Droit du travail">
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="mf-mtype" class="form-input">${typeOptions}</select>
          </div>
          <div class="form-group">
            <label>Mode</label>
            <select id="mf-type" class="form-input">
              <option value="presential" ${m.type==='presential'?'selected':''}>Présentiel</option>
              <option value="visio"      ${m.type==='visio'?'selected':''}>Visio</option>
              <option value="hybrid"     ${m.type==='hybrid'?'selected':''}>Hybride</option>
            </select>
          </div>

          <!-- SECTION 2 : Qui -->
          <div class="form-group form-col-2" style="margin-bottom:0;margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:8px">👥 Qui</div>
          </div>
          <div class="form-group">
            <label>École / Client *</label>
            <select id="mf-company" class="form-input">
              <option value="">— Choisir —</option>
              ${companyOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Prestataire(s)</label>
            <details id="mf-providers-details" style="border:1px solid var(--border);border-radius:var(--radius);padding:0">
              <summary id="mf-providers-summary" style="padding:8px 12px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;user-select:none">
                <span id="mf-providers-summary-text">${currentProvSummary}</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">▼</span>
              </summary>
              <div style="padding:8px;border-top:1px solid var(--border)">
                <div id="mf-providers-list" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
                  ${provCheckboxes}
                </div>
              </div>
            </details>
          </div>
          ${students.length > 0 ? `
          <div class="form-group">
            <label>Étudiant(s)</label>
            <details id="mf-students-details" style="border:1px solid var(--border);border-radius:var(--radius);padding:0">
              <summary id="mf-students-summary" style="padding:8px 12px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;user-select:none">
                <span>${(m.studentIds||[]).length>0?(m.studentIds||[]).length+' étudiant(s)':'— Aucun —'}</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">▼</span>
              </summary>
              <div style="padding:8px;border-top:1px solid var(--border)">
                <input type="text" placeholder="Rechercher..." oninput="this.nextElementSibling.querySelectorAll('label').forEach(l=>{l.style.display=l.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none'})" style="width:100%;padding:4px 8px;margin-bottom:6px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.82rem">
                <div id="mf-students-list" style="max-height:140px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
                  ${students.map(s=>`<label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer"><input type="checkbox" name="mf-student-chk" value="${s.id}" ${(m.studentIds||[]).includes(s.id)?'checked':''} onchange="const sel=document.querySelectorAll('input[name=mf-student-chk]:checked').length;document.getElementById('mf-students-summary').firstElementChild.textContent=sel?sel+' étudiant(s)':'— Aucun —'">${Utils.escapeHtml(s.lastName+' '+s.firstName)}</label>`).join('')}
                </div>
              </div>
            </details>
          </div>` : ''}
          <div class="form-group">
            <label>Niveau / Groupe</label>
            <input type="text" id="mf-level" class="form-input" value="${Utils.escapeHtml(m.level||'')}" placeholder="B1, Groupe A…">
          </div>

          <!-- SECTION 3 : Quand / Où -->
          <div class="form-group form-col-2" style="margin-bottom:0;margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:8px">📅 Quand / Où</div>
          </div>
          <div class="form-group">
            <label>Date *</label>
            <input type="date" id="mf-date" class="form-input" value="${m.date}">
          </div>
          <div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label>Début *</label>
              <input type="time" id="mf-start" class="form-input" value="${m.startTime}">
            </div>
            <div>
              <label>Fin *</label>
              <input type="time" id="mf-end" class="form-input" value="${m.endTime}">
            </div>
          </div>
          <div class="form-group form-col-2">
            <label>Lieu / Salle</label>
            <input type="text" id="mf-location" class="form-input" value="${Utils.escapeHtml(m.location||m.room||'')}" placeholder="Adresse, salle, lien visio…">
          </div>

          <!-- SECTION 4 : Finances -->
          <div class="form-group form-col-2" style="margin-bottom:0;margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:8px">💶 Finances & Statut</div>
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select id="mf-status" class="form-input">
              <option value="planned"   ${m.status==='planned'?'selected':''}>Prévu</option>
              <option value="done"      ${m.status==='done'?'selected':''}>Réalisé</option>
              <option value="cancelled" ${m.status==='cancelled'?'selected':''}>Annulé</option>
              <option value="postponed" ${m.status==='postponed'?'selected':''}>Reporté</option>
              <option value="moved"     ${m.status==='moved'?'selected':''}>Déplacé</option>
            </select>
          </div>
          <div class="form-group">
            <label>Paiement</label>
            <select id="mf-payment" class="form-input">
              <option value="unpaid"   ${m.paymentStatus==='unpaid'?'selected':''}>Non payé</option>
              <option value="invoiced" ${m.paymentStatus==='invoiced'?'selected':''}>Facturé</option>
              <option value="paid"     ${m.paymentStatus==='paid'?'selected':''}>Payé</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tarif facturation (€/h)</label>
            <input type="number" id="mf-billing-rate" class="form-input" value="${m.billingRate||0}" min="0" step="0.5">
          </div>
          <div class="form-group" id="prov-rate-group" style="${currentProvIds.length ? '' : 'display:none'}">
            <label>Tarif prestataire (€/h)</label>
            <input type="number" id="mf-provider-rate" class="form-input" value="${m.providerRate||0}" min="0" step="0.5">
          </div>

          <!-- SECTION 5 : Autres -->
          <div class="form-group form-col-2" style="margin-bottom:0;margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
            <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:8px">🔗 Autres</div>
          </div>
          <div class="form-group form-col-2">
            <label>Formation liée</label>
            <select id="mf-formation" class="form-input">${formationOptions}</select>
          </div>
          <div class="form-group form-col-2">
            <label>Notes</label>
            <textarea id="mf-notes" class="form-input form-textarea" placeholder="Observations, notes admin…" style="min-height:60px">${Utils.escapeHtml(m.notes||'')}</textarea>
          </div>

          ${isNew ? `
          <div class="form-group form-col-2">
            <div class="form-section-title">Récurrence (optionnel)</div>
          </div>
          <div class="form-group">
            <label>Fréquence</label>
            <select id="mf-recurrence" class="form-input">
              <option value="">Aucune (mission unique)</option>
              <option value="weekly">Chaque semaine</option>
              <option value="biweekly">Toutes les 2 semaines</option>
              <option value="monthly">Chaque mois</option>
            </select>
          </div>
          <div class="form-group" id="recurrence-end-group" style="display:none">
            <label>Jusqu'au</label>
            <input type="date" id="mf-recurrence-end" class="form-input" value="${Utils.addDays(m.date || Utils.today(), 84)}">
          </div>
          ` : ''}

        </div>
        <div id="mission-preview" class="revenue-preview"></div>
      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-mission-btn">Supprimer</button>` : ''}
        ${!isNew ? `<button class="btn btn-ghost" id="dup-mission-btn">Dupliquer</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn btn-primary" id="save-mission-btn">${isNew ? 'Créer' : 'Enregistrer'}</button>
      </div>
    `);

    const updatePreview = () => {
      const start   = document.getElementById('mf-start').value;
      const end     = document.getElementById('mf-end').value;
      const bRate   = parseFloat(document.getElementById('mf-billing-rate').value) || 0;
      const pRate   = parseFloat(document.getElementById('mf-provider-rate')?.value) || 0;
      const dur     = Utils.calcDuration(start, end);
      const revenue = dur * bRate;
      const cost    = dur * pRate;
      const prev    = document.getElementById('mission-preview');
      if (prev && dur > 0) {
        prev.innerHTML = `
          <span class="preview-item"><strong>Durée :</strong> ${Utils.formatDuration(dur)}</span>
          <span class="preview-item"><strong>Revenu :</strong> ${Utils.formatMoney(revenue)}</span>
          ${pRate > 0
            ? `<span class="preview-item"><strong>Coût prestataire :</strong> ${Utils.formatMoney(cost)}</span>
               <span class="preview-item preview-margin"><strong>Marge :</strong> ${Utils.formatMoney(revenue - cost)}</span>`
            : (document.querySelector('input[name="mf-provider-chk"]:checked')
                ? `<span class="preview-item" style="color:#64748b;font-size:0.8rem">💼 Tarif interne → marge = revenu total</span>`
                : '')
          }
        `;
      } else if (prev) { prev.innerHTML = ''; }
    };

    // Prestataires changed → update summary, show/hide rate, auto-fill rate
    const compSel = document.getElementById('mf-company');
    window._mfProvChange = () => {
      const checked = [...document.querySelectorAll('input[name="mf-provider-chk"]:checked')];
      const summEl = document.getElementById('mf-providers-summary-text');
      if (summEl) {
        summEl.textContent = checked.length > 0
          ? checked.map(i => i.dataset.name).join(', ')
          : '— Aucun prestataire —';
      }
      const grp = document.getElementById('prov-rate-group');
      if (grp) grp.style.display = checked.length > 0 ? '' : 'none';
      if (checked.length > 0) {
        const rateEl = document.getElementById('mf-provider-rate');
        // Ne pas écraser un tarif saisi manuellement (≠ 0) — sauf si le champ était vide/0
        const currentRate = parseFloat(rateEl?.value) || 0;
        if (currentRate === 0 || isNew) {
          const companyId = compSel?.value;
          const rate = Data.getEffectiveRate(checked[0].value, companyId);
          if (rate != null) rateEl.value = rate;
        }
      }
      updatePreview();
    };

    // Company changed → auto-fill billing rate
    if (compSel) {
      compSel.addEventListener('change', () => {
        const co = Data.getCompanyById(compSel.value);
        if (co && co.defaultBillingRate) {
          document.getElementById('mf-billing-rate').value = co.defaultBillingRate;
        }
        // Re-apply provider rate uniquement si champ vide/0
        const firstProv = document.querySelector('input[name="mf-provider-chk"]:checked');
        if (firstProv) {
          const rateEl = document.getElementById('mf-provider-rate');
          if ((parseFloat(rateEl?.value) || 0) === 0) {
            const rate = Data.getEffectiveRate(firstProv.value, compSel.value);
            if (rate != null) rateEl.value = rate;
          }
        }
        updatePreview();
      });
    }

    ['mf-start','mf-end','mf-billing-rate','mf-provider-rate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    // P2 — Auto-sélection société "Cours particuliers" quand matière particuliers choisie
    const subjSel = document.getElementById('mf-subject');
    if (subjSel) {
      subjSel.addEventListener('change', () => {
        const sid = subjSel.value;
        if (!sid) return;
        const subj = (Data.getSubjects()||[]).find(s => s.id === sid);
        if (!subj || subj.category !== 'particuliers') return;
        // Trouver la société "Cours particuliers" (poleId = Artémis, name contient 'cours particulier')
        const cpCo = Data.getCompanies().find(c =>
          c.role !== 'own' && (c.name||'').toLowerCase().includes('cours particulier')
        );
        if (cpCo && compSel) {
          compSel.value = cpCo.id;
          // Déclencher le changement de société pour mettre à jour le tarif facturation
          compSel.dispatchEvent(new Event('change'));
        }
      });
    }

    // Recurrence toggle
    const recSel = document.getElementById('mf-recurrence');
    if (recSel) {
      recSel.addEventListener('change', () => {
        const eg = document.getElementById('recurrence-end-group');
        if (eg) eg.style.display = recSel.value ? '' : 'none';
      });
    }

    updatePreview();

    // Save
    document.getElementById('save-mission-btn').addEventListener('click', () => {
      const title     = document.getElementById('mf-title').value.trim();
      const date      = document.getElementById('mf-date').value;
      const startTime = document.getElementById('mf-start').value;
      const endTime   = document.getElementById('mf-end').value;
      if (!title || !date || !startTime || !endTime) {
        Utils.toast('Veuillez remplir tous les champs obligatoires.', 'error'); return;
      }
      if (startTime >= endTime) {
        Utils.toast("L'heure de fin doit être après l'heure de début.", 'error'); return;
      }

      const recurrence    = document.getElementById('mf-recurrence')?.value || '';
      const recurrenceEnd = document.getElementById('mf-recurrence-end')?.value || '';

      const saved = {
        id: m.id || Utils.uuid(),
        title,
        missionType: document.getElementById('mf-mtype').value,
        subjectId:   document.getElementById('mf-subject').value || '',
        subject:     document.getElementById('mf-subject-text').value.trim(),
        level:       document.getElementById('mf-level').value.trim(),
        type:        document.getElementById('mf-type').value,
        companyId:   document.getElementById('mf-company').value,
        providerIds: [...document.querySelectorAll('input[name="mf-provider-chk"]:checked')].map(i => i.value),
        providerId:  document.querySelector('input[name="mf-provider-chk"]:checked')?.value || null,
        date, startTime, endTime,
        location:    document.getElementById('mf-location').value.trim(),
        room:        m.room || '', // champ distinct conservé si existant
        notes:       document.getElementById('mf-notes').value.trim(),
        adminNotes:  m.adminNotes || '', // on préserve les notes admin existantes
        status:      document.getElementById('mf-status').value,
        paymentStatus: document.getElementById('mf-payment').value,
        billingRate: parseFloat(document.getElementById('mf-billing-rate').value) || 0,
        providerRate: parseFloat(document.getElementById('mf-provider-rate')?.value) || 0,
        recurringGroupId: m.recurringGroupId || null,
        formationId: document.getElementById('mf-formation').value || null,
        studentIds:  [...document.querySelectorAll('input[name="mf-student-chk"]:checked')].map(i => i.value),
        // P6 — catégorie déduite de la matière pour un filtrage direct
        missionCategory: (() => {
          const sid = document.getElementById('mf-subject').value;
          const subj = sid ? (Data.getSubjects()||[]).find(s => s.id === sid) : null;
          return subj?.category || '';
        })(),
      };

      // Un événement personnel ne porte ni société ni tarif (sinon il gonfle le CA)
      if (saved.missionType === 'personal') {
        saved.companyId    = '';
        saved.billingRate  = 0;
        saved.providerRate = 0;
      }

      if (isNew && recurrence && recurrenceEnd) {
        const list = Data.createRecurringMissions(saved, recurrence, recurrenceEnd);
        Utils.toast(`${list.length} missions récurrentes créées.`, 'success');
      } else {
        Data.saveMission(saved);
        Utils.toast(isNew ? 'Mission créée.' : 'Mission mise à jour.', 'success');
      }

      this.close();
      if (onDone) onDone(); else if (typeof renderPage === 'function') renderPage(); else if (typeof renderDashboard === 'function') renderDashboard();
    });

    // Delete
    const delBtn = document.getElementById('del-mission-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (m.recurringGroupId) {
          this._deleteRecurringDialog(m, onDone);
        } else {
          this.confirm('Supprimer cette mission définitivement ?', () => {
            Data.deleteMission(m.id);
            Utils.toast('Mission supprimée.', 'success');
            this.close();
            if (onDone) onDone(); else if (typeof renderPage === 'function') renderPage(); else if (typeof renderDashboard === 'function') renderDashboard();
          });
        }
      });
    }

    // Duplicate
    const dupBtn = document.getElementById('dup-mission-btn');
    if (dupBtn) {
      dupBtn.addEventListener('click', () => {
        this.close();
        const newM = Data.duplicateMission(m.id);
        if (newM) {
          Utils.toast('Mission dupliquée.', 'success');
          if (onDone) onDone();
          setTimeout(() => this.openMission(newM.id, null, onDone), 150);
        }
      });
    }
  },

  _deleteRecurringDialog(mission, onDone) {
    this._open(`
      <div class="modal-header">
        <h3>Supprimer la mission récurrente</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body">
        <p>Cette mission fait partie d'une série récurrente. Que souhaitez-vous supprimer ?</p>
      </div>
      <div class="modal-footer" style="flex-direction:column;gap:8px">
        <button class="btn btn-danger" id="del-single">Supprimer uniquement cette mission</button>
        <button class="btn btn-ghost btn-danger-text" id="del-all">Supprimer toutes les occurrences</button>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
      </div>
    `);
    document.getElementById('del-single').addEventListener('click', () => {
      Data.deleteMission(mission.id);
      Utils.toast('Mission supprimée.', 'success');
      this.close();
      if (onDone) onDone(); else if (typeof renderPage === 'function') renderPage(); else if (typeof renderDashboard === 'function') renderDashboard();
    });
    document.getElementById('del-all').addEventListener('click', () => {
      Data.deleteRecurringGroup(mission.recurringGroupId);
      Utils.toast('Série supprimée.', 'success');
      this.close();
      if (onDone) onDone(); else if (typeof renderPage === 'function') renderPage(); else if (typeof renderDashboard === 'function') renderDashboard();
    });
  },

  // ── Modale Société ───────────────────────────────────────────

  openSchool(companyId = null) { return this.openCompany(companyId); },

  openCompany(companyId = null, _onDone = null, _unused = null, defaults = {}) {
    const company = companyId ? Data.getCompanyById(companyId) : null;
    const isNew   = !company;
    const ownCos  = Data.getOwnCompanies();
    // I6 — appliquer les defaults (poleId, category) pour les nouvelles sociétés
    const c = company || {
      name: '', color: Utils.PRESET_COLORS[0], role: 'client', type: 'other',
      address: '', phone: '', email: '', contact: '',
      defaultBillingRate: 50, notes: '',
      poleId:   defaults.poleId   || '',
      category: defaults.category || 'school'
    };

    const colorSwatches = Utils.PRESET_COLORS.map(col =>
      `<button type="button" class="color-swatch ${col === c.color ? 'selected' : ''}"
        style="background:${col}" data-color="${col}" title="${col}"></button>`
    ).join('');

    const roleOptions = Object.entries(Utils.COMPANY_ROLES).map(([k, v]) =>
      `<option value="${k}" ${c.role === k ? 'selected' : ''}>${v}</option>`
    ).join('');

    const typeOptions = Object.entries(Utils.COMPANY_TYPES).map(([k, v]) =>
      `<option value="${k}" ${c.type === k ? 'selected' : ''}>${v}</option>`
    ).join('');

    this._open(`
      <div class="modal-header">
        <h3>${isNew ? 'Nouvelle société' : 'Modifier la société'}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body modal-body-scroll">
        <div class="form-grid">
          <div class="form-group form-col-2">
            <label>Nom *</label>
            <input type="text" id="cf-name" class="form-input" value="${Utils.escapeHtml(c.name)}" placeholder="Ex: Artémis Formation">
          </div>
          <div class="form-group">
            <label>Rôle *</label>
            <select id="cf-role" class="form-input" onchange="document.getElementById('cf-pole-group').style.display=this.value==='client'?'':'none';document.getElementById('cf-category-group').style.display=this.value==='client'?'':'none';document.getElementById('cf-training-group').style.display=this.value==='own'?'':'none';">${roleOptions}</select>
          </div>
          <div class="form-group" id="cf-pole-group" style="${c.role !== 'client' ? 'display:none' : ''}">
            <label>Société racine *</label>
            <select id="cf-pole" class="form-input">
              <option value="">— Non rattachée —</option>
              ${ownCos.map(o => `<option value="${o.id}" ${c.poleId === o.id ? 'selected' : ''}>${Utils.escapeHtml(o.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="cf-category-group" style="${c.role !== 'client' ? 'display:none' : ''}">
            <label>Catégorie</label>
            <select id="cf-category" class="form-input">
              <option value="school"       ${(c.category||'school')==='school'       ? 'selected' : ''}>École</option>
              <option value="institution"  ${c.category==='institution'  ? 'selected' : ''}>Institution</option>
            </select>
          </div>
          <div class="form-group">
            <label>Type d'activité</label>
            <select id="cf-type" class="form-input">${typeOptions}</select>
          </div>
          <div class="form-group" id="cf-training-group" style="${c.role !== 'own' ? 'display:none' : ''}">
            <label> </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem">
              <input type="checkbox" id="cf-has-training" ${c.hasTraining ? 'checked' : ''}> Propose des formations avec étudiants
            </label>
          </div>
          <div class="form-group">
            <label>Tarif facturation par défaut (€/h)</label>
            <input type="number" id="cf-rate" class="form-input" value="${c.defaultBillingRate || 0}" min="0" step="0.5">
          </div>
          <div class="form-group form-col-2">
            <label>Couleur</label>
            <div class="color-picker-row">
              <div class="color-swatches">${colorSwatches}</div>
              <input type="color" id="cf-color" class="form-input color-input" value="${c.color}">
            </div>
          </div>
          <div class="form-group">
            <label>Contact administratif</label>
            <input type="text" id="cf-contact" class="form-input" value="${Utils.escapeHtml(c.contact || '')}" placeholder="Nom du contact">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="cf-email" class="form-input" value="${Utils.escapeHtml(c.email || '')}" placeholder="contact@société.fr">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" id="cf-phone" class="form-input" value="${Utils.escapeHtml(c.phone || '')}" placeholder="01 23 45 67 89">
          </div>
          <div class="form-group form-col-2">
            <label>Adresse</label>
            <input type="text" id="cf-address" class="form-input" value="${Utils.escapeHtml(c.address || '')}" placeholder="12 rue de la Paix, Paris">
          </div>
          <div class="form-group">
            <label>SIRET</label>
            <input type="text" id="cf-siret" class="form-input" value="${Utils.escapeHtml(c.siret || '')}" placeholder="12345678900000" maxlength="14">
          </div>
          <div class="form-group">
            <label>IBAN</label>
            <input type="text" id="cf-iban" class="form-input" value="${Utils.escapeHtml(c.iban || '')}" placeholder="FR76 ...">
          </div>
          <div class="form-group form-col-2">
            <label>Matières / Cours enseignés</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg)">
              ${(Data.getSubjects()||[]).length === 0
                ? '<span style="font-size:0.82rem;color:var(--text-muted)">Aucune matière créée — allez dans Référentiels → Matières & Cours</span>'
                : (Data.getSubjects()||[]).map(subj => `
                  <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.82rem">
                    <input type="checkbox" name="cf-subject-chk" value="${subj.id}" ${(c.subjectIds||[]).includes(subj.id)?'checked':''}>
                    ${subj.color?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${subj.color}"></span>`:''}
                    ${Utils.escapeHtml(subj.name)}${subj.level?` <span style="color:var(--text-muted);font-size:0.75rem">(${({college:'Collège',lycee:'Lycée',superieur:'Sup'}[subj.level]||subj.level)})</span>`:''}
                  </label>`).join('')}
            </div>
          </div>
          <div class="form-group form-col-2">
            <label>Notes</label>
            <textarea id="cf-notes" class="form-input form-textarea">${Utils.escapeHtml(c.notes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-company-btn">Supprimer</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn btn-primary" id="save-company-btn">${isNew ? 'Créer' : 'Enregistrer'}</button>
      </div>
    `);


    const colorInput = document.getElementById('cf-color');
    document.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        colorInput.value = btn.dataset.color;
      });
    });
    colorInput.addEventListener('input', () => {
      document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
    });

    document.getElementById('save-company-btn').addEventListener('click', () => {
      const name = document.getElementById('cf-name').value.trim();
      if (!name) { Utils.toast('Le nom est obligatoire.', 'error'); return; }
      Data.saveCompany({
        id: c.id || Utils.uuid(), name,
        role:    document.getElementById('cf-role').value,
        type:    document.getElementById('cf-type').value,
        color:   document.getElementById('cf-color').value,
        address: document.getElementById('cf-address').value.trim(),
        phone:   document.getElementById('cf-phone').value.trim(),
        email:   document.getElementById('cf-email').value.trim(),
        contact: document.getElementById('cf-contact').value.trim(),
        defaultBillingRate: parseFloat(document.getElementById('cf-rate').value) || 0,
        notes:    document.getElementById('cf-notes').value.trim(),
        poleId:   document.getElementById('cf-pole')?.value || '',
        category: document.getElementById('cf-category')?.value || 'school',
        subjectIds: [...document.querySelectorAll('input[name="cf-subject-chk"]:checked')].map(i => i.value),
        hasTraining: document.getElementById('cf-has-training')?.checked || false,
        siret: document.getElementById('cf-siret').value.trim(),
        iban:  document.getElementById('cf-iban').value.trim()
      });
      Utils.toast(isNew ? 'Société créée.' : 'Société mise à jour.', 'success');
      this.close();
      if (typeof window._refreshSidebar === 'function') window._refreshSidebar();
      if (typeof renderPage === 'function') renderPage();
      else if (typeof renderDashboard === 'function') renderDashboard();
    });

    const delBtn = document.getElementById('del-company-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const result = Data.deleteCompany(c.id);
        if (result.error) { Utils.toast(result.error, 'error'); }
        else {
          Utils.toast('Société supprimée.', 'success');
          this.close();
          if (typeof window._refreshSidebar === 'function') window._refreshSidebar();
          if (typeof renderPage === 'function') renderPage();
          else if (typeof renderDashboard === 'function') renderDashboard();
        }
      });
    }
  },

  // ── Modale Prestataire ────────────────────────────────────────

  openProvider(providerId = null) {
    const provider = providerId ? Data.getProviderById(providerId) : null;
    const isNew    = !provider;
    const ownCos     = Data.getOwnCompanies();
    const clientCos  = Data.getClientSchools();
    const students   = Data.getStudents();
    const p = provider || {
      firstName: '', lastName: '', structure: '', specialty: '',
      defaultHourlyRate: 0, phone: '', email: '', notes: '', active: true,
      poleId: '', linkedToType: '', linkedToId: ''
    };

    // Pré-calcul options pour onchange inline (évite backticks imbriqués)
    const schoolOpts   = '<option value=""></option>' + clientCos.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
    const studentOpts  = '<option value=""></option>' + students.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.lastName + ' ' + s.firstName)}</option>`).join('');

    // Liens existants (pour affichage)
    const existingLinks = providerId ? Data.getProviderLinksByProvider(providerId) : [];
    const companies = Data.getCompanies();
    const linkedCompanies = existingLinks.map(l => {
      const co = Data.getCompanyById(l.companyId);
      return co ? `<div class="provider-link-row">
        <span class="provider-link-company">${Utils.escapeHtml(co.name)}</span>
        <span class="provider-link-rate">${Utils.formatMoney(l.hourlyRate)}/h</span>
        <button class="btn-icon-sm" onclick="Modals.openProviderLink('${l.id}')">✎</button>
        <button class="btn-icon-sm btn-icon-danger" onclick="Modals._deleteLink('${l.id}')">✕</button>
      </div>` : '';
    }).join('');

    window._pfSchoolOpts  = schoolOpts;
    window._pfStudentOpts = studentOpts;

    this._open(`
      <div class="modal-header">
        <h3>${isNew ? 'Nouveau prestataire' : 'Modifier le prestataire'}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body modal-body-scroll">
        <div class="form-grid">
          <div class="form-group">
            <label>Prénom *</label>
            <input type="text" id="pf-first" class="form-input" value="${Utils.escapeHtml(p.firstName)}" placeholder="Prénom">
          </div>
          <div class="form-group">
            <label>Nom *</label>
            <input type="text" id="pf-last" class="form-input" value="${Utils.escapeHtml(p.lastName)}" placeholder="Nom">
          </div>
          <div class="form-group">
            <label>Structure</label>
            <input type="text" id="pf-struct" class="form-input" value="${Utils.escapeHtml(p.structure || '')}" placeholder="Ex: Freelance, Cabinet...">
          </div>
          <div class="form-group">
            <label>Spécialité</label>
            <input type="text" id="pf-specialty" class="form-input" value="${Utils.escapeHtml(p.specialty || p.subject || '')}" placeholder="Ex: Droit du travail">
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="pf-is-agency" ${p.isAgency?'checked':''}>
            <label for="pf-is-agency" style="margin:0;cursor:pointer">Agence de facturation (hérite des missions des écoles liées)</label>
          </div>
          <div class="form-group">
            <label>Tarif défaut (€/h)</label>
            <input type="number" id="pf-rate" class="form-input" value="${p.defaultHourlyRate || p.hourlyRate || 0}" min="0" step="0.5">
          </div>
          <div class="form-group">
            <label>Tarif Collège (€/h)</label>
            <input type="number" id="pf-rate-college" class="form-input" value="${p.rateCollege || ''}" min="0" step="0.5" placeholder="Idem défaut">
          </div>
          <div class="form-group">
            <label>Tarif Lycée (€/h)</label>
            <input type="number" id="pf-rate-lycee" class="form-input" value="${p.rateLycee || ''}" min="0" step="0.5" placeholder="Idem défaut">
          </div>
          <div class="form-group">
            <label>Tarif Supérieur (€/h)</label>
            <input type="number" id="pf-rate-sup" class="form-input" value="${p.rateSup || ''}" min="0" step="0.5" placeholder="Idem défaut">
          </div>
          <div class="form-group">
            <label>Société principale</label>
            <select id="pf-pole" class="form-input">
              <option value="">— Toutes —</option>
              ${ownCos.map(c => `<option value="${c.id}" ${p.poleId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select id="pf-active" class="form-input">
              <option value="true" ${p.active !== false ? 'selected' : ''}>Actif</option>
              <option value="false" ${p.active === false ? 'selected' : ''}>Inactif</option>
            </select>
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input type="text" id="pf-phone" class="form-input" value="${Utils.escapeHtml(p.phone || '')}" placeholder="06 ...">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="pf-email" class="form-input" value="${Utils.escapeHtml(p.email || '')}" placeholder="email@example.com">
          </div>
          <div class="form-group form-col-2">
            <label>Adresse postale <span style="color:var(--text-muted);font-size:0.8rem">(pour les factures)</span></label>
            <input type="text" id="pf-address" class="form-input" value="${Utils.escapeHtml(p.address || '')}" placeholder="21 Montée de Collonges, 42170 Saint-Just-Saint-Rambert">
          </div>
          <div class="form-group">
            <label>Rattachement secondaire</label>
            <select id="pf-linked-type" class="form-input" onchange="
              const v=this.value;
              const g=document.getElementById('pf-linked-id-group');
              const sel=document.getElementById('pf-linked-id');
              g.style.display=v?'':'none';
              if(v==='school') sel.innerHTML=window._pfSchoolOpts||'';
              else if(v==='student') sel.innerHTML=window._pfStudentOpts||'';
            ">
              <option value="" ${!p.linkedToType ? 'selected' : ''}>— Aucun —</option>
              <option value="school"   ${p.linkedToType==='school'   ? 'selected' : ''}>École / Client</option>
              <option value="student"  ${p.linkedToType==='student'  ? 'selected' : ''}>Apprenant</option>
            </select>
          </div>
          <div class="form-group" id="pf-linked-id-group" style="${p.linkedToType ? '' : 'display:none'}">
            <label>Entité liée</label>
            <select id="pf-linked-id" class="form-input">
              ${p.linkedToType==='school'
                ? '<option value=""></option>'+clientCos.map(c=>`<option value="${c.id}" ${p.linkedToId===c.id?'selected':''}>${Utils.escapeHtml(c.name)}</option>`).join('')
                : p.linkedToType==='student'
                ? '<option value=""></option>'+students.map(s=>`<option value="${s.id}" ${p.linkedToId===s.id?'selected':''}>${Utils.escapeHtml(s.lastName+' '+s.firstName)}</option>`).join('')
                : ''}
            </select>
          </div>
          <div class="form-group form-col-2">
            <label>Notes</label>
            <textarea id="pf-notes" class="form-input form-textarea">${Utils.escapeHtml(p.notes || '')}</textarea>
          </div>
        </div>

        ${!isNew ? `
        <div class="form-section-divider">
          <div class="form-section-title">Liaisons avec les sociétés</div>
          <button class="btn btn-ghost btn-sm" onclick="Modals.openProviderLink(null, '${providerId}')">+ Ajouter un lien</button>
        </div>
        <div class="provider-links-list" id="plinks-list">
          ${existingLinks.length === 0
            ? '<p class="empty-state-sm">Aucun lien avec une société. Ajoutez-en un pour définir des tarifs spécifiques.</p>'
            : linkedCompanies}
        </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-provider-btn">Supprimer</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn btn-primary" id="save-provider-btn">${isNew ? 'Créer' : 'Enregistrer'}</button>
      </div>
    `);

    document.getElementById('save-provider-btn').addEventListener('click', () => {
      const firstName = document.getElementById('pf-first').value.trim();
      const lastName  = document.getElementById('pf-last').value.trim();
      if (!firstName || !lastName) { Utils.toast('Le prénom et le nom sont obligatoires.', 'error'); return; }
      Data.saveProvider({
        id: p.id || Utils.uuid(),
        firstName, lastName,
        structure: document.getElementById('pf-struct').value.trim(),
        specialty: document.getElementById('pf-specialty').value.trim(),
        subject:   document.getElementById('pf-specialty').value.trim(),
        defaultHourlyRate: parseFloat(document.getElementById('pf-rate').value) || 0,
        hourlyRate:        parseFloat(document.getElementById('pf-rate').value) || 0,
        rateCollege: parseFloat(document.getElementById('pf-rate-college').value) || 0,
        rateLycee:   parseFloat(document.getElementById('pf-rate-lycee').value) || 0,
        rateSup:     parseFloat(document.getElementById('pf-rate-sup').value) || 0,
        phone:   document.getElementById('pf-phone').value.trim(),
        email:   document.getElementById('pf-email').value.trim(),
        address: document.getElementById('pf-address').value.trim(),
        notes:    document.getElementById('pf-notes').value.trim(),
        isAgency: document.getElementById('pf-is-agency').checked,
        active:   document.getElementById('pf-active').value === 'true',
        poleId:        document.getElementById('pf-pole').value || '',
        linkedToType:  document.getElementById('pf-linked-type').value || '',
        linkedToId:    document.getElementById('pf-linked-id').value || ''
      });
      Utils.toast(isNew ? 'Prestataire créé.' : 'Prestataire mis à jour.', 'success');
      this.close();
      if (typeof renderPage === 'function') renderPage();
      else if (typeof renderDashboard === 'function') renderDashboard();
    });

    const delBtn = document.getElementById('del-provider-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const result = Data.deleteProvider(p.id);
        if (result.error) { Utils.toast(result.error, 'error'); }
        else {
          Utils.toast('Prestataire supprimé.', 'success');
          this.close();
          if (typeof renderPage === 'function') renderPage();
          else if (typeof renderDashboard === 'function') renderDashboard();
        }
      });
    }
  },

  _deleteLink(linkId) {
    Data.deleteProviderLink(linkId);
    Utils.toast('Lien supprimé.', 'success');
    if (typeof renderPage === 'function') renderPage();
    this.close();
  },

  // ── Modale Lien Prestataire ↔ Société ────────────────────────

  openProviderLink(linkId = null, defaultProviderId = null, defaultCompanyId = null) {
    const link    = linkId ? Data.getProviderLinks().find(l => l.id === linkId) : null;
    const isNew   = !link;
    const companies = Data.getCompanies();
    const providers = Data.getProviders();

    const l = link || {
      providerId: defaultProviderId || '', companyId: defaultCompanyId || '',
      hourlyRate: 0, missionTypes: '', notes: '', active: true
    };

    const coOptions = companies.map(c =>
      `<option value="${c.id}" ${l.companyId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
    ).join('');
    const provOptions = providers.map(p =>
      `<option value="${p.id}" ${l.providerId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}</option>`
    ).join('');

    this._open(`
      <div class="modal-header">
        <h3>${isNew ? 'Nouveau lien prestataire ↔ société' : 'Modifier le lien'}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Prestataire *</label>
            <select id="lf-provider" class="form-input">
              <option value="">— Choisir —</option>${provOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Société *</label>
            <select id="lf-company" class="form-input">
              <option value="">— Choisir —</option>${coOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Tarif horaire spécifique (€/h) *</label>
            <input type="number" id="lf-rate" class="form-input" value="${l.hourlyRate || 0}" min="0" step="0.5">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select id="lf-active" class="form-input">
              <option value="true" ${l.active !== false ? 'selected' : ''}>Actif</option>
              <option value="false" ${l.active === false ? 'selected' : ''}>Inactif</option>
            </select>
          </div>
          <div class="form-group form-col-2">
            <label>Types de missions (séparés par virgule)</label>
            <input type="text" id="lf-types" class="form-input" value="${Utils.escapeHtml(l.missionTypes || '')}" placeholder="Ex: course, training">
          </div>
          <div class="form-group form-col-2">
            <label>Notes</label>
            <textarea id="lf-notes" class="form-input form-textarea">${Utils.escapeHtml(l.notes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-link-btn">Supprimer le lien</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn btn-primary" id="save-link-btn">${isNew ? 'Créer' : 'Enregistrer'}</button>
      </div>
    `);

    document.getElementById('save-link-btn').addEventListener('click', () => {
      const providerId = document.getElementById('lf-provider').value;
      const companyId  = document.getElementById('lf-company').value;
      const rate       = parseFloat(document.getElementById('lf-rate').value);
      if (!providerId || !companyId) { Utils.toast('Prestataire et société sont obligatoires.', 'error'); return; }
      if (rate < 0) { Utils.toast('Le tarif horaire est invalide.', 'error'); return; }
      Data.saveProviderLink({
        id:           l.id || Utils.uuid(),
        providerId, companyId,
        hourlyRate:   rate,
        missionTypes: document.getElementById('lf-types').value.trim(),
        notes:        document.getElementById('lf-notes').value.trim(),
        active:       document.getElementById('lf-active').value === 'true'
      });
      Utils.toast(isNew ? 'Lien créé.' : 'Lien mis à jour.', 'success');
      this.close();
      if (typeof renderPage === 'function') renderPage();
    });

    const delBtn = document.getElementById('del-link-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        Data.deleteProviderLink(l.id);
        Utils.toast('Lien supprimé.', 'success');
        this.close();
        if (typeof renderPage === 'function') renderPage();
      });
    }
  },

  // ── Modale Étudiant ──────────────────────────────────────────

  openStudent(studentId = null) {
    const student = studentId ? Data.getStudentById(studentId) : null;
    const isNew   = !student;
    const ownCos  = Data.getOwnCompanies().filter(c => c.hasTraining);
    const formations = Data.getFormations();

    const s = student || {
      firstName: '', lastName: '', email: '', phone: '',
      companyId: '', poleId: ownCos[0]?.id || '',
      formationIds: [], status: 'active', notes: '', entryDate: '',
      // Qualiopi — Ind. 4/8
      projetPro: '', examenCible: '', rqth: false,
      positionScore: '', positionDate: '',
      // Ind. 9 — Contrat pédagogique
      financementMode: '', financeur: '', objectifsPeda: '', modalite: '', contratDate: '',
      // Ind. 11 — Évaluation finale
      evalFinale: '', attestationDate: '', pretExamen: false, obsFinales: '',
      // Ind. 7/30 — Satisfaction
      evalChaudDate: '', evalChaudNote: '', evalFroidDate: '', evalFroidNote: '',
    };

    const coOptions = ownCos.map(c =>
      `<option value="${c.id}" ${(s.poleId||s.companyId) === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
    ).join('');

    const formChks = formations.map(f =>
      `<label class="form-check">
        <input type="checkbox" name="student-formation" value="${f.id}" ${(s.formationIds || []).includes(f.id) ? 'checked' : ''}>
        ${Utils.escapeHtml(f.name)}
      </label>`
    ).join('');

    const tabStyle = (active) => `padding:8px 16px;border:none;background:none;cursor:pointer;border-bottom:2px solid ${active?'var(--primary)':'transparent'};color:${active?'var(--primary)':'var(--text-muted)'};font-weight:${active?'600':'400'}`;

    this._open(`
      <div class="modal-header">
        <h3>${isNew ? 'Nouvel étudiant' : Utils.escapeHtml(s.firstName+' '+s.lastName)}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div style="display:flex;border-bottom:1px solid var(--border);padding:0 20px;gap:4px">
        <button id="stab-btn-profil"    style="${tabStyle(true)}"     onclick="window._stTab('profil')">Profil</button>
        <button id="stab-btn-qualiopi" style="${tabStyle(false)}" onclick="window._stTab('qualiopi')">📋 Qualiopi</button>
      </div>
      <div class="modal-body modal-body-scroll">

        <div id="stab-profil">
          <div class="form-grid">
            <div class="form-group">
              <label>Prénom *</label>
              <input type="text" id="stf-first" class="form-input" value="${Utils.escapeHtml(s.firstName)}" placeholder="Prénom">
            </div>
            <div class="form-group">
              <label>Nom *</label>
              <input type="text" id="stf-last" class="form-input" value="${Utils.escapeHtml(s.lastName)}" placeholder="Nom">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="stf-email" class="form-input" value="${Utils.escapeHtml(s.email || '')}" placeholder="email@example.com">
            </div>
            <div class="form-group">
              <label>Téléphone</label>
              <input type="text" id="stf-phone" class="form-input" value="${Utils.escapeHtml(s.phone || '')}" placeholder="06 ...">
            </div>
            <div class="form-group">
              <label>Société racine *</label>
              <select id="stf-pole" class="form-input">
                <option value="">— Choisir —</option>${coOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Niveau</label>
              <select id="stf-level" class="form-input">
                <option value="" ${!s.level ? 'selected' : ''}>— Non défini —</option>
                <option value="college"   ${s.level==='college'   ? 'selected' : ''}>Collège</option>
                <option value="lycee"     ${s.level==='lycee'     ? 'selected' : ''}>Lycée</option>
                <option value="superieur" ${s.level==='superieur' ? 'selected' : ''}>Supérieur</option>
              </select>
            </div>
            <div class="form-group">
              <label>Statut</label>
              <select id="stf-status" class="form-input">
                <option value="active"   ${s.status === 'active'   ? 'selected' : ''}>Actif</option>
                <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Inactif</option>
                <option value="pending"  ${s.status === 'pending'  ? 'selected' : ''}>En attente</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date d'entrée en formation</label>
              <input type="date" id="stf-entrydate" class="form-input" value="${s.entryDate||''}">
            </div>
            ${formations.length > 0 ? `
            <div class="form-group form-col-2">
              <label>Formations suivies</label>
              <div class="form-checks">${formChks}</div>
            </div>` : ''}
            <div class="form-group form-col-2">
              <label>Notes</label>
              <textarea id="stf-notes" class="form-input form-textarea">${Utils.escapeHtml(s.notes || '')}</textarea>
            </div>
          </div>
        </div>

        <div id="stab-qualiopi" style="display:none">
          <div class="form-grid">

            <div class="form-group form-col-2" style="margin-bottom:4px">
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;padding:8px 0 4px;border-top:1px solid var(--border)">Ind. 4 — Analyse des besoins</div>
            </div>
            <div class="form-group form-col-2">
              <label>Projet professionnel</label>
              <input type="text" id="stf-projet" class="form-input" value="${Utils.escapeHtml(s.projetPro||'')}" placeholder="Ex : intégration en classe prépa">
            </div>
            <div class="form-group">
              <label>Examen / certification cible</label>
              <input type="text" id="stf-examen" class="form-input" value="${Utils.escapeHtml(s.examenCible||'')}" placeholder="Bac, BTS, CPGE...">
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:22px">
              <label class="form-check" style="margin:0">
                <input type="checkbox" id="stf-rqth" ${s.rqth ? 'checked' : ''}>
                Situation de handicap / RQTH
              </label>
            </div>

            <div class="form-group form-col-2" style="margin-bottom:4px">
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;padding:8px 0 4px;border-top:1px solid var(--border)">Ind. 8 — Positionnement initial</div>
            </div>
            <div class="form-group">
              <label>Score test de positionnement</label>
              <input type="text" id="stf-poscore" class="form-input" value="${Utils.escapeHtml(s.positionScore||'')}" placeholder="Ex : 12/20 ou A2">
            </div>
            <div class="form-group">
              <label>Date du test</label>
              <input type="date" id="stf-podate" class="form-input" value="${s.positionDate||''}">
            </div>

            <div class="form-group form-col-2" style="margin-bottom:4px">
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;padding:8px 0 4px;border-top:1px solid var(--border)">Ind. 9 — Contrat pédagogique</div>
            </div>
            <div class="form-group">
              <label>Mode de financement</label>
              <select id="stf-financement" class="form-input">
                <option value="" ${!s.financementMode?'selected':''}>— Choisir —</option>
                <option value="personnel"    ${s.financementMode==='personnel'   ?'selected':''}>Personnel</option>
                <option value="cpf"          ${s.financementMode==='cpf'         ?'selected':''}>CPF</option>
                <option value="opco"         ${s.financementMode==='opco'        ?'selected':''}>OPCO / OPCA</option>
                <option value="pole_emploi"  ${s.financementMode==='pole_emploi' ?'selected':''}>France Travail</option>
                <option value="entreprise"   ${s.financementMode==='entreprise'  ?'selected':''}>Employeur</option>
                <option value="autre"        ${s.financementMode==='autre'       ?'selected':''}>Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label>Financeur / Employeur</label>
              <input type="text" id="stf-financeur" class="form-input" value="${Utils.escapeHtml(s.financeur||'')}" placeholder="Nom de l'organisme ou entreprise">
            </div>
            <div class="form-group">
              <label>Modalités</label>
              <select id="stf-modalite" class="form-input">
                <option value="" ${!s.modalite?'selected':''}>— Choisir —</option>
                <option value="presentiel" ${s.modalite==='presentiel'?'selected':''}>Présentiel</option>
                <option value="distanciel" ${s.modalite==='distanciel'?'selected':''}>Distanciel</option>
                <option value="hybride"    ${s.modalite==='hybride'   ?'selected':''}>Hybride</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date signature contrat</label>
              <input type="date" id="stf-contratdate" class="form-input" value="${s.contratDate||''}">
            </div>
            <div class="form-group form-col-2">
              <label>Objectifs pédagogiques</label>
              <textarea id="stf-objectifs" class="form-input form-textarea" rows="3" placeholder="Objectifs définis avec l'apprenant...">${Utils.escapeHtml(s.objectifsPeda||'')}</textarea>
            </div>

            <div class="form-group form-col-2" style="margin-bottom:4px">
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;padding:8px 0 4px;border-top:1px solid var(--border)">Ind. 11 — Évaluation finale</div>
            </div>
            <div class="form-group">
              <label>Objectifs atteints</label>
              <select id="stf-evalfinale" class="form-input">
                <option value="" ${!s.evalFinale?'selected':''}>— Non évalué —</option>
                <option value="oui"     ${s.evalFinale==='oui'    ?'selected':''}>Oui — atteints</option>
                <option value="partiel" ${s.evalFinale==='partiel'?'selected':''}>Partiellement</option>
                <option value="non"     ${s.evalFinale==='non'    ?'selected':''}>Non atteints</option>
              </select>
            </div>
            <div class="form-group">
              <label>Date attestation délivrée</label>
              <input type="date" id="stf-attestation" class="form-input" value="${s.attestationDate||''}">
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:22px">
              <label class="form-check" style="margin:0">
                <input type="checkbox" id="stf-pretexamen" ${s.pretExamen ? 'checked' : ''}>
                Prêt pour l'examen
              </label>
            </div>
            <div class="form-group form-col-2">
              <label>Observations finales</label>
              <textarea id="stf-obsfinales" class="form-input form-textarea" rows="2">${Utils.escapeHtml(s.obsFinales||'')}</textarea>
            </div>

            <div class="form-group form-col-2" style="margin-bottom:4px">
              <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.05em;padding:8px 0 4px;border-top:1px solid var(--border)">Ind. 7/30 — Satisfaction</div>
            </div>
            <div class="form-group">
              <label>Éval. à chaud — date envoi</label>
              <input type="date" id="stf-chauddate" class="form-input" value="${s.evalChaudDate||''}">
            </div>
            <div class="form-group">
              <label>Éval. à chaud — résultat</label>
              <input type="text" id="stf-chaudnote" class="form-input" value="${Utils.escapeHtml(s.evalChaudNote||'')}" placeholder="Ex : 4.2/5">
            </div>
            <div class="form-group">
              <label>Éval. à froid — date envoi</label>
              <input type="date" id="stf-froiddate" class="form-input" value="${s.evalFroidDate||''}">
            </div>
            <div class="form-group">
              <label>Éval. à froid — résultat</label>
              <input type="text" id="stf-froidnote" class="form-input" value="${Utils.escapeHtml(s.evalFroidNote||'')}" placeholder="Ex : 4.5/5">
            </div>

          </div>
        </div>

      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-student-btn">Supprimer</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn btn-primary" id="save-student-btn">${isNew ? 'Créer' : 'Enregistrer'}</button>
      </div>
    `);

    window._stTab = (tab) => {
      document.getElementById('stab-profil').style.display    = tab === 'profil'    ? '' : 'none';
      document.getElementById('stab-qualiopi').style.display  = tab === 'qualiopi'  ? '' : 'none';
      ['profil','qualiopi'].forEach(t => {
        const btn = document.getElementById('stab-btn-'+t);
        if (btn) {
          btn.style.borderBottomColor = t === tab ? 'var(--primary)' : 'transparent';
          btn.style.color = t === tab ? 'var(--primary)' : 'var(--text-muted)';
          btn.style.fontWeight = t === tab ? '600' : '400';
        }
      });
    };

    document.getElementById('save-student-btn').addEventListener('click', () => {
      const firstName = document.getElementById('stf-first').value.trim();
      const lastName  = document.getElementById('stf-last').value.trim();
      if (!firstName || !lastName) { Utils.toast('Le prénom et le nom sont obligatoires.', 'error'); return; }
      const formationIds = [...document.querySelectorAll('input[name="student-formation"]:checked')].map(i => i.value);
      Data.saveStudent({
        ...s,
        id: s.id || Utils.uuid(),
        firstName, lastName,
        email:     document.getElementById('stf-email').value.trim(),
        phone:     document.getElementById('stf-phone').value.trim(),
        poleId:    document.getElementById('stf-pole').value,
        companyId: document.getElementById('stf-pole').value,
        level:     document.getElementById('stf-level').value,
        status:    document.getElementById('stf-status').value,
        entryDate: document.getElementById('stf-entrydate').value,
        formationIds,
        notes:     document.getElementById('stf-notes').value.trim(),
        // Qualiopi
        projetPro:       document.getElementById('stf-projet').value.trim(),
        examenCible:     document.getElementById('stf-examen').value.trim(),
        rqth:            document.getElementById('stf-rqth').checked,
        positionScore:   document.getElementById('stf-poscore').value.trim(),
        positionDate:    document.getElementById('stf-podate').value,
        financementMode: document.getElementById('stf-financement').value,
        financeur:       document.getElementById('stf-financeur').value.trim(),
        modalite:        document.getElementById('stf-modalite').value,
        contratDate:     document.getElementById('stf-contratdate').value,
        objectifsPeda:   document.getElementById('stf-objectifs').value.trim(),
        evalFinale:      document.getElementById('stf-evalfinale').value,
        attestationDate: document.getElementById('stf-attestation').value,
        pretExamen:      document.getElementById('stf-pretexamen').checked,
        obsFinales:      document.getElementById('stf-obsfinales').value.trim(),
        evalChaudDate:   document.getElementById('stf-chauddate').value,
        evalChaudNote:   document.getElementById('stf-chaudnote').value.trim(),
        evalFroidDate:   document.getElementById('stf-froiddate').value,
        evalFroidNote:   document.getElementById('stf-froidnote').value.trim(),
      });
      Utils.toast(isNew ? 'Étudiant créé.' : 'Étudiant mis à jour.', 'success');
      this.close();
      if (typeof renderPage === 'function') renderPage();
    });

    const delBtn = document.getElementById('del-student-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        this.confirm('Supprimer cet étudiant définitivement ?', () => {
          Data.deleteStudent(s.id);
          Utils.toast('Étudiant supprimé.', 'success');
          this.close();
          if (typeof renderPage === 'function') renderPage();
        });
      });
    }
  },

  // ── Modale Formation ─────────────────────────────────────────

  openFormation(formationId = null) {
    const formation = formationId ? Data.getFormationById(formationId) : null;
    const isNew     = !formation;
    const companies = Data.getCompanies();
    const providers = Data.getProviders();
    const students  = Data.getStudents();

    const f = formation || {
      name: '', companyId: '', type: '', totalHours: 0,
      plannedHours: 0, completedHours: 0,
      providerIds: [], studentIds: [],
      startDate: '', endDate: '', status: 'planned', notes: ''
    };

    const coOptions = companies.map(c =>
      `<option value="${c.id}" ${f.companyId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
    ).join('');

    const provChks = providers.map(p =>
      `<label class="form-check">
        <input type="checkbox" name="form-provider" value="${p.id}" ${(f.providerIds || []).includes(p.id) ? 'checked' : ''}>
        ${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}
      </label>`
    ).join('');

    const stuChks = students.map(s =>
      `<label class="form-check">
        <input type="checkbox" name="form-student" value="${s.id}" ${(f.studentIds || []).includes(s.id) ? 'checked' : ''}>
        ${Utils.escapeHtml(s.lastName + ' ' + s.firstName)}
      </label>`
    ).join('');

    const statusOpts = Object.entries(Utils.FORMATION_STATUSES).map(([k, v]) =>
      `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v.label}</option>`
    ).join('');

    this._open(`
      <div class="modal-header">
        <h3>${isNew ? 'Nouvelle formation' : 'Modifier la formation'}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body modal-body-scroll">
        <div class="form-grid">
          <div class="form-group form-col-2">
            <label>Nom de la formation *</label>
            <input type="text" id="ff-name" class="form-input" value="${Utils.escapeHtml(f.name)}" placeholder="Ex: DIFE 2026 — Insertion professionnelle">
          </div>
          <div class="form-group">
            <label>Société *</label>
            <select id="ff-company" class="form-input">
              <option value="">— Choisir —</option>${coOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Type de formation</label>
            <input type="text" id="ff-type" class="form-input" value="${Utils.escapeHtml(f.type || '')}" placeholder="Ex: DIFE, certification, atelier...">
          </div>
          <div class="form-group">
            <label>Heures totales prévues</label>
            <input type="number" id="ff-total" class="form-input" value="${f.totalHours || 0}" min="0" step="0.5">
          </div>
          <div class="form-group">
            <label>Heures planifiées</label>
            <input type="number" id="ff-planned" class="form-input" value="${f.plannedHours || 0}" min="0" step="0.5">
          </div>
          <div class="form-group">
            <label>Heures réalisées</label>
            <input type="number" id="ff-done" class="form-input" value="${f.completedHours || 0}" min="0" step="0.5">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select id="ff-status" class="form-input">${statusOpts}</select>
          </div>
          <div class="form-group">
            <label>Date de début</label>
            <input type="date" id="ff-start" class="form-input" value="${f.startDate || ''}">
          </div>
          <div class="form-group">
            <label>Date de fin</label>
            <input type="date" id="ff-end" class="form-input" value="${f.endDate || ''}">
          </div>
          ${providers.length > 0 ? `
          <div class="form-group form-col-2">
            <label>Intervenants associés</label>
            <div class="form-checks">${provChks}</div>
          </div>` : ''}
          ${students.length > 0 ? `
          <div class="form-group form-col-2">
            <label>Étudiants associés</label>
            <div class="form-checks">${stuChks}</div>
          </div>` : ''}
          <div class="form-group form-col-2">
            <label>Notes</label>
            <textarea id="ff-notes" class="form-input form-textarea">${Utils.escapeHtml(f.notes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${!isNew ? `<button class="btn btn-ghost btn-danger-text" id="del-formation-btn">Supprimer</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Annuler</button>
        <button class="btn btn-primary" id="save-formation-btn">${isNew ? 'Créer' : 'Enregistrer'}</button>
      </div>
    `);

    document.getElementById('save-formation-btn').addEventListener('click', () => {
      const name = document.getElementById('ff-name').value.trim();
      if (!name) { Utils.toast('Le nom est obligatoire.', 'error'); return; }
      const providerIds = [...document.querySelectorAll('input[name="form-provider"]:checked')].map(i => i.value);
      const studentIds  = [...document.querySelectorAll('input[name="form-student"]:checked')].map(i => i.value);
      Data.saveFormation({
        id: f.id || Utils.uuid(),
        name,
        companyId:      document.getElementById('ff-company').value,
        type:           document.getElementById('ff-type').value.trim(),
        totalHours:     parseFloat(document.getElementById('ff-total').value) || 0,
        plannedHours:   parseFloat(document.getElementById('ff-planned').value) || 0,
        completedHours: parseFloat(document.getElementById('ff-done').value) || 0,
        status:         document.getElementById('ff-status').value,
        startDate:      document.getElementById('ff-start').value,
        endDate:        document.getElementById('ff-end').value,
        providerIds, studentIds,
        notes:          document.getElementById('ff-notes').value.trim()
      });
      Utils.toast(isNew ? 'Formation créée.' : 'Formation mise à jour.', 'success');
      this.close();
      if (typeof renderPage === 'function') renderPage();
    });

    const delBtn = document.getElementById('del-formation-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        this.confirm('Supprimer cette formation définitivement ?', () => {
          Data.deleteFormation(f.id);
          Utils.toast('Formation supprimée.', 'success');
          this.close();
          if (typeof renderPage === 'function') renderPage();
        });
      });
    }
  }
};
