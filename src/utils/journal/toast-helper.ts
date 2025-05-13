
import { toast } from '@/hooks/use-toast';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, duration?: number, variant?: 'default' | 'destructive' | 'success' | 'warning') {
  toast({
    title,
    description,
    duration,
    variant
  });
}
