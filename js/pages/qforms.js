// qforms.js — Formulaires Qualiopi remplissables et imprimables
'use strict';

// ── Helpers ──────────────────────────────────────────────────────
const _f   = (id,sv,ph='',t='text',big=false) => big
  ? `<textarea name="${id}" rows="3" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:6px;font-family:inherit;resize:vertical">${Utils.escapeHtml(sv[id]||'')}</textarea>`
  : `<input type="${t}" name="${id}" value="${Utils.escapeHtml(sv[id]||'')}" placeholder="${ph}" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:6px;font-size:0.87rem">`;
const _row = (l,inp) => `<div style="margin-bottom:10px"><label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:3px">${l}</label>${inp}</div>`;
const _sec = l => `<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);padding:10px 0 5px;border-top:1px solid var(--border);margin-top:4px">${l}</div>`;
const _chk = (id,sv,l) => `<label style="display:flex;align-items:center;gap:7px;margin-bottom:5px;cursor:pointer;font-size:0.85rem"><input type="checkbox" name="${id}" ${sv[id]?'checked':''} style="width:auto">${l}</label>`;
const _sel = (id,sv,opts) => `<select name="${id}" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:6px">
  <option value="">—</option>${opts.map(([v,l])=>`<option value="${v}" ${sv[id]===v?'selected':''}>${l}</option>`).join('')}
</select>`;
const _hdr = (t,sub) => `<div style="text-align:center;padding-bottom:12px;border-bottom:2px solid var(--border);margin-bottom:16px">
  <div style="font-weight:700;font-size:1rem">${t}</div>${sub?`<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">${sub}</div>`:''}
</div>`;
const _g2 = (...i) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${i.join('')}</div>`;
const _g3 = (...i) => `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">${i.join('')}</div>`;

// ── Print CSS ────────────────────────────────────────────────────
const PRINT_CSS = `*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11pt;margin:15mm;color:#222}
  label.lbl{font-size:9pt;font-weight:700;text-transform:uppercase;color:#666;display:block;margin-bottom:2px}
  input,textarea,select{border:none;border-bottom:1px solid #aaa;background:none;width:100%;font-size:11pt;font-family:inherit;padding:2px 0;outline:none;margin-bottom:6px}
  textarea{border:1px solid #aaa;padding:4px;min-height:40px;resize:none}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
  .mb{margin-bottom:10px} .sec{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#555;padding:8px 0 4px;border-top:1px solid #ccc;margin-top:4px}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 6px;font-size:10pt}th{background:#f0f0f0;font-size:9pt}
  .hdr{text-align:center;padding-bottom:10px;border-bottom:2px solid #333;margin-bottom:14px}
  @media print{button{display:none!important}}`;

