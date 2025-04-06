import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthContextType } from '@/types/auth';
import { ensureProfileExists as ensureProfileExistsService, updateUserProfile as updateUserProfileService } from '@/services/profileService';
import { 
  signInWithGoogle as signInWithGoogleService,
  signInWithEmail as signInWithEmailService,
  signUp as signUpService,
  resetPassword as resetPasswordService,
  signOut as signOutService,
  refreshSession as refreshSessionService
} from '@/services/authService';
import { debugLogger, logInfo, logError, logAuthError, logProfile } from '@/components/debug/DebugPanel';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobileDevice(isMobile);
      logInfo(`Detected ${isMobile ? 'mobile' : 'desktop'} device`, 'AuthContext');
    };

    checkMobile();
  }, []);

  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user || profileCreationInProgress) {
      logProfile(`Profile check skipped: ${!user ? 'No user' : 'Already in progress'}`, 'AuthContext');
      return false;
    }
    
    if (profileExistsStatus === true || profileCreationComplete) {
      logProfile('Profile already verified as existing', 'AuthContext');
      return true;
    }
    
    const now = Date.now();
    if (now - lastProfileAttemptTime < 2000) {
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
      } else if (profileCreationAttempts < 3) {
        const errorMsg = `Profile creation failed on attempt #${profileCreationAttempts + 1}, status: ${result}`;
        logAuthError(errorMsg, 'AuthContext');
        debugLogger.setLastProfileError(errorMsg);
        setProfileExistsStatus(false);
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
        window.location.href = path;
      });
    } catch (error: any) {
      console.error('[AuthContext] Error during sign out:', error);
      toast.error(`Error signing out: ${error.message}`);
      
      window.location.href = '/';
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const currentSession = await refreshSessionService();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (error) {
      // Error handling is done in the service
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
      logProfile(`Attempting profile creation for user: ${currentUser.email}`, 'AuthContext', {
        userProvider: currentUser.app_metadata?.provider,
        userMetadataKeys: currentUser.user_metadata ? Object.keys(currentUser.user_metadata) : []
      });
      
      if (isMobileDevice) {
        logProfile('Mobile device detected, adding stabilization delay', 'AuthContext');
        await new Promise(resolve => setTimeout(resolve, 500));
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
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
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
        
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && currentSession?.user) {
          const delay = isMobileDevice ? 1000 : 800;
          logProfile(`Delaying profile creation by ${delay}ms for platform stability`, 'AuthContext');
          
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => {
                logAuthError(`Error in delayed profile creation: ${error.message}`, 'AuthContext', error);
              });
          }, delay);
        }
        
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          logInfo('User signed in successfully', 'AuthContext');
          toast.success('Signed in successfully');
        } else if (event === 'SIGNED_OUT') {
          logInfo('User signed out', 'AuthContext');
          setProfileExistsStatus(null);
          setProfileCreationComplete(false);
          debugLogger.setLastProfileError(null);
          toast.info('Signed out');
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      logInfo(`Initial session check: ${currentSession?.user?.email || 'No session'}`, 'AuthContext');
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const delay = isMobileDevice ? 1200 : 800;
        logProfile(`Delaying initial profile creation by ${delay}ms for platform stability`, 'AuthContext');
        
        setTimeout(() => {
          createOrVerifyProfile(currentSession.user)
            .catch(error => {
              logAuthError(`Error in initial profile creation: ${error.message}`, 'AuthContext', error);
            });
        }, delay);
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isMobileDevice]);

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
