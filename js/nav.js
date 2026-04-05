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
    if (co.defaultBillingRate === 35) {
      navHTML += makeLink('etudiants.html',  '🎓', 'Étudiants');
      navHTML += makeLink('formations.html', '📚', 'Formations');
    }
    navHTML += makeLink(`facturation.html?pole=${co.id}`, '💶', 'Facturation');
    navHTML += makeLink(`finances.html?pole=${co.id}`,    '📊', 'Finances');
  });

  navHTML += section('Analyse');
  navHTML += makeLink('facturation.html', '💶', 'Facturation');
  navHTML += makeLink('finances.html',    '📊', 'Finances');

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <h1>Emploi du temps</h1>
        <p>Multi-sociétés · Missions · Formation</p>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
      <div class="sidebar-footer">${makeLink(FOOTER_ITEM.href, FOOTER_ITEM.icon, FOOTER_ITEM.label)}</div>
    `;
  }
})();
