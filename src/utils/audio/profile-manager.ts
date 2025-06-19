
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
  if (!userId) return false;
  
  try {
    // Get the current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('Error getting user data:', userError);
      return false;
    }
    
    // Use the improved profile service
    const profileExists = await ensureProfileExists(userData.user);
    
    if (profileExists) {
      // Check if user has existing journal entries for state management
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
        
      const hasEntries = !entriesError && entries && entries.length > 0;
      console.log('User has previous entries:', hasEntries);
      
      // Import setHasPreviousEntries from state management
      import('./processing-state').then(({ setHasPreviousEntries }) => {
        setHasPreviousEntries(hasEntries);
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error ensuring user profile exists:', error);
    return false;
  }
}
