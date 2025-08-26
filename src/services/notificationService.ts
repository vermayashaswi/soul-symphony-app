// Backward compatibility service - simplified notifications
import { toast } from 'sonner';

// Toast management
export const showToast = (title: string, description?: string) => {
  toast(title, { description });
};

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showNotification = (title: string, description?: string) => {
  toast(title, { description });
};

export const showTranslatedToast = (...args: any[]) => {
  toast(args[0], { description: args[1] });
};

export const showTutorialToast = (...args: any[]) => {
  toast(args[0], { description: args[1] });
};

// Component registration (stub)
export const registerComponent = (componentId: string) => {
  // Stub for backward compatibility
};

export const unregisterComponent = (componentId: string) => {
  // Stub for backward compatibility
};

// Toast clearing (stub)
export const clearAllToasts = () => {
  // Stub for backward compatibility
};

export const ensureAllToastsCleared = () => {
  // Stub for backward compatibility
};

// Legacy notification types
export type NotificationFrequency = 'daily' | 'weekly' | 'once';
export type NotificationTime = string | { hour: number; minute: number };

// Legacy notification settings
export const setupJournalReminder = (enabled: boolean, frequency: NotificationFrequency, times: NotificationTime[]) => {
  // Stub for backward compatibility
};

export const initializeCapacitorNotifications = async () => {
  // Stub for backward compatibility
};

export const getNotificationSettings = () => {
  // Stub for backward compatibility
  return { enabled: false, frequency: 'daily' as NotificationFrequency, times: [] };
};