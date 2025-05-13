
import { toast, type ToasterToast } from '@/hooks/use-toast';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, duration?: number) {
  toast({
    title,
    description,
    duration
  });
}
