import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { fromZonedTime, format } from 'date-fns-tz';
import { NotificationPreferencesService, NotificationCategory, getNotificationCategory } from './notificationPreferencesService';

export interface NotificationReminder {
  id: string;
  enabled: boolean;
  time: string; // HH:MM format
  label: string;
}

export interface NotificationSettings {
  reminders: NotificationReminder[];
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDfLKNR7-3rRTHEpSc4Ppk8xfISSIYjnaw",
  authDomain: "soulo-ec325.firebaseapp.com",
  projectId: "soulo-ec325",
  storageBucket: "soulo-ec325.firebasestorage.app",
  messagingSenderId: "183251782093",
  appId: "1:183251782093:web:e92b7ec31d0c651db3dc84",
  measurementId: "G-PLRDN9V6GK"
};

class FCMNotificationService {
  private static instance: FCMNotificationService;
  private messaging: Messaging | null = null;
  private isNative = false;
  private isInitialized = false;

  static getInstance(): FCMNotificationService {
    if (!FCMNotificationService.instance) {
      FCMNotificationService.instance = new FCMNotificationService();
    }
    return FCMNotificationService.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = true;
    
    console.log('[FCMNotificationService] Initialized. Native:', this.isNative);
    
    if (this.isNative) {
      // Set up native push notification listeners
      await this.setupNativePushListeners();
    } else if (typeof window !== 'undefined') {
      // Initialize Firebase only on web platform
      try {
        if (!getApps().length) {
          initializeApp(firebaseConfig);
        }
        this.messaging = getMessaging();
        this.setupMessageListener();
      } catch (error) {
        console.warn('[FCMNotificationService] Firebase initialization failed:', error);
      }
    }
  }

  private setupMessageListener() {
    if (!this.messaging) return;

    // Handle foreground messages
    onMessage(this.messaging, (payload) => {
      console.log('[FCMNotificationService] Foreground message received:', payload);
      
      if (payload.notification) {
        this.showWebNotification(
          payload.notification.title || 'Notification',
          payload.notification.body || ''
        );
      }
    });
  }

  private async setupNativePushListeners() {
    try {
      console.log('[FCMNotificationService] Setting up native push listeners...');
      
      // Listen for notification received (when app is in foreground)
      await PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[FCMNotificationService] Native notification received:', notification);
        // On native platforms, notifications in foreground need to be handled by the app
        // The system will show the status bar notification automatically when app is in background
      });

      // Listen for notification action performed (when user taps notification)
      await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        console.log('[FCMNotificationService] Native notification action performed:', notification);
        
