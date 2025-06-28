
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
      this.isInitialized = true; // Mark as initialized to prevent retry loops
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
        // Web Google Sign-In with improved handling
        console.log('[NativeAuth] Using web Google Sign-In');
        
        // For web, we want to redirect to the current auth page to handle the callback
        const currentUrl = window.location.origin + window.location.pathname;
        const redirectUrl = currentUrl.includes('/app/auth') ? currentUrl : `${window.location.origin}/app/auth`;
        
        console.log('[NativeAuth] Using redirect URL:', redirectUrl);
        
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

        // For web OAuth, the redirect will happen automatically
        // Don't show success toast here as it will be handled after redirect
        console.log('[NativeAuth] OAuth redirect initiated');
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
      
      // For Apple Sign-In, always use web OAuth for now
      const currentUrl = window.location.origin + window.location.pathname;
      const redirectUrl = currentUrl.includes('/app/auth') ? currentUrl : `${window.location.origin}/app/auth`;
      
      console.log('[NativeAuth] Using Apple OAuth with redirect URL:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      console.log('[NativeAuth] Apple OAuth redirect initiated');
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
