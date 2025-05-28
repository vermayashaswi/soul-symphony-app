
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ensureProfileExists } from '@/services/profileService';
import { handleAuthCallback } from '@/services/authService';
import { toast } from 'sonner';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('AuthProvider: Rendering with state:', { 
    hasUser: !!user, 
    userId: user?.id,
    hasSession: !!session,
    isLoading 
  });

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('AuthProvider: Initializing auth...');

        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('AuthProvider: Auth state changed:', { event, hasSession: !!session, userId: session?.user?.id });
            
            if (!mounted) return;

            // Update auth state immediately
            setSession(session);
            setUser(session?.user ?? null);

            // Handle profile creation/validation in the background
            if (session?.user && event === 'SIGNED_IN') {
              console.log('AuthProvider: User signed in, ensuring profile exists...');
              
              // Use setTimeout to avoid blocking the auth state update
              setTimeout(async () => {
                try {
                  const profileCreated = await ensureProfileExists(session.user);
                  if (!profileCreated) {
                    console.error('AuthProvider: Failed to ensure profile exists');
                    toast.error('There was an issue setting up your profile. Please try refreshing the page.');
                  } else {
                    console.log('AuthProvider: Profile ensured successfully');
                  }
                } catch (error) {
                  console.error('AuthProvider: Error ensuring profile exists:', error);
                  toast.error('There was an issue setting up your profile. Please try refreshing the page.');
                }
              }, 0);
            }

            // Set loading to false after auth state is updated
            setIsLoading(false);
          }
        );

        // Handle auth callback (for OAuth flows)
        const callbackSession = await handleAuthCallback();
        if (callbackSession) {
          console.log('AuthProvider: Auth callback handled, session exists');
        }

        // THEN check for existing session
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthProvider: Error getting session:', error);
          toast.error('Authentication error. Please try signing in again.');
        }
        
        if (mounted) {
          console.log('AuthProvider: Initial session check:', { 
            hasSession: !!existingSession, 
            userId: existingSession?.user?.id 
          });
          
          setSession(existingSession);
          setUser(existingSession?.user ?? null);
          
          // Ensure profile exists for existing session
          if (existingSession?.user) {
            setTimeout(async () => {
              try {
                await ensureProfileExists(existingSession.user);
              } catch (error) {
                console.error('AuthProvider: Error ensuring profile for existing session:', error);
              }
            }, 0);
          }
          
          setIsLoading(false);
        }

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('AuthProvider: Error in auth initialization:', error);
        if (mounted) {
          setIsLoading(false);
          toast.error('Authentication initialization failed. Please refresh the page.');
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('AuthProvider: Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear state immediately
      setUser(null);
      setSession(null);
      
      console.log('AuthProvider: Sign out successful');
    } catch (error: any) {
      console.error('AuthProvider: Error signing out:', error);
      toast.error('Error signing out. Please try again.');
    }
  };

  const value = {
    user,
    session,
    isLoading,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
