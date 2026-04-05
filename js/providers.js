// ============================================================
// providers.js — Vue gestion des prestataires / intervenants
// ============================================================

const Providers = {

  render() {
    const providers = Data.getProviders();
    const allCourses = Data.getCourses();

    return `
      <div class="page-header">
        <h1 class="page-title">Prestataires & Intervenants</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Modals.openProvider()">+ Nouveau prestataire</button>
        </div>
      </div>

      ${providers.length === 0
        ? `<div class="empty-page">
            <div class="empty-icon">👤</div>
            <h2>Aucun prestataire enregistré</h2>
            <p>Ajoutez des intervenants pour les associer à vos cours et suivre leurs coûts.</p>
            <button class="btn btn-primary" onclick="Modals.openProvider()">+ Ajouter un prestataire</button>
           </div>`
        : `<div class="providers-list">
            ${providers.map(p => this._providerCard(p, allCourses)).join('')}
           </div>`
      }
    `;
  },

  _providerCard(provider, allCourses) {
    const courses = allCourses.filter(c => c.providerId === provider.id);
    const done = courses.filter(c => c.status === 'done');
    const totalHours = done.reduce((s, c) => s + (c.duration || 0), 0);
    const totalCost = done.reduce((s, c) => s + (c.duration || 0) * (c.providerRate || 0), 0);
    const currentMonth = Utils.currentYearMonth();
    const monthDone = done.filter(c => c.date && c.date.startsWith(currentMonth));
    const monthCost = monthDone.reduce((s, c) => s + (c.duration || 0) * (c.providerRate || 0), 0);
    const monthHours = monthDone.reduce((s, c) => s + (c.duration || 0), 0);

    const upcomingCount = courses.filter(c => c.status === 'planned' && c.date >= Utils.today()).length;

    return `
      <div class="provider-card ${provider.active === false ? 'provider-inactive' : ''}">
        <div class="provider-card-left">
          <div class="provider-avatar">
            ${provider.firstName[0] || '?'}${provider.lastName[0] || ''}
          </div>
        </div>
        <div class="provider-card-main">
          <div class="provider-card-header">
            <div>
              <h3 class="provider-name">${Utils.escapeHtml(provider.firstName + ' ' + provider.lastName)}</h3>
              <div class="provider-meta">
                ${provider.structure ? `<span class="provider-structure">${Utils.escapeHtml(provider.structure)}</span>` : ''}
                ${provider.subject ? `<span class="provider-subject">${Utils.escapeHtml(provider.subject)}</span>` : ''}
                ${provider.active === false ? `<span class="badge badge-inactive">Inactif</span>` : ''}
              </div>
            </div>
            <div class="provider-rate-badge">
              <span class="rate-label">Tarif</span>
              <span class="rate-value">${Utils.formatMoney(provider.hourlyRate)}/h</span>
            </div>
          </div>

          <div class="provider-contact">
            ${provider.phone ? `<span>📞 ${Utils.escapeHtml(provider.phone)}</span>` : ''}
            ${provider.email ? `<span>✉ ${Utils.escapeHtml(provider.email)}</span>` : ''}
          </div>

          ${provider.notes ? `<div class="provider-notes">${Utils.escapeHtml(provider.notes)}</div>` : ''}

          <div class="provider-stats">
            <div class="provider-stat">
              <div class="provider-stat-value">${upcomingCount}</div>
              <div class="provider-stat-label">Cours prévus</div>
            </div>
            <div class="provider-stat">
              <div class="provider-stat-value">${Utils.formatDuration(monthHours)}</div>
              <div class="provider-stat-label">Ce mois (h)</div>
            </div>
            <div class="provider-stat highlight">
              <div class="provider-stat-value">${Utils.formatMoney(monthCost)}</div>
              <div class="provider-stat-label">Coût ce mois</div>
            </div>
            <div class="provider-stat">
              <div class="provider-stat-value">${Utils.formatDuration(totalHours)}</div>
              <div class="provider-stat-label">Total heures</div>
            </div>
            <div class="provider-stat">
              <div class="provider-stat-value">${Utils.formatMoney(totalCost)}</div>
              <div class="provider-stat-label">Total coût</div>
            </div>
          </div>
        </div>
        <div class="provider-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="Modals.openProvider('${provider.id}')">Modifier</button>
        </div>
      </div>
    `;
  }
};
