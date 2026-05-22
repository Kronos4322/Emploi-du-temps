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
    if      (typeof renderDashboard  === 'function') renderDashboard();
    else if (typeof renderCalendar   === 'function') renderCalendar();
    else if (typeof render           === 'function') render();
    else if (typeof renderPage       === 'function') renderPage();
    else location.reload();
  } catch(e) { location.reload(); }
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
    // 2. Synchronisation Firebase
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
      if (!fbData || !fbData._updatedAt) {
        // Firebase vide → push local si on a des données (toutes collections confondues)
        const hasLocal = (this._db.companies||[]).length + (this._db.missions||[]).length +
          (this._db.providers||[]).length + (this._db.students||[]).length +
          (this._db.formations||[]).length > 0;
        if (hasLocal) this._pushToFirebase();
        return;
      }
      _fbLastTs = fbData._updatedAt;
      // Timestamp local persisté séparément pour survivre au rechargement
      const localTs = parseInt(localStorage.getItem('_edt_ts') || '0');
      if (_fbLastTs > localTs) {
        // Firebase plus récent → TOUJOURS l'utiliser (suppressions incluses)
        // Détecter les sociétés sans rôle avant migration pour repousser ensuite
        const hadMissingRoles = (fbData.companies || []).some(c => !c.role);
        this._db = fbData;
        this._migrate();
        localStorage.setItem(DB_KEY, JSON.stringify(this._db));
        localStorage.setItem('_edt_ts', String(_fbLastTs));
        _reRenderPage();
        // Si la migration a dû assigner des rôles manquants, persister dans Firebase
        if (hadMissingRoles) this._pushToFirebase();
      } else if (localTs > _fbLastTs) {
        // Local plus récent → on pousse vers Firebase
        this._pushToFirebase();
      }
      // Si égaux → rien à faire
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
      },
      properties: [],      // appartements / biens locatifs
      rentalIncomes: [],   // revenus locatifs mensuels
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

    // Migration one-shot : ré-attribuer les missions pôle → société cliente
    // Crée les sociétés clientes si elles n'existent pas encore
    if (!this._db._poleAssignmentsFixed) {
      const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
      const findCo = partial => this._db.companies.find(c => norm(c.name).includes(norm(partial)));
      const now = Date.now();

      // Pôles sources
      const artemis = this._db.companies.find(c => c.role==='own' && norm(c.name).includes('artem'));
      const asteria = this._db.companies.find(c => c.role==='own' && norm(c.name).includes('aster'));

      // Société cible Artémis : "Cours particuliers" — créée si absente
      let courspart = findCo('cours particuliers');
      if (!courspart && artemis) {
        courspart = { id: 'co-cours-part', name: 'Cours particuliers', role: 'client',
          poleId: artemis.id, color: '#f97316', type: 'enseignement',
          createdAt: now, updatedAt: now };
        this._db.companies.push(courspart);
      }

      // Société cible Astéria : "Formations géopolitiques" — créée si absente
      let geopolit = findCo('geopolit') || findCo('geopolitique');
      if (!geopolit && asteria) {
        geopolit = { id: 'co-formations-geo', name: 'Formations géopolitiques', role: 'client',
          poleId: asteria.id, color: '#0891b2', type: 'enseignement',
          createdAt: now, updatedAt: now };
        this._db.companies.push(geopolit);
      }

      const mapping = {};
      if (artemis && courspart && artemis.id !== courspart.id) mapping[artemis.id] = courspart.id;
      if (asteria && geopolit  && asteria.id !== geopolit.id)  mapping[asteria.id]  = geopolit.id;

      if (Object.keys(mapping).length > 0) {
        this._db.missions = (this._db.missions||[]).map(m => {
          if (mapping[m.companyId]) return { ...m, companyId: mapping[m.companyId], updatedAt: now };
          return m;
        });
      }
      this._db._poleAssignmentsFixed = true;
    }
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
      localStorage.setItem(DB_KEY, JSON.stringify(this._db));
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
    return [...this._db.companies].sort((a, b) => a.name.localeCompare(b.name));
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
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
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
    const linked = this._db.missions.filter(m => m.providerId === id);
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
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
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
    return [...this._db.formations].sort((a, b) => a.name.localeCompare(b.name));
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
    return [...this._db.subjects].sort((a, b) => a.name.localeCompare(b.name));
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
    return [...this._db.subjectCategories].sort((a,b) => a.name.localeCompare(b.name));
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
    return [...(this._db.properties||[])].sort((a, b) => a.name.localeCompare(b.name));
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
    const rows = missions.map(m => [
      Utils.formatDate(m.date), m.title || '', m.missionType || '',
      companies[m.companyId] || '', providers[m.providerId] || '',
      m.startTime || '', m.endTime || '', m.duration || 0,
      m.billingRate || 0,
      Math.round((m.duration || 0) * (m.billingRate || 0) * 100) / 100,
      m.providerRate || '',
      m.providerId ? Math.round((m.duration || 0) * (m.providerRate || 0) * 100) / 100 : '',
      m.status || '', m.paymentStatus || '', m.notes || ''
    ]);

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
