import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from './nativeIntegrationService';
import { nativeNavigationService } from './nativeNavigationService';
import { toast } from 'sonner';

// Type definitions for GoogleAuth to avoid import errors in web environment
interface GoogleAuthPlugin {
  initialize(options: { clientId: string; scopes: string[] }): Promise<void>;
  signIn(): Promise<{
    authentication: { idToken: string; accessToken?: string };
    email: string;
    name: string;
    id: string;
  }>;
  signOut(): Promise<void>;
}

class NativeAuthService {
  private static instance: NativeAuthService;
  private isInitialized = false;
  private initializationError: string | null = null;
  private hasValidClientId = false;
  private googleAuthPlugin: GoogleAuthPlugin | null = null;

  static getInstance(): NativeAuthService {
    if (!NativeAuthService.instance) {
      NativeAuthService.instance = new NativeAuthService();
    }
    return NativeAuthService.instance;
  }

  async initialize(): Promise<void> {
    // If already fully initialized with a valid client ID and plugin, skip
    if (this.isInitialized && this.hasValidClientId && this.googleAuthPlugin) return;

    try {
      console.log('[NativeAuth] Initializing native auth service');

      // Ensure native integration is ready first (idempotent)
      await nativeIntegrationService.initialize();

      // Wait for native environment and GoogleAuth plugin with retries to avoid race conditions
      const maxAttempts = 8;
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
      let attempt = 0;

      while (
        attempt < maxAttempts &&
        (!nativeIntegrationService.isRunningNatively())
      ) {
        attempt++;
        console.log(
          `[NativeAuth] Waiting for native env (attempt ${attempt}/${maxAttempts})`
        );
        await delay(250);
      }

      // Validate configuration after waiting
      const isNative = nativeIntegrationService.isRunningNatively();

      if (!isNative) {
        console.warn('[NativeAuth] Not running natively - skipping GoogleAuth initialization');
        this.initializationError = 'Not running in native environment';
        // Keep isInitialized false so we can retry if environment changes
        return;
      }


      const clientId = this.getGoogleClientId();
      console.log('[NativeAuth] Initializing GoogleAuth plugin with configuration:', {
        clientId: clientId,
        scopes: ['profile', 'email'],
        expectedClientId: '11083941790-oi1vrl8bmsjajc0h1ka4f9q0qjmm80o9.apps.googleusercontent.com'
      });

      const GoogleAuth = await this.getGoogleAuthPlugin();
      if (!GoogleAuth) {
        throw new Error('GoogleAuth plugin could not be loaded');
      }

      await GoogleAuth.initialize({
        clientId,
        scopes: ['profile', 'email'],
      });

      this.hasValidClientId = true;
      this.isInitialized = true;
      console.log('[NativeAuth] Native auth service initialized successfully');
    } catch (error) {
      console.error('[NativeAuth] Failed to initialize:', error);
      this.initializationError = error.toString();
      this.isInitialized = false; // allow future retries
    }
  }

  private getGoogleClientId(): string {
    // Use the clientId from Capacitor config (NOT serverClientId)
    // This should match the clientId in capacitor.config.ts
    const clientId = '11083941790-oi1vrl8bmsjajc0h1ka4f9q0qjmm80o9.apps.googleusercontent.com';
    console.log('[NativeAuth] Using correct clientId from Capacitor config for native auth');
    console.log('[NativeAuth] ClientId:', clientId);
    return clientId;
  }

  private validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check if running natively
    if (!nativeIntegrationService.isRunningNatively()) {
      errors.push('Not running in native environment');
    }
    
