// ============================================================
// schools.js — Vue gestion des écoles / structures
// ============================================================

const Schools = {

  render() {
    const schools = Data.getSchools();
    const allCourses = Data.getCourses();

    return `
      <div class="page-header">
        <h1 class="page-title">Écoles & Structures</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Modals.openSchool()">+ Nouvelle école</button>
        </div>
      </div>

      ${schools.length === 0
        ? `<div class="empty-page">
            <div class="empty-icon">🏫</div>
            <h2>Aucune école enregistrée</h2>
            <p>Créez votre première école pour commencer à organiser vos cours.</p>
            <button class="btn btn-primary" onclick="Modals.openSchool()">+ Créer une école</button>
           </div>`
        : `<div class="cards-grid">
            ${schools.map(s => this._schoolCard(s, allCourses)).join('')}
           </div>`
      }
    `;
  },

  _schoolCard(school, allCourses) {
    const courses = allCourses.filter(c => c.schoolId === school.id);
    const done = courses.filter(c => c.status === 'done');
    const planned = courses.filter(c => c.status === 'planned');
    const totalHours = done.reduce((s, c) => s + (c.duration || 0), 0);
    const totalRevenue = done.reduce((s, c) => s + (c.duration || 0) * (c.billingRate || 0), 0);
    const currentMonth = Utils.currentYearMonth();
    const monthCourses = done.filter(c => c.date && c.date.startsWith(currentMonth));
    const monthRevenue = monthCourses.reduce((s, c) => s + (c.duration || 0) * (c.billingRate || 0), 0);

    const textColor = Utils.contrastColor(school.color);
    const lightBg = Utils.lightenColor(school.color, 0.90);

    return `
      <div class="school-card" onclick="Modals.openSchool('${school.id}')">
        <div class="school-card-header" style="background:${school.color};color:${textColor}">
          <div class="school-color-dot" style="background:${school.color};border:2px solid ${textColor}40"></div>
          <div class="school-card-title">
            <h3>${Utils.escapeHtml(school.name)}</h3>
            ${school.contact ? `<span class="school-contact">${Utils.escapeHtml(school.contact)}</span>` : ''}
          </div>
          <button class="btn-edit-school" style="color:${textColor};" onclick="event.stopPropagation();Modals.openSchool('${school.id}')">✎</button>
        </div>
        <div class="school-card-body">
          ${school.address ? `<div class="school-info-row">📍 ${Utils.escapeHtml(school.address)}</div>` : ''}
          ${school.defaultBillingRate ? `<div class="school-info-row">💶 Tarif : ${Utils.formatMoney(school.defaultBillingRate)}/h</div>` : ''}
          ${school.notes ? `<div class="school-info-row school-notes">${Utils.escapeHtml(school.notes)}</div>` : ''}

          <div class="school-stats">
            <div class="school-stat">
              <div class="school-stat-value">${courses.length}</div>
              <div class="school-stat-label">Cours total</div>
            </div>
            <div class="school-stat">
              <div class="school-stat-value">${planned.length}</div>
              <div class="school-stat-label">Prévus</div>
            </div>
            <div class="school-stat">
              <div class="school-stat-value" style="color:${school.color}">${Utils.formatMoney(monthRevenue)}</div>
              <div class="school-stat-label">Ce mois</div>
            </div>
            <div class="school-stat">
              <div class="school-stat-value">${Utils.formatMoney(totalRevenue)}</div>
              <div class="school-stat-label">Total réalisé</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
