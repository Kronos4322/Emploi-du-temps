// ============================================================
// nav.js — Barre de navigation latérale partagée
// ============================================================

(function () {
  const FOOTER_ITEM = { href: 'parametres.html', icon: '⚙', label: 'Paramètres & Données' };
  const currentFile = (window.location.pathname.split('/').pop() || 'index.html') + window.location.search;

  function makeLink(href, icon, label) {
    const base = href.split('?')[0];
    const currentBase = currentFile.split('?')[0];
    const currentPole = new URLSearchParams(currentFile.split('?')[1]||'').get('pole')||'';
    const hrefPole    = new URLSearchParams(href.split('?')[1]||'').get('pole')||'';
    const isActive = base === currentBase && hrefPole === currentPole;
    return `<a class="nav-link${isActive ? ' active' : ''}" href="${href}">
      <span class="nav-icon">${icon}</span>${label}
    </a>`;
  }
  function section(label) {
    return `<div class="nav-section-label">${label}</div>`;
  }

  function getOwnCompanies() {
    try {
      const db = JSON.parse(localStorage.getItem('emploi_du_temps_db') || '{}');
      const cos = (db.companies || []).filter(c => c.role === 'own');
      // Marquer si le pôle a des étudiants rattachés
      cos.forEach(co => {
        co._hasStudents = (db.students || []).some(s => (s.poleId || s.companyId) === co.id);
      });
      return cos;
    } catch { return []; }
  }

  function buildNavHTML() {
    let html = '';
    html += section('Navigation');
    html += makeLink('index.html',        '🏠', 'Tableau de bord');
    html += makeLink('calendrier.html',   '📅', 'Calendrier');
    html += section('Référentiels');
    html += makeLink('ecoles.html',       '🏢', 'Sociétés & Écoles');
    html += makeLink('prestataires.html', '👤', 'Prestataires');
    html += makeLink('matieres.html',     '📖', 'Matières & Cours');
    // Une section par société propre (Artémis, Astéria, etc.)
    getOwnCompanies().forEach(co => {
      html += section(co.name);
      if (co._hasStudents) {
        html += makeLink('etudiants.html',  '🎓', 'Étudiants');
        html += makeLink('formations.html', '📚', 'Formations');
      }
      html += makeLink(`facturation.html?pole=${co.id}`, '💶', 'Facturation');
      html += makeLink(`finances.html?pole=${co.id}`,    '📊', 'Finances');
    });
    html += section('Personnel interne');
    html += makeLink('personnel.html', '👥', 'Salaires & Charges');
    html += section('Revenus personnels');
    html += makeLink('location.html', '🏠', 'Location');
    return html;
  }

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <h1>Emploi du temps</h1>
        <p>Multi-sociétés · Missions · Formation</p>
      </div>
      <nav class="sidebar-nav" id="sidebar-nav">${buildNavHTML()}</nav>
      <div class="sidebar-footer">
        ${makeLink(FOOTER_ITEM.href, FOOTER_ITEM.icon, FOOTER_ITEM.label)}
        <button id="btn-install-pwa" onclick="if(_installPrompt){_installPrompt.prompt()}" style="display:none;width:100%;margin-top:8px;padding:10px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;align-items:center;justify-content:center;gap:8px">📲 Installer l'application</button>
        <div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:0.75rem;color:#64748b;text-align:center">
          Partagez le lien :<br>
          <a href="https://kronos4322.github.io/Emploi-du-temps/" target="_blank" style="color:#3b82f6;word-break:break-all;font-size:0.7rem">kronos4322.github.io/Emploi-du-temps/</a>
        </div>
      </div>
    `;
  }

  // ── Bouton installation PWA ───────────────────────────────
  let _installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installPrompt = e;
    const btn = document.getElementById('btn-install-pwa');
    if (btn) btn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('btn-install-pwa');
    if (btn) btn.remove();
  });

  // iOS : détecter Safari sans PWA installée
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIOS && !isStandalone && !localStorage.getItem('_edt_ios_banner_dismissed')) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e2a3a;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:300;font-size:0.85rem;box-shadow:0 -2px 12px rgba(0,0,0,0.3)';
    banner.innerHTML = `<span style="flex:1">📲 Installez l'app : appuyez sur <strong>⬆ Partager</strong> puis <strong>"Sur l'écran d'accueil"</strong></span><button id="ios-banner-close" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer">✕</button>`;
    document.body.appendChild(banner);
    document.getElementById('ios-banner-close').addEventListener('click', () => {
      localStorage.setItem('_edt_ios_banner_dismissed', '1');
      banner.remove();
    });
  }

  // ── Hamburger mobile ──────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'hamburger';
  btn.innerHTML = '☰';
  btn.setAttribute('aria-label', 'Menu');
  document.body.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function openSidebar()  { sidebar.classList.add('open'); overlay.classList.add('open'); btn.innerHTML = '✕'; }
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); btn.innerHTML = '☰'; }

  // Exposer pour modals.js : rafraîchit uniquement la nav après création/suppression de société
  window._refreshSidebar = function() {
    const navEl = document.getElementById('sidebar-nav');
    if (navEl) {
      navEl.innerHTML = buildNavHTML();
      navEl.querySelectorAll('a, button').forEach(el => el.addEventListener('click', closeSidebar));
    }
  };

  btn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  overlay.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('a, button').forEach(el => el.addEventListener('click', closeSidebar));
})();

// Toast de synchronisation Firebase (accessible depuis data.js via window)
let _syncErrorShown = false;
window._showSyncError = function() {
  if (_syncErrorShown) return; // dédupliquer
  _syncErrorShown = true;
  const t = document.createElement('div');
  t.textContent = '⚠ Synchronisation cloud impossible — données sauvegardées localement.';
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:8px;' +
    'background:#f59e0b;color:#fff;font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:9999;transition:opacity .3s';
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => { t.remove(); _syncErrorShown = false; }, 300);
  }, 4000);
};
