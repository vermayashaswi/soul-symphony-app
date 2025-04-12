
/**
 * Authentication utilities for audio processing
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Verifies that the user is authenticated and returns their ID
 */
export async function verifyUserAuthentication(): Promise<{
  isAuthenticated: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Authentication error:', error.message);
      return {
        isAuthenticated: false,
        error: error.message
      };
    }
    
    if (!data.user) {
      return {
        isAuthenticated: false,
        error: 'No authenticated user found'
      };
    }
    
    return {
      isAuthenticated: true,
      userId: data.user.id
    };
  } catch (err: any) {
    console.error('Error verifying authentication:', err);
    return {
      isAuthenticated: false,
      error: err.message || 'Unknown authentication error'
    };
  }
}

/**
 * Gets the current user ID if authenticated
 */
export async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  } catch (err) {
    console.error('Error getting current user ID:', err);
    return undefined;
  }
}
