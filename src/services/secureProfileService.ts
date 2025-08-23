/**
 * Secure Profile Service
 * 
 * This service provides profile operations that strictly enforce RLS policies
 * and user authentication. It replaces direct service role usage for user operations.
 */

import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Validates that the current user is authenticated and authorized
 */
const validateUserAccess = (user: User | null, requiredUserId?: string): void => {
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (requiredUserId && user.id !== requiredUserId) {
    throw new Error('Unauthorized access to user data');
  }
};

/**
 * Securely creates or updates user profile using RLS-enforced operations
 */
export const secureEnsureProfile = async (user: User | null): Promise<boolean> => {
  validateUserAccess(user);
  
  if (!user) return false;

  try {
    // Check if profile exists using RLS-enforced query
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id, timezone, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Profile check error:', checkError);
      return false;
    }

    if (existingProfile) {
      console.log('Profile exists for authenticated user');
      return true;
    }

    // Profile doesn't exist - attempt to create using RLS-enforced insert
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    const profileData = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      timezone,
      onboarding_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('profiles')
      .insert([profileData]);

    if (insertError) {
      // Check if error is due to profile already existing (race condition)
      if (insertError.code === '23505') {
        console.log('Profile already exists (race condition handled)');
        return true;
      }
      
      console.error('Profile creation error:', insertError);
      return false;
    }

    console.log('Profile created successfully for authenticated user');
    return true;
  } catch (error) {
    console.error('Secure profile ensure error:', error);
    return false;
  }
};

/**
 * Securely updates user profile using RLS-enforced operations
 */
export const secureUpdateProfile = async (
  user: User | null, 
  updates: Record<string, any>
): Promise<boolean> => {
  validateUserAccess(user);
  
  if (!user) return false;

  try {
    // RLS policies ensure user can only update their own profile
    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('Secure profile update error:', error);
      return false;
    }

    console.log('Profile updated successfully for authenticated user');
    return true;
  } catch (error) {
    console.error('Secure profile update error:', error);
    return false;
  }
};

/**
 * Securely fetches user profile using RLS-enforced operations
 */
export const secureGetProfile = async (user: User | null): Promise<any | null> => {
  validateUserAccess(user);
  
  if (!user) return null;

  try {
    // RLS policies ensure user can only access their own profile
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Secure profile fetch error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Secure profile fetch error:', error);
    return null;
  }
};

/**
 * Securely starts user trial using RLS-enforced operations
 */
export const secureStartTrial = async (user: User | null): Promise<boolean> => {
  validateUserAccess(user);
  
  if (!user) return false;

  try {
    // Set trial period to 14 days from now
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    // RLS policies ensure user can only update their own profile
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'trial',
        subscription_tier: 'premium',
        is_premium: true,
        trial_ends_at: trialEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('Secure trial start error:', error);
      return false;
    }

    console.log('Trial started successfully for authenticated user');
    return true;
  } catch (error) {
    console.error('Secure trial start error:', error);
    return false;
  }
};