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
  
  FirebaseService.onAuthChange(async (user) => {
    if (user) {
      document.getElementById("loginOverlay").classList.replace('active', 'hidden');
      document.getElementById("appContainer").classList.replace('hidden', 'flex-col');
      
      const profileData = await FirebaseService.getUserProfile(user.email);
      
      if(profileData.current) {
         State.setCurrentUser(profileData.current);
         State.updateData(null, null, profileData.users, null);
         UI.applyRoleRestrictions(State.currentUser);
      } else {
         UI.showToast("Usuario temporal (No registrado)", "warning");
         State.setCurrentUser({ nombre: "Admin Temporal", rol: "admin", email: user.email });
         UI.applyRoleRestrictions(State.currentUser);
      }

      fetchData();
      startNotificationPolling();
    } else {
      document.getElementById("loginOverlay").classList.replace('hidden', 'active');
      document.getElementById("appContainer").classList.replace('flex-col', 'hidden');
    }
  });

  setupEventListeners();
  
  State.subscribe((newState) => {
    if(newState.users && newState.users.length > 0) {
      UI.renderUsers(newState.users);
    }
    
    UI.renderCalendar(newState, calendarActions);
    UI.renderSidebar(newState, calendarActions);

    // Escudos de seguridad por si los modales no existen en el HTML
    const modalUsers = document.getElementById('modalUsers');
    if(modalUsers && !modalUsers.classList.contains('hidden')){ 
      UI.renderAdminUsersModal(newState.users, toggleUserStatus); 
    }
    
    const modalAudit = document.getElementById('modalAudit');
    if(modalAudit && !modalAudit.classList.contains('hidden')){ 
      UI.renderAdminAuditModal(newState.auditLogs); 
    }
  });
});

function fetchData() {
  const loader = document.getElementById("appLoader");
  if(loader) loader.classList.remove('hidden');
  
  let eventsLoaded = false, absLoaded = false;
  
  FirebaseService.listenEvents((data) => {
    eventsLoaded = true; 
    State.updateData(data, null, null, null); 
    checkLoader(eventsLoaded, absLoaded);
  });
  
  FirebaseService.listenAbsences((data) => {
    absLoaded = true; 
    State.updateData(null, data, null, null); 
    checkLoader(eventsLoaded, absLoaded);
  });

  if(State.currentUser && State.currentUser.rol === 'admin') {
     FirebaseService.listenAudit((logs) => { 
       State.updateData(null, null, null, logs); 
     });
  }
}

function checkLoader(e, a) { 
  if(e && a) {
    const loader = document.getElementById("appLoader");
    if(loader) loader.classList.add('hidden');
  } 
}

const calendarActions = {
  onDayClick: (y, m, d) => State.selectDate(y, m, d),
  onDayDblClick: (y, m, d, isAbsMode) => { 
    if(State.currentUser && State.currentUser.rol === 'admin') {
      State.selectDate(y, m, d); 
      if(isAbsMode) openNewAbsenceModal(); else openNewEventModal(); 
    }
  },
  onEventClick: (id) => openEventActionsModal(id),
  onAbsenceClick: (id) => openAbsenceActionsModal(id)
};

