
import { supabase } from '@/integrations/supabase/client';

export const refreshAuthSession = async (showToasts = true) => {
  try {
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
      // Update the session's last activity
      await updateSessionActivity(data.session.user.id);
      return true;
    }
    
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
    await updateSessionActivity(session.user.id);
    
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
    await updateSessionActivity(session.user.id);
    
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
  try {
    if (!userId) return { success: false, error: 'No user ID provided' };

    // Get user agent and other client info
    const userAgent = navigator.userAgent;
    const deviceType = getDeviceType(userAgent);
    
    // Check for existing active session for this user
    const { data: existingSession, error: fetchError } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    
    if (fetchError) {
      console.error('Error checking for existing session:', fetchError);
      return { success: false, error: fetchError.message };
    }
    
    if (existingSession) {
      // Update existing session
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          last_active_page: window.location.pathname
        })
        .eq('id', existingSession.id);
      
      if (updateError) {
        console.error('Error updating session:', updateError);
        return { success: false, error: updateError.message };
      }
      
      console.log('Updated existing session:', existingSession.id);
      return { success: true, sessionId: existingSession.id, isNew: false };
    } else {
      // Create new session
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
        console.error('Error creating session:', insertError);
        // Check if it's a permissions error - this could be an auth state mismatch
        if (insertError.message.includes('permission') || insertError.message.includes('JWTClaimsSetVerificationException')) {
          console.warn('Permission error on session creation - possibly auth state mismatch');
          // Try to refresh the session and try again
          const refreshed = await refreshAuthSession(false);
          if (refreshed) {
            return createOrUpdateSession(userId, entryPage);
          }
          // Return success to avoid blocking the app
          return { success: true, isNew: false };
        }
        return { success: false, error: insertError.message };
      }
      
      console.log('Created new session:', newSession.id);
      return { success: true, sessionId: newSession.id, isNew: true };
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
    if (!userId) return false;
    
    const { data, error } = await supabase
      .from('user_sessions')
      .update({ 
        last_activity: new Date().toISOString(),
        last_active_page: window.location.pathname
      })
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception in updateSessionActivity:', error);
    return false;
  }
};

// End user session
export const endUserSession = async (userId: string) => {
  try {
    if (!userId) return false;
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ 
        is_active: false,
        session_end: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error ending session:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception in endUserSession:', error);
    return false;
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
    
    // Check if a profile already exists for this user
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    // If there's a query error that isn't just "no rows returned", report it
    if (profileError && !profileError.message.includes('no rows')) {
      console.error('Error checking for existing profile:', profileError);
      return { success: false, error: profileError.message };
    }
    
    // If profile exists, we're done!
    if (existingProfile) {
      console.log('Profile already exists for user:', userId);
      return { success: true, message: 'Profile already exists', isNew: false };
    }
    
    // Get the user data to populate the profile
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user data:', userError);
      return { success: false, error: userError.message };
    }
    
    const user = userData?.user;
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Create a new profile - we have a database trigger too, but this is a failsafe
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: user.email,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url
      })
      .select()
      .single();
    
    if (insertError) {
      // If the error is about unique violation, the profile might have been 
      // created by the database trigger, so we can consider this a success
      if (insertError.message.includes('unique constraint')) {
        console.log('Profile likely created by database trigger for user:', userId);
        return { success: true, message: 'Profile created by database trigger', isNew: true };
      }
      
      console.error('Error creating profile:', insertError);
      return { success: false, error: insertError.message };
    }
    
    console.log('New profile created successfully for user:', userId);
    return { success: true, profile: newProfile, isNew: true };
  } catch (error: any) {
    console.error('Exception in ensureUserProfile:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
};
