
// Export types from the notificationService.ts for use in other files
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

// Re-export the functions from notificationService for better type safety
import { 
  showToast,
  clearToast,
  clearAllToasts,
  ensureAllToastsCleared,
  requestNotificationPermission,
  scheduleNotification,
  setupJournalReminder,
  initializeCapacitorNotifications,
  cleanupNotifications
} from './notificationService';

export {
  showToast,
  clearToast,
  clearAllToasts,
  ensureAllToastsCleared,
  requestNotificationPermission,
  scheduleNotification,
  setupJournalReminder,
  initializeCapacitorNotifications,
  cleanupNotifications
};
