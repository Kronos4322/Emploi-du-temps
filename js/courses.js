// ============================================================
// courses.js — Vue liste des cours avec filtres
// ============================================================

const Courses = {

  _filters: {
    search: '',
    schoolId: '',
    providerId: '',
    subject: '',
    status: '',
    paymentStatus: '',
    yearMonth: '',
  },

  init() {
    this._filters.yearMonth = Utils.currentYearMonth();
  },

  render() {
    const schools = Data.getSchools();
    const providers = Data.getProviders();

    // Options de mois disponibles
    const monthOptions = Utils.getRecentMonths(18).map(ym => {
      const [y, m] = ym.split('-');
      const label = `${Utils.MONTHS_LONG[parseInt(m) - 1]} ${y}`;
      return `<option value="${ym}" ${this._filters.yearMonth === ym ? 'selected' : ''}>${label}</option>`;
    }).join('');

    // Sujets disponibles
    const subjects = [...new Set(Data.getCourses().map(c => c.subject).filter(Boolean))].sort();

    const schoolOptions = `<option value="">Toutes les écoles</option>` +
      schools.map(s => `<option value="${s.id}" ${this._filters.schoolId === s.id ? 'selected' : ''}>${Utils.escapeHtml(s.name)}</option>`).join('');

    const providerOptions = `<option value="">Tous les prestataires</option>` +
      providers.map(p => `<option value="${p.id}" ${this._filters.providerId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.lastName + ' ' + p.firstName)}</option>`).join('');

    const subjectOptions = `<option value="">Toutes les matières</option>` +
      subjects.map(s => `<option value="${s}" ${this._filters.subject === s ? 'selected' : ''}>${Utils.escapeHtml(s)}</option>`).join('');

    const filtered = this._getFilteredCourses(schools, providers);
    const totalHours = filtered.reduce((s, c) => s + (c.duration || 0), 0);
    const totalRevenue = filtered.filter(c => c.status === 'done').reduce((s, c) => s + (c.duration || 0) * (c.billingRate || 0), 0);

    const schoolsMap = {};
    schools.forEach(s => schoolsMap[s.id] = s);
    const providersMap = {};
    providers.forEach(p => providersMap[p.id] = p);

    return `
      <div class="page-header">
        <h1 class="page-title">Cours</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Modals.openCourse()">+ Nouveau cours</button>
        </div>
      </div>

      <!-- Filtres -->
      <div class="filters-bar">
        <input type="text" class="form-input filter-search" placeholder="🔍 Rechercher..." id="filter-search"
               value="${Utils.escapeHtml(this._filters.search)}" oninput="Courses._onSearch(this.value)">
        <select class="form-input filter-select" onchange="Courses._setFilter('yearMonth', this.value)">
          <option value="">Tous les mois</option>
          ${monthOptions}
        </select>
        <select class="form-input filter-select" onchange="Courses._setFilter('schoolId', this.value)">
          ${schoolOptions}
        </select>
        <select class="form-input filter-select" onchange="Courses._setFilter('providerId', this.value)">
          ${providerOptions}
        </select>
        <select class="form-input filter-select" onchange="Courses._setFilter('subject', this.value)">
          ${subjectOptions}
        </select>
        <select class="form-input filter-select" onchange="Courses._setFilter('status', this.value)">
          <option value="">Tous les statuts</option>
          <option value="planned" ${this._filters.status === 'planned' ? 'selected' : ''}>Prévu</option>
          <option value="done" ${this._filters.status === 'done' ? 'selected' : ''}>Réalisé</option>
          <option value="cancelled" ${this._filters.status === 'cancelled' ? 'selected' : ''}>Annulé</option>
          <option value="postponed" ${this._filters.status === 'postponed' ? 'selected' : ''}>Reporté</option>
          <option value="moved" ${this._filters.status === 'moved' ? 'selected' : ''}>Déplacé</option>
        </select>
        <select class="form-input filter-select" onchange="Courses._setFilter('paymentStatus', this.value)">
          <option value="">Tous paiements</option>
          <option value="unpaid" ${this._filters.paymentStatus === 'unpaid' ? 'selected' : ''}>Non payé</option>
          <option value="invoiced" ${this._filters.paymentStatus === 'invoiced' ? 'selected' : ''}>Facturé</option>
          <option value="paid" ${this._filters.paymentStatus === 'paid' ? 'selected' : ''}>Payé</option>
        </select>
        <button class="btn btn-ghost" onclick="Courses._resetFilters()">Réinitialiser</button>
      </div>

      <!-- Résumé filtré -->
      <div class="list-summary">
        <span>${filtered.length} cours</span>
        <span>·</span>
        <span>${Utils.formatDuration(totalHours)} au total</span>
        <span>·</span>
        <span>${Utils.formatMoney(totalRevenue)} réalisé</span>
      </div>

      <!-- Tableau -->
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Titre</th>
              <th>École</th>
              <th>Horaires</th>
              <th>Durée</th>
              <th>Statut</th>
              <th>Paiement</th>
              <th>Revenu</th>
              <th>Prestataire</th>
              <th>Coût</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="11" class="empty-state-cell">Aucun cours trouvé.</td></tr>`
              : filtered.map(c => this._row(c, schoolsMap, providersMap)).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  _row(course, schools, providers) {
    const school = schools[course.schoolId];
    const provider = providers[course.providerId];
    const color = school ? school.color : '#94a3b8';
    const revenue = (course.duration || 0) * (course.billingRate || 0);
    const providerCost = course.providerId ? (course.duration || 0) * (course.providerRate || 0) : null;

    const STATUS_LABELS = {
      planned: ['Prévu', 'badge-planned'],
      done: ['Réalisé', 'badge-done'],
      cancelled: ['Annulé', 'badge-cancelled'],
      postponed: ['Reporté', 'badge-warning'],
      moved: ['Déplacé', 'badge-warning']
    };
    const PAYMENT_LABELS = {
      unpaid: ['Non payé', 'badge-danger'],
      invoiced: ['Facturé', 'badge-invoiced'],
      paid: ['Payé', 'badge-success']
    };

    const [statusLabel, statusClass] = STATUS_LABELS[course.status] || [course.status, ''];
    const [payLabel, payClass] = PAYMENT_LABELS[course.paymentStatus] || [course.paymentStatus, ''];

    return `
      <tr class="table-row ${course.status === 'cancelled' ? 'row-cancelled' : ''}"
          onclick="Modals.openCourse('${course.id}')">
        <td class="cell-date">${Utils.formatDate(course.date)}</td>
        <td class="cell-title">
          <div class="title-with-dot">
            <span class="school-dot" style="background:${color}"></span>
            <span>${Utils.escapeHtml(course.title)}</span>
            ${course.type === 'visio' ? `<span class="badge badge-visio badge-sm">Visio</span>` : ''}
            ${course.recurringGroupId ? `<span class="badge badge-recurring badge-sm" title="Cours récurrent">↺</span>` : ''}
          </div>
          ${course.subject ? `<div class="cell-subtitle">${Utils.escapeHtml(course.subject)}${course.level ? ' · ' + Utils.escapeHtml(course.level) : ''}</div>` : ''}
        </td>
        <td>
          ${school ? `<span class="school-tag" style="background:${Utils.lightenColor(color)};color:${color};border:1px solid ${color}">${Utils.escapeHtml(school.name)}</span>` : '—'}
        </td>
        <td class="cell-time">${course.startTime} – ${course.endTime}</td>
        <td class="cell-center">${Utils.formatDuration(course.duration)}</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td><span class="badge ${payClass}">${payLabel}</span></td>
        <td class="cell-money">${course.status !== 'cancelled' ? Utils.formatMoney(revenue) : '—'}</td>
        <td class="cell-provider">${provider ? Utils.escapeHtml(provider.lastName + ' ' + provider.firstName) : '—'}</td>
        <td class="cell-money cell-cost">${providerCost !== null ? Utils.formatMoney(providerCost) : '—'}</td>
        <td class="cell-actions" onclick="event.stopPropagation()">
          <button class="btn-icon-sm" onclick="Modals.openCourse('${course.id}')" title="Modifier">✎</button>
          <button class="btn-icon-sm btn-icon-danger" onclick="Courses._deleteCourse('${course.id}')" title="Supprimer">✕</button>
        </td>
      </tr>
    `;
  },

  _getFilteredCourses(schools, providers) {
    let courses = Data.getCoursesSorted();
    const f = this._filters;

    if (f.yearMonth) courses = courses.filter(c => c.date && c.date.startsWith(f.yearMonth));
    if (f.schoolId) courses = courses.filter(c => c.schoolId === f.schoolId);
    if (f.providerId) courses = courses.filter(c => c.providerId === f.providerId);
    if (f.subject) courses = courses.filter(c => c.subject === f.subject);
    if (f.status) courses = courses.filter(c => c.status === f.status);
    if (f.paymentStatus) courses = courses.filter(c => c.paymentStatus === f.paymentStatus);
    if (f.search) {
      const q = f.search.toLowerCase();
      courses = courses.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.subject || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    }

    return courses;
  },

  _setFilter(key, value) {
    this._filters[key] = value;
    App.refresh();
  },

  _onSearch(value) {
    this._filters.search = value;
    // Debounce léger
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => App.refresh(), 200);
  },

  _resetFilters() {
    this._filters = {
      search: '',
      schoolId: '',
      providerId: '',
      subject: '',
      status: '',
      paymentStatus: '',
      yearMonth: Utils.currentYearMonth(),
    };
    App.refresh();
  },

  _deleteCourse(id) {
    Modals.confirm('Supprimer ce cours définitivement ?', () => {
      Data.deleteCourse(id);
      Utils.toast('Cours supprimé.', 'success');
      App.refresh();
    });
  }
};
