
import { toast } from "sonner";

// Check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
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
      toast.success("Journal reminders enabled");
    } else {
      toast.error("Could not enable notifications. Please check your browser settings.");
    }
  } catch (error) {
    console.error("Error setting up journal reminder:", error);
    toast.error("Failed to set up notification");
  }
};

// Placeholder for mobile integration 
export const initializeCapacitorNotifications = (): void => {
  // This is a placeholder function that would be implemented when Capacitor is added
  console.log("Mobile notifications are not available in this browser version.");
  toast.info("Mobile notifications require the app to be installed on your device.");
};
