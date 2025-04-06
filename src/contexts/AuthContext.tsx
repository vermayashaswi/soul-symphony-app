
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (metadata: Record<string, any>) => Promise<boolean>;
  ensureProfileExists: () => Promise<boolean>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.email);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // If user just signed in or signed up, ensure profile exists
        if ((event === 'SIGNED_IN' || event === 'SIGNED_UP') && currentSession?.user) {
          // Using setTimeout to prevent auth deadlock
          setTimeout(async () => {
            await ensureProfileExists(currentSession.user);
          }, 0);
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
      console.log('Initial session check:', currentSession?.user?.email);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Check for existing profile on initial load
      if (currentSession?.user) {
        await ensureProfileExists(currentSession.user);
      }
      
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Helper function to ensure user profile exists
  const ensureProfileExists = async (userToCheck: User | null = null) => {
    const currentUser = userToCheck || user;
    if (!currentUser) return false;
    
    try {
      console.log('Checking if profile exists for user:', currentUser.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', currentUser.id)
        .single();
        
      if (error) {
        console.log('Profile not found, creating new profile');
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.user_metadata?.full_name || '',
            avatar_url: currentUser.user_metadata?.avatar_url || '',
            onboarding_completed: false
          }]);
          
        if (insertError) {
          console.error('Error creating profile:', insertError);
          return false;
        }
        
        console.log('Profile created successfully');
        return true;
      }
      
      console.log('Profile exists:', data.id);
      return true;
    } catch (error: any) {
      console.error('Error ensuring profile exists:', error);
      return false;
    }
  };

  const getRedirectUrl = () => {
    const origin = window.location.origin;
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTo = urlParams.get('redirectTo');
    if (redirectTo) {
      localStorage.setItem('authRedirectTo', redirectTo);
    }
    return `${origin}/auth`;
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const redirectUrl = getRedirectUrl();
      console.log('Using redirect URL for Google auth:', redirectUrl);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      toast.error(`Error signing in with Google: ${error.message}`);
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error signing in with email:', error);
      toast.error(`Error signing in with email: ${error.message}`);
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      // Profile creation handled by auth state change listener
      
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast.error(`Error signing up: ${error.message}`);
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(`Error resetting password: ${error.message}`);
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      localStorage.removeItem('authRedirectTo');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(`Error signing out: ${error.message}`);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    } catch (error: any) {
      console.error('Error refreshing session:', error);
    }
  };

  const updateUserProfile = async (metadata: Record<string, any>) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setUser(data.user);
      }

      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            avatar_url: metadata.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

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
