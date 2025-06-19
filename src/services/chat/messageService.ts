
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ChatMessage, ChatThread } from '@/types/chat';

export const createChatMessage = async (
  threadId: string,
  content: string,
  role: 'user' | 'assistant' = 'user',
  metadata?: any
): Promise<ChatMessage | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          thread_id: threadId,
          content,
          role,
          user_id: user.id,
          metadata: metadata || {}
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating chat message:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error in createChatMessage:', error);
    toast.error(`Failed to save message: ${error.message}`);
    return null;
  }
};

export const getChatMessages = async (threadId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat messages:', error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getChatMessages:', error);
    toast.error(`Failed to load messages: ${error.message}`);
    return [];
  }
};

export const updateChatMessage = async (
  messageId: string,
  updates: Partial<ChatMessage>
): Promise<ChatMessage | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating chat message:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error in updateChatMessage:', error);
    toast.error(`Failed to update message: ${error.message}`);
    return null;
  }
};

export const deleteChatMessage = async (messageId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting chat message:', error);
      throw error;
    }

    return true;
  } catch (error: any) {
    console.error('Error in deleteChatMessage:', error);
    toast.error(`Failed to delete message: ${error.message}`);
    return false;
  }
};

export const getMessagesByUser = async (userId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user messages:', error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getMessagesByUser:', error);
    return [];
  }
};

// Fixed function to get unique users from messages
export const getUniqueUsersFromMessages = async (threadId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('user_id')
      .eq('thread_id', threadId);

    if (error) {
      console.error('Error fetching unique users:', error);
      throw error;
    }

    // Extract unique user IDs
    const uniqueUserIds = [...new Set(data?.map(message => message.user_id) || [])];
    return uniqueUserIds.filter(Boolean); // Remove any null/undefined values
  } catch (error: any) {
    console.error('Error in getUniqueUsersFromMessages:', error);
    return [];
  }
};

export const searchMessages = async (
  query: string,
  userId?: string,
  threadId?: string
): Promise<ChatMessage[]> => {
  try {
    let queryBuilder = supabase
      .from('chat_messages')
      .select('*')
      .ilike('content', `%${query}%`);

    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId);
    }

    if (threadId) {
      queryBuilder = queryBuilder.eq('thread_id', threadId);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error searching messages:', error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in searchMessages:', error);
    return [];
  }
};
