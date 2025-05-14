
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
