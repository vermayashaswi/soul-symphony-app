import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// Component mount tracking for safe DOM operations
const mountedComponents = new Set<string>();

export function registerComponent(componentId: string) {
  mountedComponents.add(componentId);
}

export function unregisterComponent(componentId: string) {
  mountedComponents.delete(componentId);
}

function isComponentMounted(componentId?: string): boolean {
  if (!componentId) return true; // If no ID provided, assume it's safe
  return mountedComponents.has(componentId);
}

// Safe toast wrapper that checks if component is still mounted
function safeToast(props: any, componentId?: string) {
  if (!isComponentMounted(componentId)) {
    console.log('Skipping toast for unmounted component:', componentId);
    return { id: '', dismiss: () => {}, update: () => {} };
  }
  
  try {
    return toast(props);
  } catch (error) {
    console.error('Toast error:', error);
    return { id: '', dismiss: () => {}, update: () => {} };
  }
}

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, duration?: number, componentId?: string) {
  return safeToast({
    title,
    description,
    duration
  }, componentId);
}

// New function specifically for tutorial toasts with short duration
export function showTutorialToast(title: string, description: string, componentId?: string) {
  return safeToast({
    title,
    description,
    duration: 500 // 0.5 seconds
  }, componentId);
}

// Translation-aware toast function - updated to handle async translate function
export async function showTranslatedToast(
  titleKey: string, 
  descriptionKey: string, 
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  duration?: number,
  interpolations?: Record<string, string>,
  componentId?: string
) {
  if (!isComponentMounted(componentId)) {
    console.log('Skipping translated toast for unmounted component:', componentId);
    return;
  }

  let title = await translate(titleKey);
  let description = await translate(descriptionKey);
  
  // Handle interpolations for dynamic content
  if (interpolations) {
    Object.entries(interpolations).forEach(([key, value]) => {
      title = title.replace(`{${key}}`, value);
      description = description.replace(`{${key}}`, value);
    });
  }
  
  return safeToast({
    title,
    description,
    duration
  }, componentId);
}

// Enhanced tutorial toast function that supports translation
export async function showTranslatedTutorialToast(
  titleKey: string,
  descriptionKey: string,
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  componentId?: string
) {
  if (!isComponentMounted(componentId)) {
    console.log('Skipping translated tutorial toast for unmounted component:', componentId);
    return;
  }

  const title = await translate(titleKey);
  const description = await translate(descriptionKey);
  
  return safeToast({
    title,
    description,
    duration: 500 // 0.5 seconds for tutorial
  }, componentId);
}

// Legacy functions for backward compatibility
export function clearAllToasts() {
  // Implementation for clearing all toasts if needed
  console.log('clearAllToasts called - using sonner toast system');
}

export async function ensureAllToastsCleared() {
  // Implementation for ensuring toasts are cleared
  return Promise.resolve();
}

// Notification types
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

interface NotificationConfig {
  times: NotificationTime[];
  enabled: boolean;
}

// Time mappings for notifications
const TIME_MAPPINGS: Record<NotificationTime, { hour: number; minute: number; label: string }> = {
  morning: { hour: 8, minute: 0, label: 'Morning (8:00 AM)' },
  afternoon: { hour: 14, minute: 0, label: 'Afternoon (2:00 PM)' },
  evening: { hour: 19, minute: 0, label: 'Evening (7:00 PM)' },
  night: { hour: 22, minute: 0, label: 'Night (10:00 PM)' }
};

// Motivational messages for notifications
const NOTIFICATION_MESSAGES = [
  {
    title: "Time to reflect 🌟",
    body: "How are you feeling right now? Share your thoughts with SOuLO."
  },
  {
    title: "Your journal awaits ✨",
    body: "Take a moment to capture your emotions and experiences."
  },
  {
    title: "Mindful moment 🧘",
    body: "What's on your mind? Let SOuLO help you process your thoughts."
  },
  {
    title: "Daily check-in 💭",
    body: "Record your feelings and continue your emotional journey."
  },
  {
    title: "Self-reflection time 🌙",
    body: "How was your day? Share your experiences with SOuLO."
  }
];

class NotificationService {
  private isInitialized = false;
  private config: NotificationConfig = { times: [], enabled: false };

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Check if we're on a mobile platform
      if (!Capacitor.isNativePlatform()) {
        console.log('Not on native platform, notification service limited');
        this.isInitialized = true;
        return false;
      }

      // Request permissions
      const permissionResult = await LocalNotifications.requestPermissions();
      
      if (permissionResult.display !== 'granted') {
        console.warn('Notification permissions not granted');
        return false;
      }

