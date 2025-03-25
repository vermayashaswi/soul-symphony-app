
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureUserProfile } from '@/utils/audio/auth-utils';

interface AuthContextProps {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: { [key: string]: any }) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCreationAttempted, setProfileCreationAttempted] = useState(false);
  
  // Function to handle profile creation with rate limiting
  const createUserProfile = useCallback(async (userId: string) => {
    if (!userId || profileCreationAttempted) return;
    
    try {
      setProfileCreationAttempted(true);
      console.log('Attempting to ensure profile exists for user:', userId);
      
      const result = await ensureUserProfile(userId);
      
      if (!result.success) {
        console.error('Profile creation failed:', result.error);
        // Don't show toast here to prevent multiple errors
      } else {
        console.log('Profile check/creation completed successfully');
      }
    } catch (error) {
      console.error('Error in createUserProfile:', error);
    }
  }, [profileCreationAttempted]);
  
  // Initialize auth state and set up listeners
  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state changed:', event);
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        toast.success('Signed in successfully');
        
        // Ensure user profile exists after sign-in
        if (newSession?.user) {
          // Reset profile creation flag on new sign-in
          setProfileCreationAttempted(false);
          createUserProfile(newSession.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        toast.info('Signed out successfully');
        setProfileCreationAttempted(false);
      }
    });
    
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
      
      // Ensure user profile exists for existing session
      if (initialSession?.user) {
        createUserProfile(initialSession.user.id);
      }
    }).catch(error => {
      console.error('Error checking session:', error);
      setIsLoading(false);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [createUserProfile]);
  
  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      return await supabase.auth.signInWithPassword({
        email,
        password,
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(`Sign in failed: ${error.message}`);
      return { error };
    }
  };
  
  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error(`Google sign in failed: ${error.message}`);
      return { error };
    }
  };
  
  // Sign up with email and password
  const signUp = async (email: string, password: string, metadata?: { [key: string]: any }) => {
    try {
      return await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(`Sign up failed: ${error.message}`);
      return { error, data: null };
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(`Sign out failed: ${error.message}`);
    }
  };
  
  // Refresh session
  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        return false;
      }
      
      setSession(data.session);
      setUser(data.user);
      
      return !!data.session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      refreshSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
