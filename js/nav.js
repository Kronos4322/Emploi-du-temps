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
      return (db.companies || []).filter(c => c.role === 'own');
    } catch { return []; }
  }

  let navHTML = '';
  navHTML += section('Navigation');
  navHTML += makeLink('index.html',        '🏠', 'Tableau de bord');
  navHTML += makeLink('calendrier.html',   '📅', 'Calendrier');
  navHTML += section('Référentiels');
  navHTML += makeLink('ecoles.html',       '🏢', 'Sociétés & Écoles');
  navHTML += makeLink('prestataires.html', '👤', 'Prestataires');
  navHTML += makeLink('matieres.html',     '📖', 'Matières & Cours');

  // Une section par société propre (Artémis, Astéria, etc.)
  getOwnCompanies().forEach(co => {
    navHTML += section(co.name);
    navHTML += makeLink('etudiants.html',  '🎓', 'Étudiants');
    navHTML += makeLink('formations.html', '📚', 'Formations');
    navHTML += makeLink(`facturation.html?pole=${co.id}`, '💶', 'Facturation');
    navHTML += makeLink(`finances.html?pole=${co.id}`,    '📊', 'Finances');
  });

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <h1>Emploi du temps</h1>
        <p>Multi-sociétés · Missions · Formation</p>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
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
  if (isIOS && !isStandalone) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e2a3a;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:300;font-size:0.85rem;box-shadow:0 -2px 12px rgba(0,0,0,0.3)';
    banner.innerHTML = `<span style="flex:1">📲 Installez l'app : appuyez sur <strong>⬆ Partager</strong> puis <strong>"Sur l'écran d'accueil"</strong></span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer">✕</button>`;
    document.body.appendChild(banner);
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

  btn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  overlay.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', closeSidebar));
})();