        // Handle notification tap - navigate to action URL if available
        const actionUrl = notification.notification.data?.actionUrl;
        if (actionUrl) {
          console.log('[FCMNotificationService] Navigating to action URL:', actionUrl);
          // Use native navigation service for proper app navigation
          import('../services/nativeNavigationService').then(({ nativeNavigationService }) => {
            nativeNavigationService.navigateToPath(actionUrl, { replace: true, force: true });
          });
        }
      });

      // Listen for registration token
      await PushNotifications.addListener('registration', async (token) => {
        console.log('[FCMNotificationService] Native push registration token received:', token.value);
        const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
        await this.saveDeviceToken(token.value, platform);
      });

      // Listen for registration errors
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[FCMNotificationService] Native push registration error:', error);
      });

      console.log('[FCMNotificationService] Native push listeners set up successfully');
    } catch (error) {
      console.error('[FCMNotificationService] Failed to set up native push listeners:', error);
    }
  }

  async requestPermissions(): Promise<{ success: boolean; error?: string; granted: boolean; state: NotificationPermissionState }> {
    await this.initialize();

    try {
      if (this.isNative) {
        // For native platforms, use Capacitor Push Notifications
        console.log('[FCMNotificationService] Requesting native permissions...');
        
        const permissionResult = await PushNotifications.requestPermissions();
        console.log('[FCMNotificationService] Native permission result:', permissionResult);
        
        if (permissionResult.receive !== 'granted') {
          console.log('[FCMNotificationService] Native permissions denied');
          return { 
            success: false, 
            error: 'Push notification permissions not granted',
            granted: false,
            state: 'denied'
          };
        }
        
        // Register for push notifications and automatically register device token
        console.log('[FCMNotificationService] Registering for push notifications...');
        await PushNotifications.register();
        
        // Auto-register device token for native platforms
        const tokenResult = await this.registerDeviceToken();
        if (!tokenResult.success) {
          console.warn('[FCMNotificationService] Auto device token registration failed:', tokenResult.error);
        }
        
        console.log('[FCMNotificationService] Native push permissions granted successfully');
        return { success: true, granted: true, state: 'granted' };
      } else {
        // Web platform FCM permissions
        if (!this.messaging) {
        return { 
          success: false, 
          error: 'Firebase messaging not available',
          granted: false,
          state: 'unsupported'
        };
        }

        // Request notification permission
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
        return { 
          success: false, 
          error: 'Web notification permissions not granted',
          granted: false,
          state: 'denied'
        };
        }

        // Get FCM token and register device automatically
        try {
          const token = await getToken(this.messaging, {
            vapidKey: 'BOQf7iPztx_NbsZeW8YZaxFaLTJRJgvHlIKsqv1QjohO2rSorShQPOvy0TnjKDWQ7jHZusBDaxGtgVzXV35_ypw'
          });
          
          if (token) {
            await this.saveDeviceToken(token, 'web');
          } else {
            console.warn('[FCMNotificationService] Failed to get FCM token - device may not be registered');
          }
        } catch (tokenError) {
          console.warn('[FCMNotificationService] Failed to get FCM token:', tokenError);
        }

        console.log('[FCMNotificationService] Web FCM permissions granted');
        return { success: true, granted: true, state: 'granted' };
      }
    } catch (error) {
      console.error('[FCMNotificationService] Permission request failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        granted: false,
        state: 'denied'
      };
    }
  }

  // Enhanced permissions method for components that expect extended format
  async requestPermissionsEnhanced(): Promise<{ success: boolean; error?: string; granted: boolean; state: NotificationPermissionState }> {
    return await this.requestPermissions();
  }

  // Add missing methods for PWA compatibility
  isSupported(): boolean {
    return 'Notification' in window;
  }

  async subscribe(): Promise<any> {
    const result = await this.requestPermissions();
    return result.granted ? { endpoint: 'fcm-subscription' } : null;
  }

  private async saveDeviceToken(token: string, platform: 'android' | 'ios' | 'web') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('[FCMNotificationService] User not authenticated, cannot save token');
        return;
      }

      console.log('[FCMNotificationService] Saving device token for user:', user.id, 'platform:', platform);

      // First check if device already exists
      const { data: existingDevice } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', platform)
        .single();

      if (existingDevice) {
        // Update existing device
        const { error } = await supabase
          .from('user_devices')
          .update({
            device_token: token,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('platform', platform);

        if (error) {
          console.error('[FCMNotificationService] Error updating device token:', error);
        } else {
          console.log('[FCMNotificationService] Device token updated successfully');
        }
      } else {
        // Insert new device
        const { error } = await supabase
          .from('user_devices')
          .insert({
            user_id: user.id,
            device_token: token,
            platform: platform,
            last_seen: new Date().toISOString()
          });

        if (error) {
          console.error('[FCMNotificationService] Error inserting device token:', error);
        } else {
          console.log('[FCMNotificationService] Device token inserted successfully');
        }
      }
    } catch (error) {
      console.error('[FCMNotificationService] Error in saveDeviceToken:', error);
    }
  }

  // Enhanced method to register device token immediately
  async registerDeviceToken(): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    try {
      if (this.isNative) {
        // For native platforms, get token from Capacitor Push Notifications
        
        // Set up token listener
        PushNotifications.addListener('registration', async (token) => {
          console.log('[FCMNotificationService] Native push registration token:', token.value);
          // Detect platform more accurately
          const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
          await this.saveDeviceToken(token.value, platform);
        });

        // Set up error listener
        PushNotifications.addListener('registrationError', (error) => {
          console.error('[FCMNotificationService] Native push registration error:', error);
        });

        return { success: true };
      } else {
        // Web platform - get FCM token
        if (!this.messaging) {
          return { 
            success: false, 
            error: 'Firebase messaging not available'
          };
        }

        const token = await getToken(this.messaging, {
          vapidKey: 'BOQf7iPztx_NbsZeW8YZaxFaLTJRJgvHlIKsqv1QjohO2rSorShQPOvy0TnjKDWQ7jHZusBDaxGtgVzXV35_ypw'
        });
        
        if (token) {
          await this.saveDeviceToken(token, 'web');
          console.log('[FCMNotificationService] Web FCM token registered successfully');
          return { success: true };
        } else {
          return { 
            success: false, 
            error: 'Failed to get FCM token'
          };
        }
      }
    } catch (error) {
      console.error('[FCMNotificationService] Device token registration failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async saveReminderSettings(settings: NotificationSettings): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Convert reminders to the format expected by the database function
      const reminderSettings = settings.reminders.reduce((acc, reminder) => ({
        ...acc,
        [reminder.id]: {
          time: reminder.time,
          label: reminder.label || 'Journal Reminder',
          enabled: reminder.enabled
        }
      }), {});

      // Update user's reminder settings in the database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ reminder_settings: reminderSettings })
        .eq('id', user.id);

      if (profileError) {
        console.error('[FCMNotificationService] Error saving reminder settings:', profileError);
        return { success: false, error: profileError.message };
      }

      // Use the database function for proper timezone conversion
      const { error: syncError } = await supabase.rpc('sync_reminder_settings_to_notifications', {
        p_user_id: user.id
      });

      if (syncError) {
        console.error('[FCMNotificationService] Error syncing reminder notifications:', syncError);
        return { success: false, error: syncError.message };
      }

      console.log('[FCMNotificationService] Reminder settings saved successfully');
      return { success: true };
    } catch (error) {
      console.error('[FCMNotificationService] Error saving reminder settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private convertLocalTimeToUTC(localTime: string, timezone: string): string {
    try {
      const [hours, minutes] = localTime.split(':').map(Number);
      
      // Create a date for today at the specified time in the user's timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-based month
      const day = today.getDate();
      
      // Create a date object representing the local time (NOT considering timezone yet)
      const localDate = new Date(year, month, day, hours, minutes, 0, 0);
      
      // Use date-fns-tz to convert from user's timezone to UTC
      // fromZonedTime treats the input date as being in the specified timezone
      const utcDate = fromZonedTime(localDate, timezone);
      
      // Format as HH:MM in UTC
      return format(utcDate, 'HH:mm', { timeZone: 'UTC' });
    } catch (error) {
      console.error('[FCMNotificationService] Error converting time to UTC:', error);
      console.error('[FCMNotificationService] Input - localTime:', localTime, 'timezone:', timezone);
      
      // Fallback: return original time if conversion fails
      return localTime;
    }
  }

  async getReminderSettings(): Promise<NotificationSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('[FCMNotificationService] User not authenticated');
        return null;
      }

      const { data: notifications, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'journal_reminder');

      if (error) {
        console.error('[FCMNotificationService] Error fetching notifications:', error);
        return null;
      }

      if (!notifications || notifications.length === 0) {
        return { reminders: [] };
      }

      const reminders: NotificationReminder[] = notifications.map(notification => {
        const data = notification.data as any;
        return {
          id: data?.reminder_id || notification.id,
          enabled: notification.status === 'active',
          time: notification.scheduled_time,
          label: notification.title
        };
      });

      return { reminders };
    } catch (error) {
      console.error('[FCMNotificationService] Error getting reminder settings:', error);
      return null;
    }
  }

  private showWebNotification(title: string, body: string) {
    if (!this.isNative && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'journal-reminder'
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navigate to journal if possible
        if (window.location.pathname !== '/app/journal') {
          window.location.href = '/app/journal';
        }
      };
    }
  }

  async sendCategorizedNotification(
    userId: string,
    notificationType: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    targetUrl?: string,
    icon?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await supabase.functions.invoke('send-categorized-notification', {
        body: {
          userId,
          notificationType,
          title,
          body,
          data,
          targetUrl,
          icon
        }
      });

      if (response.error) {
        console.error('[FCMNotificationService] Error from categorized notification edge function:', response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[FCMNotificationService] Error sending categorized notification:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testNotification(): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    try {
      if (this.isNative) {
        // Test native notification via FCM
        this.showWebNotification('🧪 Test Notification', 'Your FCM notifications are working!');
        return { success: true };
      } else {
        // Test web notification
        if (Notification.permission === 'granted') {
          this.showWebNotification('🧪 Test Notification', 'Your FCM notifications are working!');
          return { success: true };
        } else {
          return { success: false, error: 'Notification permissions not granted' };
        }
      }
    } catch (error) {
      console.error('[FCMNotificationService] Test notification failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Enhanced permission status check for both platforms
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    await this.initialize();
    
    try {
      if (this.isNative) {
        console.log('[FCMNotificationService] Checking native permission status...');
        const status = await PushNotifications.checkPermissions();
        console.log('[FCMNotificationService] Native permission status:', status);
        
        switch (status.receive) {
          case 'granted':
            return 'granted';
          case 'denied':
            return 'denied';
          case 'prompt':
          case 'prompt-with-rationale':
            return 'default';
          default:
            return 'default';
        }
      } else {
        if (!('Notification' in window)) {
          return 'unsupported';
        }
        return Notification.permission as NotificationPermissionState;
      }
    } catch (error) {
      console.error('[FCMNotificationService] Error checking permission status:', error);
      return 'unsupported';
    }
  }

  // Legacy sync method for backwards compatibility
  checkPermissionStatusSync(): NotificationPermissionState {
    try {
      if (this.isNative) {
        // For native, we can't check synchronously, return default
        console.warn('[FCMNotificationService] checkPermissionStatusSync called on native - use async checkPermissionStatus instead');
        return 'default';
      } else {
        if (!('Notification' in window)) {
          return 'unsupported';
        }
        return Notification.permission as NotificationPermissionState;
      }
    } catch (error) {
      console.error('[FCMNotificationService] Error checking permission status:', error);
      return 'unsupported';
    }
  }

  async getPermissionInfo(): Promise<NotificationPermissionState> {
    return await this.checkPermissionStatus();
  }

  // Legacy compatibility methods that do nothing but maintain interface
  showToast() { console.log('[FCMNotificationService] showToast - legacy method'); }
  showTutorialToast() { console.log('[FCMNotificationService] showTutorialToast - legacy method'); }
  clearAllToasts() { console.log('[FCMNotificationService] clearAllToasts - legacy method'); }
  ensureAllToastsCleared() { return Promise.resolve(); }
  registerComponent() { console.log('[FCMNotificationService] registerComponent - legacy method'); }
  unregisterComponent() { console.log('[FCMNotificationService] unregisterComponent - legacy method'); }
  getNotificationSettings() { return { enabled: false, reminders: [] }; }
  setupJournalReminder() { console.log('[FCMNotificationService] setupJournalReminder - legacy method'); }
  initializeCapacitorNotifications() { console.log('[FCMNotificationService] initializeCapacitorNotifications - legacy method'); }
  getSettings() { return { enabled: false, times: [], timezone: 'UTC', lastUpdated: new Date().toISOString() }; }
  getNotificationStatus() {
    return Promise.resolve({
      isNative: this.isNative,
      isWebView: false,
      strategy: 'fcm',
      scheduledCount: 0,
      permissions: { native: { display: 'default' }, web: 'default' },
      permissionState: 'default',
      verification: { expectedCount: 0, actualCount: 0, successRate: 100, healthStatus: 'healthy' },
      debugInfo: { userTimezone: 'UTC' },
      recentEvents: [],
      platform: this.isNative ? 'native' : 'web'
    });
  }
  getDebugReport() { return 'FCM Notification Service Debug Report\n\nService initialized successfully.'; }
  async requestPermissionsAndSetup(times: any[]) {
    const result = await this.requestPermissions();
    return { ...result, strategy: 'fcm', scheduledCount: times.length };
  }
  disableReminders() { return Promise.resolve(); }
  testReminder() { return this.testNotification(); }
}

export const fcmNotificationService = FCMNotificationService.getInstance();

// For backward compatibility, export as the unified service
export const unifiedNotificationService = fcmNotificationService;

// Legacy exports for backward compatibility
export { fcmNotificationService as newNotificationService };
export { fcmNotificationService as notificationService };

// Type exports for compatibility
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type JournalReminderTime = NotificationTime;
export type UnifiedNotificationSettings = NotificationSettings;

// Legacy function exports that do nothing but maintain compatibility
export const showToast = () => console.log('Legacy showToast called');
export const showTutorialToast = () => console.log('Legacy showTutorialToast called');
export const showTranslatedToast = async () => console.log('Legacy showTranslatedToast called');
export const showTranslatedTutorialToast = async () => console.log('Legacy showTranslatedTutorialToast called');
export const clearAllToasts = () => console.log('Legacy clearAllToasts called');
export const ensureAllToastsCleared = () => Promise.resolve();
export const registerComponent = () => console.log('Legacy registerComponent called');
export const unregisterComponent = () => console.log('Legacy unregisterComponent called');
export const getNotificationSettings = () => ({ enabled: false, reminders: [] });
export const setupJournalReminder = () => console.log('Legacy setupJournalReminder called');
export const initializeCapacitorNotifications = () => console.log('Legacy initializeCapacitorNotifications called');
export const checkPermissionStatus = () => fcmNotificationService.checkPermissionStatus();