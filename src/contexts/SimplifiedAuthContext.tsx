
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType } from '@/types/auth';
import { signInWithGoogle, signInWithEmail, signUp, resetPassword, signOut, refreshSession } from '@/services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initializationComplete, setInitializationComplete] = useState(false);

  console.log('[SimplifiedAuthContext] Rendering with state:', { 
    hasUser: !!user, 
    isLoading, 
    initializationComplete 
  });

  // Simple profile existence check without complex retry logic
  const ensureProfileExists = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      console.log('[SimplifiedAuthContext] Checking profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        console.error('[SimplifiedAuthContext] Profile check error:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('[SimplifiedAuthContext] Profile check failed:', error);
      return false;
    }
  };

  const updateUserProfile = async (metadata: Record<string, any>): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase.auth.updateUser({ data: metadata });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[SimplifiedAuthContext] Profile update failed:', error);
      return false;
    }
  };

  // Simplified auth initialization
  useEffect(() => {
    let mounted = true;
    
    console.log('[SimplifiedAuthContext] Starting auth initialization');
    
    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        console.log('[SimplifiedAuthContext] Initial session:', !!initialSession?.user);
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, currentSession) => {
            if (!mounted) return;
            
            console.log('[SimplifiedAuthContext] Auth state changed:', event, !!currentSession?.user);
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
          }
        );
        
        setInitializationComplete(true);
        setIsLoading(false);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('[SimplifiedAuthContext] Auth initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          setInitializationComplete(true);
        }
      }
    };
    
    const cleanup = initializeAuth();
    
    return () => {
      mounted = false;
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  const value = {
    session,
    user,
    isLoading,
    signInWithGoogle,
    signInWithEmail,
    signUp,
    resetPassword,
    signOut,
    refreshSession,
    updateUserProfile,
    ensureProfileExists,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
