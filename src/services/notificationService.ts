
import { toast } from "sonner";

// Check if we're in a Capacitor environment
const isCapacitorAvailable = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

// Function to request notification permissions
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    // For Capacitor/mobile
    if (isCapacitorAvailable()) {
      const { Permissions } = await import('@capacitor/core');
      const { Notifications } = await import('@capacitor/push-notifications');
      
      // Request permission
      const permissionStatus = await Permissions.query({ name: 'notifications' });
      
      if (permissionStatus.state === 'granted') {
        // Register with FCM/APNS
        await Notifications.register();
        return true;
      } else if (permissionStatus.state === 'prompt') {
        const request = await Notifications.requestPermissions();
        if (request.receive === 'granted') {
          await Notifications.register();
          return true;
        }
      }
      return false;
    } 
    // For web
    else if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Schedule a notification (for reminders)
export const scheduleNotification = async (title: string, body: string, hours: number = 24): Promise<boolean> => {
  try {
    if (isCapacitorAvailable()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Schedule notification
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Date.now(),
            schedule: { at: new Date(Date.now() + hours * 60 * 60 * 1000) },
            sound: 'default',
            attachments: null,
            actionTypeId: '',
            extra: null,
          },
        ],
      });
      return true;
    } else if ('Notification' in window && Notification.permission === 'granted') {
      // For web testing - immediate notification
      new Notification(title, { body });
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
      toast.error("Could not enable notifications. Please check your device settings.");
    }
  } catch (error) {
    console.error("Error setting up journal reminder:", error);
    toast.error("Failed to set up notification");
  }
};
