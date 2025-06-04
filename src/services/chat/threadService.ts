
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
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        processing_status: 'idle'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating chat thread:', error);
    return null;
  }
};

export const updateChatThread = async (threadId: string, updates: Partial<ChatThread>): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating chat thread:', error);
    return false;
  }
};

export const deleteChatThread = async (threadId: string): Promise<boolean> => {
  try {
    // Delete messages first (due to foreign key constraint)
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('thread_id', threadId);

    if (messagesError) throw messagesError;

    // Then delete the thread
    const { error: threadError } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', threadId);

    if (threadError) throw threadError;
    return true;
  } catch (error) {
    console.error('Error deleting chat thread:', error);
    return false;
  }
};

export const getChatThreads = async (userId: string): Promise<ChatThread[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching chat threads:', error);
    return [];
  }
};

export const getChatThread = async (threadId: string): Promise<ChatThread | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching chat thread:', error);
    return null;
  }
};
