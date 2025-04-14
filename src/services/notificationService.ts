
import { toast } from 'sonner';

/**
 * Types for notification settings
 */
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Tracks active toast IDs
 */
const activeToasts = new Set<string>();

/**
 * Clear all active toasts
 */
export function clearAllToasts(): void {
  // First try to clear any toasts that might be in our tracking set
  activeToasts.forEach(id => {
    try {
      toast.dismiss(id);
    } catch (e) {
      // Ignore errors from dismissed toasts
    }
  });
  activeToasts.clear();
  
  // Also try to clear toasts with common IDs
  const commonToastIds = [
    'processing-toast',
    'recording-toast',
    'error-toast',
    'success-toast',
    'journal-toast',
    'journal-success-toast',
    'journal-error-toast'
  ];
  
  commonToastIds.forEach(id => {
    try {
      toast.dismiss(id);
    } catch (e) {
      // Ignore errors from dismissed toasts
    }
  });
}

/**
 * Double-check that all toasts have been cleared
 */
export function ensureAllToastsCleared(): void {
  // Add a slight delay to ensure any in-progress dismissals complete
  setTimeout(() => {
    clearAllToasts();
  }, 100);
}

/**
 * Show toast with tracking
 */
export function showTrackedToast(
  message: string, 
  options: { 
    id?: string; 
    type?: 'success' | 'error' | 'info' | 'loading';
    duration?: number;
  } = {}
): string {
  const id = options.id || `toast-${Date.now()}`;
  
  let toastFunction;
  switch (options.type) {
    case 'success':
      toastFunction = toast.success;
      break;
    case 'error':
      toastFunction = toast.error;
      break;
    case 'loading':
      toastFunction = toast.loading;
      break;
    default:
      toastFunction = toast;
  }
  
  toastFunction(message, {
    id,
    duration: options.duration || 3000,
  });
  
  activeToasts.add(id);
  return id;
}

/**
 * Setup journal reminders using the device's notification system
 * This is called from the Settings page
 */
export function setupJournalReminder(
  enabled: boolean,
  frequency: NotificationFrequency = 'once',
  times: NotificationTime[] = ['evening']
): Promise<boolean> {
  console.log('Setting up journal reminders:', { enabled, frequency, times });
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('notification_enabled', enabled ? 'true' : 'false');
    localStorage.setItem('notification_frequency', frequency);
    localStorage.setItem('notification_times', JSON.stringify(times));
  }
  
  if (enabled) {
    // Show success toast
    toast.success('Journal reminders set up successfully');
    return Promise.resolve(true);
  } else {
    // Show info toast
    toast.info('Journal reminders disabled');
    return Promise.resolve(false);
  }
}

/**
 * Initialize notifications for Capacitor (mobile devices)
 * This is a placeholder function for now
 */
export function initializeCapacitorNotifications(): Promise<void> {
  console.log('Initializing Capacitor notifications');
  
  // For web only implementation, just resolve
  return Promise.resolve();
}
