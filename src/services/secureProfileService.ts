/**
 * Secure Profile Service
 * 
 * This service provides profile operations that strictly enforce RLS policies
 * and user authentication. It replaces direct service role usage for user operations.
 */

import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { normalizeTimezone, validateTimezoneFormat } from './timezoneService';

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
 * Enhanced timezone detection with validation and normalization
 */
const detectAndValidateTimezone = (): string => {
  try {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('[secureProfileService] Detected browser timezone:', browserTimezone);
    
    // Normalize and validate the timezone
    const normalized = normalizeTimezone(browserTimezone);
    const validation = validateTimezoneFormat(normalized);
    
    if (validation.isValid) {
      console.log('[secureProfileService] Timezone validation successful:', normalized);
      return normalized;
    } else {
      console.warn('[secureProfileService] Timezone validation failed:', validation.issues);
      console.log('[secureProfileService] Falling back to UTC');
      return 'UTC';
    }
  } catch (error) {
    console.error('[secureProfileService] Timezone detection error:', error);
    return 'UTC';
  }
};

/**
 * Validates if a user's stored timezone needs updating
 */
const needsTimezoneUpdate = async (user: User): Promise<string | null> => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single();
    
    if (!profile?.timezone) return null;
    
    // Check if stored timezone is suspicious (UTC when browser isn't UTC)
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const normalizedBrowser = normalizeTimezone(browserTimezone);
    
    if (profile.timezone === 'UTC' && normalizedBrowser !== 'UTC') {
      console.log('[secureProfileService] Suspicious UTC timezone detected, suggesting update to:', normalizedBrowser);
      return normalizedBrowser;
    }
    
    // Check if stored timezone is legacy format
    const normalizedStored = normalizeTimezone(profile.timezone);
    if (normalizedStored !== profile.timezone) {
      console.log('[secureProfileService] Legacy timezone detected, suggesting update:', profile.timezone, '->', normalizedStored);
      return normalizedStored;
    }
    
    return null;
  } catch (error) {
    console.error('[secureProfileService] Timezone validation error:', error);
    return null;
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
      
      // Check if timezone needs updating for existing profiles
      const suggestedTimezone = await needsTimezoneUpdate(user);
      if (suggestedTimezone) {
        console.log('[secureProfileService] Updating timezone for existing profile:', suggestedTimezone);
        await secureUpdateProfile(user, { timezone: suggestedTimezone });
      }
      
      return true;
    }

    // Profile doesn't exist - attempt to create using RLS-enforced insert
    // Enhanced timezone detection with validation and normalization
    const detectedTimezone = detectAndValidateTimezone();
    
    const profileData = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      timezone: detectedTimezone,
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