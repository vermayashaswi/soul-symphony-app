// Simple toast service for components that need toast functionality
// without notification queue dependencies

export const showToast = (title: string, description: string, duration?: number, componentId?: string) => {
  console.log(`[ToastService] Toast: ${title} - ${description}`);
  // This can be enhanced later with actual toast implementation
};

export const showTutorialToast = (title: string, description: string, componentId?: string) => {
  console.log(`[ToastService] Tutorial Toast: ${title} - ${description}`);
};

export const showTranslatedToast = async (
  titleKey: string, 
  descriptionKey: string, 
  translate: any,
  duration?: number,
  interpolations?: Record<string, string>,
  componentId?: string
) => {
  console.log(`[ToastService] Translated toast: ${titleKey} - ${descriptionKey}`);
};

export const showTranslatedTutorialToast = async (
  titleKey: string,
  descriptionKey: string,
  translate: any,
  componentId?: string
) => {
  console.log(`[ToastService] Translated tutorial toast: ${titleKey} - ${descriptionKey}`);
};

export const clearAllToasts = () => {
  console.log('[ToastService] clearAllToasts called');
};

export const ensureAllToastsCleared = () => {
  return Promise.resolve();
};

export const registerComponent = (id: string) => {
  console.log(`[ToastService] Component registered: ${id}`);
};

export const unregisterComponent = (id: string) => {
  console.log(`[ToastService] Component unregistered: ${id}`);
};

export const getNotificationSettings = () => {
  return { enabled: false, reminders: [] };
};

export const setupJournalReminder = (enabled: boolean, frequency: string, times: string[]) => {
  console.log(`[ToastService] setupJournalReminder: ${enabled}, ${frequency}, ${times}`);
};

export const initializeCapacitorNotifications = () => {
  console.log('[ToastService] initializeCapacitorNotifications called');
};

export const checkPermissionStatus = () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as 'granted' | 'denied' | 'default' | 'unsupported';
};

// Legacy type exports for compatibility
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type JournalReminderTime = NotificationTime;