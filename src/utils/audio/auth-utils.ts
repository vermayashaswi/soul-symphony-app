import { supabase } from '@/integrations/supabase/client';

// Safe storage access function that prevents crashes from storage access errors
const safeStorageAccess = (fn) => {
  try {
    return fn();
  } catch (err) {
    console.warn("Storage access error:", err);
    return null;
  }
};

// Simple exponential backoff retry mechanism
const retry = async (fn, maxRetries = 3, delay = 300) => {
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

export const refreshAuthSession = async (showToasts = false) => {
  try {
    console.log("Starting session refresh");
    
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

// Function to get the current auth state
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
    
    const { data: { session } } = sessionResult;
    return session?.user?.id;
  } catch (error) {
    console.error("Error getting current user ID:", error);
    return null;
  }
};

// Verify if the user is authenticated
export const verifyUserAuthentication = async (showToasts = true) => {
  try {
    let sessionResult;
    try {
      sessionResult = await supabase.auth.getSession();
    } catch (storageError) {
      console.error("Storage error verifying authentication:", storageError);
      return { isAuthenticated: false, error: "Storage access error" };
    }
    
    const { data: { session }, error } = sessionResult;
    
    if (error) {
      console.error("Error verifying authentication:", error.message);
      return { isAuthenticated: false, error: error.message };
    }
    
    if (!session) {
      return { isAuthenticated: false };
    }
    
    // Update the session's last activity if authenticated
    try {
      await updateSessionActivity(session.user.id);
    } catch (err) {
      console.warn("Could not update session activity, but continuing:", err);
    }
    
    return {
      isAuthenticated: true,
      user: session.user
    };
  } catch (error: any) {
    console.error("Exception in verifyUserAuthentication:", error?.message || error);
    return { isAuthenticated: false, error: error?.message || 'Unknown error' };
  }
};

// Create a new session or update an existing one's activity
export const createOrUpdateSession = async (userId: string, entryPage = '/') => {
  if (!userId) return { success: false, error: 'No user ID provided' };
  
  try {
    // Get user agent and other client info
    const userAgent = navigator.userAgent;
    const deviceType = getDeviceType(userAgent);
    
    // Check for existing active session for this user - handle errors silently
    const checkExistingSession = async () => {
      try {
        const { data, error } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
          
        if (error) throw error;
        return data;
      } catch (e) {
        // If there's an error querying for the session, just create a new one
        console.warn("Error checking for existing session:", e);
        return null;
      }
    };
    
    // Try to get existing session but don't block on failures
    let existingSession;
    try {
      existingSession = await checkExistingSession();
    } catch (error) {
      console.error('Error checking for existing session:', error);
      // Return success to prevent blocking the app
      return { success: true, isNew: false, error: 'Session check failed' };
    }
    
    if (existingSession) {
      // Update existing session but don't block on it
      try {
        await supabase
          .from('user_sessions')
          .update({ 
            last_activity: new Date().toISOString(),
            last_active_page: window.location.pathname
          })
          .eq('id', existingSession.id);
        
        console.log('Updated existing session:', existingSession.id);
      } catch (updateError) {
        console.error('Error updating session, but continuing:', updateError);
      }
      
      return { success: true, sessionId: existingSession.id, isNew: false };
    } else {
      // Try to create new session but don't block on failures
      try {
        const { data: newSession, error: insertError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            ip_address: '', // Can't reliably get client IP from browser
            user_agent: userAgent,
            device_type: deviceType,
            entry_page: entryPage,
            last_active_page: entryPage,
            referrer: safeStorageAccess(() => document.referrer) || ''
          })
          .select()
          .single();
        
        if (insertError) {
          console.warn('Session creation error but continuing:', insertError.message);
          return { success: true, isNew: false }; // Don't block the app
        }
        
        console.log('Created new session:', newSession.id);
        return { success: true, sessionId: newSession.id, isNew: true };
      } catch (insertCatchError: any) {
        console.warn('Exception in session creation but continuing:', insertCatchError);
        return { success: true, isNew: false }; // Don't block the app
      }
    }
  } catch (error: any) {
    console.error('Exception in createOrUpdateSession:', error?.message || error);
    // Don't block the app flow on session tracking errors
    return { success: true, error: error?.message, isNew: false };
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

// Helper function to determine device type from user agent
const getDeviceType = (userAgent: string): string => {
  if (/mobile|android|iphone|ipad|ipod/i.test(userAgent.toLowerCase())) {
    return 'mobile';
  } else if (/tablet|ipad/i.test(userAgent.toLowerCase())) {
    return 'tablet';
  } else {
    return 'desktop';
  }
};

// Ensure a profile exists for the user
export const ensureUserProfile = async (userId: string) => {
  try {
    if (!userId) {
      return { success: false, error: 'No user ID provided' };
    }
    
    // First quickly check if profile exists without creating it
    let existingProfile = null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (!error || (error && !error.message.includes('no rows'))) {
        existingProfile = data;
      }
    } catch (checkError) {
      console.error('Error checking for existing profile:', checkError);
      // Continue with creation attempt even if check fails
    }
    
    // If profile exists, we're done!
    if (existingProfile) {
      console.log('Profile already exists for user:', userId);
      return { success: true, message: 'Profile already exists', isNew: false };
    }
    
    // Silently handle profile creation errors
    try {
      // Directly try to create profile
      const { error } = await supabase
        .from('profiles')
        .insert({ id: userId })
        .select()
        .single();
      
      if (!error) {
        console.log('New profile created successfully for user:', userId);
        return { success: true, isNew: true };
      }
      
      // Even if there was an error, the profile might exist due to a race condition 
      // or database trigger - so return success
      return { success: true, message: 'Profile may have been created', isNew: false };
    } catch (error: any) {
      console.error('Exception in profile creation:', error);
      // Return success anyway to avoid blocking app
      return { success: true, error: error?.message || 'Unknown error', isNew: false };
    }
  } catch (error: any) {
    console.error('Exception in ensureUserProfile:', error?.message || error);
    // Return success anyway to avoid blocking app
    return { success: true, error: error?.message || 'Unknown error', isNew: false };
  }
};
