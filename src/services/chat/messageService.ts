
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

    // Check authentication status
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser) {
      console.error('[createChatMessage] Authentication error:', authError);
      return null;
    }

    if (currentUser.id !== userId) {
      console.error('[createChatMessage] User ID mismatch:', { provided: userId, authenticated: currentUser.id });
      return null;
    }

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

// Helper function to generate idempotency key
const generateIdempotencyKey = (content: string, sender: 'user' | 'assistant', threadId: string, userId?: string) => {
  const timestamp = Date.now();
  const contentHash = content.slice(0, 50).toLowerCase().replace(/\s+/g, '');
  return `${sender}_${threadId}_${userId || 'anon'}_${contentHash}_${timestamp}`;
};

// Updated saveMessage function with comprehensive error handling and retry logic
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
  analysisData?: any,
  correlationId?: string
) => {
  const requestId = correlationId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('[saveMessage] Starting message save:', {
    threadId,
    sender,
    userId,
    contentLength: content.length,
    hasIdempotencyKey: !!idempotencyKey,
    requestId
  });

  if (!userId) {
    console.error('[saveMessage] User ID is required for saveMessage');
    throw new Error('Authentication required - user ID missing');
  }

  // Enhanced profile validation with retry mechanism
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      console.log(`[saveMessage] Attempt ${retryCount + 1}/${maxRetries + 1} - Validating user authentication and profile...`);
      
      // Critical: Ensure user profile exists BEFORE attempting message save
      const { ensureUserProfileExists, getChatUserProfile } = await import('./profileService');
      
      // Step 1: Ensure profile exists
      const profileExists = await ensureUserProfileExists(userId);
      if (!profileExists) {
        throw new Error('Failed to create or validate user profile');
      }
      
      // Step 2: Verify authentication state
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser || currentUser.id !== userId) {
        console.error('[saveMessage] Authentication verification failed:', {
          authError,
          currentUserId: currentUser?.id,
          requestedUserId: userId
        });
        throw new Error('Authentication state invalid');
      }
      
      // Step 3: Get and validate user profile data
      const userProfile = await getChatUserProfile(userId);
      console.log('[saveMessage] Profile validation successful:', {
        userId: userProfile.id,
        entryCount: userProfile.journalEntryCount,
        hasTimezone: !!userProfile.timezone,
        requestId
      });
      
      break; // Success, exit retry loop
      
    } catch (profileError) {
      retryCount++;
      console.error(`[saveMessage] Profile validation attempt ${retryCount} failed:`, profileError);
      
      if (retryCount > maxRetries) {
        console.error('[saveMessage] All profile validation attempts failed');
        throw new Error(`Profile validation failed after ${maxRetries + 1} attempts: ${profileError.message}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  // Generate idempotency key if not provided
  const finalIdempotencyKey = idempotencyKey || generateIdempotencyKey(content, sender, threadId, userId);

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
  if (finalIdempotencyKey) additionalData.idempotency_key = finalIdempotencyKey;
  if (analysisData) additionalData.analysis_data = analysisData;
  if (correlationId) (additionalData as any).request_correlation_id = correlationId;

  console.log('[saveMessage] Processed data, calling createChatMessage with enhanced error handling');
  
  // Enhanced message saving with retry mechanism
  let saveRetryCount = 0;
  const maxSaveRetries = 2;
  let result = null;
  
  while (saveRetryCount <= maxSaveRetries) {
    try {
      console.log(`[saveMessage] Message save attempt ${saveRetryCount + 1}/${maxSaveRetries + 1}, requestId: ${requestId}`);
      
      result = await createChatMessage(threadId, processedContent, sender, userId, additionalData);
      
      if (result) {
        console.log('[saveMessage] Message saved successfully:', {
          id: result.id,
          idempotency_key: result.idempotency_key,
          request_correlation_id: requestId,
          attempt: saveRetryCount + 1
        });
        break; // Success, exit retry loop
      } else {
        throw new Error('createChatMessage returned null');
      }
      
    } catch (saveError) {
      saveRetryCount++;
      console.error(`[saveMessage] Save attempt ${saveRetryCount} failed:`, saveError);
      
      // Enhanced error analysis
      const errorMessage = saveError?.message || saveError?.toString() || 'Unknown error';
      
      // Don't retry for certain error types
      if (errorMessage.includes('row-level security') || 
          errorMessage.includes('authentication') ||
          errorMessage.includes('foreign key') ||
          saveRetryCount > maxSaveRetries) {
        
        // Final diagnostic information
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, entry_count, created_at')
            .eq('id', userId)
            .single();
          
          const { data: thread } = await supabase
            .from('chat_threads')
            .select('id, user_id, created_at')
            .eq('id', threadId)
            .eq('user_id', userId)
            .single();
          
          console.error('[saveMessage] Final diagnostic data:', {
            userId,
            threadId,
            requestId,
            profileExists: !!profile,
            entryCount: profile?.entry_count || 0,
            threadExists: !!thread,
            threadUserId: thread?.user_id,
            errorType: errorMessage.includes('row-level security') ? 'RLS_VIOLATION' : 
                      errorMessage.includes('authentication') ? 'AUTH_ERROR' : 'OTHER',
            attempts: saveRetryCount
          });
        } catch (diagnosticError) {
          console.error('[saveMessage] Diagnostic check failed:', diagnosticError);
        }
        
        throw new Error(`Message save failed after ${saveRetryCount} attempts: ${errorMessage}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500 * saveRetryCount));
    }
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
