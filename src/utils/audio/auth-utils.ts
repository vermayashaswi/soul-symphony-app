
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Verifies that the user is authenticated
 */
export async function verifyUserAuthentication() {
  try {
    console.log("Verifying user authentication...");
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth session error:', error);
      return { 
        isAuthenticated: false, 
        error: `Authentication error: ${error.message}` 
      };
    }
    
    if (!data.session) {
      console.error('No session found');
      return { isAuthenticated: false, error: 'User is not authenticated' };
    }
    
    console.log("User authenticated:", data.session.user.id);
    return { isAuthenticated: true, userId: data.session.user.id };
  } catch (error: any) {
    console.error('Unexpected authentication error:', error);
    return { 
      isAuthenticated: false, 
      error: `Unexpected authentication error: ${error.message}` 
    };
  }
}

/**
 * Gets the current user ID from the session
 * Returns undefined if no user is authenticated
 */
export async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error || !data.session) {
      console.error('Error getting user ID:', error);
      return undefined;
    }
    
    return data.session.user.id;
  } catch (error: any) {
    console.error('Unexpected error getting user ID:', error);
    return undefined;
  }
}
