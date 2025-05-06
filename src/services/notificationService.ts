
import { toast } from 'sonner';

/**
 * Wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clear all toasts with retry mechanism
 * This helps prevent race conditions with toast creation/dismissal
 */
export async function clearAllToasts(maxRetries = 3): Promise<void> {
  let retryCount = 0;
  
  const attemptClear = async (): Promise<void> => {
    try {
      // Dismiss all toasts
      toast.dismiss();
      
      // Wait a bit to ensure they're dismissed
      await wait(50);
      
      // Check if there are any toast elements still in the DOM
      // This requires DOM access, so we wrap in try/catch
      try {
        const toastElements = document.querySelectorAll('[data-sonner-toast]');
        if (toastElements.length > 0) {
          console.log(`[clearAllToasts] ${toastElements.length} toasts still present after dismiss, retrying...`);
          
          // Try again with higher retry count
          if (retryCount < maxRetries) {
            retryCount++;
            await wait(100 * retryCount); // Increasing backoff
            return attemptClear();
          } else {
            console.warn(`[clearAllToasts] Failed to clear all toasts after ${maxRetries} attempts`);
          }
        } else {
          console.log('[clearAllToasts] All toasts successfully cleared');
        }
      } catch (domError) {
        // If we can't access DOM, just assume it worked
        console.warn('[clearAllToasts] Could not verify toast removal from DOM:', domError);
      }
    } catch (error) {
      console.error('[clearAllToasts] Error clearing toasts:', error);
      
      // Try again with higher retry count
      if (retryCount < maxRetries) {
        retryCount++;
        await wait(100 * retryCount); // Increasing backoff
        return attemptClear();
      } else {
        throw new Error(`Failed to clear toasts after ${maxRetries} attempts`);
      }
    }
  };
  
  return attemptClear();
}

/**
 * Ensure all toasts are cleared, with a DOM check
 * This uses a more aggressive approach for critical cases
 */
export async function ensureAllToastsCleared(): Promise<void> {
  try {
    // Try normal clear first
    await clearAllToasts();
    
    // For good measure, try one more time after a short delay
    await wait(50);
    toast.dismiss();
    
    // Now check if there are any toast elements in the DOM
    try {
      const toastContainer = document.querySelector('[data-sonner-toaster]');
      if (toastContainer) {
        const toastElements = toastContainer.querySelectorAll('[data-sonner-toast]');
        
        if (toastElements.length > 0) {
          console.warn(`[ensureAllToastsCleared] Found ${toastElements.length} toast elements still in DOM after clearing`);
          
          // Try to programmatically click each dismiss button
          toastElements.forEach((element) => {
            try {
              const dismissButton = element.querySelector('[data-dismiss]');
              if (dismissButton && dismissButton instanceof HTMLElement) {
                dismissButton.click();
              }
            } catch (e) {
              console.warn('[ensureAllToastsCleared] Error clicking dismiss button:', e);
            }
          });
          
          // Fallback: Try to remove the entire toast container from the DOM
          // This is a LAST RESORT approach
          try {
            const parent = toastContainer.parentElement;
            if (parent) {
              // Instead of removing, hide it
              (toastContainer as HTMLElement).style.opacity = '0';
              (toastContainer as HTMLElement).style.pointerEvents = 'none';
              
              // And then dismiss again
              toast.dismiss();
            }
          } catch (domError) {
            console.error('[ensureAllToastsCleared] Error hiding toast container:', domError);
          }
        } else {
          console.log('[ensureAllToastsCleared] All toasts successfully cleared');
        }
      }
    } catch (domError) {
      console.warn('[ensureAllToastsCleared] Could not verify toast removal from DOM:', domError);
    }
  } catch (error) {
    console.error('[ensureAllToastsCleared] Error ensuring toasts are cleared:', error);
    throw error;
  }
}

/**
 * Create a toast that automatically clears previous toasts
 */
export function clearAndToast(
  message: string, 
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  options?: { id?: string; duration?: number }
): void {
  clearAllToasts()
    .then(() => {
      switch (type) {
        case 'success':
          toast.success(message, options);
          break;
        case 'error':
          toast.error(message, options);
          break;
        case 'warning':
          toast.warning(message, options);
          break;
        default:
          toast(message, options);
      }
    })
    .catch(error => {
      console.error('[clearAndToast] Error clearing toasts before showing new toast:', error);
      // Show the toast anyway
      switch (type) {
        case 'success':
          toast.success(message, options);
          break;
        case 'error':
          toast.error(message, options);
          break;
        case 'warning':
          toast.warning(message, options);
          break;
        default:
          toast(message, options);
      }
    });
}

/**
 * Create a utility for processing status updates
 */
export function createProcessingToast(
  initialMessage: string,
  id: string = 'processing-toast'
): {
  update: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  dismiss: () => void;
} {
  // Show the initial toast
  toast.loading(initialMessage, { id, duration: Infinity });
  
  return {
    update: (message: string) => {
      toast.loading(message, { id });
    },
    success: (message: string) => {
      toast.success(message, { id, duration: 3000 });
    },
    error: (message: string) => {
      toast.error(message, { id, duration: 5000 });
    },
    dismiss: () => {
      toast.dismiss(id);
    }
  };
}

/**
 * Utility to add DOM event listeners for toast debugging
 */
export function setupToastDebugListeners(): () => void {
  const handleToastAdded = () => {
    console.log('[ToastDebug] Toast added to DOM');
  };
  
  const handleToastRemoved = () => {
    console.log('[ToastDebug] Toast removed from DOM');
  };
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-sonner-toast')) {
            handleToastAdded();
          }
        });
        
        mutation.removedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-sonner-toast')) {
            handleToastRemoved();
          }
        });
      }
    });
  });
  
  // Try to observe the toast container
  setTimeout(() => {
    try {
      const toastContainer = document.querySelector('[data-sonner-toaster]');
      if (toastContainer) {
        observer.observe(toastContainer, { childList: true, subtree: true });
      }
    } catch (e) {
      console.error('[setupToastDebugListeners] Error setting up observers:', e);
    }
  }, 1000);
  
  // Return a cleanup function
  return () => {
    observer.disconnect();
  };
}

/**
 * Export utilities for testing
 */
export const notificationTestUtils = {
  wait,
  clearAllToasts,
  ensureAllToastsCleared
};
