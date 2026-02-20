import { CalendarHelper as Cal } from './calendar.js';

export const UI = {
  elements: {
    grid: document.getElementById('calendarGrid'),
    monthDisplay: document.getElementById('currentMonthDisplay'),
    sidebarList: document.getElementById('sidebarList'),
    sidebarDate: document.getElementById('sidebarDateLabel'),
    modals: document.querySelectorAll('.modal-card'),
    modalContainer: document.getElementById('modalContainer'),
    toast: document.getElementById('toastContainer'),
    printBody: document.querySelector('#printTable tbody')
  },

  renderCalendar(state, actionHandlers) {
    this.elements.grid.innerHTML = "";
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    this.elements.monthDisplay.textContent = `${Cal.getMonthName(month)} ${year}`;
    
    const firstDay = Cal.getFirstDayIndex(year, month);
    const totalDays = Cal.getDaysInMonth(year, month);
    const today = new Date();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "day-cell empty";
      this.elements.grid.appendChild(empty);
    }

    const { category, responsible, search } = state.filters;
    const isAbsenceMode = category === "asistencia_mode";

    for (let day = 1; day <= totalDays; day++) {
      const dayCell = document.createElement("div");
      dayCell.className = "day-cell";
      
      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const isSelected = day === state.selectedDate.getDate() && month === state.selectedDate.getMonth() && year === state.selectedDate.getFullYear();
      
      if(isToday) dayCell.classList.add("is-today");
      if(isSelected) dayCell.classList.add("is-selected");

      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      
      let htmlContent = `<div class="day-header"><span class="day-number">${day}</span></div>`;

      // Draw Absences
      const dayAbsences = state.absences.filter(a => a.date === dateStr && (responsible === 'all' || a.responsible === responsible));
      dayAbsences.forEach(abs => {
        if(isAbsenceMode) {
           let tLabel = abs.type === "PERMISO" ? "Permiso" : (abs.type.includes("MANANA") ? "Mañana" : (abs.type.includes("TARDE") ? "Tarde" : "Falta"));
           htmlContent += `<div class="absence-card-large" data-abs-id="${abs.id}"><span>🚫 ${abs.responsible}</span><small>${tLabel}</small></div>`;
        } else {
           htmlContent += `<div class="evt-absence" data-abs-id="${abs.id}">🚫 ${abs.responsible}</div>`;
        }
      });

      // Draw Events
      if(!isAbsenceMode) {
        const dayEvents = state.events.filter(e => {
          return e.date.startsWith(dateStr) &&
                 (category === 'all' || e.type === category) &&
                 (responsible === 'all' || e.responsible === responsible) &&
                 (e.title.toLowerCase().includes(search) || (e.responsible && e.responsible.toLowerCase().includes(search)));
        });

        dayEvents.slice(0, 3).forEach(evt => {
          const completedClass = evt.completed ? "evt-completed" : "";
          const colorClass = Cal.getColorClass(evt.type);
          htmlContent += `<div class="evt-item ${colorClass} ${completedClass}" data-evt-id="${evt.id}">${Cal.getIcon(evt.type)} ${evt.title}</div>`;
        });
        if (dayEvents.length > 3) htmlContent += `<div class="evt-more">+ ${dayEvents.length - 3} más</div>`;
      }

      dayCell.innerHTML = htmlContent;
      
      // Delegation
      dayCell.addEventListener('click', (e) => {
        const evtTag = e.target.closest('.evt-item[data-evt-id]');
        const absTag = e.target.closest('[data-abs-id]');
        if (evtTag) {
          e.stopPropagation();
          actionHandlers.onEventClick(evtTag.dataset.evtId);
        } else if (absTag) {
          e.stopPropagation();
          actionHandlers.onAbsenceClick(absTag.dataset.absId);
        } else {
          actionHandlers.onDayClick(year, month, day);
        }
      });
      dayCell.addEventListener('dblclick', () => actionHandlers.onDayDblClick(year, month, day, isAbsenceMode));

      this.elements.grid.appendChild(dayCell);
    }
  },

  renderSidebar(state, actionHandlers) {
    this.elements.sidebarList.innerHTML = "";
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    this.elements.sidebarDate.textContent = state.selectedDate.toLocaleDateString('es-ES', options);
    
    const dateStr = Cal.formatDateISO(state.selectedDate);
    const { category, responsible } = state.filters;
    const isAbsenceMode = category === "asistencia_mode";

    const dailyAbsences = state.absences.filter(a => a.date === dateStr && (responsible === 'all' || a.responsible === responsible));
    dailyAbsences.forEach(abs => {
      let tLabel = abs.type === "PERMISO" ? "Permiso" : (abs.type.includes("MANANA") ? "Falta (Mañana)" : (abs.type.includes("TARDE") ? "Falta (Tarde)" : "Falta"));
      const item = document.createElement('li');
      item.className = "sidebar-item is-absence";
      item.innerHTML = `<h4>⛔ ${abs.responsible} - ${tLabel}</h4><p>${abs.obs || 'Sin detalles'}</p>`;
      item.onclick = () => actionHandlers.onAbsenceClick(abs.id);
      this.elements.sidebarList.appendChild(item);
    });

    if(!isAbsenceMode) {
      const dailyEvents = state.events.filter(e => e.date.startsWith(dateStr) && (category === 'all' || e.type === category) && (responsible === 'all' || e.responsible === responsible));
      dailyEvents.sort((a,b) => a.time.localeCompare(b.time));
      
      if(dailyEvents.length === 0 && dailyAbsences.length === 0) {
        this.elements.sidebarList.innerHTML = `<li class="text-muted text-center p-md text-sm border-blue radius-md">No hay actividades para este día.</li>`;
        return;
      }

      dailyEvents.forEach(evt => {
        const item = document.createElement('li');
        item.className = "sidebar-item";
        let bc = evt.type === 'cobranza_comunal' ? '#b91c1c' : (evt.type === 'visita' ? '#1d4ed8' : '#64748b');
        item.style.borderLeftColor = bc;
        item.innerHTML = `
          <h4>${evt.title} <span class="text-xs">${Cal.getIcon(evt.type)}</span></h4>
          <p>⏰ ${Cal.formatTime12h(evt.time)} | 👤 ${evt.responsible || '?'}</p>
          <p class="${evt.completed ? 'text-success' : 'text-warning'} text-bold mt-sm text-xs">${evt.completed ? '✅ Completado' : '⏳ Pendiente'}</p>
        `;
        item.onclick = () => actionHandlers.onEventClick(evt.id);
        this.elements.sidebarList.appendChild(item);
      });
    } else {
      if(dailyAbsences.length === 0) this.elements.sidebarList.innerHTML = `<li class="text-muted text-center p-md text-sm border-danger radius-md">No hay faltas registradas.</li>`;
    }
  },

  renderStats(state) {
    const currentMonthPrefix = `${state.currentDate.getFullYear()}-${String(state.currentDate.getMonth()+1).padStart(2,'0')}`;
    const monthEvents = state.events.filter(e => e.date.startsWith(currentMonthPrefix));
    const total = monthEvents.length;
    const completed = monthEvents.filter(e => e.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById("statsContainer").innerHTML = `
      <div class="stat-card"><span class="stat-val">${total}</span><span class="stat-lbl">Total</span></div>
      <div class="stat-card"><span class="stat-val text-success">${percent}%</span><span class="stat-lbl">Cumplimiento</span></div>
      <div class="stat-card"><span class="stat-val text-warning">${total - completed}</span><span class="stat-lbl">Pendientes</span></div>
      <div class="stat-card"><span class="stat-val text-blue">${completed}</span><span class="stat-lbl">Realizadas</span></div>
    `;
    this.showModal('modalStats');
  },

  renderSearch(state, actionHandlers) {
    const q = state.filters.search;
    const list = document.getElementById("searchResultsList");
    list.innerHTML = "";
    if(q.length < 2) return;

    const results = state.events.filter(e => e.title.toLowerCase().includes(q) || (e.responsible && e.responsible.toLowerCase().includes(q)));
    if(results.length === 0) {
      list.innerHTML = "<div class='text-muted p-md'>Sin resultados.</div>";
    } else {
      results.forEach(e => {
        const div = document.createElement("div");
        div.className = "search-result-item";
        div.innerHTML = `<strong>${e.date}</strong> - ${e.title} <small>(${e.responsible})</small>`;
        div.onclick = () => {
          this.closeModals();
          const [y,m,d] = e.date.split('-');
          state.currentDate = new Date(y, m-1, 1);
          actionHandlers.onDayClick(y, m-1, d);
          actionHandlers.onEventClick(e.id);
        };
        list.appendChild(div);
      });
    }
    this.showModal("modalSearch");
  },

  renderPrint(state) {
    const currentMonthPrefix = `${state.currentDate.getFullYear()}-${String(state.currentDate.getMonth()+1).padStart(2,'0')}`;
    const { category, responsible } = state.filters;
    const monthEvents = state.events.filter(e => {
        return e.date.startsWith(currentMonthPrefix) && (category === "all" || e.type === category) && (responsible === "all" || e.responsible === responsible);
    });
    monthEvents.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
    
    document.getElementById("printTitle").textContent = "Reporte - " + document.getElementById("currentMonthDisplay").textContent;
    this.elements.printBody.innerHTML = "";
    if(monthEvents.length === 0) this.elements.printBody.innerHTML = "<tr><td colspan='6' class='text-center p-md'>Sin datos.</td></tr>";
    
    monthEvents.forEach(e => {
      const d = e.date.split('-')[2];
      this.elements.printBody.innerHTML += `<tr><td>${d}</td><td>${Cal.formatTime12h(e.time)}</td><td>${e.title}</td><td>${Cal.getTypeLabel(e.type)}</td><td>${e.responsible||""}</td><td>${e.completed ? "OK" : "-"}</td></tr>`;
    });
    setTimeout(() => window.print(), 300);
  },

  showModal(modalId) {
    this.elements.modals.forEach(m => m.classList.add('hidden'));
    document.getElementById(modalId).classList.remove('hidden');
    this.elements.modalContainer.classList.remove('hidden');
  },

  closeModals() {
    this.elements.modalContainer.classList.add('hidden');
  },

  showToast(message, type = 'success') {
    const toast = this.elements.toast;
    toast.textContent = message;
    toast.style.backgroundColor = type === 'error' ? 'var(--c-danger)' : (type === 'warning' ? 'var(--c-warning)' : 'var(--c-navy-900)');
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
  },

  showNotificationCard(title, body) {
    const card = document.getElementById("notificationCard");
    document.getElementById("notifContent").textContent = `${body} - ${title}`;
    card.classList.remove('hidden');
    setTimeout(() => card.classList.add('hidden'), 30000);
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  },
  
  toggleMobileMenu() {
    document.getElementById('sidebarDrawer').classList.toggle('drawer-open');
  }
};
