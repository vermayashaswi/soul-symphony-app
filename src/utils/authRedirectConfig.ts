
/**
 * OAuth redirect URL configuration helper
 * This ensures consistent redirect URLs across the application
 */

export const AUTH_REDIRECT_CONFIG = {
  // Base redirect URL that must match Google OAuth settings
  BASE_REDIRECT_URL: '/app/auth',
  
  // Full redirect URL for OAuth providers
  getRedirectUrl(): string {
    return `${window.location.origin}/app/auth`;
  },
  
  // Validate if current URL matches expected callback pattern
  isAuthCallback(): boolean {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    
    return (
      path === '/app/auth' && (
        hash.includes('access_token') ||
        hash.includes('error') ||
        search.includes('error') ||
        search.includes('code')
      )
    );
  },
  
  // Get OAuth error from URL if present
  getOAuthError(): { error: string | null; description: string | null } {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    return {
      error: urlParams.get('error') || hashParams.get('error'),
      description: urlParams.get('error_description') || hashParams.get('error_description')
    };
  }
};
