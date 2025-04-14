
import { toast } from 'sonner';

/**
 * Tracks active toast IDs
 */
const activeToasts = new Set<string>();

/**
 * Clear all active toasts
 */
export function clearAllToasts(): void {
  // First try to clear any toasts that might be in our tracking set
  activeToasts.forEach(id => {
    try {
      toast.dismiss(id);
    } catch (e) {
      // Ignore errors from dismissed toasts
    }
  });
  activeToasts.clear();
  
  // Also try to clear toasts with common IDs
  const commonToastIds = [
    'processing-toast',
    'recording-toast',
    'error-toast',
    'success-toast',
    'journal-toast',
    'journal-success-toast',
    'journal-error-toast'
  ];
  
  commonToastIds.forEach(id => {
    try {
      toast.dismiss(id);
    } catch (e) {
      // Ignore errors from dismissed toasts
    }
  });
}

/**
 * Double-check that all toasts have been cleared
 */
export function ensureAllToastsCleared(): void {
  // Add a slight delay to ensure any in-progress dismissals complete
  setTimeout(() => {
    clearAllToasts();
  }, 100);
}

/**
 * Show toast with tracking
 */
export function showTrackedToast(
  message: string, 
  options: { 
    id?: string; 
    type?: 'success' | 'error' | 'info' | 'loading';
    duration?: number;
  } = {}
): string {
  const id = options.id || `toast-${Date.now()}`;
  
  let toastFunction;
  switch (options.type) {
    case 'success':
      toastFunction = toast.success;
      break;
    case 'error':
      toastFunction = toast.error;
      break;
    case 'loading':
      toastFunction = toast.loading;
      break;
    default:
      toastFunction = toast;
  }
  
  toastFunction(message, {
    id,
    duration: options.duration || 3000,
  });
  
  activeToasts.add(id);
  return id;
}