function setupEventListeners() {
  document.getElementById("btnLogin").addEventListener("click", () => {
    FirebaseService.login(document.getElementById("emailLogin").value, document.getElementById("passLogin").value)
      .catch(e => UI.showToast("Error de acceso", "error"));
  });

  document.getElementById("btnPrevMonth").addEventListener("click", () => State.changeMonth(-1));
  document.getElementById("btnNextMonth").addEventListener("click", () => State.changeMonth(1));
  document.getElementById("btnToday").addEventListener("click", () => {
    State.currentDate = new Date(); 
    State.selectDate(State.currentDate.getFullYear(), State.currentDate.getMonth(), State.currentDate.getDate());
  });

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

  document.getElementById("btnThemeToggle").addEventListener("click", () => UI.setTheme(State.toggleTheme()));
  document.getElementById("btnNotifToggle").addEventListener("click", toggleNotifications);
  
  // Controles del Header con seguridad
  const btnStats = document.getElementById("btnStats");
  if(btnStats) btnStats.addEventListener("click", () => UI.renderStats(State));
  
  const btnPrint = document.getElementById("btnPrint");
  if(btnPrint) btnPrint.addEventListener("click", () => UI.renderPrint(State));
  
  document.getElementById("btnNewAbsence").addEventListener("click", openNewAbsenceModal);
  document.getElementById("btnNewEvent").addEventListener("click", () => openNewEventModal(null));
  
  const btnAdminUsers = document.getElementById("btnAdminUsers");
  if(btnAdminUsers) btnAdminUsers.addEventListener("click", () => { 
    UI.renderAdminUsersModal(State.users, toggleUserStatus); 
    UI.showModal("modalUsers"); 
  });
  
  const btnAdminAudit = document.getElementById("btnAdminAudit");
  if(btnAdminAudit) btnAdminAudit.addEventListener("click", () => { 
    UI.renderAdminAuditModal(State.auditLogs); 
    UI.showModal("modalAudit"); 
  });

  const btnSaveUser = document.getElementById("btnSaveUser");
  if(btnSaveUser) {
    btnSaveUser.addEventListener("click", async () => {
      const nombre = document.getElementById("newUserName").value.trim().toUpperCase();
      const email = document.getElementById("newUserEmail").value.trim().toLowerCase();
      const rol = document.getElementById("newUserRole").value;
      if(!nombre || !email) return UI.showToast("Ingrese datos", "error");
      
      btnSaveUser.disabled = true;
      try {
        await FirebaseService.saveUser({ nombre, email, rol }); 
        UI.showToast("Usuario guardado");
        document.getElementById("newUserName").value = ""; 
        document.getElementById("newUserEmail").value = "";
      } catch(e) { 
        UI.showToast("Error", "error"); 
      }
      btnSaveUser.disabled = false;
    });
  }

  document.getElementById("btnMobileMenu").addEventListener("click", UI.toggleMobileMenu);
  document.getElementById("btnCloseMobileMenu").addEventListener("click", UI.toggleMobileMenu);
  
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener("click", () => UI.closeModals()));

  document.getElementById("btnSaveEvent").addEventListener("click", saveEvent);
  document.getElementById("btnSaveAbsence").addEventListener("click", saveAbsence);
  
  // Botón de Actualizar Gestión (Foto 100% Gratis y GPS)
  const btnUpdateStatus = document.getElementById("btnUpdateStatus");
  if(btnUpdateStatus) {
    btnUpdateStatus.addEventListener("click", async () => {
      if(!currentSelectedEvent) return;
      const newStatus = document.getElementById("eventNewStatus").value;
      const fileInput = document.getElementById("eventEvidence");
      
      btnUpdateStatus.textContent = "Obteniendo GPS..."; 
      btnUpdateStatus.disabled = true;

      try {
        let coords = null;
        try {
          const pos = await new Promise((resolve, reject) => { navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }); });
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch(e) { 
          UI.showToast("No se pudo obtener el GPS", "warning"); 
        }

        btnUpdateStatus.textContent = "Procesando foto...";
        let photoData = null;
        if(fileInput && fileInput.files.length > 0) {
           photoData = await compressImageToText(fileInput.files[0]);
        }

        btnUpdateStatus.textContent = "Guardando...";
        const updateData = { estado: newStatus, completed: newStatus === 'exitosa' };
        if(coords) updateData.ubicacion = coords;
        if(photoData) updateData.evidenciaUrl = photoData;

        await FirebaseService.updateEventFieldManagement(currentSelectedEvent.id, updateData);
        
        UI.showToast("Gestión guardada exitosamente"); 
        UI.closeModals();
      } catch(error) {
        UI.showToast("Error al guardar gestión", "error");
      } finally {
        btnUpdateStatus.innerHTML = "💾 Guardar Gestión"; 
        btnUpdateStatus.disabled = false; 
        if(fileInput) fileInput.value = "";
      }
    });
  }
  
  const btnDeleteEvent = document.getElementById("btnDeleteEvent");
  if(btnDeleteEvent) {
    btnDeleteEvent.addEventListener("click", async () => {
      if(confirm("¿Eliminar actividad permanentemente?")) {
        await FirebaseService.deleteEvent(currentSelectedEvent.id, currentSelectedEvent.title); 
        UI.closeModals(); 
        UI.showToast("Eliminado");
      }
    });
  }

  const btnEditEvent = document.getElementById("btnEditEvent");
  if(btnEditEvent) btnEditEvent.addEventListener("click", () => openNewEventModal(currentSelectedEvent));
  
  const btnDeleteAbsence = document.getElementById("btnDeleteAbsence");
  if(btnDeleteAbsence) {
    btnDeleteAbsence.addEventListener("click", async () => {
      if(confirm("¿Seguro que deseas eliminar este registro?")) {
        const abs = State.absences.find(a => a.id === currentSelectedAbsenceId);
        await FirebaseService.deleteAbsence(currentSelectedAbsenceId, abs.responsible); 
        UI.closeModals(); 
        UI.showToast("Registro eliminado");
      }
    });
  }

  const eventType = document.getElementById("eventType");
  if(eventType) {
    eventType.addEventListener("change", (e) => {
      if(!document.getElementById("eventId").value) {
        document.getElementById("eventRepeatGroup").classList.toggle("hidden", e.target.value !== "cobranza_comunal");
      }
    });
  }
}

