
import { supabase } from '@/integrations/supabase/client';
import { asId, createProfileData, asSingleRecord } from './supabase-type-utils';

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
      .eq('id', asId(userId))
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking for profile:', checkError);
    }
    
    // Return the existing profile if it exists
    if (existingProfile) {
      console.log('Profile already exists:', existingProfile.id);
      return asSingleRecord(existingProfile);
    }
    
    // Profile does not exist, create it
    console.log('Profile not found, creating one');
    
    const profileData = createProfileData({
      id: userId,
      email: userData?.email || null,
      full_name: userData?.full_name || null,
      avatar_url: userData?.avatar_url || null,
      updated_at: new Date().toISOString()
    });
    
    // Insert the profile directly
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating profile:', insertError);
      return null;
    }
    
    console.log('Profile created successfully');
    return asSingleRecord(newProfile);
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
      .eq('id', asId(userId))
      .maybeSingle();
    
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    return asSingleRecord(data);
  } catch (err) {
    console.error('Unexpected error in getUserProfile:', err);
    return null;
  }
};
