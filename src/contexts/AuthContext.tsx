
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
      console.log(`[AuthContext] Detected ${isMobile ? 'mobile' : 'desktop'} device`);
    };

    checkMobile();
  }, []);

  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user || profileCreationInProgress) return false;
    
    if (profileExistsStatus === true || profileCreationComplete) {
      return true;
    }
    
    const now = Date.now();
    if (now - lastProfileAttemptTime < 2000) {
      console.log('[AuthContext] Skipping profile check - too soon after last attempt');
      return profileExistsStatus || false;
    }
    
    try {
      setProfileCreationInProgress(true);
      setLastProfileAttemptTime(now);
      setProfileCreationAttempts(prev => prev + 1);
      
      console.log(`[AuthContext] Attempt #${profileCreationAttempts + 1} to ensure profile exists for user:`, user.id);
      
      const result = await ensureProfileExistsService(user);
      
      if (result) {
        console.log('[AuthContext] Profile created or verified successfully');
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
      } else if (profileCreationAttempts < 3) {
        console.log(`[AuthContext] Profile creation failed on attempt #${profileCreationAttempts + 1}, status: ${result}`);
        setProfileExistsStatus(false);
      }
      
      return result;
    } catch (error) {
      console.error('[AuthContext] Error in ensureProfileExists:', error);
      setProfileExistsStatus(false);
      return false;
    } finally {
      setProfileCreationInProgress(false);
    }
  };

  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    const result = await updateUserProfileService(user, metadata);
    if (result) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
      }
    }
    return result;
  };

  const signInWithGoogle = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await signInWithGoogleService();
    } catch (error) {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await signInWithEmailService(email, password);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await signUpService(email, password);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    setIsLoading(true);
    try {
      await resetPasswordService(email);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // Pass a callback function instead of the navigate object
      await signOutService((path: string) => {
        // Use window.location.href for navigation instead of useNavigate
        window.location.href = path;
      });
      
      setSession(null);
      setUser(null);
      setProfileExistsStatus(null);
      setProfileCreationComplete(false);
    } catch (error) {
      // Error handling is done in the service
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
    if (profileCreationInProgress || profileCreationComplete) return profileExistsStatus || false;
    
    if (profileExistsStatus === true) {
      return true;
    }
    
    try {
      setProfileCreationInProgress(true);
      console.log('[AuthContext] Attempting profile creation for user:', currentUser.email);
      
      if (isMobileDevice) {
        console.log('[AuthContext] Mobile device detected, adding stabilization delay');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        console.log('[AuthContext] Profile created or verified for user:', currentUser.email);
        setProfileCreationAttempts(0);
        setProfileExistsStatus(true);
        setProfileCreationComplete(true);
        return true;
      } else {
        console.warn('[AuthContext] First attempt to create profile failed, retrying once...');
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const retryResult = await ensureProfileExistsService(currentUser);
        if (retryResult) {
          console.log('[AuthContext] Profile created or verified on retry for user:', currentUser.email);
          setProfileCreationAttempts(0);
          setProfileExistsStatus(true);
          setProfileCreationComplete(true);
          return true;
        }
        
        setProfileExistsStatus(false);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Error in profile creation:', error);
      setProfileExistsStatus(false);
      return false;
    } finally {
      setProfileCreationInProgress(false);
    }
  };

  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[AuthContext] Auth state changed:', event, currentSession?.user?.email);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && currentSession?.user) {
          const delay = isMobileDevice ? 1000 : 800;
          console.log(`[AuthContext] Delaying profile creation by ${delay}ms for platform stability`);
          
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => console.error('[AuthContext] Error in delayed profile creation:', error));
          }, delay);
        }
        
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          toast.success('Signed in successfully');
        } else if (event === 'SIGNED_OUT') {
          setProfileExistsStatus(null);
          setProfileCreationComplete(false);
          toast.info('Signed out');
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('[AuthContext] Initial session check:', currentSession?.user?.email);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const delay = isMobileDevice ? 1200 : 800;
        console.log(`[AuthContext] Delaying initial profile creation by ${delay}ms for platform stability`);
        
        setTimeout(() => {
          createOrVerifyProfile(currentSession.user)
            .catch(error => console.error('[AuthContext] Error in initial profile creation:', error));
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
