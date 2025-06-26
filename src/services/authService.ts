import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isAppRoute } from '@/routes/RouteHelpers';

/**
 * Detects if the app is running in a native mobile environment
 */
const isNativeApp = (): boolean => {
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

/**
 * Gets the redirect URL for authentication based on environment
 */
export const getRedirectUrl = (): string => {
  if (isNativeApp()) {
    // Use custom scheme for native apps to enable deep linking
    return 'soulo://auth';
  }
  
  // For web, redirect to the auth page
  return `${window.location.origin}/app/auth`;
};

/**
 * Handle deep link authentication callback in native apps
 */
export const handleDeepLinkAuth = async (url: string): Promise<boolean> => {
  try {
    console.log('Processing deep link auth:', url);
    
    // Parse the URL to extract auth tokens
    const urlObj = new URL(url);
    const fragment = urlObj.hash?.substring(1) || urlObj.search?.substring(1);
    
    if (!fragment) {
      console.log('No auth fragment found in deep link');
      return false;
    }
    
    // Parse fragment parameters
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (accessToken && refreshToken) {
      console.log('Setting session from deep link tokens');
      
      // Set the session using the tokens from the deep link
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (error) {
        console.error('Error setting session from deep link:', error);
        return false;
      }
      
      console.log('Deep link authentication successful');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error handling deep link auth:', error);
    return false;
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('Google sign-in redirect URL:', redirectUrl);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }
    
    // For native apps, the OAuth flow will redirect to our custom scheme
    if (data?.url && isNativeApp()) {
      console.log('Opening OAuth URL in native browser:', data.url);
      // The system browser will handle the OAuth flow and redirect back to our app
      if ((window as any).Capacitor?.Plugins?.Browser) {
        await (window as any).Capacitor.Plugins.Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    } else if (data?.url) {
      // For web, redirect normally
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
 * Sign in with Apple ID
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('Apple sign-in redirect URL:', redirectUrl);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      throw error;
    }
    
    // For native apps, the OAuth flow will redirect to our custom scheme
    if (data?.url && isNativeApp()) {
      console.log('Opening Apple OAuth URL in native browser:', data.url);
      if ((window as any).Capacitor?.Plugins?.Browser) {
        await (window as any).Capacitor.Plugins.Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    } else if (data?.url) {
      // For web, redirect normally
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('Error signing in with Apple:', error.message);
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

/**
 * Handle auth callback - enhanced for mobile deep links
 */
export const handleAuthCallback = async (): Promise<any> => {
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
        return data.session;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in handleAuthCallback:', error);
    return null;
  }
};
