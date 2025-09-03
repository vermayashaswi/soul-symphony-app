import { supabase } from '@/integrations/supabase/client';

/**
 * Debug service for chat message saving issues
 */

export interface MessageSaveDebugInfo {
  userId: string;
  threadId: string;
  requestId: string;
  timestamp: string;
  profileExists: boolean;
  entryCount: number;
  threadExists: boolean;
  threadUserId: string | null;
  authState: 'valid' | 'invalid' | 'error';
  authUserId: string | null;
  errorType?: string;
  errorMessage?: string;
}

/**
 * Comprehensive diagnostic function for message saving issues
 */
export const diagnoseChatMessageSave = async (
  userId: string,
  threadId: string,
  requestId?: string
): Promise<MessageSaveDebugInfo> => {
  const debugInfo: MessageSaveDebugInfo = {
    userId,
    threadId,
    requestId: requestId || `debug_${Date.now()}`,
    timestamp: new Date().toISOString(),
    profileExists: false,
    entryCount: 0,
    threadExists: false,
    threadUserId: null,
    authState: 'error',
    authUserId: null
  };

  try {
    console.log('[ChatDebug] Starting diagnostic for:', { userId, threadId, requestId });

    // Check authentication state
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        debugInfo.authState = 'error';
        debugInfo.errorMessage = authError.message;
      } else if (user) {
        debugInfo.authState = user.id === userId ? 'valid' : 'invalid';
        debugInfo.authUserId = user.id;
      } else {
        debugInfo.authState = 'invalid';
      }
    } catch (authException) {
      debugInfo.authState = 'error';
      debugInfo.errorMessage = authException.message;
    }

    // Check profile existence
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, entry_count')
        .eq('id', userId)
        .single();

      if (!profileError && profile) {
        debugInfo.profileExists = true;
        debugInfo.entryCount = profile.entry_count || 0;
      }
    } catch (profileException) {
      console.error('[ChatDebug] Profile check exception:', profileException);
    }

    // Check thread existence and ownership
    try {
      const { data: thread, error: threadError } = await supabase
        .from('chat_threads')
        .select('id, user_id')
        .eq('id', threadId)
        .single();

      if (!threadError && thread) {
        debugInfo.threadExists = true;
        debugInfo.threadUserId = thread.user_id;
      }
    } catch (threadException) {
      console.error('[ChatDebug] Thread check exception:', threadException);
    }

    console.log('[ChatDebug] Diagnostic completed:', debugInfo);
    return debugInfo;

  } catch (error) {
    console.error('[ChatDebug] Diagnostic failed:', error);
    debugInfo.errorType = 'DIAGNOSTIC_ERROR';
    debugInfo.errorMessage = error.message;
    return debugInfo;
  }
};

/**
 * Test message save for users with 0 entries
 */
export const testMessageSaveForNewUser = async (userId: string, threadId: string) => {
  console.log('[ChatDebug] Testing message save for new user:', { userId, threadId });
  
  const diagnostic = await diagnoseChatMessageSave(userId, threadId);
  
  console.log('[ChatDebug] Pre-save diagnostic:', diagnostic);
  
  if (!diagnostic.profileExists) {
    console.warn('[ChatDebug] Profile missing for user - this may cause save failures');
  }
  
  if (diagnostic.entryCount === 0) {
    console.log('[ChatDebug] User has 0 journal entries - monitoring for save issues');
  }
  
  if (!diagnostic.threadExists) {
    console.error('[ChatDebug] Thread does not exist - save will fail');
  }
  
  if (diagnostic.authState !== 'valid') {
    console.error('[ChatDebug] Authentication issue detected:', diagnostic.authState);
  }
  
  return diagnostic;
};