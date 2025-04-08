
import { toast } from "sonner";

// Duration constants
const STANDARD_DURATION = 5000; // 5 seconds for regular toasts (improved from 1 second)
const ACTIVE_JOB_DURATION = 8000; // 8 seconds for active jobs
const ERROR_DURATION = 6000; // 6 seconds for errors (increased from 3 seconds)

// Check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

// Store active toast IDs to prevent duplicates and ensure cleanup
const activeToasts = new Set<string | number>();
const toastTimeouts = new Map<string | number, NodeJS.Timeout>();

// Clear all toast timeouts when needed
const clearToastTimeouts = () => {
  toastTimeouts.forEach(timeout => {
    clearTimeout(timeout);
  });
  toastTimeouts.clear();
};

// Enhanced toast functions for different types of notifications
export const showToast = (
  message: string, 
  type: "default" | "success" | "error" | "info" | "warning" = "default",
  isActiveJob = false
) => {
  // Deduplicate identical messages that might be in flight
  const messageKey = `${type}-${message}`;
  if (activeToasts.has(messageKey)) {
    console.log(`[NotificationService] Skipping duplicate toast: ${messageKey}`);
    return;
  }
  
  const duration = isActiveJob ? ACTIVE_JOB_DURATION : 
                  (type === "error" ? ERROR_DURATION : STANDARD_DURATION);
  
  console.log(`[NotificationService] Showing toast: ${message} (${type})`);
  
  let toastId;
  switch (type) {
    case "success":
      toastId = toast.success(message, { 
        duration, 
        id: messageKey,
        onDismiss: () => {
          activeToasts.delete(messageKey);
          if (toastTimeouts.has(messageKey)) {
            clearTimeout(toastTimeouts.get(messageKey)!);
            toastTimeouts.delete(messageKey);
          }
        }
      });
      break;
    case "error":
      toastId = toast.error(message, { 
        duration, 
        id: messageKey,
        onDismiss: () => {
          activeToasts.delete(messageKey);
          if (toastTimeouts.has(messageKey)) {
            clearTimeout(toastTimeouts.get(messageKey)!);
            toastTimeouts.delete(messageKey);
          }
        }
      });
      break;
    case "info":
      toastId = toast.info(message, { 
        duration, 
        id: messageKey,
        onDismiss: () => {
          activeToasts.delete(messageKey);
          if (toastTimeouts.has(messageKey)) {
            clearTimeout(toastTimeouts.get(messageKey)!);
            toastTimeouts.delete(messageKey);
          }
        }
      });
      break;
    case "warning":
      toastId = toast.warning(message, { 
        duration, 
        id: messageKey,
        onDismiss: () => {
          activeToasts.delete(messageKey);
          if (toastTimeouts.has(messageKey)) {
            clearTimeout(toastTimeouts.get(messageKey)!);
            toastTimeouts.delete(messageKey);
          }
        }
      });
      break;
    default:
      toastId = toast(message, { 
        duration, 
        id: messageKey,
        onDismiss: () => {
          activeToasts.delete(messageKey);
          if (toastTimeouts.has(messageKey)) {
            clearTimeout(toastTimeouts.get(messageKey)!);
            toastTimeouts.delete(messageKey);
          }
        }
      });
  }
  
  activeToasts.add(messageKey);
  
  // Ensure toasts are cleared after their duration
  if (duration !== null) {
    const timeoutId = setTimeout(() => {
      clearToast(toastId);
      activeToasts.delete(messageKey);
      toastTimeouts.delete(messageKey);
    }, duration + 500); // Add a buffer to ensure toast removal
    
    toastTimeouts.set(messageKey, timeoutId);
  }
  
  return toastId;
};

// Clear a specific toast
export const clearToast = (toastId: string | number) => {
  if (toastId) {
    console.log(`[NotificationService] Clearing toast: ${toastId}`);
    toast.dismiss(toastId);
  }
};

