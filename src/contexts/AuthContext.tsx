
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
  const [maxRetryAttempts] = useState(5); // Maximum number of automatic retries
  const [retryDelay] = useState(800); // Base delay between retries in ms
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
    if (!user) return false;
    
    if (profileExistsStatus === true || profileCreationComplete) {
      return true;
    }
    
    // Start automatic retry process with exponential backoff if not already in progress
    if (!profileCreationInProgress) {
      return autoRetryProfileCreation();
    }
    
    return profileExistsStatus || false;
  };

  // New function for automatic profile creation with retries
  const autoRetryProfileCreation = async (): Promise<boolean> => {
    if (!user || profileCreationComplete) return profileExistsStatus || false;
    
    try {
      setProfileCreationInProgress(true);
      
      let attempt = 0;
      let success = false;
      
      // Try up to maxRetryAttempts times with exponential backoff
      while (attempt < maxRetryAttempts && !success) {
        console.log(`[AuthContext] Profile creation attempt #${attempt + 1}`);
        
        // Add delay with exponential backoff, except for first attempt
        if (attempt > 0) {
          const backoffDelay = retryDelay * Math.pow(1.5, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
        
        success = await ensureProfileExistsService(user);
        
        if (success) {
          console.log('[AuthContext] Profile created or verified successfully');
          setProfileExistsStatus(true);
          setProfileCreationComplete(true);
          return true;
        }
        
        attempt++;
      }
      
      // If we still failed after all retries, set the status but don't surface error to user
      if (!success) {
        console.error('[AuthContext] Profile creation failed after multiple attempts');
        setProfileExistsStatus(false);
      }
      
      return success;
    } catch (error) {
      console.error('[AuthContext] Error in autoRetryProfileCreation:', error);
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
      
      // Start automatic retry process
      return await autoRetryProfileCreation();
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
    
    // Initialize auth state from last session first
    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        console.log('[AuthContext] Initial session check:', data?.session?.user?.email);
        
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          
          if (data.session.user) {
            const delay = isMobileDevice ? 1200 : 800;
            console.log(`[AuthContext] Delaying initial profile creation by ${delay}ms for platform stability`);
            
            // Delay profile creation slightly to ensure auth is fully initialized
            setTimeout(() => {
              createOrVerifyProfile(data.session.user)
                .catch(error => console.error('[AuthContext] Error in initial profile creation:', error));
            }, delay);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('[AuthContext] Error in initial auth check:', error);
        setIsLoading(false);
      }
    };
    
    // Start initialization
    initializeAuth();
    
    // Set up ongoing auth change listener
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
