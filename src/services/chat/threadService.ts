
import { supabase } from '@/integrations/supabase/client';

export interface ChatThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export const createChatThread = async (userId: string, title: string = "New Conversation"): Promise<ChatThread | null> => {
  if (!userId) {
    console.error('[ThreadService] Cannot create chat thread: userId is required');
    return null;
  }

  try {
    console.log(`[ThreadService] Creating new thread for user ${userId} with title: ${title}`);
    
    // Enhanced thread creation with validation
    const threadData = {
      user_id: userId, // Ensure user_id is set for RLS
      title: title.trim() || "New Conversation", // Ensure title is not empty
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[ThreadService] Thread data prepared:', {
      user_id: threadData.user_id,
      title: threadData.title,
      timestamp: threadData.created_at
    });
    
    const { data, error } = await supabase
      .from('chat_threads')
      .insert(threadData)
      .select()
      .single();

    if (error) {
      console.error('[ThreadService] Error creating chat thread:', {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        user_id: userId,
        rls_context: 'Check if RLS policies are blocking thread creation'
      });
      
      // Check if this is an RLS policy violation
      if (error.message?.includes('row-level security') || error.code === 'PGRST116') {
        console.error('[ThreadService] RLS POLICY VIOLATION DETECTED during thread creation:', {
          userId,
          error_details: error,
          suggestion: 'Verify that auth.uid() is properly set and matches the user_id'
        });
      }
      
      return null;
    }

    console.log(`[ThreadService] Successfully created thread: ${data.id} for user: ${userId}`);
    return data;
  } catch (error) {
    console.error('[ThreadService] Exception creating chat thread:', {
      error,
      userId,
      title,
      stack: error instanceof Error ? error.stack : 'No stack available'
    });
    return null;
  }
};

export const updateChatThread = async (threadId: string, updates: Partial<ChatThread>, userId: string): Promise<ChatThread | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .eq('user_id', userId) // Ensure user can only update their own threads
      .select()
      .single();

    if (error) {
      console.error('Error updating chat thread:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating chat thread:', error);
    return null;
  }
};

export const deleteChatThread = async (threadId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', threadId)
      .eq('user_id', userId); // Ensure user can only delete their own threads

    if (error) {
      console.error('Error deleting chat thread:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting chat thread:', error);
    return false;
  }
};

export const getChatThreads = async (userId: string): Promise<ChatThread[]> => {
  if (!userId) {
    console.error('[ThreadService] Cannot fetch threads: userId is required');
    return [];
  }

  try {
    console.log(`[ThreadService] Fetching threads for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId) // RLS will handle this, but explicit for clarity
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[ThreadService] Error fetching chat threads:', error);
      return [];
    }

    console.log(`[ThreadService] Successfully fetched ${data?.length || 0} threads`);
    return data || [];
  } catch (error) {
    console.error('[ThreadService] Exception fetching chat threads:', error);
    return [];
  }
};

export const getChatThread = async (threadId: string, userId: string): Promise<ChatThread | null> => {
  if (!threadId || !userId) {
    console.error('[ThreadService] Cannot fetch thread: threadId and userId are required');
    return null;
  }

  try {
    console.log(`[ThreadService] Fetching thread ${threadId} for user ${userId}`);
    
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId) // Ensure user can only access their own threads
      .single();

    if (error) {
      console.error(`[ThreadService] Error fetching chat thread ${threadId}:`, error);
      return null;
    }

    console.log(`[ThreadService] Successfully fetched thread: ${threadId}`);
    return data;
  } catch (error) {
    console.error('[ThreadService] Exception fetching chat thread:', error);
    return null;
  }
};

// Add legacy alias for backward compatibility
export const fetchChatThreads = getChatThreads;
export const updateThreadTitle = async (threadId: string, title: string, userId: string) => {
  const result = await updateChatThread(threadId, { title }, userId);
  return !!result;
};
