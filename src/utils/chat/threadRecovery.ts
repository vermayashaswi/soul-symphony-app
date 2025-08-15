import { supabase } from '@/integrations/supabase/client';

export interface ThreadRecoveryResult {
  recovered: boolean;
  threadId?: string;
  messageCount?: number;
  error?: string;
}

/**
 * Recovers threads that may have become "lost" due to real-time sync issues
 */
export const recoverLostThreads = async (userId: string): Promise<ThreadRecoveryResult[]> => {
  try {
    console.log('[ThreadRecovery] Starting recovery process for user:', userId);
    
    // Get all threads that should exist for this user
    const { data: allThreads, error: threadsError } = await supabase
      .from('chat_threads')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (threadsError) {
      console.error('[ThreadRecovery] Error fetching threads:', threadsError);
      return [{ recovered: false, error: threadsError.message }];
    }
    
    if (!allThreads || allThreads.length === 0) {
      console.log('[ThreadRecovery] No threads found for user');
      return [{ recovered: false, error: 'No threads found' }];
    }
    
    console.log(`[ThreadRecovery] Found ${allThreads.length} threads for user`);
    
    const recoveryResults: ThreadRecoveryResult[] = [];
    
    // Check each thread for message count and visibility
    for (const thread of allThreads) {
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('id, created_at')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error(`[ThreadRecovery] Error fetching messages for thread ${thread.id}:`, messagesError);
        recoveryResults.push({
          recovered: false,
          threadId: thread.id,
          error: messagesError.message
        });
        continue;
      }
      
      const messageCount = messages?.length || 0;
      console.log(`[ThreadRecovery] Thread ${thread.id} has ${messageCount} messages`);
      
      // Emit a custom event to refresh this thread in the UI
      const recoveryEvent = new CustomEvent('threadRecovered', {
        detail: {
          threadId: thread.id,
          title: thread.title,
          messageCount,
          lastUpdated: thread.updated_at
        }
      });
      window.dispatchEvent(recoveryEvent);
      
      recoveryResults.push({
        recovered: true,
        threadId: thread.id,
        messageCount
      });
    }
    
    console.log('[ThreadRecovery] Recovery complete:', recoveryResults);
    return recoveryResults;
    
  } catch (error) {
    console.error('[ThreadRecovery] Exception during recovery:', error);
    return [{ recovered: false, error: error instanceof Error ? error.message : 'Unknown error' }];
  }
};

/**
 * Checks if a specific thread exists and has messages
 */
export const validateThreadExistence = async (threadId: string, userId: string): Promise<{
  exists: boolean;
  messageCount: number;
  lastMessage?: any;
  error?: string;
}> => {
  try {
    // Check if thread exists and belongs to user
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();
    
    if (threadError || !thread) {
      return {
        exists: false,
        messageCount: 0,
        error: threadError?.message || 'Thread not found'
      };
    }
    
    // Check message count
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false });
    
    if (messagesError) {
      return {
        exists: true,
        messageCount: 0,
        error: messagesError.message
      };
    }
    
    return {
      exists: true,
      messageCount: messages?.length || 0,
      lastMessage: messages?.[0] || null
    };
    
  } catch (error) {
    return {
      exists: false,
      messageCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};