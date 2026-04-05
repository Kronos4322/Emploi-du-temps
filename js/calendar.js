// ============================================================
// calendar.js — Vues calendrier (jour, semaine, mois)
// ============================================================

const Calendar = {

  _view: 'week',    // 'day' | 'week' | 'month'
  _date: null,      // date de référence (YYYY-MM-DD)

  init() {
    this._date = Utils.today();
  },

  render() {
    if (!this._date) this._date = Utils.today();

    return `
      <div class="page-header">
        <h1 class="page-title">Calendrier</h1>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="Modals.openCourse(null, '${this._date}')">+ Nouveau cours</button>
        </div>
      </div>

      <div class="calendar-toolbar">
        <div class="cal-nav">
          <button class="btn btn-ghost btn-icon" onclick="Calendar._navPrev()" title="Précédent">‹</button>
          <button class="btn btn-ghost btn-today" onclick="Calendar._goToday()">Aujourd'hui</button>
          <button class="btn btn-ghost btn-icon" onclick="Calendar._navNext()" title="Suivant">›</button>
        </div>
        <div class="cal-title" id="cal-title">${this._getTitle()}</div>
        <div class="cal-view-switcher">
          <button class="btn ${this._view === 'day' ? 'btn-primary' : 'btn-ghost'}" onclick="Calendar._setView('day')">Jour</button>
          <button class="btn ${this._view === 'week' ? 'btn-primary' : 'btn-ghost'}" onclick="Calendar._setView('week')">Semaine</button>
          <button class="btn ${this._view === 'month' ? 'btn-primary' : 'btn-ghost'}" onclick="Calendar._setView('month')">Mois</button>
        </div>
      </div>

      <div id="calendar-body">
        ${this._renderBody()}
      </div>
    `;
  },

  _getTitle() {
    if (this._view === 'day') return Utils.formatDateLong(this._date);
    if (this._view === 'week') {
      const start = Utils.getWeekStart(this._date);
      const end = Utils.addDays(start, 6);
      return `Semaine du ${Utils.formatDate(start)} au ${Utils.formatDate(end)}`;
    }
    if (this._view === 'month') {
      const d = new Date(this._date + 'T00:00:00');
      return `${Utils.monthName(d.getMonth())} ${d.getFullYear()}`;
    }
    return '';
  },

  _setView(view) {
    this._view = view;
    App.refresh();
  },

  _navPrev() {
    if (this._view === 'day') this._date = Utils.addDays(this._date, -1);
    else if (this._view === 'week') this._date = Utils.addDays(this._date, -7);
    else if (this._view === 'month') {
      const d = new Date(this._date + 'T00:00:00');
      d.setMonth(d.getMonth() - 1);
      this._date = d.toISOString().split('T')[0];
    }
    App.refresh();
  },

  _navNext() {
    if (this._view === 'day') this._date = Utils.addDays(this._date, 1);
    else if (this._view === 'week') this._date = Utils.addDays(this._date, 7);
    else if (this._view === 'month') {
      const d = new Date(this._date + 'T00:00:00');
      d.setMonth(d.getMonth() + 1);
      this._date = d.toISOString().split('T')[0];
    }
    App.refresh();
  },

  _goToday() {
    this._date = Utils.today();
    App.refresh();
  },

  _renderBody() {
    if (this._view === 'day') return this._renderDay(this._date);
    if (this._view === 'week') return this._renderWeek();
    if (this._view === 'month') return this._renderMonth();
    return '';
  },

  // ── Vue Semaine ─────────────────────────────────────────────

  _renderWeek() {
    const weekStart = Utils.getWeekStart(this._date);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(Utils.addDays(weekStart, i));

    const startDate = days[0];
    const endDate = days[6];
    const courses = Data.getCoursesByDateRange(startDate, endDate);
    const schools = {};
    Data.getSchools().forEach(s => schools[s.id] = s);

    const today = Utils.today();
    const MIN_HOUR = 7, MAX_HOUR = 22;
    const TOTAL_MINS = (MAX_HOUR - MIN_HOUR) * 60;

    // En-tête des jours
    const dayHeaders = days.map(d => {
      const isToday = d === today;
      const dayDate = new Date(d + 'T00:00:00');
      return `
        <div class="week-day-header ${isToday ? 'today' : ''}">
          <span class="week-day-name">${Utils.DAYS_SHORT[dayDate.getDay()]}</span>
          <span class="week-day-num ${isToday ? 'today-circle' : ''}" onclick="Calendar._drillDay('${d}')">${dayDate.getDate()}</span>
        </div>
      `;
    }).join('');

    // Lignes d'heures
    const hourLines = [];
    for (let h = MIN_HOUR; h <= MAX_HOUR; h++) {
      const pct = ((h - MIN_HOUR) * 60 / TOTAL_MINS) * 100;
      hourLines.push(`
        <div class="hour-line" style="top:${pct.toFixed(2)}%">
          <span class="hour-label">${String(h).padStart(2, '0')}:00</span>
        </div>
      `);
    }

    // Colonnes des cours
    const dayColumns = days.map(d => {
      const dayCourses = courses.filter(c => c.date === d);
      const blocks = dayCourses.map(c => this._courseBlock(c, schools, MIN_HOUR, MAX_HOUR)).join('');
      return `
        <div class="week-day-col" data-date="${d}" onclick="Calendar._clickDay(event, '${d}')">
          ${blocks}
        </div>
      `;
    }).join('');

    // Ligne de l'heure actuelle
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowPct = ((nowMins - MIN_HOUR * 60) / TOTAL_MINS) * 100;
    const showNow = today >= startDate && today <= endDate;
    const todayIdx = days.indexOf(today);

    return `
      <div class="week-view">
        <div class="week-header">
          <div class="week-time-gutter"></div>
          ${dayHeaders}
        </div>
        <div class="week-body" id="week-body">
          <div class="week-time-col">
            ${hourLines.join('')}
          </div>
          <div class="week-days-grid">
            ${showNow ? `<div class="now-line" style="top:${nowPct.toFixed(2)}%;left:calc(${todayIdx} * (100% / 7));width:calc(100% / 7)"></div>` : ''}
            ${dayColumns}
          </div>
        </div>
      </div>
    `;
  },

  _courseBlock(course, schools, minHour, maxHour) {
    const school = schools[course.schoolId];
    const color = school ? school.color : '#94a3b8';
    const textColor = Utils.contrastColor(color);
    const bgColor = course.status === 'cancelled' ? '#e2e8f0' : color;
    const fgColor = course.status === 'cancelled' ? '#94a3b8' : textColor;

    const startMins = Math.max(Utils.timeToMinutes(course.startTime) - minHour * 60, 0);
    const endMins = Math.min(Utils.timeToMinutes(course.endTime) - minHour * 60, (maxHour - minHour) * 60);
    const totalMins = (maxHour - minHour) * 60;

    const top = (startMins / totalMins * 100).toFixed(2);
    const height = Math.max(((endMins - startMins) / totalMins * 100), 1.5).toFixed(2);

    const statusIcon = { cancelled: '✕', postponed: '⚠', moved: '↕', done: '✓', planned: '' }[course.status] || '';
    const strikethrough = course.status === 'cancelled' ? 'text-decoration:line-through;' : '';

    return `
      <div class="course-block"
           style="top:${top}%;height:${height}%;background:${bgColor};color:${fgColor};border-left:3px solid ${color};"
           onclick="event.stopPropagation();Modals.openCourse('${course.id}')"
           title="${Utils.escapeHtml(course.title)} — ${course.startTime}–${course.endTime}">
        <div class="block-title" style="${strikethrough}">${statusIcon ? `<span class="block-status-icon">${statusIcon}</span>` : ''}${Utils.escapeHtml(course.title)}</div>
        <div class="block-time">${course.startTime}–${course.endTime}</div>
        ${course.type === 'visio' ? `<div class="block-badge">Visio</div>` : ''}
      </div>
    `;
  },

  _clickDay(event, date) {
    if (event.target === event.currentTarget || event.target.classList.contains('week-day-col')) {
      Modals.openCourse(null, date);
    }
  },

  _drillDay(date) {
    this._date = date;
    this._view = 'day';
    App.refresh();
  },

  // ── Vue Jour ────────────────────────────────────────────────

  _renderDay(date) {
    const courses = Data.getCoursesByDateRange(date, date);
    const schools = {};
    Data.getSchools().forEach(s => schools[s.id] = s);

    const MIN_HOUR = 7, MAX_HOUR = 22;
    const TOTAL_MINS = (MAX_HOUR - MIN_HOUR) * 60;

    const hourLines = [];
    for (let h = MIN_HOUR; h <= MAX_HOUR; h++) {
      const pct = ((h - MIN_HOUR) * 60 / TOTAL_MINS) * 100;
      hourLines.push(`
        <div class="hour-line" style="top:${pct.toFixed(2)}%">
          <span class="hour-label">${String(h).padStart(2, '0')}:00</span>
        </div>
      `);
    }

    const blocks = courses.map(c => this._courseBlock(c, schools, MIN_HOUR, MAX_HOUR)).join('');

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowPct = ((nowMins - MIN_HOUR * 60) / TOTAL_MINS) * 100;
    const showNow = date === Utils.today();

    return `
      <div class="day-view">
        <div class="day-body" onclick="Calendar._clickDay(event, '${date}')">
          <div class="day-time-col">${hourLines.join('')}</div>
          <div class="day-events-col" style="position:relative">
            ${showNow ? `<div class="now-line" style="top:${nowPct.toFixed(2)}%;left:0;right:0"></div>` : ''}
            ${blocks}
          </div>
        </div>
      </div>
    `;
  },

  // ── Vue Mois ────────────────────────────────────────────────

  _renderMonth() {
    const d = new Date(this._date + 'T00:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Ajuster le premier jour de la semaine (lundi = 1)
    let startWeekday = firstDay.getDay(); // 0=dim
    startWeekday = (startWeekday === 0 ? 6 : startWeekday - 1); // 0=lun

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startWeekday);

    const endWeekday = lastDay.getDay();
    const daysToAdd = endWeekday === 0 ? 0 : 7 - endWeekday;
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + daysToAdd);

    const rangeStart = startDate.toISOString().split('T')[0];
    const rangeEnd = endDate.toISOString().split('T')[0];
    const courses = Data.getCoursesByDateRange(rangeStart, rangeEnd);
    const schools = {};
    Data.getSchools().forEach(s => schools[s.id] = s);

    // Grouper les cours par date
    const byDate = {};
    courses.forEach(c => {
      if (!byDate[c.date]) byDate[c.date] = [];
      byDate[c.date].push(c);
    });

    const today = Utils.today();
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    // Générer les cellules
    const cells = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      const iso = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === month;
      const isToday = iso === today;
      const dayCourses = byDate[iso] || [];

      const courseItems = dayCourses.slice(0, 3).map(c => {
        const school = schools[c.schoolId];
        const color = school ? school.color : '#94a3b8';
        const bg = c.status === 'cancelled' ? '#e2e8f0' : color;
        const fg = c.status === 'cancelled' ? '#94a3b8' : Utils.contrastColor(color);
        const strike = c.status === 'cancelled' ? 'text-decoration:line-through' : '';
        return `
          <div class="month-event" style="background:${bg};color:${fg};${strike}"
               onclick="event.stopPropagation();Modals.openCourse('${c.id}')">
            ${c.type === 'visio' ? '📹 ' : ''}${Utils.escapeHtml(c.title)}
          </div>
        `;
      }).join('');
      const moreCount = dayCourses.length - 3;

      cells.push(`
        <div class="month-cell ${isCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}"
             onclick="Calendar._drillDay('${iso}')">
          <div class="month-cell-header">
            <span class="month-day-num ${isToday ? 'today-circle' : ''}">${current.getDate()}</span>
            ${dayCourses.length > 0 ? `<span class="month-day-count">${dayCourses.length}</span>` : ''}
          </div>
          <div class="month-cell-events">
            ${courseItems}
            ${moreCount > 0 ? `<div class="month-more">+${moreCount} cours</div>` : ''}
          </div>
        </div>
      `);

      current.setDate(current.getDate() + 1);
    }

    return `
      <div class="month-view">
        <div class="month-header">
          ${dayNames.map(n => `<div class="month-day-name">${n}</div>`).join('')}
        </div>
        <div class="month-grid">
          ${cells.join('')}
        </div>
      </div>
    `;
  }
};
