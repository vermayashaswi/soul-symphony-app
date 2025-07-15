import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from './nativeIntegrationService';
import { toast } from 'sonner';

class NativeAuthService {
  private static instance: NativeAuthService;
  private isInitialized = false;
  private initializationError: string | null = null;
  private hasValidClientId = false;

  static getInstance(): NativeAuthService {
    if (!NativeAuthService.instance) {
      NativeAuthService.instance = new NativeAuthService();
    }
    return NativeAuthService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[NativeAuth] Initializing native auth service');

      // Only initialize if we're actually running natively
      if (!nativeIntegrationService.isRunningNatively()) {
        console.log('[NativeAuth] Not running natively - skipping GoogleAuth initialization');
        this.isInitialized = true;
        return;
      }

      // Verify GoogleAuth plugin is available
      if (!nativeIntegrationService.isGoogleAuthAvailable()) {
        console.warn('[NativeAuth] GoogleAuth plugin not available');
        this.initializationError = 'GoogleAuth plugin not available';
        this.isInitialized = true;
        return;
      }

      // Check if we have a valid client ID
      const clientId = this.getGoogleClientId();
      if (!clientId || clientId.trim() === '') {
        console.warn('[NativeAuth] No valid Google Client ID configured');
        this.initializationError = 'Google Client ID not configured';
        this.hasValidClientId = false;
        this.isInitialized = true;
        return;
      }

      console.log('[NativeAuth] Initializing GoogleAuth plugin with client ID');
      await GoogleAuth.initialize({
        clientId: clientId,
        scopes: ['profile', 'email'],
      });

      this.hasValidClientId = true;
      this.isInitialized = true;
      console.log('[NativeAuth] Native auth service initialized successfully');
    } catch (error) {
      console.error('[NativeAuth] Failed to initialize:', error);
      this.initializationError = error.toString();
      this.isInitialized = true;
    }
  }

  private getGoogleClientId(): string {
    // CORRECTED: Use your actual Android client ID
    const androidClientId = '11083941790-vgbdbj6j313ggo6jbt9agp3bvrlilam8.apps.googleusercontent.com';
    console.log('[NativeAuth] Using Android Google Client ID for native auth');
    return androidClientId;
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

      // CRITICAL: Strict native vs web separation
      if (this.shouldUseNativeAuth()) {
        console.log('[NativeAuth] Using native Google Sign-In - no browser redirects');

        if (this.initializationError) {
          console.error('[NativeAuth] Initialization error:', this.initializationError);
          throw new Error(`Native auth not available: ${this.initializationError}`);
        }

        if (!this.hasValidClientId) {
          console.error('[NativeAuth] No valid client ID configured');
          throw new Error('Google Client ID not configured for native auth');
        }

        console.log('[NativeAuth] Calling GoogleAuth.signIn()...');
        const result = await GoogleAuth.signIn();
        
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
          throw new Error('No ID token received from Google');
        }

        // Validate token format
        const tokenParts = result.authentication.idToken.split('.');
        if (tokenParts.length !== 3) {
          console.error('[NativeAuth] Invalid ID token format:', tokenParts.length);
          throw new Error('Invalid ID token format received from Google');
        }

        console.log('[NativeAuth] Token validation passed, calling Supabase...');
        
        // Add timeout for Supabase token exchange
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Supabase token exchange timed out after 30 seconds'));
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
          throw error;
        }

        console.log('[NativeAuth] Supabase sign-in successful:', {
          hasUser: !!data.user,
          userEmail: data.user?.email,
          hasSession: !!data.session
        });

        console.log('[NativeAuth] Successfully signed in with Google natively');
        toast.success('Signed in successfully');

        // CRITICAL: No redirect needed - auth context will handle navigation
        return;
      } else {
        // CRITICAL FIX: Never fallback to web OAuth in native apps
        console.log('[NativeAuth] Native auth not available - throwing error instead of web fallback');
        throw new Error('Native Google authentication not available');
      }
    } catch (error: any) {
      console.error('[NativeAuth] Google sign-in failed:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code || 'unknown'
      });

      // Enhanced error categorization
      let errorCategory = 'unknown';
      if (error.message?.includes('timeout')) {
        errorCategory = 'timeout';
      } else if (error.message?.includes('token')) {
        errorCategory = 'token';
      } else if (error.message?.includes('network')) {
        errorCategory = 'network';
      } else if (error.message?.includes('cancelled')) {
        errorCategory = 'cancelled';
      }

      console.error('[NativeAuth] Error category:', errorCategory);

      // CRITICAL: No fallback to web OAuth in native apps
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
          await GoogleAuth.signOut();
          console.log('[NativeAuth] Signed out from Google natively');
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
           nativeIntegrationService.isGoogleAuthAvailable() &&
           this.isInitialized &&
           this.hasValidClientId;
  }

  private handleAuthError(error: any, provider: string = 'Google'): void {
    let errorMessage = `${provider} sign-in failed`;

    if (error.message?.includes('Client ID not configured')) {
      errorMessage = `${provider} sign-in is not configured properly.`;
    } else if (error.message?.includes('redirect_uri_mismatch')) {
      errorMessage = `${provider} sign-in configuration error. Please check your redirect URLs.`;
    } else if (error.message?.includes('popup_closed_by_user')) {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
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
}

export const nativeAuthService = NativeAuthService.getInstance();
