
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WebViewOAuthHandler {
  handleOAuthRedirect: (url: string) => Promise<boolean>;
  interceptOAuthFlow: () => void;
}

class WebViewOAuthHandlerImpl implements WebViewOAuthHandler {
  private originalOpen: typeof window.open;
  private originalLocation: typeof window.location;

  constructor() {
    this.originalOpen = window.open;
    this.originalLocation = window.location;
  }

  /**
   * Intercepts OAuth flows to prevent external browser opening
   */
  interceptOAuthFlow(): void {
    // Override window.open to prevent external browser opening
    window.open = (url?: string | URL, target?: string, features?: string) => {
      console.log('[WebViewOAuth] Intercepting window.open:', url);
      
      if (url && typeof url === 'string') {
        // Check if this is an OAuth URL
        if (this.isOAuthURL(url)) {
          console.log('[WebViewOAuth] Detected OAuth URL, handling in webview');
          // Navigate to OAuth URL in current webview instead of opening new window
          window.location.href = url;
          return null;
        }
      }
      
      // For non-OAuth URLs, use original behavior
      return this.originalOpen.call(window, url, target, features);
    };

    console.log('[WebViewOAuth] OAuth flow interception enabled');
  }

  /**
   * Handles OAuth redirect URLs
   */
  async handleOAuthRedirect(url: string): Promise<boolean> {
    try {
      console.log('[WebViewOAuth] Processing OAuth redirect:', url);
      
      // Check if this is a Supabase auth callback
      if (url.includes('#access_token=') || url.includes('?code=')) {
        console.log('[WebViewOAuth] Found auth callback parameters');
        
        // Let Supabase handle the session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[WebViewOAuth] Error getting session:', error);
          toast.error('Authentication failed');
          return false;
        }
        
        if (data.session) {
          console.log('[WebViewOAuth] Session established successfully');
          toast.success('Signed in successfully');
          
          // Redirect to appropriate page
          const targetPath = localStorage.getItem('authRedirectTo') || '/app/home';
          localStorage.removeItem('authRedirectTo');
          
          // Navigate to target path
          window.location.href = targetPath;
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[WebViewOAuth] Error handling OAuth redirect:', error);
      toast.error('Authentication error occurred');
      return false;
    }
  }

  /**
   * Checks if a URL is an OAuth URL
   */
  private isOAuthURL(url: string): boolean {
    const oauthDomains = [
      'accounts.google.com',
      'appleid.apple.com',
      'github.com',
      'facebook.com',
      'twitter.com'
    ];
    
    try {
      const urlObj = new URL(url);
      return oauthDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  /**
   * Restores original window methods
   */
  restore(): void {
    window.open = this.originalOpen;
    console.log('[WebViewOAuth] OAuth flow interception disabled');
  }
}

export const webViewOAuthHandler = new WebViewOAuthHandlerImpl();

/**
 * Initialize webview OAuth handling for native apps
 */
export const initializeWebViewOAuth = (): void => {
  // Only initialize in Capacitor environment
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    console.log('[WebViewOAuth] Initializing for Capacitor environment');
    
    webViewOAuthHandler.interceptOAuthFlow();
    
    // Handle current URL if it's an OAuth callback
    const currentUrl = window.location.href;
    if (currentUrl.includes('#access_token=') || currentUrl.includes('?code=')) {
      webViewOAuthHandler.handleOAuthRedirect(currentUrl);
    }
  }
};

/**
 * Cleanup webview OAuth handling
 */
export const cleanupWebViewOAuth = (): void => {
  webViewOAuthHandler.restore();
};
