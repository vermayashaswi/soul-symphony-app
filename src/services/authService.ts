import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Gets the redirect URL for authentication
 */
export const getRedirectUrl = (): string => {
  // This is a production environment fix specifically for soulo.online
  // Force the correct URL for production environment
  if (window.location.hostname === 'soulo.online' || 
      window.location.hostname.endsWith('.soulo.online')) {
    console.log('Auth on production domain (soulo.online), using hardcoded redirect URL');
    return 'https://soulo.online/auth';
  }
  
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
  
  // Otherwise use the current origin for local development
  console.log('Auth on non-production domain, using current origin as redirect:', origin);
  return `${origin}/auth`;
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('Using redirect URL for Google auth:', redirectUrl);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          // Force refresh of Google access tokens
          access_type: 'offline',
          prompt: 'consent',
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
    console.log('Attempting to sign out user');
    
    // Check if there's a session before trying to sign out
    const { data: sessionData } = await supabase.auth.getSession();
    
    // If no session exists, just clean up local state and redirect
    if (!sessionData?.session) {
      console.log('No active session found, cleaning up local state only');
      // Clear any auth-related items from local storage
      localStorage.removeItem('authRedirectTo');
      
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
    if (window.location.hash) {
      console.log('Detected hash params, attempting to process auth result');
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      return data.session;
    }
    return null;
  } catch (error) {
    console.error('Error handling PWA auth completion:', error);
    return null;
  }
};

/**
 * Debug the current authentication state
 */
export const debugAuthState = async (): Promise<{session: any, user: any}> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: userData } = await supabase.auth.getUser();
    
    console.log('Current auth state:', {
      session: sessionData.session ? {
        user: sessionData.session.user.email,
        expires_at: sessionData.session.expires_at,
        access_token_length: sessionData.session.access_token.length,
        refresh_token_present: !!sessionData.session.refresh_token,
      } : null,
      user: userData.user ? {
        email: userData.user.email,
        id: userData.user.id,
        app_metadata: userData.user.app_metadata,
        provider: userData.user.app_metadata?.provider,
      } : null
    });
    
    return {
      session: sessionData.session,
      user: userData.user
    };
  } catch (error) {
    console.error('Error debugging auth state:', error);
    return { session: null, user: null };
  }
};
