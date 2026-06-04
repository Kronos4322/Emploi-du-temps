// ============================================================
// utils.js — Fonctions utilitaires partagées
// ============================================================

const Utils = {

  // Génère un identifiant unique (UUID v4 simplifié)
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  // Formate une date ISO (YYYY-MM-DD) en affichage français (DD/MM/YYYY)
  formatDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  },

  // Formate une date ISO en label court (ex: "lun. 3 avr.")
  formatDateShort(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  },

  // Formate une date ISO en label long (ex: "lundi 3 avril 2026")
  formatDateLong(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  },

  // Retourne le mois/année d'une date ISO (ex: "Avril 2026")
  formatMonthYear(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  },

  // Convertit "HH:MM" en minutes depuis minuit
  timeToMinutes(time) {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  },

  // Convertit des minutes depuis minuit en "HH:MM"
  minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  // Calcule la durée en heures entre deux horaires "HH:MM"
  calcDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const diff = this.timeToMinutes(endTime) - this.timeToMinutes(startTime);
    return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
  },

  // Formate une durée en heures en texte lisible (ex: "1h30")
  formatDuration(hours) {
    if (!hours || hours <= 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  },

  // Formate un montant en euros
  formatMoney(amount) {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  },

  // Retourne la date du jour en YYYY-MM-DD (heure locale, pas UTC)
  today() {
    return this.localISO(new Date());
  },

  // Retourne l'année-mois du jour (YYYY-MM)
  currentYearMonth() {
    return this.today().substring(0, 7);
  },

  // Détermine si une date ISO est aujourd'hui
  isToday(isoDate) {
    return isoDate === this.today();
  },

  // Compare deux dates ISO
  dateCompare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  },

  // Retourne la date locale au format YYYY-MM-DD
  localISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  },

  // Retourne le lundi de la semaine contenant la date ISO donnée
  getWeekStart(isoDate) {
    const date = new Date(isoDate + 'T00:00:00');
    const day = date.getDay(); // 0=dim, 1=lun, ...
    const diff = (day === 0 ? -6 : 1 - day);
    date.setDate(date.getDate() + diff);
    return this.localISO(date);
  },

  // Ajoute N jours à une date ISO, retourne ISO
  addDays(isoDate, n) {
    const date = new Date(isoDate + 'T00:00:00');
    date.setDate(date.getDate() + n);
    return this.localISO(date);
  },

  // Retourne le premier jour du mois d'une date ISO
  getMonthStart(isoDate) {
    return isoDate.substring(0, 7) + '-01';
  },

  // Retourne le dernier jour du mois d'une date ISO
  getMonthEnd(isoDate) {
    const [y, m] = isoDate.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  },

  // Retourne les N mois précédents au format YYYY-MM (y compris le mois courant)
  getRecentMonths(n = 12) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  },

  // Sécurise une chaîne pour l'insertion HTML
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // Crée un élément DOM avec classes et attributs optionnels
  el(tag, classes = '', attrs = {}) {
    const e = document.createElement(tag);
    if (classes) e.className = classes;
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  },

  // Affiche une notification toast temporaire
  toast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // Couleur de texte contrastée (noir ou blanc) selon la couleur de fond
  contrastColor(hexBg) {
    const r = parseInt(hexBg.slice(1, 3), 16);
    const g = parseInt(hexBg.slice(3, 5), 16);
    const b = parseInt(hexBg.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1e293b' : '#ffffff';
  },

  // Éclaircit une couleur hex pour les fonds
  lightenColor(hex, amount = 0.85) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  },

  // Noms des jours et mois en français
  DAYS_SHORT: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  DAYS_LONG: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  MONTHS_LONG: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],

  // Retourne le nom du mois (0-indexé)
  monthName(monthIndex) {
    return this.MONTHS_LONG[monthIndex] || '';
  },

  // Génère les couleurs par défaut proposées pour les sociétés
  PRESET_COLORS: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
    '#84cc16', '#a855f7', '#0ea5e9', '#d946ef', '#22c55e',
    '#7c3aed', '#0891b2', '#059669', '#dc2626', '#d97706'
  ],

  // Types de missions
  MISSION_TYPES: {
    course:     { label: 'Cours',             icon: '📚' },
    training:   { label: 'Formation',         icon: '🎓' },
    consulting: { label: 'Consulting',        icon: '💼' },
    coaching:   { label: 'Coaching',          icon: '🎯' },
    workshop:   { label: 'Atelier',           icon: '🛠' },
    vacation:   { label: 'Vacation',          icon: '📋' },
    admin:      { label: 'Administratif',     icon: '📁' },
    personal:   { label: 'Personnel',         icon: '🧑' },
    forfait:    { label: 'Forfait',           icon: '💰' },
    other:      { label: 'Autre',             icon: '📌' },
  },

  getMissionTypeLabel(type) {
    return (this.MISSION_TYPES[type] || { label: type || 'Autre' }).label;
  },

  getMissionTypeIcon(type) {
    return (this.MISSION_TYPES[type] || { icon: '📌' }).icon;
  },

  // Rôle d'une société : notre structure ou client/école externe
  COMPANY_ROLES: {
    own:    'Notre société',
    client: 'École / Client',
  },

  // Types de sociétés
  COMPANY_TYPES: {
    formation:    'Formation',
    consulting:   'Consulting',
    coaching:     'Coaching',
    enseignement: 'Enseignement',
    other:        'Autre',
  },

  // Statuts formations
  FORMATION_STATUSES: {
    planned:     { label: 'Planifiée',    cls: 'badge-planned' },
    in_progress: { label: 'En cours',     cls: 'badge-invoiced' },
    active:      { label: 'Active',       cls: 'badge-done' },
    completed:   { label: 'Terminée',     cls: 'badge-success' },
    cancelled:   { label: 'Annulée',      cls: 'badge-cancelled' },
  },

  getFormationStatusLabel(s) { return (this.FORMATION_STATUSES[s] || { label: s }).label; },
  getFormationStatusClass(s) { return (this.FORMATION_STATUSES[s] || { cls: '' }).cls; },

};

// ── Menus déroulants & export CSV (partagés toutes pages) ─────
window._toggleMenu = id => {
  document.querySelectorAll('[id^="pmenu-"],[id^="smenu-"]').forEach(el => {
    if (el.id !== id) el.style.display = 'none';
  });
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};
document.addEventListener('click', () =>
  document.querySelectorAll('[id^="pmenu-"],[id^="smenu-"]').forEach(el => el.style.display = 'none')
);

window._downloadCSV = (rows, filename) => {
  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = filename;
  a.click();
};
