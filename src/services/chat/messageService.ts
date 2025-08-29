
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
    console.log('[createChatMessage] Starting message creation:', {
      threadId,
      sender,
      userId,
      contentLength: content.length,
      hasAdditionalData: !!additionalData
    });

    // First verify the thread belongs to the user with detailed logging
    console.log('[createChatMessage] Verifying thread ownership...');
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('id, user_id')
      .eq('id', threadId)
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle to handle non-existent threads gracefully

    if (threadError) {
      console.error('[createChatMessage] Database error during thread verification:', {
        threadId,
        userId,
        error: threadError,
        errorCode: threadError.code,
        errorMessage: threadError.message,
        errorDetails: threadError.details
      });
      return null;
    }

    if (!thread) {
      console.error('[createChatMessage] Thread verification failed - thread not found or access denied:', {
        threadId,
        userId,
        message: 'Either thread does not exist or user does not have access to it'
      });
      return null;
    }

    console.log('[createChatMessage] Thread verification successful:', {
      threadId: thread.id,
      threadUserId: thread.user_id,
      requestUserId: userId
    });

    console.log('[createChatMessage] Thread verified, inserting message');

    // Prepare message data with comprehensive logging and validation
    const messageData = {
      thread_id: threadId,
      content: content.trim(), // Ensure content is trimmed
      sender,
      role: sender,
      created_at: new Date().toISOString(),
      ...additionalData
    };

    // Validate required fields before insertion
    if (!messageData.content) {
      console.error('[createChatMessage] Message content is empty after trimming');
      return null;
    }

    console.log('[createChatMessage] Message data prepared:', {
      thread_id: messageData.thread_id,
      sender: messageData.sender,
      role: messageData.role,
      content_preview: `${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      content_length: content.length,
      has_additional_data: Object.keys(additionalData || {}).length > 0
    });

    // Insert message with enhanced error handling
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('[createChatMessage] Database insert failed:', {
        error_code: error.code,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        thread_id: threadId,
        user_id: userId,
        sender: messageData.sender,
        rls_context: 'Check if RLS policies are blocking this insert'
      });
      
      // Check if this is an RLS policy violation
      if (error.message?.includes('row-level security') || error.code === 'PGRST116') {
        console.error('[createChatMessage] RLS POLICY VIOLATION DETECTED:', {
          threadId,
          userId,
          error_details: error,
          suggestion: 'Verify that auth.uid() matches the user_id being passed'
        });
      }
      
      return null;
    }

    console.log('[createChatMessage] Message inserted successfully:', {
      messageId: data.id,
      threadId: data.thread_id
    });

    // Update thread's updated_at timestamp
    const { error: updateError } = await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('user_id', userId);

    if (updateError) {
      console.warn('[createChatMessage] Failed to update thread timestamp:', updateError);
    }

    // Cast sender and role to proper types and handle sub_query_responses
    const finalMessage = {
      ...data,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: data.role as 'user' | 'assistant' | 'error',
      sub_query_responses: Array.isArray(data.sub_query_responses) ? data.sub_query_responses : []
    };

    console.log('[createChatMessage] Message creation completed successfully:', {
      messageId: finalMessage.id,
      threadId: finalMessage.thread_id,
      sender: finalMessage.sender
    });

    return finalMessage;
  } catch (error) {
    console.error('[createChatMessage] Exception occurred:', {
      error,
      threadId,
      userId,
      sender,
      stack: error instanceof Error ? error.stack : 'No stack available'
    });
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

// Export classification helper
export { updateUserMessageClassification } from '@/utils/chat/classificationHelpers';

// Updated saveMessage function with correct signature and idempotency support
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant', 
  userId?: string,
  references?: any[] | null,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[],
  idempotencyKey?: string,
  analysisData?: any
) => {
  console.log('[saveMessage] Starting message save:', {
    threadId,
    sender,
    userId,
    contentLength: content.length,
    hasIdempotencyKey: !!idempotencyKey
  });

  if (!userId) {
    console.error('[saveMessage] User ID is required for saveMessage');
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
  if (idempotencyKey) additionalData.idempotency_key = idempotencyKey;
  if (analysisData) additionalData.analysis_data = analysisData;

  console.log('[saveMessage] Processed data, calling createChatMessage');
  const result = await createChatMessage(threadId, processedContent, sender, userId, additionalData);
  
  if (result) {
    console.log('[saveMessage] Message saved successfully:', result.id);
  } else {
    console.error('[saveMessage] Failed to save message');
  }
  
  return result;
};

// Update message with classification data
export const updateChatMessageAnalysis = async (
  messageId: string,
  analysisData: any,
  userId: string
): Promise<boolean> => {
  try {
    console.log('[updateChatMessage] Updating message with analysis data:', {
      messageId,
      hasAnalysisData: !!analysisData,
      userId
    });

    const { error } = await supabase
      .from('chat_messages')
      .update({ analysis_data: analysisData })
      .eq('id', messageId)
      .eq('sender', 'user'); // Only update user messages for classification

    if (error) {
      console.error('[updateChatMessage] Failed to update message:', error);
      return false;
    }

    console.log('[updateChatMessage] Successfully updated message with analysis data');
    return true;
  } catch (error) {
    console.error('[updateChatMessage] Exception updating message:', error);
    return false;
  }
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
