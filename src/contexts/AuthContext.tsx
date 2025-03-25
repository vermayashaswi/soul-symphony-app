
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
};

// Export the AuthContext so it can be imported directly
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener");
    
    // Check for existing session first
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error.message);
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          console.log('Initial session found:', data.session.user.email);
          setSession(data.session);
          setUser(data.session.user);
        } else {
          console.log('No initial session found');
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Unexpected error checking session:', err);
        setIsLoading(false);
      }
    };
    
    initializeAuth();
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.email);
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          if (event === 'SIGNED_IN') {
            toast.success('Signed in successfully');
            console.log('Full user data on sign in:', currentSession.user);
          } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed successfully');
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          toast.info('Signed out');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Get the correct redirect URL based on environment
  const getRedirectUrl = () => {
    const origin = window.location.origin;
    return `${origin}/auth`;
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const redirectUrl = getRedirectUrl();
      console.log('Using redirect URL for Google auth:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (error) {
        console.error('Error initiating Google OAuth:', error);
        toast.error(`Error signing in with Google: ${error.message}`);
        setIsLoading(false);
        throw error;
      }
      
      console.log('OAuth sign-in initiated, URL:', data?.url);
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      toast.error(`Error signing in with Google: ${error.message}`);
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out user...');
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        toast.error(`Error signing out: ${error.message}`);
        throw error;
      }
      
      setSession(null);
      setUser(null);
      console.log('Sign out successful');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(`Error signing out: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to manually refresh the session
  const refreshSession = async () => {
    try {
      console.log('Manually refreshing session from AuthContext...');
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        toast.error(`Session refresh failed: ${error.message}`);
        throw error;
      }
      
      console.log('Session refreshed:', data.session?.user?.email);
      setSession(data.session);
      setUser(data.session?.user ?? null);
      return true;
    } catch (error: any) {
      console.error('Error refreshing session:', error);
      toast.error(`Session refresh failed: ${error.message}`);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signInWithGoogle,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
