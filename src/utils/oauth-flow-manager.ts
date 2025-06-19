
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OAuthFlowState {
  isProcessing: boolean;
  hasError: boolean;
  errorMessage: string | null;
  redirectPath: string | null;
}

class OAuthFlowManager {
  private state: OAuthFlowState = {
    isProcessing: false,
    hasError: false,
    errorMessage: null,
    redirectPath: null
  };

  private listeners: Array<(state: OAuthFlowState) => void> = [];

  constructor() {
    // Bind methods to preserve context
    this.handleCallback = this.handleCallback.bind(this);
    this.clearState = this.clearState.bind(this);
    this.setState = this.setState.bind(this);
  }

  // Subscribe to state changes
  subscribe(listener: (state: OAuthFlowState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Update state and notify listeners
  private setState(updates: Partial<OAuthFlowState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }

  // Get current state
  getState(): OAuthFlowState {
    return { ...this.state };
  }

  // Check if URL contains OAuth parameters
  hasOAuthParams(): boolean {
    const url = window.location.href;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    return (
      searchParams.has('code') ||
      searchParams.has('error') ||
      hashParams.has('access_token') ||
      hashParams.has('error')
    );
  }

  // Extract OAuth parameters from URL
  extractOAuthParams() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    return {
      code: searchParams.get('code'),
      error: searchParams.get('error') || hashParams.get('error'),
      errorDescription: searchParams.get('error_description') || hashParams.get('error_description'),
      accessToken: hashParams.get('access_token'),
      refreshToken: hashParams.get('refresh_token'),
      expiresIn: hashParams.get('expires_in')
    };
  }

  // Clean URL from OAuth parameters
  cleanUrl() {
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, baseUrl);
      console.log('[OAuthFlowManager] URL cleaned successfully');
    } catch (error) {
      console.warn('[OAuthFlowManager] Could not clean URL:', error);
    }
  }

  // Store redirect path for after authentication
  setRedirectPath(path: string) {
    try {
      localStorage.setItem('authRedirectTo', path);
      this.setState({ redirectPath: path });
    } catch (error) {
      console.warn('[OAuthFlowManager] Could not store redirect path:', error);
    }
  }

  // Get stored redirect path
  getRedirectPath(): string {
    try {
      const stored = localStorage.getItem('authRedirectTo');
      return stored || '/app/home';
    } catch (error) {
      console.warn('[OAuthFlowManager] Could not get redirect path:', error);
      return '/app/home';
    }
  }

  // Clear stored redirect path
  clearRedirectPath() {
    try {
      localStorage.removeItem('authRedirectTo');
      this.setState({ redirectPath: null });
    } catch (error) {
      console.warn('[OAuthFlowManager] Could not clear redirect path:', error);
    }
  }

  // Handle OAuth callback with comprehensive error handling
  async handleCallback(): Promise<{ success: boolean; session: any; error?: string }> {
    if (this.state.isProcessing) {
      console.log('[OAuthFlowManager] Already processing, skipping...');
      return { success: false, session: null, error: 'Already processing' };
    }

    this.setState({ 
      isProcessing: true, 
      hasError: false, 
      errorMessage: null 
    });

    try {
      console.log('[OAuthFlowManager] Starting OAuth callback handling...');

      // Check for OAuth parameters
      if (!this.hasOAuthParams()) {
        console.log('[OAuthFlowManager] No OAuth parameters found');
        this.setState({ isProcessing: false });
        return { success: false, session: null, error: 'No OAuth parameters' };
      }

      // Extract and validate parameters
      const params = this.extractOAuthParams();
      console.log('[OAuthFlowManager] OAuth parameters:', { 
        hasCode: !!params.code,
        hasError: !!params.error,
        hasAccessToken: !!params.accessToken 
      });

      // Handle OAuth errors
      if (params.error) {
        const errorMessage = params.errorDescription || params.error;
        console.error('[OAuthFlowManager] OAuth error in URL:', errorMessage);
        
        this.setState({ 
          isProcessing: false,
          hasError: true,
          errorMessage: errorMessage
        });

        this.cleanUrl();
        toast.error(`Authentication failed: ${errorMessage}`);
        return { success: false, session: null, error: errorMessage };
      }

      // Process the session with retry logic
      let session = null;
      let retries = 3;
      
      while (retries > 0 && !session) {
        try {
          console.log(`[OAuthFlowManager] Attempting to get session (${4 - retries}/3)...`);
          
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[OAuthFlowManager] Session error:', error);
            throw error;
          }
          
          session = data.session;
          
          if (!session && retries > 1) {
            console.log('[OAuthFlowManager] Session not ready, waiting...');
            await new Promise(resolve => setTimeout(resolve, 800));
          }
          
          retries--;
        } catch (error: any) {
          console.error('[OAuthFlowManager] Session retrieval error:', error);
          retries--;
          
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw error;
          }
        }
      }

      if (session?.user) {
        console.log('[OAuthFlowManager] OAuth callback successful!', {
          userId: session.user.id,
          email: session.user.email
        });

        this.setState({ 
          isProcessing: false,
          hasError: false,
          errorMessage: null
        });

        this.cleanUrl();
        return { success: true, session };
      } else {
        console.warn('[OAuthFlowManager] No session found after processing');
        
        this.setState({ 
          isProcessing: false,
          hasError: true,
          errorMessage: 'Authentication completed but no session was created'
        });

        this.cleanUrl();
        toast.error('Authentication failed. Please try again.');
        return { success: false, session: null, error: 'No session created' };
      }

    } catch (error: any) {
      console.error('[OAuthFlowManager] OAuth callback error:', error);
      
      this.setState({ 
        isProcessing: false,
        hasError: true,
        errorMessage: error.message || 'Authentication failed'
      });

      this.cleanUrl();
      toast.error(`Authentication failed: ${error.message}`);
      return { success: false, session: null, error: error.message };
    }
  }

  // Clear all state
  clearState() {
    this.setState({
      isProcessing: false,
      hasError: false,
      errorMessage: null,
      redirectPath: null
    });
    this.clearRedirectPath();
  }

  // Check if currently processing
  isProcessing(): boolean {
    return this.state.isProcessing;
  }

  // Check if there's an error
  hasError(): boolean {
    return this.state.hasError;
  }

  // Get error message
  getErrorMessage(): string | null {
    return this.state.errorMessage;
  }
}

// Export singleton instance
export const oauthFlowManager = new OAuthFlowManager();
export default oauthFlowManager;
