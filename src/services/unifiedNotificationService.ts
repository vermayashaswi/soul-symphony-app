import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { notificationFallbackService } from './notificationFallbackService';

interface NotificationReminder {
  id: string;
  enabled: boolean;
  time: string;
  label: string;
}

interface NotificationSettings {
  reminders: NotificationReminder[];
}

export interface UnifiedNotificationSettings {
  reminders: NotificationReminder[];
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationResult {
  success: boolean;
  message: string;
  permissionGranted?: boolean;
  strategy?: 'native' | 'web' | 'hybrid';
}

class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private isNative: boolean;
  private isWebView: boolean;
  private permissionCache: NotificationPermissionState | null = null;
  private realtimeChannel: any = null;
  private fallbackPollingActive = false;
  private connectionHealthy = false;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isWebView = this.isNative; // WebView detection simplified
    console.log('[UnifiedNotificationService] Initialized', { 
      isNative: this.isNative, 
      isWebView: this.isWebView,
      platform: Capacitor.getPlatform(),
      userAgent: navigator.userAgent
    });
  }

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  // Unified permission checking with proper caching
  async checkPermissionStatus(): Promise<NotificationPermissionState> {
    try {
      if (this.isNative) {
        const status = await LocalNotifications.checkPermissions();
        console.log('[UnifiedNotificationService] Native permission status:', status);
        
        if (status.display === 'granted') {
          this.permissionCache = 'granted';
        } else if (status.display === 'denied') {
          this.permissionCache = 'denied';
        } else {
          this.permissionCache = 'default';
        }
      } else {
        if (!('Notification' in window)) {
          this.permissionCache = 'unsupported';
        } else {
          this.permissionCache = Notification.permission as NotificationPermissionState;
        }
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Error checking permissions:', error);
      this.permissionCache = 'unsupported';
    }

    return this.permissionCache;
  }

  // Enhanced permission requesting with Android-specific handling
  async requestPermissions(): Promise<NotificationResult> {
    try {
      console.log('[UnifiedNotificationService] Requesting permissions, platform:', Capacitor.getPlatform());
      
      if (this.isNative) {
        // For Android, explicitly check and request LocalNotifications permissions
        const currentStatus = await LocalNotifications.checkPermissions();
        console.log('[UnifiedNotificationService] Current native permissions:', currentStatus);
        
        if (currentStatus.display === 'granted') {
          this.permissionCache = 'granted';
          await this.setupAndroidNotificationChannels();
          return { 
            success: true, 
            message: 'Native permissions already granted',
            permissionGranted: true,
            strategy: 'native'
          };
        }

        // Request permissions - this WILL show Android permission popup
        console.log('[UnifiedNotificationService] Requesting native permissions...');
        const requestResult = await LocalNotifications.requestPermissions();
        console.log('[UnifiedNotificationService] Native permission request result:', requestResult);
        
        const granted = requestResult.display === 'granted';
        this.permissionCache = granted ? 'granted' : 'denied';
        
        if (granted) {
          await this.setupAndroidNotificationChannels();
        }
        
        return {
          success: granted,
          message: granted ? 'Native permissions granted successfully' : 'Native permissions denied by user',
          permissionGranted: granted,
          strategy: 'native'
        };
      } else {
        // Web browser notification handling
        if (!('Notification' in window)) {
          return {
            success: false,
            message: 'Notifications not supported in this browser',
            permissionGranted: false,
            strategy: 'web'
          };
        }

        const permission = await Notification.requestPermission();
        this.permissionCache = permission as NotificationPermissionState;
        
        const granted = permission === 'granted';
        return {
          success: granted,
          message: granted ? 'Web permissions granted' : 'Web permissions denied',
          permissionGranted: granted,
          strategy: 'web'
        };
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Error requesting permissions:', error);
      this.permissionCache = 'denied';
      return {
        success: false,
        message: `Permission request failed: ${error}`,
        permissionGranted: false,
        strategy: this.isNative ? 'native' : 'web'
      };
    }
  }

  // Setup Android notification channels for proper categorization
  private async setupAndroidNotificationChannels(): Promise<void> {
    if (!this.isNative || Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      console.log('[UnifiedNotificationService] Setting up Android notification channels');
      
      // Create notification channel for journal reminders
      await LocalNotifications.createChannel({
        id: 'journal_reminders',
        name: 'Journal Reminders',
        description: 'Daily journal reminder notifications',
        importance: 4, // High importance
        visibility: 1, // Public visibility
        sound: 'default.wav',
        vibration: true,
        lights: true,
        lightColor: '#FFA500'
      });

      console.log('[UnifiedNotificationService] Android notification channels configured');
    } catch (error) {
      console.error('[UnifiedNotificationService] Error setting up Android channels:', error);
    }
  }

  // Save reminder settings and trigger backend scheduling
  async saveReminderSettings(settings: NotificationSettings): Promise<NotificationResult> {
    try {
      console.log('[UnifiedNotificationService] Saving reminder settings:', settings);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          message: 'User not authenticated'
        };
      }

      // Update user profile with new settings
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ reminder_settings: settings as any })
        .eq('id', user.id);

      if (updateError) {
        console.error('[UnifiedNotificationService] Error updating profile:', updateError);
        return {
          success: false,
          message: `Failed to save settings: ${updateError.message}`
        };
      }

      // Schedule notifications via edge function
      const { error: scheduleError } = await supabase.functions.invoke('notification-scheduler');
      
      if (scheduleError) {
        console.error('[UnifiedNotificationService] Error scheduling notifications:', scheduleError);
        return {
          success: false,
          message: `Failed to schedule notifications: ${scheduleError.message}`
        };
      }

      console.log('[UnifiedNotificationService] Settings saved and notifications scheduled successfully');
      return {
        success: true,
        message: 'Reminder settings saved and notifications scheduled'
      };

    } catch (error) {
      console.error('[UnifiedNotificationService] Error in saveReminderSettings:', error);
      return {
        success: false,
        message: `Unexpected error: ${error}`
      };
    }
  }

  // Get reminder settings with proper format handling
  async getReminderSettings(): Promise<NotificationSettings> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { reminders: [] };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('reminder_settings')
        .eq('id', user.id)
        .single();

      if (profile?.reminder_settings) {
        // Handle both old and new formats
        const settings = profile.reminder_settings as any;
        if (settings && typeof settings === 'object' && settings.reminders) {
          return settings as NotificationSettings;
        } else {
          // Convert old format to new format if needed
          return { reminders: [] };
        }
      }

      return { reminders: [] };
    } catch (error) {
      console.error('[UnifiedNotificationService] Error getting reminder settings:', error);
      return { reminders: [] };
    }
  }

  // Start listening for real-time notification delivery (async version)
  private async startRealtimeListener(): Promise<void> {
    if (this.realtimeChannel) {
      console.log('[UnifiedNotificationService] Real-time listener already active');
      return;
    }

    try {
      console.log('[UnifiedNotificationService] Starting real-time listener for notifications');
      
      // Add timeout for WebSocket connection in problematic environments
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Real-time connection timeout')), 10000);
      });

      const connectionPromise = new Promise<void>((resolve, reject) => {
        this.realtimeChannel = supabase
          .channel('unified-notification-delivery')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notification_queue',
              filter: 'status=eq.sent'
            },
            (payload) => {
              console.log('[UnifiedNotificationService] Real-time notification delivery:', payload);
              this.handleRealtimeNotification(payload.new);
            }
          )
          .subscribe((status) => {
            console.log('[UnifiedNotificationService] Real-time subscription status:', status);
            if (status === 'SUBSCRIBED') {
              resolve();
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              reject(new Error(`Real-time connection failed: ${status}`));
            }
          });
      });

      // Race between connection and timeout
      await Promise.race([connectionPromise, timeoutPromise]);
        
      console.log('[UnifiedNotificationService] Real-time listener started successfully');
    } catch (error) {
      console.error('[UnifiedNotificationService] Failed to start real-time listener:', error);
      this.realtimeChannel = null;
      
      // Check if we're in a problematic environment
      const isAndroidWebView = navigator.userAgent.includes('Android') && 
                              (window.location.href.includes('capacitor://') || 
                               (window as any).Capacitor?.isNative);
      
      if (isAndroidWebView) {
        console.log('[UnifiedNotificationService] Android WebView detected, will retry real-time connection later');
        // Don't throw error for Android WebView, let app continue
        return;
      }
      
      throw error;
    }
  }

  // Stop real-time listener
  stopRealtimeListener(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
      console.log('[UnifiedNotificationService] Stopped real-time notification listener');
    }
  }

  // Handle real-time notification with proper user verification
  private async handleRealtimeNotification(notification: any): Promise<void> {
    console.log('[UnifiedNotificationService] Handling real-time notification:', notification);

    try {
      // Check if notification is for current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || notification.user_id !== user.id) {
        return;
      }

      // Display notification immediately using best available method
      if (this.isNative) {
        await this.showNativeNotification(notification.title, notification.body);
      } else {
        await this.showWebNotification(notification.title, notification.body);
      }

    } catch (error) {
      console.error('[UnifiedNotificationService] Error handling real-time notification:', error);
    }
  }

  // Show native notification with Android-optimized configuration
  private async showNativeNotification(title: string, body: string): Promise<void> {
    try {
      const options: ScheduleOptions = {
        notifications: [{
          id: Date.now(),
          title,
          body,
          schedule: { at: new Date() },
          sound: 'default',
          smallIcon: 'ic_notification',
          iconColor: '#FFA500',
          channelId: 'journal_reminders', // Use our custom channel
          extra: {
            timestamp: Date.now(),
            type: 'journal_reminder'
          }
        }]
      };

      await LocalNotifications.schedule(options);
      console.log('[UnifiedNotificationService] Native notification scheduled with channel');
    } catch (error) {
      console.error('[UnifiedNotificationService] Error showing native notification:', error);
    }
  }

  // Show web notification with proper fallbacks
  private async showWebNotification(title: string, body: string): Promise<void> {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'journal-reminder',
          requireInteraction: false,
          data: {
            timestamp: Date.now(),
            type: 'journal_reminder'
          }
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Handle click to navigate to journal
        notification.onclick = () => {
          window.focus();
          notification.close();
          if (window.location.pathname !== '/app/journal') {
            window.location.href = '/app/journal';
          }
        };

        console.log('[UnifiedNotificationService] Web notification displayed');
      }
    } catch (error) {
      console.error('[UnifiedNotificationService] Error showing web notification:', error);
    }
  }

  // Test notification with appropriate strategy
  async testNotification(): Promise<NotificationResult> {
    const title = 'Test Journal Reminder 📝';
    const body = 'This is a test notification from your journal app!';

    try {
      if (this.isNative) {
        await this.showNativeNotification(title, body);
        return {
          success: true,
          message: 'Native test notification sent',
          strategy: 'native'
        };
      } else {
        await this.showWebNotification(title, body);
        return {
          success: true,
          message: 'Web test notification sent',
          strategy: 'web'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Test notification failed: ${error}`,
        strategy: this.isNative ? 'native' : 'web'
      };
    }
  }

  // Clear permission cache to force refresh
  clearPermissionCache(): void {
    this.permissionCache = null;
  }

  // Get comprehensive debug information
  getDebugInfo(): any {
    return {
      isNative: this.isNative,
      isWebView: this.isWebView,
      platform: Capacitor.getPlatform(),
      permissionCache: this.permissionCache,
      realtimeActive: !!this.realtimeChannel,
      webNotificationSupport: 'Notification' in window,
      webPermission: 'Notification' in window ? Notification.permission : 'unsupported',
      capacitorVersion: (window as any).Capacitor?.version || 'unknown'
    };
  }

  // Initialize service with auto-start features
  async initialize(): Promise<void> {
    console.log('[UnifiedNotificationService] Starting non-blocking initialization');
    
    try {
      // Check initial permission status (non-blocking)
      await this.checkPermissionStatus();
      
      // Start real-time listener in background (non-blocking)
      this.startRealtimeListenerBackground();
      
      console.log('[UnifiedNotificationService] Non-blocking initialization completed');
    } catch (error) {
      console.error('[UnifiedNotificationService] Initialization failed:', error);
      // Don't throw error to prevent blocking app startup
    }
  }

  private startRealtimeListenerBackground(): void {
    // Start real-time listener asynchronously without blocking
    setTimeout(async () => {
      try {
        console.log('[UnifiedNotificationService] Starting background real-time listener');
        await this.startRealtimeListener();
        console.log('[UnifiedNotificationService] Background real-time listener started successfully');
      } catch (error) {
        console.error('[UnifiedNotificationService] Background real-time listener failed:', error);
        // Retry after delay
        setTimeout(() => this.startRealtimeListenerBackground(), 5000);
      }
    }, 1000); // Delay to ensure app is fully loaded
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    this.stopRealtimeListener();
    this.clearPermissionCache();
    console.log('[UnifiedNotificationService] Service cleaned up');
  }

  // Legacy method compatibility
  async requestPermissionsAndSetup(times: any): Promise<NotificationResult> {
    const permissionResult = await this.requestPermissions();
    if (permissionResult.success) {
      const settings: NotificationSettings = {
        reminders: times.map((time: any, index: number) => ({
          id: `${index}`,
          enabled: true,
          time: time,
          label: `Reminder ${index + 1}`
        }))
      };
      return await this.saveReminderSettings(settings);
    }
    return permissionResult;
  }

  // Legacy method compatibility
  async disableReminders(): Promise<void> {
    const settings: NotificationSettings = { reminders: [] };
    await this.saveReminderSettings(settings);
  }

  // Legacy method compatibility
  getSettings(): Promise<NotificationSettings> {
    return this.getReminderSettings();
  }

  // Legacy method compatibility
  async getNotificationStatus(): Promise<any> {
    const settings = await this.getReminderSettings();
    const permission = await this.checkPermissionStatus();
    return {
      settings,
      permission,
      debugInfo: this.getDebugInfo()
    };
  }

  // Start fallback polling when real-time fails
  private startFallbackPolling(): void {
    if (this.fallbackPollingActive) {
      return;
    }
    
    console.log('[UnifiedNotificationService] Starting fallback polling mode');
    this.fallbackPollingActive = true;
    this.connectionHealthy = false;
    
    // Use the fallback service
    notificationFallbackService.startPolling().catch(error => {
      console.error('[UnifiedNotificationService] Fallback polling failed to start:', error);
    });
  }

  // Stop fallback polling when real-time is restored
  private stopFallbackPolling(): void {
    if (!this.fallbackPollingActive) {
      return;
    }
    
    console.log('[UnifiedNotificationService] Stopping fallback polling mode');
    this.fallbackPollingActive = false;
    this.connectionHealthy = true;
    
    notificationFallbackService.stopPolling();
  }

  // Get connection health status
  getConnectionHealth(): { healthy: boolean; fallbackActive: boolean; strategy: string } {
    return {
      healthy: this.connectionHealthy,
      fallbackActive: this.fallbackPollingActive,
      strategy: this.connectionHealthy ? 'realtime' : (this.fallbackPollingActive ? 'polling' : 'none')
    };
  }

  // Legacy method compatibility
  getDebugReport(): string {
    const debugInfo = this.getDebugInfo();
    const connectionHealth = this.getConnectionHealth();
    const fallbackStatus = notificationFallbackService.getStatus();
    
    return JSON.stringify({
      ...debugInfo,
      connectionHealth,
      fallbackStatus
    }, null, 2);
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();