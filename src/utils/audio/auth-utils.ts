
import { supabase } from '@/integrations/supabase/client';
import { createOrUpdateSession, ensureUserProfile } from './auth-profile';
import { 
  refreshAuthSession, 
  checkAuth, 
  getCurrentUserId, 
  updateSessionActivity, 
  endUserSession 
} from './auth-session';

// Simple exponential backoff retry mechanism
const retry = async (fn: () => Promise<any>, maxRetries = 3, delay = 300) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      retries++;
      if (retries >= maxRetries) throw err;
      console.log(`Retrying operation (${retries}/${maxRetries}) after error:`, err);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, retries - 1)));
    }
  }
};

// Safe storage access function that prevents crashes from storage access errors
const safeStorageAccess = (fn: () => any) => {
  try {
    return fn();
  } catch (err) {
    console.warn("Storage access error:", err);
    return null;
  }
};

// Export all authentication utility functions
export {
  refreshAuthSession,
  checkAuth,
  getCurrentUserId,
  updateSessionActivity,
  endUserSession,
  createOrUpdateSession,
  ensureUserProfile,
  retry,
  safeStorageAccess
};
