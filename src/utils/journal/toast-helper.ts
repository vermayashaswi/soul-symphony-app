
import { toast as sonnerToast } from 'sonner';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string) {
  sonnerToast(title, {
    description
  });
}
