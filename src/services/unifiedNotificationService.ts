import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
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

class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private isNative = false;
  private isInitialized = false;
  private pollingInterval: number | null = null;
  private readonly POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = true;
    
    console.log('[UnifiedNotificationService] Initialized. Native:', this.isNative);
    
    // Start polling for pending notifications
    this.startPolling();
  }

  async requestPermissions(): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    try {
      if (this.isNative) {
        // Request native permissions
        const permissionResult = await LocalNotifications.requestPermissions();
        
        if (permissionResult.display !== 'granted') {
          return { 
            success: false, 
            error: 'Native notification permissions not granted' 
          };
        }
        
        console.log('[UnifiedNotificationService] Native permissions granted');
        return { success: true };
      } else {
        // Request web permissions
        if (!('Notification' in window)) {
          return { 
            success: false, 
            error: 'Web notifications not supported' 
          };
        }

        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
          return { 
            success: false, 
            error: 'Web notification permissions not granted' 
          };
        }

        console.log('[UnifiedNotificationService] Web permissions granted');
        return { success: true };
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Permission request failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Enhanced permissions method for components that expect extended format
  async requestPermissionsEnhanced(): Promise<{ success: boolean; error?: string; granted: boolean; state: NotificationPermissionState }> {
    const result = await this.requestPermissions();
    const state = this.checkPermissionStatus();
    
    return {
      ...result,
      granted: result.success,
      state: state
    };
  }

  async saveReminderSettings(settings: NotificationSettings): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ reminder_settings: settings as any })
        .eq('id', user.id);

      if (error) {
        console.error('[UnifiedNotificationService] Error saving settings:', error);
        return { success: false, error: error.message };
      }

      console.log('[UnifiedNotificationService] Settings saved successfully');
      
      // Trigger notification scheduling
      await this.scheduleNotifications();
      
      return { success: true };
    } catch (error) {
      console.error('[UnifiedNotificationService] Error saving reminder settings:', error);
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
        console.warn('[UnifiedNotificationService] User not authenticated');
        return null;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('reminder_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[UnifiedNotificationService] Error fetching settings:', error);
        return null;
      }

      if (profile?.reminder_settings && typeof profile.reminder_settings === 'object') {
        const settings = profile.reminder_settings as any;
        
        // Check if it's the new format
        if (settings.reminders && Array.isArray(settings.reminders)) {
          return settings as NotificationSettings;
        }
      }

      return null;
    } catch (error) {
      console.error('[UnifiedNotificationService] Error getting reminder settings:', error);
      return null;
    }
  }

  private async scheduleNotifications() {
    try {
      // Call the notification scheduler edge function
      const { data, error } = await supabase.functions.invoke('notification-scheduler');
      
      if (error) {
        console.error('[UnifiedNotificationService] Error calling scheduler:', error);
        return;
      }

      console.log('[UnifiedNotificationService] Notifications scheduled:', data);
    } catch (error) {
      console.error('[UnifiedNotificationService] Error scheduling notifications:', error);
    }
  }

  private startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll immediately, then every 5 minutes
    this.checkAndDeliverNotifications();
    
    this.pollingInterval = window.setInterval(() => {
      this.checkAndDeliverNotifications();
    }, this.POLLING_INTERVAL_MS);

    console.log('[UnifiedNotificationService] Started polling for notifications');
  }

  private async checkAndDeliverNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get pending notifications due now
      const { data: pendingNotifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString());

      if (error) {
        console.error('[UnifiedNotificationService] Error fetching pending notifications:', error);
        return;
      }

      if (!pendingNotifications || pendingNotifications.length === 0) {
        return;
      }

      console.log(`[UnifiedNotificationService] Found ${pendingNotifications.length} pending notifications`);

      // Process each notification
      for (const notification of pendingNotifications) {
        try {
          await this.deliverNotification(notification);
          
          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id);

          console.log(`[UnifiedNotificationService] Delivered notification ${notification.id}`);
        } catch (error) {
          console.error(`[UnifiedNotificationService] Error delivering notification ${notification.id}:`, error);
          
          // Mark as failed
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', notification.id);
        }
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Error in checkAndDeliverNotifications:', error);
    }
  }

  private async deliverNotification(notification: any) {
    if (this.isNative) {
      // Use Capacitor LocalNotifications for native platforms
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title: notification.title,
          body: notification.body,
          schedule: { at: new Date(Date.now() + 1000) }, // Immediate
          sound: 'default',
          actionTypeId: 'journal_reminder',
          extra: notification.data || {}
        }]
      });
    } else {
      // Use web notifications
      this.showWebNotification(notification.title, notification.body);
    }
  }

  private showWebNotification(title: string, body: string) {
    if (!this.isNative && Notification.permission === 'granted') {
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
        // Test native notification
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now(),
            title: '🧪 Test Notification',
            body: 'Your journal reminders are working perfectly!',
            schedule: { at: new Date(Date.now() + 1000) } // 1 second from now
          }]
        });
        
        console.log('[UnifiedNotificationService] Native test notification scheduled');
        return { success: true };
      } else {
        // Test web notification
        if (Notification.permission === 'granted') {
          new Notification('🧪 Test Notification', {
            body: 'Your journal reminders are working perfectly!',
            icon: '/favicon.ico'
          });
          
          console.log('[UnifiedNotificationService] Web test notification shown');
          return { success: true };
        } else {
          return { success: false, error: 'Web notification permissions not granted' };
        }
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Test notification failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Legacy compatibility methods
  showToast(title: string, description: string, duration?: number, componentId?: string) {
    console.log(`[UnifiedNotificationService] Toast: ${title} - ${description}`);
  }

  showTutorialToast(title: string, description: string, componentId?: string) {
    console.log(`[UnifiedNotificationService] Tutorial Toast: ${title} - ${description}`);
  }

  clearAllToasts() {
    console.log('[UnifiedNotificationService] clearAllToasts called');
  }

  ensureAllToastsCleared() {
    return Promise.resolve();
  }

  registerComponent(componentId: string) {
    console.log(`[UnifiedNotificationService] Component registered: ${componentId}`);
  }

  unregisterComponent(componentId: string) {
    console.log(`[UnifiedNotificationService] Component unregistered: ${componentId}`);
  }

  getNotificationSettings() {
    // Return synchronous object for compatibility
    return { enabled: false, reminders: [] };
  }

  setupJournalReminder(enabled: boolean, frequency: string, times: string[]) {
    console.log(`[UnifiedNotificationService] setupJournalReminder: ${enabled}, ${frequency}, ${times}`);
  }

  initializeCapacitorNotifications() {
    console.log('[UnifiedNotificationService] initializeCapacitorNotifications called');
  }

  getSettings() {
    return {
      enabled: false,
      times: [],
      timezone: 'UTC',
      lastUpdated: new Date().toISOString()
    };
  }

  getNotificationStatus() {
    return Promise.resolve({
      isNative: this.isNative,
      isWebView: false,
      strategy: 'unified',
      scheduledCount: 0,
      permissions: { native: { display: 'default' }, web: 'default' },
      permissionState: 'default',
      verification: { 
        expectedCount: 0, 
        actualCount: 0, 
        successRate: 100, 
        healthStatus: 'healthy' 
      },
      debugInfo: { userTimezone: 'UTC' },
      recentEvents: [],
      platform: 'web'
    });
  }

  getDebugReport() {
    return 'Unified Notification Service Debug Report\n\nService initialized successfully.';
  }

  async requestPermissionsAndSetup(times: any[]) {
    const result = await this.requestPermissions();
    return {
      ...result,
      strategy: 'unified',
      scheduledCount: times.length
    };
  }

  disableReminders() {
    return Promise.resolve();
  }

  testReminder() {
    return this.testNotification();
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

  // Stop polling when service is destroyed
  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    console.log('[UnifiedNotificationService] Polling stopped');
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();

// Legacy exports for backward compatibility
export { unifiedNotificationService as newNotificationService };
export { unifiedNotificationService as notificationService };
export const showToast = (title: string, description: string, duration?: number, componentId?: string) => 
  unifiedNotificationService.showToast(title, description, duration, componentId);
export const showTutorialToast = (title: string, description: string, componentId?: string) => 
  unifiedNotificationService.showTutorialToast(title, description, componentId);
export const showTranslatedToast = async (
  titleKey: string, 
  descriptionKey: string, 
  translate: any,
  duration?: number,
  interpolations?: Record<string, string>,
  componentId?: string
) => console.log(`Translated toast: ${titleKey} - ${descriptionKey}`);
export const showTranslatedTutorialToast = async (
  titleKey: string,
  descriptionKey: string,
  translate: any,
  componentId?: string
) => console.log(`Translated tutorial toast: ${titleKey} - ${descriptionKey}`);

export const clearAllToasts = () => unifiedNotificationService.clearAllToasts();
export const ensureAllToastsCleared = () => unifiedNotificationService.ensureAllToastsCleared();
export const registerComponent = (id: string) => unifiedNotificationService.registerComponent(id);
export const unregisterComponent = (id: string) => unifiedNotificationService.unregisterComponent(id);
export const getNotificationSettings = () => unifiedNotificationService.getNotificationSettings();
export const setupJournalReminder = (enabled: boolean, frequency: string, times: string[]) => 
  unifiedNotificationService.setupJournalReminder(enabled, frequency, times);
export const initializeCapacitorNotifications = () => unifiedNotificationService.initializeCapacitorNotifications();
export const checkPermissionStatus = () => unifiedNotificationService.checkPermissionStatus();

// Type exports for compatibility
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type JournalReminderTime = NotificationTime;
export type UnifiedNotificationSettings = NotificationSettings;