
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logInfo, logError, logProfile, logAuthError } from '@/components/debug/DebugPanel';

/**
 * Maximum number of automatic retries for profile creation
 */
const MAX_PROFILE_CREATION_RETRIES = 3;

/**
 * Gets the user's current timezone
 */
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    console.error('Error getting timezone:', e);
    return 'UTC';
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
  
  // Implement retry logic
  for (let attempt = 1; attempt <= MAX_PROFILE_CREATION_RETRIES; attempt++) {
    try {
      logProfile(`Attempt ${attempt}/${MAX_PROFILE_CREATION_RETRIES}: Checking if profile exists for user: ${user.id}`, 'ProfileService', {
        userEmail: user.email,
        authProvider: user.app_metadata?.provider,
        hasMetadata: !!user.user_metadata
      });
      
      // First check if the profile already exists - use maybeSingle to prevent errors if not found
      const { data, error } = await supabase
        .from('profiles')
        .select('id, timezone')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        logError(`Error checking if profile exists (attempt ${attempt}): ${error.message}`, 'ProfileService', error);
        // If not the last attempt, wait before retrying
        if (attempt < MAX_PROFILE_CREATION_RETRIES) {
          logProfile(`Waiting before retry ${attempt + 1}...`, 'ProfileService');
          await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Increasing backoff
          continue;
        }
        return false;
      }
      
      // If profile already exists, check if timezone needs to be updated
      if (data) {
        logProfile(`Profile already exists: ${data.id}`, 'ProfileService');
        
        // Update timezone if it's not set
        if (!data.timezone) {
          const timezone = getUserTimezone();
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              timezone,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
            
          if (updateError) {
            logError(`Error updating timezone: ${updateError.message}`, 'ProfileService', updateError);
          } else {
            logProfile(`Updated timezone to ${timezone}`, 'ProfileService');
          }
        }
        
        return true;
      }
      
      logProfile(`Profile not found, creating new profile (attempt ${attempt})`, 'ProfileService');
      
      // Extract user metadata - handle different metadata formats for different auth providers
      let fullName = '';
      let avatarUrl = '';
      const email = user.email || '';
      const timezone = getUserTimezone();
      
      // Log all metadata to help debug
      logProfile('User metadata received', 'ProfileService', {
        userMetadata: user.user_metadata,
        authProvider: user.app_metadata?.provider,
        timezone
      });
      
      // Handle different authentication providers' metadata formats
      if (user.app_metadata?.provider === 'google') {
        // Google specific metadata extraction
        fullName = user.user_metadata?.name || 
                  user.user_metadata?.full_name ||
                  `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
        
        avatarUrl = user.user_metadata?.picture || 
                   user.user_metadata?.avatar_url || 
                   '';
        
        logProfile('Extracted Google metadata', 'ProfileService', { fullName, avatarUrl });
      } else {
        // Default metadata extraction for email or other providers
        fullName = user.user_metadata?.full_name || 
                  user.user_metadata?.name ||
                  `${user.user_metadata?.given_name || ''} ${user.user_metadata?.family_name || ''}`.trim();
        
        avatarUrl = user.user_metadata?.avatar_url || 
                   user.user_metadata?.picture || 
                   '';
                   
        logProfile('Extracted default metadata', 'ProfileService', { fullName, avatarUrl });
      }
      
      // Explicit profile data preparation - ensure field names match exactly with the database schema
      const profileData = {
        id: user.id,
        email,
        full_name: fullName,
        avatar_url: avatarUrl, 
        timezone,
        onboarding_completed: false,
        updated_at: new Date().toISOString()
      };
      
      logProfile(`Creating profile with data (attempt ${attempt})`, 'ProfileService', profileData);
      
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
        if (upsertError.code === '23505') { // Duplicate key value violates unique constraint
          logProfile('Profile already exists (detected via constraint error)', 'ProfileService');
          return true;
        }
        
        // If not the last attempt, wait before retrying
        if (attempt < MAX_PROFILE_CREATION_RETRIES) {
          logProfile(`Waiting before retry ${attempt + 1}...`, 'ProfileService');
          await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Increasing backoff
          continue;
        }
        
        return false;
      }
      
      // Verify profile was actually created with a recheck
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (verifyError) {
        logError(`Error verifying profile creation: ${verifyError.message}`, 'ProfileService', verifyError);
      } else if (verifyData) {
        logProfile('Profile creation verified successfully', 'ProfileService');
      } else {
        logError('Profile creation could not be verified', 'ProfileService');
        // Continue with next attempt if available
        if (attempt < MAX_PROFILE_CREATION_RETRIES) {
          continue;
        }
        return false;
      }
      
      logProfile('Profile created successfully', 'ProfileService');
      return true;
    } catch (error: any) {
      logError(`Error ensuring profile exists (attempt ${attempt}): ${error.message}`, 'ProfileService', error);
      
      // If not the last attempt, wait before retrying
      if (attempt < MAX_PROFILE_CREATION_RETRIES) {
        logProfile(`Waiting before retry ${attempt + 1}...`, 'ProfileService');
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Increasing backoff
        continue;
      }
      
      return false;
    }
  }
  
  // If we get here, all retries failed
  logError(`Profile creation failed after ${MAX_PROFILE_CREATION_RETRIES} attempts`, 'ProfileService');
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
    
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    });

    if (error) {
      logError(`Error updating user metadata: ${error.message}`, 'ProfileService', error);
      throw error;
    }

    if (user.id) {
      // Prepare profile update data
      const profileUpdate: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      // Add avatar_url if present in metadata
      if (metadata.avatar_url) {
        profileUpdate.avatar_url = metadata.avatar_url;
      }
      
      // Add timezone if present in metadata
      if (metadata.timezone) {
        profileUpdate.timezone = metadata.timezone;
      }
      
      // Update profile table with new metadata
      logProfile('Updating profile table with new metadata', 'ProfileService');
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
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
 * Updates the timezone for a user profile
 * This is a dedicated function to ensure timezone is always kept updated
 */
export const updateTimezone = async (userId: string | undefined): Promise<boolean> => {
  if (!userId) return false;
  
  try {
    const timezone = getUserTimezone();
    logProfile(`Updating timezone to ${timezone} for user ${userId}`, 'ProfileService');
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        timezone, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);
      
    if (error) {
      logError(`Error updating timezone: ${error.message}`, 'ProfileService', error);
      return false;
    }
    
    logProfile(`Timezone updated successfully to ${timezone}`, 'ProfileService');
    return true;
  } catch (error: any) {
    logError(`Error updating timezone: ${error.message}`, 'ProfileService', error);
    return false;
  }
};