// FUNCION MAGICA: Comprime fotos
function compressImageToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
}

async function toggleUserStatus(id, newStatus) { 
  try { 
    await FirebaseService.saveUser({ activo: newStatus }, id); 
    UI.showToast("Actualizado"); 
  } catch(e) { 
    UI.showToast("Error", "error"); 
  } 
}

function openNewEventModal(eventObj = null) {
  document.getElementById("modalEventTitle").textContent = eventObj ? "Editar Actividad" : "Nueva Actividad";
  document.getElementById("eventId").value = eventObj ? eventObj.id : "";
  document.getElementById("eventDate").value = eventObj ? eventObj.date.split('T')[0] : Cal.formatDateISO(State.selectedDate);
  document.getElementById("eventTitle").value = eventObj ? eventObj.title : "";
  document.getElementById("eventType").value = eventObj ? eventObj.type : "cobranza_comunal";
  
  if(eventObj) {
    document.getElementById("eventResponsible").value = eventObj.responsible;
    const [hh, mm] = eventObj.time.split(':');
    let h = parseInt(hh); 
    document.getElementById("eventAmPm").value = h >= 12 ? 'PM' : 'AM'; 
    document.getElementById("eventHour").value = h % 12 || 12; 
    document.getElementById("eventMin").value = mm;
    document.getElementById("eventRepeatGroup").classList.add("hidden");
  } else {
    document.getElementById("eventResponsible").value = ""; 
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
  
  let badge = '<span class="text-warning text-bold">⏳ Pendiente</span>';
  if(ev.estado === 'exitosa' || ev.completed) badge = '<span class="text-success text-bold">🟢 Gestión Exitosa</span>';
  else if(ev.estado === 'reprogramada') badge = '<span class="text-warning text-bold" style="color:#f97316">🟠 Reprogramada</span>';
  else if(ev.estado === 'fallida') badge = '<span class="text-danger text-bold">🔴 Fallida/Ausente</span>';

  let gpsLink = ev.ubicacion ? `<br><strong>Ubicación:</strong> <a href="https://www.google.com/maps?q=${ev.ubicacion.lat},${ev.ubicacion.lng}" target="_blank" class="text-blue text-bold">📍 Ver en Mapa</a>` : "";
  let imgHtml = ev.evidenciaUrl ? `<div class="mt-sm"><img src="${ev.evidenciaUrl}" style="max-width:100%; border-radius:8px; border:1px solid #ccc;"></div>` : "";

  document.getElementById("actionEventBody").innerHTML = `
    <strong>Fecha:</strong> ${ev.date.split('-').reverse().join('/')}<br>
    <strong>Hora:</strong> ${Cal.formatTime12h(ev.time)}<br>
    <strong>Tipo:</strong> ${Cal.getIcon(ev.type)} ${Cal.getTypeLabel(ev.type)}<br>
    <strong>Responsable:</strong> ${ev.responsible}<br>
    <strong>Estado:</strong> ${badge}
    ${gpsLink}
    ${imgHtml}
  `;
  
  const statusSelect = document.getElementById("eventNewStatus");
  if(statusSelect) statusSelect.value = ev.estado || (ev.completed ? 'exitosa' : 'pendiente');
  
  UI.showModal("modalEventActions");
}

function openNewAbsenceModal() { 
  document.getElementById("absDate").value = Cal.formatDateISO(State.selectedDate); 
  document.getElementById("absObs").value = ""; 
  document.getElementById("absResponsible").value = ""; 
  UI.showModal("modalFormAttendance"); 
}

function openAbsenceActionsModal(id) {
  const abs = State.absences.find(a => a.id === id); 
  if(!abs) return; 
  currentSelectedAbsenceId = id;
  let tLabel = abs.type === "PERMISO" ? "Permiso Médico/Otros" : (abs.type.includes("MANANA") ? "Falta (Mañana)" : (abs.type.includes("TARDE") ? "Falta (Tarde)" : "Falta (Día Completo)"));
  document.getElementById("absenceDetails").innerHTML = `<strong>Responsable:</strong> ${abs.responsible}<br><strong>Fecha:</strong> ${abs.date}<br><strong>Tipo:</strong> ${tLabel}<br><strong>Observación:</strong> ${abs.obs || '--'}`;
  UI.showModal("modalAbsenceActions");
}

async function saveEvent() {
  const id = document.getElementById("eventId").value; 
  const title = document.getElementById("eventTitle").value.trim(); 
  const dateVal = document.getElementById("eventDate").value; 
  const respVal = document.getElementById("eventResponsible").value;
  
  if(!title || !dateVal || !respVal) return UI.showToast("Completa datos obligatorios", "error");
  
  let h = parseInt(document.getElementById("eventHour").value); 
  const m = document.getElementById("eventMin").value; 
  const ampm = document.getElementById("eventAmPm").value;
  
  if(ampm === "PM" && h !== 12) h += 12; 
  if(ampm === "AM" && h === 12) h = 0;
  
  const timeVal = `${h.toString().padStart(2, '0')}:${m}`;
  const baseData = { 
    title, time: timeVal, responsible: respVal, 
    type: document.getElementById("eventType").value, 
    completed: false, estado: 'pendiente' 
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
      UI.showToast("Guardado");
    }
    UI.closeModals(); 
    const [y, mm, d] = dateVal.split('-'); 
    State.selectDate(parseInt(y), parseInt(mm)-1, parseInt(d)); 
    State.currentDate = new Date(State.selectedDate); 
    State.notify();
  } catch(e) { 
    UI.showToast("Error", "error"); 
  } finally { 
    btn.textContent = "Guardar"; btn.disabled = false; 
  }
}

