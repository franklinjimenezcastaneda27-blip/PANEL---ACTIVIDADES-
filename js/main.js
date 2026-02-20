import { FirebaseService } from './firebase.service.js';
import { State } from './state.manager.js';
import { UI } from './ui.js';
import { CalendarHelper as Cal } from './calendar.js';

let currentSelectedEvent = null;
let currentSelectedAbsenceId = null;
const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
silentAudio.loop = true;

document.addEventListener("DOMContentLoaded", () => {
  UI.setTheme(State.theme);
  updateNotifButtonUI();
  
  FirebaseService.onAuthChange((user) => {
    if (user) {
      document.getElementById("loginOverlay").classList.replace('active', 'hidden');
      document.getElementById("appContainer").classList.replace('hidden', 'flex-col');
      fetchData();
      startNotificationPolling();
    } else {
      document.getElementById("loginOverlay").classList.replace('hidden', 'active');
      document.getElementById("appContainer").classList.replace('flex-col', 'hidden');
    }
  });

  setupEventListeners();
  
  State.subscribe((newState) => {
    UI.renderCalendar(newState, calendarActions);
    UI.renderSidebar(newState, calendarActions);
  });
});

function fetchData() {
  document.getElementById("appLoader").classList.remove('hidden');
  let eventsLoaded = false, absLoaded = false;
  
  FirebaseService.listenEvents((data) => {
    eventsLoaded = true;
    State.updateData(data, null);
    checkLoader(eventsLoaded, absLoaded);
  });
  
  FirebaseService.listenAbsences((data) => {
    absLoaded = true;
    State.updateData(null, data);
    checkLoader(eventsLoaded, absLoaded);
  });
}

function checkLoader(e, a) {
  if(e && a) document.getElementById("appLoader").classList.add('hidden');
}

// Interacciones delegadas desde el UI
const calendarActions = {
  onDayClick: (y, m, d) => State.selectDate(y, m, d),
  onDayDblClick: (y, m, d, isAbsMode) => { 
    State.selectDate(y, m, d); 
    if(isAbsMode) openNewAbsenceModal(); 
    else openNewEventModal(); 
  },
  onEventClick: (id) => openEventActionsModal(id),
  onAbsenceClick: (id) => openAbsenceActionsModal(id)
};

function setupEventListeners() {
  // Login
  document.getElementById("btnLogin").addEventListener("click", () => {
    const email = document.getElementById("emailLogin").value;
    const pass = document.getElementById("passLogin").value;
    FirebaseService.login(email, pass).catch(e => UI.showToast("Error de acceso", "error"));
  });

  // Navegación Calendario
  document.getElementById("btnPrevMonth").addEventListener("click", () => State.changeMonth(-1));
  document.getElementById("btnNextMonth").addEventListener("click", () => State.changeMonth(1));
  document.getElementById("btnToday").addEventListener("click", () => {
    State.currentDate = new Date(); State.selectDate(State.currentDate.getFullYear(), State.currentDate.getMonth(), State.currentDate.getDate());
  });

  // Filtros y Búsqueda
  document.getElementById("filterCategory").addEventListener("change", (e) => State.setFilters(e.target.value, undefined, undefined));
  document.getElementById("filterResponsible").addEventListener("change", (e) => State.setFilters(undefined, e.target.value, undefined));
  
  let searchTimeout;
  document.getElementById("globalSearch").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      State.setFilters(undefined, undefined, e.target.value);
      UI.renderSearch(State, calendarActions);
    }, 400);
  });

  // Header Actions
  document.getElementById("btnThemeToggle").addEventListener("click", () => UI.setTheme(State.toggleTheme()));
  document.getElementById("btnNotifToggle").addEventListener("click", toggleNotifications);
  document.getElementById("btnStats").addEventListener("click", () => UI.renderStats(State));
  document.getElementById("btnPrint").addEventListener("click", () => UI.renderPrint(State));
  document.getElementById("btnNewAbsence").addEventListener("click", openNewAbsenceModal);
  document.getElementById("btnNewEvent").addEventListener("click", () => openNewEventModal(null));
  
  // Mobile
  document.getElementById("btnMobileMenu").addEventListener("click", UI.toggleMobileMenu);
  document.getElementById("btnCloseMobileMenu").addEventListener("click", UI.toggleMobileMenu);

  // Cerrar Modales
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener("click", () => UI.closeModals()));

  // Guardados
  document.getElementById("btnSaveEvent").addEventListener("click", saveEvent);
  document.getElementById("btnSaveAbsence").addEventListener("click", saveAbsence);
  
  // Acciones Evento
  document.getElementById("btnToggleState").addEventListener("click", async () => {
    if(!currentSelectedEvent) return;
    await FirebaseService.toggleEventStatus(currentSelectedEvent.id, currentSelectedEvent.completed);
    UI.closeModals(); UI.showToast("Estado actualizado");
  });
  document.getElementById("btnDeleteEvent").addEventListener("click", async () => {
    if(confirm("¿Eliminar actividad?")) {
      await FirebaseService.deleteEvent(currentSelectedEvent.id);
      UI.closeModals(); UI.showToast("Eliminado");
    }
  });
  document.getElementById("btnEditEvent").addEventListener("click", () => openNewEventModal(currentSelectedEvent));

  // Acciones Asistencia
  document.getElementById("btnDeleteAbsence").addEventListener("click", async () => {
    if(confirm("¿Seguro que deseas eliminar este registro?")) {
      await FirebaseService.deleteAbsence(currentSelectedAbsenceId);
      UI.closeModals(); UI.showToast("Registro eliminado");
    }
  });

  // Interfaz Condicional en Formulario
  document.getElementById("eventType").addEventListener("change", (e) => {
    if(!document.getElementById("eventId").value) {
      const isComunal = e.target.value === "cobranza_comunal";
      document.getElementById("eventRepeatGroup").classList.toggle("hidden", !isComunal);
    }
  });
}

