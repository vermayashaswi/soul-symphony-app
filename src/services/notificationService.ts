
import { toast } from "sonner";

// Duration constants
const STANDARD_DURATION = 3000; // 3 seconds for regular toasts (improved from 1 second)
const ACTIVE_JOB_DURATION = 5000; // 5 seconds for active jobs
const ERROR_DURATION = 4000; // 4 seconds for errors (increased from 3 seconds)

// Check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

// Store active toast IDs to prevent duplicates and ensure cleanup
const activeToasts = new Set<string | number>();

// Enhanced toast functions for different types of notifications
export const showToast = (
  message: string, 
  type: "default" | "success" | "error" | "info" | "warning" = "default",
  isActiveJob = false
) => {
  // Deduplicate identical messages that might be in flight
  if (activeToasts.has(message)) {
    return;
  }
  
  const duration = isActiveJob ? ACTIVE_JOB_DURATION : 
                  (type === "error" ? ERROR_DURATION : STANDARD_DURATION);
  
  let toastId;
  switch (type) {
    case "success":
      toastId = toast.success(message, { 
        duration, 
        onDismiss: () => activeToasts.delete(message),
        closeButton: true
      });
      break;
    case "error":
      toastId = toast.error(message, { 
        duration, 
        onDismiss: () => activeToasts.delete(message),
        closeButton: true
      });
      break;
    case "info":
      toastId = toast.info(message, { 
        duration, 
        onDismiss: () => activeToasts.delete(message),
        closeButton: true
      });
      break;
    case "warning":
      toastId = toast.warning(message, { 
        duration, 
        onDismiss: () => activeToasts.delete(message),
        closeButton: true
      });
      break;
    default:
      toastId = toast(message, { 
        duration, 
        onDismiss: () => activeToasts.delete(message),
        closeButton: true
      });
  }
  
  activeToasts.add(message);
  
  // Ensure toasts are cleared after their duration
  if (duration !== null) {
    setTimeout(() => {
      clearToast(toastId);
      activeToasts.delete(message);
    }, duration + 100); // Add a small buffer to ensure toast removal
  }
  
  return toastId;
};

// Clear a specific toast
export const clearToast = (toastId: string | number) => {
  if (toastId) {
    toast.dismiss(toastId);
  }
};

// Clear all toasts - enhanced to be more aggressive
export const clearAllToasts = () => {
  // First use the standard dismiss method
  toast.dismiss();
  
  // Then clear our tracking set
  activeToasts.clear();
  
  // As a safety measure for any persistent toasts with the loading state,
  // get all toast elements and remove them manually if needed
  if (isBrowser()) {
    try {
      // Try to find any toast container elements that might be persisting
      const toastContainers = document.querySelectorAll('[data-sonner-toast]');
      if (toastContainers.length > 0) {
        toastContainers.forEach(container => {
          // Manual removal since we've disabled close buttons
          if (container.parentNode) {
            setTimeout(() => {
              if (document.body.contains(container as Node)) {
                container.parentNode?.removeChild(container);
              }
            }, 200);
          }
        });
      }
    } catch (e) {
      console.error('Error trying to clean up persistent toasts:', e);
    }
  }
};

// Function to request notification permissions (web only for now)
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    // For web browsers
    if (isBrowser() && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Schedule a notification (for reminders) - web only for now
export const scheduleNotification = async (title: string, body: string, hours: number = 24): Promise<boolean> => {
  try {
    // For web testing - immediate notification
    if (isBrowser() && 'Notification' in window && Notification.permission === 'granted') {
      // This is just a mock for web - on real mobile we would use actual scheduling
      // In a real app with Capacitor installed, we would use LocalNotifications.schedule
      new Notification(title, { body });
      
      // Log for debugging
      console.log(`Scheduled notification: "${title}" for ${hours} hours from now`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return false;
  }
};

// Set up journal reminder
export const setupJournalReminder = async (enabled: boolean): Promise<void> => {
  if (!enabled) return;
  
  try {
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      await scheduleNotification(
        "Feelosophy Journal Reminder",
        "It's time to check in with yourself. Take a moment to record your thoughts.",
        24 // Daily reminder
      );
      showToast("Journal reminders enabled", "success");
    } else {
      showToast("Could not enable notifications. Please check your browser settings.", "error");
    }
  } catch (error) {
    console.error("Error setting up journal reminder:", error);
    showToast("Failed to set up notification", "error");
  }
};

// Placeholder for mobile integration 
export const initializeCapacitorNotifications = (): void => {
  // This is a placeholder function that would be implemented when Capacitor is added
  console.log("Mobile notifications are not available in this browser version.");
  showToast("Mobile notifications require the app to be installed on your device.", "info");
};
