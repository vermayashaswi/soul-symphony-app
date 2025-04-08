
import { toast } from 'sonner';

/**
 * Clear all toasts
 */
export const clearAllToasts = () => {
  toast.dismiss();
};

/**
 * Ensures all toasts are dismissed and cleared from the DOM
 */
export const ensureAllToastsCleared = async (): Promise<void> => {
  toast.dismiss();
  
  // Wait a short time for the dismiss animation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  try {
    // Also try to manually remove any lingering toast elements from the DOM
    const toastElements = document.querySelectorAll('[data-sonner-toast]');
    if (toastElements.length > 0) {
      console.log(`Found ${toastElements.length} lingering toasts, removing manually`);
      toastElements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    }
  } catch (e) {
    console.error('Error in manual toast DOM cleanup:', e);
  }
  
  // Final delay to ensure everything is cleaned up
  await new Promise(resolve => setTimeout(resolve, 50));
};
