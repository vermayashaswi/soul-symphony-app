import { toast } from '@/hooks/use-toast';
import { nativeIntegrationService } from './nativeIntegrationService';
import { logger } from '@/utils/logger';

// Component mount tracking for safe DOM operations
const mountedComponents = new Set<string>();
const notificationLogger = logger.createLogger('NotificationService');

export function registerComponent(componentId: string) {
  mountedComponents.add(componentId);
}

export function unregisterComponent(componentId: string) {
  mountedComponents.delete(componentId);
}

function isComponentMounted(componentId?: string): boolean {
  if (!componentId) return true;
  return mountedComponents.has(componentId);
}

// Safe toast wrapper that checks if component is still mounted
function safeToast(props: any, componentId?: string) {
  if (!isComponentMounted(componentId)) {
    notificationLogger.debug('Skipping toast for unmounted component', { componentId });
    return { id: '', dismiss: () => {}, update: () => {} };
  }
  
  try {
    return toast(props);
  } catch (error) {
    notificationLogger.error('Toast error', error, { componentId });
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
    notificationLogger.debug('Skipping translated toast for unmounted component', { componentId });
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
    notificationLogger.debug('Skipping translated tutorial toast for unmounted component', { componentId });
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
  notificationLogger.debug('clearAllToasts called - using sonner toast system');
}

export async function ensureAllToastsCleared() {
  return Promise.resolve();
}

// Notification-related types and interfaces
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

interface NotificationSettings {
  enabled: boolean;
  times: NotificationTime[];
}

interface ScheduledNotification {
  id: string;
  time: NotificationTime;
  scheduledFor: Date;
  timeoutId?: number;
}

// Storage for active notifications
let activeNotifications: ScheduledNotification[] = [];

// Time mappings for notifications
const TIME_MAPPINGS: Record<NotificationTime, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 19, minute: 0 },
  night: { hour: 22, minute: 0 }
};

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    notificationLogger.info('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    notificationLogger.info('Notification permission denied');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    notificationLogger.error('Error requesting notification permission', error);
    return false;
  }
}

// Show immediate notification
export function showNotification(title: string, body: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    notificationLogger.debug('Cannot show notification - permission not granted');
    return;
  }

  const notification = new Notification(title, {
    body,
    icon: '/lovable-uploads/a07b91eb-274a-47b6-8180-fb4c9c0bc8a5.png',
    badge: '/lovable-uploads/a07b91eb-274a-47b6-8180-fb4c9c0bc8a5.png',
    tag: 'journal-reminder',
    requireInteraction: false,
    silent: false,
    ...options
  });

  // Auto-close after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);

  // Handle notification click
  notification.onclick = () => {
    window.focus();
    notification.close();
    // Navigate to journal page if possible
    if (window.location.pathname !== '/app/journal') {
      window.location.href = '/app/journal';
    }
  };

  return notification;
}

