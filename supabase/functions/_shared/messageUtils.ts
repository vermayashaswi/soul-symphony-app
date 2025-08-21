import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export interface MessageData {
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  role?: 'user' | 'assistant' | 'error';
  reference_entries?: any;
  analysis_data?: any;
  has_numeric_result?: boolean;
  is_processing?: boolean;
  idempotency_key?: string;
  request_correlation_id?: string;
  sub_query1?: string;
  sub_query2?: string;
  sub_query3?: string;
  sub_query_responses?: any;
}

export interface MessageSaveResult {
  success: boolean;
  messageId?: string;
  error?: string;
  wasUpdated?: boolean;
}

/**
 * Enhanced message saving utility with error handling, retries, and idempotency
 */
export async function saveMessage(
  supabaseClient: ReturnType<typeof createClient>,
  messageData: MessageData,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    requireIdempotency?: boolean;
  } = {}
): Promise<MessageSaveResult> {
  const { maxRetries = 3, baseDelay = 1000, requireIdempotency = false } = options;
  
  console.log(`[messageUtils] Saving message: ${messageData.sender} to thread ${messageData.thread_id}`);
  console.log(`[messageUtils] Content length: ${messageData.content.length}, has idempotency: ${!!messageData.idempotency_key}`);

  // Generate idempotency key if required but not provided
  if (requireIdempotency && !messageData.idempotency_key) {
    const timestamp = Date.now();
    const contentHash = await generateContentHash(messageData.content + messageData.thread_id);
    messageData.idempotency_key = `${timestamp}_${contentHash}`;
    console.log(`[messageUtils] Generated idempotency key: ${messageData.idempotency_key}`);
  }

  // Ensure role matches sender
  if (!messageData.role) {
    messageData.role = messageData.sender;
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[messageUtils] Save attempt ${attempt}/${maxRetries}`);

    try {
      // Check if message with idempotency key already exists
      if (messageData.idempotency_key) {
        const { data: existing, error: checkError } = await supabaseClient
          .from('chat_messages')
          .select('id, content')
          .eq('thread_id', messageData.thread_id)
          .eq('idempotency_key', messageData.idempotency_key)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // Not "not found" error
          throw new Error(`Idempotency check failed: ${checkError.message}`);
        }

        if (existing) {
          console.log(`[messageUtils] Message with idempotency key already exists: ${existing.id}`);
          return {
            success: true,
            messageId: existing.id,
            wasUpdated: false
          };
        }
      }

      // Try to insert the message
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .insert(messageData)
        .select('id')
        .single();

      if (error) {
        // Handle unique constraint violation for idempotency
        if (error.code === '23505' && error.message.includes('idempotency_key')) {
          console.log(`[messageUtils] Idempotency conflict on attempt ${attempt}, retrying...`);
          
          // Fetch the existing message
          const { data: existing } = await supabaseClient
            .from('chat_messages')
            .select('id')
            .eq('thread_id', messageData.thread_id)
            .eq('idempotency_key', messageData.idempotency_key)
            .single();

          if (existing) {
            return {
              success: true,
              messageId: existing.id,
              wasUpdated: false
            };
          }
        }
        
        throw error;
      }

      console.log(`[messageUtils] Message saved successfully: ${data.id}`);
      
      // Update thread timestamp
      try {
        await supabaseClient
          .from('chat_threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', messageData.thread_id);
      } catch (updateError) {
        console.warn(`[messageUtils] Failed to update thread timestamp:`, updateError);
      }

      return {
        success: true,
        messageId: data.id,
        wasUpdated: false
      };

    } catch (error) {
      lastError = error;
      console.error(`[messageUtils] Save attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[messageUtils] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[messageUtils] All save attempts failed. Last error:`, lastError);
  return {
    success: false,
    error: lastError?.message || 'Unknown error occurred'
  };
}

/**
 * Enhanced message updating utility with error handling and retries
 */
export async function updateMessage(
  supabaseClient: ReturnType<typeof createClient>,
  messageId: string,
  updates: Partial<MessageData>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
  } = {}
): Promise<MessageSaveResult> {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  
  console.log(`[messageUtils] Updating message: ${messageId}`);
  console.log(`[messageUtils] Updates:`, Object.keys(updates));

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[messageUtils] Update attempt ${attempt}/${maxRetries}`);

    try {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .update(updates)
        .eq('id', messageId)
        .select('id, thread_id')
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Message not found or update failed');
      }

      console.log(`[messageUtils] Message updated successfully: ${data.id}`);
      
      // Update thread timestamp
      try {
        await supabaseClient
          .from('chat_threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', data.thread_id);
      } catch (updateError) {
        console.warn(`[messageUtils] Failed to update thread timestamp:`, updateError);
      }

      return {
        success: true,
        messageId: data.id,
        wasUpdated: true
      };

    } catch (error) {
      lastError = error;
      console.error(`[messageUtils] Update attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[messageUtils] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[messageUtils] All update attempts failed. Last error:`, lastError);
  return {
    success: false,
    error: lastError?.message || 'Unknown error occurred'
  };
}

