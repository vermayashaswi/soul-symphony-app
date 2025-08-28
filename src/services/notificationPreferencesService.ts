import { supabase } from '@/integrations/supabase/client';

export interface NotificationPreferences extends Record<string, boolean> {
  master_notifications: boolean;
  in_app_notifications: boolean;
  insightful_reminders: boolean;
  journaling_reminders: boolean;
}

export type NotificationCategory = 'in_app_notifications' | 'insightful_reminders' | 'journaling_reminders';

export class NotificationPreferencesService {
  /**
   * Get user's notification preferences
   */
  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification preferences:', error);
        return null;
      }

      return (data?.notification_preferences as NotificationPreferences) || {
        master_notifications: false,
        in_app_notifications: true,
        insightful_reminders: true,
        journaling_reminders: true
      };
    } catch (error) {
      console.error('Error in getPreferences:', error);
      return null;
    }
  }

  /**
   * Update user's notification preferences
   */
  static async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          notification_preferences: preferences as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating notification preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updatePreferences:', error);
      return false;
    }
  }

  /**
   * Check if a specific notification category is enabled for a user
   */
  static async isCategoryEnabled(userId: string, category: NotificationCategory): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    
    if (!preferences) {
      return false;
    }

    // Must have master notifications enabled AND the specific category enabled
    return preferences.master_notifications && preferences[category];
  }

  /**
   * Check if master notifications are enabled
   */
  static async isMasterEnabled(userId: string): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    return preferences?.master_notifications || false;
  }

  /**
   * Bulk check multiple categories
   */
  static async getCategoryStates(userId: string): Promise<Record<NotificationCategory, boolean>> {
    const preferences = await this.getPreferences(userId);
    
    if (!preferences || !preferences.master_notifications) {
      return {
        in_app_notifications: false,
        insightful_reminders: false,
        journaling_reminders: false
      };
    }

    return {
      in_app_notifications: preferences.in_app_notifications,
      insightful_reminders: preferences.insightful_reminders,
      journaling_reminders: preferences.journaling_reminders
    };
  }

  /**
   * Enable master notifications and reset sub-categories to default
   */
  static async enableMasterNotifications(userId: string): Promise<boolean> {
    const defaultPreferences: NotificationPreferences = {
      master_notifications: true,
      in_app_notifications: true,
      insightful_reminders: true,
      journaling_reminders: true
    };

    return this.updatePreferences(userId, defaultPreferences);
  }

  /**
   * Disable all notifications
   */
  static async disableAllNotifications(userId: string): Promise<boolean> {
    const disabledPreferences: NotificationPreferences = {
      master_notifications: false,
      in_app_notifications: false,
      insightful_reminders: false,
      journaling_reminders: false
    };

    return this.updatePreferences(userId, disabledPreferences);
  }
}

// Convenience function for checking if user should receive a specific type of notification
export async function shouldSendNotification(userId: string, category: NotificationCategory): Promise<boolean> {
  return NotificationPreferencesService.isCategoryEnabled(userId, category);
}

// Map notification types to categories for easy lookup
export const NOTIFICATION_TYPE_MAPPING: Record<string, NotificationCategory> = {
  // In-App Notifications (appear in notification center)
  'success': 'in_app_notifications',
  'info': 'in_app_notifications',
  'warning': 'in_app_notifications',
  'error': 'in_app_notifications',
  'achievement': 'in_app_notifications',
  
  // Insightful Reminders (push notifications for insights/progress)
  'goal_achievement': 'insightful_reminders',
  'streak_reward': 'insightful_reminders',
  'sleep_reflection': 'insightful_reminders',
  'journal_insights': 'insightful_reminders',
  'mood_tracking_prompt': 'insightful_reminders',
  'inactivity_nudge': 'insightful_reminders',
  
  // Journaling Reminders (custom time-based reminders)
  'journal_reminder': 'journaling_reminders',
  'daily_prompt': 'journaling_reminders',
  'writing_reminder': 'journaling_reminders'
};

export function getNotificationCategory(notificationType: string): NotificationCategory | null {
  return NOTIFICATION_TYPE_MAPPING[notificationType] || null;
}