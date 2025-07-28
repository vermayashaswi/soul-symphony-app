// Simplified session validation for native/web alignment
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface SimpleSessionState {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

export const useSimpleSession = () => {
  const [state, setState] = useState<SimpleSessionState>({
    session: null,
    isLoading: true,
    error: null
  });

  const getSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[SimpleSession] Session error:', error);
        setState({
          session: null,
          isLoading: false,
          error: error.message
        });
        return;
      }

      setState({
        session,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('[SimpleSession] Failed to get session:', error);
      setState({
        session: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  useEffect(() => {
    getSession();
  }, []);

  return {
    ...state,
    refreshSession: getSession
  };
};

// Keep backward compatibility
export const useSessionValidation = useSimpleSession;
