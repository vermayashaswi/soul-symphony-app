
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
  const [authEventsProcessed, setAuthEventsProcessed] = useState<Set<string>>(new Set());
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
    }, 1500);
    
    // Set up auth state change listener
    try {
      // Wrap in try/catch to handle storage access errors
      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('Auth state changed:', event);
        
        // Debug session info on critical events
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          debugSessionStatus().catch(console.error);
        }
        
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
      
      authListenerRef.current = data;
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
      // Still mark as not loading even if we couldn't set up the listener
      setIsLoading(false);
    }
    
    // Check for existing session - only once
    const checkInitialSession = async () => {
      // Prevent duplicate initial checks
      if (initialCheckPerformedRef.current) {
        console.log('Initial session check already performed, skipping');
        setIsLoading(false);
        return;
      }
      
      initialCheckPerformedRef.current = true;
      
      try {
        if (initialSessionCheckDone) {
          console.log('Initial session check already done, skipping');
          setIsLoading(false);
          return;
        }
        
        console.log('Checking for initial session...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Handle missing session cleanly
          if (error.message.includes('Auth session missing')) {
            console.log("No initial session exists (user not authenticated)");
            setSession(null);
            setUser(null);
            setIsLoading(false);
            setInitialSessionCheckDone(true);
            return;
          }
          
          console.error('Error checking session, but continuing:', error);
          setIsLoading(false);
          setInitialSessionCheckDone(true);
          return;
        }
        
        console.log('Initial session checked:', initialSession ? 'Found' : 'Not found');
        if (!initialSession) {
          console.log('No initial session found');
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
      console.log('Cleaning up auth provider');
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      if (authListenerRef.current) authListenerRef.current.subscription.unsubscribe();
      authListenerRef.current = null;
    };
  }, []);
  
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
      // Clear any stored session data first to force a clean login
      try {
        safeStorage.removeItem('supabase.auth.token');
        const storageKeyPrefix = 'sb-' + window.location.hostname.split('.')[0];
        safeStorage.removeItem(`${storageKeyPrefix}-auth-token`);
      } catch (e) {
        console.warn('Could not clear localStorage but continuing:', e);
      }
      
      // Log that we're initiating Google sign-in
      console.log('Initiating Google sign-in, redirecting to:', `${window.location.origin}/auth/callback`);
      
      return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account', // Force account selection
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
      
      // First try to clear local storage 
      try {
        safeStorage.removeItem('supabase.auth.token');
      } catch (e) {
        console.warn('Could not clear localStorage but continuing:', e);
      }
      
      // Then sign out via Supabase
      await supabase.auth.signOut({ scope: 'global' });
      
      setUser(null);
      setSession(null);
      
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
      // Prevent multiple refresh attempts
      if (refreshInProgress) {
        console.log("Session refresh already in progress, skipping...");
        return false;
      }
      
      // Skip refresh if we have an active session
      if (session && session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        // If session expires more than 5 minutes from now, don't refresh
        if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
          console.log("Current session is still valid, skipping refresh");
          return true;
        }
      }
      
      setRefreshInProgress(true);
      console.log("Attempting to refresh session...");
      
      // Debug current session state before refresh
      await debugSessionStatus();
      
      const refreshOperation = async () => {
        // Skip refresh if we don't have any session tokens to refresh from
        const storageKeyPrefix = 'sb-' + window.location.hostname.split('.')[0];
        const hasTokens = safeStorage.getItem('supabase.auth.token') || 
                        safeStorage.getItem(`${storageKeyPrefix}-auth-token`);
        
        if (!hasTokens) {
          console.log('No stored tokens found to refresh session from');
          return { data: { session: null }, error: null };
        }
        
        const { data, error } = await supabase.auth.refreshSession();
        
        // Handle the "Auth session missing" error case cleanly
        if (error) {
          if (error.message.includes('Auth session missing')) {
            console.log('No session exists to refresh (user not authenticated)');
            return { data, error: null }; // Convert to non-error for unauthenticated state
          }
          throw error;
        }
        
        return { data, error };
      };
      
      // Only try one refresh attempt to avoid endless loops
      let result;
      
      try {
        result = await refreshOperation();
      } catch (err: any) {
        console.warn(`Session refresh failed:`, err);
        setIsLoading(false);
        setRefreshInProgress(false);
        return false;
      }
      
      if (!result) {
        setIsLoading(false);
        setRefreshInProgress(false);
        return false;
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('Session refresh error:', error);
        setIsLoading(false);
        setRefreshInProgress(false);
        return false;
      }
      
      console.log("Session refresh result:", data.session ? "Success" : "No session returned");
      
      // Debug session state after refresh
      await debugSessionStatus();
      
      // Update state with refreshed session
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
      setRefreshInProgress(false);
      
      return !!data.session;
    } catch (error) {
      console.error('Error refreshing session:', error);
      setIsLoading(false);
      setRefreshInProgress(false);
      return false;
    } finally {
      // Ensure refresh flag is reset even if there's an exception
      setTimeout(() => {
        setRefreshInProgress(false);
      }, 500);
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
