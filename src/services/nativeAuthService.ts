
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from './nativeIntegrationService';
import { toast } from 'sonner';

class NativeAuthService {
  private static instance: NativeAuthService;
  private isInitialized = false;

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
      
      // Only initialize GoogleAuth if running natively
      if (nativeIntegrationService.isRunningNatively()) {
        console.log('[NativeAuth] Running natively, initializing GoogleAuth');
        
        // Initialize GoogleAuth with correct parameters
        await GoogleAuth.initialize({
          clientId: '11083941790-oi1vrl8bmsjajc0h1ka4f9q0qjmm80o9.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          // Remove grantOfflineAccess as it's not part of the initialize options
        });
        
        console.log('[NativeAuth] GoogleAuth initialized successfully');
      } else {
        console.log('[NativeAuth] Running in web, skipping GoogleAuth initialization');
      }

      this.isInitialized = true;
      console.log('[NativeAuth] Native auth service initialized');
    } catch (error) {
      console.error('[NativeAuth] Failed to initialize:', error);
      // Don't throw error, fallback to web auth
      // Only log the error, don't show user-facing toast for initialization issues
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting Google sign-in');
      
      if (nativeIntegrationService.isRunningNatively()) {
        // Check if GoogleAuth is available and initialized
        if (!this.isInitialized) {
          console.log('[NativeAuth] GoogleAuth not initialized, attempting to initialize');
          await this.initialize();
        }
        
        // Native Google Sign-In
        console.log('[NativeAuth] Using native Google Sign-In');
        
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
        // Web Google Sign-In (fallback)
        console.log('[NativeAuth] Using web Google Sign-In fallback');
        
        const redirectUrl = `${window.location.origin}/app/auth`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data?.url) {
          console.log('[NativeAuth] Redirecting to OAuth URL:', data.url);
          setTimeout(() => {
            window.location.href = data.url;
          }, 100);
        }
      }
    } catch (error: any) {
      console.error('[NativeAuth] Google sign-in failed:', error);
      toast.error(`Google sign-in failed: ${error.message}`);
      throw error;
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
      toast.error(`Apple sign-in failed: ${error.message}`);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      console.log('[NativeAuth] Starting sign out');
      
      if (nativeIntegrationService.isRunningNatively()) {
        // Sign out from Google natively
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

  isRunningNatively(): boolean {
    return nativeIntegrationService.isRunningNatively();
  }
}

export const nativeAuthService = NativeAuthService.getInstance();
