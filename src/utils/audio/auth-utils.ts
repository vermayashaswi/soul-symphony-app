
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let refreshInProgress = false;

/**
 * Checks if the current user is authenticated
 * @param showToast Whether to show a toast message if not authenticated
 * @returns Object with authentication status and user information
 */
export async function verifyUserAuthentication(showToast = true): Promise<{
  isAuthenticated: boolean;
  user?: any;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Auth error:', error);
      if (showToast) {
        toast.error('Authentication error. Please sign in again.');
      }
      return { isAuthenticated: false, error: error.message };
    }
    
    if (!data.user) {
      if (showToast) {
        toast.error('Authentication required. Please sign in.');
      }
      return { isAuthenticated: false, error: 'No authenticated user found' };
    }
    
    return { isAuthenticated: true, user: data.user };
  } catch (error: any) {
    console.error('Error verifying authentication:', error);
    if (showToast) {
      toast.error('Authentication error. Please try again.');
    }
    return { isAuthenticated: false, error: error.message || 'Authentication check failed' };
  }
}

/**
 * Ensures that the current user has a profile
 * @param userId The ID of the user to check
 * @returns Success status and error message if applicable
 */
export async function ensureUserProfile(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!userId) {
    return { success: false, error: 'No user ID provided' };
  }
  
  try {
    // Check if profile exists
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile check error:', profileError);
      return { success: false, error: `Error checking profile: ${profileError.message}` };
    }
    
    // If profile exists, return success
    if (profileData) {
      console.log('User profile exists:', profileData.id);
      return { success: true };
    }
    
    // Profile doesn't exist, create one
    console.log('No profile found, creating profile for user:', userId);
    
    try {
      // Get user details from auth
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user data:', userError);
        return { success: false, error: `Failed to get user information: ${userError.message}` };
      }
      
      if (!userData.user) {
        return { success: false, error: 'User not found' };
      }
      
      // Extract user information
      const email = userData.user.email;
      const fullName = userData.user.user_metadata?.full_name || null;
      const avatarUrl = userData.user.user_metadata?.avatar_url || null;
      
      // Insert profile with retry logic for concurrent creation
      try {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: userId,
            email: email,
            full_name: fullName,
            avatar_url: avatarUrl,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (insertError) {
          // If duplicate key error, profile was created in another process
          if (insertError.code === '23505') {
            console.log('Profile already exists (created by another process)');
            return { success: true };
          }
          
          console.error('Failed to create profile:', insertError);
          return { success: false, error: `Failed to create profile: ${insertError.message}` };
        }
        
        console.log('Successfully created profile for user:', userId);
        return { success: true };
      } catch (insertErr: any) {
        console.error('Profile insertion error:', insertErr);
        return { success: false, error: `Profile insertion error: ${insertErr.message}` };
      }
    } catch (userDataErr: any) {
      console.error('Error getting user data:', userDataErr);
      return { success: false, error: `Error getting user data: ${userDataErr.message}` };
    }
  } catch (error: any) {
    console.error('Error in ensureUserProfile:', error);
    return { success: false, error: error.message || 'Unknown error ensuring user profile' };
  }
}

/**
 * Refreshes the auth session and updates the session state
 * @param showToast Whether to show toast messages
 * @returns Whether the refresh was successful
 */
export async function refreshAuthSession(showToast = true): Promise<boolean> {
  if (refreshInProgress) {
    console.log('Session refresh already in progress, skipping...');
    return false;
  }
  
  refreshInProgress = true;
  
  try {
    console.log('Refreshing auth session...');
    
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Session refresh error:', error);
      refreshInProgress = false;
      return false;
    }
    
    if (!data.session) {
      console.log('No session after refresh attempt');
      refreshInProgress = false;
      return false;
    }
    
    console.log('Session refreshed successfully, expires:', 
                new Date(data.session.expires_at * 1000).toISOString());
    
    // Ensure user profile exists
    if (data.user) {
      try {
        await ensureUserProfile(data.user.id);
      } catch (profileError) {
        console.error('Error ensuring profile after refresh:', profileError);
        // Continue despite profile error
      }
    }
    
    refreshInProgress = false;
    return true;
  } catch (error) {
    console.error('Error in refreshAuthSession:', error);
    refreshInProgress = false;
    return false;
  }
}
