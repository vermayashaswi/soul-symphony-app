
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/TranslationContext';

// Types for notification settings
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

let activeToasts: string[] = [];

export const clearAllToasts = () => {
  activeToasts.forEach(id => {
    if (id) toast.dismiss(id);
  });
  activeToasts = [];
};

// Function to ensure all toasts are cleared
export const ensureAllToastsCleared = async (): Promise<void> => {
  clearAllToasts();
  // Wait a brief moment to ensure UI is updated
  return new Promise(resolve => setTimeout(resolve, 100));
};

export const dismissToast = (id: string) => {
  toast.dismiss(id);
  activeToasts = activeToasts.filter(toastId => toastId !== id);
};

export const addToast = (id: string) => {
  activeToasts.push(id);
};

export const getActiveToasts = () => {
  return activeToasts;
};

export const translateAndShowToast = async (
  message: string, 
  type: 'success' | 'error' | 'info' | 'loading' = 'info',
  options: any = {}
) => {
  try {
    const { translate } = useTranslation();
    const translatedMessage = await translate(message);
    
    let toastId;
    
    switch (type) {
      case 'success':
        toastId = toast.success(translatedMessage, options);
        break;
      case 'error':
        toastId = toast.error(translatedMessage, options);
        break;
      case 'loading':
        toastId = toast.loading(translatedMessage, options);
        break;
      default:
        toastId = toast(translatedMessage, options);
    }
    
    if (toastId) {
      addToast(toastId);
    }
    
    return toastId;
  } catch (error) {
    console.error('Error showing translated toast:', error);
    return toast(message, options); // Fallback to original message
  }
};

// Notification setup functions for Settings.tsx
export const setupJournalReminder = async (
  enabled: boolean, 
  frequency: NotificationFrequency = 'once',
  times: NotificationTime[] = ['evening']
): Promise<boolean> => {
  try {
    // Save notification preferences in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification_enabled', String(enabled));
      localStorage.setItem('notification_frequency', frequency);
      localStorage.setItem('notification_times', JSON.stringify(times));
    }
    
    // This is a placeholder implementation
    // In a real app, you would integrate with Capacitor notifications
    console.log(`Setting up notifications: enabled=${enabled}, frequency=${frequency}, times=${times.join(',')}`);
    return true;
  } catch (error) {
    console.error('Error setting up notifications:', error);
    return false;
  }
};

// Initialize Capacitor notifications
export const initializeCapacitorNotifications = async (): Promise<void> => {
  try {
    // This is a placeholder for Capacitor notification initialization
    // In a real app, you would initialize the Capacitor Notifications plugin
    console.log('Initializing Capacitor notifications');
    return Promise.resolve();
  } catch (error) {
    console.error('Error initializing Capacitor notifications:', error);
    return Promise.reject(error);
  }
};
