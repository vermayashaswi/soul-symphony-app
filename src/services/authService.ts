import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Gets the redirect URL for authentication
 */
export const getRedirectUrl = (): string => {
  const origin = window.location.origin;
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get('redirectTo');
  if (redirectTo) {
    localStorage.setItem('authRedirectTo', redirectTo);
  }
  
  // For iOS in standalone mode (PWA), we need to handle redirects differently
  // Check for standalone mode in a type-safe way
  const isInStandaloneMode = () => {
    // Check for display-mode: standalone media query (PWA)
    const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches;
    
    // Check for navigator.standalone (iOS Safari)
    // @ts-ignore - This is valid on iOS Safari but not in the TypeScript types
    const iosSafariStandalone = window.navigator.standalone;
    
    return standaloneCheck || iosSafariStandalone;
  };
    
  // For PWA on iOS, we want to avoid redirects that might break the app
  if (isInStandaloneMode() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    console.log('Auth in standalone mode (PWA), using in-app auth flow');
    // Use a special auth flow that works better in PWA context
    return `${origin}/auth?pwa_mode=true`;
  }
  
  // Use this variable to determine if we're in the production domain
  const isProdDomain = window.location.hostname === 'soulo.online' || 
                      window.location.hostname.endsWith('.soulo.online');
  
  // If we're in production, use the full domain to ensure consistent redirects
  if (isProdDomain) {
    console.log('Using production auth redirect URL: https://soulo.online/auth');
    return `https://soulo.online/auth`;
  }
  
  // Otherwise use the current origin (for local development)
  console.log('Using development auth redirect URL:', `${origin}/auth`);
  return `${origin}/auth`;
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('Using redirect URL for Google auth:', redirectUrl);
    
    // Clear any existing auth errors in localStorage that might be interfering
    localStorage.removeItem('supabase.auth.error');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          // Add timestamp to prevent caching issues
          _t: Date.now().toString()
        },
      },
    });

    if (error) {
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
      
      // Redirect to onboarding page if navigate function is provided
      if (navigate) {
        navigate('/app');
      }
      return;
    }
    
    // If session exists, proceed with normal sign out
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    
    // Clear any auth-related items from local storage
    localStorage.removeItem('authRedirectTo');
    localStorage.removeItem('supabase.auth.error');
    
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
