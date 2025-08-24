// STREAMING PARITY FIX: Utility to clean up stuck processing messages
import { supabase } from '@/integrations/supabase/client';

/**
 * Removes all stuck processing messages from the database
 * These can accumulate when users navigate away during processing
 */
export const cleanupStuckProcessingMessages = async (userId?: string): Promise<void> => {
  try {
    console.log('[ProcessingCleanup] Removing stuck processing messages');
    
    let query = supabase
      .from('chat_messages')
      .delete()
      .eq('is_processing', true);
    
    // If userId provided, only clean up for that user's threads
    if (userId) {
      const { data: userThreads } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', userId);
      
      if (userThreads && userThreads.length > 0) {
        const threadIds = userThreads.map(t => t.id);
        query = query.in('thread_id', threadIds);
      }
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('[ProcessingCleanup] Error cleaning up processing messages:', error);
    } else {
      console.log('[ProcessingCleanup] Successfully cleaned up stuck processing messages');
    }
  } catch (error) {
    console.error('[ProcessingCleanup] Exception during cleanup:', error);
  }
};

/**
 * Removes processing messages older than specified minutes
 */
export const cleanupOldProcessingMessages = async (olderThanMinutes: number = 10): Promise<void> => {
  try {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('is_processing', true)
      .lt('created_at', cutoffTime);
    
    if (error) {
      console.error('[ProcessingCleanup] Error cleaning up old processing messages:', error);
    } else {
      console.log(`[ProcessingCleanup] Cleaned up processing messages older than ${olderThanMinutes} minutes`);
    }
  } catch (error) {
    console.error('[ProcessingCleanup] Exception during old message cleanup:', error);
  }
};

/**
 * Clean up processing messages for a specific thread
 */
export const cleanupThreadProcessingMessages = async (threadId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('thread_id', threadId)
      .eq('is_processing', true);
    
    if (error) {
      console.error(`[ProcessingCleanup] Error cleaning up processing messages for thread ${threadId}:`, error);
    } else {
      console.log(`[ProcessingCleanup] Cleaned up processing messages for thread ${threadId}`);
    }
  } catch (error) {
    console.error('[ProcessingCleanup] Exception during thread cleanup:', error);
  }
};