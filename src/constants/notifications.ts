// Shared notification type mappings and constants

export const NOTIFICATION_TYPE_MAPPING: Record<string, string> = {
  // In-App Notifications
  'success': 'in_app_notifications',
  'info': 'in_app_notifications', 
  'warning': 'in_app_notifications',
  'error': 'in_app_notifications',
  'achievement': 'in_app_notifications',
  
  // Insightful Reminders
  'goal_achievement': 'insightful_reminders',
  'streak_reward': 'insightful_reminders',
  'sleep_reflection': 'insightful_reminders',
  'journal_insights': 'insightful_reminders',
  'mood_tracking_prompt': 'insightful_reminders',
  'inactivity_nudge': 'insightful_reminders',
  'insights_ready': 'insightful_reminders',
  
  // Journaling Reminders
  'journal_reminder': 'journaling_reminders',
  'daily_prompt': 'journaling_reminders',
  'writing_reminder': 'journaling_reminders',
  
  // Feature Updates (special category - always shown regardless of preferences)
  'feature_update': 'system',
  'smart_chat_invite': 'system',
  'custom': 'system'
};

export function getNotificationCategory(notificationType: string): string | null {
  return NOTIFICATION_TYPE_MAPPING[notificationType] || null;
}

export function shouldBypassPreferences(notificationType: string): boolean {
  const category = getNotificationCategory(notificationType);
  return category === 'system';
}

export function getInAppNotificationType(customType: string): 'info' | 'success' | 'warning' | 'error' | 'reminder' {
  switch (customType) {
    case 'smart_chat_invite':
      return 'info'
    case 'insights_ready':
      return 'success'
    case 'feature_update':
      return 'info'
    case 'journal_reminder':
      return 'reminder'
    default:
      return 'info'
  }
}