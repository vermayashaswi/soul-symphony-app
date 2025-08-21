// Shared message persistence utility for edge functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export interface MessageData {
  thread_id: string;
  sender: 'user' | 'assistant' | 'error';
  role: 'user' | 'assistant' | 'error';
  content: string;
  created_at?: string;
  idempotency_key?: string;
  reference_entries?: any[];
  analysis_data?: any;
  has_numeric_result?: boolean;
  sub_query_responses?: any[];
  request_correlation_id?: string;
}

export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant' | 'error', 
  userId?: string, 
  additionalData: Partial<MessageData> = {}, 
  req?: Request
) => {
  try {
    // Validate required parameters
    if (!threadId || !content || !userId) {
      console.error('[saveMessage] Missing required parameters:', { 
        threadId: !!threadId, 
        content: !!content, 
        userId: !!userId 
      });
      return null;
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req?.headers.get('Authorization') || '' },
        },
      }
    );

    // Validate the message data schema before attempting to save
    const messageData: MessageData = {
      thread_id: threadId,
      sender,
      role: sender,
      content,
      created_at: new Date().toISOString(),
      ...additionalData
    };

    // Remove any fields that don't exist in the database schema
    delete (messageData as any).is_interactive;
    delete (messageData as any).isInteractive;
    
    console.log('[saveMessage] Attempting to save message with data:', {
      thread_id: messageData.thread_id,
      sender: messageData.sender,
      role: messageData.role,
      content_length: messageData.content.length,
      has_analysis_data: !!messageData.analysis_data,
      has_reference_entries: !!messageData.reference_entries,
      idempotency_key: messageData.idempotency_key
    });

    const { data, error } = await supabaseClient
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('[saveMessage] Database error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return null;
    }

    console.log(`[saveMessage] Successfully saved ${sender} message:`, data.id);
    return data;
  } catch (error) {
    console.error('[saveMessage] Exception:', error);
    return null;
  }
};

// Function to update an existing message
export const updateMessage = async (
  messageId: string,
  updates: Partial<MessageData>,
  req?: Request
) => {
  try {
    if (!messageId) {
      console.error('[updateMessage] Missing messageId');
      return null;
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req?.headers.get('Authorization') || '' },
        },
      }
    );

    // Remove any fields that don't exist in the database schema
    delete (updates as any).is_interactive;
    delete (updates as any).isInteractive;

    console.log('[updateMessage] Attempting to update message:', {
      messageId,
      updates: Object.keys(updates)
    });

    const { data, error } = await supabaseClient
      .from('chat_messages')
      .update(updates)
      .eq('id', messageId)
      .select('id')
      .single();

    if (error) {
      console.error('[updateMessage] Database error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return null;
    }

    console.log(`[updateMessage] Successfully updated message:`, data.id);
    return data;
  } catch (error) {
    console.error('[updateMessage] Exception:', error);
    return null;
  }
};