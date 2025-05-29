
import { supabase } from '@/integrations/supabase/client';

export interface ChatThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  processing_status?: string;
  metadata?: any;
}

export const createChatThread = async (userId: string, title: string = "New Conversation"): Promise<ChatThread | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        user_id: userId, // Ensure user_id is set for RLS
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        processing_status: 'idle'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chat thread:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating chat thread:', error);
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
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId) // RLS will handle this, but explicit for clarity
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat threads:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching chat threads:', error);
    return [];
  }
};

export const getChatThread = async (threadId: string, userId: string): Promise<ChatThread | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .eq('user_id', userId) // Ensure user can only access their own threads
      .single();

    if (error) {
      console.error('Error fetching chat thread:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception fetching chat thread:', error);
    return null;
  }
};

// Add legacy alias for backward compatibility
export const fetchChatThreads = getChatThreads;
export const updateThreadTitle = async (threadId: string, title: string) => {
  // This function needs a userId parameter now, but we'll handle it via the main service
  console.warn('updateThreadTitle called without userId - use updateChatThread instead');
  return false;
};
