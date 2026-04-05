// ============================================================
// app.js — Contrôleur principal de l'application
// ============================================================

const App = {

  _currentPage: 'dashboard',

  init() {
    Data.init();
    Calendar.init();
    Courses.init();
    Finances.init();

    this._setupNav();
    this._render();

    // Raccourcis clavier
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') Modals.close();
    });
  },

  // Navigue vers une page
  navigate(page) {
    this._currentPage = page;
    this._updateNav();
    this._render();
    window.scrollTo(0, 0);
  },

  // Rafraîchit la vue courante (après sauvegarde)
  refresh() {
    this._render();
  },

  _setupNav() {
    document.querySelectorAll('[data-page]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.navigate(link.dataset.page);
      });
    });
  },

  _updateNav() {
    document.querySelectorAll('[data-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.page === this._currentPage);
    });
  },

  _render() {
    const content = document.getElementById('main-content');
    if (!content) return;

    let html = '';
    switch (this._currentPage) {
      case 'dashboard': html = Dashboard.render(); break;
      case 'calendar':  html = Calendar.render();  break;
      case 'courses':   html = Courses.render();   break;
      case 'schools':   html = Schools.render();   break;
      case 'providers': html = Providers.render(); break;
      case 'finances':  html = Finances.render();  break;
      case 'settings':  html = this._renderSettings(); break;
      default:          html = Dashboard.render();
    }

    content.innerHTML = html;
    this._updateNav();

    // Scroll la semaine vers les heures de travail (vue semaine)
    if (this._currentPage === 'calendar' && (Calendar._view === 'week' || Calendar._view === 'day')) {
      const body = document.querySelector('.week-body, .day-body');
      // La grille est 900px pour 15h (7h–22h), 1h = 60px. Scroll vers 8h = (8-7)*60 = 60px
      if (body) body.scrollTop = 60;
    }
  },

  _renderSettings() {
    const s = Data.getSettings();
    return `
      <div class="page-header">
        <h1 class="page-title">Paramètres & Données</h1>
      </div>

      <div class="settings-grid">

        <div class="card">
          <div class="card-header"><h2 class="card-title">Paramètres généraux</h2></div>
          <div class="card-body">
            <div class="form-grid">
              <div class="form-group form-col-2">
                <label>Tarif horaire par défaut (€/h)</label>
                <input type="number" id="set-rate" class="form-input" value="${s.defaultBillingRate || 50}" min="0" step="0.5">
              </div>
            </div>
            <div class="settings-actions">
              <button class="btn btn-primary" onclick="App._saveSettings()">Enregistrer</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Sauvegarde & Export</h2></div>
          <div class="card-body">
            <p class="settings-description">
              Exportez vos données en JSON pour les sauvegarder sur votre Drive ou les transférer.
              L'import JSON restaure toutes vos données (écoles, prestataires, cours).
            </p>
            <div class="settings-actions">
              <button class="btn btn-primary" onclick="Data.exportToJson()">⬇ Exporter tout (JSON)</button>
              <button class="btn btn-ghost" onclick="Data.exportToCsv()">⬇ Exporter cours (CSV)</button>
              <label class="btn btn-ghost" style="cursor:pointer">
                ⬆ Importer (JSON)
                <input type="file" accept=".json" style="display:none" onchange="App._importJson(this)">
              </label>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Informations</h2></div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Cours</span>
                <span class="info-value">${Data.getCourses().length}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Écoles</span>
                <span class="info-value">${Data.getSchools().length}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Prestataires</span>
                <span class="info-value">${Data.getProviders().length}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Stockage utilisé</span>
                <span class="info-value">${this._storageUsed()}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Données initiales</h2></div>
          <div class="card-body">
            <p class="settings-description">
              Recharge les données de départ (CNAM Saint-Étienne, 15 cours réels). <strong>Efface toutes les données actuelles.</strong> Exportez d'abord si nécessaire.
            </p>
            <div class="settings-actions">
              <button class="btn btn-ghost" onclick="App._reloadInitialData()">↺ Recharger les données initiales</button>
            </div>
          </div>
        </div>

        <div class="card card-danger">
          <div class="card-header"><h2 class="card-title">Zone de danger</h2></div>
          <div class="card-body">
            <p class="settings-description danger-text">
              Attention : efface toutes les données (cours, écoles, prestataires). Irréversible.
            </p>
            <div class="settings-actions">
              <button class="btn btn-danger" onclick="App._resetData()">Effacer toutes les données</button>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  _saveSettings() {
    const rate = parseFloat(document.getElementById('set-rate').value) || 50;
    Data.saveSettings({ defaultBillingRate: rate });
    Utils.toast('Paramètres enregistrés.', 'success');
  },

  _importJson(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const result = Data.importFromJson(e.target.result);
      if (result.error) {
        Utils.toast(result.error, 'error');
      } else {
        Utils.toast(result.message, 'success');
        App.navigate('dashboard');
      }
    };
    reader.readAsText(file);
  },

  _reloadInitialData() {
    Modals.confirm(
      'Recharger les données initiales (CNAM Saint-Étienne, 15 cours) ? Toutes les données actuelles seront effacées.',
      () => {
        Data.resetToInitialData();
        Utils.toast('Données initiales rechargées.', 'success');
        App.navigate('dashboard');
      },
      'Recharger',
      false
    );
  },

  _resetData() {
    Modals.confirm(
      'Effacer TOUTES les données ? Cette action est irréversible. Exportez d\'abord votre sauvegarde.',
      () => {
        localStorage.removeItem('emploi_du_temps_db');
        Utils.toast('Données effacées.', 'success');
        setTimeout(() => location.reload(), 800);
      },
      'Effacer définitivement',
      true
    );
  },

  _storageUsed() {
    try {
      const bytes = (localStorage.getItem('emploi_du_temps_db') || '').length * 2;
      if (bytes < 1024) return `${bytes} o`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
    } catch { return '—'; }
  }
};

// Lancement de l'application au chargement de la page
window.addEventListener('DOMContentLoaded', () => App.init());
