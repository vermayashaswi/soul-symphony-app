import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureUserProfile } from '@/utils/audio/auth-profile';
import { AuthContextProps, AuthContextProviderProps } from './types';
import { AuthContext } from './auth-context';
import { debugSessionStatus } from '@/utils/auth-utils';

// Safe storage wrapper to handle storage access errors
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('LocalStorage access error:', e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('LocalStorage write error:', e);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('LocalStorage remove error:', e);
    }
  }
};

export const AuthProvider: React.FC<AuthContextProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileCreationAttempted, setProfileCreationAttempted] = useState(false);
  const [initialSessionCheckDone, setInitialSessionCheckDone] = useState(false);
  const [profileCreationErrorShown, setProfileCreationErrorShown] = useState(false);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authListenerRef = useRef<{ subscription: { unsubscribe: () => void } } | null>(null);
  const initialCheckPerformedRef = useRef(false);
  
  // Function to handle profile creation with rate limiting
  const createUserProfile = useCallback(async (userId: string) => {
    if (!userId || profileCreationAttempted) return;
    
    try {
      setProfileCreationAttempted(true);
      console.log('Attempting to ensure profile exists for user:', userId);
      
      const result = await ensureUserProfile(userId);
      
      if (!result.success && result.error) {
        console.warn('Profile creation attempted but had issues:', result.error);
        
        // Show the error only once to prevent loops
        if (!profileCreationErrorShown) {
          setProfileCreationErrorShown(true);
          
          // Only show error toast for certain errors - RLS policy violations are likely
          // due to the database trigger handling profile creation already
          if (result.error && !result.error.includes('row-level security policy')) {
            toast.error('Could not set up user profile. Some features may be limited.');
          } else {
            console.log('Profile check/creation completed successfully');
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
    // Prevent duplicate initializations
    if (authListenerRef.current) {
      console.log('Auth listener already set up, skipping duplicate initialization');
      return;
    }
    
    console.log('AuthProvider: Setting up auth state listener (initial setup)');
    
    // Set a global timeout to force complete loading state - shorter timeout
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    
    authTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        console.log('Force ending auth loading state after timeout');
        setIsLoading(false);
      }
    }, 2500);
    
    // Set up auth state change listener
    try {
      // Set up the auth state listener first - correct initialization order
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          console.log('Auth state changed:', event, 'Session exists:', !!newSession);
          
          // Update state immediately - synchronously
          setSession(newSession);
          setUser(newSession?.user ?? null);
          
          // Debug session info on critical events
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            debugSessionStatus().catch(console.error);
          }
          
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            // Only show toast for SIGNED_IN once per session
            if (event === 'SIGNED_IN' && !user) {
              toast.success('Signed in successfully');
              
              // Set a persistent flag to indicate successful auth
              safeStorage.setItem('auth_success', 'true');
              safeStorage.setItem('last_auth_time', Date.now().toString());
            }
            
            // Use setTimeout to avoid Supabase auth deadlock
            if (newSession?.user) {
              setTimeout(() => {
                createUserProfile(newSession.user.id).catch(err => {
                  console.warn('Profile creation error, but continuing:', err);
                });
              }, 0);
            }
            
            setIsLoading(false);
          } else if (event === 'SIGNED_OUT') {
            toast.info('Signed out successfully');
            setProfileCreationAttempted(false);
            setProfileCreationErrorShown(false);
            setIsLoading(false);
            
            // Clear auth success flag
            safeStorage.removeItem('auth_success');
            safeStorage.removeItem('last_auth_time');
          } else if (event === 'INITIAL_SESSION') {
            setInitialSessionCheckDone(true);
            setIsLoading(false);
          }
        }
      );
      
      authListenerRef.current = { subscription };
      
      // THEN check for existing session
      supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
        if (error) {
          console.error('Error checking session, but continuing:', error);
          setIsLoading(false);
          return;
        }
        
        console.log('Initial session check:', initialSession ? 'Found' : 'Not found');
        
        if (initialSession) {
          console.log('Session found with user ID:', initialSession.user.id);
          safeStorage.setItem('auth_success', 'true');
          
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            createUserProfile(initialSession.user.id).catch(err => {
              console.warn('Profile creation error on initial session, but continuing:', err);
            });
          }, 0);
        }
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsLoading(false);
      });
      
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
      setIsLoading(false);
    }
    
    return () => {
      console.log('Cleaning up auth provider');
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      if (authListenerRef.current) authListenerRef.current.subscription.unsubscribe();
      authListenerRef.current = null;
    };
  }, [createUserProfile, isLoading, user]);
  
  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // First try to clear local storage 
      safeStorage.removeItem('auth_success');
      safeStorage.removeItem('last_auth_time');
      
      // Then sign out via Supabase with global scope
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('Error during signOut:', error);
        toast.error(`Sign out failed: ${error.message}`);
      }
      
      // Force state update regardless of API response
      setUser(null);
      setSession(null);
      
      setIsLoading(false);
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(`Sign out failed: ${error.message}`);
      setIsLoading(false);
      
      // Force state update even on error
      setUser(null);
      setSession(null);
    }
  };
  
  // Refresh session
  const refreshSession = async () => {
    try {
      // Prevent multiple refresh attempts
      if (refreshInProgress) {
        console.log("Session refresh already in progress, skipping...");
        return false;
      }
      
      setRefreshInProgress(true);
      console.log("Attempting to refresh session...");
      
      // Debug current session state before refresh
      await debugSessionStatus();
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        // Handle the "Auth session missing" error case cleanly
        if (error.message.includes('Auth session missing')) {
          console.log('No session exists to refresh (user not authenticated)');
          setRefreshInProgress(false);
          return false;
        }
        
        console.error('Session refresh error:', error);
        setRefreshInProgress(false);
        return false;
      }
      
      console.log("Session refresh result:", data.session ? "Success" : "No session returned");
      
      // Update state with refreshed session
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setRefreshInProgress(false);
      
      return !!data.session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      setRefreshInProgress(false);
      return false;
    } finally {
      // Ensure refresh flag is reset even if there's an exception
      setTimeout(() => {
        setRefreshInProgress(false);
      }, 500);
    }
  };

  // Simplified auth methods - only keeping what's necessary
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
  
  const signInWithGoogle = async () => {
    try {
      console.log('Initiating Google sign-in, redirecting to:', `${window.location.origin}/auth/callback`);
      
      return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account', 
            access_type: 'offline'
          }
        }
      });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error(`Google sign in failed: ${error.message}`);
      return { error };
    }
  };
  
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
