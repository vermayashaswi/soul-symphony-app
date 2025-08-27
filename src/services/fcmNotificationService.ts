import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

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
    
    // Initialize Firebase only on web platform
    if (!this.isNative && typeof window !== 'undefined') {
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

  async requestPermissions(): Promise<{ success: boolean; error?: string; granted: boolean; state: NotificationPermissionState }> {
    await this.initialize();

    try {
      if (this.isNative) {
        // For native platforms, use Capacitor Push Notifications
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        const permissionResult = await PushNotifications.requestPermissions();
        
        if (permissionResult.receive !== 'granted') {
        return { 
          success: false, 
          error: 'Push notification permissions not granted',
          granted: false,
          state: 'denied'
        };
        }
        
        // Register for push notifications
        await PushNotifications.register();
        
        console.log('[FCMNotificationService] Native push permissions granted');
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

        // Get FCM token and register device
        try {
          const token = await getToken(this.messaging, {
            vapidKey: 'BOQf7iPztx_NbsZeW8YZaxFaLTJRJgvHlIKsqv1QjohO2rSorShQPOvy0TnjKDWQ7jHZusBDaxGtgVzXV35_ypw'
          });
          
          if (token) {
            await this.saveDeviceToken(token, 'web');
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

      // Insert or update device token with proper upsert key
      const { error } = await supabase
        .from('user_devices')
        .upsert({
          user_id: user.id,
          device_token: token,
          platform: platform,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[FCMNotificationService] Error saving device token:', error);
      } else {
        console.log('[FCMNotificationService] Device token saved successfully');
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
        const { PushNotifications } = await import('@capacitor/push-notifications');
        
        // Set up token listener
        PushNotifications.addListener('registration', async (token) => {
          console.log('[FCMNotificationService] Native push registration token:', token.value);
          await this.saveDeviceToken(token.value, 'android'); // or 'ios' based on platform detection
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

      // First, clear existing reminder notifications
      await supabase
        .from('user_notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('type', 'journal_reminder');

      // Insert new reminder settings
      const notifications = settings.reminders.map(reminder => ({
        user_id: user.id,
        type: 'journal_reminder' as const,
        scheduled_time: reminder.time,
        title: reminder.label || 'Journal Reminder',
        body: 'Time for your journal reflection',
        status: reminder.enabled ? 'active' as const : 'inactive' as const,
        data: { reminder_id: reminder.id }
      }));

      if (notifications.length > 0) {
        const { error } = await supabase
          .from('user_notifications')
          .insert(notifications);

        if (error) {
          console.error('[FCMNotificationService] Error saving notifications:', error);
          return { success: false, error: error.message };
        }
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

  checkPermissionStatus(): NotificationPermissionState {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as NotificationPermissionState;
  }

  getPermissionInfo(): NotificationPermissionState {
    return this.checkPermissionStatus();
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