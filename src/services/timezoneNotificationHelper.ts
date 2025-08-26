// Simplified timezone helper for backward compatibility
export const timezoneNotificationHelper = {
  formatTimeForUser: (date: Date, format: string) => {
    return date.toLocaleString();
  },
  
  getNextExactReminderTimeInTimezone: (hour: number, minute: number) => {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  },
  
  getTimezoneDebugInfo: () => ({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currentTime: new Date().toISOString()
  }),
  
  initializeUserTimezone: async () => {
    // Simplified initialization
    return Promise.resolve();
  }
};