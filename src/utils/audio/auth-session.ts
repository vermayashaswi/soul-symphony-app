// This file handles session management functionality separated from auth-utils.ts
import { supabase } from '@/integrations/supabase/client';

// Function to refresh the auth session
export const refreshAuthSession = async (showToasts = false) => {
  try {
    console.log("Starting session refresh");
    
    // Check if we have token in storage before attempting refresh
    let hasTokens = false;
    try {
      hasTokens = !!localStorage.getItem('supabase.auth.token') || 
                 !!localStorage.getItem('sb-' + window.location.hostname.split('.')[0] + '-auth-token');
                 
      if (!hasTokens) {
        console.log("No stored tokens found to refresh session from");
        return false;
      }
    } catch (storageError) {
      console.error("Storage error checking tokens:", storageError);
      return false;
    }
    
    // Wrap in try/catch to handle potential storage errors
    let refreshResult;
    try {
      refreshResult = await supabase.auth.refreshSession();
    } catch (storageError) {
      console.error("Storage error during refresh:", storageError);
      return false;
    }
    
    const { data, error } = refreshResult;
    
    if (error) {
      // This is normal for non-authenticated users, don't treat as error
      if (error.message.includes('Auth session missing')) {
        console.log("No session exists to refresh (user not authenticated)");
        return false;
      }
      
      console.error("Error refreshing session:", error.message);
      return false;
    }
    
    if (data.session) {
      console.log("Session refreshed successfully");
      // Update the session's last activity silently
      try {
        await updateSessionActivity(data.session.user.id).catch(e => {
          console.warn("Could not update session activity:", e);
        });
      } catch (e) {
        console.warn("Error in updateSessionActivity but continuing:", e);
      }
      return true;
    }
    
    console.log("No session was returned after refresh");
    return false;
  } catch (error: any) {
    console.error("Exception in refreshAuthSession:", error?.message || error);
    return false;
  }
};

// Function to check the current auth state
export const checkAuth = async () => {
  try {
    let sessionResult;
    try {
      sessionResult = await supabase.auth.getSession();
    } catch (storageError) {
      console.error("Storage error checking auth:", storageError);
      return { isAuthenticated: false, error: "Storage access error" };
    }
    
    const { data: { session }, error } = sessionResult;
    
    if (error) {
      // Handle missing session cleanly
      if (error.message.includes('Auth session missing')) {
        console.log("No session exists to check (user not authenticated)");
        return { isAuthenticated: false };
      }
      return { isAuthenticated: false, error: error.message };
    }
    
    if (!session) {
      return { isAuthenticated: false };
    }
    
    // Update the session's last activity if authenticated - silently handle errors
    try {
      await updateSessionActivity(session.user.id).catch(() => {});
    } catch (err) {
      console.warn("Could not update session activity, but continuing");
    }
    
    return {
      isAuthenticated: true,
      user: session.user
    };
  } catch (error: any) {
    console.error("Error checking auth:", error?.message || error);
    return { isAuthenticated: false, error: error?.message || 'Unknown error' };
  }
};

// Function to get the current user ID
export const getCurrentUserId = async () => {
  try {
    let sessionResult;
    try {
      sessionResult = await supabase.auth.getSession();
    } catch (storageError) {
      console.error("Storage error getting user ID:", storageError);
      return null;
    }
    
    const { data: { session }, error } = sessionResult;
    
    // Handle missing session cleanly
    if (error && error.message.includes('Auth session missing')) {
      console.log("No session exists to get user ID (user not authenticated)");
      return null;
    }
    
    return session?.user?.id;
  } catch (error) {
    console.error("Error getting current user ID:", error);
    return null;
  }
};

// Update session activity timestamp and current page
export const updateSessionActivity = async (userId: string) => {
  try {
    if (!userId) {
      console.log("No user ID provided for session activity update");
      return false;
    }
    
    console.log("Updating session activity for user:", userId);
    
    // Try to update but don't block on failures
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          last_active_page: window.location.pathname
        })
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (error) {
        console.warn('Failed to update session activity:', error);
        return false;
      }
      
      return true;
    } catch (e) {
      console.warn('Exception in updateSessionActivity but continuing:', e);
      return false;
    }
  } catch (error) {
    console.warn('Exception in updateSessionActivity but continuing:', error);
    return false;
  }
};

// End user session
export const endUserSession = async (userId: string) => {
  try {
    if (!userId) return false;
    
    // Try to end session but don't block on failures
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          session_end: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (error) {
        console.warn('Error ending session, but continuing:', error);
        return true; // Return success to prevent blocking
      }
      
      return true;
    } catch (e) {
      console.warn('Exception in endUserSession but continuing:', e);
      return true; // Return success to prevent blocking
    }
  } catch (error) {
    console.warn('Exception in endUserSession but continuing:', error);
    return true; // Return success to prevent blocking
  }
};
