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

      if (!nativeIntegrationService.isRunningNatively()) {
        console.log('[NativeAuth] Not running natively - skipping GoogleAuth initialization');
        this.isInitialized = true;
        return;
      }

      if (!nativeIntegrationService.isGoogleAuthAvailable()) {
        console.warn('[NativeAuth] GoogleAuth plugin not available');
        this.initializationError = 'GoogleAuth plugin not available';
        this.isInitialized = true;
        return;
      }

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
    // Use the Android client ID for native auth
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

        // ENHANCED: Add proper error handling and retry logic
        let result;
        try {
          result = await GoogleAuth.signIn();
        } catch (googleError: any) {
          console.error('[NativeAuth] GoogleAuth.signIn() failed:', googleError);

          // Check for specific Google Auth errors
          if (googleError.message?.includes('User cancelled')) {
            console.log('[NativeAuth] User cancelled Google sign-in');
            toast.info('Sign-in cancelled');
            return;
          } else if (googleError.message?.includes('Network')) {
            throw new Error('Network error during Google sign-in. Please check your connection.');
          } else if (googleError.message?.includes('Configuration')) {
            throw new Error('Google sign-in configuration error. Please contact support.');
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
        toast.success('Signed in successfully');
        return;

      } else {
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

    if (error.message?.includes('cancelled')) {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.message?.includes('Network') || error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message?.includes('Configuration') || error.message?.includes('configuration')) {
      errorMessage = `${provider} sign-in configuration error. Please contact support.`;
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
}

export const nativeAuthService = NativeAuthService.getInstance();
