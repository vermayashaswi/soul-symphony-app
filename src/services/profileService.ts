
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logInfo, logError, logProfile, logAuthError } from '@/components/debug/DebugPanel';
import { enhancedLocationService } from '@/services/enhanced-location-service';

/**
 * Maximum number of automatic retries for profile creation
 */
const MAX_PROFILE_CREATION_RETRIES = 3;

/**
 * Get user's timezone using browser API
 */
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error detecting timezone:', error);
    return 'UTC'; // Default fallback
  }
};

/**
 * Ensures a profile exists for the given user with automatic retries
 * Uses authenticated Supabase client with RLS enforcement
 */
export const ensureProfileExists = async (user: User | null): Promise<boolean> => {
  if (!user) {
    logError('Cannot create profile: No user provided', 'ProfileService');
    return false;
  }
  
  try {
    logProfile(`Checking if profile exists for user: ${user.id}`, 'ProfileService', {
      userEmail: user.email,
      authProvider: user.app_metadata?.provider,
      hasMetadata: !!user.user_metadata
    });
    
    // First check if the profile already exists
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, timezone, subscription_status, subscription_tier, is_premium, trial_ends_at, tutorial_completed, tutorial_step, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      logError(`Error checking if profile exists: ${error.message}`, 'ProfileService', error);
      return false;
    }
    
    // If profile exists, check if we need to update any missing fields
    if (data) {
      logProfile(`Profile exists: ${data.id}`, 'ProfileService', {
        tutorialCompleted: data.tutorial_completed,
        tutorialStep: data.tutorial_step,
        onboardingCompleted: data.onboarding_completed
      });
      
      // Check if we need to update any missing fields including tutorial setup
      const needsUpdate = (!data.timezone && getUserTimezone() !== 'UTC') || 
                         (!data.full_name && user.user_metadata?.full_name) ||
                         (!data.avatar_url && user.user_metadata?.avatar_url) ||
                         (data.tutorial_completed === null || data.tutorial_completed === undefined) ||
                         (data.tutorial_step === null || data.tutorial_step === undefined) ||
                         (data.onboarding_completed === null || data.onboarding_completed === undefined);
      
      if (needsUpdate) {
        logProfile('Profile exists but needs updates', 'ProfileService');
        await updateMissingProfileFields(user.id, user);
      }
      
      return true;
    }
    
    // If no profile exists, create one manually (trigger should handle this, but fallback)
    logProfile('Profile not found, creating manually with trigger handling', 'ProfileService');
    const profileCreated = await createProfileManually(user);
    
    // If profile creation succeeded, ensure trial is set up (fallback for trigger)
    if (profileCreated) {
      // Small delay to let trigger complete first
      setTimeout(async () => {
        try {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('subscription_status, subscription_tier, trial_ends_at')
            .eq('id', user.id)
            .single();
            
          // If trial isn't set up, manually set it up as fallback
          if (currentProfile && (!currentProfile.subscription_status || currentProfile.subscription_status === 'free')) {
            logProfile('Trial not set up by trigger, setting up manually as fallback', 'ProfileService');
            await startUserTrial(user.id);
          }
        } catch (err) {
          logError('Error in trial setup fallback', 'ProfileService', err);
        }
      }, 1000);
    }
    
    return profileCreated;
    
  } catch (err) {
    console.error('[ProfileService] Error in ensureProfileExists:', err);
    logError(`Error in ensureProfileExists: ${err}`, 'ProfileService', err);
    return false;
  }
};

/**
 * Updates missing fields in an existing profile
 */
const updateMissingProfileFields = async (userId: string, user: User): Promise<boolean> => {
  try {
    // Detect location data (timezone and country) using enhanced service
    const locationData = await enhancedLocationService.detectUserLocation();
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Add timezone and country from enhanced location detection
    if (locationData.timezone !== 'UTC') {
      updateData.timezone = locationData.timezone;
      logProfile(`Setting timezone from enhanced detection: ${locationData.timezone}`, 'ProfileService');
    }
    
    if (locationData.country && locationData.country !== 'DEFAULT') {
      updateData.country = locationData.country;
      logProfile(`Setting country from enhanced detection: ${locationData.country}`, 'ProfileService');
    }
    
    // Add full_name if available and missing
    if (user.user_metadata?.full_name) {
      updateData.full_name = user.user_metadata.full_name;
    } else if (user.user_metadata?.name) {
      updateData.full_name = user.user_metadata.name;
    }
    
    // Add avatar_url if available and missing
    if (user.user_metadata?.avatar_url) {
      updateData.avatar_url = user.user_metadata.avatar_url;
    } else if (user.user_metadata?.picture) {
      updateData.avatar_url = user.user_metadata.picture;
    }
    
    // Ensure tutorial fields are properly set for existing users
    updateData.tutorial_completed = 'NO';
    updateData.tutorial_step = 0;
    updateData.onboarding_completed = false;
    
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);
      
    if (error) {
      logError(`Error updating profile fields: ${error.message}`, 'ProfileService', error);
      return false;
    }
    
    logProfile('Profile fields updated successfully', 'ProfileService', updateData);
    return true;
  } catch (error: any) {
    logError(`Error in updateMissingProfileFields: ${error.message}`, 'ProfileService', error);
    return false;
  }
};

/**
 * Manually creates a profile as fallback when the trigger fails
 */
