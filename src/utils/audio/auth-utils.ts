
import { supabase } from '@/integrations/supabase/client';

/**
 * Verifies user authentication status
 */
export async function verifyUserAuthentication(): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Authentication error:', authError);
      return { 
        isAuthenticated: false, 
        error: `Authentication error: ${authError.message}` 
      };
    }
    
    if (!user) {
      console.log('No authenticated user found');
      return { 
        isAuthenticated: false, 
        error: 'You must be signed in to use this feature.' 
      };
    }
    
    console.log('Authenticated user found with ID:', user.id);
    return { isAuthenticated: true, userId: user.id };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return { 
      isAuthenticated: false, 
      error: `Authentication error: ${error.message || 'Unknown error'}`
    };
  }
}

/**
 * Gets current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('Retrieved current user ID:', user.id);
      return user.id;
    }
    console.warn('No current user found');
    return null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}

/**
 * Checks if the user has any journal entries
 */
export async function checkUserHasJournalEntries(userId: string): Promise<boolean> {
  if (!userId) {
    console.error('Cannot check journal entries: No user ID provided');
    return false;
  }
  
  try {
    console.log('Checking journal entries for user:', userId);
    const { count, error } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error checking journal entries:', error);
      return false;
    }
    
    console.log(`User has ${count} journal entries`);
    return count > 0;
  } catch (error) {
    console.error('Error checking journal entries:', error);
    return false;
  }
}
