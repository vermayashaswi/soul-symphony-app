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
      console.log('[NativeAuth] Starting NATIVE-ONLY Google sign-in process');

      // Step 1: Verify we're in native environment
      if (!nativeIntegrationService.isRunningNatively()) {
        throw new Error('Native Google Auth called in non-native environment');
      }

      // Step 2: Initialize if not already done with better error handling
      if (!this.isInitialized || this.initializationError) {
        console.log('[NativeAuth] Initializing service before sign-in');
        await this.initialize();
        
        // Give a brief moment for initialization to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Check if we can proceed
      if (this.initializationError) {
        console.error('[NativeAuth] Cannot sign in due to initialization error:', this.initializationError);
        throw new Error(`Google Auth initialization failed: ${this.initializationError}`);
      }

      if (!this.shouldUseNativeAuth()) {
        console.log('[NativeAuth] Conditions not met for native auth:', {
          isNative: nativeIntegrationService.isRunningNatively(),
          hasPlugin: !!this.googleAuthPlugin,
          isInitialized: this.isInitialized,
          hasValidClientId: this.hasValidClientId
        });
        throw new Error('Native Google Auth prerequisites not met');
      }

      console.log('[NativeAuth] All prerequisites met, proceeding with native Google sign-in');

      // Step 3: Get Google Auth plugin with retry logic
      let GoogleAuth = await this.getGoogleAuthPlugin();
      if (!GoogleAuth) {
        console.log('[NativeAuth] First attempt to get plugin failed, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        GoogleAuth = await this.getGoogleAuthPlugin();
        
        if (!GoogleAuth) {
          throw new Error('GoogleAuth plugin not available after retry');
        }
      }

      // Step 4: Attempt native sign-in with enhanced timeout and error handling
      console.log('[NativeAuth] Attempting native Google sign-in...');
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Native Google sign-in timed out after 25 seconds'));
        }, 25000); // 25 seconds timeout
      });

      const signInPromise = GoogleAuth.signIn();

      let result;
      try {
        result = await Promise.race([signInPromise, timeoutPromise]);
        console.log('[NativeAuth] Native sign-in completed successfully');
      } catch (signInError: any) {
        console.error('[NativeAuth] Native sign-in failed:', signInError);
        
        // Enhanced error categorization
        if (signInError.message?.includes('timeout')) {
          throw new Error('Google sign-in timed out. Please try again.');
        } else if (signInError.message?.includes('cancelled') || signInError.message?.includes('canceled')) {
          throw new Error('Sign-in was cancelled by user');
        } else if (signInError.message?.includes('network') || signInError.message?.includes('Network')) {
          throw new Error('Network error during sign-in. Please check your internet connection.');
        } else if (signInError.message?.includes('configuration') || signInError.message?.includes('Configuration')) {
          throw new Error('Google sign-in configuration error. Please contact support.');
        } else {
          throw signInError;
        }
      }

      // Step 5: Validate response structure
      if (!result || !result.authentication || !result.authentication.idToken) {
        console.error('[NativeAuth] Invalid response structure:', result);
        throw new Error('Invalid response from Google Auth - missing authentication data');
      }

      const { idToken } = result.authentication;
      console.log('[NativeAuth] Got ID token from native Google Auth, length:', idToken?.length);

      // Step 6: Sign in to Supabase with the token
      console.log('[NativeAuth] Signing in to Supabase with ID token...');
      
      const supabaseTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Supabase sign-in with ID token timed out after 15 seconds'));
        }, 15000); // 15 seconds timeout for Supabase
      });

      const supabaseSignInPromise = supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      let supabaseResult;
      try {
        supabaseResult = await Promise.race([supabaseSignInPromise, supabaseTimeoutPromise]);
      } catch (supabaseError: any) {
        console.error('[NativeAuth] Supabase sign-in failed:', supabaseError);
        
        if (supabaseError.message?.includes('timeout')) {
          throw new Error('Backend authentication timed out. Please try again.');
        } else if (supabaseError.message?.includes('Invalid token')) {
          throw new Error('Invalid authentication token. Please restart the app and try again.');
        } else {
          throw new Error(`Backend authentication failed: ${supabaseError.message}`);
        }
      }

      const { data, error } = supabaseResult;

      if (error) {
        console.error('[NativeAuth] Supabase sign-in error:', error);
        throw new Error(`Authentication failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Authentication succeeded but no user data received');
      }

      console.log('[NativeAuth] Successfully signed in user:', data.user.email);
      toast.success(`Welcome back!`);

    } catch (error: any) {
      console.error('[NativeAuth] Google sign-in failed:', {
        message: error.message,
        stack: error.stack,
        hasPlugin: !!this.googleAuthPlugin,
        isInitialized: this.isInitialized,
        initError: this.initializationError,
        isNative: nativeIntegrationService.isRunningNatively()
      });

      // Re-throw with context preserved
      const enhancedError = new Error(error.message || 'Native Google sign-in failed');
      enhancedError.stack = error.stack;
      throw enhancedError;
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

    if (error.message?.includes('cancelled') || error.message?.includes('canceled')) {
      errorMessage = 'Sign-in was cancelled';
    } else if (error.message?.includes('Network') || error.message?.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message?.includes('Configuration') || error.message?.includes('configuration')) {
      errorMessage = `${provider} sign-in configuration error. Please restart the app and try again.`;
    } else if (error.message?.includes('wrong client ID') || error.message?.includes('OAuth configuration')) {
      errorMessage = 'Google OAuth configuration error. Please contact support.';
    } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      errorMessage = 'Sign-in timed out. Please ensure you have a stable internet connection and try again.';
    } else if (error.message?.includes('not available')) {
      errorMessage = `${provider} sign-in is not available on this device. Please contact support.`;
    } else if (error.message?.includes('Invalid token')) {
      errorMessage = 'Authentication token error. Please restart the app and try again.';
    } else if (error.message?.includes('prerequisites not met')) {
      errorMessage = 'Native authentication is not properly configured. Please contact support.';
    } else if (error.message) {
      errorMessage = `${provider} sign-in failed: ${error.message}`;
    }

    // Only show toast if this is an actual error (not cancellation)
    if (!error.message?.includes('cancelled') && !error.message?.includes('canceled')) {
      toast.error(errorMessage);
    }
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
