
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
import { debugLogger, logInfo, logError, logAuthError, logProfile, logAuth } from '@/components/debug/DebugPanel';
import { isAppRoute } from '@/routes/RouteHelpers';
import { useLocation } from 'react-router-dom';
import { SessionTrackingService } from '@/services/sessionTrackingService';
import { LocationProvider } from '@/contexts/LocationContext';
import { detectTWAEnvironment } from '@/utils/twaDetection';
import { nativeAuthService } from '@/services/nativeAuthService';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { nativeNavigationService } from '@/services/nativeNavigationService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_AUTO_PROFILE_ATTEMPTS = 2; // Reduced for TWA stability
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
  const [sessionCreated, setSessionCreated] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authStateStable, setAuthStateStable] = useState(false);
  const location = useLocation();
  const twaEnv = detectTWAEnvironment();

  // Simplified native initialization
  useEffect(() => {
    if (nativeIntegrationService.isRunningNatively()) {
      nativeAuthService.initialize().catch(error => {
        console.warn('[AuthContext] Native auth initialization failed:', error);
      });
    }
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

  const createUserSession = async (userId: string): Promise<boolean> => {
    try {
      console.log('Creating enhanced user session for user:', userId);
      
      if (currentSessionId) {
        console.log('Session already exists for user, skipping creation');
        return true;
      }
      
      const deviceType = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const userLanguage = detectUserLanguage();
      const referrer = getReferrer();
      const utmParams = SessionTrackingService.extractUtmParameters();
      
      let locationData = null;
      try {
        locationData = await SessionTrackingService.detectLocation();
        console.log('Location detected:', locationData);
      } catch (error) {
        console.warn('Location detection failed:', error);
      }
      
      const sessionData = {
        userId,
        deviceType,
        userAgent: navigator.userAgent,
        entryPage: window.location.pathname,
        lastActivePage: window.location.pathname,
        language: userLanguage,
        referrer,
        countryCode: locationData?.country,
        currency: locationData?.currency,
        utmSource: utmParams.utm_source,
        utmMedium: utmParams.utm_medium,
        utmCampaign: utmParams.utm_campaign,
        utmTerm: utmParams.utm_term,
        utmContent: utmParams.utm_content,
        gclid: utmParams.gclid,
        fbclid: utmParams.fbclid,
        attributionData: {
          detectedAt: new Date().toISOString(),
          userAgent: navigator.userAgent.substring(0, 200),
          screen: {
            width: window.screen?.width,
            height: window.screen?.height,
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
      };
      
      console.log('Creating session with enhanced tracking data:', {
        deviceType: sessionData.deviceType,
        language: sessionData.language,
        countryCode: sessionData.countryCode,
        currency: sessionData.currency,
        utmSource: sessionData.utmSource,
        hasLocation: !!locationData,
      });
      
      const sessionId = await SessionTrackingService.createUserSession(sessionData);
      
      if (sessionId) {
        setCurrentSessionId(sessionId);
        console.log('Enhanced user session created successfully with ID:', sessionId);
        return true;
      } else {
        console.error('Failed to create enhanced user session');
        return false;
      }
    } catch (e) {
      console.error('Exception creating enhanced user session:', e);
      return false;
    }
  };

  const trackConversion = async (eventType: string, eventData: Record<string, any> = {}) => {
    if (currentSessionId) {
      await SessionTrackingService.trackConversion(currentSessionId, eventType, eventData);
    }
  };

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
    if (!forceRetry && now - lastProfileAttemptTime < 5000) { // Increased delay for TWA
      logProfile('Skipping profile check - too soon after last attempt', 'AuthContext');
      return profileExistsStatus || false;
    }
    
    try {
      setProfileCreationInProgress(true);
      setLastProfileAttemptTime(now);
      setProfileCreationAttempts(prev => prev + 1);
      
      logProfile(`Attempt #${profileCreationAttempts + 1} to ensure profile exists for user: ${user.id}`, 'AuthContext', {
        userEmail: user.email,
        provider: user.app_metadata?.provider,
        hasUserMetadata: !!user.user_metadata,
        userMetadataKeys: user.user_metadata ? Object.keys(user.user_metadata) : []
      });
      
      const result = await ensureProfileExistsService(user);
      
      if (result) {
        logProfile('Profile created or verified successfully', 'AuthContext');
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
        debugLogger.setLastProfileError(null);
        
        if (!sessionCreated) {
          const sessionSuccess = await createUserSession(user.id);
          if (sessionSuccess) {
            setSessionCreated(true);
          }
        }
        
        return true;
      } else {
        const errorMsg = `Profile creation failed on attempt #${profileCreationAttempts + 1}`;
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
      }
      
      return result;
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
        
        await trackConversion('profile_updated', { 
          updatedFields: Object.keys(metadata),
          timestamp: new Date().toISOString(),
        });
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
      
      await trackConversion('sign_in_attempt', { 
        method: 'google',
        timestamp: new Date().toISOString(),
      });
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
      
      await trackConversion('sign_in_attempt', { 
        method: 'apple',
        timestamp: new Date().toISOString(),
      });
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
      
      await trackConversion('sign_in_attempt', { 
        method: 'email',
        timestamp: new Date().toISOString(),
      });
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
      
      await trackConversion('sign_up_attempt', { 
        method: 'email',
        timestamp: new Date().toISOString(),
      });
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
      
      await trackConversion('sign_out', {
        timestamp: new Date().toISOString(),
      });
      
      // Clear local state immediately
      setSession(null);
      setUser(null);
      setProfileExistsStatus(null);
      setProfileCreationComplete(false);
      setCurrentSessionId(null);
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
      
      // Increased delay for TWA stability
      if (isMobileDevice || twaEnv.isTWA || twaEnv.isStandalone) {
        logProfile('Mobile/TWA device detected, adding stabilization delay', 'AuthContext');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        logProfile(`Profile created or verified for user: ${currentUser.email}`, 'AuthContext');
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
        debugLogger.setLastProfileError(null);
        
        if (!sessionCreated) {
          const sessionSuccess = await createUserSession(currentUser.id);
          if (sessionSuccess) {
            setSessionCreated(true);
          }
        }
        
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
          
          if (!sessionCreated) {
            const sessionSuccess = await createUserSession(currentUser.id);
            if (sessionSuccess) {
              setSessionCreated(true);
            }
          }
          
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
        
        // Simplified auth state stability - immediate for both web and native
        if (!authStateStable) {
          setAuthStateStable(true);
        }
        
        // Reset session tracking on new session
        if (event === 'SIGNED_IN' && currentSession?.user) {
          setSessionCreated(false);
          setCurrentSessionId(null);
          
          // Simplified profile creation - no delays
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => {
                logAuthError(`Profile creation error: ${error.message}`, 'AuthContext', error);
              });
          }, 100);

          await trackConversion('sign_in_success', {
            method: currentSession.user.app_metadata?.provider || 'unknown',
            timestamp: new Date().toISOString(),
            isNative: nativeIntegrationService.isRunningNatively()
          });
        }
        
        // Immediate loading completion for both web and native
        setIsLoading(false);

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
          setSessionCreated(false);
          setCurrentSessionId(null);
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
        setSessionCreated(false);
        setCurrentSessionId(null);
        
        // Simplified initial profile creation
        setTimeout(() => {
          createOrVerifyProfile(currentSession.user)
            .catch(error => {
              logAuthError(`Initial profile creation error: ${error.message}`, 'AuthContext', error);
            });
        }, 100);
      }
      
      // Immediate initialization completion
      setIsLoading(false);
      setAuthInitialized(true);
      setAuthStateStable(true);
    });

    return () => {
      subscription.unsubscribe();
      if (autoRetryTimeoutId) {
        clearTimeout(autoRetryTimeoutId);
      }
    };
  }, [authInitialized, isMobileDevice, location.pathname, twaEnv.isTWA, twaEnv.isStandalone]);

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
