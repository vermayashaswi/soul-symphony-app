import { supabase } from "@/integrations/supabase/client";

/**
 * Safely cleans up stale processing messages that are older than a specified time
 * @param maxAgeMinutes - Messages older than this many minutes will be cleaned up
 * @param userId - Optional user ID to limit cleanup to specific user's messages
 */
export const cleanupStaleProcessingMessages = async (
  maxAgeMinutes: number = 10,
  userId?: string
): Promise<{ cleaned: number; errors: string[] }> => {
  const errors: string[] = [];
  let cleaned = 0;

  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
    
    console.log(`[MessageCleanup] Starting cleanup of processing messages older than ${maxAgeMinutes} minutes (before ${cutoffTime})`);
    
    // Build query conditions
    let query = supabase
      .from('chat_messages')
      .select('id, thread_id, content, created_at, sender')
      .eq('is_processing', true)
      .lt('created_at', cutoffTime);
    
    // Add user filter if provided
    if (userId) {
      // Need to join with chat_threads to filter by user_id
      query = supabase
        .from('chat_messages')
        .select(`
          id, 
          thread_id, 
          content, 
          created_at, 
          sender,
          chat_threads!inner(user_id)
        `)
        .eq('is_processing', true)
        .lt('created_at', cutoffTime)
        .eq('chat_threads.user_id', userId);
    }
    
    const { data: staleMessages, error: selectError } = await query;
    
    if (selectError) {
      const errorMsg = `Error finding stale messages: ${selectError.message}`;
      console.error('[MessageCleanup]', errorMsg);
      errors.push(errorMsg);
      return { cleaned: 0, errors };
    }
    
    if (!staleMessages || staleMessages.length === 0) {
      console.log('[MessageCleanup] No stale processing messages found');
      return { cleaned: 0, errors };
    }
    
    console.log(`[MessageCleanup] Found ${staleMessages.length} stale processing messages:`, 
      staleMessages.map(msg => ({
        id: msg.id,
        thread_id: msg.thread_id,
        created_at: msg.created_at,
        content: msg.content?.substring(0, 50) + '...'
      }))
    );
    
    // Delete the stale messages
    const messageIds = staleMessages.map(msg => msg.id);
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .in('id', messageIds);
    
    if (deleteError) {
      const errorMsg = `Error deleting stale messages: ${deleteError.message}`;
      console.error('[MessageCleanup]', errorMsg);
      errors.push(errorMsg);
      return { cleaned: 0, errors };
    }
    
    cleaned = staleMessages.length;
    console.log(`[MessageCleanup] Successfully cleaned up ${cleaned} stale processing messages`);
    
  } catch (error) {
    const errorMsg = `Unexpected error during cleanup: ${error}`;
    console.error('[MessageCleanup]', errorMsg);
    errors.push(errorMsg);
  }
  
  return { cleaned, errors };
};

/**
 * Ensures that any message marked as processing gets properly updated to non-processing
 * This is a safeguard to prevent messages from getting stuck in processing state
 */
export const ensureProcessingMessagesAreCompleted = async (
  threadId: string,
  timeoutMinutes: number = 5
): Promise<{ updated: number; errors: string[] }> => {
  const errors: string[] = [];
  let updated = 0;

  try {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    
    console.log(`[MessageCleanup] Checking for stuck processing messages in thread ${threadId}`);
    
    // Find messages that have been processing for too long
    const { data: stuckMessages, error: selectError } = await supabase
      .from('chat_messages')
      .select('id, content, created_at')
      .eq('thread_id', threadId)
      .eq('is_processing', true)
      .lt('created_at', cutoffTime);
    
    if (selectError) {
      const errorMsg = `Error finding stuck messages: ${selectError.message}`;
      console.error('[MessageCleanup]', errorMsg);
      errors.push(errorMsg);
      return { updated: 0, errors };
    }
    
    if (!stuckMessages || stuckMessages.length === 0) {
      console.log(`[MessageCleanup] No stuck processing messages found in thread ${threadId}`);
      return { updated: 0, errors };
    }
    
    console.log(`[MessageCleanup] Found ${stuckMessages.length} stuck processing messages in thread ${threadId}:`, 
      stuckMessages.map(msg => ({ id: msg.id, created_at: msg.created_at }))
    );
    
    // Update stuck messages to mark them as completed with error content
    const messageIds = stuckMessages.map(msg => msg.id);
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({
        is_processing: false,
        content: "Error: Message processing timed out. Please try again."
      })
      .in('id', messageIds);
    
    if (updateError) {
      const errorMsg = `Error updating stuck messages: ${updateError.message}`;
      console.error('[MessageCleanup]', errorMsg);
      errors.push(errorMsg);
      return { updated: 0, errors };
    }
    
    updated = stuckMessages.length;
    console.log(`[MessageCleanup] Successfully updated ${updated} stuck processing messages`);
    
  } catch (error) {
    const errorMsg = `Unexpected error ensuring completion: ${error}`;
    console.error('[MessageCleanup]', errorMsg);
    errors.push(errorMsg);
  }
  
  return { updated, errors };
};

/**
 * Debug function to check current processing messages state
 */
export const debugProcessingMessages = async (userId?: string): Promise<any[]> => {
  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        thread_id,
        content,
        created_at,
        is_processing,
        sender,
        chat_threads!inner(user_id, title)
      `)
      .eq('is_processing', true)
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('chat_threads.user_id', userId);
    }
    
    const { data: processingMessages, error } = await query;
    
    if (error) {
      console.error('[MessageCleanup] Error debugging processing messages:', error);
      return [];
    }
    
    console.log(`[MessageCleanup] Current processing messages:`, processingMessages);
    return processingMessages || [];
  } catch (error) {
    console.error('[MessageCleanup] Error in debugProcessingMessages:', error);
    return [];
  }
};