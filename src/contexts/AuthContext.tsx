
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

// Create the context with a default undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the context for direct import if needed
export { AuthContext };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCreationInProgress, setProfileCreationInProgress] = useState(false);
  const [profileCreationAttempts, setProfileCreationAttempts] = useState(0);
  const [lastProfileAttemptTime, setLastProfileAttemptTime] = useState<number>(0);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

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
    
    const now = Date.now();
    if (now - lastProfileAttemptTime < 2000) {
      console.log('[AuthContext] Skipping profile check - too soon after last attempt');
      return false;
    }
    
    try {
      setProfileCreationInProgress(true);
      setLastProfileAttemptTime(now);
      setProfileCreationAttempts(prev => prev + 1);
      
      console.log(`[AuthContext] Attempt #${profileCreationAttempts + 1} to ensure profile exists for user:`, user.id);
      console.log(`[AuthContext] Auth provider: ${user.app_metadata?.provider}, Has metadata: ${!!user.user_metadata}`);
      
      const result = await ensureProfileExistsService(user);
      
      if (result) {
        console.log('[AuthContext] Profile created or verified successfully');
        setProfileCreationAttempts(0);
      } else if (profileCreationAttempts < 5) {
        console.log(`[AuthContext] Profile creation failed on attempt #${profileCreationAttempts + 1}, will retry later`);
      }
      
      return result;
    } catch (error) {
      console.error('[AuthContext] Error in ensureProfileExists:', error);
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
      await signOutService();
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
    if (profileCreationInProgress) return false;
    
    try {
      setProfileCreationInProgress(true);
      console.log('[AuthContext] Attempting profile creation for user:', currentUser.email);
      console.log('[AuthContext] Auth provider:', currentUser.app_metadata?.provider);
      console.log('[AuthContext] Has user_metadata:', !!currentUser.user_metadata);
      
      if (isMobileDevice) {
        console.log('[AuthContext] Mobile device detected, adding stabilization delay');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        console.log('[AuthContext] Profile created or verified for user:', currentUser.email);
        setProfileCreationAttempts(0);
        return true;
      } else {
        console.warn('[AuthContext] First attempt to create profile failed, retrying with backoff...');
        
        const retryLimit = isMobileDevice ? 5 : 3;
        
        for (let attempt = 1; attempt <= retryLimit; attempt++) {
          const baseDelay = isMobileDevice ? 2000 : 1000;
          const delay = Math.pow(2, attempt - 1) * baseDelay;
          console.log(`[AuthContext] Waiting ${delay}ms before retry attempt #${attempt}`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const retryResult = await ensureProfileExistsService(currentUser);
          if (retryResult) {
            console.log(`[AuthContext] Profile created or verified on retry #${attempt} for user:`, currentUser.email);
            setProfileCreationAttempts(0);
            return true;
          }
        }
        
        console.error('[AuthContext] Failed to create profile after multiple retries for user:', currentUser.email);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Error in profile creation:', error);
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
          const delay = isMobileDevice ? 1800 : 1200;
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
          toast.info('Signed out');
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('[AuthContext] Initial session check:', currentSession?.user?.email);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const delay = isMobileDevice ? 2000 : 1500;
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
