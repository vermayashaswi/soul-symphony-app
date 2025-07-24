import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { authDebugService } from './authDebugService';

/**
 * Utility function for timezone detection
 */
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    authDebugService.logWarning('Failed to detect timezone, using UTC', 'ProfileService', error);
    return 'UTC';
  }
};

/**
 * Enhanced profile creation with multiple fallback mechanisms for native apps
 */
export const ensureProfileExistsEnhanced = async (user: User | null): Promise<boolean> => {
  if (!user?.id) {
    authDebugService.logProfileError('No user provided to ensureProfileExists', 'ProfileService');
    return false;
  }

  authDebugService.logProfile('Starting enhanced profile existence check', 'ProfileService', { 
    userId: user.id,
    isNative: window.location.href.includes('capacitor://'),
    userMetadata: user.user_metadata
  });

  try {
    // Step 1: Check if profile already exists
    authDebugService.logProfile('Checking existing profile', 'ProfileService');
    
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, subscription_status, trial_ends_at, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      authDebugService.logProfileError('Error fetching existing profile', 'ProfileService', fetchError);
      // Continue with creation attempt
    }

    if (existingProfile) {
      authDebugService.logProfile('Profile already exists', 'ProfileService', existingProfile);
      return true;
    }

    // Step 2: Try enhanced direct insertion with better error handling
    authDebugService.logProfile('Using enhanced direct insertion method', 'ProfileService');

    // Step 3: Try direct insertion with manual retry logic
    authDebugService.logProfile('Attempting direct profile insertion', 'ProfileService');
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        authDebugService.logProfile(`Direct insertion attempt ${attempt}/${maxRetries}`, 'ProfileService');
        
        const profileData = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          timezone: getUserTimezone(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        if (!insertError && insertedProfile) {
          authDebugService.logProfile('Profile created via direct insertion', 'ProfileService', insertedProfile);
          
          // Try to manually set up trial
          try {
            await setupTrialEnhanced(user.id);
          } catch (trialError) {
            authDebugService.logWarning('Manual trial setup failed after direct insertion', 'ProfileService', trialError);
          }
          
          return true;
        } else {
          authDebugService.logProfileError(`Direct insertion attempt ${attempt} failed`, 'ProfileService', insertError);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      } catch (directError) {
        authDebugService.logProfileError(`Direct insertion attempt ${attempt} threw error`, 'ProfileService', directError);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // Step 4: Final verification - check if profile was created by trigger despite errors
    authDebugService.logProfile('Performing final profile verification', 'ProfileService');
    
    const { data: finalCheck, error: finalCheckError } = await supabase
      .from('profiles')
      .select('id, subscription_status')
      .eq('id', user.id)
      .maybeSingle();
      
    if (!finalCheckError && finalCheck) {
      authDebugService.logProfile('Profile found in final verification (created by trigger)', 'ProfileService', finalCheck);
      return true;
    }

    authDebugService.logProfileError('All profile creation methods failed', 'ProfileService', {
      finalCheckError,
      userId: user.id
    });
    
    return false;

  } catch (error) {
    authDebugService.logProfileError('Unexpected error in ensureProfileExists', 'ProfileService', error);
    return false;
  }
};

/**
 * Enhanced trial setup with multiple fallback mechanisms
 */
export const setupTrialEnhanced = async (userId: string): Promise<boolean> => {
  try {
    authDebugService.logProfile('Starting enhanced trial setup', 'ProfileService', { userId });

    // Use direct update approach for now (can be enhanced with RPC when types are available)
    authDebugService.logProfile('Using direct trial setup method', 'ProfileService');

    // Fallback to direct profile update
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        trial_ends_at: trialEndDate.toISOString(),
        subscription_status: 'trial',
        subscription_tier: 'premium',
        is_premium: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('trial_ends_at, subscription_status')
      .single();

    if (error) {
      authDebugService.logProfileError('Failed to start trial via direct update', 'ProfileService', error);
      return false;
    }

    authDebugService.logProfile('Trial started successfully via direct update', 'ProfileService', data);
    return true;

  } catch (error) {
    authDebugService.logProfileError('Unexpected error in setupTrialEnhanced', 'ProfileService', error);
    return false;
  }
};