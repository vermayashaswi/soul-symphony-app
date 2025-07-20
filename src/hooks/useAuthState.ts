import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { detectTWAEnvironment } from '@/utils/twaDetection';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isReady: boolean;
  isStable: boolean;
}

export const useAuthState = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isReady: false,
    isStable: false
  });

  useEffect(() => {
    console.log('[AuthState] Initializing auth state management');
    const twaEnv = detectTWAEnvironment();
    const isNative = nativeIntegrationService.isRunningNatively();
    
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`[AuthState] Auth event: ${event}`, {
          hasUser: !!session?.user,
          isNative,
          userId: session?.user?.id
        });
        
        setAuthState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session: session,
          isLoading: false
        }));
        
        // Mark as stable after processing
        const stabilityDelay = isNative ? 100 : (twaEnv.isTWA ? 300 : 500);
        setTimeout(() => {
          setAuthState(prev => ({
            ...prev,
            isStable: true,
            isReady: true
          }));
        }, stabilityDelay);
      }
    );

    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('[AuthState] Getting initial session');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthState] Error getting initial session:', error);
        }
        
        console.log('[AuthState] Initial session retrieved', {
          hasUser: !!session?.user,
          isNative,
          userId: session?.user?.id
        });
        
        setAuthState(prev => ({
          ...prev,
          user: session?.user ?? null,
          session: session,
          isLoading: false
        }));
        
        // Mark as ready faster for native
        const readyDelay = isNative ? 100 : (twaEnv.isTWA ? 300 : 500);
        setTimeout(() => {
          setAuthState(prev => ({
            ...prev,
            isStable: true,
            isReady: true
          }));
        }, readyDelay);
        
      } catch (error) {
        console.error('[AuthState] Failed to initialize auth:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          isReady: true,
          isStable: true
        }));
      }
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return authState;
};