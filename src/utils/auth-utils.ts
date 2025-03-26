
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
  const hasHashParams = window.location.hash && (
    window.location.hash.includes('access_token') || 
    window.location.hash.includes('id_token') ||
    window.location.hash.includes('error')
  );
  
  const hasQueryParams = window.location.search && (
    window.location.search.includes('code=') ||
    window.location.search.includes('error=') ||
    window.location.search.includes('state=')
  );
  
  return hasHashParams || hasQueryParams;
};
