import { supabase } from '@/integrations/supabase/client';

/**
 * Secure user profile service that only exposes approved fields to edge functions
 */

interface SecureUserProfile {
  id: string;
  fullName: string | null;
  createdAt: string;
  reminderSettings: any;
  displayName: string | null;
  timezone: string | null;
  country: string | null;
  journalEntryCount: number;
  notificationPreferences: any;
}

/**
 * Fetches user profile with ONLY approved fields for RAG functions
 * Fields: id, full_name, created_at, reminder_settings, display_name, timezone, country, entry_count, notification_preferences
 */
export const getSecureUserProfile = async (userId: string): Promise<SecureUserProfile | null> => {
  try {
    console.log('[ProfileService] Fetching secure user profile for:', userId);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, reminder_settings, display_name, timezone, country, entry_count, notification_preferences')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('[ProfileService] Profile fetch error:', profileError);
      
      if (profileError.code === 'PGRST116') {
        console.error('[ProfileService] Profile not found for user:', userId);
        return null;
      }
      
      throw profileError;
    }
    
    if (!profile) {
      console.error('[ProfileService] No profile found for user:', userId);
      return null;
    }
    
    const secureProfile: SecureUserProfile = {
      id: profile.id,
      fullName: profile.full_name,
      createdAt: profile.created_at,
      reminderSettings: profile.reminder_settings,
      displayName: profile.display_name,
      timezone: profile.timezone,
      country: profile.country,
      journalEntryCount: profile.entry_count || 0,
      notificationPreferences: profile.notification_preferences
    };
    
    console.log('[ProfileService] Secure profile fetched successfully:', {
      userId: secureProfile.id,
      entryCount: secureProfile.journalEntryCount,
      hasTimezone: !!secureProfile.timezone,
      hasCountry: !!secureProfile.country
    });
    
    return secureProfile;
  } catch (error) {
    console.error('[ProfileService] Exception fetching profile:', error);
    return null;
  }
};

/**
 * Enhanced profile fetch with error handling and validation for chat interfaces
 */
export const getChatUserProfile = async (userId: string): Promise<any> => {
  try {
    const profile = await getSecureUserProfile(userId);
    
    if (!profile) {
      console.warn('[ProfileService] Profile not found, using defaults for user:', userId);
      return {
        id: userId,
        journalEntryCount: 0,
        timezone: 'UTC',
        country: 'DEFAULT',
        fullName: null,
        displayName: null,
        reminderSettings: {},
        notificationPreferences: {},
        createdAt: new Date().toISOString()
      };
    }
    
    return {
      id: profile.id,
      fullName: profile.fullName,
      createdAt: profile.createdAt,
      reminderSettings: profile.reminderSettings,
      displayName: profile.displayName,
      timezone: profile.timezone || 'UTC',
      country: profile.country || 'DEFAULT',
      journalEntryCount: profile.journalEntryCount,
      notificationPreferences: profile.notificationPreferences
    };
  } catch (error) {
    console.error('[ProfileService] Error in getChatUserProfile:', error);
    
    // Return safe defaults for any error
    return {
      id: userId,
      journalEntryCount: 0,
      timezone: 'UTC',
      country: 'DEFAULT',
      fullName: null,
      displayName: null,
      reminderSettings: {},
      notificationPreferences: {},
      createdAt: new Date().toISOString()
    };
  }
};

/**
 * Validates that a user profile exists and creates one if needed
 */
export const ensureUserProfileExists = async (userId: string): Promise<boolean> => {
  try {
    const profile = await getSecureUserProfile(userId);
    
    if (profile) {
      return true;
    }
    
    console.log('[ProfileService] Profile missing for user, attempting to create:', userId);
    
    // Get user data from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== userId) {
      console.error('[ProfileService] Authentication error during profile creation:', authError);
      return false;
    }
    
    // Create basic profile
    const { error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: user.email,
        full_name: user.user_metadata?.full_name || null,
        display_name: user.user_metadata?.display_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        entry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (createError) {
      console.error('[ProfileService] Failed to create profile:', createError);
      return false;
    }
    
    console.log('[ProfileService] Successfully created profile for user:', userId);
    return true;
  } catch (error) {
    console.error('[ProfileService] Exception in ensureUserProfileExists:', error);
    return false;
  }
};