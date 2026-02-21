export const CalendarHelper = {
  getDaysInMonth: (year, month) => new Date(year, month + 1, 0).getDate(),
  
  getFirstDayIndex: (year, month) => new Date(year, month, 1).getDay(),
  
  formatDateISO: (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  formatTime12h: (time24) => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  },

  getMonthName: (monthIndex) => {
    const names = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return names[monthIndex];
  },

  getColorClass: (type) => {
    const map = { "cobranza_comunal": "tag-red", "cobranza_individual": "tag-orange", "visita": "tag-blue", "desembolso": "tag-green", "reunion": "tag-yellow", "morosos": "tag-purple" };
    return map[type] || "tag-blue";
  },
  
  getIcon: (type) => {
    const map = { "cobranza_comunal": "👨🏽‍🤝‍👨🏻", "cobranza_individual": "🧍", "morosos": "🛑", "visita": "🏠", "desembolso": "💵", "reunion": "📅" };
    return map[type] || "📌";
  },

  getTypeLabel: (type) => {
    const map = { "cobranza_comunal": "Cobranza BC/GS", "cobranza_individual": "Cobranza Indiv.", "morosos": "Morosos", "visita": "Visita", "desembolso": "Desembolso", "reunion": "Reunión" };
    return map[type] || type;
  }
};
