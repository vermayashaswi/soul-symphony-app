
import { supabase } from '@/integrations/supabase/client';

export const refreshAuthSession = async (showToasts = true) => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error("Error refreshing session:", error.message);
      return false;
    }
    
    return !!data.session;
  } catch (error) {
    console.error("Exception in refreshAuthSession:", error);
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
    
    return {
      isAuthenticated: true,
      user: session.user
    };
  } catch (error) {
    console.error("Error checking auth:", error);
    return { isAuthenticated: false, error: error.message };
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
  } catch (error) {
    console.error('Exception in ensureUserProfile:', error);
    return { success: false, error: error.message };
  }
};
