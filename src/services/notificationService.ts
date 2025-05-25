
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

// Translation-aware toast function
export function showTranslatedToast(
  titleKey: string, 
  descriptionKey: string, 
  translate: (key: string, defaultValue?: string) => string,
  duration?: number,
  interpolations?: Record<string, string>
) {
  let title = translate(titleKey, titleKey);
  let description = translate(descriptionKey, descriptionKey);
  
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