// Calculate next notification time
function getNextNotificationTime(time: NotificationTime): Date {
  const now = new Date();
  const next = new Date();
  const { hour, minute } = TIME_MAPPINGS[time];
  
  next.setHours(hour, minute, 0, 0);
  
  // If the time has already passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

// Schedule a single notification
function scheduleNotification(time: NotificationTime): ScheduledNotification {
  const id = `${time}-${Date.now()}`;
  const scheduledFor = getNextNotificationTime(time);
  
  notificationLogger.debug('Scheduling notification', { time, scheduledFor: scheduledFor.toLocaleString() });
  
  const timeoutMs = scheduledFor.getTime() - Date.now();
  
  const timeoutId = window.setTimeout(() => {
    notificationLogger.debug('Showing scheduled notification', { time });
    
    showNotification(
      'Journal Reminder 📝',
      "It's time to reflect on your day. Take a moment to journal your thoughts and feelings.",
      {
        tag: `journal-reminder-${time}`,
        data: { time, scheduledFor: scheduledFor.toISOString() }
      }
    );
    
    // Schedule the next occurrence (next day)
    const nextNotification = scheduleNotification(time);
    
    // Replace this notification with the next one
    const index = activeNotifications.findIndex(n => n.id === id);
    if (index !== -1) {
      activeNotifications[index] = nextNotification;
    }
  }, timeoutMs);
  
  return {
    id,
    time,
    scheduledFor,
    timeoutId
  };
}

// Clear all scheduled notifications
function clearScheduledNotifications() {
  activeNotifications.forEach(notification => {
    if (notification.timeoutId) {
      clearTimeout(notification.timeoutId);
    }
  });
  activeNotifications = [];
  notificationLogger.debug('All scheduled notifications cleared');
}

// Schedule native notifications using Capacitor LocalNotifications
async function scheduleNativeNotifications(times: NotificationTime[]) {
  if (!nativeIntegrationService.isRunningNatively()) {
    console.log('Not running natively, skipping native notifications');
    return;
  }

  try {
    const localNotifications = nativeIntegrationService.getPlugin('LocalNotifications');
    if (!localNotifications) {
      console.log('LocalNotifications plugin not available');
      return;
    }

    // Cancel all existing notifications
    await localNotifications.cancel({ notifications: [] });

    // Schedule notifications for each selected time
    const notifications = times.map((time, index) => {
      const { hour, minute } = TIME_MAPPINGS[time];
      const scheduledDate = getNextNotificationTime(time);
      
      return {
        id: index + 1,
        title: 'Journal Reminder 📝',
        body: "It's time to reflect on your day. Take a moment to journal your thoughts and feelings.",
        schedule: {
          at: scheduledDate,
          repeats: true,
          every: 'day'
        },
        sound: 'default',
        actionTypeId: 'JOURNAL_REMINDER',
        extra: {
          time,
          scheduledFor: scheduledDate.toISOString()
        }
      };
    });

    await localNotifications.schedule({ notifications });
    console.log(`Scheduled ${notifications.length} native notifications`);
  } catch (error) {
    console.error('Error scheduling native notifications:', error);
  }
}

// Main setup function
export function setupJournalReminder(enabled: boolean, frequency: NotificationFrequency, times: NotificationTime[]) {
  console.log('setupJournalReminder called:', { enabled, frequency, times });
  
  // Clear existing notifications
  clearScheduledNotifications();
  
  // Store settings in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('notification_enabled', enabled.toString());
    localStorage.setItem('notification_times', JSON.stringify(times));
  }
  
  if (!enabled || times.length === 0) {
    console.log('Notifications disabled or no times selected');
    return;
  }
  
  // Check if running natively first
  if (nativeIntegrationService.isRunningNatively()) {
    console.log('Setting up native notifications');
    scheduleNativeNotifications(times);
  } else {
    console.log('Setting up web notifications');
    // Request permission first for web
    requestNotificationPermission().then(granted => {
      if (!granted) {
        console.log('Notification permission not granted, cannot schedule notifications');
        return;
      }
      
      // Schedule notifications for each selected time
      times.forEach(time => {
        const notification = scheduleNotification(time);
        activeNotifications.push(notification);
      });
      
      console.log(`Scheduled ${activeNotifications.length} web notifications`);
    });
  }
}

// Initialize Capacitor notifications (for mobile) - Updated to avoid build-time import resolution
export function initializeCapacitorNotifications() {
  console.log('initializeCapacitorNotifications called');
  
  // Check if we're running in Capacitor
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    console.log('Detected Capacitor environment, attempting to load local notifications');
    
    // Use eval to prevent Vite from trying to resolve the import at build time
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    
    dynamicImport('@capacitor/local-notifications')
      .then((module: any) => {
        const { LocalNotifications } = module;
        console.log('Successfully loaded Capacitor LocalNotifications');
        
        // Request permissions
        LocalNotifications.requestPermissions().then((result: any) => {
          console.log('Capacitor notification permissions:', result);
          
          if (result.display === 'granted') {
            console.log('Capacitor notifications enabled');
          }
        });
      })
      .catch((error: any) => {
        console.log('Capacitor LocalNotifications not available (this is normal for web):', error.message);
      });
  } else {
    console.log('Not running in Capacitor environment, skipping mobile notifications setup');
  }
}

// Get current notification settings
export function getNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') {
    return { enabled: false, times: [] };
  }
  
  const enabled = localStorage.getItem('notification_enabled') === 'true';
  const timesStr = localStorage.getItem('notification_times');
  
  let times: NotificationTime[] = [];
  if (timesStr) {
    try {
      times = JSON.parse(timesStr);
    } catch (error) {
      console.error('Error parsing notification times:', error);
    }
  }
  
  return { enabled, times };
}

// Test notification (for debugging)
export function testNotification() {
  showNotification(
    'Test Notification 🧪',
    'This is a test notification to verify your settings are working correctly.',
    { tag: 'test-notification' }
  );
}

// Initialize notifications on module load
if (typeof window !== 'undefined') {
  // Restore notification settings on page load
  const settings = getNotificationSettings();
  if (settings.enabled && settings.times.length > 0) {
    // Small delay to ensure the page is fully loaded
    setTimeout(() => {
      setupJournalReminder(true, 'once', settings.times);
    }, 1000);
  }
}
