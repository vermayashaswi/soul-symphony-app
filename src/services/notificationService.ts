
import { toast } from "@/components/ui/use-toast";

// Duration constants
const STANDARD_DURATION = 1000; // 1 second for regular toasts (updated from 5 seconds)
const ACTIVE_JOB_DURATION = 8000; // 8 seconds for active jobs (unchanged)
const ERROR_DURATION = 6000; // 6 seconds for errors (unchanged)

// Check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

// Check if we're on a website page (vs an app page)
const isWebsitePage = () => {
  // Check if we're in the browser
  if (!isBrowser()) return false;
  
  // Get the current pathname
  const pathname = window.location.pathname;
  
  // Define website pages (as opposed to app pages)
  const websitePatterns = [
    /^\/$/, // Root/home
    /^\/website/,
    /^\/blog/,
    /^\/faq/,
    /^\/privacy-policy/,
    /^\/terms/
  ];
  
  // Check if current path matches any website patterns
  return websitePatterns.some(pattern => pattern.test(pathname));
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
  // Skip showing toasts on website pages
  if (isWebsitePage()) {
    console.log('[NotificationService] Toast suppressed on website page:', message);
    return null;
  }

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
  
  // Map our type values to shadcn toast variants
  const toastVariant = type === "error" ? "destructive" : "default";
  
  // In the updated version, we'll use the standard toast function with the appropriate options
  toastId = toast({
    title: type.charAt(0).toUpperCase() + type.slice(1),
    description: message,
    variant: toastVariant,
    duration: duration
  });
  
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
    // Access dismiss via the global toast object
    if (typeof toast.dismiss === 'function') {
      toast.dismiss(toastId.toString());
    }
  }
};

// Enhanced aggressive toast clearing function
export const clearAllToasts = (): Promise<boolean> => {
  console.log('[NotificationService] Clearing all toasts');
  
  return new Promise((resolve) => {
    // First use the standard dismiss method
    if (typeof toast.dismiss === 'function') {
      toast.dismiss();
    }
    
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
      if (typeof toast.dismiss === 'function') {
        toast.dismiss();
      }
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
      if (typeof toast.dismiss === 'function') {
        toast.dismiss();
      }
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
export const scheduleNotification = async (
  title: string, 
  body: string, 
  hours: number = 24
): Promise<boolean> => {
  try {
    // For web testing - immediate notification if hours is 0, otherwise mock scheduling
    if (isBrowser() && 'Notification' in window && Notification.permission === 'granted') {
      if (hours === 0) {
        // Immediate notification
        new Notification(title, { body });
        console.log(`[NotificationService] Sent immediate notification: "${title}"`);
      } else {
        // This is just a mock for web - on real mobile we would use actual scheduling
        console.log(`[NotificationService] Scheduled notification: "${title}" for ${hours} hours from now`);
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('[NotificationService] Error scheduling notification:', error);
    return false;
  }
};

// New type definitions for notification frequency and time
export type NotificationFrequency = 'once' | 'twice' | 'thrice';
export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

// Get notification times based on selected time preferences
const getNotificationTimeHours = (timePreferences: NotificationTime[]): number[] => {
  const times: Record<NotificationTime, number> = {
    'morning': 8,     // 8:00 AM
    'afternoon': 14,  // 2:00 PM
    'evening': 19,    // 7:00 PM
    'night': 22       // 10:00 PM
  };
  
  return timePreferences.map(time => times[time]);
};

// Get notification days based on frequency
const getNotificationDays = (frequency: NotificationFrequency): number => {
  switch (frequency) {
    case 'once': return 1;  // Once a day
    case 'twice': return 2; // Twice a day
    case 'thrice': return 3; // Three times a day
    default: return 1;
  }
};

// Set up journal reminder with frequency and time preferences
export const setupJournalReminder = async (
  enabled: boolean,
  frequency: NotificationFrequency = 'once',
  timePreferences: NotificationTime[] = ['evening']
): Promise<void> => {
  if (!enabled) return;
  
  try {
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      const timeHours = getNotificationTimeHours(timePreferences);
      const notificationDays = getNotificationDays(frequency);
      
      // Limit the notifications per day based on frequency
      const scheduledTimes = timeHours.slice(0, notificationDays);
      
      console.log(`[NotificationService] Setting up ${notificationDays} notifications per day at times:`, scheduledTimes);
      
      // Schedule notifications for each selected time
      for (const hour of scheduledTimes) {
        // Calculate hours until next notification time
        const now = new Date();
        const notificationTime = new Date();
        notificationTime.setHours(hour, 0, 0, 0);
        
        // If notification time has passed today, schedule for tomorrow
        if (now > notificationTime) {
          notificationTime.setDate(notificationTime.getDate() + 1);
        }
        
        // Calculate hours difference
        const hoursDiff = Math.round((notificationTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        
        await scheduleNotification(
          "Journal Reminder",
          "It's time to check in with yourself. Take a moment to record your thoughts.",
          hoursDiff
        );
        
        console.log(`[NotificationService] Journal reminder scheduled for ${hour}:00`);
      }
      
      // Save notification preferences to localStorage for persistence
      if (isBrowser()) {
        localStorage.setItem('notification_enabled', 'true');
        localStorage.setItem('notification_frequency', frequency);
        localStorage.setItem('notification_times', JSON.stringify(timePreferences));
      }
      
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
