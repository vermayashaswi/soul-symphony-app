
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
  const [initialSessionCheckDone, setInitialSessionCheckDone] = useState(false);
  
  // Function to handle profile creation with rate limiting
  const createUserProfile = useCallback(async (userId: string) => {
    if (!userId || profileCreationAttempted) return;
    
    try {
      setProfileCreationAttempted(true);
      console.log('Attempting to ensure profile exists for user:', userId);
      
      const result = await ensureUserProfile(userId);
      
      if (!result.success) {
        console.warn('Profile creation attempted but had issues:', result.error);
        // Don't show toast here to prevent multiple errors
        // The error is not fatal - the database trigger might have created the profile
      } else {
        console.log('Profile check/creation completed successfully');
      }
    } catch (error) {
      console.error('Error in createUserProfile, but continuing:', error);
      // Don't throw the error as it's not fatal
    }
  }, [profileCreationAttempted]);
  
  // Initialize auth state and set up listeners
  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        toast.success('Signed in successfully');
        
        // Ensure user profile exists after sign-in
        if (newSession?.user) {
          // Reset profile creation flag on new sign-in
          setProfileCreationAttempted(false);
          
          // Log user data for debugging
          console.log('User data after sign-in:', {
            id: newSession.user.id,
            email: newSession.user.email,
            name: newSession.user.user_metadata?.full_name,
            avatar: newSession.user.user_metadata?.avatar_url
          });
          
          try {
            // Update the profile with Google info if available
            if (newSession.user.app_metadata.provider === 'google' && 
                newSession.user.user_metadata?.full_name) {
              const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newSession.user.id)
                .maybeSingle();
                
              // Only update if it doesn't have data already
              if (!existingProfile?.full_name || !existingProfile?.avatar_url) {
                await supabase
                  .from('profiles')
                  .update({
                    full_name: newSession.user.user_metadata.full_name,
                    avatar_url: newSession.user.user_metadata.avatar_url,
                    email: newSession.user.email
                  })
                  .eq('id', newSession.user.id);
              }
            }
            
            await createUserProfile(newSession.user.id);
          } catch (err) {
            console.error('Profile creation error on auth state change, but continuing:', err);
          }
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
      setInitialSessionCheckDone(true);
      
      // Ensure user profile exists for existing session
      if (initialSession?.user) {
        // Log user data for debugging
        console.log('User data from existing session:', {
          id: initialSession.user.id,
          email: initialSession.user.email,
          name: initialSession.user.user_metadata?.full_name,
          avatar: initialSession.user.user_metadata?.avatar_url
        });
        
        try {
          createUserProfile(initialSession.user.id);
        } catch (err) {
          console.error('Profile creation error on initial session, but continuing:', err);
        }
      }
    }).catch(error => {
      console.error('Error checking session, but continuing:', error);
      setIsLoading(false);
      setInitialSessionCheckDone(true);
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
        if (error.message.includes('Auth session missing')) {
          // This is a normal state for unauthenticated users, not an error
          console.log('No session exists to refresh (user not authenticated)');
          setIsLoading(false);
          return false;
        }
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
