
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

  // Ensure profile exists wrapper with improved error handling
  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user || profileCreationInProgress) return false;
    
    try {
      setProfileCreationInProgress(true);
      const result = await ensureProfileExistsService(user);
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

  // Create or verify user profile
  const createOrVerifyProfile = async (currentUser: User): Promise<boolean> => {
    if (profileCreationInProgress) return false;
    
    try {
      setProfileCreationInProgress(true);
      // First try to create profile
      const profileCreated = await ensureProfileExistsService(currentUser);
      
      if (profileCreated) {
        console.log('Profile created or verified for user:', currentUser.email);
        return true;
      } else {
        console.warn('First attempt to create profile failed, retrying...');
        
        // Retry once after a short delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryResult = await ensureProfileExistsService(currentUser);
        
        if (retryResult) {
          console.log('Profile created or verified on retry for user:', currentUser.email);
          return true;
        } else {
          console.error('Failed to create profile after retry for user:', currentUser.email);
          return false;
        }
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
          // Use setTimeout to prevent auth deadlock
          setTimeout(() => {
            createOrVerifyProfile(currentSession.user)
              .catch(error => console.error('Error in delayed profile creation:', error));
          }, 500);
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
        }, 500);
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
