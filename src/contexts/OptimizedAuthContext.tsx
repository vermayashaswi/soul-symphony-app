import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { optimizedRouteService } from '@/services/optimizedRouteService';

interface OptimizedAuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasValidSession: boolean;
}

const OptimizedAuthContext = createContext<OptimizedAuthContextType | undefined>(undefined);

export function OptimizedAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isNative = optimizedRouteService.isNativeApp();

  useEffect(() => {
    let mounted = true;

    // Immediate localStorage check for native apps
    if (isNative) {
      const hasTokens = localStorage.getItem('sb-kwnwhgucnzqxndzjayyq-auth-token');
      if (hasTokens && mounted) {
        console.log('[OptimizedAuth] Found cached tokens for native app');
        setIsLoading(false); // Allow immediate navigation
      }
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('[OptimizedAuth] Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        // For native apps, defer profile creation to avoid blocking
        if (session?.user && isNative) {
          setTimeout(() => {
            if (mounted) {
              ensureProfileExists(session.user);
            }
          }, 100);
        }
        
        setIsLoading(false);
      }
    );

    // Get initial session (non-blocking for native)
    if (isNative) {
      // Defer session check for native apps to allow immediate navigation
      setTimeout(() => {
        if (mounted) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
              setSession(session);
              setUser(session?.user ?? null);
              setIsLoading(false);
            }
          });
        }
      }, 50);
    } else {
      // Immediate session check for web
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      });
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isNative]);

  // Simplified profile creation without retries
  const ensureProfileExists = async (user: User) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          avatar_url: user.user_metadata?.avatar_url || ''
        });
        console.log('[OptimizedAuth] Profile created for user');
      }
    } catch (error) {
      console.warn('[OptimizedAuth] Profile creation failed (non-critical):', error);
    }
  };

  const contextValue: OptimizedAuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    hasValidSession: !!session
  };

  return (
    <OptimizedAuthContext.Provider value={contextValue}>
      {children}
    </OptimizedAuthContext.Provider>
  );
}

export function useOptimizedAuthContext() {
  const context = useContext(OptimizedAuthContext);
  if (context === undefined) {
    throw new Error('useOptimizedAuthContext must be used within an OptimizedAuthProvider');
  }
  return context;
}