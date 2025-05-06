
import { toast } from "sonner";

// Duration constants
const STANDARD_DURATION = 1000; // 1 second for regular toasts (updated from 5 seconds)
const ACTIVE_JOB_DURATION = 8000; // 8 seconds for active jobs (unchanged)
const ERROR_DURATION = 6000; // 6 seconds for errors (unchanged)

// Check if we're in a browser environment
const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

// Store active toast IDs to prevent duplicates and ensure cleanup
const activeToasts = new Set<string | number>();
const toastTimeouts = new Map<string | number, NodeJS.Timeout>();

// Global lock to prevent concurrent toast cleanup operations
let toastCleanupInProgress = false;
let cleanupAttempts = 0;
const MAX_CLEANUP_ATTEMPTS = 3;

// Clear all toast timeouts when needed
const clearToastTimeouts = () => {
  try {
    toastTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    toastTimeouts.clear();
  } catch (e) {
    console.warn('[NotificationService] Error clearing toast timeouts:', e);
  }
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
    try {
      toast.dismiss(toastId);
    } catch (e) {
      console.warn(`[NotificationService] Error dismissing toast ${toastId}:`, e);
    }
  }
};

// Safe DOM element removal with thorough checks
const safeRemoveElement = (element: Element): boolean => {
  try {
    // Triple-check that the element exists and has a parent
    if (!element) return false;
    if (!element.parentNode) return false;
    if (!document.body.contains(element)) return false;
    
    // Remove the element safely
    element.parentNode.removeChild(element);
    return true;
  } catch (e) {
    console.warn('[NotificationService] Safe element removal failed:', e);
    return false;
  }
};

// Find and return all toast elements with proper error handling
const findToastElements = (): Element[] => {
  try {
    return Array.from(document.querySelectorAll('[data-sonner-toast]'));
  } catch (e) {
    console.warn('[NotificationService] Error finding toast elements:', e);
    return [];
  }
};

// Find and return all toast container elements
const findToastContainers = (): Element[] => {
  try {
    return Array.from(document.querySelectorAll('[data-sonner-toaster]'));
  } catch (e) {
    console.warn('[NotificationService] Error finding toast containers:', e);
    return [];
  }
};

// Enhanced aggressive toast clearing function with DOM node existence checks
export const clearAllToasts = (): Promise<boolean> => {
  // If a cleanup is already in progress, return the existing promise
  if (toastCleanupInProgress) {
    console.log('[NotificationService] Toast cleanup already in progress, deferring request');
    return new Promise((resolve) => setTimeout(() => resolve(true), 100));
  }

  console.log('[NotificationService] Clearing all toasts');
  toastCleanupInProgress = true;
  cleanupAttempts++;
  
  return new Promise((resolve) => {
    try {
      // First use the standard dismiss method with try-catch
      try {
        toast.dismiss();
      } catch (e) {
        console.warn('[NotificationService] Error in toast.dismiss():', e);
      }
      
      // Clear all timeouts
      clearToastTimeouts();
      
      // Then clear our tracking set
      activeToasts.clear();
      
      setTimeout(() => {
        // If we're in a browser environment, perform DOM cleanup
        if (isBrowser()) {
          try {
            // Find all toast elements with proper error handling
            const toastElements = findToastElements();
            console.log(`[NotificationService] Found ${toastElements.length} toast elements to remove`);
            
            // Remove toast elements one by one with safety checks
            let removedCount = 0;
            for (const element of toastElements) {
              if (safeRemoveElement(element)) {
                removedCount++;
              }
            }
            console.log(`[NotificationService] Successfully removed ${removedCount}/${toastElements.length} toast elements`);
            
            // Find toast container elements
            const containerElements = findToastContainers();
            console.log(`[NotificationService] Found ${containerElements.length} toast containers`);
            
            // Clear children from containers
            for (const container of containerElements) {
              try {
                // Check if container is valid
                if (!container || !document.body.contains(container)) continue;
                
                // Clear all children safely
                while (container.firstChild) {
                  try {
                    if (container.firstChild && container.contains(container.firstChild)) {
                      container.removeChild(container.firstChild);
                    } else {
                      break;
                    }
                  } catch (err) {
                    console.warn('[NotificationService] Error removing container child:', err);
                    break;
                  }
                }
              } catch (e) {
                console.warn('[NotificationService] Error clearing container children:', e);
              }
            }
          } catch (e) {
            console.error('[NotificationService] Error in DOM cleanup:', e);
          }
        }
      }, 50);
      
      // Final cleanup after a delay to allow animations to complete
      setTimeout(() => {
        try {
          // Call toast.dismiss() one more time as a final measure
          try {
            toast.dismiss();
          } catch (e) {
            console.warn('[NotificationService] Error in final toast dismiss:', e);
          }
          
          toastCleanupInProgress = false;
          console.log('[NotificationService] Toast cleanup completed');
          resolve(true);
        } catch (e) {
          console.error('[NotificationService] Error in final cleanup:', e);
          toastCleanupInProgress = false;
          resolve(true);
        }
      }, 100);
    } catch (e) {
      console.error('[NotificationService] Error in main cleanup flow:', e);
      toastCleanupInProgress = false;
      resolve(true);
    }
  });
};

// Function to ensure toasts are completely cleared through multiple attempts
export const ensureAllToastsCleared = async (): Promise<boolean> => {
  console.log('[NotificationService] Ensuring all toasts are completely cleared');
  
  // Reset cleanup attempts counter
  cleanupAttempts = 0;
  
  try {
    // First attempt
    await clearAllToasts();
    
    // If we've already tried too many times, just return
    if (cleanupAttempts >= MAX_CLEANUP_ATTEMPTS) {
      console.log(`[NotificationService] Max cleanup attempts (${MAX_CLEANUP_ATTEMPTS}) reached`);
      return true;
    }
    
    // Wait a bit and check if any toasts remain
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (isBrowser()) {
      try {
        let remainingToasts = findToastElements();
        if (remainingToasts.length > 0) {
          console.log(`[NotificationService] Found ${remainingToasts.length} remaining toasts after first cleanup`);
          
          // Second attempt with more gradual approach
          await clearAllToasts();
          
          // Wait again and check
          await new Promise(resolve => setTimeout(resolve, 150));
          
          // Final check and cleanup
          remainingToasts = findToastElements();
          if (remainingToasts.length > 0) {
            console.log(`[NotificationService] Still found ${remainingToasts.length} toasts, performing final cleanup`);
            
            // One final attempt with very conservative approach
            for (const toast of remainingToasts) {
              try {
                // Add animation to fade out
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.3s ease';
                
                // Remove after animation
                setTimeout(() => {
                  try {
                    if (toast.parentNode && document.body.contains(toast)) {
                      safeRemoveElement(toast);
                    }
                  } catch (err) {
                    // Ignore errors in final cleanup
                  }
                }, 300);
              } catch (e) {
                // Ignore errors in animation setup
              }
            }
          }
        }
      } catch (e) {
        console.error('[NotificationService] Error checking remaining toasts:', e);
      }
    }
    
    return true;
  } catch (e) {
    console.error('[NotificationService] Error in ensureAllToastsCleared:', e);
    return true; // Still return true to not block the flow
  }
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
  toastCleanupInProgress = false;
};
