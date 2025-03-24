
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
  isDevMode: boolean;  // New flag for development mode
  toggleDevMode: () => void;  // New function to toggle dev mode
};

// Export the AuthContext so it can be imported directly
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);  // Initialize dev mode as false

  useEffect(() => {
    console.log("AuthProvider: Setting up auth state listener");
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.email);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          toast.success('Signed in successfully');
        } else if (event === 'SIGNED_OUT') {
          toast.info('Signed out');
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('Initial session check:', currentSession?.user?.email);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Get the correct redirect URL based on environment
  const getRedirectUrl = () => {
    const origin = window.location.origin;
    // Format the redirect URL correctly for Supabase auth
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

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(`Error signing out: ${error.message}`);
    }
  };

  // New function to toggle development mode
  const toggleDevMode = () => {
    setIsDevMode(prev => {
      const newValue = !prev;
      if (newValue) {
        toast.success('Development mode enabled - Auth bypass active');
      } else {
        toast.info('Development mode disabled - Auth checks restored');
      }
      return newValue;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        signInWithGoogle,
        signOut,
        isDevMode,
        toggleDevMode,
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
