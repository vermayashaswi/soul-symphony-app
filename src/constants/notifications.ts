// Shared notification type mappings and constants

export const NOTIFICATION_TYPE_MAPPING: Record<string, string> = {
  // Journaling Reminders
  'journal_reminder': 'journaling_reminders',
  'daily_prompt': 'journaling_reminders',
  'writing_reminder': 'journaling_reminders',
  
  // System notifications (bypass preferences - always shown)
  'feature_update': 'system',
  'smart_chat_invite': 'system',
  'custom': 'system',
  'success': 'system',
  'info': 'system', 
  'warning': 'system',
  'error': 'system',
  'achievement': 'system',
  'goal_achievement': 'system',
  'streak_reward': 'system',
  'sleep_reflection': 'system',
  'journal_insights': 'system',
  'mood_tracking_prompt': 'system',
  'inactivity_nudge': 'system',
  'insights_ready': 'system'
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