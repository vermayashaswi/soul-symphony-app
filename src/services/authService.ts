import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';
import { nativeAuthService } from './nativeAuthService';

/**
 * Gets the redirect URL for authentication - FIXED to be consistent
 */
export const getRedirectUrl = (): string => {
  // Always use a consistent redirect URL to avoid OAuth mismatches
  // This must match exactly what's configured in Google OAuth settings
  const baseUrl = window.location.origin;
  return `${baseUrl}/app/auth`;
};

/**
 * Sign in with Google - uses native auth when available
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    console.log('[AuthService] Starting Google sign-in');
    await nativeAuthService.signInWithGoogle();
  } catch (error: any) {
    console.error('[AuthService] Google sign-in error:', error);
    
    // Handle specific OAuth errors
    if (error.message?.includes('redirect_uri_mismatch') || 
        error.message?.includes('invalid_request')) {
      toast.error('Google sign-in configuration error. Please contact support.');
      console.error('[AuthService] OAuth configuration error - check redirect URLs');
    } else if (error.message?.includes('access_denied')) {
      toast.error('Sign-in was cancelled or access was denied.');
    } else if (error.message?.includes('popup_blocked')) {
      toast.error('Pop-up was blocked. Please allow pop-ups and try again.');
    } else {
      toast.error('Google sign-in failed. Please try again.');
    }
    
    throw error;
  }
};

/**
 * Sign in with Apple ID - uses native auth when available
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    console.log('[AuthService] Starting Apple sign-in');
    await nativeAuthService.signInWithApple();
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
 * Sign out - uses native auth when available
 * @param navigate Optional navigation function to redirect after logout
 */
export const signOut = async (navigate?: (path: string) => void): Promise<void> => {
  try {
    console.log('[AuthService] Starting sign out');
    await nativeAuthService.signOut();
    
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
 * Handle auth callback - Enhanced for better OAuth handling
 */
export const handleAuthCallback = async () => {
  try {
    console.log('[AuthService] Processing auth callback');
    
    // Check for OAuth callback indicators
    const hasHashParams = window.location.hash.includes('access_token') || 
                         window.location.hash.includes('error') ||
                         window.location.search.includes('error') ||
                         window.location.search.includes('code');
    
    // Check for OAuth errors in URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    if (error) {
      console.error('[AuthService] OAuth error in callback:', error, errorDescription);
      
      // Handle specific OAuth errors
      if (error === 'redirect_uri_mismatch') {
        toast.error('Sign-in configuration error. Please contact support.');
        console.error('[AuthService] Redirect URI mismatch - check Google OAuth settings');
      } else if (error === 'access_denied') {
        toast.error('Sign-in was cancelled.');
      } else {
        toast.error(`Sign-in error: ${errorDescription || error}`);
      }
      
      return null;
    }
    
    if (hasHashParams) {
      console.log('[AuthService] OAuth callback detected, checking session');
      
      // Get the session from Supabase
      const { data, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[AuthService] Error in auth callback session check:', sessionError);
        toast.error('Authentication failed. Please try again.');
        return null;
      } 
      
      if (data.session?.user) {
        console.log('[AuthService] User authenticated successfully in callback');
        toast.success('Signed in successfully!');
        return data.session;
      } else {
        console.log('[AuthService] No session found after OAuth callback');
        toast.error('Authentication incomplete. Please try again.');
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[AuthService] Error in handleAuthCallback:', error);
    toast.error('Authentication failed. Please try again.');
    return null;
  }
};
