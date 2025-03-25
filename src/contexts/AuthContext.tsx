import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { refreshAuthSession } from '@/utils/audio/auth-utils';

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

    // Set up token refresh interval to keep the session alive
    // This will prevent token expiration issues
    const refreshInterval = setInterval(() => {
      if (session) {
        // Use the silent refresh (no toasts) for automatic background refreshes
        refreshAuthSession(false).then(success => {
          if (!success) {
            console.warn("Background session refresh failed");
          }
        });
      }
    }, 10 * 60 * 1000); // Refresh every 10 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [session]);

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

  // Update the refreshSession function to use our improved utility function
  const refreshSession = async (): Promise<void> => {
    try {
      console.log('Manually refreshing session from AuthContext...');
      // Use the version with toasts for manual refreshes
      const success = await refreshAuthSession(true);
      
      if (!success) {
        throw new Error("Session refresh failed");
      }
      
      // Re-fetch session to update context state
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }
      
      setSession(data.session);
      setUser(data.session?.user ?? null);
      console.log('Session refreshed and updated in context');
    } catch (error: any) {
      console.error('Error refreshing session in AuthContext:', error);
      // Toast already shown by refreshAuthSession
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
