
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logInfo, logError, logProfile, logAuthError } from '@/components/debug/DebugPanel';

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
      .select('id, full_name, avatar_url, timezone, subscription_status, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      logError(`Error checking if profile exists: ${error.message}`, 'ProfileService', error);
      return false;
    }
    
    // If profile exists, check if we need to update any missing fields
    if (data) {
      logProfile(`Profile exists: ${data.id}`, 'ProfileService');
      
      // Check if we need to update any missing fields
      const needsUpdate = (!data.timezone && getUserTimezone() !== 'UTC') || 
                         (!data.full_name && user.user_metadata?.full_name) ||
                         (!data.avatar_url && user.user_metadata?.avatar_url);
      
      if (needsUpdate) {
        logProfile('Profile exists but needs updates', 'ProfileService');
        await updateMissingProfileFields(user.id, user);
      }
      
      // The auto_start_trial trigger should have handled trial setup automatically
      // No need to manually set trial status here
      
      return true;
    }
    
    // If no profile exists, this should not happen with the trigger in place
    // But as a fallback, let's create one manually
    logProfile('Profile not found, creating manually as fallback', 'ProfileService');
    return await createProfileManually(user);
    
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
    const timezone = getUserTimezone();
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Add timezone if missing
    if (timezone !== 'UTC') {
      updateData.timezone = timezone;
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
      const timezone = getUserTimezone();
      
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
        timezone: timezone,
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

    // Start the trial
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 days from now

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_status: 'trial',
        subscription_tier: 'free',
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
