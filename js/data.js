// ============================================================
// data.js — Couche de données v3 : multi-sociétés, missions,
//           prestataires centraux, étudiants, formations
// ============================================================

const DB_KEY = 'emploi_du_temps_db';

// ── Firebase Realtime Database (sync multi-appareils) ──────────
const _FB_URL = 'https://emploi-du-temps-97818-default-rtdb.europe-west1.firebasedatabase.app/db.json';
let _fbLastTs   = 0;   // timestamp de la dernière donnée connue
let _fbWriting  = false; // on est en train d'écrire → ignorer le poll
let _fbPending  = false; // un push supplémentaire est en attente (évite les écritures concurrentes)

function _reRenderPage() {
  try {
    // I2 — Toujours rafraîchir la sidebar (pôles chargés depuis Firebase)
    if (typeof window._refreshSidebar === 'function') window._refreshSidebar();
    if      (typeof renderDashboard  === 'function') renderDashboard();
    else if (typeof renderCalendar   === 'function') renderCalendar();
    else if (typeof render           === 'function') render();
    else if (typeof renderPage       === 'function') renderPage();
    // ⚠️ PAS de location.reload() en fallback : causerait une boucle infinie
    // sur les pages sans render() (parametres, location, personnel…)
  } catch(e) { console.warn('[_reRenderPage] erreur:', e); }
}

