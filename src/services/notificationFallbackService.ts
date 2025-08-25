import { supabase } from '@/integrations/supabase/client';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface NotificationQueueItem {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed';
  data?: any;
}

/**
 * Fallback notification service for when real-time WebSocket connections fail
 * Uses polling and native notifications as alternatives
 */
class NotificationFallbackService {
  private static instance: NotificationFallbackService;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private readonly POLL_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private isNative: boolean;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    console.log('[NotificationFallbackService] Initialized for platform:', Capacitor.getPlatform());
  }

  static getInstance(): NotificationFallbackService {
    if (!NotificationFallbackService.instance) {
      NotificationFallbackService.instance = new NotificationFallbackService();
    }
    return NotificationFallbackService.instance;
  }

  /**
   * Start polling for pending notifications when real-time fails
   */
  async startPolling(): Promise<void> {
    if (this.isPolling) {
      console.log('[NotificationFallbackService] Polling already active');
      return;
    }

    console.log('[NotificationFallbackService] Starting notification polling fallback');
    this.isPolling = true;

    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkAndDeliverPendingNotifications();
      } catch (error) {
        console.error('[NotificationFallbackService] Polling error:', error);
      }
    }, this.POLL_INTERVAL);

    // Do immediate check
    await this.checkAndDeliverPendingNotifications();
  }

  /**
   * Stop polling for notifications
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('[NotificationFallbackService] Stopped polling');
  }

  /**
   * Check for pending notifications and deliver them
   */
  private async checkAndDeliverPendingNotifications(): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) {
        console.log('[NotificationFallbackService] No authenticated user for polling');
        return;
      }

      // Query for pending notifications for the current user
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', user.user.id)
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(5);

      if (error) {
        console.error('[NotificationFallbackService] Error fetching notifications:', error);
        return;
      }

      if (!notifications || notifications.length === 0) {
        console.log('[NotificationFallbackService] No pending notifications found');
        return;
      }

      console.log(`[NotificationFallbackService] Found ${notifications.length} pending notifications`);

      // Process each notification
      for (const notification of notifications) {
        await this.deliverNotification(notification as any);
      }
    } catch (error) {
      console.error('[NotificationFallbackService] Error in polling check:', error);
    }
  }

  /**
   * Deliver a notification using the best available method
   */
  private async deliverNotification(notification: NotificationQueueItem): Promise<void> {
    let delivered = false;
    let retryCount = 0;

    while (!delivered && retryCount < this.MAX_RETRIES) {
      try {
        if (this.isNative) {
          // Try native notification first
          delivered = await this.deliverNativeNotification(notification);
        } else {
          // Try web notification
          delivered = await this.deliverWebNotification(notification);
        }

        if (delivered) {
          // Mark as sent in database
          await this.markNotificationAsSent(notification.id);
          console.log(`[NotificationFallbackService] Successfully delivered notification ${notification.id}`);
        } else {
          retryCount++;
          console.warn(`[NotificationFallbackService] Failed to deliver notification ${notification.id}, retry ${retryCount}`);
        }
      } catch (error) {
        console.error(`[NotificationFallbackService] Error delivering notification ${notification.id}:`, error);
        retryCount++;
      }
    }

    if (!delivered) {
      // Mark as failed after max retries
      await this.markNotificationAsFailed(notification.id);
      console.error(`[NotificationFallbackService] Failed to deliver notification ${notification.id} after ${this.MAX_RETRIES} retries`);
    }
  }

  /**
   * Deliver notification using native Capacitor LocalNotifications
   */
  private async deliverNativeNotification(notification: NotificationQueueItem): Promise<boolean> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title: notification.title,
          body: notification.body,
          id: parseInt(notification.id) || Math.floor(Math.random() * 1000000),
          schedule: { at: new Date() }, // Immediate delivery
          extra: notification.data || {}
        }]
      });
      return true;
    } catch (error) {
      console.error('[NotificationFallbackService] Native notification failed:', error);
      return false;
    }
  }

  /**
   * Deliver notification using web Notification API
   */
  private async deliverWebNotification(notification: NotificationQueueItem): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('[NotificationFallbackService] Web notifications not supported');
        return false;
      }

      if (Notification.permission !== 'granted') {
        console.warn('[NotificationFallbackService] Web notification permission not granted');
        return false;
      }

      const webNotification = new Notification(notification.title, {
        body: notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        data: notification.data
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        webNotification.close();
      }, 5000);

      return true;
    } catch (error) {
      console.error('[NotificationFallbackService] Web notification failed:', error);
      return false;
    }
  }

  /**
   * Mark notification as successfully sent
   */
  private async markNotificationAsSent(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .update({ 
          status: 'sent',
          delivered_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('[NotificationFallbackService] Error marking notification as sent:', error);
      }
    } catch (error) {
      console.error('[NotificationFallbackService] Database error marking as sent:', error);
    }
  }

  /**
   * Mark notification as failed
   */
  private async markNotificationAsFailed(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .update({ 
          status: 'failed',
          delivered_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('[NotificationFallbackService] Error marking notification as failed:', error);
      }
    } catch (error) {
      console.error('[NotificationFallbackService] Database error marking as failed:', error);
    }
  }

  /**
   * Test the fallback notification system
   */
  async testFallbackNotification(): Promise<boolean> {
    try {
      const testNotification: NotificationQueueItem = {
        id: 'test-' + Date.now(),
        user_id: 'test',
        notification_type: 'test',
        title: 'Test Notification',
        body: 'This is a test notification from the fallback service',
        scheduled_for: new Date().toISOString(),
        status: 'pending'
      };

      const success = this.isNative 
        ? await this.deliverNativeNotification(testNotification)
        : await this.deliverWebNotification(testNotification);

      console.log('[NotificationFallbackService] Test notification result:', success);
      return success;
    } catch (error) {
      console.error('[NotificationFallbackService] Test notification failed:', error);
      return false;
    }
  }

  /**
   * Get status information about the fallback service
   */
  getStatus(): { isPolling: boolean; isNative: boolean; platform: string } {
    return {
      isPolling: this.isPolling,
      isNative: this.isNative,
      platform: Capacitor.getPlatform()
    };
  }
}

export const notificationFallbackService = NotificationFallbackService.getInstance();