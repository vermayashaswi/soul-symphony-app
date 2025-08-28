import { supabase } from '@/integrations/supabase/client';

export interface AuthValidationResult {
  isValid: boolean;
  userId?: string;
  sessionId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Comprehensive authentication validation for chat operations
 * This helps diagnose auth.uid() returning null issues
 */
export const validateAuthForChat = async (): Promise<AuthValidationResult> => {
  try {
    console.log('[AuthValidation] Starting comprehensive auth validation');
    
    // Step 1: Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[AuthValidation] Session error:', sessionError);
      return {
        isValid: false,
        error: 'Session check failed',
        errorCode: sessionError.code || 'SESSION_ERROR'
      };
    }

    if (!session) {
      console.error('[AuthValidation] No session found');
      return {
        isValid: false,
        error: 'No active session',
        errorCode: 'NO_SESSION'
      };
    }

    if (!session.user) {
      console.error('[AuthValidation] Session exists but no user');
      return {
        isValid: false,
        error: 'Session exists but no user data',
        errorCode: 'NO_USER'
      };
    }

    // Step 2: Test database access with auth.uid()
    try {
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();

      if (testError && testError.code !== 'PGRST116') { // PGRST116 is "not found" which is okay
        console.error('[AuthValidation] Database access test failed:', testError);
        return {
          isValid: false,
          error: 'Database access failed with valid session',
          errorCode: testError.code || 'DB_ACCESS_ERROR'
        };
      }

      console.log('[AuthValidation] Database access test passed');
    } catch (dbError) {
      console.error('[AuthValidation] Database access exception:', dbError);
      return {
        isValid: false,
        error: 'Database access exception',
        errorCode: 'DB_EXCEPTION'
      };
    }

    // Step 3: Validate token expiry
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= now) {
      console.error('[AuthValidation] Session expired');
      return {
        isValid: false,
        error: 'Session has expired',
        errorCode: 'SESSION_EXPIRED'
      };
    }

    console.log('[AuthValidation] All validation checks passed');
    return {
      isValid: true,
      userId: session.user.id,
      sessionId: session.access_token.substring(0, 10) + '...' // Partial token for logging
    };

  } catch (error) {
    console.error('[AuthValidation] Unexpected validation error:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
      errorCode: 'VALIDATION_EXCEPTION'
    };
  }
};

/**
 * Test RLS policy access for chat operations
 */
export const testChatRLSAccess = async (userId: string): Promise<{ canAccessThreads: boolean; canCreateMessages: boolean; error?: string }> => {
  try {
    console.log('[AuthValidation] Testing RLS access for user:', userId);

    // Test thread access
    let canAccessThreads = false;
    try {
      const { data: threadsData, error: threadsError } = await supabase
        .from('chat_threads')
        .select('id')
        .limit(1);

      canAccessThreads = !threadsError;
      if (threadsError) {
        console.log('[AuthValidation] Thread access error:', threadsError.message);
      }
    } catch (error) {
      console.log('[AuthValidation] Thread access exception:', error);
    }

    // Test message creation access
    let canCreateMessages = false;
    try {
      // Try to insert a test message (this will fail but should not be an RLS issue)
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: 'test-thread-id-will-fail',
          content: 'test',
          sender: 'user',
          role: 'user'
        });

      // We expect this to fail due to foreign key, not RLS
      canCreateMessages = messageError?.code !== '42501'; // 42501 is RLS denial
      console.log('[AuthValidation] Message insert test error code:', messageError?.code);
    } catch (error) {
      console.log('[AuthValidation] Message insert test exception:', error);
    }

    return {
      canAccessThreads,
      canCreateMessages,
      error: (!canAccessThreads || !canCreateMessages) ? 'RLS access limited' : undefined
    };

  } catch (error) {
    return {
      canAccessThreads: false,
      canCreateMessages: false,
      error: error instanceof Error ? error.message : 'RLS test failed'
    };
  }
};