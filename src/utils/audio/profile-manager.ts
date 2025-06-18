
/**
 * Profile management utilities for audio processing
 */
import { supabase } from '@/integrations/supabase/client';
import { ensureProfileExists } from '@/services/profileService';

/**
 * Ensures that a user profile exists for the given user ID
 * Uses the improved profile service that works with the database trigger
 */
export async function ensureUserProfileExists(userId: string | undefined): Promise<boolean> {
  if (!userId) {
    console.log('[ProfileManager] No userId provided');
    return false;
  }
  
  try {
    console.log('[ProfileManager] Ensuring profile exists for user:', userId);
    
    // Get the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('[ProfileManager] Error getting user data:', userError);
      return false;
    }
    
    console.log('[ProfileManager] Got user data, calling ensureProfileExists');
    
    // Use the improved profile service
    const profileExists = await ensureProfileExists(userData.user);
    
    if (profileExists) {
      console.log('[ProfileManager] Profile exists, checking for journal entries');
      
      // Check if user has existing journal entries for state management
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
        
      const hasEntries = !entriesError && entries && entries.length > 0;
      console.log('[ProfileManager] User has previous entries:', hasEntries);
      
      // Import setHasPreviousEntries from state management
      import('./processing-state').then(({ setHasPreviousEntries }) => {
        setHasPreviousEntries(hasEntries);
      });
      
      return true;
    }
    
    console.error('[ProfileManager] Profile creation failed');
    return false;
  } catch (error) {
    console.error('[ProfileManager] Error ensuring user profile exists:', error);
    return false;
  }
}
