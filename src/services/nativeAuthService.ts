
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
      this.isInitialized = true; // Mark as initialized even on error to prevent retry loops
      // Don't throw error, just log it - fallback to web auth
    }
  }

  private getGoogleClientId(): string {
    // Try to get from environment variables or configuration
    // In production, this should be set via build process or environment
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || 
                    '11083941790-oi1vrl8bmsjajc0h1ka4f9q0qjmm80o9.apps.googleusercontent.com';
    
    console.log('[NativeAuth] Using Google Client ID:', clientId ? 'configured' : 'not configured');
    return clientId;
  }

  async signInWithGoogle(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting Google sign-in');
      
      // Check if we should use native auth
      if (this.shouldUseNativeAuth()) {
        console.log('[NativeAuth] Using native Google Sign-In');
        
        if (this.initializationError) {
          throw new Error(`Native auth not available: ${this.initializationError}`);
        }

        if (!this.hasValidClientId) {
          throw new Error('Google Client ID not configured for native auth');
        }
        
        const result = await GoogleAuth.signIn();
        console.log('[NativeAuth] Native Google sign-in result:', { 
          hasIdToken: !!result.authentication?.idToken,
          email: result.email 
        });

        if (!result.authentication?.idToken) {
          throw new Error('No ID token received from Google');
        }

        // Sign in to Supabase with the Google ID token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.authentication.idToken,
        });

        if (error) {
          console.error('[NativeAuth] Supabase sign-in error:', error);
          throw error;
        }

        console.log('[NativeAuth] Successfully signed in with Google natively');
        toast.success('Signed in successfully');
      } else {
        // Fallback to web OAuth
        console.log('[NativeAuth] Using web OAuth Google Sign-In');
        await this.signInWithGoogleWeb();
      }
    } catch (error: any) {
      console.error('[NativeAuth] Google sign-in failed:', error);
      
      // Try web fallback if native fails
      if (this.shouldUseNativeAuth() && !error.message?.includes('popup_closed_by_user')) {
        console.log('[NativeAuth] Native auth failed, trying web fallback');
        try {
          await this.signInWithGoogleWeb();
          return;
        } catch (webError) {
          console.error('[NativeAuth] Web fallback also failed:', webError);
        }
      }
      
      // Show appropriate error message
      this.handleAuthError(error);
      throw error;
    }
  }

  private async signInWithGoogleWeb(): Promise<void> {
    const redirectUrl = `${window.location.origin}/app/auth`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('[NativeAuth] OAuth sign-in error:', error);
      throw error;
    }

    if (data?.url) {
      console.log('[NativeAuth] Redirecting to OAuth URL:', data.url);
      setTimeout(() => {
        window.location.href = data.url;
      }, 100);
    }
  }

  async signInWithApple(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting Apple sign-in');
      
      // For now, Apple Sign-In will use web OAuth
      // Native Apple Sign-In can be implemented later with @capacitor-community/apple-sign-in
      
      const redirectUrl = `${window.location.origin}/app/auth`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('[NativeAuth] Apple OAuth error:', error);
        throw error;
      }

      if (data?.url) {
        console.log('[NativeAuth] Redirecting to Apple OAuth URL:', data.url);
        setTimeout(() => {
          window.location.href = data.url;
        }, 100);
      }
    } catch (error: any) {
      console.error('[NativeAuth] Apple sign-in failed:', error);
      this.handleAuthError(error, 'Apple');
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting sign out');
      
      // Only try native sign out if we're running natively and GoogleAuth is available
      if (this.shouldUseNativeAuth() && !this.initializationError && this.hasValidClientId) {
        try {
          await GoogleAuth.signOut();
          console.log('[NativeAuth] Signed out from Google natively');
        } catch (error) {
          console.warn('[NativeAuth] Failed to sign out from Google natively:', error);
          // Continue with Supabase sign out even if Google sign out fails
        }
      }

      // Sign out from Supabase
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
      errorMessage = `${provider} sign-in is not configured properly. Using web authentication instead.`;
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
    
    // Only show error toast for actual failures, not configuration issues
    if (!error.message?.includes('Client ID not configured')) {
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
}

export const nativeAuthService = NativeAuthService.getInstance();
