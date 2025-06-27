import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Gets the redirect URL for authentication
 */
export const getRedirectUrl = (): string => {
  // For native apps, always redirect to /app/auth to handle the callback
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    return `${window.location.origin}/app/auth`;
  }
  
  // For web apps, maintain existing behavior
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
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('[AuthService] Using redirect URL for Google:', redirectUrl);
    
    // Store current page for post-auth redirect
    const currentPath = window.location.pathname;
    if (currentPath !== '/app/auth') {
      localStorage.setItem('authRedirectTo', currentPath);
    }
    
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
    
    // For native apps, don't manually redirect as it will be handled by webview
    if (data?.url && !(window as any).Capacitor) {
      console.log('[AuthService] Redirecting to OAuth URL:', data.url);
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('[AuthService] Error signing in with Google:', error.message);
    toast.error(`Error signing in with Google: ${error.message}`);
    throw error;
  }
};

/**
 * Sign in with Apple ID
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('[AuthService] Using redirect URL for Apple ID:', redirectUrl);
    
    // Store current page for post-auth redirect
    const currentPath = window.location.pathname;
    if (currentPath !== '/app/auth') {
      localStorage.setItem('authRedirectTo', currentPath);
    }
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      throw error;
    }
    
    // For native apps, don't manually redirect as it will be handled by webview
    if (data?.url && !(window as any).Capacitor) {
      console.log('[AuthService] Redirecting to Apple OAuth URL:', data.url);
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('[AuthService] Error signing in with Apple:', error.message);
    toast.error(`Error signing in with Apple: ${error.message}`);
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
 * Sign out
 * @param navigate Optional navigation function to redirect after logout
 */
export const signOut = async (navigate?: (path: string) => void): Promise<void> => {
  try {
    console.log('[AuthService] Attempting to sign out user');
    
    // Check if there's a session before trying to sign out
    const { data: sessionData } = await supabase.auth.getSession();
    
    // If no session exists, just clean up local state and redirect
    if (!sessionData?.session) {
      // Clear any auth-related items from local storage
      localStorage.removeItem('authRedirectTo');
      
      // Always redirect to onboarding page for both web and native
      if (navigate) {
        navigate('/app/onboarding');
      } else {
        window.location.href = '/app/onboarding';
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
    
    // Always redirect to onboarding page for both web and native
    if (navigate) {
      navigate('/app/onboarding');
    } else {
      window.location.href = '/app/onboarding';
    }
  } catch (error: any) {
    console.error('[AuthService] Error signing out:', error.message);
    
    // Still navigate to onboarding page even if there's an error
    if (navigate) {
      navigate('/app/onboarding');
    } else {
      window.location.href = '/app/onboarding';
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
    console.error('Error refreshing session:', error.message);
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
 * Handle auth callback
 * This is specifically added to fix the auth flow
 */
export const handleAuthCallback = async () => {
  try {
    // Check if we have hash params that might indicate an auth callback
    const hasHashParams = window.location.hash.includes('access_token') || 
                         window.location.hash.includes('error') ||
                         window.location.search.includes('error');
    
    console.log('[AuthService] Checking for auth callback params:', hasHashParams);
    
    if (hasHashParams) {
      // Get the session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[AuthService] Error in auth callback session check:', error);
        return null;
      } 
      
      if (data.session?.user) {
        console.log('[AuthService] User authenticated in callback handler');
        // Session creation will be handled by AuthContext
        return data.session;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[AuthService] Error in handleAuthCallback:', error);
    return null;
  }
};
