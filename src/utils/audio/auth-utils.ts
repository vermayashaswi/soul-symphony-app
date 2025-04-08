
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
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { 
        isAuthenticated: false, 
        error: 'You must be signed in to save journal entries.' 
      };
    }
    
    return { isAuthenticated: true, userId: user.id };
  } catch (error: any) {
    console.error('Auth verification error:', error);
    return { 
      isAuthenticated: false, 
      error: `Authentication error: ${error.message || 'Unknown error'}`
    };
  }
}
