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
    console.log('[AuthService] Using native app redirect URL: soulo://auth');
    return 'soulo://auth';
  }
  
  const webUrl = `${window.location.origin}/app/auth`;
  console.log('[AuthService] Using web redirect URL:', webUrl);
  return webUrl;
};

/**
 * Handle deep link authentication callback in native apps
 */
export const handleDeepLinkAuth = async (url: string): Promise<boolean> => {
  try {
    console.log('[AuthService] Processing deep link auth:', url);
    
    // Parse the URL to extract auth tokens
    let urlToParse = url;
    
    // Handle different URL formats
    if (url.startsWith('soulo://auth')) {
      // Custom scheme format: soulo://auth#access_token=...
      urlToParse = url.replace('soulo://auth', 'https://dummy.com/auth');
    }
    
    const urlObj = new URL(urlToParse);
    const fragment = urlObj.hash?.substring(1) || urlObj.search?.substring(1);
    
    if (!fragment) {
      console.log('[AuthService] No auth fragment found in deep link');
      return false;
    }
    
    console.log('[AuthService] Found auth fragment:', fragment);
    
    // Parse fragment parameters
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    
    if (error) {
      console.error('[AuthService] Auth error in deep link:', error, errorDescription);
      toast.error(`Authentication failed: ${errorDescription || error}`);
      return false;
    }
    
    if (accessToken && refreshToken) {
      console.log('[AuthService] Setting session from deep link tokens');
      
      // Set the session using the tokens from the deep link
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (error) {
        console.error('[AuthService] Error setting session from deep link:', error);
        toast.error('Failed to complete authentication');
        return false;
      }
      
      console.log('[AuthService] Deep link authentication successful', data);
      toast.success('Successfully signed in!');
      return true;
    }
    
    console.log('[AuthService] No tokens found in deep link');
    return false;
  } catch (error) {
    console.error('[AuthService] Error handling deep link auth:', error);
    toast.error('Authentication failed');
    return false;
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('[AuthService] Starting Google sign-in with redirect URL:', redirectUrl);
    
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
      console.error('[AuthService] Google OAuth error:', error);
      throw error;
    }
    
    console.log('[AuthService] Google OAuth response:', data);
    
    // For native apps, the OAuth flow will redirect to our custom scheme
    if (data?.url) {
      if (isNativeApp()) {
        console.log('[AuthService] Opening OAuth URL in native browser:', data.url);
        
        // Try to use Capacitor Browser plugin first
        if ((window as any).Capacitor?.Plugins?.Browser) {
          try {
            await (window as any).Capacitor.Plugins.Browser.open({ 
              url: data.url,
              windowName: '_system'
            });
            console.log('[AuthService] Opened OAuth URL with Capacitor Browser');
          } catch (browserError) {
            console.warn('[AuthService] Capacitor Browser failed, falling back to window.open:', browserError);
            window.open(data.url, '_system');
          }
        } else {
          console.log('[AuthService] Capacitor Browser not available, using window.open');
          window.open(data.url, '_system');
        }
      } else {
        // For web, redirect normally
        console.log('[AuthService] Redirecting to OAuth URL for web');
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      }
    } else {
      console.warn('[AuthService] No OAuth URL received from Supabase');
      throw new Error('No authentication URL received');
    }
  } catch (error: any) {
    console.error('[AuthService] Error signing in with Google:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    toast.error(`Error signing in with Google: ${errorMessage}`);
    throw error;
  }
};

/**
 * Sign in with Apple ID
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    console.log('[AuthService] Starting Apple sign-in with redirect URL:', redirectUrl);
    
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
    
    console.log('[AuthService] Apple OAuth response:', data);
    
    // For native apps, the OAuth flow will redirect to our custom scheme
    if (data?.url) {
      if (isNativeApp()) {
        console.log('[AuthService] Opening Apple OAuth URL in native browser:', data.url);
        
        if ((window as any).Capacitor?.Plugins?.Browser) {
          try {
            await (window as any).Capacitor.Plugins.Browser.open({ 
              url: data.url,
              windowName: '_system'
            });
            console.log('[AuthService] Opened Apple OAuth URL with Capacitor Browser');
          } catch (browserError) {
            console.warn('[AuthService] Capacitor Browser failed, falling back to window.open:', browserError);
            window.open(data.url, '_system');
          }
        } else {
          console.log('[AuthService] Capacitor Browser not available, using window.open');
          window.open(data.url, '_system');
        }
      } else {
        // For web, redirect normally
        console.log('[AuthService] Redirecting to Apple OAuth URL for web');
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      }
    } else {
      console.warn('[AuthService] No Apple OAuth URL received from Supabase');
      throw new Error('No authentication URL received');
    }
  } catch (error: any) {
    console.error('[AuthService] Error signing in with Apple:', error);
    const errorMessage = error?.message || 'Unknown error occurred';
    toast.error(`Error signing in with Apple: ${errorMessage}`);
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
        return data.session;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[AuthService] Error in handleAuthCallback:', error);
    return null;
  }
};
