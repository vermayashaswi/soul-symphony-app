
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./types";
import { Json } from "@/integrations/supabase/types";

/**
 * Get all messages for a specific thread
 */
export const getThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  try {
    console.log(`Fetching messages for thread ${threadId}`);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching chat messages:", error);
      throw error;
    }
    
    // Map the DB fields to the ChatMessage type
    const messages: ChatMessage[] = data.map(msg => ({
      id: msg.id,
      thread_id: msg.thread_id,
      content: msg.content,
      sender: msg.sender as 'user' | 'assistant',
      created_at: msg.created_at,
      reference_entries: msg.reference_entries as any[] | undefined,
      analysis_data: msg.analysis_data as any,
      has_numeric_result: msg.has_numeric_result,
      role: msg.sender as 'user' | 'assistant'
    }));
    
    console.log(`Found ${messages.length} messages for thread ${threadId}`);
    return messages;
  } catch (error) {
    console.error("Failed to get chat messages:", error);
    return [];
  }
};

/**
 * Save a message to a thread
 */
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant',
  references?: any[] | null,
  analysis?: any | null,
  hasNumericResult?: boolean
): Promise<ChatMessage | null> => {
  try {
    console.log(`Saving message to thread ${threadId}`);
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content,
        sender,
        reference_entries: references || null,
        analysis_data: analysis || null,
        has_numeric_result: hasNumericResult || false
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error saving message:", error);
      throw error;
    }
    
    // Map the DB response to the ChatMessage type
    const message: ChatMessage = {
      id: data.id,
      thread_id: data.thread_id,
      content: data.content,
      sender: data.sender as 'user' | 'assistant',
      created_at: data.created_at,
      reference_entries: data.reference_entries as any[] | undefined,
      analysis_data: data.analysis_data as any,
      has_numeric_result: data.has_numeric_result,
      role: data.sender as 'user' | 'assistant'
    };
    
    console.log(`Message saved with ID ${data.id}`);
    return message;
  } catch (error) {
    console.error("Failed to save message:", error);
    return null;
  }
};
