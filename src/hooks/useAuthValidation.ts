import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface AuthValidationResult {
  isValid: boolean;
  userId: string | null;
  error: string | null;
  isChecking: boolean;
}

/**
 * Hook to validate authentication context and ensure RLS policies will work correctly
 * This helps prevent the common "user not authenticated" RLS policy violations
 */
export const useAuthValidation = (): AuthValidationResult => {
  const { user } = useAuth();
  const [validationResult, setValidationResult] = useState<AuthValidationResult>({
    isValid: false,
    userId: null,
    error: null,
    isChecking: true
  });

  useEffect(() => {
    const validateAuth = async () => {
      try {
        // First check if user exists from context
        if (!user?.id) {
          setValidationResult({
            isValid: false,
            userId: null,
            error: 'No user in auth context',
            isChecking: false
          });
          return;
        }

        // Verify that auth.uid() in Supabase matches the user from context
        const { data: authCheck, error: authError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .limit(1);

        if (authError) {
          console.error('[useAuthValidation] Auth verification failed:', {
            error: authError,
            userId: user.id,
            errorCode: authError.code,
            errorMessage: authError.message
          });

          // Check if this is an RLS policy error
          if (authError.message?.includes('row-level security') || authError.code === 'PGRST116') {
            setValidationResult({
              isValid: false,
              userId: user.id,
              error: 'Authentication context mismatch - RLS policies will fail',
              isChecking: false
            });
            return;
          }

          setValidationResult({
            isValid: false,
            userId: user.id,
            error: `Auth verification error: ${authError.message}`,
            isChecking: false
          });
          return;
        }

        // Additional check: Try to access a simple user-specific resource
        const { error: threadCheckError } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (threadCheckError) {
          console.error('[useAuthValidation] Thread access check failed:', {
            error: threadCheckError,
            userId: user.id
          });

          if (threadCheckError.message?.includes('row-level security') || threadCheckError.code === 'PGRST116') {
            setValidationResult({
              isValid: false,
              userId: user.id,
              error: 'RLS authentication context mismatch detected',
              isChecking: false
            });
            return;
          }
        }

        setValidationResult({
          isValid: true,
          userId: user.id,
          error: null,
          isChecking: false
        });

      } catch (error) {
        console.error('[useAuthValidation] Exception during auth validation:', error);
        setValidationResult({
          isValid: false,
          userId: user?.id || null,
          error: `Validation exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isChecking: false
        });
      }
    };

    validateAuth();
  }, [user?.id]);

  return validationResult;
};

/**
 * Helper function to ensure authentication context is valid before database operations
 */
export const ensureAuthContextValid = async (userId: string): Promise<{ isValid: boolean; error?: string }> => {
  try {
    // Quick test to verify auth context
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .limit(1);

    if (error) {
      if (error.message?.includes('row-level security') || error.code === 'PGRST116') {
        return {
          isValid: false,
          error: 'Authentication context mismatch - please refresh the page and try again'
        };
      }
      return {
        isValid: false,
        error: `Auth context validation failed: ${error.message}`
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Auth validation exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};