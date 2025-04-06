
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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCreationInProgress, setProfileCreationInProgress] = useState(false);
  const [profileCreationAttempts, setProfileCreationAttempts] = useState(0);
  const [lastProfileAttemptTime, setLastProfileAttemptTime] = useState<number>(0);

  // Ensure profile exists wrapper with improved error handling
  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user || profileCreationInProgress) return false;
    
    // Prevent rapid repeated attempts (at least 2 seconds between attempts)
    const now = Date.now();
    if (now - lastProfileAttemptTime < 2000) {
      console.log('Skipping profile check - too soon after last attempt');
      return false;
    }
    
    try {
      setProfileCreationInProgress(true);
      setLastProfileAttemptTime(now);
      setProfileCreationAttempts(prev => prev + 1);
      
      console.log(`Attempt #${profileCreationAttempts + 1} to ensure profile exists for user:`, user.id);
      const result = await ensureProfileExistsService(user);
      
      if (!result && profileCreationAttempts < 5) {
        console.log(`Profile creation failed on attempt #${profileCreationAttempts + 1}, will retry later`);
        // We'll let the next attempt happen naturally when needed
      } else if (result) {
        console.log('Profile created or verified successfully');
        // Reset attempts counter on success
        setProfileCreationAttempts(0);
      }
      
      return result;
    } catch (error) {
      console.error('Error in ensureProfileExists:', error);
      return false;
    } finally {
      setProfileCreationInProgress(false);
    }
  };

  // Update user profile wrapper
  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    const result = await updateUserProfileService(user, metadata);
    // If successful and we get updated user data, update the state
    if (result) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
      }
    }
    return result;
  };

  // Sign in with Google wrapper
  const signInWithGoogle = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await signInWithGoogleService();
    } catch (error) {
      setIsLoading(false);
    }
  };

  // Sign in with email wrapper
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await signInWithEmailService(email, password);
    } catch (error) {
      setIsLoading(false);
    }
  };

  // Sign up wrapper
  const signUp = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await signUpService(email, password);
    } catch (error) {
      setIsLoading(false);
    }
  };

  // Reset password wrapper
  const resetPassword = async (email: string): Promise<void> => {
    setIsLoading(true);
    try {
      await resetPasswordService(email);
    } catch (error) {
      setIsLoading(false);
    }
  };

  // Sign out wrapper
  const signOut = async (): Promise<void> => {
    try {
      await signOutService();
    } catch (error) {
      // Error handling is done in the service
    }
  };

  // Refresh session wrapper
  const refreshSession = async (): Promise<void> => {
    try {
      const currentSession = await refreshSessionService();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (error) {
      // Error handling is done in the service
    }
  };

  // Create or verify user profile with exponential backoff retry strategy
  const createOrVerifyProfile = async (currentUser: User): Promise<boolean> => {
    if (profileCreationInProgress) return false;
    
    try {
      setProfileCreationInProgress(true);
      // First try to create profile
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        console.log('Profile created or verified for user:', currentUser.email);
        setProfileCreationAttempts(0);
        return true;
      } else {
        console.warn('First attempt to create profile failed, retrying with backoff...');
        
        // Retry with exponential backoff
        for (let attempt = 1; attempt <= 3; attempt++) {
          // Calculate delay with exponential backoff (1s, 2s, 4s)
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Waiting ${delay}ms before retry attempt #${attempt}`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Try again
          const retryResult = await ensureProfileExistsService(currentUser);
          if (retryResult) {
            console.log(`Profile created or verified on retry #${attempt} for user:`, currentUser.email);
            setProfileCreationAttempts(0);
            return true;
          }
        }
        
        console.error('Failed to create profile after multiple retries for user:', currentUser.email);
        return false;
      }
    } catch (error) {
      console.error('Error in profile creation:', error);
      return false;
    } finally {
      setProfileCreationInProgress(false);
    }
  };

  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.email);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Handle profile creation for sign in events
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && currentSession?.user) {
          // Use setTimeout to prevent auth deadlock - crucial for mobile
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => console.error('Error in delayed profile creation:', error));
          }, 1000);  // Increased delay to 1000ms for mobile stability
        }
        
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          toast.success('Signed in successfully');
        } else if (event === 'SIGNED_OUT') {
          toast.info('Signed out');
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('Initial session check:', currentSession?.user?.email);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Check for existing profile on initial load
      if (currentSession?.user) {
        setTimeout(() => {
          createOrVerifyProfile(currentSession.user)
            .catch(error => console.error('Error in initial profile creation:', error));
        }, 1200);  // Increased delay for mobile
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
