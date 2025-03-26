
/**
 * Utility functions for authentication
 */

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
  } catch (e) {
    console.warn('LocalStorage access error during cleanup:', e);
  }
};
