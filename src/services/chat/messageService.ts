
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "@/types/chat";
import { InteractiveOption } from "@/types/chat";

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
      role: msg.role as 'user' | 'assistant' | 'error'
    }));
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
  interactiveOptions?: InteractiveOption[]
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
      role: data.role as 'user' | 'assistant' | 'error'
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
