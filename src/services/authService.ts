import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Enhanced redirect URL handling for webtonative OAuth
 */
export const getRedirectUrl = (): string => {
  const baseUrl = window.location.origin;
  
  // For webtonative, always use the app auth route
  const redirectPath = '/app/auth';
  const fullRedirectUrl = `${baseUrl}${redirectPath}`;
  
  console.log('[AuthService] Redirect URL configured:', {
    baseUrl,
    redirectPath,
    fullRedirectUrl,
    isWebtonative: /webtonative|wv|WebView/i.test(navigator.userAgent)
  });
  
  return fullRedirectUrl;
};

/**
 * Enhanced Google sign-in with better webtonative handling
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('[AuthService] Starting Google OAuth flow:', { redirectUrl });
    
    // Clear any existing auth state first
    await supabase.auth.signOut({ scope: 'local' });
    
    // Enhanced options for webtonative
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        },
        // Critical: Don't skip browser redirect for webtonative
        skipBrowserRedirect: false
      }
    });

    if (error) {
      console.error('[AuthService] Google OAuth error:', error);
      throw new Error(`Google sign-in failed: ${error.message}`);
    }
    
    console.log('[AuthService] Google OAuth initiated successfully:', { 
      url: data?.url,
      provider: data?.provider 
    });
    
  } catch (error: any) {
    console.error('[AuthService] Google sign-in error:', error);
    const friendlyMessage = error.message?.includes('popup_closed_by_user') 
      ? 'Sign-in was cancelled. Please try again.'
      : `Sign-in failed: ${error.message}`;
    
    toast.error(friendlyMessage);
    throw error;
  }
};

/**
 * Enhanced Apple sign-in
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('[AuthService] Starting Apple OAuth flow:', { redirectUrl });
    
    // Clear any existing auth state first
    await supabase.auth.signOut({ scope: 'local' });
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false
      }
    });

    if (error) {
      console.error('[AuthService] Apple OAuth error:', error);
      throw new Error(`Apple sign-in failed: ${error.message}`);
    }
    
    console.log('[AuthService] Apple OAuth initiated successfully');
    
  } catch (error: any) {
    console.error('[AuthService] Apple sign-in error:', error);
    const friendlyMessage = error.message?.includes('popup_closed_by_user') 
      ? 'Sign-in was cancelled. Please try again.'
      : `Sign-in failed: ${error.message}`;
    
    toast.error(friendlyMessage);
    throw error;
  }
};

/**
 * Enhanced OAuth callback handler with better error handling
 */
export const handleAuthCallback = async (): Promise<any> => {
  try {
    console.log('[AuthService] Processing OAuth callback...');
    
    // Check URL for auth parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const hasAuthParams = urlParams.has('code') || hashParams.has('access_token') || 
                          hashParams.has('error') || urlParams.has('error');
    
    if (!hasAuthParams) {
      console.log('[AuthService] No OAuth parameters found in URL');
      return null;
    }
    
    // Check for error parameters first
    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    if (error) {
      console.error('[AuthService] OAuth error in URL:', error, errorDescription);
      throw new Error(errorDescription || error);
    }
    
    console.log('[AuthService] OAuth parameters detected, processing session...');
    
    // Enhanced session retrieval with better error handling
    let retries = 3;
    let session = null;
    
    while (retries > 0 && !session) {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthService] Session retrieval error:', sessionError);
          throw sessionError;
        }
        
        session = data.session;
        
        if (!session && retries > 1) {
          console.log('[AuthService] Session not ready, retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        } else {
          break;
        }
      } catch (error) {
        console.error('[AuthService] Session error:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
    
    if (session?.user) {
      console.log('[AuthService] OAuth callback successful:', { 
        userId: session.user.id,
        email: session.user.email 
      });
      
      // Clean up URL parameters without causing navigation issues
      try {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (historyError) {
        console.warn('[AuthService] Could not clean URL:', historyError);
      }
      
      return session;
    }
    
    console.warn('[AuthService] OAuth callback completed but no user session found');
    return null;
    
  } catch (error: any) {
    console.error('[AuthService] OAuth callback error:', error);
    
    // Clean up URL on error
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (historyError) {
      console.warn('[AuthService] Could not clean URL after error:', historyError);
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
    // Check if there's a session before trying to sign out
    const { data: sessionData } = await supabase.auth.getSession();
    
    // If no session exists, just clean up local state and redirect
    if (!sessionData?.session) {
      // Clear any auth-related items from local storage
      localStorage.removeItem('authRedirectTo');
      
      // Redirect to onboarding page if navigate function is provided
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