// ── QForms ───────────────────────────────────────────────────────
window.QForms = {
  _ctx(sid) {
    const s = Data.getStudentById(sid); if (!s) return null;
    const co = Data.getCompanyById(s.poleId||s.companyId);
    const fors = {}; Data.getFormations().forEach(f=>fors[f.id]=f);
    const fn = (s.formationIds||[]).map(id=>fors[id]?.name||'').filter(Boolean).join(', ');
    // Nom du responsable et de l'organisme depuis les paramètres/données
    const settings = Data.getSettings();
    const orgName  = co?.name || '';
    const respName = settings.responsableName || '';
    return {s, co, fn, orgName, respName};
  },

  open(sid, key) {
    const ctx = this._ctx(sid); if (!ctx) return;
    const def = this.FORMS[key];
    if (!def) { Utils.toast("Formulaire non disponible pour ce document.",'info'); return; }
    const sv = (ctx.s.qForms||{})[key]||{};
    Modals._open(`
      <div class="modal-header">
        <h3 style="font-size:0.9rem">${def.title}</h3>
        <button class="modal-close" onclick="Modals.close()">✕</button>
      </div>
      <div class="modal-body modal-body-scroll" id="qfc">${def.html(ctx.s, sv, ctx.co, ctx.fn, ctx.orgName, ctx.respName)}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="QForms.print('${sid}','${key}')">🖨 Imprimer</button>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modals.close()">Fermer</button>
        <button class="btn btn-primary" onclick="QForms.save('${sid}','${key}')">💾 Enregistrer</button>
      </div>`);
  },

  save(sid, key) {
    const s = Data.getStudentById(sid); if (!s) return;
    const data = {};
    document.querySelectorAll('#qfc [name]').forEach(el => {
      if (el.type==='checkbox') data[el.name]=el.checked;
      else if (el.type==='radio') { if (el.checked) data[el.name]=el.value; }
      else data[el.name]=el.value;
    });
    Data.saveStudent({...s, qForms:{...(s.qForms||{}), [key]:data}});
    Utils.toast('Formulaire enregistré.','success');
    Modals.close();
    if (typeof renderPage==='function') renderPage();
  },

  print(sid, key) {
    const ctx = this._ctx(sid); if (!ctx) return;
    const def = this.FORMS[key]; if (!def) return;
    const data = {};
    document.querySelectorAll('#qfc [name]').forEach(el => {
      if (el.type==='checkbox') data[el.name]=el.checked;
      else if (el.type==='radio') { if (el.checked) data[el.name]=el.value; }
      else data[el.name]=el.value;
    });
    const w = window.open('','_blank','width=820,height=960');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${def.title}</title>
      <style>${PRINT_CSS}</style></head><body>
      ${def.html(ctx.s, data, ctx.co, ctx.fn, ctx.orgName, ctx.respName)}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`);
    w.document.close();
  },

  FORMS: {}
};

// ════════════════════════════════════════════════════════════════
// FORMULAIRES
// ════════════════════════════════════════════════════════════════

// ── Fiche d'analyse du besoin (Ind. 4) ──────────────────────────
QForms.FORMS.fiche_rens = {
  title: "Fiche d'analyse du besoin — Ind. 4 · ART-FAB-001",
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr(`${orgName||'Artémis Prépa'} — FICHE D'ANALYSE DU BESOIN`,"Indicateur 4 Qualiopi · Réf. ART-FAB-001 · À compléter avant toute inscription")}
    ${_g2(_row('N° dossier',_f('num_dossier',sv,'ART-2025-XXX')), _row('Date',_f('date',sv,'','date')))}
    ${_sec('A — Identification du bénéficiaire')}
    ${_g2(_row('Nom',_f('nom',sv,s.lastName)), _row('Prénom',_f('prenom',sv,s.firstName)),
      _row('Email',_f('email',sv,s.email||'','email')), _row('Téléphone',_f('tel',sv,s.phone||'')),
      _row('Situation actuelle',_f('situation',sv,'')), _row('Employeur / établissement',_f('employeur',sv,'')),
      _row('Mode de financement',_f('financement',sv,s.financementMode||'')), _row('Organisme financeur',_f('financeur',sv,s.financeur||'')))}
    ${_sec('B — Projet et objectif professionnel')}
    ${_g2(_row('Formation / concours visé(e)',_f('concours',sv,s.examenCible||fn)),
      _row('Objectif professionnel',_f('objectif',sv,s.projetPro||'')),
      _row('Date du concours / examen',_f('date_concours',sv,'','date')),
      _row('Session',_f('session',sv,'printemps / automne')))}
    ${_sec('C — Niveau actuel et acquis préalables')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px">
      ${['Bac','Bac +2','Bac +3 (Licence)','Bac +4 ou + (Master)','Jamais présenté ce concours','Déjà présenté'].map((l,i)=>_chk('niv_'+i,sv,l)).join('')}
    </div>
    ${_row("Résultat / point d'arrêt",_f('resultat',sv,''))}
    ${_sec('D — Besoins spécifiques')}
    ${['Situation de handicap ou RQTH','Contrainte emploi du temps (travail, famille)','Formation exclusivement à distance souhaitée','Suivi individuel renforcé souhaité'].map((l,i)=>_chk('besoin_'+i,sv,l)).join('')}
    ${_row('Précisions',_f('besoin_precision',sv,'',undefined,true))}
    ${_sec('E — Attentes vis-à-vis de la formation')}
    ${_row('Qu\'attendez-vous de cette formation ?',_f('attentes',sv,'',undefined,true))}
    ${_row('Matières / épreuves à travailler en priorité',_f('matieres_prio',sv,'',undefined,true))}
    ${_sec(`F — Décision ${orgName||'Artémis Prépa'} (responsable pédagogique)`)}
    ${_g2(
      _row('Décision',_sel('decision',sv,[['standard','Retenu — formation standard'],['adapte','Retenu — programme adapté'],['orientation','Orientation vers autre OF'],['report','Report — niveau insuffisant']])),
      _row('Test de positionnement',_sel('test_pos',sv,[['realise','Réalisé'],['non','Non réalisé']])),
      _row('Score / Profil',_f('score',sv,'___ / 30   Profil : ___')),
      _row('Adaptations prévues',_f('adaptations',sv,'')))}
    ${_g2(_row('Date et signature bénéficiaire',_f('sig_benef',sv,'')), _row('Date et signature responsable',_f('sig_resp',sv,respName||'Camille Chapuis')))}`;
  }
};

// ── Contrat pédagogique ──────────────────────────────────────────
QForms.FORMS.contrat = {
  title: 'Contrat pédagogique étudiant',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr('📘 CONTRAT PÉDAGOGIQUE')}
    ${_sec('1 — Identité du bénéficiaire')}
    ${_g2(_row('Nom et prénom',_f('nom_prenom',sv,s.firstName+' '+s.lastName)),
      _row('Téléphone / mail',_f('contact',sv,(s.phone||'')+(s.email?' — '+s.email:''))),
      _row('Adresse',_f('adresse',sv,'')),
      _row('Profession / situation actuelle',_f('profession',sv,'')),
      _row('Organisme financeur',_f('financeur',sv,s.financeur||'')))}
    ${_sec('2 — Objectifs de la formation')}
    ${['Expression orale (aisance, fluidité)','Compréhension orale','Lexique professionnel spécifique',
      'Préparation certification (TOEIC, IELTS…)','Renforcement grammaire / syntaxe',
      'Préparation séjour / entretien d\'embauche'].map((l,i)=>_chk('obj_'+i,sv,l)).join('')}
    ${_row('Autre objectif',_f('obj_autre',sv,''))}
    ${_sec('3 — Positionnement initial')}
    ${['Test de positionnement écrit','Entretien oral avec le formateur','Questionnaire d\'auto-évaluation','Analyse des besoins'].map((l,i)=>_chk('pos_'+i,sv,l)).join('')}
    ${_row('Niveau estimé à l\'entrée (CECRL)',_f('niveau_entree',sv,s.positionScore||'A1 / A2 / B1…'))}
    ${_sec('4 — Organisation de la formation')}
    ${_g3(_row('Durée totale (heures)',_f('duree',sv,'')), _row('Du',_f('date_debut',sv,s.entryDate||'','date')), _row('Au',_f('date_fin',sv,'','date')),
      _row('Fréquence',_f('frequence',sv,'X séances / semaine')), _row('Durée séance',_f('duree_seance',sv,'60 min')),
      _row('Modalité',_sel('modalite',sv,[['presentiel','Présentiel'],['distanciel','Distanciel (visio)'],['mixte','Mixte']])))}
    ${_row('Niveau visé en fin de formation',_f('niveau_vise',sv,''))}
    ${_sec('5 — Modalités d\'évaluation')}
    ${['QCM','Entretien oral enregistré','Production écrite'].map((l,i)=>_chk('eval_'+i,sv,l)).join('')}
    ${_row('Autre',_f('eval_autre',sv,''))}
    ${_sec('6 — Engagements')}
    ${_row('Commentaires / adaptations prévues',_f('engagements',sv,'',undefined,true))}
    ${_g2(_row('Date et signature bénéficiaire',_f('sig_benef',sv,'')), _row('Date et signature responsable',_f('sig_resp',sv,`${respName||'Camille Chapuis'} — ${orgName||'Artémis Prépa'}`)))}`;
  }
};

// ── Positionnement ───────────────────────────────────────────────
QForms.FORMS.positionnement = {
  title: 'Fiche de positionnement — Ind. 8',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr('FICHE DE POSITIONNEMENT','Indicateur 8 Qualiopi — À réaliser avant la formation')}
    ${_g2(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Date du test',_f('date_test',sv,s.positionDate||'','date')),
      _row('Formation visée',_f('formation',sv,fn)), _row('Formateur évaluateur',_f('formateur',sv,respName||'Camille Chapuis')))}
    ${_sec('Résultats du test')}
    ${_g2(_row('Score obtenu',_f('score',sv,s.positionScore||'___ / 30')),
      _row('Profil',_sel('profil',sv,[['debutant','Débutant'],['intermediaire','Intermédiaire'],['avance','Avancé'],['expert','Expert']])))}
    ${_row('Compétences évaluées',_f('competences',sv,'',undefined,true))}
    ${_row('Points forts identifiés',_f('points_forts',sv,'',undefined,true))}
    ${_row('Lacunes / axes de travail prioritaires',_f('lacunes',sv,'',undefined,true))}
    ${_sec('Préconisations pédagogiques')}
    ${_row('Programme recommandé',_f('programme_reco',sv,'',undefined,true))}
    ${_row('Adaptations spécifiques',_f('adaptations',sv,'',undefined,true))}
    ${_g2(_row('Date et signature stagiaire',_f('sig_stag',sv,'')), _row('Date et signature responsable',_f('sig_resp',sv,respName||'Camille Chapuis')))}`;
  }
};

// ── Programme de formation ───────────────────────────────────────
QForms.FORMS.programme = {
  title: 'Programme de formation',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr('PROGRAMME DE FORMATION',orgName||'Artémis Prépa')}
    ${_g2(_row('Intitulé',_f('intitule',sv,fn)), _row('Référence',_f('reference',sv,'')),
      _row('Public visé',_f('public',sv,s.firstName+' '+s.lastName)), _row('Durée totale',_f('duree',sv,'')))}
    ${_sec('Objectifs pédagogiques')}
    ${_row('Objectifs généraux',_f('objectifs_gen',sv,'',undefined,true))}
    ${_row('Objectifs opérationnels',_f('objectifs_op',sv,'',undefined,true))}
    ${_sec('Contenu détaillé')}
    ${_row('Module 1',_f('mod1',sv,'',undefined,true))}
    ${_row('Module 2',_f('mod2',sv,'',undefined,true))}
    ${_row('Module 3',_f('mod3',sv,'',undefined,true))}
    ${_sec('Modalités')}
    ${_g3(_row('Modalité',_sel('modalite',sv,[['presentiel','Présentiel'],['distanciel','Distanciel'],['mixte','Mixte']])),
      _row('Méthodes pédagogiques',_f('methodes',sv,'exposé, exercices, cas pratiques')),
      _row('Outils / supports',_f('supports',sv,'')))}
    ${_row('Modalités d\'évaluation',_f('evaluation',sv,'',undefined,true))}`;
  }
};

