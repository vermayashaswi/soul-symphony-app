
import { toast } from "sonner";

// Duration constants
const STANDARD_DURATION = 1000; // 1 second for regular toasts
const ACTIVE_JOB_DURATION = null; // null means the toast won't auto-dismiss

// Check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

// Enhanced toast functions for different types of notifications
export const showToast = (
  message: string, 
  type: "default" | "success" | "error" | "info" | "warning" = "default",
  isActiveJob = false
) => {
  const duration = isActiveJob ? ACTIVE_JOB_DURATION : STANDARD_DURATION;
  
  let toastId;
  switch (type) {
    case "success":
      toastId = toast.success(message, { duration });
      break;
    case "error":
      toastId = toast.error(message, { duration });
      break;
    case "info":
      toastId = toast.info(message, { duration });
      break;
    case "warning":
      toastId = toast.warning(message, { duration });
      break;
    default:
      toastId = toast(message, { duration });
  }
  
  return toastId;
};

// Clear a specific toast
export const clearToast = (toastId: string | number) => {
  toast.dismiss(toastId);
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
