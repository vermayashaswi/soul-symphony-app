import { supabase } from '@/integrations/supabase/client';

export type CustomNotificationType = 'smart_chat_invite' | 'insights_ready' | 'feature_update' | 'journal_reminder' | 'custom';

export interface CustomNotificationOptions {
  userIds: string[];
  title: string;
  body: string;
  type: CustomNotificationType;
  actionUrl?: string;
  actionLabel?: string;
  data?: Record<string, any>;
  sendPush?: boolean;
  sendInApp?: boolean;
}

export class CustomNotificationService {
  private static instance: CustomNotificationService;

  public static getInstance(): CustomNotificationService {
    if (!CustomNotificationService.instance) {
      CustomNotificationService.instance = new CustomNotificationService();
    }
    return CustomNotificationService.instance;
  }

  /**
   * Send a custom notification to users
   */
  async sendNotification(options: CustomNotificationOptions): Promise<{
    success: boolean;
    results?: any;
    error?: string;
  }> {
    try {
      console.log('[CustomNotificationService] Sending notification:', {
        userIds: options.userIds,
        type: options.type,
        title: options.title
      });

      const { data, error } = await supabase.functions.invoke('send-custom-notification', {
        body: options
      });

      if (error) {
        console.error('[CustomNotificationService] Error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, results: data };
    } catch (error) {
      console.error('[CustomNotificationService] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send a Smart Chat invitation notification
   */
  async sendSmartChatInvite(userIds: string[], customMessage?: string): Promise<{
    success: boolean;
    results?: any;
    error?: string;
  }> {
    return this.sendNotification({
      userIds,
      title: '💬 Smart Chat Available',
      body: customMessage || 'Your AI companion is ready to chat. Tap to start a conversation!',
      type: 'smart_chat_invite',
      actionUrl: '/app/smart-chat',
      actionLabel: 'Open Chat',
      sendPush: true,
      sendInApp: true
    });
  }

  /**
   * Send an insights ready notification
   */
  async sendInsightsReady(userIds: string[]): Promise<{
    success: boolean;
    results?: any;
    error?: string;
  }> {
    return this.sendNotification({
      userIds,
      title: '📊 New Insights Available',
      body: 'Your personal insights have been generated. Discover patterns in your journal!',
      type: 'insights_ready',
      actionUrl: '/app/insights',
      actionLabel: 'View Insights',
      sendPush: true,
      sendInApp: true
    });
  }

  /**
   * Send a feature update notification
   */
  async sendFeatureUpdate(userIds: string[], title: string, body: string, actionUrl?: string): Promise<{
    success: boolean;
    results?: any;
    error?: string;
  }> {
    return this.sendNotification({
      userIds,
      title,
      body,
      type: 'feature_update',
      actionUrl,
      actionLabel: actionUrl ? 'Learn More' : undefined,
      sendPush: true,
      sendInApp: true
    });
  }

  /**
   * Send a custom notification with full control
   */
  async sendCustom(
    userIds: string[],
    title: string,
    body: string,
    actionUrl?: string,
    data?: Record<string, any>
  ): Promise<{
    success: boolean;
    results?: any;
    error?: string;
  }> {
    return this.sendNotification({
      userIds,
      title,
      body,
      type: 'custom',
      actionUrl,
      actionLabel: actionUrl ? 'Open' : undefined,
      data,
      sendPush: true,
      sendInApp: true
    });
  }
}

export const customNotificationService = CustomNotificationService.getInstance();