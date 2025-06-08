
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Gets the redirect URL for authentication
 */
export const getRedirectUrl = (): string => {
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
  
  // All auth redirects should go to /app/auth
  return `${window.location.origin}/app/auth`;
};

/**
 * Check if current path is a public page that doesn't require auth
 */
const isPublicPage = (pathname: string): boolean => {
  const publicPaths = ['/', '/privacy-policy', '/faq', '/download', '/blog'];
  return publicPaths.includes(pathname) || pathname.startsWith('/blog/');
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('Using redirect URL:', redirectUrl);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
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
    
    // If we have a URL, manually redirect to it (as a backup)
    if (data?.url) {
      console.log('Redirecting to OAuth URL:', data.url);
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('Error signing in with Google:', error.message);
    toast.error(`Error signing in with Google: ${error.message}`);
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
    
    // Session creation will be handled by AuthContext
  } catch (error: any) {
    console.error('Error signing in with email:', error.message);
    toast.error(`Error signing in with email: ${error.message}`);
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
    
    // Session creation will be handled by AuthContext
  } catch (error: any) {
    console.error('Error signing up:', error.message);
    toast.error(`Error signing up: ${error.message}`);
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
    console.error('Error resetting password:', error.message);
    toast.error(`Error resetting password: ${error.message}`);
    throw error;
  }
};

/**
 * Sign out with improved error handling
 */
export const signOut = async (navigate?: (path: string) => void): Promise<void> => {
  try {
    // Check if there's a session before trying to sign out
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    // If session check fails due to invalid token, clear local state
    if (sessionError && sessionError.message.includes('refresh_token_not_found')) {
      console.log('Invalid refresh token detected, clearing local auth state');
      localStorage.removeItem('authRedirectTo');
      
      // Clear any Supabase auth data from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('supabase.auth.token')) {
          localStorage.removeItem(key);
        }
      });
      
      if (navigate) {
        navigate('/app/onboarding');
      }
      return;
    }
    
    // If no session exists, just clean up local state and redirect
    if (!sessionData?.session) {
      localStorage.removeItem('authRedirectTo');
      
      if (navigate) {
        navigate('/app/onboarding');
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
      navigate('/app/onboarding');
    }
  } catch (error: any) {
    console.error('Error signing out:', error.message);
    
    // Still navigate to onboarding page even if there's an error
    if (navigate) {
      navigate('/app/onboarding');
    }
    localStorage.removeItem('authRedirectTo');
    
    // Show error toast but don't prevent logout flow
    toast.error(`Error while logging out: ${error.message}`);
  }
};

/**
 * Refresh session with improved error handling
 */
export const refreshSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Handle invalid refresh token errors
    if (error && error.message.includes('refresh_token_not_found')) {
      console.log('Invalid refresh token detected, clearing auth state');
      
      // Clear invalid tokens
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('supabase.auth.token')) {
          localStorage.removeItem(key);
        }
      });
      
      return null;
    }
    
    if (error) {
      throw error;
    }
    
    return session;
  } catch (error: any) {
    console.error('Error refreshing session:', error.message);
    
    // If it's a public page, don't throw error
    if (isPublicPage(window.location.pathname)) {
      console.log('On public page, ignoring session refresh error');
      return null;
    }
    
    throw error;
  }
};

/**
 * Check if user is authenticated with improved error handling
 */
export const isAuthenticated = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    // Handle invalid refresh token gracefully
    if (error && error.message.includes('refresh_token_not_found')) {
      console.log('Invalid refresh token detected');
      return false;
    }
    
    if (error) {
      // If we're on a public page, don't throw auth errors
      if (isPublicPage(window.location.pathname)) {
        console.log('Auth check failed on public page, ignoring error');
        return false;
      }
      throw error;
    }
    
    return !!data.session;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    
    // For public pages, return false instead of throwing
    if (isPublicPage(window.location.pathname)) {
      return false;
    }
    
    return false;
  }
};

/**
 * Get current user with improved error handling
 */
export const getCurrentUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    // Handle invalid refresh token gracefully
    if (error && error.message.includes('refresh_token_not_found')) {
      console.log('Invalid refresh token detected when getting user');
      return null;
    }
    
    if (error) {
      // If we're on a public page, don't throw auth errors
      if (isPublicPage(window.location.pathname)) {
        console.log('Get user failed on public page, ignoring error');
        return null;
      }
      throw error;
    }
    
    return data.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    
    // For public pages, return null instead of throwing
    if (isPublicPage(window.location.pathname)) {
      return null;
    }
    
    return null;
  }
};

/**
 * Handle auth callback
 * This is specifically added to fix the auth flow
 */
export const handleAuthCallback = async () => {
  try {
    // Check if we have hash params that might indicate an auth callback
    const hasHashParams = window.location.hash.includes('access_token') || 
                         window.location.hash.includes('error') ||
                         window.location.search.includes('error');
    
    console.log('Checking for auth callback params:', hasHashParams);
    
    if (hasHashParams) {
      // Get the session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error in auth callback session check:', error);
        return null;
      } 
      
      if (data.session?.user) {
        console.log('User authenticated in callback handler');
        // Session creation will be handled by AuthContext
        return data.session;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in handleAuthCallback:', error);
    return null;
  }
};