const createProfileManually = async (user: User): Promise<boolean> => {
  // Implement retry logic
  for (let attempt = 1; attempt <= MAX_PROFILE_CREATION_RETRIES; attempt++) {
    try {
      logProfile(`Manual profile creation attempt ${attempt}/${MAX_PROFILE_CREATION_RETRIES}`, 'ProfileService');
      
      // Extract user metadata - handle different metadata formats for different auth providers
      let fullName = '';
      let avatarUrl = '';
      const email = user.email || '';
      
      // Detect location data (timezone and country) using enhanced service
      const locationData = await enhancedLocationService.detectUserLocation();
      logProfile(`Enhanced location detection for new profile: timezone=${locationData.timezone}, country=${locationData.country}`, 'ProfileService');
      
      // Handle different authentication providers' metadata formats
      if (user.app_metadata?.provider === 'google') {
        // Google specific metadata extraction
        fullName = user.user_metadata?.name || 
                  user.user_metadata?.full_name ||
                  `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
        
        avatarUrl = user.user_metadata?.picture || 
                   user.user_metadata?.avatar_url || 
                   '';
      } else {
        // Default metadata extraction for email or other providers
        fullName = user.user_metadata?.full_name || 
                  user.user_metadata?.name ||
                  `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
        
        avatarUrl = user.user_metadata?.avatar_url || 
                   user.user_metadata?.picture || 
                   '';
      }
      
      // Profile data preparation - let the auto_start_trial trigger handle subscription setup
      const profileData = {
        id: user.id,
        email,
        full_name: fullName || null,
        avatar_url: avatarUrl || null, 
        timezone: locationData.timezone,
        country: locationData.country !== 'DEFAULT' ? locationData.country : null,
        onboarding_completed: false,
        updated_at: new Date().toISOString()
      };
      
      logProfile(`Creating profile manually with data (attempt ${attempt})`, 'ProfileService', profileData);
      
      // Try upsert with explicit conflict handling
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert([profileData], { 
          onConflict: 'id',
          ignoreDuplicates: false
        });
          
      if (upsertError) {
        logError(`Error upserting profile (attempt ${attempt}): ${upsertError.message}`, 'ProfileService', upsertError);
        
        // If error code is for a duplicate, that means the profile actually exists
        if (upsertError.code === '23505') {
          logProfile('Profile already exists (detected via constraint error)', 'ProfileService');
          return true;
        }
        
        // If not the last attempt, wait before retrying
        if (attempt < MAX_PROFILE_CREATION_RETRIES) {
          logProfile(`Waiting before retry ${attempt + 1}...`, 'ProfileService');
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          continue;
        }
        
        return false;
      }
      
      logProfile('Profile created successfully', 'ProfileService');
      return true;
    } catch (error: any) {
      logError(`Error in manual profile creation (attempt ${attempt}): ${error.message}`, 'ProfileService', error);
      
      // If not the last attempt, wait before retrying
      if (attempt < MAX_PROFILE_CREATION_RETRIES) {
        logProfile(`Waiting before retry ${attempt + 1}...`, 'ProfileService');
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }
      
      return false;
    }
  }
  
  // If we get here, all retries failed
  logError(`Manual profile creation failed after ${MAX_PROFILE_CREATION_RETRIES} attempts`, 'ProfileService');
  return false;
};

/**
 * Updates the user profile metadata
 */
export const updateUserProfile = async (user: User | null, metadata: Record<string, any>): Promise<boolean> => {
  if (!user) return false;
  
  try {
    logProfile('Updating user metadata', 'ProfileService', {
      userId: user.id,
      metadataKeys: Object.keys(metadata)
    });
    
    // Add timezone to metadata if not provided
    if (!metadata.timezone) {
      metadata.timezone = getUserTimezone();
      logProfile(`Adding detected timezone to metadata: ${metadata.timezone}`, 'ProfileService');
    }
    
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) {
      logError(`Error updating user metadata: ${error.message}`, 'ProfileService', error);
      throw error;
    }

    if (user.id) {
      // Ensure avatar_url is updated in the profiles table too
      logProfile('Updating profile table with new metadata', 'ProfileService');
      
      const updateData = {
        updated_at: new Date().toISOString()
      } as any;
      
      // Only add fields that are provided
      if (metadata.avatar_url) updateData.avatar_url = metadata.avatar_url;
      if (metadata.timezone) updateData.timezone = metadata.timezone;
      if (metadata.display_name) updateData.display_name = metadata.display_name;
        
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
        
      if (profileError) {
        logError(`Error updating profile table: ${profileError.message}`, 'ProfileService', profileError);
      }
    }

    logProfile('User profile updated successfully', 'ProfileService');
    return true;
  } catch (error: any) {
    logError(`Error updating profile: ${error.message}`, 'ProfileService', error);
    return false;
  }
};

/**
 * Starts a trial for a user (if eligible)
 */
export const startUserTrial = async (userId: string): Promise<boolean> => {
  try {
    logProfile('Starting trial for user', 'ProfileService', { userId });
    
    // Check eligibility first
    const { data: isEligible, error: eligibilityError } = await supabase
      .rpc('is_trial_eligible', {
        user_id_param: userId
      });

    if (eligibilityError) {
      logError(`Error checking trial eligibility: ${eligibilityError.message}`, 'ProfileService', eligibilityError);
      return false;
    }

    if (!isEligible) {
      logProfile('User is not eligible for trial', 'ProfileService');
      return false;
    }

    // Start the trial - Updated to use 14 days instead of 7
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // Changed from 7 to 14 days

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'trial',
        subscription_tier: 'premium', // Set to premium during trial
        is_premium: true,
        trial_ends_at: trialEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      logError(`Error starting trial: ${updateError.message}`, 'ProfileService', updateError);
      return false;
    }

    logProfile('Trial started successfully', 'ProfileService', {
      userId,
      trialEndDate: trialEndDate.toISOString()
    });
    
    return true;
  } catch (error: any) {
    logError(`Error in startUserTrial: ${error.message}`, 'ProfileService', error);
    return false;
  }
};
