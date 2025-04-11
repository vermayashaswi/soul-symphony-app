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
    // Check if we're on a specific path like /app/auth
    const pathMatch = window.location.pathname.match(/\/app\/auth/);
    return pathMatch ? 'https://soulo.online/app/auth' : 'https://soulo.online/auth';
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
    // Use a special auth flow that works better in PWA context
    const pathname = window.location.pathname;
    // Check if we're on app auth page
    const isAppAuth = pathname.includes('/app/auth');
    return `${origin}${isAppAuth ? '/app/auth' : '/auth'}?pwa_mode=true`;
  }
  
  // Otherwise use the current origin for local development
  // Use the current path to determine if we're in /auth or /app/auth
  const pathname = window.location.pathname;
  // Check if we're on app auth page
  const isAppAuth = pathname.includes('/app/auth');
  return `${origin}${isAppAuth ? '/app/auth' : '/auth'}`;
};

/**
 * Function to create a user session record in the database
 */
async function createUserSession(userId: string) {
  try {
    // Get device and location info
    const deviceType = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    
    // Create session entry
    const { error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        device_type: deviceType,
        user_agent: navigator.userAgent,
        entry_page: window.location.pathname,
        last_active_page: window.location.pathname,
        is_active: true
      });
    
    if (error) {
      console.error('Error creating user session:', error);
    }
  } catch (e) {
    console.error('Exception creating user session:', e);
  }
}

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const redirectUrl = getRedirectUrl();
    
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
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  } catch (error: any) {
    console.error('Error signing in with Google:', error.message);
    
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
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
    
    // Create a user session record after successful sign-in
    if (data.user) {
      await createUserSession(data.user.id);
    }
  } catch (error: any) {
    console.error('Error signing in with email:', error.message);
    
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
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }
    
    // Create a user session record after successful sign-up
    if (data.user) {
      await createUserSession(data.user.id);
    }
  } catch (error: any) {
    console.error('Error signing up:', error.message);
    
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
    console.error('Error resetting password:', error.message);
    
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
    console.error('Error signing out:', error.message);
    
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
    
    if (hasHashParams) {
      // Get the session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        return null;
      } 
      
      if (data.session?.user) {
        // Create a user session record
        await createUserSession(data.session.user.id);
        
        return data.session;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in handleAuthCallback:', error);
    return null;
  }
};
