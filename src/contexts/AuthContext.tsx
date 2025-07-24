
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthContextType } from '@/types/auth';
import { ensureProfileExists as ensureProfileExistsService, updateUserProfile as updateUserProfileService } from '@/services/profileService';
import { 
  signInWithGoogle as signInWithGoogleService,
  signInWithApple as signInWithAppleService,
  signInWithEmail as signInWithEmailService,
  signUp as signUpService,
  resetPassword as resetPasswordService,
  signOut as signOutService,
  refreshSession as refreshSessionService
} from '@/services/authService';
import { useNavigate, useLocation } from 'react-router-dom';
import { LocationProvider } from '@/contexts/LocationContext';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { nativeAuthService } from '@/services/nativeAuthService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { authStateManager } from '@/services/authStateManager';
import { loadingStateManager, LoadingPriority } from '@/services/loadingStateManager';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProviderCore({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCreationAttempts, setProfileCreationAttempts] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isNative = useMemo(() => nativeIntegrationService.isRunningNatively(), []);
  const twaEnv = useMemo(() => detectTWAEnvironment(), []);

  // Initialize native services
  useEffect(() => {
    const initializeNativeServices = async () => {
      if (isNative) {
        console.log('[AuthContext] Initializing native services');
        loadingStateManager.setLoading('auth-init', LoadingPriority.CRITICAL, 'Initializing authentication...');
        
        try {
          await nativeIntegrationService.initialize();
          await nativeAuthService.initialize();
          console.log('[AuthContext] Native services initialized');
        } catch (error) {
          console.error('[AuthContext] Failed to initialize native services:', error);
        } finally {
          loadingStateManager.clearLoading('auth-init');
        }
      }
    };

    initializeNativeServices();
  }, [isNative]);

  // Enhanced session validation for native apps
  const validateStoredSession = useCallback((): Session | null => {
    try {
      const storedSession = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (!storedSession) return null;

      const sessionData = JSON.parse(storedSession);
      
      if (sessionData?.access_token && sessionData?.expires_at) {
        const now = Date.now() / 1000;
        if (sessionData.expires_at > now) {
          console.log('[AuthContext] Valid stored session found');
          return sessionData as Session;
        } else {
          console.log('[AuthContext] Stored session expired');
        }
      }
      
      return null;
    } catch (error) {
      console.warn('[AuthContext] Error validating stored session:', error);
      return null;
    }
  }, []);

  const ensureProfileExists = async (forceRetry = false): Promise<boolean> => {
    if (!user) return false;
    if (profileCreationAttempts >= 3 && !forceRetry) return false;

    try {
      console.log('[AuthContext] Ensuring profile exists for user:', user.id);
      
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.message !== 'Row not found') {
        throw fetchError;
      }

      if (existingProfile) {
        console.log('[AuthContext] Profile already exists');
        return true;
      }

      // Create profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }

      console.log('[AuthContext] Profile created successfully');
      return true;
    } catch (error) {
      console.error('[AuthContext] Profile creation failed:', error);
      setProfileCreationAttempts(prev => prev + 1);
      
      // Retry with exponential backoff
      if (profileCreationAttempts < 3) {
        const delay = Math.pow(2, profileCreationAttempts) * 1000;
        setTimeout(() => ensureProfileExists(false), delay);
      }
      
      return false;
    }
  };

  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    try {
      if (!user) return false;
      
      loadingStateManager.setLoading('profile-update', LoadingPriority.MEDIUM, 'Updating profile...');
      
      const { error } = await supabase.auth.updateUser({
        data: metadata
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('[AuthContext] Profile update failed:', error);
      return false;
    } finally {
      loadingStateManager.clearLoading('profile-update');
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-google', LoadingPriority.HIGH, 'Signing in with Google...');
      
      // Try native auth first if available
      if (isNative) {
        console.log('[AuthContext] Using native Google authentication');
        await nativeAuthService.signInWithGoogle();
      } else {
        console.log('[AuthContext] Using web Google authentication');
        await signInWithGoogleService();
      }
    } catch (error) {
      console.error('[AuthContext] Google sign-in failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-google');
    }
  };

  const signInWithApple = async (): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-apple', LoadingPriority.HIGH, 'Signing in with Apple...');
      
      if (isNative) {
        console.log('[AuthContext] Using native Apple authentication');
        await nativeAuthService.signInWithApple();
      } else {
        console.log('[AuthContext] Using web Apple authentication');
        await signInWithAppleService();
      }
    } catch (error) {
      console.error('[AuthContext] Apple sign-in failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-apple');
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-email', LoadingPriority.HIGH, 'Signing in...');
      await signInWithEmailService(email, password);
    } catch (error) {
      console.error('[AuthContext] Email sign-in failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-email');
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-signup', LoadingPriority.HIGH, 'Creating account...');
      await signUpService(email, password);
    } catch (error) {
      console.error('[AuthContext] Sign-up failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-signup');
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-reset', LoadingPriority.HIGH, 'Sending reset email...');
      await resetPasswordService(email);
    } catch (error) {
      console.error('[AuthContext] Password reset failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-reset');
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-signout', LoadingPriority.HIGH, 'Signing out...');
      
      if (isNative) {
        await nativeAuthService.signOut();
      } else {
        await signOutService(navigate);
      }
      
      // Clear local state
      setSession(null);
      setUser(null);
      setProfileCreationAttempts(0);
      
      // Clear auth state manager
      authStateManager.resetAuthState();
    } catch (error) {
      console.error('[AuthContext] Sign-out failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-signout');
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      loadingStateManager.setLoading('auth-refresh', LoadingPriority.MEDIUM, 'Refreshing session...');
      const refreshedSession = await refreshSessionService();
      setSession(refreshedSession);
      setUser(refreshedSession?.user ?? null);
    } catch (error) {
      console.error('[AuthContext] Session refresh failed:', error);
      throw error;
    } finally {
      loadingStateManager.clearLoading('auth-refresh');
    }
  };

  // Initialize auth state with timeout and recovery
  useEffect(() => {
    let authTimeout: NodeJS.Timeout;
    let isMounted = true;
    
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing authentication...');
      loadingStateManager.setLoading('auth-session', LoadingPriority.HIGH, 'Checking authentication...');
      
      // Set a timeout to prevent infinite loading
      authTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('[AuthContext] Auth initialization timeout - using emergency recovery');
          setIsLoading(false);
          loadingStateManager.clearLoading('auth-session');
          
          // Emergency recovery: check for any stored session
          const storedSession = validateStoredSession();
          if (storedSession) {
            console.log('[AuthContext] Emergency recovery: found stored session');
            setSession(storedSession);
            setUser(storedSession.user);
          }
        }
      }, 8000); // 8 second timeout
      
      try {
        // For native apps, try synchronous validation first for faster loading
        if (isNative) {
          const storedSession = validateStoredSession();
          if (storedSession) {
            console.log('[AuthContext] Using validated stored session');
            setSession(storedSession);
            setUser(storedSession.user);
            setIsLoading(false);
            loadingStateManager.clearLoading('auth-session');
            clearTimeout(authTimeout);
            return;
          }
        }

        // Fallback to async validation with promise race
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        );
        
        const { data: { session: currentSession }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (!isMounted) return;
        
        if (error) {
          console.error('[AuthContext] Session validation error:', error);
          // Don't fail completely, allow user to proceed
        } else {
          console.log('[AuthContext] Session validation complete:', {
            hasSession: !!currentSession,
            userId: currentSession?.user?.id
          });
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      } catch (error) {
        console.error('[AuthContext] Auth initialization failed:', error);
        
        if (isMounted) {
          // Try emergency recovery
          const storedSession = validateStoredSession();
          if (storedSession) {
            console.log('[AuthContext] Error recovery: using stored session');
            setSession(storedSession);
            setUser(storedSession.user);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          loadingStateManager.clearLoading('auth-session');
          clearTimeout(authTimeout);
        }
      }
    };

    initializeAuth();
    
    return () => {
      isMounted = false;
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
    };
  }, [isNative, validateStoredSession]);

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[AuthContext] Auth state changed:', event, !!currentSession);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (event === 'SIGNED_IN' && currentSession?.user) {
          // Trigger profile creation in background without blocking UI
          setTimeout(() => {
            ensureProfileExists(false);
          }, 100);
          
          toast.success('Signed in successfully');
        }
        
        if (event === 'SIGNED_OUT') {
          setProfileCreationAttempts(0);
          authStateManager.resetAuthState();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user,
    isLoading,
    signInWithGoogle,
    signInWithApple,
    signOut,
    refreshSession,
    signInWithEmail,
    signUp,
    resetPassword,
    updateUserProfile,
    ensureProfileExists,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <LocationProvider>
      <AuthProviderCore>{children}</AuthProviderCore>
    </LocationProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
