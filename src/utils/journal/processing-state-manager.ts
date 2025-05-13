import { toast as sonnerToast } from 'sonner';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string) {
  sonnerToast(title, {
    description
  });
}

// Line 151 should be updated to use this function instead
// showToast("Error title", "Error description");