/**
 * Safe upsert operation for messages with idempotency support
 */
export async function upsertMessage(
  supabaseClient: ReturnType<typeof createClient>,
  messageData: MessageData,
  options: {
    maxRetries?: number;
    baseDelay?: number;
  } = {}
): Promise<MessageSaveResult> {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  
  console.log(`[messageUtils] Upserting message with idempotency key: ${messageData.idempotency_key}`);

  if (!messageData.idempotency_key) {
    console.error(`[messageUtils] Upsert requires idempotency key`);
    return {
      success: false,
      error: 'Idempotency key required for upsert operation'
    };
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[messageUtils] Upsert attempt ${attempt}/${maxRetries}`);

    try {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .upsert(messageData, {
          onConflict: 'thread_id,idempotency_key'
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      console.log(`[messageUtils] Message upserted successfully: ${data.id}`);
      
      // Update thread timestamp
      try {
        await supabaseClient
          .from('chat_threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', messageData.thread_id);
      } catch (updateError) {
        console.warn(`[messageUtils] Failed to update thread timestamp:`, updateError);
      }

      return {
        success: true,
        messageId: data.id,
        wasUpdated: true
      };

    } catch (error) {
      lastError = error;
      console.error(`[messageUtils] Upsert attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[messageUtils] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[messageUtils] All upsert attempts failed. Last error:`, lastError);
  return {
    success: false,
    error: lastError?.message || 'Unknown error occurred'
  };
}

/**
 * Generate a content hash for idempotency
 */
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Generate an idempotency key based on thread, content, and timestamp
 */
export async function generateIdempotencyKey(
  threadId: string,
  content: string,
  additionalData?: string
): Promise<string> {
  const timestamp = Date.now();
  const sourceData = `${threadId}:${content}:${timestamp}${additionalData ? ':' + additionalData : ''}`;
  const hash = await generateContentHash(sourceData);
  return `${timestamp}_${hash}`;
}

/**
 * Verify message persistence health for a thread
 */
export async function verifyMessagePersistence(
  supabaseClient: ReturnType<typeof createClient>,
  threadId: string,
  expectedMessageCount?: number
): Promise<{
  success: boolean;
  actualCount: number;
  expectedCount?: number;
  issues: string[];
}> {
  console.log(`[messageUtils] Verifying message persistence for thread: ${threadId}`);
  
  try {
    const { data: messages, error } = await supabaseClient
      .from('chat_messages')
      .select('id, sender, content, created_at, idempotency_key')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      return {
        success: false,
        actualCount: 0,
        issues: [`Database query failed: ${error.message}`]
      };
    }

    const issues: string[] = [];
    const actualCount = messages?.length || 0;

    // Check expected count if provided
    if (expectedMessageCount !== undefined && actualCount !== expectedMessageCount) {
      issues.push(`Expected ${expectedMessageCount} messages, found ${actualCount}`);
    }

    // Check for messages without idempotency keys (recent messages should have them)
    const recentMessagesWithoutKeys = messages
      ?.filter(m => !m.idempotency_key && new Date(m.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .length || 0;

    if (recentMessagesWithoutKeys > 0) {
      issues.push(`${recentMessagesWithoutKeys} recent messages missing idempotency keys`);
    }

    console.log(`[messageUtils] Persistence verification complete: ${actualCount} messages, ${issues.length} issues`);

    return {
      success: issues.length === 0,
      actualCount,
      expectedCount: expectedMessageCount,
      issues
    };

  } catch (error) {
    console.error(`[messageUtils] Persistence verification failed:`, error);
    return {
      success: false,
      actualCount: 0,
      issues: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}