
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';
import { signInWithGoogle, signOut, signInWithEmail, signUp, resetPassword } from '@/services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Check if current path is a public page that doesn't require auth
 */
const isPublicPage = (pathname: string): boolean => {
  const publicPaths = ['/', '/privacy-policy', '/faq', '/download', '/blog'];
  return publicPaths.includes(pathname) || pathname.startsWith('/blog/');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthContext: Error getting initial session:', error);
          
          // Handle invalid refresh token specifically
          if (error.message.includes('refresh_token_not_found')) {
            console.log('AuthContext: Invalid refresh token detected, clearing auth state');
            
            // Clear invalid tokens but only if not on public page
            if (!isPublicPage(window.location.pathname)) {
              const keys = Object.keys(localStorage);
              keys.forEach(key => {
                if (key.startsWith('supabase.auth.token')) {
                  localStorage.removeItem(key);
                }
              });
            }
          }
          
          // For public pages, don't treat auth errors as critical
          if (isPublicPage(window.location.pathname)) {
            console.log('AuthContext: On public page, ignoring auth error');
            if (mounted) {
              setSession(null);
              setUser(null);
              setIsLoading(false);
            }
            return;
          }
        }

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('AuthContext: Exception getting initial session:', error);
        
        // For public pages, don't let auth errors block the page
        if (isPublicPage(window.location.pathname)) {
          console.log('AuthContext: On public page, ignoring auth exception');
          if (mounted) {
            setSession(null);
            setUser(null);
            setIsLoading(false);
          }
          return;
        }
        
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: Auth state changed:', event);
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        // Handle refresh token errors gracefully
        if (error.message.includes('refresh_token_not_found')) {
          console.log('AuthContext: Refresh token not found, signing out');
          await signOut();
          return;
        }
        throw error;
      }
      setSession(session);
      setUser(session?.user ?? null);
    } catch (error: any) {
      console.error('AuthContext: Error refreshing session:', error);
      // Don't throw on public pages
      if (!isPublicPage(window.location.pathname)) {
        throw error;
      }
    }
  };

  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: metadata
      });

      if (error) {
        console.error('Error updating user profile:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception updating user profile:', error);
      return false;
    }
  };

  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error checking profile existence:', fetchError);
        return false;
      }

      if (!existingProfile) {
        // Create profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Exception ensuring profile exists:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    session,
    user,
    isLoading,
    signInWithGoogle,
    signOut: () => signOut(),
    refreshSession,
    signInWithEmail,
    signUp,
    resetPassword,
    updateUserProfile,
    ensureProfileExists,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
