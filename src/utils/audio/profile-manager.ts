
/**
 * Profile management utilities for audio processing
 */
import { supabase } from '@/integrations/supabase/client';
import { ensureWelcomeEntry } from '@/services/journalService';

/**
 * Ensures that a user profile exists for the given user ID
 * Creates one if it doesn't exist
 */
export async function ensureUserProfileExists(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  
  try {
    // Check if user profile exists
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, onboarding_completed')
      .eq('id', userId)
      .single();
      
    // Check if user has existing journal entries
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, entry_type')
      .eq('user_id', userId)
      .eq('entry_type', 'regular')
      .limit(1);
      
    const hasRegularEntries = !entriesError && entries && entries.length > 0;
    console.log('User has previous regular entries:', hasRegularEntries);
    
    // Import setHasPreviousEntries from state management
    import('./processing-state').then(({ setHasPreviousEntries }) => {
      setHasPreviousEntries(hasRegularEntries);
    });
      
    // If profile doesn't exist, create one
    if (fetchError || !profile) {
      console.log('User profile not found, creating one...');
      
      // Get user data from auth
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      
      // Create profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{ 
          id: userId,
          email: userData.user?.email,
          full_name: userData.user?.user_metadata?.full_name || '',
          avatar_url: userData.user?.user_metadata?.avatar_url || '',
          onboarding_completed: false
        }]);
        
      if (insertError) {
        console.error('Error creating user profile:', insertError);
        throw insertError;
      }
      
      console.log('User profile created successfully');
      
      // Create welcome entry for new user
      await ensureWelcomeEntry(userId);
    } else {
      console.log('Profile exists:', profile.id);
      
      // Ensure welcome entry exists if user has no regular entries
      if (!hasRegularEntries) {
        await ensureWelcomeEntry(userId);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring user profile exists:', error);
    return false;
  }
}
