
import { toast } from '@/hooks/use-toast';
import type { ToastProps } from '@/hooks/use-toast';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info') {
  toast({
    title,
    description,
    variant
  });
}