// ── Devis ────────────────────────────────────────────────────────
QForms.FORMS.devis = {
  title: 'Devis — Artémis Prépa',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr('DEVIS',`${orgName||'Artémis Prépa'} — Organisme de formation`)}
    ${_g2(_row('Destinataire',_f('destinataire',sv,s.firstName+' '+s.lastName)),
      _row('Date du devis',_f('date_devis',sv,'','date')),
      _row('Référence devis',_f('ref_devis',sv,'')),
      _row('Validité',_f('validite',sv,'30 jours')))}
    ${_sec('Prestation')}
    ${_row('Formation',_f('formation',sv,fn))}
    ${_g3(_row('Nombre d\'heures',_f('nb_heures',sv,'')),
      _row('Tarif horaire (€)',_f('tarif_h',sv,'')),
      _row('Montant total HT (€)',_f('montant_ht',sv,'')))}
    ${_row('TVA applicable',_sel('tva',sv,[['exonere','Exonéré (article 261-4-4a CGI)'],['20','TVA 20%']]))}
    ${_row('Montant total TTC (€)',_f('montant_ttc',sv,''))}
    ${_sec('Modalités de règlement')}
    ${_g2(_row('Mode de paiement',_sel('paiement',sv,[['virement','Virement bancaire'],['cheque','Chèque'],['opco','OPCO / CPF'],['autre','Autre']])),
      _row('Échéance',_f('echeance',sv,'')))}
    ${_row('Conditions particulières',_f('conditions',sv,'',undefined,true))}
    ${_g2(_row('Date et signature client',_f('sig_client',sv,'')), _row('Signature Artémis Prépa',_f('sig_artemis',sv,respName||'Camille Chapuis')))}`;
  }
};

// ── Règlement intérieur ──────────────────────────────────────────
QForms.FORMS.reglement = {
  title: 'Règlement intérieur — Transmission',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr('RÈGLEMENT INTÉRIEUR — ACCUSÉ DE RÉCEPTION',orgName||'Artémis Prépa')}
    ${_g2(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Formation',_f('formation',sv,fn)))}
    ${_sec('Transmission')}
    ${_g2(_row('Date d\'envoi',_f('date_envoi',sv,'','date')),
      _row('Mode d\'envoi',_sel('mode_envoi',sv,[['email','Email'],['remise','Remise en main propre'],['courrier','Courrier']])))}
    ${_row('Règlement intérieur version',_f('version',sv,'V2024'))}
    ${_sec('Réception et validation')}
    ${_g2(_row('Date de réception / signature',_f('date_reception',sv,'','date')),
      _row('Document signé retourné',_sel('signe',sv,[['oui','Oui'],['non','Non — en attente']])))}
    ${_row('Observations',_f('observations',sv,'',undefined,true))}
    ${_g2(_row('Signature du stagiaire',_f('sig_stag',sv,'Lu et approuvé')), _row('Signature responsable',_f('sig_resp',sv,respName||'Camille Chapuis')))}`;
  }
};

