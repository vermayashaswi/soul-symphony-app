import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Gets the redirect URL for authentication
 */
export const getRedirectUrl = (): string => {
  // Use this variable to determine if we're in the production domain
  const isProdDomain = window.location.hostname === 'soulo.online' || 
                       window.location.hostname.endsWith('.soulo.online');
  
  // IMPORTANT: Always use HTTPS for production URLs to ensure secure auth
  if (isProdDomain) {
    // Always use the full HTTPS URL for production
    console.log('Using production auth redirect URL: https://soulo.online/auth');
    return `https://soulo.online/auth`;
  }
  
  // Otherwise use the current origin (for local development)
  const origin = window.location.origin;
  console.log('Using development auth redirect URL:', `${origin}/auth`);
  return `${origin}/auth`;
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    // Record login attempt time for debugging
    localStorage.setItem('loginAttemptTime', Date.now().toString());
    
    // Get the correct redirect URL based on environment
    const redirectUrl = getRedirectUrl();
    console.log('Using redirect URL for Google auth:', redirectUrl);
    
    // Clear any existing auth errors in localStorage that might be interfering
    localStorage.removeItem('supabase.auth.error');
    
    // Generate a unique nonce to prevent caching issues
    const nonce = Math.random().toString(36).substring(2, 15);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          // Add timestamp and nonce to prevent caching issues
          _t: Date.now().toString(),
          nonce: nonce
        },
      },
    });

    if (error) {
      console.error('Error in signInWithGoogle:', error);
      throw error;
    }
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    
    // Only show toast if we're in an app route
    const currentPath = window.location.pathname;
    if (isAppRoute(currentPath)) {
      toast.error(`Error signing in with Google: ${error.message}`);
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
