export const State = {
  events: [],
  absences: [],
  currentDate: new Date(),
  selectedDate: new Date(),
  filters: { category: 'all', responsible: 'all', search: '' },
  theme: localStorage.getItem('theme') || 'light',
  notificationsEnabled: localStorage.getItem('notificationsEnabled') === 'true',
  listeners: [],

  subscribe(callback) {
    this.listeners.push(callback);
  },

  notify() {
    this.listeners.forEach(fn => fn(this));
  },

  updateData(events, absences) {
    if(events) this.events = events;
    if(absences) this.absences = absences;
    this.notify();
  },

  changeMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    this.notify();
  },

  selectDate(year, month, day) {
    this.selectedDate = new Date(year, month, day);
    this.notify();
  },

  setFilters(cat, resp, search) {
    if(cat !== undefined) this.filters.category = cat;
    if(resp !== undefined) this.filters.responsible = resp;
    if(search !== undefined) this.filters.search = search.toLowerCase();
    this.notify();
  },

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', this.theme);
    return this.theme;
  },

  toggleNotifications() {
    this.notificationsEnabled = !this.notificationsEnabled;
    localStorage.setItem('notificationsEnabled', this.notificationsEnabled.toString());
    return this.notificationsEnabled;
  }
};
