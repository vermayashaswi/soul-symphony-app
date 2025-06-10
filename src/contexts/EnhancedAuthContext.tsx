
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthContextType } from '@/types/auth';
import { enhancedProfileService } from '@/services/enhancedProfileService';
import { sessionManager } from '@/services/sessionManager';
import { logInfo, logError, logAuthError, logProfile, logAuth } from '@/components/debug/DebugPanel';
import { useLocation } from 'react-router-dom';
import { SessionTrackingService } from '@/services/sessionTrackingService';

const EnhancedAuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function EnhancedAuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<{
    exists: boolean;
    creating: boolean;
    error: string | null;
  }>({ exists: false, creating: false, error: null });
  const location = useLocation();

  // Enhanced session management
  const handleSessionChange = async (event: string, currentSession: Session | null) => {
    logAuth(`Enhanced auth state changed: ${event}`, 'EnhancedAuthContext', {
      hasSession: !!currentSession,
      userId: currentSession?.user?.id
    });

    setSession(currentSession);
    setUser(currentSession?.user ?? null);

    if (event === 'SIGNED_IN' && currentSession?.user) {
      await handleUserSignIn(currentSession.user);
    } else if (event === 'SIGNED_OUT') {
      handleUserSignOut();
    }
  };

  // Handle user sign in with enhanced profile creation
  const handleUserSignIn = async (signedInUser: User) => {
    try {
      setProfileStatus({ exists: false, creating: true, error: null });
      
      logProfile('Starting enhanced profile creation process', 'EnhancedAuthContext', {
        userId: signedInUser.id,
        email: signedInUser.email
      });

      // Start session monitoring
      sessionManager.startSessionMonitoring();

      // Create user session tracking
      await createUserSession(signedInUser.id);

      // Ensure profile exists with enhanced error handling
      const profileResult = await enhancedProfileService.ensureProfileExists(signedInUser);
      
      if (profileResult.success) {
        setProfileStatus({ exists: true, creating: false, error: null });
        logProfile('Profile creation/verification successful', 'EnhancedAuthContext');
        
        if (location.pathname.includes('/app/')) {
          toast.success('Signed in successfully');
        }
      } else {
        const errorMsg = profileResult.error || 'Unknown profile creation error';
        setProfileStatus({ exists: false, creating: false, error: errorMsg });
        logAuthError(`Profile creation failed: ${errorMsg}`, 'EnhancedAuthContext');
        
        // Show user-friendly error message
        toast.error('There was an issue setting up your profile. Please try refreshing the page.');
      }
    } catch (error: any) {
      const errorMsg = `Error in sign-in process: ${error.message}`;
      setProfileStatus({ exists: false, creating: false, error: errorMsg });
      logAuthError(errorMsg, 'EnhancedAuthContext', error);
      toast.error('Sign-in encountered an issue. Please try again.');
    }
  };

  // Handle user sign out
  const handleUserSignOut = () => {
    setProfileStatus({ exists: false, creating: false, error: null });
    sessionManager.stopSessionMonitoring();
    logInfo('User signed out, session monitoring stopped', 'EnhancedAuthContext');
  };

  // Create user session with tracking
  const createUserSession = async (userId: string): Promise<void> => {
    try {
      const sessionData = {
        userId,
        deviceType: /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        userAgent: navigator.userAgent,
        entryPage: window.location.pathname,
        lastActivePage: window.location.pathname,
        language: navigator.language?.split('-')[0] || 'en',
        referrer: document.referrer || null,
      };

      await SessionTrackingService.createUserSession(sessionData);
      logInfo('User session created successfully', 'EnhancedAuthContext');
    } catch (error: any) {
      logError(`Error creating user session: ${error.message}`, 'EnhancedAuthContext', error);
    }
  };

  // Initialize auth state and session monitoring
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        logInfo('Initializing enhanced auth system', 'EnhancedAuthContext');

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (mounted) {
              handleSessionChange(event, session);
            }
          }
        );

        // Get initial session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          logError(`Error getting initial session: ${error.message}`, 'EnhancedAuthContext', error);
        } else if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await handleUserSignIn(initialSession.user);
          }
        }

        if (mounted) {
          setIsLoading(false);
        }

        return () => {
          subscription.unsubscribe();
          sessionManager.cleanup();
        };
      } catch (error: any) {
        logError(`Error initializing auth: ${error.message}`, 'EnhancedAuthContext', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    const cleanup = initializeAuth();

    return () => {
      mounted = false;
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  // Enhanced auth methods with session validation
  const signInWithGoogle = async (): Promise<void> => {
    try {
      setIsLoading(true);
      logInfo('Starting enhanced Google sign-in', 'EnhancedAuthContext');

      const redirectUrl = `${window.location.origin}/app/auth`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      logAuthError(`Enhanced Google sign-in failed: ${error.message}`, 'EnhancedAuthContext', error);
      setIsLoading(false);
      toast.error(`Sign-in failed: ${error.message}`);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      logInfo('Starting enhanced sign-out', 'EnhancedAuthContext');
      
      // Clear profile status
      setProfileStatus({ exists: false, creating: false, error: null });
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      // Navigate to onboarding
      window.location.href = '/app/onboarding';
    } catch (error: any) {
      logAuthError(`Enhanced sign-out error: ${error.message}`, 'EnhancedAuthContext', error);
      
      // Force navigation even on error
      window.location.href = '/app/onboarding';
      toast.error('Sign-out completed with minor issues');
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      const refreshedSession = await sessionManager.refreshSession();
      if (refreshedSession) {
        setSession(refreshedSession);
        setUser(refreshedSession.user);
      }
    } catch (error: any) {
      logError(`Error refreshing session: ${error.message}`, 'EnhancedAuthContext', error);
    }
  };

  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user || profileStatus.creating) {
      return false;
    }

    if (profileStatus.exists) {
      return true;
    }

    setProfileStatus(prev => ({ ...prev, creating: true, error: null }));
    
    const result = await enhancedProfileService.ensureProfileExists(user);
    
    setProfileStatus({
      exists: result.success,
      creating: false,
      error: result.success ? null : (result.error || 'Unknown error')
    });

    return result.success;
  };

  // Placeholder implementations for interface compatibility
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    // Implementation would go here
    throw new Error('Email sign-in not implemented in enhanced context');
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    // Implementation would go here
    throw new Error('Sign-up not implemented in enhanced context');
  };

  const resetPassword = async (email: string): Promise<void> => {
    // Implementation would go here
    throw new Error('Password reset not implemented in enhanced context');
  };

  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    if (!user) return false;
    
    const result = await enhancedProfileService.updateProfile(user.id, metadata);
    return result.success;
  };

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    signInWithGoogle,
    signOut,
    refreshSession,
    signInWithEmail,
    signUp,
    resetPassword,
    updateUserProfile,
    ensureProfileExists,
  };

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
}

export function useEnhancedAuth() {
  const context = useContext(EnhancedAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
}

export { EnhancedAuthProvider };
