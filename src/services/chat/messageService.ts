
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

// Alias for backward compatibility
export const getThreadMessages = async (threadId: string, userId?: string): Promise<ChatMessage[]> => {
  try {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching thread messages:', error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getThreadMessages:', error);
    toast.error(`Failed to load messages: ${error.message}`);
    return [];
  }
};

// Save message function
export const saveMessage = async (
  threadId: string,
  content: string,
  role: 'user' | 'assistant' | 'error',
  userId: string,
  references?: any[] | null,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[]
): Promise<ChatMessage | null> => {
  try {
    const messageData: any = {
      thread_id: threadId,
      content,
      role,
      sender: role, // Set sender same as role for compatibility
      user_id: userId,
      reference_entries: references || null,
      has_numeric_result: hasNumericResult || false
    };

    if (isInteractive && interactiveOptions) {
      messageData.metadata = { 
        isInteractive: true, 
        interactiveOptions 
      };
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select('*')
      .single();

    if (error) {
      console.error('Error saving message:', error);
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error in saveMessage:', error);
    toast.error(`Failed to save message: ${error.message}`);
    return null;
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

// Thread management functions
export const createThread = async (userId: string, title: string = "New Conversation"): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert([
        {
          user_id: userId,
          title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating thread:', error);
      throw error;
    }

    return data?.id || null;
  } catch (error: any) {
    console.error('Error in createThread:', error);
    toast.error(`Failed to create thread: ${error.message}`);
    return null;
  }
};

export const getUserChatThreads = async (userId: string): Promise<ChatThread[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching user threads:', error);
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getUserChatThreads:', error);
    return [];
  }
};

export const updateThreadTitle = async (threadId: string, title: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ 
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);

    if (error) {
      console.error('Error updating thread title:', error);
      throw error;
    }

    return true;
  } catch (error: any) {
    console.error('Error in updateThreadTitle:', error);
    toast.error(`Failed to update thread title: ${error.message}`);
    return false;
  }
};