async function saveAbsence() {
  const date = document.getElementById("absDate").value; 
  const resp = document.getElementById("absResponsible").value;
  if(!date || !resp) return UI.showToast("Seleccione fecha y colaborador", "error");
  try { 
    await FirebaseService.saveAbsence({ 
      date, responsible: resp, 
      type: document.getElementById("absType").value, 
      obs: document.getElementById("absObs").value 
    }); 
    UI.showToast("Ausencia registrada", "warning"); 
    UI.closeModals(); 
  } catch(e) { 
    UI.showToast("Error", "error"); 
  }
}

function updateNotifButtonUI() { 
  const btn = document.getElementById("btnNotifToggle"); 
  if(!btn) return;
  if (Notification.permission === "granted") { 
    if (State.notificationsEnabled) { 
      btn.innerHTML = "✅ Avisos"; btn.className = "btn-icon bg-blue-light text-blue text-bold border-blue pl-md pr-md"; 
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
      if (perm === "granted") { 
        State.notificationsEnabled = true; localStorage.setItem('notificationsEnabled', 'true'); 
        UI.showToast("¡Activado!"); updateNotifButtonUI(); 
      } 
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
    const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; 
    const todayStr = Cal.formatDateISO(now); 
    State.events.forEach(evt => { 
      if (evt.date.startsWith(todayStr) && evt.time === currentTimeString && !evt.completed && !evt.notified) { 
        UI.showNotificationCard(evt.title, `🔔 AHORA: ${evt.responsible}`); 
        const notif = new Notification(`⏰ ${evt.time} - ${evt.title}`, { body: `Responsable: ${evt.responsible}`, icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png", silent: true }); 
        notif.onclick = function() { window.focus(); this.close(); }; 
        evt.notified = true; setTimeout(() => { evt.notified = false; }, 65000); 
      } 
    }); 
  }, 5000); 
}
