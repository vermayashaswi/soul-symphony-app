
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
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
}