// ── Livret d'accueil ─────────────────────────────────────────────
QForms.FORMS.livret = {
  title: "Livret d'accueil — Transmission",
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr("LIVRET D'ACCUEIL — ACCUSÉ DE RÉCEPTION",orgName||'Artémis Prépa')}
    ${_g2(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Formation',_f('formation',sv,fn)))}
    ${_sec('Contenu du livret transmis')}
    ${['Présentation de l\'organisme','Programme de la formation','Modalités pédagogiques',
      'Informations pratiques (horaires, accès)','Contacts et référents',
      'Procédure de réclamation','Accessibilité PSH'].map((l,i)=>_chk('item_'+i,sv,l)).join('')}
    ${_sec('Transmission')}
    ${_g2(_row('Date d\'envoi',_f('date_envoi',sv,'','date')),
      _row('Mode d\'envoi',_sel('mode_envoi',sv,[['email','Email'],['remise','Remise en main propre'],['lien','Lien en ligne']])))}
    ${_g2(_row('Date accusé de réception',_f('date_accuse',sv,'','date')),
      _row('Accusé reçu',_sel('accuse',sv,[['oui','Oui'],['non','Non — en attente']])))}
    ${_row('Observations',_f('observations',sv,'',undefined,true))}
    ${_g2(_row('Signature du stagiaire',_f('sig_stag',sv,'Lu et approuvé')), _row('Signature responsable',_f('sig_resp',sv,respName||'Camille Chapuis')))}`;
  }
};

// ── Planning ─────────────────────────────────────────────────────
QForms.FORMS.planning = {
  title: 'Planning de formation',
  html(s, sv, co, fn, orgName = '', respName = '') {
    const allM = Data.getMissions().filter(m=>(m.studentIds||[]).includes(s.id)&&m.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date));
    const subjects = {}; (Data.getSubjects()||[]).forEach(x=>subjects[x.id]=x);
    const providers = {}; Data.getProviders().forEach(p=>providers[p.id]=p);
    const rows = allM.map((m,i)=>{
      const p=providers[m.providerId]; const subj=m.subjectId?(subjects[m.subjectId]?.name||m.subject||''):(m.subject||'');
      return `<tr><td>${i+1}</td><td>${m.date||''}</td><td>${m.startTime||''} – ${m.endTime||''}</td>
        <td>${Utils.escapeHtml(subj)}</td><td>${p?Utils.escapeHtml(p.firstName+' '+p.lastName):''}</td>
        <td>${m.duration||0}h</td><td>${m.location||''}</td></tr>`;
    }).join('');
    return `
    ${_hdr('PLANNING DE FORMATION',orgName||'Artémis Prépa')}
    ${_g2(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Formation',_f('formation',sv,fn)),
      _row('Du',_f('date_debut',sv,s.entryDate||'','date')), _row('Au',_f('date_fin',sv,'','date')))}
    ${allM.length>0?`
    <table style="margin-top:12px;font-size:0.82rem">
      <thead><tr><th>#</th><th>Date</th><th>Horaires</th><th>Matière</th><th>Intervenant</th><th>Durée</th><th>Lieu</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">Total</td>
        <td style="font-weight:700">${Utils.formatDuration(allM.reduce((a,m)=>a+(m.duration||0),0))}</td><td></td></tr></tfoot>
    </table>`:_row('Séances (aucune encore planifiée)',_f('planning_libre',sv,'',undefined,true))}
    ${_row('Observations',_f('observations',sv,'',undefined,true))}`;
  }
};

// ── Feuille d'émargement (Ind. 12) ──────────────────────────────
QForms.FORMS.emargement = {
  title: "Feuille d'émargement — Ind. 12 · ART-EMG-001",
  html(s, sv, co, fn, orgName = '', respName = '') {
    const allM = Data.getMissions().filter(m=>(m.studentIds||[]).includes(s.id)&&m.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date));
    const N = Math.max(allM.length, 8);
    const rows = Array.from({length:N},(_,i)=>`<tr>
      <td style="text-align:center;font-weight:600">S${String(i+1).padStart(2,'0')}</td>
      <td><input name="em_date_${i}" type="date" value="${sv['em_date_'+i]||(allM[i]?.date||'')}" style="border:none;width:100%"></td>
      <td><select name="em_pres_${i}" style="border:none;font-size:0.82rem">
        <option value="">—</option>
        <option value="P" ${sv['em_pres_'+i]==='P'?'selected':''}>Présent</option>
        <option value="A" ${sv['em_pres_'+i]==='A'?'selected':''}>Absent</option>
        <option value="R" ${sv['em_pres_'+i]==='R'?'selected':''}>Retard</option>
      </select></td>
      <td><input name="em_sig_m_${i}" type="text" value="${sv['em_sig_m_'+i]||''}" placeholder="Matin" style="border:none;width:80px"></td>
      <td><input name="em_sig_a_${i}" type="text" value="${sv['em_sig_a_'+i]||''}" placeholder="A-M" style="border:none;width:80px"></td>
      <td><input name="em_abs_${i}" type="text" value="${sv['em_abs_'+i]||''}" placeholder="Motif" style="border:none;width:100%"></td>
    </tr>`).join('');
    return `
    ${_hdr(`${orgName||'Artémis Prépa'} — FEUILLE D'ÉMARGEMENT`,"Indicateur 12 Qualiopi · Réf. ART-EMG-001 · Document obligatoire par séance")}
    ${_g3(_row('Formation',_f('formation',sv,fn)), _row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Formateur',_f('formateur',sv,respName||'Camille Chapuis')))}
    <table style="margin-top:12px;font-size:0.82rem">
      <thead><tr>
        <th style="width:50px">N°</th><th>Date</th><th>Présence</th>
        <th>Sig. Matin</th><th>Sig. A-M</th><th>Absence / Motif</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${_g2(_row('Signature du formateur',_f('sig_form',sv,respName||'Camille Chapuis')), _row('Date',_f('sig_date',sv,'','date')))}`;
  }
};

// ── Fiche de suivi individuel (Ind. 10) ──────────────────────────
QForms.FORMS.evaluation = {
  title: 'Fiche de suivi individuel — Ind. 10 · ART-FSI-001',
  html(s, sv, co, fn, orgName = '', respName = '') {
    const allM = Data.getMissions().filter(m=>(m.studentIds||[]).includes(s.id)&&m.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date));
    const N = Math.max(allM.length, 8);
    const seances = Array.from({length:N},(_,i)=>`<tr>
      <td style="text-align:center;font-weight:600">S${String(i+1).padStart(2,'0')}</td>
      <td><input name="s_date_${i}" type="date" value="${sv['s_date_'+i]||(allM[i]?.date||'')}" style="border:none;width:100%"></td>
      <td><select name="s_pres_${i}" style="border:none;font-size:0.82rem">
        <option value="">—</option>
        <option value="P" ${sv['s_pres_'+i]==='P'?'selected':''}>Présent</option>
        <option value="A" ${sv['s_pres_'+i]==='A'?'selected':''}>Absent</option>
        <option value="R" ${sv['s_pres_'+i]==='R'?'selected':''}>Retard</option>
      </select></td>
      <td><input name="s_note_${i}" type="text" value="${sv['s_note_'+i]||''}" placeholder="/20" style="border:none;width:55px"></td>
      <td><input name="s_obs_${i}" type="text" value="${sv['s_obs_'+i]||''}" placeholder="Observations / adaptations…" style="border:none;width:100%"></td>
    </tr>`).join('');
    return `
    ${_hdr(`${orgName||'Artémis Prépa'} — FICHE DE SUIVI INDIVIDUEL STAGIAIRE`,"Indicateur 10 Qualiopi · SUPER INDICATEUR · Réf. ART-FSI-001")}
    ${_g3(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Formation',_f('formation',sv,fn)), _row('Session / dates',_f('session',sv,'')))}
    ${_row('Profil positionnement initial',_sel('profil',sv,[['debutant','Débutant'],['intermediaire','Intermédiaire'],['avance','Avancé'],['expert','Expert']]))}
    ${_sec('Partie 1 — Suivi séance par séance')}
    <table style="font-size:0.82rem">
      <thead><tr><th>N°</th><th>Date</th><th>Présence</th><th>Note /20</th><th>Observations / adaptations réalisées</th></tr></thead>
      <tbody>${seances}</tbody>
    </table>
    ${_sec("Partie 2 — Points d'étape")}
    ${_row('Constat / difficulté mi-parcours',_f('bilan_mi',sv,'',undefined,true))}
    ${_row('Adaptation mise en place',_f('adaptation_mi',sv,'',undefined,true))}
    ${_sec('Partie 3 — Synthèse finale')}
    ${_g3(_row("Taux d'assiduité",_f('taux',sv,'___ %')), _row('Moyenne générale',_f('moyenne',sv,'___ /20')),
      _row('Objectifs atteints',_sel('objectifs',sv,[['oui','Oui — totalité'],['partiel','Partiellement'],['non','Non']])),
      _row('Recommandation concours',_sel('recommandation',sv,[['pret','Prêt'],['conseille','Présentation conseillée'],['renforcement','Renforcement suggéré']])),
      _row('Attestation délivrée',_sel('attestation_del',sv,[['oui','Oui (ART-ATT-001)'],['non','Non']])))}
    ${_g2(_row('Signature du stagiaire',_f('sig_stag',sv,'Lu et approuvé')), _row('Signature responsable',_f('sig_resp',sv,`${respName||'Camille Chapuis'} — ${orgName||'Artémis Prépa'}`)))}`;
  }
};

// ── Attestation de fin de formation (Ind. 11) ────────────────────
QForms.FORMS.attestation = {
  title: 'Attestation de fin de formation — Ind. 11 · ART-ATT-001',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr(`${orgName||'Artémis Prépa'}`,'Organisme de formation professionnelle · Réf. ART-ATT-001')}
    <div style="text-align:center;font-weight:700;font-size:1rem;margin-bottom:4px">ATTESTATION DE SUIVI DE FORMATION</div>
    <div style="text-align:center;font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">délivrée conformément à l'article L. 6353-1 du Code du travail</div>
    ${_g2(_row('Madame / Monsieur',_f('benef_nom',sv,s.firstName+' '+s.lastName)), _row('Né(e) le',_f('benef_naissance',sv,'','date')))}
    ${_sec('Formation')}
    ${_g2(_row('Intitulé de la formation',_f('intitule',sv,fn)), _row('Référence programme',_f('ref_prog',sv,'')),
      _row('Durée totale',_f('duree',sv,'')), _row('Modalité',_sel('modalite',sv,[['Présentiel','Présentiel'],['Distanciel','Distanciel'],['Mixte','Mixte']])),
      _row('Du',_f('date_debut',sv,s.entryDate||'','date')), _row('Au',_f('date_fin',sv,'','date')),
      _row('Lieu / plateforme',_f('lieu',sv,'')))}
    ${_sec('Résultats et atteinte des objectifs')}
    ${_g3(_row("Taux d'assiduité",_f('taux',sv,'___ %')), _row('Moyenne générale (devoirs)',_f('moyenne',sv,'___ /20')),
      _row('Objectifs pédagogiques',_sel('objectifs',sv,[['Atteints','Atteints'],['Partiellement','Partiellement atteints'],['Non atteints','Non atteints']])),
      _row('Niveau de préparation',_sel('preparation',sv,[['Prêt','Prêt'],['Conseillé','Présentation conseillée'],['Renforcement suggéré','Renforcement suggéré']])))}
    ${_row('Commentaire général du formateur',_f('commentaire',sv,'',undefined,true))}
    ${_g3(_row('Fait à',_f('fait_a',sv,'Paris')), _row('Le',_f('fait_le',sv,'','date')), _row('Signature et cachet',_f('sig_resp',sv,respName||'Camille Chapuis')))}
    <div style="margin-top:16px;padding:12px;border:1px solid var(--border);border-radius:8px;font-size:0.82rem">
      <strong>Accusé de réception stagiaire :</strong> Je reconnais avoir reçu la présente attestation.<br>
      ${_g3(_row('Nom',_f('rec_nom',sv,s.firstName+' '+s.lastName)), _row('Date',_f('rec_date',sv,'','date')), _row('Signature',_f('rec_sig',sv,'')))}
    </div>`;
  }
};

// ── Bilan ────────────────────────────────────────────────────────
QForms.FORMS.bilan = {
  title: 'Bilan de fin de formation',
  html(s, sv, co, fn, orgName = '', respName = '') {
    return `
    ${_hdr('BILAN DE FIN DE FORMATION',orgName||'Artémis Prépa')}
    ${_g2(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Formation',_f('formation',sv,fn)),
      _row('Date de fin',_f('date_fin',sv,'','date')), _row('Responsable pédagogique',_f('responsable',sv,respName||'Camille Chapuis')))}
    ${_sec('Bilan pédagogique')}
    ${_row('Compétences acquises',_f('acquis',sv,'',undefined,true))}
    ${_row('Compétences partiellement acquises',_f('partiel',sv,'',undefined,true))}
    ${_row('Points à consolider',_f('consolider',sv,'',undefined,true))}
    ${_sec('Perspectives')}
    ${_row('Recommandations pour la suite',_f('recommandations',sv,'',undefined,true))}
    ${_row('Orientations suggérées',_f('orientations',sv,'',undefined,true))}
    ${_sec('Observations générales')}
    ${_row('Implication / motivation',_f('implication',sv,'',undefined,true))}
    ${_row('Commentaires libres',_f('commentaires',sv,'',undefined,true))}
    ${_g2(_row('Date et signature stagiaire',_f('sig_stag',sv,'')), _row('Date et signature responsable',_f('sig_resp',sv,respName||'Camille Chapuis')))}`;
  }
};

// ── Évaluation à chaud (Ind. 2) ──────────────────────────────────
QForms.FORMS.satisfaction = {
  title: 'Évaluation à chaud — Artémis Prépa',
  html(s, sv, co, fn, orgName = '', respName = '') {
    const rtg = (id,label) => `<tr>
      <td style="font-size:0.83rem;padding:5px 8px">${label}</td>
      ${[1,2,3,4,5].map(n=>`<td style="text-align:center;padding:4px">
        <input type="radio" name="${id}" value="${n}" ${String(sv[id])===String(n)?'checked':''}></td>`).join('')}
    </tr>`;
    const tblH = `<thead><tr><th style="text-align:left;padding:4px">Question</th>
      ${['1 — Pas du tout','2','3 — Moy.','4','5 — Tout à fait'].map(h=>`<th style="width:70px;text-align:center;font-size:0.75rem">${h}</th>`).join('')}
    </tr></thead>`;
    return `
    ${_hdr(`${orgName||'Artémis Prépa'} — ÉVALUATION DE LA FORMATION`,"À compléter le dernier jour · Évaluation à chaud")}
    ${_g2(_row('Intitulé de la formation',_f('intitule',sv,fn)), _row('Date(s)',_f('dates',sv,'','date')),
      _row('Formateur',_f('formateur',sv,respName||'Camille Chapuis')), _row('Stagiaire (optionnel)',_f('stagiaire',sv,'')))}
    ${_sec('A — Contenu pédagogique')}
    <table>${tblH}<tbody>
      ${rtg('a1','Le contenu correspondait à mes attentes initiales')}
      ${rtg('a2','Les objectifs annoncés ont été atteints')}
      ${rtg('a3','Le niveau était adapté à mon profil')}
      ${rtg('a4','Les exercices illustraient bien les notions')}
      ${rtg('a5','La progression pédagogique était claire et logique')}
    </tbody></table>
    ${_sec('B — Méthodes et supports')}
    <table>${tblH}<tbody>
      ${rtg('b1','Les méthodes facilitaient l\'apprentissage')}
      ${rtg('b2','Les supports (fiches, documents) étaient utiles et clairs')}
      ${rtg('b3','Les outils (visio, plateforme) fonctionnaient bien')}
      ${rtg('b4','Les exercices et mises en pratique étaient adaptés')}
    </tbody></table>
    ${_sec('C — Formateur')}
    <table>${tblH}<tbody>
      ${rtg('c1','Le formateur maîtrisait bien son sujet')}
      ${rtg('c2','Expression claire et rythme adapté')}
      ${rtg('c3','Disponible pour répondre aux questions')}
      ${rtg('c4','A favorisé la participation et les échanges')}
    </tbody></table>
    ${_sec('D — Organisation')}
    <table>${tblH}<tbody>
      ${rtg('d1','Horaires et durée adaptés')}
      ${rtg('d2','Environnement de formation satisfaisant')}
      ${rtg('d3','Informations préalables suffisantes')}
    </tbody></table>
    ${_sec('E — Satisfaction globale')}
    <table>${tblH}<tbody>
      ${rtg('e1','Globalement satisfait(e) de cette formation')}
      ${rtg('e2','Je recommanderais Artémis Prépa')}
    </tbody></table>
    ${_sec('F — Questions ouvertes')}
    ${_row('Ce que vous avez le plus apprécié',_f('q_plus',sv,'',undefined,true))}
    ${_row('Points à améliorer',_f('q_amelio',sv,'',undefined,true))}
    ${_row('Suggestions / commentaires libres',_f('q_libre',sv,'',undefined,true))}
    ${_sec('G — Accessibilité PSH')}
    ${_g2(_row('Aménagements PSH bénéficiés',_sel('psh',sv,[['oui','Oui'],['non','Non']])),
      _row('Si oui, adaptés à vos besoins',_sel('psh_adapte',sv,[['oui','Oui'],['non','Non']])))}`;
  }
};

// ── Justificatifs complémentaires ────────────────────────────────
QForms.FORMS.justificatifs = {
  title: 'Justificatifs complémentaires',
  html(s, sv, co, fn, orgName = '', respName = '') {
    const items = ['Pièce d\'identité','Diplôme(s)','CV','Lettre de motivation','Attestation employeur',
      'Notification RQTH','Attestation financement','Autre document 1','Autre document 2'];
    return `
    ${_hdr('LISTE DES JUSTIFICATIFS COMPLÉMENTAIRES',orgName||'Artémis Prépa')}
    ${_g2(_row('Stagiaire',_f('stagiaire',sv,s.firstName+' '+s.lastName)), _row('Date',_f('date',sv,'','date')))}
    ${_sec('Documents reçus')}
    <table style="margin-top:8px;font-size:0.85rem">
      <thead><tr><th>Document</th><th style="width:120px">Reçu le</th><th style="width:80px">Validé</th></tr></thead>
      <tbody>${items.map((l,i)=>`<tr>
        <td>${i<7?l:`<input name="just_label_${i}" value="${sv['just_label_'+i]||l}" style="border:none;width:100%">`}</td>
        <td><input name="just_date_${i}" type="date" value="${sv['just_date_'+i]||''}" style="border:none;width:100%"></td>
        <td style="text-align:center"><input type="checkbox" name="just_ok_${i}" ${sv['just_ok_'+i]?'checked':''}></td>
      </tr>`).join('')}</tbody>
    </table>
    ${_row('Observations',_f('observations',sv,'',undefined,true))}
    ${_g2(_row('Signature responsable',_f('sig_resp',sv,respName||'Camille Chapuis')), _row('Date',_f('sig_date',sv,'','date')))}`;
  }
};
