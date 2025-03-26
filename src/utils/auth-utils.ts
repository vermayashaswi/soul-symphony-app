
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
    localStorage.removeItem(`${storageKeyPrefix}-auth-token`);
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('supabase.auth.expires_at');
    localStorage.removeItem('supabase.auth.refresh_token');
    
    // Log the cleanup for debugging
    if (window.console) {
      console.log('Auth storage cleared');
    }
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
      
      // Additional debug info about token
      console.log('🔒 Access token details:', {
        length: data.session.access_token.length,
        prefix: data.session.access_token.substring(0, 10) + '...',
        expiresInSeconds: data.session.expires_at - Math.floor(Date.now() / 1000),
        provider: data.session.user.app_metadata.provider
      });
    } else {
      console.log('❌ No active session found from Supabase');
    }
  } catch (e) {
    console.error('❌ Exception checking session:', e);
  }
  
  console.groupEnd();
};

// Export some utilities to create global error handlers that log to our debug system
export const setupGlobalErrorHandlers = (errorLogger?: (message: string, details?: any) => void) => {
  if (!errorLogger) return;
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorLogger('Unhandled Promise Rejection', {
      reason: event.reason?.toString?.() || 'Unknown reason',
      stack: event.reason?.stack
    });
  });
  
  // Capture global errors
  window.addEventListener('error', (event) => {
    errorLogger('Global Error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });
};

