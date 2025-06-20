
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { SessionTrackingService } from '@/services/sessionTrackingService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          // Initialize session tracking if user is authenticated
          if (initialSession?.user) {
            console.log('User authenticated, initializing session tracking');
            await SessionTrackingService.initializeSessionTracking();
          }
        }
      } catch (error) {
        console.error('Exception getting initial session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.id);
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (event === 'SIGNED_IN' && currentSession?.user) {
          console.log('User signed in, initializing session tracking');
          await SessionTrackingService.initializeSessionTracking();
          
          // Track sign-in conversion
          await SessionTrackingService.trackConversion('user_sign_in', {
            userId: currentSession.user.id,
            method: 'oauth' // This could be enhanced to detect the actual method
          });
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out, closing session');
          await SessionTrackingService.closeCurrentSession();
          
          // Track sign-out event (if there was an active session)
          await SessionTrackingService.trackConversion('user_sign_out', {
            timestamp: new Date().toISOString()
          });
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Close session before signing out
      await SessionTrackingService.closeCurrentSession();
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Exception during sign out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
