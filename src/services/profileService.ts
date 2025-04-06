
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logInfo, logError, logProfile, logAuthError } from '@/components/debug/DebugPanel';

/**
 * Ensures a profile exists for the given user
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
    
    // First check if the profile already exists - use maybeSingle to prevent errors if not found
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error && error.code !== 'PGRST116') {
      logError(`Error checking if profile exists: ${error.message}`, 'ProfileService', error);
      return false;
    }
    
    // If profile already exists, return true immediately
    if (data) {
      logProfile(`Profile already exists: ${data.id}`, 'ProfileService');
      return true;
    }
    
    logProfile('Profile not found, creating new profile', 'ProfileService');
    
    // Extract user metadata - handle different metadata formats for different auth providers
    let fullName = '';
    let avatarUrl = '';
    const email = user.email || '';
    
    // Log all metadata to help debug
    logProfile('User metadata received', 'ProfileService', {
      userMetadata: user.user_metadata,
      authProvider: user.app_metadata?.provider
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
      onboarding_completed: false,
      updated_at: new Date().toISOString()
    };
    
    logProfile('Creating profile with data', 'ProfileService', profileData);
    
    // Try upsert with explicit conflict handling
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert([profileData], { 
        onConflict: 'id',
        ignoreDuplicates: false
      });
        
    if (upsertError) {
      logError(`Error upserting profile: ${upsertError.message}`, 'ProfileService', upsertError);
      
      // If error code is for a duplicate, that means the profile actually exists
      if (upsertError.code === '23505') { // Duplicate key value violates unique constraint
        logProfile('Profile already exists (detected via constraint error)', 'ProfileService');
        return true;
      }
      
      return false;
    }
    
    logProfile('Profile created successfully', 'ProfileService');
    return true;
  } catch (error: any) {
    logError(`Error ensuring profile exists: ${error.message}`, 'ProfileService', error);
    return false;
  }
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
      // Ensure avatar_url is updated in the profiles table too
      logProfile('Updating profile table with new metadata', 'ProfileService');
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          avatar_url: metadata.avatar_url, // Ensure field name matches
          updated_at: new Date().toISOString(),
        })
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
