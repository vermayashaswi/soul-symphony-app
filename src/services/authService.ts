
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';
import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeAuthService } from './nativeAuthService';

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
 * Sign in with Google - uses native auth when available, otherwise falls back to web OAuth
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    console.log('[AuthService] Starting Google sign-in');
    
    // Check if we should use native authentication
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[AuthService] Attempting native Google sign-in');
      try {
        await nativeAuthService.signInWithGoogle();
        return;
      } catch (nativeError) {
        console.warn('[AuthService] Native Google sign-in failed, falling back to web:', nativeError);
        
        // Don't show error for user cancellation
        if (nativeError.message?.includes('popup_closed_by_user')) {
          return;
        }
        
        // Fall through to web OAuth for other errors
      }
    }
    
    // Web Google Sign-In fallback
    console.log('[AuthService] Using web OAuth Google sign-in');
    const redirectUrl = getRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('[AuthService] OAuth sign-in error:', error);
      throw error;
    }

    if (data?.url) {
      console.log('[AuthService] Redirecting to OAuth URL:', data.url);
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('[AuthService] Google sign-in error:', error);
    
    // Enhanced error handling for common Google Auth issues
    if (error.message?.includes('redirect_uri_mismatch')) {
      console.error('[AuthService] Redirect URI mismatch - check Google OAuth configuration');
      toast.error('Google sign-in configuration error. Please contact support.');
    } else if (error.message?.includes('popup_closed_by_user')) {
      console.log('[AuthService] User cancelled sign-in');
      // Don't show error toast for user cancellation
      return;
    } else if (error.message?.includes('Cannot read properties of null')) {
      console.error('[AuthService] Google Auth initialization error - likely running in unsupported environment');
      toast.error('Google sign-in is not available in this environment. Please try refreshing the page.');
    } else {
      // Re-throw other errors to be handled by the caller
      throw error;
    }
  }
};

/**
 * Sign in with Apple ID - uses native auth when available, otherwise falls back to web OAuth
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    console.log('[AuthService] Starting Apple sign-in');
    
    // Check if we should use native authentication
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[AuthService] Attempting native Apple sign-in');
      try {
        await nativeAuthService.signInWithApple();
        return;
      } catch (nativeError) {
        console.warn('[AuthService] Native Apple sign-in failed, falling back to web:', nativeError);
        // Fall through to web OAuth
      }
    }
    
    // Web Apple Sign-In fallback
    console.log('[AuthService] Using web OAuth Apple sign-in');
    const redirectUrl = getRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('[AuthService] Apple OAuth error:', error);
      throw error;
    }

    if (data?.url) {
      console.log('[AuthService] Redirecting to Apple OAuth URL:', data.url);
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('[AuthService] Apple sign-in error:', error);
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
 * Sign out - uses native auth when available, otherwise uses regular Supabase signOut
 * @param navigate Optional navigation function to redirect after logout
 */
export const signOut = async (navigate?: (path: string) => void): Promise<void> => {
  try {
    console.log('[AuthService] Starting sign out');
    
    // Check if we should use native sign out
    if (nativeIntegrationService.isRunningNatively()) {
      console.log('[AuthService] Attempting native sign out');
      try {
        await nativeAuthService.signOut();
      } catch (nativeError) {
        console.warn('[AuthService] Native sign out failed, using web fallback:', nativeError);
        // Fall through to web sign out
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('[AuthService] Supabase sign-out error:', error);
          throw error;
        }
      }
    } else {
      console.log('[AuthService] Using web sign out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AuthService] Supabase sign-out error:', error);
        throw error;
      }
    }
    
    // Clear any auth-related items from local storage
    localStorage.removeItem('authRedirectTo');
    
    // Always redirect to onboarding page if navigate function is provided
    if (navigate) {
      navigate('/app/onboarding');
    }
  } catch (error: any) {
    console.error('[AuthService] Sign out error:', error);
    
    // Still navigate to onboarding page even if there's an error
    if (navigate) {
      navigate('/app/onboarding');
    }
    localStorage.removeItem('authRedirectTo');
    
    // Show error toast but don't prevent logout flow
    throw error;
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
