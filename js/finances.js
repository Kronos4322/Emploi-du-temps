// ============================================================
// finances.js — Vue finances et rapports mensuels
// ============================================================

const Finances = {

  _yearMonth: null,
  _schoolFilter: '',

  init() {
    this._yearMonth = Utils.currentYearMonth();
  },

  render() {
    if (!this._yearMonth) this._yearMonth = Utils.currentYearMonth();

    const schools = Data.getSchools();
    const providers = Data.getProviders();
    const schoolsMap = {};
    schools.forEach(s => schoolsMap[s.id] = s);
    const providersMap = {};
    providers.forEach(p => providersMap[p.id] = p);

    const stats = Data.getFinancialStats({
      yearMonth: this._yearMonth,
      schoolId: this._schoolFilter || undefined
    });

    const monthOptions = Utils.getRecentMonths(24).map(ym => {
      const [y, m] = ym.split('-');
      const label = `${Utils.MONTHS_LONG[parseInt(m) - 1]} ${y}`;
      return `<option value="${ym}" ${this._yearMonth === ym ? 'selected' : ''}>${label}</option>`;
    }).join('');

    const schoolOptions = `<option value="">Toutes les écoles</option>` +
      schools.map(s => `<option value="${s.id}" ${this._schoolFilter === s.id ? 'selected' : ''}>${Utils.escapeHtml(s.name)}</option>`).join('');

    const [y, m] = this._yearMonth.split('-');
    const monthLabel = `${Utils.MONTHS_LONG[parseInt(m) - 1]} ${y}`;

    return `
      <div class="page-header">
        <h1 class="page-title">Finances</h1>
        <div class="page-actions">
          <button class="btn btn-ghost" onclick="Data.exportToCsv('${this._yearMonth}')">Export CSV</button>
          <button class="btn btn-ghost" onclick="Finances._printReport()">Imprimer</button>
        </div>
      </div>

      <!-- Filtres -->
      <div class="filters-bar">
        <select class="form-input filter-select" onchange="Finances._setMonth(this.value)">
          ${monthOptions}
        </select>
        <select class="form-input filter-select" onchange="Finances._setSchool(this.value)">
          ${schoolOptions}
        </select>
      </div>

      <!-- Rapport mensuel -->
      <div id="finance-report">

        <h2 class="report-title">Rapport — ${monthLabel}</h2>

        <!-- KPIs principaux -->
        <div class="kpi-grid kpi-finance">
          <div class="kpi-card kpi-large">
            <div class="kpi-icon kpi-green">💶</div>
            <div class="kpi-content">
              <div class="kpi-value">${Utils.formatMoney(stats.grossRevenue)}</div>
              <div class="kpi-label">Chiffre d'affaires brut</div>
            </div>
          </div>
          <div class="kpi-card kpi-large">
            <div class="kpi-icon kpi-red">📤</div>
            <div class="kpi-content">
              <div class="kpi-value">${Utils.formatMoney(stats.providerCosts)}</div>
              <div class="kpi-label">Charges prestataires</div>
            </div>
          </div>
          <div class="kpi-card kpi-large ${stats.netMargin >= 0 ? 'kpi-positive' : 'kpi-negative'}">
            <div class="kpi-icon kpi-teal">📊</div>
            <div class="kpi-content">
              <div class="kpi-value">${Utils.formatMoney(stats.netMargin)}</div>
              <div class="kpi-label">Marge nette</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon kpi-blue">✓</div>
            <div class="kpi-content">
              <div class="kpi-value">${Utils.formatDuration(stats.totalHoursDone)}</div>
              <div class="kpi-label">Heures réalisées</div>
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-icon kpi-gray">📅</div>
            <div class="kpi-content">
              <div class="kpi-value">${Utils.formatDuration(stats.totalHoursPlanned)}</div>
              <div class="kpi-label">Heures prévues</div>
            </div>
          </div>
          ${stats.unpaidAmount > 0 ? `
          <div class="kpi-card kpi-alert-card">
            <div class="kpi-icon kpi-orange">⚠</div>
            <div class="kpi-content">
              <div class="kpi-value">${Utils.formatMoney(stats.unpaidAmount)}</div>
              <div class="kpi-label">${stats.unpaidCount} cours non payé${stats.unpaidCount > 1 ? 's' : ''}</div>
            </div>
          </div>
          ` : `
          <div class="kpi-card kpi-success-card">
            <div class="kpi-icon kpi-green">✓</div>
            <div class="kpi-content">
              <div class="kpi-value" style="font-size:1rem">Tout payé</div>
              <div class="kpi-label">Aucun cours en attente</div>
            </div>
          </div>
          `}
        </div>

        <!-- Répartition par école -->
        ${Object.keys(stats.bySchool).length > 0 ? `
        <div class="report-section">
          <h3 class="section-title">Répartition par école</h3>
          <div class="report-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>École</th>
                  <th class="cell-center">Cours réalisés</th>
                  <th class="cell-center">Heures</th>
                  <th class="cell-money">Revenu</th>
                  <th>Part</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(stats.bySchool).map(([schoolId, data]) => {
                  const school = schoolsMap[schoolId];
                  const color = school ? school.color : '#94a3b8';
                  const pct = stats.grossRevenue > 0 ? Math.round(data.revenue / stats.grossRevenue * 100) : 0;
                  return `
                    <tr>
                      <td>
                        <span class="school-dot" style="background:${color}"></span>
                        ${school ? Utils.escapeHtml(school.name) : '—'}
                      </td>
                      <td class="cell-center">${data.count}</td>
                      <td class="cell-center">${Utils.formatDuration(data.hours)}</td>
                      <td class="cell-money">${Utils.formatMoney(data.revenue)}</td>
                      <td>
                        <div class="progress-bar-wrapper">
                          <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
                          <span class="progress-label">${pct}%</span>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="table-total">
                  <td><strong>Total</strong></td>
                  <td class="cell-center"><strong>${stats.done.length}</strong></td>
                  <td class="cell-center"><strong>${Utils.formatDuration(stats.totalHoursDone)}</strong></td>
                  <td class="cell-money"><strong>${Utils.formatMoney(stats.grossRevenue)}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        ` : ''}

        <!-- Répartition par prestataire -->
        ${Object.keys(stats.byProvider).length > 0 ? `
        <div class="report-section">
          <h3 class="section-title">Charges prestataires</h3>
          <div class="report-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Prestataire</th>
                  <th>Matière</th>
                  <th class="cell-center">Cours</th>
                  <th class="cell-center">Heures</th>
                  <th class="cell-money">Coût (€/h)</th>
                  <th class="cell-money">Total dû</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(stats.byProvider).map(([providerId, data]) => {
                  const provider = providersMap[providerId];
                  return `
                    <tr>
                      <td>${provider ? Utils.escapeHtml(provider.firstName + ' ' + provider.lastName) : '—'}</td>
                      <td>${provider ? Utils.escapeHtml(provider.subject || '—') : '—'}</td>
                      <td class="cell-center">${data.count}</td>
                      <td class="cell-center">${Utils.formatDuration(data.hours)}</td>
                      <td class="cell-money">${provider ? Utils.formatMoney(provider.hourlyRate) + '/h' : '—'}</td>
                      <td class="cell-money cell-cost">${Utils.formatMoney(data.cost)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="table-total">
                  <td colspan="5"><strong>Total charges</strong></td>
                  <td class="cell-money cell-cost"><strong>${Utils.formatMoney(stats.providerCosts)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        ` : ''}

        <!-- Détail des cours réalisés -->
        <div class="report-section">
          <h3 class="section-title">Cours réalisés (${stats.done.length})</h3>
          ${stats.done.length === 0
            ? `<p class="empty-state">Aucun cours réalisé sur cette période.</p>`
            : `<div class="report-table-wrapper">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Titre</th>
                      <th>École</th>
                      <th>Durée</th>
                      <th class="cell-money">Tarif</th>
                      <th class="cell-money">Revenu</th>
                      <th>Paiement</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${stats.done.map(c => {
                      const school = schoolsMap[c.schoolId];
                      const color = school ? school.color : '#94a3b8';
                      const revenue = (c.duration || 0) * (c.billingRate || 0);
                      const PAY_LABELS = { unpaid: ['Non payé', 'badge-danger'], invoiced: ['Facturé', 'badge-invoiced'], paid: ['Payé', 'badge-success'] };
                      const [pLabel, pClass] = PAY_LABELS[c.paymentStatus] || [c.paymentStatus, ''];
                      return `
                        <tr onclick="Modals.openCourse('${c.id}')" class="table-row">
                          <td>${Utils.formatDate(c.date)}</td>
                          <td>
                            <span class="school-dot" style="background:${color}"></span>
                            ${Utils.escapeHtml(c.title)}
                          </td>
                          <td>${school ? Utils.escapeHtml(school.name) : '—'}</td>
                          <td>${Utils.formatDuration(c.duration)}</td>
                          <td class="cell-money">${Utils.formatMoney(c.billingRate)}/h</td>
                          <td class="cell-money">${Utils.formatMoney(revenue)}</td>
                          <td><span class="badge ${pClass}">${pLabel}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>

        <!-- Cours annulés -->
        ${stats.cancelled.length > 0 ? `
        <div class="report-section">
          <h3 class="section-title">Cours annulés (${stats.cancelled.length})</h3>
          <div class="cancelled-list">
            ${stats.cancelled.map(c => `
              <div class="cancelled-row" onclick="Modals.openCourse('${c.id}')">
                <span>${Utils.formatDate(c.date)}</span>
                <span>${Utils.escapeHtml(c.title)}</span>
                <span>${Utils.formatDuration(c.duration)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

      </div>
    `;
  },

  _setMonth(ym) {
    this._yearMonth = ym;
    App.refresh();
  },

  _setSchool(id) {
    this._schoolFilter = id;
    App.refresh();
  },

  _printReport() {
    window.print();
  }
};
