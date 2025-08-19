import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

export interface MessageEditResult {
  success: boolean;
  editedMessage?: ChatMessage;
  deletedCount?: number;
  error?: string;
}

/**
 * Edit a message and delete all downstream messages in the thread
 */
export const editMessageWithDownstreamDeletion = async (
  messageId: string,
  newContent: string,
  userId: string
): Promise<MessageEditResult> => {
  try {
    // Start a transaction-like operation by getting the message and its timestamp first
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message || message.chat_threads.user_id !== userId) {
      return {
        success: false,
        error: 'Message not found or access denied'
      };
    }

    // Only allow editing user messages
    if (message.sender !== 'user') {
      return {
        success: false,
        error: 'Only user messages can be edited'
      };
    }

    // Check if content actually changed
    if (message.content.trim() === newContent.trim()) {
      return {
        success: false,
        error: 'No changes detected in message content'
      };
    }

    // Delete all messages after this one in the thread (downstream deletion)
    const { error: deleteError, count } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('thread_id', message.thread_id)
      .gt('created_at', message.created_at);

    if (deleteError) {
      console.error('Error deleting downstream messages:', deleteError);
      return {
        success: false,
        error: 'Failed to delete downstream messages'
      };
    }

    // Update the message content
    const { data: updatedMessage, error: updateError } = await supabase
      .from('chat_messages')
      .update({ 
        content: newContent,
        // Reset any processing flags
        is_processing: false
      })
      .eq('id', messageId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating message:', updateError);
      return {
        success: false,
        error: 'Failed to update message content'
      };
    }

    // Update thread timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.thread_id)
      .eq('user_id', userId);

    return {
      success: true,
      editedMessage: {
        ...updatedMessage,
        sender: updatedMessage.sender as 'user' | 'assistant' | 'error',
        role: updatedMessage.role as 'user' | 'assistant' | 'error',
        sub_query_responses: Array.isArray(updatedMessage.sub_query_responses) ? updatedMessage.sub_query_responses : []
      },
      deletedCount: count || 0
    };
  } catch (error) {
    console.error('Exception in editMessageWithDownstreamDeletion:', error);
    return {
      success: false,
      error: 'An unexpected error occurred'
    };
  }
};

/**
 * Check if a message can be edited by the user
 */
export const canEditMessage = async (
  messageId: string,
  userId: string
): Promise<{ canEdit: boolean; reason?: string }> => {
  try {
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select(`
        sender,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .single();

    if (error || !message) {
      return { canEdit: false, reason: 'Message not found' };
    }

    if (message.chat_threads.user_id !== userId) {
      return { canEdit: false, reason: 'Access denied' };
    }

    if (message.sender !== 'user') {
      return { canEdit: false, reason: 'Only user messages can be edited' };
    }

    return { canEdit: true };
  } catch (error) {
    console.error('Error checking edit permissions:', error);
    return { canEdit: false, reason: 'Permission check failed' };
  }
};

/**
 * Get messages that would be deleted if a specific message is edited
 */
export const getDownstreamMessages = async (
  messageId: string,
  userId: string
): Promise<ChatMessage[]> => {
  try {
    // First get the message to find its timestamp and thread
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        created_at,
        thread_id,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message || message.chat_threads.user_id !== userId) {
      return [];
    }

    // Get all messages after this one
    const { data: downstreamMessages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', message.thread_id)
      .gt('created_at', message.created_at)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching downstream messages:', error);
      return [];
    }

    return (downstreamMessages || []).map(msg => ({
      ...msg,
      sender: msg.sender as 'user' | 'assistant' | 'error',
      role: msg.role as 'user' | 'assistant' | 'error',
      sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
    }));
  } catch (error) {
    console.error('Error getting downstream messages:', error);
    return [];
  }
};