// Enhanced aggressive toast clearing function
export const clearAllToasts = (): Promise<boolean> => {
  console.log('[NotificationService] Clearing all toasts');
  
  return new Promise((resolve) => {
    // First use the standard dismiss method
    toast.dismiss();
    
    // Clear all timeouts
    clearToastTimeouts();
    
    // Then clear our tracking set
    activeToasts.clear();
    
    // As a safety measure for any persistent toasts with the loading state,
    // get all toast elements and remove them manually if needed
    if (isBrowser()) {
      try {
        // Try to find any toast container elements that might be persisting
        const toastContainers = document.querySelectorAll('[data-sonner-toast]');
        console.log(`[NotificationService] Found ${toastContainers.length} persistent toast containers`);
        
        if (toastContainers.length > 0) {
          toastContainers.forEach(container => {
            // Manual removal since we've disabled close buttons
            if (container.parentNode) {
              container.parentNode?.removeChild(container);
            }
          });
        }
        
        // Also try to clear any toast containers
        const sonnerRoots = document.querySelectorAll('[data-sonner-toaster]');
        console.log(`[NotificationService] Found ${sonnerRoots.length} sonner root containers`);
        
        if (sonnerRoots.length > 0) {
          sonnerRoots.forEach(root => {
            // Don't remove the container, but clear its children
            while (root.firstChild) {
              root.removeChild(root.firstChild);
            }
          });
        }
      } catch (e) {
        console.error('[NotificationService] Error trying to clean up persistent toasts:', e);
      }
    }
    
    // Give it a small delay to ensure DOM updates are complete
    setTimeout(() => {
      // Additional safety check after DOM update
      if (isBrowser()) {
        const remainingToasts = document.querySelectorAll('[data-sonner-toast]');
        if (remainingToasts.length > 0) {
          console.log(`[NotificationService] Found ${remainingToasts.length} remaining toasts after cleanup`);
          try {
            remainingToasts.forEach(toast => {
              if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
              }
            });
          } catch (e) {
            console.error('[NotificationService] Error in final toast cleanup:', e);
          }
        }
      }
      
      // Call toast.dismiss() one more time as a final measure
      toast.dismiss();
      resolve(true);
    }, 50);
  });
};

// Function to ensure toasts are completely cleared through multiple attempts
export const ensureAllToastsCleared = async (): Promise<boolean> => {
  console.log('[NotificationService] Ensuring all toasts are completely cleared');
  
  // First attempt
  await clearAllToasts();
  
  // Wait a bit and check if any toasts remain
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (isBrowser()) {
    const remainingToasts = document.querySelectorAll('[data-sonner-toast]');
    if (remainingToasts.length > 0) {
      console.log(`[NotificationService] Found ${remainingToasts.length} remaining toasts after first cleanup`);
      
      // Second attempt with more aggressive DOM manipulation
      toast.dismiss();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        document.querySelectorAll('[data-sonner-toast]').forEach(toast => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        });
      } catch (e) {
        console.error('[NotificationService] Error in second toast cleanup:', e);
      }
    }
  }
  
  // Final attempt to ensure cleanup is complete
  await clearAllToasts();
  return true;
};

// Function to request notification permissions (web only for now)
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    // For web browsers
    if (isBrowser() && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  } catch (error) {
    console.error('[NotificationService] Error requesting notification permission:', error);
    return false;
  }
};

// Schedule a notification (for reminders) - web only for now
export const scheduleNotification = async (title: string, body: string, hours: number = 24): Promise<boolean> => {
  try {
    // For web testing - immediate notification
    if (isBrowser() && 'Notification' in window && Notification.permission === 'granted') {
      // This is just a mock for web - on real mobile we would use actual scheduling
      new Notification(title, { body });
      
      // Log for debugging
      console.log(`[NotificationService] Scheduled notification: "${title}" for ${hours} hours from now`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[NotificationService] Error scheduling notification:', error);
    return false;
  }
};

// Set up journal reminder
export const setupJournalReminder = async (enabled: boolean): Promise<void> => {
  if (!enabled) return;
  
  try {
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      await scheduleNotification(
        "Journal Reminder",
        "It's time to check in with yourself. Take a moment to record your thoughts.",
        24 // Daily reminder
      );
      showToast("Journal reminders enabled", "success");
    } else {
      showToast("Could not enable notifications. Please check your browser settings.", "error");
    }
  } catch (error) {
    console.error("[NotificationService] Error setting up journal reminder:", error);
    showToast("Failed to set up notification", "error");
  }
};

// Initialize Capacitor notifications if available
export const initializeCapacitorNotifications = async (): Promise<void> => {
  // This is a stub function for the Settings page
  // In a real implementation, this would initialize Capacitor notifications
  // But since we're focused on web right now, it's just a placeholder
  console.log("[NotificationService] Capacitor notifications initialization stub called");
};

// Clean up function to be called when components unmount
export const cleanupNotifications = () => {
  console.log('[NotificationService] Cleaning up notifications');
  clearAllToasts();
  clearToastTimeouts();
  activeToasts.clear();
};
