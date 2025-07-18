
// Minimal notification service stub for API compatibility
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

interface NotificationSettings {
  enabled: boolean;
  times: NotificationTime[];
}

// Component mount tracking stubs
export function registerComponent(componentId: string) {
  console.log('Notification service disabled - registerComponent called for:', componentId);
}

export function unregisterComponent(componentId: string) {
  console.log('Notification service disabled - unregisterComponent called for:', componentId);
}

// Toast function stubs
export function showToast(title: string, description: string, duration?: number, componentId?: string) {
  console.log('Notification service disabled - showToast:', { title, description, duration, componentId });
  return { id: '', dismiss: () => {}, update: () => {} };
}

export function showTutorialToast(title: string, description: string, componentId?: string) {
  console.log('Notification service disabled - showTutorialToast:', { title, description, componentId });
  return { id: '', dismiss: () => {}, update: () => {} };
}

export async function showTranslatedToast(
  titleKey: string, 
  descriptionKey: string, 
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  duration?: number,
  interpolations?: Record<string, string>,
  componentId?: string
) {
  console.log('Notification service disabled - showTranslatedToast:', { titleKey, descriptionKey });
  return;
}

export async function showTranslatedTutorialToast(
  titleKey: string,
  descriptionKey: string,
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  componentId?: string
) {
  console.log('Notification service disabled - showTranslatedTutorialToast:', { titleKey, descriptionKey });
  return;
}

// Legacy function stubs
export function clearAllToasts() {
  console.log('Notification service disabled - clearAllToasts called');
}

export async function ensureAllToastsCleared() {
  console.log('Notification service disabled - ensureAllToastsCleared called');
  return Promise.resolve();
}

// Notification permission and setup stubs
export async function requestNotificationPermission(): Promise<boolean> {
  console.log('Notification service disabled - requestNotificationPermission called');
  return false;
}

export function showNotification(title: string, body: string, options?: any) {
  console.log('Notification service disabled - showNotification:', { title, body, options });
  return null;
}

export function setupJournalReminder(enabled: boolean, frequency: NotificationFrequency, times: NotificationTime[]) {
  console.log('Notification service disabled - setupJournalReminder:', { enabled, frequency, times });
}

export function initializeCapacitorNotifications() {
  console.log('Notification service disabled - initializeCapacitorNotifications called');
}

export function getNotificationSettings(): NotificationSettings {
  console.log('Notification service disabled - getNotificationSettings called');
  return { enabled: false, times: [] };
}

export function testNotification() {
  console.log('Notification service disabled - testNotification called');
  alert('Notifications are currently disabled in this app version.');
}