      // Load saved configuration
      await this.loadConfiguration();
      
      this.isInitialized = true;
      console.log('Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const enabled = localStorage.getItem('notification_enabled') === 'true';
      const timesStr = localStorage.getItem('notification_times');
      
      let times: NotificationTime[] = [];
      if (timesStr) {
        times = JSON.parse(timesStr);
      }

      this.config = { enabled, times };
      console.log('Loaded notification configuration:', this.config);
    } catch (error) {
      console.error('Error loading notification configuration:', error);
      this.config = { enabled: false, times: [] };
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      localStorage.setItem('notification_enabled', this.config.enabled.toString());
      localStorage.setItem('notification_times', JSON.stringify(this.config.times));
      console.log('Saved notification configuration:', this.config);
    } catch (error) {
      console.error('Error saving notification configuration:', error);
    }
  }

  async setupNotifications(enabled: boolean, frequency: NotificationFrequency, times: NotificationTime[]): Promise<boolean> {
    try {
      // Update configuration
      this.config = { enabled, times };
      await this.saveConfiguration();

      if (!enabled || times.length === 0) {
        await this.cancelAllNotifications();
        return true;
      }

      // Initialize if needed
      const initialized = await this.initialize();
      if (!initialized) {
        console.warn('Cannot setup notifications: initialization failed');
        return false;
      }

      // Cancel existing notifications
      await this.cancelAllNotifications();

      // Schedule new notifications
      await this.scheduleNotifications(times);
      
      console.log(`Successfully scheduled notifications for ${times.length} times`);
      return true;
    } catch (error) {
      console.error('Error setting up notifications:', error);
      return false;
    }
  }

  private async scheduleNotifications(times: NotificationTime[]): Promise<void> {
    const notifications: ScheduleOptions[] = [];
    
    // Schedule notifications for the next 30 days
    const today = new Date();
    
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      
      times.forEach((timeSlot, index) => {
        const timeConfig = TIME_MAPPINGS[timeSlot];
        const notificationDate = new Date(targetDate);
        notificationDate.setHours(timeConfig.hour, timeConfig.minute, 0, 0);
        
        // Only schedule future notifications
        if (notificationDate.getTime() > Date.now()) {
          // Rotate through different messages
          const messageIndex = (dayOffset * times.length + index) % NOTIFICATION_MESSAGES.length;
          const message = NOTIFICATION_MESSAGES[messageIndex];
          
          notifications.push({
            title: message.title,
            body: message.body,
            id: this.generateNotificationId(dayOffset, timeSlot),
            schedule: { at: notificationDate },
            sound: 'default',
            attachments: [],
            actionTypeId: 'JOURNAL_REMINDER',
            extra: {
              timeSlot,
              date: notificationDate.toISOString()
            }
          });
        }
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log(`Scheduled ${notifications.length} notifications`);
    }
  }

  private generateNotificationId(dayOffset: number, timeSlot: NotificationTime): number {
    // Generate unique ID based on day offset and time slot
    const timeSlotIndex = Object.keys(TIME_MAPPINGS).indexOf(timeSlot);
    return (dayOffset * 10) + timeSlotIndex + 1000; // Offset by 1000 to avoid conflicts
  }

  private async cancelAllNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        const ids = pending.notifications.map(n => ({ id: n.id }));
        await LocalNotifications.cancel({ notifications: ids });
        console.log(`Cancelled ${ids.length} pending notifications`);
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return false;
      }

      const result = await LocalNotifications.checkPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return false;
      }

      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  getConfiguration(): NotificationConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getScheduledTimes(): NotificationTime[] {
    return [...this.config.times];
  }

  // Get available time options for UI
  getTimeOptions(): { label: string; value: NotificationTime }[] {
    return Object.entries(TIME_MAPPINGS).map(([key, config]) => ({
      label: config.label,
      value: key as NotificationTime
    }));
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Export main functions
export function setupJournalReminder(enabled: boolean, frequency: NotificationFrequency, times: NotificationTime[]): Promise<boolean> {
  return notificationService.setupNotifications(enabled, frequency, times);
}

export function initializeCapacitorNotifications(): Promise<boolean> {
  return notificationService.initialize();
}

export function checkNotificationPermissions(): Promise<boolean> {
  return notificationService.checkPermissions();
}

export function requestNotificationPermissions(): Promise<boolean> {
  return notificationService.requestPermissions();
}

export function getNotificationConfiguration(): NotificationConfig {
  return notificationService.getConfiguration();
}

export function getTimeOptions(): { label: string; value: NotificationTime }[] {
  return notificationService.getTimeOptions();
}

export default notificationService;
