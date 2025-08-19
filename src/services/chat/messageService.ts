
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';
import { parseMessageContent, getSanitizedFinalContent } from '@/utils/messageParser';

export const createChatMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant', 
  userId: string,
  additionalData?: Partial<ChatMessage>
): Promise<ChatMessage | null> => {
  try {
    // First verify the thread belongs to the user
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();

    if (threadError || !thread) {
      console.error('Thread not found or access denied:', threadError);
      return null;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content,
        sender,
        role: sender,
        created_at: new Date().toISOString(),
        ...additionalData
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating chat message:', error);
      return null;
    }

    // Update thread's updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('user_id', userId);

    // Cast sender and role to proper types and handle sub_query_responses
    return {
      ...data,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: data.role as 'user' | 'assistant' | 'error',
      sub_query_responses: Array.isArray(data.sub_query_responses) ? data.sub_query_responses : []
    };
  } catch (error) {
    console.error('Exception creating chat message:', error);
    return null;
  }
};

export const getChatMessages = async (threadId: string, userId: string): Promise<ChatMessage[]> => {
  try {
    // First verify the thread belongs to the user
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .single();

    if (threadError || !thread) {
      console.error('Thread not found or access denied:', threadError);
      return [];
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }

    // Cast sender and role to proper types and handle sub_query_responses
    return (data || []).map(msg => ({
      ...msg,
      sender: msg.sender as 'user' | 'assistant' | 'error',
      role: msg.role as 'user' | 'assistant' | 'error',
      sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
    }));
  } catch (error) {
    console.error('Exception fetching chat messages:', error);
    return [];
  }
};

export const updateChatMessage = async (
  messageId: string, 
  updates: Partial<ChatMessage>,
  userId: string
): Promise<ChatMessage | null> => {
  try {
    // First verify the message belongs to a thread owned by the user
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message || message.chat_threads.user_id !== userId) {
      console.error('Message not found or access denied:', messageError);
      return null;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating chat message:', error);
      return null;
    }

    // Cast sender and role to proper types and handle sub_query_responses
    return {
      ...data,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: data.role as 'user' | 'assistant' | 'error',
      sub_query_responses: Array.isArray(data.sub_query_responses) ? data.sub_query_responses : []
    };
  } catch (error) {
    console.error('Exception updating chat message:', error);
    return null;
  }
};

export const deleteChatMessage = async (messageId: string, userId: string): Promise<boolean> => {
  try {
    // First verify the message belongs to a thread owned by the user
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        chat_threads!inner(user_id)
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message || message.chat_threads.user_id !== userId) {
      console.error('Message not found or access denied:', messageError);
      return false;
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting chat message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception deleting chat message:', error);
    return false;
  }
};

// Legacy function aliases for backward compatibility
export const getThreadMessages = getChatMessages;

// Updated saveMessage function with correct signature
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant', 
  userId?: string,
  references?: any[] | null,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[]
) => {
  if (!userId) {
    console.error('User ID is required for saveMessage');
    return null;
  }

  // Process content for assistant messages to handle JSON responses
  let processedContent = content;
  if (sender === 'assistant') {
    // Sanitize content to avoid leaking status messages or raw JSON
    processedContent = getSanitizedFinalContent(content);
    const parsed = parseMessageContent(content);
    
    // Update references and analysis from parsed content if available
    if (parsed.references && !references) {
      references = parsed.references;
    }
    if (parsed.hasNumericResult !== undefined && hasNumericResult === undefined) {
      hasNumericResult = parsed.hasNumericResult;
    }
  }

  const additionalData: Partial<ChatMessage> = {};
  if (references) additionalData.reference_entries = references;
  if (hasNumericResult !== undefined) additionalData.has_numeric_result = hasNumericResult;
  if (isInteractive) additionalData.isInteractive = isInteractive;
  if (interactiveOptions) additionalData.interactiveOptions = interactiveOptions;

  return createChatMessage(threadId, processedContent, sender, userId, additionalData);
};

// Thread management functions
export const createThread = async (userId: string, title: string = "New Conversation") => {
  const { createChatThread } = await import('./threadService');
  const thread = await createChatThread(userId, title);
  return thread?.id || null;
};

export const getUserChatThreads = async (userId: string) => {
  const { getChatThreads } = await import('./threadService');
  return getChatThreads(userId);
};

export const updateThreadTitle = async (threadId: string, title: string, userId?: string) => {
  if (!userId) {
    console.error('User ID is required for updateThreadTitle');
    return false;
  }
  const { updateChatThread } = await import('./threadService');
  const result = await updateChatThread(threadId, { title }, userId);
  return !!result;
};

// Re-export message editing functions for convenience
export { editMessageWithDownstreamDeletion, canEditMessage, getDownstreamMessages } from './messageEditingService';
