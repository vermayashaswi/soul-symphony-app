
import { toast } from '@/hooks/use-toast';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, duration?: number) {
  toast({
    title,
    description,
    duration
  });
}

// New function specifically for tutorial toasts with short duration
export function showTutorialToast(title: string, description: string) {
  toast({
    title,
    description,
    duration: 500 // 0.5 seconds
  });
}

// Translation-aware toast function - updated to handle async translate function
export async function showTranslatedToast(
  titleKey: string, 
  descriptionKey: string, 
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  duration?: number,
  interpolations?: Record<string, string>
) {
  let title = await translate(titleKey);
  let description = await translate(descriptionKey);
  
  // Handle interpolations for dynamic content
  if (interpolations) {
    Object.entries(interpolations).forEach(([key, value]) => {
      title = title.replace(`{${key}}`, value);
      description = description.replace(`{${key}}`, value);
    });
  }
  
  toast({
    title,
    description,
    duration
  });
}

// Legacy functions for backward compatibility
export function clearAllToasts() {
  // Implementation for clearing all toasts if needed
  console.log('clearAllToasts called - using sonner toast system');
}

export async function ensureAllToastsCleared() {
  // Implementation for ensuring toasts are cleared
  return Promise.resolve();
}

// Notification-related exports for Settings compatibility
export type NotificationFrequency = 'daily' | 'weekly' | 'never';
export type NotificationTime = 'morning' | 'afternoon' | 'evening';

export function setupJournalReminder(frequency: NotificationFrequency, time: NotificationTime) {
  console.log('setupJournalReminder called:', { frequency, time });
}

export function initializeCapacitorNotifications() {
  console.log('initializeCapacitorNotifications called');
}
