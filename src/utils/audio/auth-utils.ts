
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Verifies that the user is authenticated
 */
export async function verifyUserAuthentication() {
  try {
    console.log("Verifying user authentication...");
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth session error:', error);
      return { 
        isAuthenticated: false, 
        error: `Authentication error: ${error.message}` 
      };
    }
    
    if (!data.session) {
      console.log('No session found in auth-utils verification');
      return { isAuthenticated: false, error: 'User is not authenticated' };
    }
    
    console.log("User authenticated successfully:", data.session.user.id);
    return { isAuthenticated: true, userId: data.session.user.id };
  } catch (error: any) {
    console.error('Unexpected authentication error:', error);
    return { 
      isAuthenticated: false, 
      error: `Unexpected authentication error: ${error.message}` 
    };
  }
}

/**
 * Gets the current user ID from the session
 * Returns undefined if no user is authenticated
 */
export async function getCurrentUserId(): Promise<string | undefined> {
  try {
    console.log("Getting current user ID...");
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting user ID:', error);
      return undefined;
    }
    
    if (!data.session) {
      console.log('No session found when getting user ID');
      return undefined;
    }
    
    console.log("Retrieved user ID:", data.session.user.id);
    return data.session.user.id;
  } catch (error: any) {
    console.error('Unexpected error getting user ID:', error);
    return undefined;
  }
}

/**
 * Force refreshes the current session
 * Useful for cases where the session state might be outdated
 * 
 * This version implements retry logic and silent failures to prevent
 * annoying error messages when refresh attempts fail in the background
 */
export async function refreshAuthSession(showToasts: boolean = false): Promise<boolean> {
  let retryCount = 0;
  const maxRetries = 2;
  
  async function attemptRefresh(): Promise<boolean> {
    try {
      console.log(`Attempting to refresh auth session... (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error);
        
        // Only show toast on explicit refresh requests, not background ones
        if (showToasts) {
          toast.error(`Session refresh failed: ${error.message}`);
        }
        
        // If error is retriable and we haven't exceeded retries
        if (retryCount < maxRetries && 
            (error.message.includes('network') || 
             error.message.includes('timeout') ||
             error.message.includes('rate limit'))) {
          retryCount++;
          // Wait with exponential backoff before retrying
          const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
          console.log(`Retrying session refresh in ${delay}ms...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptRefresh();
        }
        
        return false;
      }
      
      console.log("Session refreshed successfully:", !!data.session);
      
      if (data.session) {
        console.log("User info after refresh:", {
          id: data.session.user.id,
          email: data.session.user.email
        });
        
        if (showToasts) {
          toast.success("Session refreshed successfully");
        }
      }
      
      return !!data.session;
    } catch (error: any) {
      console.error('Unexpected error refreshing session:', error);
      
      // Only show toast on explicit refresh requests
      if (showToasts) {
        toast.error(`Unexpected error refreshing session: ${error.message}`);
      }
      
      return false;
    }
  }
  
  return attemptRefresh();
}