    // Check client ID configuration
    const clientId = this.getGoogleClientId();
    if (!clientId || clientId.trim() === '') {
      errors.push('Google Client ID not configured');
    } else if (!clientId.includes('oi1vrl8bmsjajc0h1ka4f9q0qjmm80o9')) {
      errors.push('Using wrong Google Client ID - should use clientId, not serverClientId');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  async signInWithGoogle(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting Google sign-in');
      console.log('[NativeAuth] Environment check:', {
        isRunningNatively: nativeIntegrationService.isRunningNatively(),
        isGoogleAuthAvailable: nativeIntegrationService.isGoogleAuthAvailable(),
        isInitialized: this.isInitialized,
        hasValidClientId: this.hasValidClientId,
        initializationError: this.initializationError
      });

      // Ensure service is initialized before deciding path
      if (!this.isInitialized) {
        console.log('[NativeAuth] Not initialized yet - initializing now before sign-in');
        await this.initialize();
        console.log('[NativeAuth] Re-checking native availability after initialize', {
          isRunningNatively: nativeIntegrationService.isRunningNatively(),
          isGoogleAuthAvailable: nativeIntegrationService.isGoogleAuthAvailable(),
          isInitialized: this.isInitialized,
          hasValidClientId: this.hasValidClientId,
          initializationError: this.initializationError
        });
      }

      if (this.shouldUseNativeAuth()) {
        console.log('[NativeAuth] Using native Google Sign-In - no browser redirects');

        // Enhanced pre-flight configuration validation
        const validation = this.validateConfiguration();
        console.log('[NativeAuth] Pre-flight validation:', validation);

        if (this.initializationError) {
          console.error('[NativeAuth] Initialization error:', this.initializationError);
          
          // Specific error for client ID mismatch
          if (this.initializationError.includes('wrong Google Client ID')) {
            throw new Error('Google OAuth configuration error: Using wrong client ID. Please contact support.');
          }
          
          throw new Error(`Native auth not available: ${this.initializationError}`);
        }

        if (!this.hasValidClientId) {
          console.error('[NativeAuth] No valid client ID configured');
          throw new Error('Google Client ID not configured for native auth');
        }

        console.log('[NativeAuth] Calling GoogleAuth.signIn()...');

        const GoogleAuth = await this.getGoogleAuthPlugin();
        if (!GoogleAuth) {
          throw new Error('GoogleAuth plugin not available');
        }

        // ENHANCED: Add proper error handling, plus a hard timeout to avoid hanging UI
        let result;
        try {
          const signInTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Native Google sign-in timeout')), 15000)
          );
          result = await Promise.race([
            GoogleAuth.signIn(),
            signInTimeout,
          ]);
        } catch (googleError: any) {
          console.error('[NativeAuth] GoogleAuth.signIn() failed:', googleError);

          // Check for specific Google Auth errors
          if (googleError.message?.includes('User cancelled') || googleError.message?.includes('cancelled')) {
            console.log('[NativeAuth] User cancelled Google sign-in');
            toast.info('Sign-in cancelled');
            return;
          } else if (googleError.message?.toLowerCase().includes('network')) {
            throw new Error('Network error during Google sign-in. Please check your connection.');
          } else if (googleError.message?.toLowerCase().includes('configuration')) {
            throw new Error('Google sign-in configuration error. Please contact support.');
          } else if (googleError.message?.toLowerCase().includes('timeout')) {
            throw new Error('Sign-in timed out. Please try again.');
          }

          throw new Error(`Google authentication failed: ${googleError.message}`);
        }

        console.log('[NativeAuth] Native Google sign-in result:', {
          hasIdToken: !!result.authentication?.idToken,
          hasAccessToken: !!result.authentication?.accessToken,
          email: result.email,
          name: result.name,
          id: result.id
        });

        // Enhanced token validation
        if (!result.authentication?.idToken) {
          console.error('[NativeAuth] No ID token received from Google:', result);
          throw new Error('No authentication token received from Google');
        }

        // Validate token format
        const tokenParts = result.authentication.idToken.split('.');
        if (tokenParts.length !== 3) {
          console.error('[NativeAuth] Invalid ID token format:', tokenParts.length);
          throw new Error('Invalid authentication token format');
        }

        console.log('[NativeAuth] Token validation passed, calling Supabase...');

        // ENHANCED: Better timeout and error handling for Supabase
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Authentication timed out. Please try again.'));
          }, 30000);
        });

        const supabasePromise = supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.authentication.idToken,
        });

        const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

        if (error) {
          console.error('[NativeAuth] Supabase sign-in error:', {
            message: error.message,
            status: error.status,
            code: error.code || 'unknown'
          });

          // Enhanced Supabase error handling
          if (error.message?.includes('Invalid token')) {
            throw new Error('Authentication token was rejected. Please try signing in again.');
          } else if (error.message?.includes('timeout')) {
            throw new Error('Authentication timed out. Please check your connection and try again.');
          } else if (error.message?.includes('network')) {
            throw new Error('Network error during authentication. Please try again.');
          }

          throw new Error(`Authentication failed: ${error.message}`);
        }

        console.log('[NativeAuth] Supabase sign-in successful:', {
          hasUser: !!data.user,
          userEmail: data.user?.email,
          hasSession: !!data.session
        });

        console.log('[NativeAuth] Successfully signed in with Google natively');
        console.log('[NativeAuth] Navigation should now be handled by AuthContext/Auth component');
        toast.success('Signed in successfully');
        // Trigger enhanced navigation for native apps
        nativeNavigationService.handleAuthSuccess();
        return;

      } else {
        console.warn('[NativeAuth] Native auth not available after initialization - no web fallback will be used');
        throw new Error('Native Google sign-in is not available. Please try again or contact support.');
      }
    } catch (error: any) {
      console.error('[NativeAuth] Google sign-in failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code || 'unknown'
      });

      if (this.shouldUseNativeAuth()) {
        console.log('[NativeAuth] Native auth failed - showing error, no browser fallback');
        this.handleAuthError(error);
        throw error;
      }

      this.handleAuthError(error);
      throw error;
    }
  }

  async signInWithApple(): Promise<void> {
    try {
      console.log('[NativeAuth] Apple sign-in not implemented for native');
      throw new Error('Apple sign-in not available in native app');
    } catch (error: any) {
      console.error('[NativeAuth] Apple sign-in failed:', error);
      this.handleAuthError(error, 'Apple');
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting sign out');

      if (this.shouldUseNativeAuth() && !this.initializationError && this.hasValidClientId) {
        try {
          const GoogleAuth = await this.getGoogleAuthPlugin();
          if (GoogleAuth) {
            await GoogleAuth.signOut();
            console.log('[NativeAuth] Signed out from Google natively');
          }
        } catch (error) {
          console.warn('[NativeAuth] Failed to sign out from Google natively:', error);
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[NativeAuth] Supabase sign-out error:', error);
        throw error;
      }

      console.log('[NativeAuth] Successfully signed out');
      toast.info('Signed out');
    } catch (error: any) {
      console.error('[NativeAuth] Sign out failed:', error);
      toast.error(`Sign out failed: ${error.message}`);
      throw error;
    }
  }

  private shouldUseNativeAuth(): boolean {
    return nativeIntegrationService.isRunningNatively() &&
           !!this.googleAuthPlugin &&
           this.isInitialized &&
           this.hasValidClientId;
  }

  private handleAuthError(error: any, provider: string = 'Google'): void {
    let errorMessage = `${provider} sign-in failed`;

    if (error.message?.includes('cancelled')) {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.message?.includes('Network') || error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message?.includes('Configuration') || error.message?.includes('configuration')) {
      errorMessage = `${provider} sign-in configuration error. Please contact support.`;
    } else if (error.message?.includes('wrong client ID') || error.message?.includes('OAuth configuration')) {
      errorMessage = 'Google OAuth configuration error. Please contact support.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Sign-in timed out. Please try again.';
    } else if (error.message?.includes('not available')) {
      errorMessage = `${provider} sign-in is not available. Please try again later.`;
    } else if (error.message) {
      errorMessage = `${provider} sign-in failed: ${error.message}`;
    }

    toast.error(errorMessage);
  }

  isRunningNatively(): boolean {
    return nativeIntegrationService.isRunningNatively();
  }

  getInitializationError(): string | null {
    return this.initializationError;
  }

  hasValidConfiguration(): boolean {
    return this.hasValidClientId;
  }

  private async getGoogleAuthPlugin(): Promise<GoogleAuthPlugin | null> {
    if (this.googleAuthPlugin) {
      return this.googleAuthPlugin;
    }

    if (!nativeIntegrationService.isRunningNatively()) {
      console.log('[NativeAuth] Not running natively - GoogleAuth plugin not available');
      return null;
    }

    try {
      // Prefer the registered Capacitor plugin first
      const cap = (window as any).Capacitor;
      const registered = cap?.Plugins?.GoogleAuth;
      if (registered) {
        console.log('[NativeAuth] Using GoogleAuth from Capacitor.Plugins');
        this.googleAuthPlugin = registered as GoogleAuthPlugin;
        return this.googleAuthPlugin;
      }

      // Fallback to dynamic import
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      console.log('[NativeAuth] Using GoogleAuth via dynamic import');
      this.googleAuthPlugin = GoogleAuth;
      return GoogleAuth;
    } catch (error) {
      console.error('[NativeAuth] Failed to load GoogleAuth plugin:', error);
      return null;
    }
  }
}

export const nativeAuthService = NativeAuthService.getInstance();
