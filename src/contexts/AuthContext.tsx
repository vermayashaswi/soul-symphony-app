
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthContextType } from '@/types/auth';
import { ensureProfileExists as ensureProfileExistsService, updateUserProfile as updateUserProfileService } from '@/services/profileService';
import { optimizedProfileService } from '@/services/optimizedProfileService';
import { 
  signInWithGoogle as signInWithGoogleService,
  signInWithApple as signInWithAppleService,
  signInWithEmail as signInWithEmailService,
  signUp as signUpService,
  resetPassword as resetPasswordService,
  signOut as signOutService,
  refreshSession as refreshSessionService
} from '@/services/authService';
import { debugLogger, logInfo, logError, logAuthError, logProfile, logAuth } from '@/components/debug/DebugPanel';
import { isAppRoute } from '@/routes/RouteHelpers';
import { useLocation } from 'react-router-dom';
import { LocationProvider } from '@/contexts/LocationContext';

import { nativeAuthService } from '@/services/nativeAuthService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { nativeNavigationService } from '@/services/nativeNavigationService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_AUTO_PROFILE_ATTEMPTS = 2; // Reduced for native app stability
const BASE_RETRY_DELAY = 2000; // Increased delay

function AuthProviderCore({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCreationInProgress, setProfileCreationInProgress] = useState(false);
  const [profileCreationAttempts, setProfileCreationAttempts] = useState(0);
  const [lastProfileAttemptTime, setLastProfileAttemptTime] = useState<number>(0);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [profileExistsStatus, setProfileExistsStatus] = useState<boolean | null>(null);
  const [profileCreationComplete, setProfileCreationComplete] = useState(false);
  const [autoRetryTimeoutId, setAutoRetryTimeoutId] = useState<NodeJS.Timeout | null>(null);
  // Session tracking state removed - now handled by SessionProvider
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authStateStable, setAuthStateStable] = useState(false);
  const location = useLocation();

  // Initialize native services
  useEffect(() => {
       // Initialize native auth service and deep link handling
        if (nativeIntegrationService.isRunningNatively()) {
          nativeAuthService.initialize();
        }
    const initializeNativeServices = async () => {
      try {
        console.log('[AuthContext] Initializing native services');
        await nativeIntegrationService.initialize();
        await nativeAuthService.initialize();
        console.log('[AuthContext] Native services initialized');
      } catch (error) {
        console.error('[AuthContext] Failed to initialize native services:', error);
      }
    };

    initializeNativeServices();
  }, []);

  const detectUserLanguage = (): string => {
    const browserLanguage = navigator.language || navigator.languages?.[0] || 'en';
    const languageCode = browserLanguage.split('-')[0].toLowerCase();
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn'];
    return supportedLanguages.includes(languageCode) ? languageCode : 'en';
  };

  const getReferrer = (): string | null => {
    const referrer = document.referrer;
    if (!referrer) return null;
    
    try {
      const referrerUrl = new URL(referrer);
      const currentUrl = new URL(window.location.href);
      
      if (referrerUrl.hostname !== currentUrl.hostname) {
        return referrer;
      }
    } catch (error) {
      console.warn('Error parsing referrer URL:', error);
    }
    
    return null;
  };

  // Session creation now handled by SessionProvider/SessionManager
  // Remove old session creation logic - this will be handled by the new SessionProvider

  // Conversion tracking now handled by SessionProvider
  // Remove this function as it's now managed by the SessionProvider

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobileDevice(isMobile);
      logInfo(`Detected ${isMobile ? 'mobile' : 'desktop'} device`, 'AuthContext');
    };

    checkMobile();
    
    return () => {
      if (autoRetryTimeoutId) {
        clearTimeout(autoRetryTimeoutId);
      }
    };
  }, [autoRetryTimeoutId]);

  const ensureProfileExists = async (forceRetry = false): Promise<boolean> => {
    if (!user || (profileCreationInProgress && !forceRetry)) {
      logProfile(`Profile check skipped: ${!user ? 'No user' : 'Already in progress'}`, 'AuthContext');
      return false;
    }
    
    if (profileExistsStatus === true || profileCreationComplete) {
      logProfile('Profile already verified as existing', 'AuthContext');
      return true;
    }
    
    const now = Date.now();
    if (!forceRetry && now - lastProfileAttemptTime < 3000) { // Reduced delay for better performance
      logProfile('Skipping profile check - too soon after last attempt', 'AuthContext');
      return profileExistsStatus || false;
    }
    
    try {
      setProfileCreationInProgress(true);
      setLastProfileAttemptTime(now);
      setProfileCreationAttempts(prev => prev + 1);
      
      logProfile(`Optimized profile attempt #${profileCreationAttempts + 1} for user: ${user.id}`, 'AuthContext', {
        userEmail: user.email,
        provider: user.app_metadata?.provider,
        isNative: nativeIntegrationService.isRunningNatively()
      });
      
      // Use optimized profile service first, fallback to original if needed
      const optimizedResult = await optimizedProfileService.createOrVerifyProfile(user);
      
      if (optimizedResult.success) {
        logProfile(`Optimized profile ${optimizedResult.action} successfully`, 'AuthContext');
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
        debugLogger.setLastProfileError(null);
        
        // Call optimized auth handler for additional setup
        try {
          await supabase.functions.invoke('optimized-auth-handler', {
            body: {
              operation: 'optimize_auth_flow',
              user_id: user.id,
              session_data: {
                user: user,
                session_fingerprint: `${user.id}_${Date.now()}`
              }
            }
          });
        } catch (authHandlerError) {
          console.warn('[AuthContext] Auth handler optimization failed:', authHandlerError);
        }
        
        return true;
      } else {
        // Fallback to original service
        logProfile('Fallback to original profile service', 'AuthContext');
        const result = await ensureProfileExistsService(user);
        
        if (result) {
          logProfile('Profile created or verified successfully (fallback)', 'AuthContext');
          setProfileCreationAttempts(0);
          setProfileExistsStatus(true);
          setProfileCreationComplete(true);
          debugLogger.setLastProfileError(null);
          return true;
        } else {
          const errorMsg = `Profile creation failed on attempt #${profileCreationAttempts + 1}`;
          logAuthError(errorMsg, 'AuthContext');
          debugLogger.setLastProfileError(errorMsg);
          setProfileExistsStatus(false);
          
          // Reduced retry attempts for better UX
          const maxAttempts = Math.min(MAX_AUTO_PROFILE_ATTEMPTS, 2);
          
          if (profileCreationAttempts < maxAttempts) {
            const nextAttemptDelay = BASE_RETRY_DELAY * Math.pow(1.2, profileCreationAttempts); // Reduced exponential factor
            logProfile(`Scheduling automatic retry in ${nextAttemptDelay}ms`, 'AuthContext');
            
            if (autoRetryTimeoutId) {
              clearTimeout(autoRetryTimeoutId);
            }
            
            const timeoutId = setTimeout(() => {
              logProfile(`Executing automatic retry #${profileCreationAttempts + 1}`, 'AuthContext');
              setAutoRetryTimeoutId(null);
              ensureProfileExists(true).catch(e => {
                logAuthError(`Auto-retry failed: ${e.message}`, 'AuthContext', e);
              });
            }, nextAttemptDelay);
            
            setAutoRetryTimeoutId(timeoutId);
          }
          
          return false;
        }
      }
    } catch (error: any) {
      const errorMsg = `Error in ensureProfileExists: ${error.message}`;
      logAuthError(errorMsg, 'AuthContext', error);
      debugLogger.setLastProfileError(errorMsg);
      setProfileExistsStatus(false);
      return false;
    } finally {
      setProfileCreationInProgress(false);
    }
  };

  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    logProfile(`Updating user profile metadata`, 'AuthContext', { metadataKeys: Object.keys(metadata) });
    
    if (!metadata.timezone) {
      try {
        metadata.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        logProfile(`Adding detected timezone to metadata: ${metadata.timezone}`, 'AuthContext');
      } catch (error) {
        logError('Could not detect timezone', 'AuthContext', error);
      }
    }
    
    const result = await updateUserProfileService(user, metadata);
    if (result) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        logProfile('User profile updated successfully', 'AuthContext');
        
        // Conversion tracking now handled by SessionProvider
      }
    } else {
      logAuthError('Failed to update user profile', 'AuthContext');
    }
    return result;
  };

  const signInWithGoogle = async (): Promise<void> => {
    setIsLoading(true);
    logInfo('Initiating Google sign-in', 'AuthContext', { 
      origin: window.location.origin,
      pathname: window.location.pathname
    });
    
    try {
      await signInWithGoogleService();
      logInfo('Google sign-in initiated', 'AuthContext');
      
      // Conversion tracking now handled by SessionProvider
    } catch (error: any) {
      logAuthError(`Google sign-in failed: ${error.message}`, 'AuthContext', error);
      setIsLoading(false);
    }
  };

  const signInWithApple = async (): Promise<void> => {
    setIsLoading(true);
    logInfo('Initiating Apple ID sign-in', 'AuthContext', { 
      origin: window.location.origin,
      pathname: window.location.pathname
    });
    
    try {
      await signInWithAppleService();
      logInfo('Apple ID sign-in initiated', 'AuthContext');
      
      // Conversion tracking now handled by SessionProvider
    } catch (error: any) {
      logAuthError(`Apple ID sign-in failed: ${error.message}`, 'AuthContext', error);
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    logInfo('Initiating email sign-in', 'AuthContext', { 
      email,
      origin: window.location.origin,
      pathname: window.location.pathname
    });
    
    try {
      await signInWithEmailService(email, password);
      logInfo('Email sign-in initiated', 'AuthContext');
      
      // Conversion tracking now handled by SessionProvider
    } catch (error: any) {
      logAuthError(`Email sign-in failed: ${error.message}`, 'AuthContext', error);
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    logInfo('Initiating sign-up', 'AuthContext', { 
      email,
      origin: window.location.origin,
      pathname: window.location.pathname
    });
    
    try {
      await signUpService(email, password);
      logInfo('Sign-up initiated', 'AuthContext');
      
      // Conversion tracking now handled by SessionProvider
    } catch (error: any) {
      logAuthError(`Sign-up failed: ${error.message}`, 'AuthContext', error);
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setIsLoading(true);
    logInfo('Initiating password reset', 'AuthContext', { 
      email,
      origin: window.location.origin,
      pathname: window.location.pathname
    });
    
    try {
      await resetPasswordService(email);
      logInfo('Password reset initiated', 'AuthContext');
    } catch (error: any) {
      logAuthError(`Password reset failed: ${error.message}`, 'AuthContext', error);
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log('[AuthContext] Attempting to sign out user');
      
      // Conversion tracking now handled by SessionProvider
      
      // Clear local state immediately
      setSession(null);
      setUser(null);
      setProfileExistsStatus(null);
      setProfileCreationComplete(false);
      // Session ID tracking now handled by SessionProvider
      setAuthStateStable(false);
      
      // Call the sign out service
      await signOutService((path: string) => {
        console.log(`[AuthContext] Redirecting to ${path} after signout`);
        // Always redirect to onboarding after logout
        window.location.href = '/app/onboarding';
      });
    } catch (error: any) {
      console.error('[AuthContext] Error during sign out:', error);
      toast.error(`Error signing out: ${error.message}`);
      
      // Even if signout fails, redirect to onboarding
      window.location.href = '/app/onboarding';
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const currentSession = await refreshSessionService();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (error) {
    }
  };

  const createOrVerifyProfile = async (currentUser: User): Promise<boolean> => {
    if (profileCreationInProgress || profileCreationComplete) {
      logProfile(`Profile creation skipped: ${profileCreationInProgress ? 'In progress' : 'Already complete'}`, 'AuthContext');
      return profileExistsStatus || false;
    }
    
    if (profileExistsStatus === true) {
      logProfile('Profile already exists, skipping creation', 'AuthContext');
      return true;
    }
    
    try {
      setProfileCreationInProgress(true);
      setProfileCreationAttempts(prev => prev + 1);
      
      logProfile(`Attempt #${profileCreationAttempts + 1} to create profile for user: ${currentUser.email}`, 'AuthContext', {
        userProvider: currentUser.app_metadata?.provider,
        userMetadataKeys: currentUser.user_metadata ? Object.keys(currentUser.user_metadata) : []
      });
      
      // Increased delay for native app stability
      if (isMobileDevice || nativeIntegrationService.isRunningNatively()) {
        logProfile('Mobile/Native device detected, adding stabilization delay', 'AuthContext');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        logProfile(`Profile created or verified for user: ${currentUser.email}`, 'AuthContext');
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
          debugLogger.setLastProfileError(null);
          
          // Session creation now handled by SessionProvider
        
        return true;
      } else {
        logAuthError('First attempt to create profile failed, retrying once...', 'AuthContext');
        
        await new Promise(resolve => setTimeout(resolve, 2500)); // Increased retry delay
        
        const retryResult = await ensureProfileExistsService(currentUser);
        if (retryResult) {
          logProfile(`Profile created or verified on retry for user: ${currentUser.email}`, 'AuthContext');
          setProfileCreationAttempts(0);
          setProfileExistsStatus(true);
          setProfileCreationComplete(true);
          debugLogger.setLastProfileError(null);
          
          // Session creation now handled by SessionProvider
          
          return true;
        }
        
        const errorMsg = `Failed to create profile after retry for user: ${currentUser.email}`;
        logAuthError(errorMsg, 'AuthContext');
        debugLogger.setLastProfileError(errorMsg);
        setProfileExistsStatus(false);
        
        const maxAttempts = MAX_AUTO_PROFILE_ATTEMPTS;
        
        if (profileCreationAttempts < maxAttempts) {
          const nextAttemptDelay = BASE_RETRY_DELAY * Math.pow(1.5, profileCreationAttempts);
          logProfile(`Scheduling automatic retry in ${nextAttemptDelay}ms`, 'AuthContext');
          
          if (autoRetryTimeoutId) {
            clearTimeout(autoRetryTimeoutId);
          }
          
          const timeoutId = setTimeout(() => {
            logProfile(`Executing automatic retry #${profileCreationAttempts + 1}`, 'AuthContext');
            setAutoRetryTimeoutId(null);
            ensureProfileExists(true).catch(e => {
              logAuthError(`Auto-retry failed: ${e.message}`, 'AuthContext', e);
            });
          }, nextAttemptDelay);
          
          setAutoRetryTimeoutId(timeoutId);
        }
        
        return false;
      }
    } catch (error: any) {
      const errorMsg = `Error in profile creation: ${error.message}`;
      logAuthError(errorMsg, 'AuthContext', error);
      debugLogger.setLastProfileError(errorMsg);
      setProfileExistsStatus(false);
      return false;
    } finally {
      setProfileCreationInProgress(false);
    }
  };

  useEffect(() => {
    if (authInitialized) return;
    
    logInfo("Setting up auth state listener", 'AuthContext');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        logInfo(`Auth state changed: ${event}, user: ${currentSession?.user?.email}`, 'AuthContext', {
          isNative: nativeIntegrationService.isRunningNatively(),
          event,
          hasUser: !!currentSession?.user,
          userId: currentSession?.user?.id
        });
        
        // Prevent loops by checking if this is the same session
        if (currentSession?.access_token === session?.access_token && event !== 'SIGNED_OUT') {
          logInfo('Same session detected, skipping processing', 'AuthContext');
          return;
        }
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Mark auth state as stable after processing - faster for native
        if (!authStateStable) {
          const stabilityDelay = nativeIntegrationService.isRunningNatively() ? 200 : 1000;
          setTimeout(() => {
            setAuthStateStable(true);
          }, stabilityDelay);
        }
        
        // Session tracking now handled by SessionProvider
        if (event === 'SIGNED_IN' && currentSession?.user) {
          
          // CRITICAL: For native apps, decouple profile creation from navigation
          const isNative = nativeIntegrationService.isRunningNatively();
          
          if (isNative) {
            console.log('[AuthContext] NATIVE: Starting background profile creation - navigation not blocked');
            
            // Immediate navigation trigger - don't wait for profile
            setTimeout(() => {
              logProfile('NATIVE: Profile creation started in background', 'AuthContext', {
                userId: currentSession.user.id,
                provider: currentSession.user.app_metadata?.provider
              });
              
              createOrVerifyProfile(currentSession.user)
                .then(success => {
                  if (success) {
                    logProfile('NATIVE: Background profile creation completed successfully', 'AuthContext');
                  } else {
                    logProfile('NATIVE: Background profile creation failed - will retry', 'AuthContext');
                  }
                })
                .catch(error => {
                  logAuthError(`NATIVE: Background profile creation error: ${error.message}`, 'AuthContext', error);
                });
            }, 100); // Minimal delay for native
            
          } else {
            // Web: Use existing logic with longer delays for stability
            const initialDelay = isMobileDevice ? 3000 : 2000;
            
            logProfile(`WEB: Scheduling profile creation in ${initialDelay}ms for platform stability`, 'AuthContext');
            
            setTimeout(() => {
              createOrVerifyProfile(currentSession.user)
                .catch(error => {
                  logAuthError(`WEB: Error in initial profile creation: ${error.message}`, 'AuthContext', error);
                });
            }, initialDelay);
          }

          // Conversion tracking now handled by SessionProvider
        }
        
        // Improved loading state management - immediate for native, faster for web
        const loadingDelay = nativeIntegrationService.isRunningNatively() 
          ? 50  // Almost immediate for native to enable navigation
          : 800;
        
        setTimeout(() => {
          setIsLoading(false);
        }, loadingDelay);

        if (event === 'SIGNED_IN') {
          logInfo('User signed in successfully', 'AuthContext', {
            isNative: nativeIntegrationService.isRunningNatively(),
            userEmail: currentSession?.user?.email
          });
          
          // Show success toast and trigger navigation for authenticated users
          toast.success('Signed in successfully');
          
          // REMOVED: Navigation is now handled centrally by AuthStateManager
          // AuthContext no longer handles navigation to prevent conflicts
        } else if (event === 'SIGNED_OUT') {
          logInfo('User signed out', 'AuthContext');
          setProfileExistsStatus(null);
          setProfileCreationComplete(false);
          setAuthStateStable(false);
          debugLogger.setLastProfileError(null);
          
          if (autoRetryTimeoutId) {
            clearTimeout(autoRetryTimeoutId);
            setAutoRetryTimeoutId(null);
          }
          
          if (isAppRoute(location.pathname)) {
            toast.info('Signed out');
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      logInfo(`Initial session check: ${currentSession?.user?.email || 'No session'}`, 'AuthContext', {
        isNative: nativeIntegrationService.isRunningNatively(),
        hasUser: !!currentSession?.user
      });
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        // Session tracking now handled by SessionProvider
        
        // CRITICAL: For native apps, decouple profile creation from initial load
        const isNative = nativeIntegrationService.isRunningNatively();
        
        if (isNative) {
          console.log('[AuthContext] NATIVE: Starting initial background profile creation');
          
          // Immediate profile creation for native - don't block UI
          setTimeout(() => {
            logProfile('NATIVE: Initial profile creation started in background', 'AuthContext', {
              userId: currentSession.user.id
            });
            
            createOrVerifyProfile(currentSession.user)
              .then(success => {
                if (success) {
                  logProfile('NATIVE: Initial background profile creation completed', 'AuthContext');
                } else {
                  logProfile('NATIVE: Initial background profile creation failed', 'AuthContext');
                }
              })
              .catch(error => {
                logAuthError(`NATIVE: Initial background profile creation error: ${error.message}`, 'AuthContext', error);
              });
          }, 100);
          
        } else {
          // Web: Use existing logic with stability delays
          const initialDelay = isMobileDevice ? 3000 : 2000;
          
          logProfile(`WEB: Scheduling initial profile creation in ${initialDelay}ms for platform stability`, 'AuthContext');
          
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => {
                logAuthError(`WEB: Error in initial profile creation: ${error.message}`, 'AuthContext', error);
              });
          }, initialDelay);
        }
      }
      
      // Better timing for initialization completion - immediate for native
      const initDelay = nativeIntegrationService.isRunningNatively() 
        ? 100  // Much faster for native
        : 1000;
      
      setTimeout(() => {
        setIsLoading(false);
        setAuthInitialized(true);
        setAuthStateStable(true);
      }, initDelay);
    });

    return () => {
      subscription.unsubscribe();
      if (autoRetryTimeoutId) {
        clearTimeout(autoRetryTimeoutId);
      }
    };
  }, [authInitialized, isMobileDevice, location.pathname]);

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
