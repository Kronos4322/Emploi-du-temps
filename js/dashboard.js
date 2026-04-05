// ============================================================
// dashboard.js — Vue tableau de bord
// ============================================================

const Dashboard = {

  render() {
    const data = Data.getDashboardData();
    const schools = {};
    Data.getSchools().forEach(s => schools[s.id] = s);

    return `
      <div class="page-header">
        <h1 class="page-title">Tableau de bord</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Modals.openCourse()">+ Nouveau cours</button>
        </div>
      </div>

      <!-- KPIs semaine -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon kpi-blue">📅</div>
          <div class="kpi-content">
            <div class="kpi-value">${data.weekCoursesCount}</div>
            <div class="kpi-label">Cours cette semaine</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-purple">⏱</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatDuration(data.weekHours)}</div>
            <div class="kpi-label">Heures cette semaine</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-green">💶</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatMoney(data.monthRevenue)}</div>
            <div class="kpi-label">CA réalisé ce mois</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-teal">📈</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatMoney(data.monthMargin)}</div>
            <div class="kpi-label">Marge nette ce mois</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-orange">🕐</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatDuration(data.monthHoursDone)}</div>
            <div class="kpi-label">Heures réalisées ce mois</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-gray">📋</div>
          <div class="kpi-content">
            <div class="kpi-value">${Utils.formatDuration(data.monthHoursPlanned)}</div>
            <div class="kpi-label">Heures prévues ce mois</div>
          </div>
        </div>
      </div>

      <!-- Ligne principale : prochains cours + alertes -->
      <div class="dashboard-grid">

        <!-- Prochains cours -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Prochains cours</h2>
            <button class="btn-link" onclick="App.navigate('calendar')">Voir le calendrier →</button>
          </div>
          <div class="card-body">
            ${data.upcoming.length === 0
              ? `<p class="empty-state">Aucun cours prévu prochainement.</p>`
              : data.upcoming.map(c => this._courseRow(c, schools)).join('')
            }
          </div>
        </div>

        <!-- Alertes -->
        <div class="alerts-column">

          ${data.toReschedule.length > 0 ? `
          <div class="card card-alert">
            <div class="card-header">
              <h2 class="card-title">⚠ À reprogrammer</h2>
              <span class="badge badge-warning">${data.toReschedule.length}</span>
            </div>
            <div class="card-body">
              ${data.toReschedule.map(c => this._courseRowCompact(c, schools)).join('')}
            </div>
          </div>
          ` : ''}

          ${data.unpaid.length > 0 ? `
          <div class="card card-alert">
            <div class="card-header">
              <h2 class="card-title">💳 Non payés</h2>
              <span class="badge badge-danger">${data.unpaid.length}</span>
            </div>
            <div class="card-body">
              ${data.unpaid.map(c => this._courseRowCompact(c, schools)).join('')}
            </div>
          </div>
          ` : `
          <div class="card card-success-light">
            <div class="card-body">
              <p class="success-message">✓ Tous les cours réalisés sont payés.</p>
            </div>
          </div>
          `}

        </div>
      </div>
    `;
  },

  _courseRow(course, schools) {
    const school = schools[course.schoolId];
    const color = school ? school.color : '#94a3b8';
    const bgColor = Utils.lightenColor(color, 0.88);

    return `
      <div class="course-row" onclick="Modals.openCourse('${course.id}')" style="border-left:3px solid ${color};background:${bgColor}">
        <div class="course-row-main">
          <span class="course-row-title">${Utils.escapeHtml(course.title)}</span>
          <span class="course-row-time">${course.startTime} → ${course.endTime} · ${Utils.formatDuration(course.duration)}</span>
        </div>
        <div class="course-row-meta">
          <span class="course-row-date">${Utils.formatDateShort(course.date)}</span>
          ${school ? `<span class="course-school-badge" style="background:${color};color:${Utils.contrastColor(color)}">${Utils.escapeHtml(school.name)}</span>` : ''}
          ${course.location ? `<span class="course-row-location">📍 ${Utils.escapeHtml(course.location)}</span>` : ''}
          ${course.type === 'visio' ? `<span class="badge badge-visio">Visio</span>` : ''}
        </div>
      </div>
    `;
  },

  _courseRowCompact(course, schools) {
    const school = schools[course.schoolId];
    const color = school ? school.color : '#94a3b8';
    const revenue = (course.duration || 0) * (course.billingRate || 0);
    const statusLabel = { postponed: 'Reporté', moved: 'Déplacé', unpaid: 'Non payé', done: 'Réalisé' };

    return `
      <div class="course-row-compact" onclick="Modals.openCourse('${course.id}')">
        <span class="course-dot" style="background:${color}"></span>
        <span class="course-compact-title">${Utils.escapeHtml(course.title)}</span>
        <span class="course-compact-date">${Utils.formatDateShort(course.date)}</span>
        ${revenue > 0 ? `<span class="course-compact-amount">${Utils.formatMoney(revenue)}</span>` : ''}
      </div>
    `;
  }
};
