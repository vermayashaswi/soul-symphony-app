
import { supabase } from '@/integrations/supabase/client';

/**
 * Verifies that the user is authenticated
 */
export const verifyUserAuthentication = async (): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  error?: string;
}> => {
  try {
    const { data: session, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Authentication error:', error.message);
      return {
        isAuthenticated: false,
        error: error.message
      };
    }
    
    if (!session.session) {
      return {
        isAuthenticated: false,
        error: 'No active session'
      };
    }
    
    return {
      isAuthenticated: true,
      userId: session.session.user.id
    };
  } catch (error: any) {
    console.error('Error checking authentication:', error);
    return {
      isAuthenticated: false,
      error: error.message
    };
  }
};
