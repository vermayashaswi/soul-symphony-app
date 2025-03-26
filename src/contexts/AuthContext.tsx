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
  const [authEventsProcessed, setAuthEventsProcessed] = useState<Set<string>>(new Set());
  
  // Function to handle profile creation with rate limiting
  const createUserProfile = useCallback(async (userId: string) => {
    if (!userId || profileCreationAttempted) return;
    
    try {
      setProfileCreationAttempted(true);
      console.log('Attempting to ensure profile exists for user:', userId);
      
      const result = await ensureUserProfile(userId);
      
      if (!result.success) {
        console.warn('Profile creation attempted but had issues:', result.error);
      } else {
        console.log('Profile check/creation completed successfully');
      }
    } catch (error) {
      console.error('Error in createUserProfile, but continuing:', error);
    }
  }, [profileCreationAttempted]);
  
  // Initialize auth state and set up listeners
  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    let authTimeout: NodeJS.Timeout | null = null;
    
    // Set a global timeout to force complete loading state
    authTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('Force ending auth loading state after timeout');
        setIsLoading(false);
      }
    }, 2000);
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);
      
      // Create a unique ID for this event to prevent duplicate processing
      const eventId = `${event}-${Date.now()}`;
      
      // Check if we've already processed this event
      if (authEventsProcessed.has(eventId)) {
        console.log('Skipping duplicate auth event:', event);
        return;
      }
      
      // Mark this event as processed
      setAuthEventsProcessed(prev => new Set(prev).add(eventId));
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Only show toast for SIGNED_IN once per session
        if (event === 'SIGNED_IN' && !user) {
          toast.success('Signed in successfully');
        }
        
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
        
        // Always set loading to false after sign-in
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        toast.info('Signed out successfully');
        setProfileCreationAttempted(false);
        setIsLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        // This event indicates the initial session check is complete
        setInitialSessionCheckDone(true);
        setIsLoading(false);
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
      if (authTimeout) clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, [createUserProfile, authEventsProcessed]);
  
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
      setIsLoading(true);
      await supabase.auth.signOut();
      // The auth state change listener will handle updating the state
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(`Sign out failed: ${error.message}`);
      setIsLoading(false);
    }
  };
  
  // Refresh session
  const refreshSession = async () => {
    try {
      setIsLoading(true);
      console.log("Attempting to refresh session...");
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        setIsLoading(false);
        if (error.message.includes('Auth session missing')) {
          // This is a normal state for unauthenticated users, not an error
          console.log('No session exists to refresh (user not authenticated)');
          return false;
        }
        return false;
      }
      
      console.log("Session refresh result:", data.session ? "Success" : "No session returned");
      setSession(data.session);
      setUser(data.user);
      setIsLoading(false);
      
      return !!data.session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      setIsLoading(false);
      return false;
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
