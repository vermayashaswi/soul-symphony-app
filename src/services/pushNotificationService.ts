import { serviceWorkerManager } from '@/utils/serviceWorker';
import { toast } from 'sonner';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private vapidPublicKey = 'BMxGp7l5C1XnRIAr2oPKcLqvOjCDQOhNPJWGw8HXKsF9X9A1dKZb4rUwVyPjCDj3J5F7P2Y8GhQzW3N1SzX4V6R';
  private subscription: PushSubscription | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications not supported');
    }

    const permission = await Notification.requestPermission();
    console.log('[PushNotifications] Permission result:', permission);
    
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      console.warn('[PushNotifications] Push notifications not supported');
      return null;
    }

    if (!serviceWorkerManager.isServiceWorkerRegistered()) {
      console.warn('[PushNotifications] Service worker not registered');
      return null;
    }

    try {
      const permission = await this.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('[PushNotifications] Permission not granted');
        return null;
      }

      const registration = serviceWorkerManager.getRegistration();
      if (!registration) {
        throw new Error('No service worker registration available');
      }

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
        });
      }

      this.subscription = subscription;
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      console.log('[PushNotifications] Successfully subscribed');
      return subscription;

    } catch (error) {
      console.error('[PushNotifications] Subscription failed:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const result = await this.subscription.unsubscribe();
      
      if (result) {
        // Remove subscription from server
        await this.removeSubscriptionFromServer(this.subscription);
        this.subscription = null;
        console.log('[PushNotifications] Successfully unsubscribed');
      }
      
      return result;
    } catch (error) {
      console.error('[PushNotifications] Unsubscription failed:', error);
      return false;
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.isSupported() || !serviceWorkerManager.isServiceWorkerRegistered()) {
      return null;
    }

    const registration = serviceWorkerManager.getRegistration();
    if (!registration) {
      return null;
    }

    try {
      this.subscription = await registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error('[PushNotifications] Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Test push notification
   */
  async testNotification(): Promise<void> {
    if (!this.subscription) {
      throw new Error('No active push subscription');
    }

    try {
      const response = await fetch('/api/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: this.subscription,
          payload: {
            title: 'Test Notification',
            body: 'This is a test push notification from Soulo!',
            icon: '/lovable-uploads/31ed88ef-f596-4b91-ba58-a4175eebe779.png'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      toast.success('Test notification sent!');
    } catch (error) {
      console.error('[PushNotifications] Test notification failed:', error);
      toast.error('Failed to send test notification');
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        },
        userId: this.getCurrentUserId()
      };

      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }

    } catch (error) {
      console.error('[PushNotifications] Failed to send subscription to server:', error);
    }
  }

  /**
   * Remove subscription from server
   */
  private async removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push-subscription', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          userId: this.getCurrentUserId()
        })
      });
    } catch (error) {
      console.error('[PushNotifications] Failed to remove subscription from server:', error);
    }
  }

  /**
   * Helper: Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Helper: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary);
  }

  /**
   * Helper: Get current user ID
   */
  private getCurrentUserId(): string {
    // This should be replaced with actual user ID from auth context
    return localStorage.getItem('userId') || 'anonymous';
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();
