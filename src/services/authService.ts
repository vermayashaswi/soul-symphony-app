
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Gets the redirect URL for authentication that consistently works
 */
export const getRedirectUrl = (): string => {
  // Use window location origin to ensure we get the correct base URL
  const origin = window.location.origin;
  
  // Always return the /auth path for consistency
  const redirectUrl = `${origin}/auth`;
  console.log('Using auth redirect URL:', redirectUrl);
  return redirectUrl;
};

/**
 * Sign in with Google with simplified and reliable approach
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    console.log('Initiating Google sign-in from:', window.location.href);
    
    // Record login attempt time for debugging
    localStorage.setItem('loginAttemptTime', Date.now().toString());
    
    // Clear any existing auth data that might interfere
    localStorage.removeItem('supabase.auth.error');
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('supabase.auth.refreshToken');
    
    // Get the redirect URL
    const redirectUrl = getRedirectUrl();
    console.log('Using redirect URL for Google auth:', redirectUrl);
    
    // Generate a nonce and timestamp to prevent caching
    const nonce = Math.random().toString(36).substring(2, 15);
    const timestamp = Date.now().toString();
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          // Force prompt to select account to prevent automatic login with cached credentials
          prompt: 'select_account',
          // Add these to prevent caching issues
          _t: timestamp,
          nonce: nonce
        },
      },
    });

    if (error) {
      console.error('Error starting Google sign-in:', error);
      toast.error(`Error starting Google sign-in: ${error.message}`);
      throw error;
    }
    
    console.log('Google sign-in flow initiated successfully');
  } catch (error: any) {
    console.error('Failed to initiate Google sign-in:', error);
    
    // Only show toast if we're in an app route
    const currentPath = window.location.pathname;
    if (isAppRoute(currentPath)) {
      toast.error(`Google sign-in failed: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error signing in with email:', error);
    
    // Only show toast if we're in an app route
    const currentPath = window.location.pathname;
    if (isAppRoute(currentPath)) {
      toast.error(`Error signing in with email: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Sign up with email and password
 */
export const signUp = async (email: string, password: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error signing up:', error);
    
    // Only show toast if we're in an app route
    const currentPath = window.location.pathname;
    if (isAppRoute(currentPath)) {
      toast.error(`Error signing up: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Reset password
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error resetting password:', error);
    
    // Only show toast if we're in an app route
    const currentPath = window.location.pathname;
    if (isAppRoute(currentPath)) {
      toast.error(`Error resetting password: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Sign out
 * @param navigate Optional navigation function to redirect after logout
 */
export const signOut = async (navigate?: (path: string) => void): Promise<void> => {
  try {
    // Check if there's a session before trying to sign out
    const { data: sessionData } = await supabase.auth.getSession();
    
    // If no session exists, just clean up local state and redirect
    if (!sessionData?.session) {
      console.log('No active session found, cleaning up local state only');
      // Clear any auth-related items from local storage
      localStorage.removeItem('authRedirectTo');
      localStorage.removeItem('supabase.auth.error');
      localStorage.removeItem('loginAttemptTime');
      
      // Redirect to onboarding page if navigate function is provided
      if (navigate) {
        navigate('/app');
      }
      return;
    }
    
    // If session exists, proceed with normal sign out
    const { error } = await supabase.auth.signOut({
      scope: 'global' // Ensure we're fully signing out of all sessions
    });
    
    if (error) {
      throw error;
    }
    
    // Clear any auth-related items from local storage
    localStorage.removeItem('authRedirectTo');
    localStorage.removeItem('supabase.auth.error');
    localStorage.removeItem('loginAttemptTime');
    
    // Always redirect to onboarding page if navigate function is provided
    if (navigate) {
      navigate('/app');
    }
  } catch (error: any) {
    console.error('Error signing out:', error);
    
    // Still navigate to onboarding page even if there's an error
    if (navigate) {
      navigate('/app');
    }
    localStorage.removeItem('authRedirectTo');
    localStorage.removeItem('supabase.auth.error');
    localStorage.removeItem('loginAttemptTime');
    
    // Show error toast but don't prevent logout flow
    toast.error(`Error while logging out: ${error.message}`);
  }
};

/**
 * Refresh session
 */
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  } catch (error: any) {
    console.error('Error refreshing session:', error);
    throw error;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Handle PWA authentication completion
 * This is specifically for handling auth in PWA contexts where redirects can be problematic
 */
export const handlePWAAuthCompletion = async () => {
  try {
    // Check if we have a hash in the URL that might contain auth params
    if (window.location.hash || window.location.search.includes('error')) {
      console.log('Detected hash/search params, attempting to process auth result');
      
      // If there's an error in the URL, log it
      if (window.location.hash.includes('error') || window.location.search.includes('error')) {
        console.error('Error detected in redirect URL');
        
        // Get error details
        const urlParams = new URLSearchParams(window.location.search);
        const errorDescription = urlParams.get('error_description');
        
        if (errorDescription) {
          toast.error(`Authentication failed: ${errorDescription}`);
        } else {
          toast.error('Authentication failed. Please try again.');
        }
        
        return null;
      }
      
      // Clean up any stale auth errors
      localStorage.removeItem('supabase.auth.error');
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session after redirect:', error);
        toast.error('Authentication error. Please try again.');
      } else if (data.session) {
        console.log('Successfully retrieved session after redirect:', data.session.user.email);
        return data.session;
      }
    }
    return null;
  } catch (error) {
    console.error('Error handling PWA auth completion:', error);
    return null;
  }
};
