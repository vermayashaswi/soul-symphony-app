
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
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
  const [profileCreationErrorShown, setProfileCreationErrorShown] = useState(false);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to handle profile creation with rate limiting
  const createUserProfile = useCallback(async (userId: string) => {
    if (!userId || profileCreationAttempted) return;
    
    try {
      setProfileCreationAttempted(true);
      console.log('Attempting to ensure profile exists for user:', userId);
      
      const result = await ensureUserProfile(userId);
      
      if (!result.success && !result.isNonCritical) {
        console.warn('Profile creation attempted but had issues:', result.error);
        
        // Show the error only once to prevent loops
        if (!profileCreationErrorShown) {
          setProfileCreationErrorShown(true);
          
          // Only show error toast for certain errors - RLS policy violations are likely
          // due to the database trigger handling profile creation already
          if (result.error && !result.error.includes('row-level security policy')) {
            toast.error('Could not set up user profile. Some features may be limited.');
          } else {
            console.log('Skipping error toast for RLS policy error - likely already handled by trigger');
          }
        }
      } else {
        console.log('Profile check/creation completed successfully');
      }
    } catch (error) {
      console.error('Error in createUserProfile, but continuing:', error);
      
      // Only show the error once
      if (!profileCreationErrorShown) {
        setProfileCreationErrorShown(true);
        toast.error('Could not set up user profile. Some features may be limited.');
      }
    }
  }, [profileCreationAttempted, profileCreationErrorShown]);
  
  // Reset the error flag when user changes
  useEffect(() => {
    if (user === null) {
      setProfileCreationErrorShown(false);
    }
  }, [user]);
  
  // Initialize auth state and set up listeners
  useEffect(() => {
    console.log('AuthProvider: Setting up auth state listener');
    
    // Set a global timeout to force complete loading state
    authTimeoutRef.current = setTimeout(() => {
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
            if (newSession.user.app_metadata?.provider === 'google' && 
                newSession.user.user_metadata?.full_name) {
              try {
                const { data: existingProfile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', newSession.user.id)
                  .maybeSingle();
                  
                // Only update if it doesn't have data already
                if (existingProfile && (!existingProfile?.full_name || !existingProfile?.avatar_url)) {
                  await supabase
                    .from('profiles')
                    .update({
                      full_name: newSession.user.user_metadata.full_name,
                      avatar_url: newSession.user.user_metadata.avatar_url,
                      email: newSession.user.email
                    })
                    .eq('id', newSession.user.id);
                }
              } catch (profileError) {
                console.error('Error updating profile with Google data but continuing:', profileError);
                // Continue even if this fails - the database trigger should have created the profile
              }
            }
            
            // Use a short delay to ensure other auth processing completes first
            setTimeout(() => {
              createUserProfile(newSession.user.id).catch(err => {
                console.warn('Profile creation error on delayed attempt, but continuing:', err);
              });
            }, 500);
          } catch (err) {
            console.error('Profile creation error on auth state change, but continuing:', err);
          }
        }
        
        // Always set loading to false after sign-in
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        toast.info('Signed out successfully');
        setProfileCreationAttempted(false);
        setProfileCreationErrorShown(false);
        setIsLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        // This event indicates the initial session check is complete
        setInitialSessionCheckDone(true);
        setIsLoading(false);
      }
    });
    
    // Check for existing session
    const checkInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error checking session, but continuing:', error);
          setIsLoading(false);
          setInitialSessionCheckDone(true);
          return;
        }
        
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
          
          // Use a short delay to ensure other auth processing completes first
          setTimeout(() => {
            createUserProfile(initialSession.user.id).catch(err => {
              console.warn('Profile creation error on delayed initial session, but continuing:', err);
            });
          }, 500);
        }
      } catch (error) {
        console.error('Error checking session, but continuing:', error);
        setIsLoading(false);
        setInitialSessionCheckDone(true);
      }
    };
    
    // Check initial session with a small delay to allow auth state listener to set up
    setTimeout(checkInitialSession, 100);
    
    return () => {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
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
      
      const refreshOperation = async () => {
        const { data, error } = await supabase.auth.refreshSession();
        if (error && !error.message.includes('Auth session missing')) throw error;
        return { data, error };
      };
      
      // Add retry logic for network failures
      let attempts = 0;
      const maxAttempts = 3;
      let result;
      
      while (attempts < maxAttempts) {
        try {
          result = await refreshOperation();
          break;
        } catch (err: any) {
          attempts++;
          console.warn(`Session refresh attempt ${attempts} failed:`, err);
          
          if (attempts >= maxAttempts) {
            console.error('Session refresh failed after all retries:', err);
            setIsLoading(false);
            return false;
          }
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 300 * Math.pow(2, attempts - 1)));
        }
      }
      
      if (!result) {
        setIsLoading(false);
        return false;
      }
      
      const { data, error } = result;
      
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
