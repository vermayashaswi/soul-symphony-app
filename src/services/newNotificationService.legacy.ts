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

class NewNotificationService {
  private static instance: NewNotificationService;
  private isNative = false;
  private isInitialized = false;

  static getInstance(): NewNotificationService {
    if (!NewNotificationService.instance) {
      NewNotificationService.instance = new NewNotificationService();
    }
    return NewNotificationService.instance;
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    this.isNative = Capacitor.isNativePlatform();
    this.isInitialized = true;
    
    console.log('[NewNotificationService] Initialized. Native:', this.isNative);
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
        
        console.log('[NewNotificationService] Native permissions granted');
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

        console.log('[NewNotificationService] Web permissions granted');
        return { success: true };
      }
    } catch (error) {
      console.error('[NewNotificationService] Permission request failed:', error);
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

      const { error } = await supabase
        .from('profiles')
        .update({ reminder_settings: settings as any })
        .eq('id', user.id);

      if (error) {
        console.error('[NewNotificationService] Error saving settings:', error);
        return { success: false, error: error.message };
      }

      console.log('[NewNotificationService] Settings saved successfully');
      
      // Trigger notification scheduling
      await this.scheduleNotifications();
      
      return { success: true };
    } catch (error) {
      console.error('[NewNotificationService] Error saving reminder settings:', error);
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
        console.warn('[NewNotificationService] User not authenticated');
        return null;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('reminder_settings')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[NewNotificationService] Error fetching settings:', error);
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
      console.error('[NewNotificationService] Error getting reminder settings:', error);
      return null;
    }
  }

  private async scheduleNotifications() {
    try {
      // Call the notification scheduler edge function
      const { data, error } = await supabase.functions.invoke('notification-scheduler');
      
      if (error) {
        console.error('[NewNotificationService] Error calling scheduler:', error);
        return;
      }

      console.log('[NewNotificationService] Notifications scheduled:', data);
    } catch (error) {
      console.error('[NewNotificationService] Error scheduling notifications:', error);
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
        
        console.log('[NewNotificationService] Native test notification scheduled');
        return { success: true };
      } else {
        // Test web notification
        if (Notification.permission === 'granted') {
          new Notification('🧪 Test Notification', {
            body: 'Your journal reminders are working perfectly!',
            icon: '/favicon.ico'
          });
          
          console.log('[NewNotificationService] Web test notification shown');
          return { success: true };
        } else {
          return { success: false, error: 'Web notification permissions not granted' };
        }
      }
    } catch (error) {
      console.error('[NewNotificationService] Test notification failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Listen for notifications (for web notifications via service worker or real-time updates)
  startListening() {
    if (!this.isNative) {
      // Set up service worker message listener for web notifications
      navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'journal-reminder') {
          console.log('[NewNotificationService] Received notification event:', event.data);
          // Handle notification display
          this.showWebNotification(event.data.title, event.data.body);
        }
      });
      
      // Set up real-time subscription for notification queue
      this.subscribeToNotifications();
    }
  }

  private async subscribeToNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    // Subscribe to notification queue changes for this user
    const channel = supabase
      .channel('notification-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[NewNotificationService] New notification received:', payload);
          const notification = payload.new as any;
          
          if (notification.status === 'pending') {
            // Show the notification immediately if it's due
            const scheduledTime = new Date(notification.scheduled_for);
            const now = new Date();
            
            if (scheduledTime <= now) {
              this.showWebNotification(notification.title, notification.body);
            }
          }
        }
      )
      .subscribe();

    console.log('[NewNotificationService] Subscribed to notification updates');
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
      };
    }
  }
}

export const newNotificationService = NewNotificationService.getInstance();