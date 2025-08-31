import { supabase } from '@/integrations/supabase/client';

export interface NotificationPreferences extends Record<string, boolean> {
  master_notifications: boolean;
  journaling_reminders: boolean;
}

export type NotificationCategory = 'journaling_reminders';

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
        journaling_reminders: false
      };
    }

    return {
      journaling_reminders: preferences.journaling_reminders
    };
  }

  /**
   * Enable master notifications and reset sub-categories to default
   */
  static async enableMasterNotifications(userId: string): Promise<boolean> {
    const defaultPreferences: NotificationPreferences = {
      master_notifications: true,
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
  // Journaling Reminders (custom time-based reminders)
  'journal_reminder': 'journaling_reminders',
  'daily_prompt': 'journaling_reminders',
  'writing_reminder': 'journaling_reminders'
};

export function getNotificationCategory(notificationType: string): NotificationCategory | null {
  return NOTIFICATION_TYPE_MAPPING[notificationType] || null;
}