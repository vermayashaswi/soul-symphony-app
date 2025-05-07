import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthContextType } from '@/types/auth';
import { 
  ensureProfileExists as ensureProfileExistsService, 
  updateUserProfile as updateUserProfileService, 
  updateTimezone 
} from '@/services/profileService';
import { 
  signInWithGoogle as signInWithGoogleService,
  signInWithEmail as signInWithEmailService,
  signUp as signUpService,
  resetPassword as resetPasswordService,
  signOut as signOutService,
  refreshSession as refreshSessionService
} from '@/services/authService';
import { debugLogger, logInfo, logError, logAuthError, logProfile, logAuth } from '@/components/debug/DebugPanel';
import { isAppRoute } from '@/routes/RouteHelpers';
import { useLocation } from 'react-router-dom';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_AUTO_PROFILE_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 500;

export function AuthProvider({ children }: { children: ReactNode }) {
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
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const location = useLocation();

  const createUserSession = async (userId: string) => {
    try {
      console.log('Creating user session record for user:', userId);
      
      const deviceType = /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          device_type: deviceType,
          user_agent: navigator.userAgent,
          entry_page: window.location.pathname,
          last_active_page: window.location.pathname,
          is_active: true
        });
      
      if (error) {
        console.error('Error creating user session from AuthContext:', error);
        return;
      }
      
      console.log('User session created successfully from AuthContext:', data);
    } catch (e) {
      console.error('Exception creating user session from AuthContext:', e);
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobileDevice(isMobile);
      logInfo(`Detected ${isMobile ? 'mobile' : 'desktop'} device`, 'AuthContext');
    };
    
    // Set up path change listener
    const handlePathChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Listen for path changes
    window.addEventListener('popstate', handlePathChange);
    
    const originalPushState = window.history.pushState;
    window.history.pushState = function() {
      originalPushState.apply(this, arguments as any);
      handlePathChange();
    };
    
    checkMobile();
    
    return () => {
      if (autoRetryTimeoutId) {
        clearTimeout(autoRetryTimeoutId);
      }
      
      window.removeEventListener('popstate', handlePathChange);
      window.history.pushState = originalPushState;
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
    if (!forceRetry && now - lastProfileAttemptTime < 2000) {
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
        
        await createUserSession(user.id);
        
        return true;
      } else {
        const errorMsg = `Profile creation failed on attempt #${profileCreationAttempts + 1}`;
        logAuthError(errorMsg, 'AuthContext');
        debugLogger.setLastProfileError(errorMsg);
        setProfileExistsStatus(false);
        
        if (profileCreationAttempts < MAX_AUTO_PROFILE_ATTEMPTS) {
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
    
    const result = await updateUserProfileService(user, metadata);
    if (result) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        logProfile('User profile updated successfully', 'AuthContext');
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
    } catch (error: any) {
      logAuthError(`Google sign-in failed: ${error.message}`, 'AuthContext', error);
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
      
      setSession(null);
      setUser(null);
      setProfileExistsStatus(null);
      setProfileCreationComplete(false);
      
      await signOutService((path: string) => {
        console.log(`[AuthContext] Redirecting to ${path} after signout`);
        window.location.href = '/app/onboarding';
      });
    } catch (error: any) {
      console.error('[AuthContext] Error during sign out:', error);
      toast.error(`Error signing out: ${error.message}`);
      
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
      
      // Even if profile exists, make sure timezone is up to date
      setTimeout(() => {
        updateTimezone(currentUser.id)
          .catch(e => {
            logError(`Error updating timezone: ${e.message}`, 'AuthContext');
          });
      }, 0);
      
      return true;
    }
    
    try {
      setProfileCreationInProgress(true);
      setProfileCreationAttempts(prev => prev + 1);
      
      logProfile(`Attempt #${profileCreationAttempts + 1} to create profile for user: ${currentUser.email}`, 'AuthContext', {
        userProvider: currentUser.app_metadata?.provider,
        userMetadataKeys: currentUser.user_metadata ? Object.keys(currentUser.user_metadata) : []
      });
      
      if (isMobileDevice) {
        logProfile('Mobile device detected, adding stabilization delay', 'AuthContext');
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        logProfile(`Profile created or verified for user: ${currentUser.email}`, 'AuthContext');
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
        debugLogger.setLastProfileError(null);
        return true;
      } else {
        logAuthError('First attempt to create profile failed, retrying once...', 'AuthContext');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const retryResult = await ensureProfileExistsService(currentUser);
        if (retryResult) {
          logProfile(`Profile created or verified on retry for user: ${currentUser.email}`, 'AuthContext');
          setProfileCreationAttempts(0);
          setProfileExistsStatus(true);
          setProfileCreationComplete(true);
          debugLogger.setLastProfileError(null);
          return true;
        }
        
        const errorMsg = `Failed to create profile after retry for user: ${currentUser.email}`;
        logAuthError(errorMsg, 'AuthContext');
        debugLogger.setLastProfileError(errorMsg);
        setProfileExistsStatus(false);
        
        if (profileCreationAttempts < MAX_AUTO_PROFILE_ATTEMPTS) {
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
    logInfo("Setting up auth state listener", 'AuthContext');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        logInfo(`Auth state changed: ${event}, user: ${currentSession?.user?.email}`, 'AuthContext');
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          setTimeout(() => {
            createUserSession(currentSession.user.id)
              .catch(error => {
                console.error('Error creating user session on auth state change:', error);
              });
          }, 0);
          
          // Update user timezone whenever they sign in
          setTimeout(() => {
            updateTimezone(currentSession.user.id)
              .catch(error => {
                logError(`Error updating timezone on sign in: ${error.message}`, 'AuthContext');
              });
          }, 0);
          
          const initialDelay = isMobileDevice ? 1500 : 1000;
          logProfile(`Scheduling profile creation in ${initialDelay}ms for platform stability`, 'AuthContext');
          
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => {
                logAuthError(`Error in initial profile creation: ${error.message}`, 'AuthContext', error);
              });
          }, initialDelay);
          
          setTimeout(() => {
            if (!profileCreationComplete && !profileCreationInProgress) {
              logProfile('Executing backup profile creation attempt', 'AuthContext');
              createOrVerifyProfile(currentSession.user)
                .catch(error => {
                  logAuthError(`Error in backup profile creation: ${error.message}`, 'AuthContext', error);
                });
            }
          }, initialDelay + 3000);
        }
        
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          logInfo('User signed in successfully', 'AuthContext');
          if (isAppRoute(currentPath)) {
            toast.success('Signed in successfully');
          }
        } else if (event === 'SIGNED_OUT') {
          logInfo('User signed out', 'AuthContext');
          setProfileExistsStatus(null);
          setProfileCreationComplete(false);
          debugLogger.setLastProfileError(null);
          
          if (autoRetryTimeoutId) {
            clearTimeout(autoRetryTimeoutId);
            setAutoRetryTimeoutId(null);
          }
          
          if (isAppRoute(currentPath)) {
            toast.info('Signed out');
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      logInfo(`Initial session check: ${currentSession?.user?.email || 'No session'}`, 'AuthContext');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        setTimeout(() => {
          createUserSession(currentSession.user.id)
            .catch(error => {
              console.error('Error creating user session on initial session check:', error);
            });
        }, 0);
        
        // Update user timezone on initial session check
        setTimeout(() => {
          updateTimezone(currentSession.user.id)
            .catch(error => {
              logError(`Error updating timezone on initial session: ${error.message}`, 'AuthContext');
            });
        }, 0);
        
        const initialDelay = isMobileDevice ? 1500 : 1000;
        logProfile(`Scheduling initial profile creation in ${initialDelay}ms for platform stability`, 'AuthContext');
        
        setTimeout(() => {
          createOrVerifyProfile(currentSession.user)
            .catch(error => {
              logAuthError(`Error in initial profile creation: ${error.message}`, 'AuthContext', error);
            });
        }, initialDelay);
        
        setTimeout(() => {
          if (!profileCreationComplete && !profileCreationInProgress) {
            logProfile('Executing backup initial profile creation attempt', 'AuthContext');
            createOrVerifyProfile(currentSession.user)
              .catch(error => {
                logAuthError(`Error in backup initial profile creation: ${error.message}`, 'AuthContext', error);
              });
          }
        }, initialDelay + 3000);
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (autoRetryTimeoutId) {
        clearTimeout(autoRetryTimeoutId);
      }
    };
  }, [isMobileDevice, currentPath]);

  const value = {
    session,
    user,
    isLoading,
    signInWithGoogle,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
