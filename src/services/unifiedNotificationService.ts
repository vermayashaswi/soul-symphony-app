// Re-export FCM notification service for backward compatibility
export * from './fcmNotificationService';
import { fcmNotificationService } from './fcmNotificationService';

// Legacy compatibility exports
export default fcmNotificationService;
export const unifiedNotificationService = fcmNotificationService;

// Re-export all legacy methods and types for backward compatibility
export { fcmNotificationService as newNotificationService };
export { fcmNotificationService as notificationService };

// Legacy function exports with correct signatures
export const showToast = (title: string, description: string, duration?: number, componentId?: string) => 
  console.log(`Legacy showToast: ${title} - ${description}`);
export const showTutorialToast = (title: string, description: string, componentId?: string) => 
  console.log(`Legacy showTutorialToast: ${title} - ${description}`);
export const showTranslatedToast = async (
  titleKey: string, 
  descriptionKey: string, 
  translate: any,
  duration?: number,
  interpolations?: Record<string, string>,
  componentId?: string
) => console.log(`Legacy showTranslatedToast: ${titleKey} - ${descriptionKey}`);
export const showTranslatedTutorialToast = async (
  titleKey: string,
  descriptionKey: string,
  translate: any,
  componentId?: string
) => console.log(`Legacy showTranslatedTutorialToast: ${titleKey} - ${descriptionKey}`);

export const clearAllToasts = () => console.log('Legacy clearAllToasts called');
export const ensureAllToastsCleared = () => Promise.resolve();
export const registerComponent = (id: string) => console.log(`Legacy registerComponent: ${id}`);
export const unregisterComponent = (id: string) => console.log(`Legacy unregisterComponent: ${id}`);
export const getNotificationSettings = () => ({ enabled: false, reminders: [] });
export const setupJournalReminder = (enabled: boolean, frequency: string, times: string[]) => 
  console.log(`Legacy setupJournalReminder: ${enabled}, ${frequency}, ${times}`);
export const initializeCapacitorNotifications = () => console.log('Legacy initializeCapacitorNotifications called');
export const checkPermissionStatus = () => fcmNotificationService.checkPermissionStatus();