// Import types manually to avoid export issues
interface TranslationContextType {
  currentLanguage: string;
  translate: (text: string, sourceLanguage?: string, entryId?: number, forceTranslate?: boolean) => Promise<string | null>;
  isTranslating: boolean;
  translationProgress: number;
  switchLanguage: (language: string) => void;
  translationsDisabled: boolean;
  setTranslationsDisabled: (disabled: boolean) => void;
  prefetchRouteTranslations: (route: string, texts: string[]) => Promise<void>;
}

// Common notification texts that need translation
export const NOTIFICATION_TEXTS = {
  // General notifications
  'New message': 'New message',
  'Goal achieved': 'Goal achieved',
  'Reminder': 'Reminder',
  'Alert': 'Alert',
  'Success': 'Success',
  'Error': 'Error',
  'Warning': 'Warning',
  'Info': 'Info',
  
  // Journal reminders
  'Time to reflect on your day': 'Time to reflect on your day',
  'How are you feeling today?': 'How are you feeling today?',
  'Take a moment to journal': 'Take a moment to journal',
  'Your daily reflection awaits': 'Your daily reflection awaits',
  'Morning reflection time': 'Morning reflection time',
  'Evening thoughts time': 'Evening thoughts time',
  'Journal reminder': 'Journal reminder',
  
  // Streak and goals
  'Congratulations! You reached your goal': 'Congratulations! You reached your goal',
  'Keep up the great work!': 'Keep up the great work!',
  'Streak reward earned': 'Streak reward earned',
  'You\'re on a roll!': 'You\'re on a roll!',
  'Don\'t break your streak': 'Don\'t break your streak',
  
  // Mood tracking
  'How was your mood today?': 'How was your mood today?',
  'Track your emotional journey': 'Track your emotional journey',
  'Reflect on your feelings': 'Reflect on your feelings',
  
  // Sleep and wellness
  'Time for your evening reflection': 'Time for your evening reflection',
  'How did you sleep?': 'How did you sleep?',
  'Morning check-in': 'Morning check-in',
  'Wellness reminder': 'Wellness reminder',
  
  // Insights and analytics
  'New insights available': 'New insights available',
  'Your weekly summary is ready': 'Your weekly summary is ready',
  'Monthly report generated': 'Monthly report generated',
  'Progress update': 'Progress update',
  
  // Permission and settings
  'Notification permission granted': 'Notification permission granted',
  'Notification permission denied': 'Notification permission denied',
  'Please enable notifications': 'Please enable notifications',
  'Settings updated': 'Settings updated',
  'Reminders scheduled': 'Reminders scheduled',
  
  // Error states
  'Failed to schedule notification': 'Failed to schedule notification',
  'Permission required': 'Permission required',
  'Feature unavailable': 'Feature unavailable',
  'Service error': 'Service error',
  
  // Loading states
  'Scheduling notifications...': 'Scheduling notifications...',
  'Loading reminders...': 'Loading reminders...',
  'Updating settings...': 'Updating settings...',
  'Processing...': 'Processing...',
};

export interface NotificationTranslationService {
  translateNotificationText(text: string, targetLanguage?: string): Promise<string>;
  translateNotificationData(notification: any, targetLanguage?: string): Promise<any>;
  getTranslatedTemplate(templateKey: string, variables?: Record<string, string>, targetLanguage?: string): Promise<string>;
}

export class NotificationTranslationServiceImpl implements NotificationTranslationService {
  private translationContext?: TranslationContextType;

  constructor(translationContext?: TranslationContextType) {
    this.translationContext = translationContext;
  }

  async translateNotificationText(text: string, targetLanguage?: string): Promise<string> {
    if (!this.translationContext?.translate) {
      return text;
    }

    try {
      const translated = await this.translationContext.translate(text, 'en', undefined, true);
      return translated || text;
    } catch (error) {
      console.error('[NotificationTranslationService] Translation failed:', error);
      return text;
    }
  }

  async translateNotificationData(notification: any, targetLanguage?: string): Promise<any> {
    if (!notification) return notification;

    const translatedNotification = { ...notification };

    // Translate title and message
    if (notification.title) {
      translatedNotification.title = await this.translateNotificationText(notification.title, targetLanguage);
    }

    if (notification.message || notification.body) {
      const messageText = notification.message || notification.body;
      const translatedMessage = await this.translateNotificationText(messageText, targetLanguage);
      translatedNotification.message = translatedMessage;
      translatedNotification.body = translatedMessage;
    }

    // Translate action labels
    if (notification.action_label) {
      translatedNotification.action_label = await this.translateNotificationText(notification.action_label, targetLanguage);
    }

    // Translate any additional text fields
    if (notification.data?.subtitle) {
      translatedNotification.data.subtitle = await this.translateNotificationText(notification.data.subtitle, targetLanguage);
    }

    return translatedNotification;
  }

  async getTranslatedTemplate(templateKey: string, variables?: Record<string, string>, targetLanguage?: string): Promise<string> {
    let template = NOTIFICATION_TEXTS[templateKey as keyof typeof NOTIFICATION_TEXTS] || templateKey;
    
    // Translate the template
    template = await this.translateNotificationText(template, targetLanguage);

    // Replace variables if provided
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      });
    }

    return template;
  }
}

// Factory function to create notification translation service
export const createNotificationTranslationService = (translationContext?: TranslationContextType): NotificationTranslationService => {
  return new NotificationTranslationServiceImpl(translationContext);
};

// Default export for convenience
export const notificationTranslationService = new NotificationTranslationServiceImpl();

// Hook for using notification translation in components
export const useNotificationTranslation = (translationContext?: TranslationContextType) => {
  return createNotificationTranslationService(translationContext);
};