// --- Modales ---
function openNewEventModal(eventObj = null) {
  document.getElementById("modalEventTitle").textContent = eventObj ? "Editar Actividad" : "Nueva Actividad";
  document.getElementById("eventId").value = eventObj ? eventObj.id : "";
  document.getElementById("eventDate").value = eventObj ? eventObj.date.split('T')[0] : Cal.formatDateISO(State.selectedDate);
  document.getElementById("eventTitle").value = eventObj ? eventObj.title : "";
  document.getElementById("eventResponsible").value = eventObj ? eventObj.responsible : "FRANKLIN";
  document.getElementById("eventType").value = eventObj ? eventObj.type : "cobranza_comunal";
  
  if(eventObj) {
    const [hh, mm] = eventObj.time.split(':');
    let h = parseInt(hh);
    document.getElementById("eventAmPm").value = h >= 12 ? 'PM' : 'AM';
    document.getElementById("eventHour").value = h % 12 || 12;
    document.getElementById("eventMin").value = mm;
    document.getElementById("eventRepeatGroup").classList.add("hidden");
  } else {
    document.getElementById("eventHour").value = "9";
    document.getElementById("eventMin").value = "00";
    document.getElementById("eventAmPm").value = "AM";
    document.getElementById("eventRepeatGroup").classList.remove("hidden");
  }
  UI.showModal("modalFormEvent");
}

function openEventActionsModal(id) {
  currentSelectedEvent = State.events.find(e => e.id === id);
  if(!currentSelectedEvent) return;
  const ev = currentSelectedEvent;
  document.getElementById("actionEventTitle").textContent = ev.title;
  document.getElementById("actionEventBody").innerHTML = `
    <strong>Fecha:</strong> ${ev.date.split('-').reverse().join('/')}<br>
    <strong>Hora:</strong> ${Cal.formatTime12h(ev.time)}<br>
    <strong>Tipo:</strong> ${Cal.getIcon(ev.type)} ${Cal.getTypeLabel(ev.type)}<br>
    <strong>Responsable:</strong> ${ev.responsible}<br>
    <strong>Estado:</strong> ${ev.completed ? '<span class="text-success text-bold">✅ Completado</span>' : '<span class="text-warning text-bold">⏳ Pendiente</span>'}
  `;
  UI.showModal("modalEventActions");
}

function openNewAbsenceModal() {
  document.getElementById("absDate").value = Cal.formatDateISO(State.selectedDate);
  document.getElementById("absObs").value = "";
  UI.showModal("modalFormAttendance");
}

function openAbsenceActionsModal(id) {
  const abs = State.absences.find(a => a.id === id);
  if(!abs) return;
  currentSelectedAbsenceId = id;
  let tLabel = abs.type === "PERMISO" ? "Permiso Médico/Otros" : (abs.type.includes("MANANA") ? "Falta (Mañana)" : (abs.type.includes("TARDE") ? "Falta (Tarde)" : "Falta (Día Completo)"));
  document.getElementById("absenceDetails").innerHTML = `
    <strong>Responsable:</strong> ${abs.responsible}<br>
    <strong>Fecha:</strong> ${abs.date}<br>
    <strong>Tipo:</strong> ${tLabel}<br>
    <strong>Observación:</strong> ${abs.obs || '--'}
  `;
  UI.showModal("modalAbsenceActions");
}

