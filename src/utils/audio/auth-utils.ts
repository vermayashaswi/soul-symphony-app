
import { supabase } from '@/integrations/supabase/client';

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

export const refreshAuthSession = async (showToasts = true) => {
  try {
    console.log("Starting session refresh");
    const { data, error } = await supabase.auth.refreshSession();
    
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
      // Update the session's last activity
      await updateSessionActivity(data.session.user.id);
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
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
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
    console.error("Error checking auth:", error?.message || error);
    return { isAuthenticated: false, error: error?.message || 'Unknown error' };
  }
};

// Function to get the current user ID
export const getCurrentUserId = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  } catch (error) {
    console.error("Error getting current user ID:", error);
    return null;
  }
};

// Verify if the user is authenticated
export const verifyUserAuthentication = async (showToasts = true) => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
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
    
    // Check for existing active session for this user
    const checkExistingSession = async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    };
    
    const existingSession = await retry(checkExistingSession).catch(error => {
      console.error('Error checking for existing session:', error);
      // Return a fake "success" to prevent blocking the app
      return null;
    });
    
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
            referrer: document.referrer || ''
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
    
    // Wrap the update in a retry function but don't block on failures
    const updateOperation = async () => {
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          last_active_page: window.location.pathname
        })
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (error) throw error;
      return true;
    };
    
    // Use retry but don't throw if all retries fail
    await retry(updateOperation).catch(error => {
      console.warn('Failed to update session activity after retries:', error);
      return false;
    });
    
    return true;
  } catch (error) {
    console.warn('Exception in updateSessionActivity but continuing:', error);
    return false;
  }
};

// End user session
export const endUserSession = async (userId: string) => {
  try {
    if (!userId) return false;
    
    const endSessionOperation = async () => {
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          session_end: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (error) throw error;
      return true;
    };
    
    // Use retry but don't block on failures
    return await retry(endSessionOperation).catch(error => {
      console.warn('Error ending session after retries, but continuing:', error);
      return true; // Return success to prevent blocking
    });
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
    const checkProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (error && !error.message.includes('no rows')) throw error;
      return data;
    };
    
    // Use retry for the profile check
    const existingProfile = await retry(checkProfile).catch(checkError => {
      console.error('Error checking for existing profile:', checkError);
      return null; // Continue with creation attempt even if check fails
    });
    
    // If profile exists, we're done!
    if (existingProfile) {
      console.log('Profile already exists for user:', userId);
      return { success: true, message: 'Profile already exists', isNew: false };
    }
    
    // Get the user data to populate the profile
    const getUserData = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data;
    };
    
    const userData = await retry(getUserData).catch(userError => {
      console.error('Error getting user data:', userError);
      return null;
    });
    
    if (!userData?.user) {
      return { success: false, error: 'User not found' };
    }
    
    // Don't block the app if profile creation fails
    try {
      const createProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userData.user.email,
            full_name: userData.user.user_metadata?.full_name,
            avatar_url: userData.user.user_metadata?.avatar_url
          })
          .select()
          .single();
          
        if (error) throw error;
        return data;
      };
      
      const newProfile = await retry(createProfile).catch(insertError => {
        // If error is due to unique constraint or RLS, the profile might already exist
        if (insertError.message && (
            insertError.message.includes('unique constraint') || 
            insertError.message.includes('violates row-level security policy')
        )) {
          console.log('Profile likely created by database trigger for user:', userId);
          return { success: true, message: 'Profile exists (created by trigger)', isNew: false };
        }
        
        console.error('Error creating profile after retries:', insertError);
        throw insertError;
      });
      
      if (newProfile) {
        console.log('New profile created successfully for user:', userId);
        return { success: true, profile: newProfile, isNew: true };
      } else {
        // Double check if profile exists despite issues
        const confirmProfile = await retry(() => 
          supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
        ).catch(() => ({ data: null }));
        
        if (confirmProfile.data) {
          return { success: true, message: 'Profile exists (confirmed check)', isNew: false };
        } else {
          return { success: false, error: 'Failed to create profile', isNonCritical: true };
        }
      }
    } catch (error: any) {
      console.error('Exception in profile creation:', error);
      // Mark as non-critical to prevent blocking the app
      return { success: false, error: error?.message || 'Unknown error', isNonCritical: true };
    }
  } catch (error: any) {
    console.error('Exception in ensureUserProfile:', error?.message || error);
    // Mark as non-critical to prevent blocking the app
    return { success: false, error: error?.message || 'Unknown error', isNonCritical: true };
  }
};
