
// This file handles user profile management functionality separated from auth-utils.ts
import { supabase } from '@/integrations/supabase/client';

// Ensure a profile exists for the user with retry mechanism
export const ensureUserProfile = async (userId: string) => {
  try {
    if (!userId) {
      return { success: false, error: 'No user ID provided' };
    }
    
    // First check if profile exists without creating it
    try {
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (existingProfile) {
        console.log('Profile already exists for user:', userId);
        return { success: true, message: 'Profile already exists', isNew: false };
      }
      
      if (checkError && !checkError.message.includes('no rows')) {
        console.error('Error checking profile:', checkError);
      }
    } catch (checkError) {
      console.error('Error checking for existing profile:', checkError);
      // Continue with creation attempt even if check fails
    }
    
    // Try to create profile with proper service role
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ id: userId })
        .select()
        .single();
      
      if (error) {
        // If there's an RLS error, we'll try a fallback approach
        if (error.code === '42501') {
          console.log('RLS policy prevented profile creation, trying alternative approach');
          
          // Try to update if insert fails (profile might exist but wasn't found in the check)
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', userId);
            
          if (updateError) {
            console.error('Both insert and update failed:', updateError);
            return { success: false, error: 'Failed to create or update profile' };
          } else {
            console.log('Profile may have been updated successfully');
            return { success: true, isNew: false };
          }
        }
        
        console.error('Profile creation error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('New profile created successfully for user:', userId);
      return { success: true, isNew: true };
    } catch (error: any) {
      console.error('Exception in profile creation:', error);
      return { success: false, error: error?.message || 'Unknown error', isNew: false };
    }
  } catch (error: any) {
    console.error('Exception in ensureUserProfile:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error', isNew: false };
  }
};

// Create a new session or update an existing one's activity with error handling
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

// Safe storage access function that prevents crashes from storage access errors
const safeStorageAccess = (fn: () => any) => {
  try {
    return fn();
  } catch (err) {
    console.warn("Storage access error:", err);
    return null;
  }
};