// --- Lógica de Guardado ---
async function saveEvent() {
  const id = document.getElementById("eventId").value;
  const title = document.getElementById("eventTitle").value.trim();
  const dateVal = document.getElementById("eventDate").value;
  
  if(!title || !dateVal) return UI.showToast("Faltan datos", "error");

  let h = parseInt(document.getElementById("eventHour").value);
  const m = document.getElementById("eventMin").value;
  const ampm = document.getElementById("eventAmPm").value;
  if(ampm === "PM" && h !== 12) h += 12;
  if(ampm === "AM" && h === 12) h = 0;
  const timeVal = `${h.toString().padStart(2, '0')}:${m}`;

  const baseData = {
    title, time: timeVal,
    responsible: document.getElementById("eventResponsible").value,
    type: document.getElementById("eventType").value,
    completed: false
  };

  const btn = document.getElementById("btnSaveEvent");
  btn.textContent = "Guardando..."; btn.disabled = true;

  try {
    if (id) {
      await FirebaseService.saveEvent({ ...baseData, date: dateVal }, id);
      UI.showToast("Actualizado");
    } else {
      const repeatVal = parseInt(document.getElementById("eventRepeat").value) || 1;
      const baseDateObj = new Date(dateVal + "T12:00:00");
      const batch = [];
      for (let i = 0; i < repeatVal; i++) {
        let nextDate = new Date(baseDateObj);
        nextDate.setMonth(baseDateObj.getMonth() + i);
        batch.push(FirebaseService.saveEvent({ ...baseData, date: Cal.formatDateISO(nextDate) }));
      }
      await Promise.all(batch);
      UI.showToast("Guardado correctamente");
    }
    
    UI.closeModals();
    const [y, mm, d] = dateVal.split('-');
    State.selectDate(parseInt(y), parseInt(mm)-1, parseInt(d));
    State.currentDate = new Date(State.selectedDate);
    State.notify();
  } catch(e) { UI.showToast("Error", "error"); }
  finally { btn.textContent = "Guardar"; btn.disabled = false; }
}

async function saveAbsence() {
  const date = document.getElementById("absDate").value;
  if(!date) return UI.showToast("Seleccione fecha", "error");
  try {
    await FirebaseService.saveAbsence({
      date,
      responsible: document.getElementById("absResponsible").value,
      type: document.getElementById("absType").value,
      obs: document.getElementById("absObs").value
    });
    UI.showToast("Ausencia registrada", "warning");
    UI.closeModals();
  } catch(e) { UI.showToast("Error", "error"); }
}

// --- Notificaciones ---
function updateNotifButtonUI() {
  const btn = document.getElementById("btnNotifToggle");
  if (Notification.permission === "granted") {
    if (State.notificationsEnabled) {
      btn.innerHTML = "✅ Avisos Activos"; btn.className = "btn-icon bg-blue-light text-dark text-bold border-blue pl-md pr-md";
      silentAudio.play().catch(()=>{});
    } else {
      btn.innerHTML = "🔕 Pausado"; btn.className = "btn-icon bg-danger-light text-danger border-danger pl-md pr-md";
      silentAudio.pause();
    }
  } else if (Notification.permission === "denied") {
    btn.innerHTML = "🚫 Bloqueado";
  } else {
    btn.innerHTML = "🔔 Activar";
  }
}

function toggleNotifications() {
  if (!("Notification" in window)) return alert("Tu navegador no soporta notificaciones.");
  if (Notification.permission !== "granted") {
    Notification.requestPermission().then(perm => {
      if (perm === "granted") { State.notificationsEnabled = true; localStorage.setItem('notificationsEnabled', 'true'); UI.showToast("¡Activado!"); updateNotifButtonUI(); }
    });
  } else {
    State.toggleNotifications();
    UI.showToast(State.notificationsEnabled ? "Activado" : "Pausado");
    updateNotifButtonUI();
  }
}

function startNotificationPolling() {
  setInterval(() => {
    if (Notification.permission !== "granted" || !State.notificationsEnabled) return;
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentTimeString = `${currentHour}:${currentMin}`;
    const todayStr = Cal.formatDateISO(now);

    State.events.forEach(evt => {
      if (evt.date.startsWith(todayStr) && evt.time === currentTimeString && !evt.completed && !evt.notified) {
        UI.showNotificationCard(evt.title, `🔔 AHORA: ${evt.responsible}`);
        const notif = new Notification(`⏰ ${evt.time} - ${evt.title}`, {
          body: `Responsable: ${evt.responsible}`, icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png", silent: true
        });
        notif.onclick = function() { window.focus(); this.close(); };
        evt.notified = true; setTimeout(() => { evt.notified = false; }, 65000);
      }
    });
  }, 5000);
}
