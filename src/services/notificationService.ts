import { toast } from '@/hooks/use-toast';

// Component mount tracking for safe DOM operations
const mountedComponents = new Set<string>();

export function registerComponent(componentId: string) {
  mountedComponents.add(componentId);
}

export function unregisterComponent(componentId: string) {
  mountedComponents.delete(componentId);
}

function isComponentMounted(componentId?: string): boolean {
  if (!componentId) return true; // If no ID provided, assume it's safe
  return mountedComponents.has(componentId);
}

// Safe toast wrapper that checks if component is still mounted
function safeToast(props: any, componentId?: string) {
  if (!isComponentMounted(componentId)) {
    console.log('Skipping toast for unmounted component:', componentId);
    return { id: '', dismiss: () => {}, update: () => {} };
  }
  
  try {
    return toast(props);
  } catch (error) {
    console.error('Toast error:', error);
    return { id: '', dismiss: () => {}, update: () => {} };
  }
}

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, duration?: number, componentId?: string) {
  return safeToast({
    title,
    description,
    duration
  }, componentId);
}

// New function specifically for tutorial toasts with short duration
export function showTutorialToast(title: string, description: string, componentId?: string) {
  return safeToast({
    title,
    description,
    duration: 500 // 0.5 seconds
  }, componentId);
}

// Translation-aware toast function - updated to handle async translate function
export async function showTranslatedToast(
  titleKey: string, 
  descriptionKey: string, 
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  duration?: number,
  interpolations?: Record<string, string>,
  componentId?: string
) {
  if (!isComponentMounted(componentId)) {
    console.log('Skipping translated toast for unmounted component:', componentId);
    return;
  }

  let title = await translate(titleKey);
  let description = await translate(descriptionKey);
  
  // Handle interpolations for dynamic content
  if (interpolations) {
    Object.entries(interpolations).forEach(([key, value]) => {
      title = title.replace(`{${key}}`, value);
      description = description.replace(`{${key}}`, value);
    });
  }
  
  return safeToast({
    title,
    description,
    duration
  }, componentId);
}

// Enhanced tutorial toast function that supports translation
export async function showTranslatedTutorialToast(
  titleKey: string,
  descriptionKey: string,
  translate: (key: string, sourceLanguage?: string, entryId?: number) => Promise<string>,
  componentId?: string
) {
  if (!isComponentMounted(componentId)) {
    console.log('Skipping translated tutorial toast for unmounted component:', componentId);
    return;
  }

  const title = await translate(titleKey);
  const description = await translate(descriptionKey);
  
  return safeToast({
    title,
    description,
    duration: 500 // 0.5 seconds for tutorial
  }, componentId);
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

// Notification-related exports for Settings compatibility - updated types to match Settings usage
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

export function setupJournalReminder(enabled: boolean, frequency: NotificationFrequency, times: NotificationTime[]) {
  console.log('setupJournalReminder called:', { enabled, frequency, times });
  
  // Store settings in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('notification_enabled', enabled.toString());
    localStorage.setItem('notification_frequency', frequency);
    localStorage.setItem('notification_times', JSON.stringify(times));
  }
}

export function initializeCapacitorNotifications() {
  console.log('initializeCapacitorNotifications called');
}
