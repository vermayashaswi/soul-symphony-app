
import { toast } from '@/hooks/use-toast';

// Helper function to ensure toast calls are properly typed
export function showToast(title: string, description: string, duration?: number) {
  toast({
    title,
    description,
    duration
  });
}

// Helper function for error toast messages
export function showErrorToast(title: string, error: any) {
  const errorMessage = error instanceof Error ? error.message : 
                      typeof error === 'string' ? error : 
                      'An unexpected error occurred';
                      
  toast({
    title,
    description: errorMessage,
    variant: "destructive",
    duration: 5000
  });
}

// Helper function for success toast messages
export function showSuccessToast(title: string, description?: string) {
  toast({
    title,
    description,
    variant: "success",
    duration: 3000
  });
}
