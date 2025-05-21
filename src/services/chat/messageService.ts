
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "@/types/chat";
import { Json } from "@/integrations/supabase/types";

/**
 * Gets the user's timezone offset in minutes
 */
export const getUserTimezoneOffset = (): number => {
  return new Date().getTimezoneOffset();
};

/**
 * Gets all messages for a thread, ordered by creation time
 */
export const getThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    // Process data to ensure types are correct
    return (data || []).map((msg) => ({
      ...msg,
      sender: msg.sender as 'user' | 'assistant' | 'error',
      role: msg.role as 'user' | 'assistant' | 'error',
      // Add aliases for backward compatibility
      references: Array.isArray(msg.reference_entries) ? msg.reference_entries : [],
      analysis: msg.analysis_data,
      hasNumericResult: msg.has_numeric_result,
      // Ensure sub_query_responses is always an array
      sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
    } as ChatMessage));
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    return [];
  }
};

/**
 * Saves a message to the database
 */
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant',
  references?: any[],
  analysis?: any,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[]
): Promise<ChatMessage | null> => {
  try {
    // Create the base message object
    const messageData = {
      thread_id: threadId,
      content,
      sender,
      role: sender, // Role and sender should match for now
      reference_entries: references || null,
      analysis_data: analysis || null,
      has_numeric_result: hasNumericResult || false,
      // Ensure sub_query_responses is always an array if present
      sub_query_responses: [] // Default empty array
    };
    
    // Insert the message
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();
      
    if (error) throw error;
    
    if (!data) {
      throw new Error("No data returned from message insert");
    }
    
    // Convert the database response to our ChatMessage type
    const chatMessage: ChatMessage = {
      ...data,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: data.role as 'user' | 'assistant' | 'error',
      // Add aliases for backward compatibility
      references: Array.isArray(data.reference_entries) ? data.reference_entries : [],
      analysis: data.analysis_data,
      hasNumericResult: data.has_numeric_result,
      // Ensure sub_query_responses is always an array
      sub_query_responses: Array.isArray(data.sub_query_responses) ? data.sub_query_responses : []
    };
    
    // If this is an interactive message with options, add those properties
    if (isInteractive && interactiveOptions) {
      chatMessage.isInteractive = true;
      chatMessage.interactiveOptions = interactiveOptions;
    }
    
    // Update the thread's updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    return chatMessage;
  } catch (error) {
    console.error("Error saving message:", error);
    return null;
  }
};

/**
 * Creates a new thread
 */
export const createThread = async (
  userId: string,
  title: string = "New Conversation"
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) throw error;
    
    return data?.id || null;
  } catch (error) {
    console.error("Error creating thread:", error);
    return null;
  }
};

/**
 * Gets all threads for a user, ordered by update time
 */
export const getUserChatThreads = async (userId: string): Promise<any[] | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    
    return data || null;
  } catch (error) {
    console.error("Error getting user threads:", error);
    return null;
  }
};

/**
 * Updates the title of a thread
 */
export const updateThreadTitle = async (threadId: string, title: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error("Error updating thread title:", error);
    return false;
  }
};

/**
 * Process a message using the structured chat approach
 */
export const processWithStructuredPrompt = async (
  message: string,
  userId: string,
  entries: any[],
  threadId?: string
): Promise<any> => {
  try {
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/structured-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabase.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        userId,
        entries,
        threadId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error from structured-chat function: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error processing with structured prompt:", error);
    throw error;
  }
};
