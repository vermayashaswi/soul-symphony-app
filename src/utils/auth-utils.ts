
/**
 * Utility functions for authentication
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the full callback URL for OAuth providers including the origin
 * This ensures consistent redirect URLs across the application
 */
export const getAuthCallbackUrl = (): string => {
  // Always use /auth/callback to match what's registered in Google Cloud Console
  return `${window.location.origin}/auth/callback`;
};

/**
 * Gets a consistent callback URL for OAuth providers that matches
 * what's configured in the provider's developer console
 */
export const getOAuthRedirectUrl = (): string => {
  return getAuthCallbackUrl();
};

/**
 * Check if the current URL contains authentication parameters
 * This helps detect redirects from OAuth providers
 */
export const hasAuthParams = (): boolean => {
  // Check for token or error parameters in the hash
  const hasHashParams = window.location.hash && (
    window.location.hash.includes('access_token') || 
    window.location.hash.includes('id_token') ||
    window.location.hash.includes('refresh_token') ||
    window.location.hash.includes('type=recovery') ||
    window.location.hash.includes('error')
  );
  
  // Check for code, state, or error parameters in query string
  const hasQueryParams = window.location.search && (
    window.location.search.includes('code=') ||
    window.location.search.includes('error=') ||
    window.location.search.includes('state=') ||
    window.location.search.includes('session_id=')
  );
  
  return hasHashParams || hasQueryParams;
};

/**
 * Helper to clear any stale token data from localStorage
 * This helps avoid issues with corrupted tokens
 */
export const clearAuthStorage = (): void => {
  try {
    const storageKeyPrefix = 'sb-' + window.location.hostname.split('.')[0];
    const keysToRemove = [
      `${storageKeyPrefix}-auth-token`,
      'supabase.auth.token',
      'supabase.auth.expires_at',
      'supabase.auth.refresh_token'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Error removing ${key}:`, e);
      }
    });
    
    console.log('Auth storage cleared');
  } catch (e) {
    console.warn('LocalStorage access error during cleanup:', e);
  }
};

/**
 * Debug function to help troubleshoot session issues
 */
export const debugSessionStatus = async (): Promise<void> => {
  console.group('📋 Auth Session Debug Info');
  
  try {
    // Check if we have tokens in localStorage
    const storageKeyPrefix = 'sb-' + window.location.hostname.split('.')[0];
    let hasLocalTokens = false;
    
    try {
      hasLocalTokens = !!localStorage.getItem('supabase.auth.token') || 
                    !!localStorage.getItem(`${storageKeyPrefix}-auth-token`);
    } catch (e) {
      console.error('❌ Error accessing localStorage:', e);
    }
    
    console.log('🔑 Local storage tokens present:', hasLocalTokens);
    
    // Check current session from Supabase
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error.message);
    } else if (data?.session) {
      console.log('✅ Active session found:', {
        userId: data.session.user.id,
        email: data.session.user.email,
        expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
        tokenLength: data.session.access_token.length,
      });
    } else {
      console.log('❌ No active session found from Supabase');
    }
  } catch (e) {
    console.error('❌ Exception checking session:', e);
  }
  
  console.groupEnd();
};

/**
 * Ensures healthy authentication state by checking and refreshing token
 */
export const ensureHealthyAuth = async (): Promise<boolean> => {
  try {
    console.log('Checking and ensuring healthy auth state...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session in ensureHealthyAuth:', error);
      return false;
    }
    
    if (!data.session) {
      console.log('No session found in ensureHealthyAuth');
      return false;
    }
    
    // If session exists but expires soon (within 5 minutes), try to refresh
    const expiresAt = data.session.expires_at * 1000; // convert to ms
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now < fiveMinutes) {
      console.log('Session expires soon, refreshing token...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        return false;
      }
      
      console.log('Session refreshed successfully');
    }
    
    return true;
  } catch (e) {
    console.error('Exception in ensureHealthyAuth:', e);
    return false;
  }
};
