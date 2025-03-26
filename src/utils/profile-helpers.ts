
import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a profile exists for a user and create one if it doesn't
 */
export const ensureUserProfile = async (userId: string, userData?: { 
  email?: string; 
  full_name?: string; 
  avatar_url?: string;
}) => {
  if (!userId) {
    console.error('No user ID provided to ensureUserProfile');
    return null;
  }
  
  try {
    console.log('Checking if profile exists for user ID:', userId);
    
    // Check if the profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId as any)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking for profile:', checkError);
    }
    
    // Return the existing profile if it exists
    if (existingProfile) {
      console.log('Profile already exists:', existingProfile.id);
      return existingProfile;
    }
    
    // Profile does not exist, create it
    console.log('Profile not found, creating one');
    
    const profileData = {
      id: userId,
      email: userData?.email || null,
      full_name: userData?.full_name || null,
      avatar_url: userData?.avatar_url || null,
      updated_at: new Date().toISOString()
    };
    
    // Use RPC to create profile to bypass type issues
    // This uses a database function to create a profile
    const { data: newProfile, error: insertError } = await supabase.rpc(
      'create_profile', 
      { 
        user_id: userId,
        user_email: profileData.email,
        user_full_name: profileData.full_name,
        user_avatar_url: profileData.avatar_url
      }
    );
    
    if (insertError) {
      console.error('Error creating profile with RPC:', insertError);
      
      // Fallback: Use direct insert with unknown type casting
      const { data: directInsert, error: directError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userData?.email,
          full_name: userData?.full_name,
          avatar_url: userData?.avatar_url
        } as any)
        .select()
        .single();
      
      if (directError) {
        console.error('Direct profile insert failed:', directError);
        return null;
      }
      
      return directInsert;
    }
    
    if (newProfile) {
      console.log('Profile created successfully via RPC');
      return { id: userId, ...profileData };
    }
    
    // If we get here, the profile creation failed
    console.error('Profile creation failed with no specific error');
    return null;
  } catch (err) {
    console.error('Error in ensureUserProfile:', err);
    return null;
  }
};

/**
 * Safely get a user's profile
 */
export const getUserProfile = async (userId: string) => {
  if (!userId) return null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId as any)
      .maybeSingle();
    
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Unexpected error in getUserProfile:', err);
    return null;
  }
};