const Data = {

  _db: null,

  // ── Initialisation ──────────────────────────────────────────

  init() {
    // 1. Chargement local immédiat (affichage instantané)
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        this._db = JSON.parse(raw);
        this._migrate();
      } catch (e) {
        console.error('Erreur lecture BDD, réinitialisation.', e);
        this._db = this._emptyDb();
      }
    } else {
      this._db = this._emptyDb();
    }
    // 2. Appliquer les données du modèle si non configurées
    this._applyModelDefaults();
    // 3. Synchronisation Firebase
    this._loadFromFirebase();
    // 3. Polling avec backoff exponentiel (3s → 6s → 12s → … max 60s, reset sur succès)
    let _pollDelay = 3000;
    const _schedulePoll = () => {
      setTimeout(async () => {
        if (!_fbWriting) {
          const ok = await this._pollFallback();
          _pollDelay = ok ? 3000 : Math.min(_pollDelay * 2, 60000);
        }
        _schedulePoll();
      }, _pollDelay);
    };
    _schedulePoll();
  },

  // ── Fusion locale + Firebase (évite le last-write-wins entre appareils) ──────
  // Garde les items locaux plus récents, prend les nouveaux items distants.
  _mergeWithFirebase(fbData) {
    const ARRAY_KEYS = ['companies','missions','providers','students','formations',
      'subjects','subjectCategories','providerLinks','properties','rentalIncomes','internalStaff'];
    // Préserver les flags racine locaux (migrations one-shot, version, etc.)
    const merged = { ...this._db, ...fbData };
    for (const key of ARRAY_KEYS) {
      const localArr = this._db[key] || [];
      const remoteArr = fbData[key] || [];
      const map = {};
      remoteArr.forEach(item => { if (item.id) map[item.id] = item; });
      localArr.forEach(item => {
        if (!item.id) return;
        const remote = map[item.id];
        if (!remote) {
          // Créé localement depuis le dernier load Firebase → conserver
          if ((item.updatedAt || 0) > _fbLastTs) map[item.id] = item;
        } else if ((item.updatedAt || 0) > (remote.updatedAt || 0)) {
          // Item local plus récent → préférer
          map[item.id] = item;
        }
      });
      merged[key] = Object.values(map);
    }
    // Settings : deep merge, les champs locaux priment
    merged.settings = { ...(fbData.settings || {}), ...(this._db.settings || {}) };
    return merged;
  },

  // Charge les données depuis Firebase (source de vérité absolue)
  async _loadFromFirebase() {
    try {
      const res = await fetch(_FB_URL);
      if (!res.ok) {
        console.warn('Firebase _loadFromFirebase : réponse', res.status);
        if (typeof _showSyncError === 'function') _showSyncError();
        return;
      }
      const fbData = await res.json();
      // Validation minimale du schéma Firebase avant adoption
      if (!fbData || !fbData._updatedAt || typeof fbData !== 'object') {
        const hasLocal = (this._db.companies||[]).length + (this._db.missions||[]).length +
          (this._db.providers||[]).length + (this._db.students||[]).length +
          (this._db.formations||[]).length > 0;
        if (hasLocal) this._pushToFirebase();
        return;
      }
      _fbLastTs = fbData._updatedAt;
      const localTs = parseInt(localStorage.getItem('_edt_ts') || '0');
      const needsMigration = (fbData.companies || []).some(c => !c.role) || !fbData._poleAssignmentsFixed3;

      // R3 — Toujours fusionner : préserve les créations offline même quand Firebase est plus récent
      // (pire cas : résurrection d'un item supprimé — acceptable vs perte de création offline)
      this._db = this._mergeWithFirebase(fbData);
      this._migrate();
      const canonChanged = this._applyModelDefaults(true);
      const ts2 = (canonChanged || localTs > _fbLastTs) ? Date.now() : _fbLastTs;
      if (ts2 > _fbLastTs) this._db._updatedAt = ts2;
      localStorage.setItem(DB_KEY, JSON.stringify(this._db));
      localStorage.setItem('_edt_ts', String(ts2));
      _reRenderPage();
      if (needsMigration || canonChanged || localTs > _fbLastTs) this._pushToFirebase();
    } catch(e) {
      console.warn('Firebase non disponible, données locales utilisées.', e);
    }
  },

  // Pousse les données vers Firebase + persiste le timestamp
  // Utilise un verrou (_fbWriting) et un flag _fbPending pour éviter les écritures concurrentes :
  // si un push est déjà en cours, on mémorise qu'un autre est en attente
  // et on le relance à la fin du premier.
  async _pushToFirebase() {
    if (_fbWriting) { _fbPending = true; return; }
    _fbWriting = true;
    _fbPending = false;
    try {
      const ts = Date.now();
      const payload = { ...this._db, _updatedAt: ts };
      const res = await fetch(_FB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        _fbLastTs = ts;
        this._db._updatedAt = ts;
        localStorage.setItem('_edt_ts', String(ts)); // persiste pour survivre au rechargement
      }
    } catch(e) {
      console.warn('Échec push Firebase.', e);
      // Notifier l'utilisateur discrètement
      if (typeof _showSyncError === 'function') _showSyncError();
    }
    _fbWriting = false;
    // Rejouer le push si une modification est arrivée pendant l'écriture
    if (_fbPending) this._pushToFirebase();
  },

  async forcePushToFirebase() {
    const ts = Date.now() + 1000; // +1s pour être sûr d'être plus récent que Firebase
    this._db._updatedAt = ts;
    localStorage.setItem(DB_KEY, JSON.stringify(this._db));
    localStorage.setItem('_edt_ts', String(ts));
    _fbWriting = false;
    _fbPending = false;
    await this._pushToFirebase();
  },

  async _pollFallback() {
    try {
      const res = await fetch(_FB_URL.replace('.json', '/_updatedAt.json'));
      if (!res.ok) return false;
      const ts = await res.json();
      if (ts && ts > _fbLastTs) await this._loadFromFirebase();
      return true;
    } catch(_) { return false; }
  },

  _emptyDb() {
    return {
      version: 3,
      companies: [],
      providers: [],
      providerLinks: [],   // liaisons prestataire ↔ société (avec tarifs spécifiques)
      missions: [],        // anciennement "courses" — toutes les interventions
      students: [],        // étudiants (spécifique Artémis mais global)
      formations: [],      // modules de formation
      subjects: [],        // matières & cours
      subjectCategories: [], // catégories de matières
      settings: {
        defaultBillingRate: 50,
        currency: 'EUR',
        firstDayOfWeek: 1,
        responsableName: '', // nom du responsable pédagogique (utilisé dans les formulaires Qualiopi)
        siret: '',           // SIRET affiché sur les factures
        iban:  '',           // IBAN pour le pied de facture
        bic:   '',           // BIC/SWIFT
        codebanque: '',      // Code banque (5 chiffres)
        clerib:     '',      // Clé RIB (2 chiffres)
        numcompte:  '',      // N° de compte
        bankname:   '',      // Nom de l'établissement bancaire
        invoicePaymentDelay: '45 jours', // délai de paiement par défaut
      },
      properties: [],      // appartements / biens locatifs
      rentalIncomes: [],   // revenus locatifs mensuels
      internalStaff: [],   // personnel interne (salaires fixes mensuels)
    };
  },

  _migrate() {
    // v1/v2 → v3 : renommer schools→companies, courses→missions
    if (!this._db.version || this._db.version < 3) {
      if (this._db.schools && !this._db.companies) {
        this._db.companies = this._db.schools;
        delete this._db.schools;
      }
      if (this._db.courses && !this._db.missions) {
        this._db.missions = (this._db.courses || []).map(c => ({
          ...c,
          companyId: c.companyId || c.schoolId,
          missionType: c.missionType || 'course',
        }));
        delete this._db.courses;
      }
      this._db.version = 3;
    }
    // Garantir les tableaux
    if (!this._db.companies)     this._db.companies = [];
    if (!this._db.providers)     this._db.providers = [];
    if (!this._db.providerLinks) this._db.providerLinks = [];
    if (!this._db.missions)      this._db.missions = [];
    if (!this._db.students)      this._db.students = [];
    if (!this._db.formations)    this._db.formations = [];
    if (!this._db.subjects)           this._db.subjects = [];
    if (!this._db.subjectCategories)  this._db.subjectCategories = [];
    if (!this._db.settings)      this._db.settings = this._emptyDb().settings;
    if (!this._db.properties)    this._db.properties = [];
    if (!this._db.rentalIncomes) this._db.rentalIncomes = [];
    if (!this._db.internalStaff) this._db.internalStaff = [];
    if (!this._db.invoices)      this._db.invoices = [];

    // Garantir le champ role sur chaque société
    this._db.companies = this._db.companies.map(c => {
      if (!c.role) {
        // Seul critère fiable : poleId présent → client, sinon → own
        // (ne pas se baser sur 'type' : un pôle peut aussi avoir type='enseignement')
        c.role = c.poleId ? 'client' : 'own';
      }
      // hasTraining: pour les sociétés own existantes, activer si des étudiants y sont rattachés
      if (c.role === 'own' && c.hasTraining === undefined) {
        c.hasTraining = (this._db.students||[]).some(s => (s.poleId||s.companyId) === c.id);
      }
      return c;
    });

    // Migration one-shot : corriger les rôles des pôles + réattribuer leurs missions
    if (!this._db._poleAssignmentsFixed3) {
      const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      const findCo = partial => this._db.companies.find(c => norm(c.name).includes(norm(partial)));
      const now = Date.now();

      // Trouver les pôles par nom (sans condition sur role — peut être 'client' dans Firebase)
      const artemis = findCo('artem');
      const asteria = findCo('aster');

      // Forcer role='own' sur ces sociétés (elles sont des pôles, pas des clients)
      this._db.companies = this._db.companies.map(c => {
        if (artemis && c.id === artemis.id) return { ...c, role: 'own' };
        if (asteria && c.id === asteria.id) return { ...c, role: 'own' };
        return c;
      });
      // Mettre à jour les références locales après correction
      const artemisFixed = this._db.companies.find(c => artemis && c.id === artemis.id);
      const asteriaFixed = this._db.companies.find(c => asteria && c.id === asteria.id);

      // Société cible Artémis : "Cours particuliers" — créée si absente
      let courspart = findCo('cours particuliers');
      if (!courspart && artemisFixed) {
        courspart = { id: 'co-cours-part', name: 'Cours particuliers', role: 'client',
          poleId: artemisFixed.id, color: '#f97316', type: 'enseignement',
          createdAt: now, updatedAt: now };
        this._db.companies.push(courspart);
      }

      // Société cible Astéria : "Formations géopolitiques" — créée si absente
      let geopolit = findCo('geopolit') || findCo('geopolitique');
      if (!geopolit && asteriaFixed) {
        geopolit = { id: 'co-formations-geo', name: 'Formations géopolitiques', role: 'client',
          poleId: asteriaFixed.id, color: '#0891b2', type: 'enseignement',
          createdAt: now, updatedAt: now };
        this._db.companies.push(geopolit);
      }

      const mapping = {};
      if (artemisFixed && courspart && artemisFixed.id !== courspart.id) mapping[artemisFixed.id] = courspart.id;
      if (asteriaFixed && geopolit  && asteriaFixed.id !== geopolit.id)  mapping[asteriaFixed.id]  = geopolit.id;

      if (Object.keys(mapping).length > 0) {
        this._db.missions = (this._db.missions||[]).map(m => {
          if (mapping[m.companyId]) return { ...m, companyId: mapping[m.companyId], updatedAt: now };
          return m;
        });
      }
      this._db._poleAssignmentsFixed3 = true;
    }
  },

  // ── Données modèle EVOL — pré-remplissage automatique ────────
  // skipSave=true : ne pas appeler _save() (l'appelant gère lui-même la persistance)
  _applyModelDefaults(skipSave = false) {
    let changed = false;
    const s = this._db.settings || {};

    // Infos de facturation Artémis (issues de la facture modèle EVOL)
    const defaults = {
      siret:              '92192154000016',
      iban:               'FR76 1450 6042 1000 9205 3190 347',
      bic:                'AGRIFRPP845',
      codebanque:         '14506',
      clerib:             '47',
      numcompte:          '920 531 903 47',
      bankname:           'CR Loire Haute Loire — Saint-Étienne Bellevue',
      invoicePaymentDelay:'45 jours',
    };
    Object.entries(defaults).forEach(([k,v]) => {
      if (!s[k]) { s[k] = v; changed = true; }
    });
    if (changed) this._db.settings = s;

    // Adresse / contact communs aux deux pôles (même personne physique)
    (this._db.companies || []).forEach(c => {
      if (c.role !== 'own') return;
      let coChanged = false;
      if (!c.address || c.address.toLowerCase().includes('chapus')) {
        c.address = '1 bis chemin des Écureuils, 43220 Riotord';
        coChanged = true;
      }
      if (!c.email) { c.email = 'camille-chapuis@hotmail.fr'; coChanged = true; }
      if (!c.phone) { c.phone = '06.68.11.59.67';            coChanged = true; }
      if (coChanged) { c.updatedAt = Date.now(); changed = true; }
    });

    // Infos bancaires ASTÉRIA — toujours forcées (valeurs canoniques)
    // ⚠️ 'Astéria'.includes('aster') = FALSE : é (U+00E9) ≠ e (U+0065)
    // Détection robuste : ID canonique OU variantes de nom sans accent
    const _isAsteriaCompany = c => {
      if (c.id === 'co-asteria') return true;
      const n = (c.name||'').toLowerCase();
      // Couvre: asteria, astéria, astéria, ASTERIA, ASTÉRIA, etc.
      if (n.includes('asteria')) return true;           // sans accent
      if (n.includes('astéria')) return true;     // é NFD
      if (n.charCodeAt(0)===97 && n.includes('ast')) {
        // Fallback: commence par 'a' et contient 'ast' + 'ria' → Astéria probable
        const idx = n.indexOf('ast'); return idx >= 0 && n.includes('ria', idx);
      }
      return false;
    };
    const _ASTER_IBAN = 'FR76 1450 6042 1000 9111 2162 016';
    (this._db.companies || []).forEach(c => {
      if (!_isAsteriaCompany(c)) return;
      // Forcer aussi le rôle si absent
      if (c.role !== 'own') { c.role = 'own'; changed = true; }
      const _n = Date.now();
      let coChanged = false;
      const _f = (k, v) => { if ((c[k] == null || c[k] === '') || c[k] !== v) { c[k] = v; coChanged = true; } };
      _f('siret',       '92192154000016');
      _f('iban',        _ASTER_IBAN);
      _f('bic',         'AGRIFRPP845');
      _f('codebanque',  '14506');
      _f('codeguichet', '4210');
      _f('clerib',      '16');
      _f('numcompte',   '911 121 620');
      _f('bankname',    'CR Loire Haute Loire — Saint-Étienne Bellevue');
      if (coChanged) { c.updatedAt = _n; changed = true; }
    });

    // Secrétariat — créer automatiquement si absent
    if (!(this._db.internalStaff||[]).find(s => s.id === 'staff-secretariat')) {
      (this._db.internalStaff = this._db.internalStaff || []).push({
        id: 'staff-secretariat', name: 'Secrétariat', role: 'Secrétaire administrative',
        monthlyCost: 0, color: '#6366f1', notes: '', payments: [],
        createdAt: Date.now(), updatedAt: Date.now()
      });
      changed = true;
    }

    // Couleur jaune pour la société "Cours particuliers" (visible dans le calendrier)
    (this._db.companies || []).forEach(c => {
      if (c.role === 'own') return;
      if (!(c.name || '').toLowerCase().includes('cours particulier')) return;
      if (c.color !== '#eab308') { c.color = '#eab308'; c.updatedAt = Date.now(); changed = true; }
    });

    // Infos de facturation USAC — adresse/tél/SIRET forcés, NOM INCHANGÉ
    // ⚠️ Ne pas forcer le nom : "Lyon" dans le nom casserait le keyword matching
    (this._db.companies || []).forEach(c => {
      if (c.role === 'own') return;
      const n = (c.name || '').toLowerCase();
      if (!n.includes('usac') && !n.includes('ursac')) return;
      const _n = Date.now();
      let coChanged = false;
      const _f = (k, v) => { if (c[k] !== v) { c[k] = v; coChanged = true; } };
      // Restaurer le vrai nom si on l'avait malencontreusement changé en "USAC France Lyon"
      if (c.name === 'USAC France Lyon') { c.name = 'USAC - University Studies Abroad Consortium'; coChanged = true; }
      _f('address', 'UCLy, 10 place des Archives, 69002 Lyon');
      _f('phone',   '04 72 32 67 15');
      _f('siret',   '81018796300022');
      if (coChanged) { c.updatedAt = _n; changed = true; }
    });

    // Tarif AGRONOVA — 45 €/h forcé sur la fiche ET sur toutes les missions existantes
    const _agronovaCo = (this._db.companies || []).find(c =>
      c.role !== 'own' && (c.name || '').toLowerCase().includes('agronova')
    );
    if (_agronovaCo) {
      if (_agronovaCo.defaultBillingRate !== 45) {
        _agronovaCo.defaultBillingRate = 45;
        _agronovaCo.updatedAt = Date.now();
        changed = true;
      }
      // Corriger le tarif sur les missions existantes
      (this._db.missions || []).forEach(m => {
        if (m.companyId !== _agronovaCo.id) return;
        if (m.billingRate !== 45) {
          m.billingRate = 45;
          m.updatedAt   = Date.now();
          changed = true;
        }
      });
    }

    // Catégorie "Cours particuliers" dans le référentiel Matières
    const _CP_CAT_ID = 'cat-cours-particuliers';
    if (!(this._db.subjectCategories || []).find(c => c.id === _CP_CAT_ID)) {
      (this._db.subjectCategories = this._db.subjectCategories || []).push({
        id: _CP_CAT_ID, name: 'Cours particuliers', createdAt: Date.now(), updatedAt: Date.now()
      });
      changed = true;
    }

    // Matières "Cours particuliers" — créées si absentes, rattachées à la catégorie
    const _cpSubjects = [
      { id: 'subj-cp-droit-admin',    name: 'Droit administratif',  category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-droit-contrats', name: 'Droit des contrats',   category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-economie',       name: 'Économie',             category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-sciences-po',    name: 'Sciences politiques',  category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-finances',       name: 'Finances',             category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-philosophie',    name: 'Philosophie',          category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-histoire',       name: 'Histoire',             category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
      { id: 'subj-cp-geopolitique',   name: 'Géopolitique',         category: 'particuliers', categoryId: _CP_CAT_ID, color: '#7c3aed' },
    ];
    _cpSubjects.forEach(def => {
      const existing = (this._db.subjects || []).find(s => s.id === def.id);
      if (!existing) {
        (this._db.subjects = this._db.subjects || []).push({ ...def, createdAt: Date.now(), updatedAt: Date.now() });
        changed = true;
      } else if (existing.categoryId !== _CP_CAT_ID || existing.color !== def.color) {
        existing.categoryId = _CP_CAT_ID;
        existing.category   = 'particuliers';
        existing.color      = def.color;
        existing.updatedAt  = Date.now();
        changed = true;
      }
    });

    // ── Matières institutionnelles DRA — créées si absentes ──────────────────
    const _draSubjects = [
      { id: 'subj-dra106-contrats',  name: 'DRA106 Principaux contrats de l\'entreprise', color: '#3b82f6', level: 'superieur' },
      { id: 'subj-dra110-activites', name: 'DRA110 Activités et biens de l\'entreprise',  color: '#3b82f6', level: 'superieur' },
      { id: 'subj-dra103-regles',    name: 'DRA103 Règles générales du droit des contrats', color: '#3b82f6', level: 'superieur' },
    ];
    _draSubjects.forEach(def => {
      if (!(this._db.subjects || []).find(s => s.id === def.id)) {
        (this._db.subjects = this._db.subjects || []).push({
          ...def, category: 'ecoles', createdAt: Date.now(), updatedAt: Date.now()
        });
        changed = true;
      }
    });

    // ── Restauration de DRA106 PRINCIPAUX CONTRATS DE L'ENTREPRISE ───────────
    // Ce sujet a été supprimé par le _legacyMerges ('contrats' trop large)
    // On le recrée et on réassigne les missions CNAM qui lui appartenaient
    const _DRA106_ID = 'subj-dra106-contrats';
    if (!(this._db.subjects || []).find(s => s.id === _DRA106_ID)) {
      (this._db.subjects = this._db.subjects || []).push({
        id: _DRA106_ID,
        name: 'DRA106 Principaux contrats de l\'entreprise',
        level: 'superieur', color: '#3b82f6', category: 'ecoles',
        createdAt: Date.now(), updatedAt: Date.now()
      });
      changed = true;
    }
    // Réassigner les missions CNAM orphelines (subjectId = ecoles-droit-contrats) → DRA106
    const _cnamIds = new Set(
      (this._db.companies || [])
        .filter(c => (c.name || '').toLowerCase().includes('cnam'))
        .map(c => c.id)
    );
    (this._db.missions || []).forEach(m => {
      if (m.subjectId !== 'subj-ecoles-droit-contrats') return;
      if (!_cnamIds.has(m.companyId)) return;
      m.subjectId = _DRA106_ID;
      m.updatedAt = Date.now();
      changed = true;
    });

    // ── Sujet institutionnel "Droit des contrats" dans COURS ÉCOLES ──────────
    // Distinct du sujet cours particuliers (subj-cp-droit-contrats)
    const _CONTRATS_INST_ID = 'subj-ecoles-droit-contrats';
    if (!(this._db.subjects || []).find(s => s.id === _CONTRATS_INST_ID)) {
      (this._db.subjects = this._db.subjects || []).push({
        id: _CONTRATS_INST_ID, name: 'Droit des contrats', level: 'superieur',
        color: '#3b82f6', category: 'ecoles',
        createdAt: Date.now(), updatedAt: Date.now()
      });
      changed = true;
    }

    // ── Réparation : missions institutionnelles mal placées dans cours particuliers ─
    // Trois critères pour identifier un cours particulier :
    // 1. missionCategory = 'particuliers' (nouvelles missions depuis le fix P6)
    // 2. companyId = société "Cours particuliers" (id canonique 'co-cours-part')
    // 3. studentIds.length > 0 (mission liée à des étudiants nommés = cours particulier)
    const _cpCo   = (this._db.companies || []).find(c =>
      c.role !== 'own' && (c.name || '').toLowerCase().includes('cours particulier')
    );
    const _cpCoId = _cpCo?.id || 'co-cours-part'; // fallback sur l'ID canonique
    (this._db.missions || []).forEach(m => {
      if (m.subjectId !== 'subj-cp-droit-contrats') return;
      const isParticulier =
        m.missionCategory === 'particuliers' ||
        m.companyId === _cpCoId ||
        (Array.isArray(m.studentIds) && m.studentIds.length > 0); // cours lié à un étudiant nommé
      if (!isParticulier) {
        // Mission institutionnelle absorbée par erreur → la réassigner
        m.subjectId = _CONTRATS_INST_ID;
        m.updatedAt = Date.now();
        changed = true;
      }
    });
    // Même logique pour droit administratif institutionnel (sécurité)
    const _ADMIN_INST_ID = 'subj-ecoles-droit-admin';
    if (!(this._db.subjects || []).find(s => s.id === _ADMIN_INST_ID)) {
      (this._db.subjects = this._db.subjects || []).push({
        id: _ADMIN_INST_ID, name: 'Droit administratif', level: 'superieur',
        color: '#3b82f6', category: 'ecoles',
        createdAt: Date.now(), updatedAt: Date.now()
      });
      changed = true;
    }
    (this._db.missions || []).forEach(m => {
      if (m.subjectId !== 'subj-cp-droit-admin') return;
      const isParticulier =
        m.missionCategory === 'particuliers' ||
        m.companyId === _cpCoId ||
        (Array.isArray(m.studentIds) && m.studentIds.length > 0);
      if (!isParticulier) {
        m.subjectId = _ADMIN_INST_ID;
        m.updatedAt = Date.now();
        changed = true;
      }
    });

    // ── Fusion uniquement des ANCIENS doublons cours particuliers (noms explicites) ─
    // ⚠️ Ne PAS utiliser 'contrats' seul : trop large, absorberait DRA106 etc.
    const _legacyMerges = [
      { keywords: ['droit administratif cours particulier', 'droit administratif- cours'],
        canonId: 'subj-cp-droit-admin' },
      { keywords: ['droit des contrats cours particulier', 'droit des contrats- cours'],
        canonId: 'subj-cp-droit-contrats' },
    ];
    _legacyMerges.forEach(({ keywords, canonId }) => {
      const dupes = (this._db.subjects || []).filter(s =>
        s.id !== canonId &&
        keywords.some(kw => (s.name || '').toLowerCase().includes(kw))
      );
      dupes.forEach(dupe => {
        (this._db.missions || []).forEach(m => {
          if (m.subjectId === dupe.id) { m.subjectId = canonId; m.updatedAt = Date.now(); changed = true; }
        });
        this._db.subjects = (this._db.subjects || []).filter(s => s.id !== dupe.id);
        changed = true;
      });
    });

    // Log de synthèse pour diagnostic
    const _asterCo = (this._db.companies||[]).find(c => c.role==='own' && (c.name||'').toLowerCase().includes('aster'));
    const _usacCo  = (this._db.companies||[]).find(c => c.role!=='own' && ((c.name||'').toLowerCase().includes('usac')||(c.name||'').toLowerCase().includes('ursac')));

    // Fusion des doublons EVOL AGENCY → un seul prestataire canonique
    if (this._mergeProvidersByKeyword('evol', 'EVOL AGENCY',
          '21 MONTÉE DE COLLONGES, 42170 Saint-Just-Saint-Rambert')) {
      changed = true;
    }

    // EVOL AGENCY — porteur de facturation pour les écoles à 35€/h
    // 1. Marquer comme agence de facturation (isAgency)
    // 2. Créer les providerLinks vers toutes les écoles EVOL (si absents)
    const _evolProv = (this._db.providers || []).find(p =>
      (p.structure || '').toUpperCase().includes('EVOL')
    );
    if (_evolProv) {
      // isAgency
      if (!_evolProv.isAgency) {
        _evolProv.isAgency = true;
        _evolProv.updatedAt = Date.now();
        changed = true;
      }
      // Mots-clés des écoles à 35€/h facturées via EVOL AGENCY
      const _EVOL_SCHOOL_KW = ['eklya','cnam','eac','eemi','irup','iomi','monts'];
      const _EVOL_RATE = 35;
      const _evolSchools = (this._db.companies || []).filter(c => {
        if (c.role === 'own') return false;
        const n = (c.name || '').toLowerCase();
        return _EVOL_SCHOOL_KW.some(kw => n.includes(kw));
      });
      _evolSchools.forEach(school => {
        const exists = (this._db.providerLinks || []).find(l =>
          l.providerId === _evolProv.id && l.companyId === school.id
        );
        if (!exists) {
          (this._db.providerLinks = this._db.providerLinks || []).push({
            id: `pl-evol-${school.id}`,
            providerId: _evolProv.id,
            companyId:  school.id,
            hourlyRate: _EVOL_RATE,
            createdAt:  Date.now(),
            updatedAt:  Date.now(),
          });
          changed = true;
        }
      });
    }

    if (changed && !skipSave) this._save();
    return changed;
  },

  // ── Fusion de prestataires en double (même nom, IDs différents) ─
  // keyword   : mot-clé (lowercase) présent dans le nom des doublons
  // masterName: structure canonique du prestataire maître
  // masterAddr: adresse à appliquer si absente
  _mergeProvidersByKeyword(keyword, masterName, masterAddr) {
    const providers = this._db.providers || [];
    const matches = providers.filter(p =>
      (p.structure || p.lastName || '').toLowerCase().includes(keyword)
    );
    if (matches.length <= 1) {
      // Même avec 1 seul, corriger le nom et l'adresse si nécessaire
      if (matches.length === 1) {
        let c = false;
        if (matches[0].structure !== masterName) { matches[0].structure = masterName; c = true; }
        if (!matches[0].address) { matches[0].address = masterAddr; c = true; }
        if (c) matches[0].updatedAt = Date.now();
        return c;
      }
      return false;
    }

    // Choisir le maître : préférer celui déjà nommé masterName, sinon le premier
    let master = matches.find(p =>
      (p.structure || '').toUpperCase() === masterName.toUpperCase()
    ) || matches[0];

    // Normaliser le maître
    master.structure = masterName;
    if (!master.address) master.address = masterAddr;
    master.updatedAt = Date.now();

    const dupIds = matches.filter(p => p.id !== master.id).map(p => p.id);

    // Réaffecter toutes les missions qui pointaient vers un doublon
    (this._db.missions || []).forEach(m => {
      let mChanged = false;
      // Nouveau format : providerIds[]
      if (Array.isArray(m.providerIds) && m.providerIds.length) {
        const updated = [...new Set(m.providerIds.map(pid => dupIds.includes(pid) ? master.id : pid))];
        if (updated.join() !== m.providerIds.join()) { m.providerIds = updated; mChanged = true; }
      }
      // Ancien format : providerId (string)
      if (m.providerId && dupIds.includes(m.providerId)) { m.providerId = master.id; mChanged = true; }
      if (mChanged) m.updatedAt = Date.now();
    });

    // Supprimer les doublons de la liste
    this._db.providers = providers.filter(p => !dupIds.includes(p.id));
    return true;
  },

  _save() {
    const ts = Date.now();
    this._db._updatedAt = ts;
    localStorage.setItem(DB_KEY, JSON.stringify(this._db));
    localStorage.setItem('_edt_ts', String(ts)); // marque local comme plus récent avant le push
    this._autoBackup();
    this._pushToFirebase();
  },

  // ── Sauvegardes automatiques (3 jours glissants) ────────────

  _autoBackup() {
    const BACKUP_KEY = 'emploi_du_temps_backups';
    const today = Utils.today();
    let backups = [];
    try { backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch(e) { backups = []; }

    // Met à jour la sauvegarde du jour, ou en crée une nouvelle
    const lastIdx = backups.findIndex(b => b.date === today);
    const entry = { date: today, savedAt: Date.now(), data: JSON.stringify(this._db) };
    if (lastIdx >= 0) {
      backups[lastIdx] = entry;
    } else {
      backups.push(entry);
      if (backups.length > 3) backups.shift(); // garder 3 jours max
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
  },

  getBackups() {
    try { return JSON.parse(localStorage.getItem('emploi_du_temps_backups') || '[]'); } catch(e) { return []; }
  },

  restoreBackup(date) {
    const backups = this.getBackups();
    const entry = backups.find(b => b.date === date);
    if (!entry) return { error: 'Sauvegarde introuvable.' };
    try {
      this._db = JSON.parse(entry.data);
      // R2 — persist + push SANS _autoBackup pour ne pas écraser la sauvegarde du jour
      const ts = Date.now();
      this._db._updatedAt = ts;
      localStorage.setItem(DB_KEY, JSON.stringify(this._db));
      localStorage.setItem('_edt_ts', String(ts));
      this._pushToFirebase();
      return { success: true };
    } catch(e) {
      return { error: 'Erreur lors de la restauration.' };
    }
  },

  // ── Paramètres ──────────────────────────────────────────────

  getSettings() { return { ...this._db.settings }; },
  saveSettings(s) {
    this._db.settings = { ...this._db.settings, ...s };
    this._save();
  },

  // ── Sociétés (anciennement "écoles") ────────────────────────

  getCompanies() {
    return [...this._db.companies].sort((a, b) => (a.name||'').localeCompare(b.name||''));
  },
  // alias pour compatibilité avec l'ancien code
  getSchools() { return this.getCompanies(); },

  // Nos propres sociétés (role = 'own')
  getOwnCompanies() {
    return this.getCompanies().filter(c => c.role === 'own');
  },

  // Écoles / clients externes (role = 'client' ou non défini)
  getClientSchools() {
    return this.getCompanies().filter(c => c.role === 'client' || !c.role);
  },

  getCompanyById(id) {
    return this._db.companies.find(c => c.id === id) || null;
  },
  getSchoolById(id) { return this.getCompanyById(id); },

  saveCompany(company) {
    const idx = this._db.companies.findIndex(c => c.id === company.id);
    if (idx >= 0) {
      this._db.companies[idx] = { ...company, updatedAt: Date.now() };
    } else {
      this._db.companies.push({ ...company, id: company.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },
  saveSchool(s) { return this.saveCompany(s); },

  deleteCompany(id) {
    const linked = this._db.missions.filter(m => m.companyId === id);
    if (linked.length > 0) {
      return { error: `Impossible de supprimer : ${linked.length} mission(s) liée(s) à cette société.` };
    }
    this._db.companies = this._db.companies.filter(c => c.id !== id);
    this._db.providerLinks = this._db.providerLinks.filter(l => l.companyId !== id);
    this._save();
    return { success: true };
  },
  deleteSchool(id) { return this.deleteCompany(id); },

  // ── Prestataires (fiche centrale) ───────────────────────────

  getProviders() {
    return [...this._db.providers].sort((a, b) =>
      `${a.lastName||''} ${a.firstName||''}`.localeCompare(`${b.lastName||''} ${b.firstName||''}`)
    );
  },
  getProviderById(id) {
    return this._db.providers.find(p => p.id === id) || null;
  },
  getActiveProviders() {
    return this.getProviders().filter(p => p.active !== false);
  },

  saveProvider(provider) {
    const idx = this._db.providers.findIndex(p => p.id === provider.id);
    if (idx >= 0) {
      this._db.providers[idx] = { ...provider, updatedAt: Date.now() };
    } else {
      this._db.providers.push({ ...provider, id: provider.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },

  deleteProvider(id) {
    // P4 — vérifier aussi providerIds[] (nouveau format multi-prestataires)
    const linked = this._db.missions.filter(m =>
      m.providerId === id ||
      (Array.isArray(m.providerIds) && m.providerIds.includes(id))
    );
    if (linked.length > 0) {
      return { error: `Impossible de supprimer : ${linked.length} mission(s) liée(s) à ce prestataire.` };
    }
    this._db.providers = this._db.providers.filter(p => p.id !== id);
    this._db.providerLinks = this._db.providerLinks.filter(l => l.providerId !== id);
    this._save();
    return { success: true };
  },

  // ── Liens prestataire ↔ société ──────────────────────────────

  getProviderLinks() {
    return [...this._db.providerLinks];
  },

  getProviderLinksByProvider(providerId) {
    return this._db.providerLinks.filter(l => l.providerId === providerId);
  },

  getProviderLinksByCompany(companyId) {
    return this._db.providerLinks.filter(l => l.companyId === companyId);
  },

  getProviderLink(providerId, companyId) {
    return this._db.providerLinks.find(l => l.providerId === providerId && l.companyId === companyId) || null;
  },

  saveProviderLink(link) {
    const idx = this._db.providerLinks.findIndex(l => l.id === link.id);
    if (idx >= 0) {
      this._db.providerLinks[idx] = { ...link, updatedAt: Date.now() };
    } else {
      this._db.providerLinks.push({ ...link, id: link.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },

  deleteProviderLink(id) {
    this._db.providerLinks = this._db.providerLinks.filter(l => l.id !== id);
    this._save();
  },

  // Tarif effectif d'un prestataire pour une société
  getEffectiveRate(providerId, companyId) {
    const link = this.getProviderLink(providerId, companyId);
    if (link && link.hourlyRate > 0) return link.hourlyRate;
    const provider = this.getProviderById(providerId);
    return provider ? (provider.defaultHourlyRate || provider.hourlyRate || 0) : 0;
  },

  // ── Missions (anciennement "cours") ─────────────────────────

  getMissions() {
    return [...this._db.missions];
  },
  // alias
  getCourses() { return this.getMissions(); },

  getMissionById(id) {
    return this._db.missions.find(m => m.id === id) || null;
  },
  getCourseById(id) { return this.getMissionById(id); },

  getMissionsSorted() {
    return this.getMissions().sort((a, b) => {
      const d = Utils.dateCompare(a.date, b.date);
      if (d !== 0) return d;
      return Utils.timeToMinutes(a.startTime) - Utils.timeToMinutes(b.startTime);
    });
  },
  getCoursesSorted() { return this.getMissionsSorted(); },

  getMissionsByDateRange(startDate, endDate) {
    return this.getMissionsSorted().filter(m => m.date >= startDate && m.date <= endDate);
  },
  getCoursesByDateRange(s, e) { return this.getMissionsByDateRange(s, e); },

  getMissionsByMonth(yearMonth) {
    return this.getMissionsSorted().filter(m => m.date && m.date.startsWith(yearMonth));
  },
  getCoursesByMonth(ym) { return this.getMissionsByMonth(ym); },

  saveMission(mission) {
    mission.duration = Utils.calcDuration(mission.startTime, mission.endTime);
    mission.companyId = mission.companyId || mission.schoolId || null;
    // Normalise multi-prestataires : assure la cohérence entre providerIds et providerId
    if (!mission.providerIds || !Array.isArray(mission.providerIds)) {
      mission.providerIds = mission.providerId ? [mission.providerId] : [];
    }
    mission.providerId = mission.providerIds[0] || null;

    const idx = this._db.missions.findIndex(m => m.id === mission.id);
    if (idx >= 0) {
      this._db.missions[idx] = { ...mission, updatedAt: Date.now() };
    } else {
      this._db.missions.push({ ...mission, id: mission.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
    return mission;
  },
  saveCourse(c) { return this.saveMission(c); },

  deleteMission(id) {
    this._db.missions = this._db.missions.filter(m => m.id !== id);
    this._save();
  },
  deleteCourse(id) { return this.deleteMission(id); },

  deleteRecurringGroup(groupId, exceptId = null) {
    this._db.missions = this._db.missions.filter(m =>
      m.recurringGroupId !== groupId || (exceptId && m.id === exceptId)
    );
    this._save();
  },

  duplicateMission(id, newDate = null) {
    const m = this.getMissionById(id);
    if (!m) return null;
    const newM = { ...m, id: Utils.uuid(), date: newDate || m.date, recurringGroupId: null,
      status: 'planned', paymentStatus: 'unpaid', createdAt: Date.now(), updatedAt: Date.now() };
    this._db.missions.push(newM);
    this._save();
    return newM;
  },
  duplicateCourse(id, d) { return this.duplicateMission(id, d); },

  createRecurringMissions(baseMission, frequency, endDate) {
    const groupId = Utils.uuid();
    const missions = [];
    let current = baseMission.date;

    while (current <= endDate) {
      const occ = { ...baseMission, id: Utils.uuid(), date: current, recurringGroupId: groupId,
        status: 'planned', paymentStatus: 'unpaid', createdAt: Date.now(), updatedAt: Date.now() };
      occ.duration = Utils.calcDuration(occ.startTime, occ.endTime);
      this._db.missions.push(occ);
      missions.push(occ);
      if (frequency === 'weekly')      current = Utils.addDays(current, 7);
      else if (frequency === 'biweekly') current = Utils.addDays(current, 14);
      else if (frequency === 'monthly') {
        const d = new Date(current + 'T00:00:00'); d.setMonth(d.getMonth() + 1);
        current = Utils.localISO(d);
      } else break;
    }
    this._save();
    return missions;
  },
  createRecurringCourses(base, freq, end) { return this.createRecurringMissions(base, freq, end); },

  // ── Étudiants ────────────────────────────────────────────────

  getStudents() {
    return [...this._db.students].sort((a, b) =>
      `${a.lastName||''} ${a.firstName||''}`.localeCompare(`${b.lastName||''} ${b.firstName||''}`)
    );
  },

  getStudentById(id) {
    return this._db.students.find(s => s.id === id) || null;
  },

  getActiveStudents() {
    return this.getStudents().filter(s => s.status !== 'inactive');
  },

  getStudentsByCompany(companyId) {
    return this.getStudents().filter(s => s.companyId === companyId);
  },

  saveStudent(student) {
    const idx = this._db.students.findIndex(s => s.id === student.id);
    if (idx >= 0) {
      this._db.students[idx] = { ...student, updatedAt: Date.now() };
    } else {
      this._db.students.push({ ...student, id: student.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },

  deleteStudent(id) {
    this._db.students = this._db.students.filter(s => s.id !== id);
    this._save();
  },

  // ── Formations ──────────────────────────────────────────────

  getFormations() {
    return [...this._db.formations].sort((a, b) => (a.name||'').localeCompare(b.name||''));
  },

  getFormationById(id) {
    return this._db.formations.find(f => f.id === id) || null;
  },

  getFormationsByCompany(companyId) {
    return this.getFormations().filter(f => f.companyId === companyId);
  },

  saveFormation(formation) {
    const idx = this._db.formations.findIndex(f => f.id === formation.id);
    if (idx >= 0) {
      this._db.formations[idx] = { ...formation, updatedAt: Date.now() };
    } else {
      this._db.formations.push({ ...formation, id: formation.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },

  deleteFormation(id) {
    this._db.formations = this._db.formations.filter(f => f.id !== id);
    this._save();
  },

  // ── Matières / Cours ────────────────────────────────────────

  getSubjects() {
    if (!this._db.subjects) this._db.subjects = [];
    return [...this._db.subjects].sort((a, b) => (a.name||'').localeCompare(b.name||''));
  },

  saveSubject(subject) {
    if (!this._db.subjects) this._db.subjects = [];
    if (!subject.id) subject.id = Utils.uuid();
    const idx = this._db.subjects.findIndex(s => s.id === subject.id);
    if (idx >= 0) {
      this._db.subjects[idx] = { ...subject, updatedAt: Date.now() };
    } else {
      this._db.subjects.push({ ...subject, createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },

  deleteSubject(id) {
    if (!this._db.subjects) return;
    this._db.subjects = this._db.subjects.filter(s => s.id !== id);
    this._save();
  },

  getSubjectCategories() {
    if (!this._db.subjectCategories) this._db.subjectCategories = [];
    return [...this._db.subjectCategories].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  },
  saveSubjectCategory(cat) {
    if (!this._db.subjectCategories) this._db.subjectCategories = [];
    const idx = this._db.subjectCategories.findIndex(c => c.id === cat.id);
    if (idx >= 0) this._db.subjectCategories[idx] = cat; else this._db.subjectCategories.push(cat);
    this._save();
  },
  deleteSubjectCategory(id) {
    this._db.subjectCategories = (this._db.subjectCategories||[]).filter(c => c.id !== id);
    this._db.subjects = (this._db.subjects||[]).map(s => s.categoryId===id ? {...s, categoryId:null} : s);
    this._save();
  },

  // ── Biens locatifs ───────────────────────────────────────────

  getProperties() {
    return [...(this._db.properties||[])].sort((a, b) => (a.name||'').localeCompare(b.name||''));
  },
  getActiveProperties() {
    return this.getProperties().filter(p => p.active !== false);
  },
  getPropertyById(id) {
    return (this._db.properties||[]).find(p => p.id === id) || null;
  },
  saveProperty(property) {
    if (!this._db.properties) this._db.properties = [];
    const idx = this._db.properties.findIndex(p => p.id === property.id);
    if (idx >= 0) {
      this._db.properties[idx] = { ...property, updatedAt: Date.now() };
    } else {
      this._db.properties.push({ ...property, id: property.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },
  deleteProperty(id) {
    if (!this._db.properties) return { success: true };
    this._db.properties = this._db.properties.filter(p => p.id !== id);
    this._db.rentalIncomes = (this._db.rentalIncomes||[]).filter(r => r.propertyId !== id);
    this._save();
    return { success: true };
  },

  // ── Personnel interne ────────────────────────────────────────

  getInternalStaff() {
    return [...(this._db.internalStaff||[])].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  },
  getInternalStaffById(id) {
    return (this._db.internalStaff||[]).find(s=>s.id===id)||null;
  },
  saveInternalStaff(staff) {
    if (!this._db.internalStaff) this._db.internalStaff=[];
    const idx=this._db.internalStaff.findIndex(s=>s.id===staff.id);
    if (idx>=0) { this._db.internalStaff[idx]={...staff,updatedAt:Date.now()}; }
    else { this._db.internalStaff.push({...staff,id:staff.id||Utils.uuid(),createdAt:Date.now(),updatedAt:Date.now()}); }
    this._save();
  },
  deleteInternalStaff(id) {
    this._db.internalStaff=(this._db.internalStaff||[]).filter(s=>s.id!==id);
    this._save();
  },

  // ── Revenus locatifs ─────────────────────────────────────────

  getRentalIncomes() {
    return [...(this._db.rentalIncomes||[])].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  },
  getRentalIncomeById(id) {
    return (this._db.rentalIncomes||[]).find(r => r.id === id) || null;
  },
  getRentalIncomesByMonth(yearMonth) {
    return (this._db.rentalIncomes||[]).filter(r => r.yearMonth === yearMonth);
  },
  getRentalIncomesByProperty(propertyId) {
    return (this._db.rentalIncomes||[]).filter(r => r.propertyId === propertyId)
      .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  },
  saveRentalIncome(income) {
    if (!this._db.rentalIncomes) this._db.rentalIncomes = [];
    const idx = this._db.rentalIncomes.findIndex(r => r.id === income.id);
    if (idx >= 0) {
      this._db.rentalIncomes[idx] = { ...income, updatedAt: Date.now() };
    } else {
      this._db.rentalIncomes.push({ ...income, id: income.id || Utils.uuid(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    this._save();
  },
  deleteRentalIncome(id) {
    if (!this._db.rentalIncomes) return;
    this._db.rentalIncomes = this._db.rentalIncomes.filter(r => r.id !== id);
    this._save();
  },

  // ── Détection de conflits ────────────────────────────────────

  // Retourne les conflits d'agenda pour un prestataire
  getConflictsForProvider(providerId) {
    const missions = this.getMissionsSorted()
      .filter(m => m.status !== 'cancelled' && (m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])).includes(providerId));
    const conflicts = [];
    for (let i = 0; i < missions.length; i++) {
      for (let j = i + 1; j < missions.length; j++) {
        const a = missions[i], b = missions[j];
        if (a.date !== b.date) continue;
        const aStart = Utils.timeToMinutes(a.startTime);
        const aEnd   = Utils.timeToMinutes(a.endTime);
        const bStart = Utils.timeToMinutes(b.startTime);
        const bEnd   = Utils.timeToMinutes(b.endTime);
        if (aStart < bEnd && bStart < aEnd) {
          conflicts.push({ a, b });
        }
      }
    }
    return conflicts;
  },

  // Retourne tous les conflits (tous prestataires)
  getAllConflicts() {
    const providerIds = [...new Set(this._db.missions.flatMap(m => m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : [])))];
    const conflicts = [];
    providerIds.forEach(pid => {
      this.getConflictsForProvider(pid).forEach(c => conflicts.push({ providerId: pid, ...c }));
    });
    return conflicts;
  },

  // ── Suivi factures ───────────────────────────────────────────

  getInvoices() {
    return [...(this._db.invoices||[])].sort((a, b) => (b.sentDate||'').localeCompare(a.sentDate||''));
  },
  getInvoicesByMonth(yearMonth, poleId) {
    return (this._db.invoices||[]).filter(inv =>
      inv.yearMonth === yearMonth && (!poleId || inv.poleId === poleId)
    ).sort((a, b) => (b.sentDate||'').localeCompare(a.sentDate||''));
  },
  saveInvoice(inv) {
    if (!this._db.invoices) this._db.invoices = [];
    const idx = this._db.invoices.findIndex(i => i.id === inv.id);
    const now = Date.now();
    if (idx >= 0) {
      this._db.invoices[idx] = { ...inv, updatedAt: now };
    } else {
      this._db.invoices.push({ ...inv, id: inv.id || Utils.uuid(), createdAt: now, updatedAt: now });
    }
    this._save();
  },
  deleteInvoice(id) {
    this._db.invoices = (this._db.invoices||[]).filter(i => i.id !== id);
    this._save();
  },

  // ── Statistiques financières ─────────────────────────────────

  getFinancialStats(filters = {}) {
    let missions = this.getMissionsSorted();

    if (filters.yearMonth)  missions = missions.filter(m => m.date && m.date.startsWith(filters.yearMonth));
    if (filters.companyId)  missions = missions.filter(m => m.companyId === filters.companyId);
    if (filters.providerId) missions = missions.filter(m => {
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      return pids.includes(filters.providerId);
    });
    if (filters.missionType) missions = missions.filter(m => m.missionType === filters.missionType);
    if (filters.status)     missions = missions.filter(m => m.status === filters.status);

    // Auto-done : sans filtre de statut explicite, les missions 'planned' dont la
    // date est passée sont traitées comme réalisées (le statut Firebase n'est pas modifié).
    const today    = Utils.today();
    const effDone  = !filters.status
      ? m => m.status === 'done' || (m.status === 'planned' && m.date && m.date < today)
      : m => m.status === 'done';
    const done      = missions.filter(effDone);
    const planned   = missions.filter(m =>
      !filters.status
        ? (m.status === 'planned' && (!m.date || m.date >= today))
        : m.status === 'planned'
    );
    const cancelled = missions.filter(m => m.status === 'cancelled');

    const totalHoursDone    = done.reduce((s, m) => s + (m.duration || 0), 0);
    const totalHoursPlanned = planned.reduce((s, m) => s + (m.duration || 0), 0);
    const grossRevenue      = done.reduce((s, m) => s + (m.duration || 0) * (m.billingRate || 0), 0);
    const providerCosts     = done.reduce((s, m) => {
      if (!m.providerId && !m.providerIds?.length) return s;
      return s + (m.duration || 0) * (m.providerRate || 0);
    }, 0);
    const netMargin = grossRevenue - providerCosts;

    const byCompany = {};
    done.forEach(m => {
      const key = m.companyId || '__none__';
      if (!byCompany[key]) byCompany[key] = { hours: 0, revenue: 0, count: 0 };
      byCompany[key].hours   += m.duration || 0;
      byCompany[key].revenue += (m.duration || 0) * (m.billingRate || 0);
      byCompany[key].count++;
    });

    const byProvider = {};
    done.forEach(m => {
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      // On divise le coût entre le nombre de prestataires pour éviter le double comptage
      const costPerProvider = pids.length > 0 ? (m.duration || 0) * (m.providerRate || 0) / pids.length : 0;
      pids.forEach(pid => {
        if (!byProvider[pid]) byProvider[pid] = { hours: 0, cost: 0, count: 0 };
        byProvider[pid].hours += m.duration || 0;
        byProvider[pid].cost  += costPerProvider;
        byProvider[pid].count++;
      });
    });

    // Données facturation prestataire (toutes missions y compris non done)
    const billingByProvider = {};
    missions.forEach(m => {
      if (!m.providerId) return;
      const key = m.providerId;
      if (!billingByProvider[key]) billingByProvider[key] = {
        planned: { hours: 0, cost: 0, count: 0 },
        done:    { hours: 0, cost: 0, count: 0 },
        invoiced: { count: 0 },
        paid:     { count: 0 },
      };
      const s = m.status === 'done' ? billingByProvider[key].done : billingByProvider[key].planned;
      s.hours += m.duration || 0;
      s.cost  += (m.duration || 0) * (m.providerRate || 0);
      s.count++;
      if (m.paymentStatus === 'invoiced') billingByProvider[key].invoiced.count++;
      if (m.paymentStatus === 'paid')     billingByProvider[key].paid.count++;
    });

    const unpaidMissions = done.filter(m => m.paymentStatus !== 'paid');
    const unpaidAmount   = unpaidMissions.reduce((s, m) => s + (m.duration || 0) * (m.billingRate || 0), 0);

    return {
      missions, done, planned, cancelled,
      totalHoursDone:    Math.round(totalHoursDone    * 100) / 100,
      totalHoursPlanned: Math.round(totalHoursPlanned * 100) / 100,
      grossRevenue:   Math.round(grossRevenue   * 100) / 100,
      providerCosts:  Math.round(providerCosts  * 100) / 100,
      netMargin:      Math.round(netMargin      * 100) / 100,
      byCompany, byProvider, billingByProvider,
      // alias
      bySchool: byCompany,
      unpaidAmount: Math.round(unpaidAmount * 100) / 100,
      unpaidCount: unpaidMissions.length,
    };
  },

  // Données tableau de bord enrichi
  getDashboardData() {
    const today      = Utils.today();
    const weekStart  = Utils.getWeekStart(today);
    const weekEnd    = Utils.addDays(weekStart, 6);
    const currentMonth = today.substring(0, 7);

    const allMissions  = this.getMissionsSorted();
    const weekMissions = allMissions.filter(m => m.date >= weekStart && m.date <= weekEnd && m.status !== 'cancelled');
    const monthStats   = this.getFinancialStats({ yearMonth: currentMonth });
    const upcoming     = allMissions.filter(m => m.date >= today && m.status === 'planned').slice(0, 7);
    const toReschedule = allMissions.filter(m => m.status === 'postponed' || m.status === 'moved').slice(0, 5);
    const unpaid       = allMissions.filter(m => m.status === 'done' && m.paymentStatus !== 'paid').slice(0, 5);
    const conflicts    = this.getAllConflicts().slice(0, 5);

    // Stats par société (mois courant uniquement, pour cohérence avec les KPIs)
    const companies    = this.getCompanies();
    const byCompany    = {};
    const monthMissions = allMissions.filter(m => m.date && m.date.startsWith(currentMonth) && m.status !== 'cancelled');
    companies.forEach(c => {
      const cMissions = monthMissions.filter(m => m.companyId === c.id);
      byCompany[c.id] = {
        company: c,
        planned: cMissions.filter(m => m.status === 'planned').length,
        done:    cMissions.filter(m => m.status === 'done').length,
        hoursPlanned: cMissions.filter(m => m.status === 'planned').reduce((s, m) => s + (m.duration || 0), 0),
        hoursDone:    cMissions.filter(m => m.status === 'done').reduce((s, m) => s + (m.duration || 0), 0),
      };
    });

    // Formations en cours
    const activeFormations = this.getFormations().filter(f => f.status === 'active' || f.status === 'in_progress');
    // Étudiants actifs
    const activeStudents = this.getActiveStudents();

    return {
      weekMissionsCount: weekMissions.length,
      weekHours: Math.round(weekMissions.reduce((s, m) => s + (m.duration || 0), 0) * 100) / 100,
      monthHoursDone:    monthStats.totalHoursDone,
      monthHoursPlanned: monthStats.totalHoursPlanned,
      monthRevenue:      monthStats.grossRevenue,
      monthMargin:       monthStats.netMargin,
      upcoming, toReschedule, unpaid, conflicts,
      byCompany,
      activeFormations,
      activeStudentsCount: activeStudents.length,
    };
  },

  // ── Export / Import ──────────────────────────────────────────

  exportToJson() {
    const data = JSON.stringify(this._db, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `emploi_du_temps_${Utils.today().replace(/-/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importFromJson(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      // Validation minimale du schéma
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return { error: 'Fichier invalide : la racine doit être un objet JSON.' };
      }
      if (!data.companies && !data.schools && !data.missions) {
        return { error: 'Fichier invalide : aucune collection reconnue (companies, missions…).' };
      }
      const ARRAY_KEYS = ['companies','missions','providers','students','formations','subjects'];
      for (const k of ARRAY_KEYS) {
        if (data[k] !== undefined && !Array.isArray(data[k])) {
          return { error: `Fichier invalide : la collection "${k}" devrait être un tableau.` };
        }
      }
      this._db = data;
      this._migrate();
      this._save();
      return { success: true, message: 'Données importées avec succès.' };
    } catch (e) {
      return { error: 'Erreur de lecture du fichier JSON : ' + e.message };
    }
  },

  exportToCsv(yearMonth, options = {}) {
    let missions  = yearMonth ? this.getMissionsByMonth(yearMonth) : this.getMissionsSorted();
    const { poleId, companyId } = options;
    if (poleId || companyId) {
      const coMap = {}; this.getCompanies().forEach(c => coMap[c.id] = c);
      if (poleId) {
        missions = missions.filter(m => {
          const co = coMap[m.companyId];
          if (!co) return false;
          if (co.role === 'own') return co.id === poleId;
          if (co.poleId) return co.poleId === poleId;
          return false;
        });
      }
      if (companyId === '__none__') missions = [];
      else if (companyId) missions = missions.filter(m => m.companyId === companyId);
    }
    const companies = {}; this.getCompanies().forEach(c => companies[c.id] = c.name);
    const providers = {}; this.getProviders().forEach(p => providers[p.id] = `${p.firstName} ${p.lastName}`);

    const header = ['Date','Titre','Type','Société','Prestataire','Début','Fin','Durée (h)',
      'Tarif facturation','Revenu','Tarif prestataire','Coût','Statut','Paiement','Notes'];
    const rows = missions.map(m => {
      // M3 — multi-prestataires : joindre tous les noms
      const pids = m.providerIds?.length ? m.providerIds : (m.providerId ? [m.providerId] : []);
      const provNames = pids.map(pid => providers[pid] || '').filter(Boolean).join(', ');
      const cost = pids.length
        ? Math.round((m.duration || 0) * (m.providerRate || 0) * 100) / 100
        : '';
      return [
        Utils.formatDate(m.date), m.title || '', m.missionType || '',
        companies[m.companyId] || '', provNames,
        m.startTime || '', m.endTime || '', m.duration || 0,
        m.billingRate || 0,
        Math.round((m.duration || 0) * (m.billingRate || 0) * 100) / 100,
        m.providerRate || '', cost,
        m.status || '', m.paymentStatus || '', m.notes || ''
      ];
    });

    const csv = [header, ...rows].map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const suf  = yearMonth ? yearMonth.replace('-', '') : Utils.today().replace(/-/g, '');
    a.href = url;
    a.download = `missions_${suf}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Données de démonstration ─────────────────────────────────

  _loadDemoData() {
    const now = Date.now();

    // ── Sociétés ────────────────────────────────────────────────
    this._db.companies = [
      {
        id: 'co-artemis', name: 'Artémis', color: '#7c3aed',
        role: 'own', type: 'formation',
        address: '15 rue des Lilas, 69001 Lyon', phone: '04 72 00 00 01',
        email: 'contact@artemis-formation.fr',
        contact: 'Direction Artémis', defaultBillingRate: 75,
        notes: 'Structure principale de formation. Gère les formations DIFE et les étudiants en alternance.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'co-asteria', name: 'Astéria', color: '#0891b2',
        role: 'own', type: 'consulting',
        address: '8 avenue de la Paix, 75008 Paris', phone: '01 40 00 00 02',
        email: 'contact@asteria-conseil.fr',
        contact: 'Direction Astéria', defaultBillingRate: 90,
        notes: 'Cabinet de conseil et accompagnement. Interventions ponctuelles et missions longues.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'co-arcadya', name: 'Arcadya', color: '#059669',
        role: 'own', type: 'coaching',
        address: '22 rue du Commerce, 33000 Bordeaux', phone: '05 56 00 00 03',
        email: 'contact@arcadya.fr',
        contact: 'Direction Arcadya', defaultBillingRate: 65,
        notes: 'Coaching professionnel et développement personnel. Ateliers et séminaires.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'co-cnam', name: 'CNAM Saint-Étienne', color: '#1d4ed8',
        role: 'client', type: 'enseignement',
        address: 'IRUP, Rue de Copernic, 42100 Saint-Étienne',
        contact: 'EVOL AGENCY (opérateur de facturation)', defaultBillingRate: 35,
        notes: 'Facturation via EVOL AGENCY. Université du travail / Formation continue.',
        createdAt: now, updatedAt: now
      }
    ];

    // ── Prestataires (fiches centrales) ─────────────────────────
    this._db.providers = [
      {
        id: 'prov-sophie', firstName: 'Sophie', lastName: 'Martin',
        email: 'sophie.martin@example.com', phone: '06 10 00 00 01',
        structure: 'Freelance', specialty: 'Droit du travail / RH',
        defaultHourlyRate: 55, active: true,
        notes: 'Spécialiste droit social. Intervient sur Artémis et CNAM.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'prov-jean', firstName: 'Jean-Pierre', lastName: 'Dubois',
        email: 'jp.dubois@example.com', phone: '06 10 00 00 02',
        structure: 'Cabinet Dubois & Associés', specialty: 'Management / Stratégie',
        defaultHourlyRate: 80, active: true,
        notes: 'Senior manager, 15 ans d\'expérience. Multi-structures.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'prov-camille', firstName: 'Camille', lastName: 'Laurent',
        email: 'camille.laurent@example.com', phone: '06 10 00 00 03',
        structure: 'Indépendante', specialty: 'Communication / Marketing',
        defaultHourlyRate: 60, active: true,
        notes: 'Experte en communication digitale. Arcadya et Astéria.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'prov-thomas', firstName: 'Thomas', lastName: 'Bernard',
        email: 'thomas.bernard@example.com', phone: '06 10 00 00 04',
        structure: 'TBFormation', specialty: 'Informatique / Numérique',
        defaultHourlyRate: 70, active: true,
        notes: 'Formateur numérique. Intervient pour toutes les structures.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'prov-marie', firstName: 'Marie', lastName: 'Leroy',
        email: 'marie.leroy@example.com', phone: '06 10 00 00 05',
        structure: 'Freelance', specialty: 'Droit des contrats',
        defaultHourlyRate: 35, active: true,
        notes: 'Chargée de cours CNAM. Droit des contrats et intro au droit.',
        createdAt: now, updatedAt: now
      }
    ];

    // ── Liens prestataire ↔ société (tarifs spécifiques) ─────────
    this._db.providerLinks = [
      // Sophie Martin
      { id: 'lnk-sophie-artemis', providerId: 'prov-sophie', companyId: 'co-artemis',   hourlyRate: 60, missionTypes: 'course,training', notes: 'Tarif formation', active: true, createdAt: now, updatedAt: now },
      { id: 'lnk-sophie-cnam',    providerId: 'prov-sophie', companyId: 'co-cnam',       hourlyRate: 45, missionTypes: 'course', notes: 'Tarif CNAM', active: true, createdAt: now, updatedAt: now },
      // Jean-Pierre Dubois
      { id: 'lnk-jean-asteria',   providerId: 'prov-jean', companyId: 'co-asteria',      hourlyRate: 90, missionTypes: 'consulting', notes: '', active: true, createdAt: now, updatedAt: now },
      { id: 'lnk-jean-artemis',   providerId: 'prov-jean', companyId: 'co-artemis',      hourlyRate: 75, missionTypes: 'training', notes: '', active: true, createdAt: now, updatedAt: now },
      { id: 'lnk-jean-arcadya',   providerId: 'prov-jean', companyId: 'co-arcadya',      hourlyRate: 85, missionTypes: 'coaching', notes: '', active: true, createdAt: now, updatedAt: now },
      // Camille Laurent
      { id: 'lnk-camille-asteria',  providerId: 'prov-camille', companyId: 'co-asteria', hourlyRate: 65, missionTypes: 'consulting,training', notes: '', active: true, createdAt: now, updatedAt: now },
      { id: 'lnk-camille-arcadya',  providerId: 'prov-camille', companyId: 'co-arcadya', hourlyRate: 55, missionTypes: 'training,workshop', notes: '', active: true, createdAt: now, updatedAt: now },
      // Thomas Bernard
      { id: 'lnk-thomas-artemis',  providerId: 'prov-thomas', companyId: 'co-artemis',   hourlyRate: 70, missionTypes: 'course,training', notes: '', active: true, createdAt: now, updatedAt: now },
      { id: 'lnk-thomas-asteria',  providerId: 'prov-thomas', companyId: 'co-asteria',   hourlyRate: 75, missionTypes: 'consulting', notes: '', active: true, createdAt: now, updatedAt: now },
      { id: 'lnk-thomas-arcadya',  providerId: 'prov-thomas', companyId: 'co-arcadya',   hourlyRate: 65, missionTypes: 'training', notes: '', active: true, createdAt: now, updatedAt: now },
      // Marie Leroy
      { id: 'lnk-marie-cnam',     providerId: 'prov-marie', companyId: 'co-cnam',        hourlyRate: 35, missionTypes: 'course', notes: 'Tarif CNAM standard', active: true, createdAt: now, updatedAt: now },
    ];

    // ── Étudiants Artémis ────────────────────────────────────────
    this._db.students = [
      {
        id: 'stu-01', firstName: 'Lucas', lastName: 'Moreau',
        email: 'lucas.moreau@example.com', phone: '06 20 00 00 01',
        companyId: 'co-artemis', formationIds: ['form-dife-2026'],
        status: 'active', notes: 'Alternant. Entreprise : TechSolutions.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'stu-02', firstName: 'Léa', lastName: 'Petit',
        email: 'lea.petit@example.com', phone: '06 20 00 00 02',
        companyId: 'co-artemis', formationIds: ['form-dife-2026'],
        status: 'active', notes: 'Financement CPF. Assiduité exemplaire.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'stu-03', firstName: 'Maxime', lastName: 'Durand',
        email: 'maxime.durand@example.com', phone: '06 20 00 00 03',
        companyId: 'co-artemis', formationIds: ['form-dife-2026', 'form-mgmt-2026'],
        status: 'active', notes: 'Suivi particulier requis.',
        createdAt: now, updatedAt: now
      }
    ];

    // ── Formations Artémis ───────────────────────────────────────
    this._db.formations = [
      {
        id: 'form-dife-2026', name: 'DIFE 2026 — Droit & Insertion professionnelle',
        companyId: 'co-artemis', type: 'DIFE',
        totalHours: 210, plannedHours: 150, completedHours: 42,
        providerIds: ['prov-sophie', 'prov-thomas'],
        studentIds: ['stu-01', 'stu-02', 'stu-03'],
        startDate: '2026-01-15', endDate: '2026-07-30',
        status: 'in_progress',
        notes: 'Formation inscrite au cadre DIFE. Financement OPCO. 3 apprenants.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'form-mgmt-2026', name: 'Management opérationnel — Parcours 2026',
        companyId: 'co-artemis', type: 'certification',
        totalHours: 120, plannedHours: 80, completedHours: 0,
        providerIds: ['prov-jean'],
        studentIds: ['stu-03'],
        startDate: '2026-04-01', endDate: '2026-09-30',
        status: 'planned',
        notes: 'Parcours certifiant. Démarrage avril 2026.',
        createdAt: now, updatedAt: now
      },
      {
        id: 'form-com-arcadya', name: 'Communication & Prise de parole — Arcadya',
        companyId: 'co-arcadya', type: 'atelier',
        totalHours: 35, plannedHours: 35, completedHours: 7,
        providerIds: ['prov-camille'],
        studentIds: [],
        startDate: '2026-03-10', endDate: '2026-05-20',
        status: 'in_progress',
        notes: 'Ateliers collectifs. Groupe de 8 participants.',
        createdAt: now, updatedAt: now
      }
    ];

    // ── Missions ─────────────────────────────────────────────────
    const baseArtemis = { companyId: 'co-artemis', type: 'presential', status: 'planned',
      paymentStatus: 'unpaid', billingRate: 75, recurringGroupId: null,
      formationId: null, studentIds: [], notes: '', adminNotes: '', createdAt: now, updatedAt: now };
    const baseAsteria = { companyId: 'co-asteria', type: 'presential', status: 'planned',
      paymentStatus: 'unpaid', billingRate: 90, recurringGroupId: null,
      formationId: null, studentIds: [], notes: '', adminNotes: '', createdAt: now, updatedAt: now };
    const baseArcadya = { companyId: 'co-arcadya', type: 'presential', status: 'planned',
      paymentStatus: 'unpaid', billingRate: 65, recurringGroupId: null,
      formationId: null, studentIds: [], notes: '', adminNotes: '', createdAt: now, updatedAt: now };
    const baseCnam    = { companyId: 'co-cnam', type: 'presential', status: 'planned',
      paymentStatus: 'unpaid', billingRate: 35, recurringGroupId: null,
      formationId: null, studentIds: [], notes: '', adminNotes: 'Facturation : EVOL AGENCY', createdAt: now, updatedAt: now };

    this._db.missions = [
      // ── Artémis — Formation DIFE (Sophie Martin) ──────────────
      { ...baseArtemis, id: 'mis-art-01', title: 'DIFE — Module Droit du travail (séance 1)',
        missionType: 'training', subject: 'Droit du travail', providerId: 'prov-sophie',
        providerRate: 60, billingRate: 75, formationId: 'form-dife-2026',
        studentIds: ['stu-01','stu-02','stu-03'],
        date: '2026-04-08', startTime: '09:00', endTime: '12:30', duration: 3.5,
        location: '15 rue des Lilas, Lyon', status: 'done', paymentStatus: 'invoiced' },

      { ...baseArtemis, id: 'mis-art-02', title: 'DIFE — Module Droit du travail (séance 2)',
        missionType: 'training', subject: 'Droit du travail', providerId: 'prov-sophie',
        providerRate: 60, billingRate: 75, formationId: 'form-dife-2026',
        studentIds: ['stu-01','stu-02','stu-03'],
        date: '2026-04-15', startTime: '09:00', endTime: '12:30', duration: 3.5,
        location: '15 rue des Lilas, Lyon', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseArtemis, id: 'mis-art-03', title: 'DIFE — Numérique & Outils collaboratifs',
        missionType: 'training', subject: 'Informatique', providerId: 'prov-thomas',
        providerRate: 70, billingRate: 75, formationId: 'form-dife-2026',
        studentIds: ['stu-01','stu-02','stu-03'],
        date: '2026-04-22', startTime: '14:00', endTime: '17:30', duration: 3.5,
        location: '15 rue des Lilas, Lyon', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseArtemis, id: 'mis-art-04', title: 'Management opérationnel — Séance 1',
        missionType: 'training', subject: 'Management', providerId: 'prov-jean',
        providerRate: 75, billingRate: 75, formationId: 'form-mgmt-2026',
        studentIds: ['stu-03'],
        date: '2026-04-18', startTime: '09:00', endTime: '13:00', duration: 4,
        location: '15 rue des Lilas, Lyon', status: 'planned', paymentStatus: 'unpaid' },

      // ── Astéria — Consulting (Jean-Pierre & Camille) ──────────
      { ...baseAsteria, id: 'mis-ast-01', title: 'Mission stratégie — Diagnostic organisationnel',
        missionType: 'consulting', subject: 'Stratégie', providerId: 'prov-jean',
        providerRate: 90, billingRate: 120,
        date: '2026-04-07', startTime: '10:00', endTime: '13:00', duration: 3,
        location: '8 av. de la Paix, Paris', status: 'done', paymentStatus: 'paid' },

      { ...baseAsteria, id: 'mis-ast-02', title: 'Atelier communication interne',
        missionType: 'training', subject: 'Communication', providerId: 'prov-camille',
        providerRate: 65, billingRate: 90, type: 'visio',
        date: '2026-04-10', startTime: '14:00', endTime: '16:00', duration: 2,
        location: 'Visioconférence', status: 'done', paymentStatus: 'invoiced' },

      { ...baseAsteria, id: 'mis-ast-03', title: 'Formation outils numériques — Astéria',
        missionType: 'training', subject: 'Numérique', providerId: 'prov-thomas',
        providerRate: 75, billingRate: 95,
        date: '2026-04-14', startTime: '09:30', endTime: '12:30', duration: 3,
        location: '8 av. de la Paix, Paris', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseAsteria, id: 'mis-ast-04', title: 'Restitution diagnostic — Comité de direction',
        missionType: 'consulting', subject: 'Stratégie', providerId: 'prov-jean',
        providerRate: 90, billingRate: 120,
        date: '2026-04-28', startTime: '15:00', endTime: '18:00', duration: 3,
        location: '8 av. de la Paix, Paris', status: 'planned', paymentStatus: 'unpaid' },

      // ── Arcadya — Coaching & Ateliers ─────────────────────────
      { ...baseArcadya, id: 'mis-arc-01', title: 'Atelier Prise de parole en public — Séance 1',
        missionType: 'workshop', subject: 'Communication', providerId: 'prov-camille',
        providerRate: 55, billingRate: 65, formationId: 'form-com-arcadya',
        date: '2026-04-09', startTime: '09:00', endTime: '11:00', duration: 2,
        location: '22 rue du Commerce, Bordeaux', status: 'done', paymentStatus: 'paid' },

      { ...baseArcadya, id: 'mis-arc-02', title: 'Atelier Prise de parole en public — Séance 2',
        missionType: 'workshop', subject: 'Communication', providerId: 'prov-camille',
        providerRate: 55, billingRate: 65, formationId: 'form-com-arcadya',
        date: '2026-04-16', startTime: '09:00', endTime: '11:00', duration: 2,
        location: '22 rue du Commerce, Bordeaux', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseArcadya, id: 'mis-arc-03', title: 'Coaching individuel — Prise de fonction',
        missionType: 'coaching', subject: 'Coaching', providerId: 'prov-jean',
        providerRate: 85, billingRate: 95,
        date: '2026-04-11', startTime: '11:00', endTime: '12:30', duration: 1.5,
        location: 'Visioconférence', type: 'visio', status: 'done', paymentStatus: 'unpaid' },

      // ── CNAM Saint-Étienne ─────────────────────────────────────
      { ...baseCnam, id: 'mis-cnam-01', title: 'CC / IOMI / B3 — Droit des contrats',
        missionType: 'course', subject: 'Droit des contrats', level: 'B3',
        providerId: 'prov-marie', providerRate: 35,
        date: '2026-04-06', startTime: '13:00', endTime: '16:30', duration: 3.5,
        location: 'IRUP, Saint-Étienne', status: 'done', paymentStatus: 'paid' },

      { ...baseCnam, id: 'mis-cnam-02', title: 'CC / IOMI / B1 — Introduction au droit',
        missionType: 'course', subject: 'Introduction au droit', level: 'B1',
        providerId: 'prov-marie', providerRate: 35,
        date: '2026-04-13', startTime: '08:30', endTime: '11:30', duration: 3,
        location: 'IRUP, Saint-Étienne', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseCnam, id: 'mis-cnam-03', title: 'Droit des contrats',
        missionType: 'course', subject: 'Droit des contrats', level: '',
        providerId: 'prov-marie', providerRate: 35,
        date: '2026-04-20', startTime: '08:30', endTime: '12:00', duration: 3.5,
        location: 'IRUP, Saint-Étienne', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseCnam, id: 'mis-cnam-04', title: 'Introduction au droit',
        missionType: 'course', subject: 'Introduction au droit', level: 'B1',
        providerId: 'prov-marie', providerRate: 35,
        date: '2026-05-04', startTime: '08:30', endTime: '11:30', duration: 3,
        location: 'IRUP, Saint-Étienne', status: 'planned', paymentStatus: 'unpaid' },

      // ── Missions futures (mai) ────────────────────────────────
      { ...baseArtemis, id: 'mis-art-05', title: 'DIFE — Contrats et responsabilité',
        missionType: 'training', subject: 'Droit', providerId: 'prov-sophie',
        providerRate: 60, billingRate: 75, formationId: 'form-dife-2026',
        studentIds: ['stu-01','stu-02','stu-03'],
        date: '2026-05-06', startTime: '09:00', endTime: '12:30', duration: 3.5,
        location: '15 rue des Lilas, Lyon', status: 'planned', paymentStatus: 'unpaid' },

      { ...baseAsteria, id: 'mis-ast-05', title: 'Séminaire leadership — Astéria',
        missionType: 'training', subject: 'Management', providerId: 'prov-jean',
        providerRate: 90, billingRate: 110,
        date: '2026-05-12', startTime: '09:00', endTime: '17:00', duration: 8,
        location: 'Hôtel Concorde, Paris', status: 'planned', paymentStatus: 'unpaid' },
    ];
  },

  resetToInitialData() {
    this._db = this._emptyDb();
    this._loadDemoData();
    this._save();
  }
};
