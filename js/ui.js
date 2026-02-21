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

  // NUEVO: Llenar Selects Dinámicamente con usuarios activos
  renderUsers(users) {
    const filterResp = document.getElementById('filterResponsible');
    const evResp = document.getElementById('eventResponsible');
    const absResp = document.getElementById('absResponsible');

    // Mantiene la primera opción por defecto
    const fVal = filterResp.value; const eVal = evResp.value; const aVal = absResp.value;
    
    filterResp.innerHTML = '<option value="all">👥 TODO EL PERSONAL</option>';
    evResp.innerHTML = '<option value="">-- Seleccionar --</option>';
    absResp.innerHTML = '<option value="">-- Seleccionar --</option>';

    const activos = users.filter(u => u.activo);
    activos.forEach(u => {
      filterResp.innerHTML += `<option value="${u.nombre}">👤 ${u.nombre}</option>`;
      evResp.innerHTML += `<option value="${u.nombre}">${u.nombre}</option>`;
      absResp.innerHTML += `<option value="${u.nombre}">${u.nombre}</option>`;
    });

    // Restaurar selecciones previas si existían
    if(fVal) filterResp.value = fVal;
    if(eVal) evResp.value = eVal;
    if(aVal) absResp.value = aVal;
  },

  // NUEVO: Ocultar botones si es Colaborador
  // (VERSIÓN NUEVA - RELAJADA)
  applyRoleRestrictions(currentUser) {
    if(!currentUser) return;
    const isAdmin = currentUser.rol === 'admin';
    
    // SOLO oculta los botones que tengan la etiqueta '.admin-only'
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  },

  // NUEVO: Renderizar Lista de Personal en el Modal
  renderAdminUsersModal(users, toggleUserHandler) {
    const list = document.getElementById('usersListContainer');
    list.innerHTML = '';
    users.forEach(u => {
      const div = document.createElement('div');
      div.className = "flex-row justify-between p-sm border-bottom-dark mb-sm";
      div.innerHTML = `
        <div>
          <strong class="${u.activo ? 'text-main' : 'text-muted'}">${u.nombre}</strong> 
          <span class="text-xs text-muted">(${u.rol})</span><br>
          <small class="text-muted">${u.email}</small>
        </div>
        <button class="btn ${u.activo ? 'btn-danger' : 'btn-success'} text-xs" data-id="${u.id}">
          ${u.activo ? 'Desactivar' : 'Activar'}
        </button>
      `;
      div.querySelector('button').onclick = () => toggleUserHandler(u.id, !u.activo);
      list.appendChild(div);
    });
  },

  // NUEVO: Renderizar Auditoría en el Modal
  renderAdminAuditModal(logs) {
    const list = document.getElementById('auditListContainer');
    list.innerHTML = '';
    if(logs.length === 0) return list.innerHTML = '<p class="text-muted text-sm">No hay registros de cambios recientes.</p>';

    logs.forEach(log => {
      const d = new Date(log.timestamp).toLocaleString('es-ES');
      list.innerHTML += `
        <div class="p-sm border-bottom-dark mb-sm text-sm">
          <strong class="text-danger">${log.accion}</strong> - <span class="text-muted">${d}</span><br>
          <span class="text-main">${log.detalle}</span><br>
          <small class="text-bold text-dark">👤 Por: ${log.usuario}</small>
        </div>
      `;
    });
  },

  // Las funciones base se mantienen igual
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

      const dayAbsences = state.absences.filter(a => a.date === dateStr && (responsible === 'all' || a.responsible === responsible));
      dayAbsences.forEach(abs => {
        if(isAbsenceMode) {
           let tLabel = abs.type === "PERMISO" ? "Permiso" : (abs.type.includes("MANANA") ? "Mañana" : (abs.type.includes("TARDE") ? "Tarde" : "Falta"));
           htmlContent += `<div class="absence-card-large" data-abs-id="${abs.id}"><span>🚫 ${abs.responsible}</span><small>${tLabel}</small></div>`;
        } else {
           htmlContent += `<div class="evt-absence" data-abs-id="${abs.id}">🚫 ${abs.responsible}</div>`;
        }
      });

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
      
      dayCell.addEventListener('click', (e) => {
        const evtTag = e.target.closest('.evt-item[data-evt-id]');
        const absTag = e.target.closest('[data-abs-id]');
        if (evtTag) {
          e.stopPropagation(); actionHandlers.onEventClick(evtTag.dataset.evtId);
        } else if (absTag) {
          e.stopPropagation(); actionHandlers.onAbsenceClick(absTag.dataset.absId);
        } else {
          actionHandlers.onDayClick(year, month, day);
        }
      });
      // Doble click solo funciona si es admin (validado en main.js)
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

  setTheme(theme) { document.documentElement.setAttribute('data-theme', theme); },
  toggleMobileMenu() { document.getElementById('sidebarDrawer').classList.toggle('drawer-open'); }
};
