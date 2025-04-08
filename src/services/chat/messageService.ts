
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./types";

/**
 * Get messages for a specific thread
 */
export const getThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  try {
    console.log("Fetching messages for thread:", threadId);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching chat messages:", error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} messages for thread ${threadId}`);
    
    return (data || []).map(msg => {
      const messageData: any = msg;
      
      const typedMessage: ChatMessage = {
        id: messageData.id,
        thread_id: messageData.thread_id,
        content: messageData.content,
        created_at: messageData.created_at,
        sender: messageData.sender === 'user' ? 'user' : 'assistant',
        role: messageData.sender === 'user' ? 'user' : 'assistant',
        reference_entries: messageData.reference_entries ? 
          Array.isArray(messageData.reference_entries) ? 
            messageData.reference_entries : 
            [] : 
          undefined,
        has_numeric_result: messageData.has_numeric_result || false
      };
      
      // Adding analysis_data if it exists in the response
      if (messageData.analysis_data) {
        typedMessage.analysis_data = messageData.analysis_data;
      } else if (messageData.reference_entries && typeof messageData.reference_entries === 'object') {
        const refObj = messageData.reference_entries as Record<string, any>;
        if (refObj.analysis_data) {
          typedMessage.analysis_data = refObj.analysis_data;
        }
      }
      
      return typedMessage;
    });
  } catch (error) {
    console.error("Failed to get thread messages:", error);
    return [];
  }
};

/**
 * Save a message
 */
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant',
  references?: any[],
  analysisData?: any,
  hasNumericResult?: boolean
): Promise<ChatMessage | null> => {
  try {
    // Input validation
    if (!threadId || typeof threadId !== 'string') {
      console.error("Invalid thread ID:", threadId);
      throw new Error("Invalid thread ID");
    }
    
    if (!content || typeof content !== 'string') {
      console.error("Invalid message content");
      throw new Error("Message content is required");
    }
    
    if (sender !== 'user' && sender !== 'assistant') {
      console.error("Invalid sender type:", sender);
      throw new Error("Invalid sender type. Must be 'user' or 'assistant'");
    }

    console.log(`Saving ${sender} message to thread ${threadId}:`, content.substring(0, 50) + "...");
    
    // First, verify the thread exists
    const { data: threadData, error: threadError } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('id', threadId)
      .single();
      
    if (threadError || !threadData) {
      console.error("Thread does not exist:", threadError);
      throw new Error(`Thread ${threadId} does not exist`);
    }
    
    // Define the message structure with explicit type to ensure compile-time type checking
    const messageData: {
      thread_id: string;
      content: string;
      sender: string;
      reference_entries: any[] | null;
      has_numeric_result: boolean;
      analysis_data?: any;
    } = {
      thread_id: threadId,
      content: content,
      sender: sender,
      reference_entries: references || null,
      has_numeric_result: hasNumericResult || false
    };
    
    // Only add analysis_data field if it was provided
    if (analysisData !== undefined) {
      messageData.analysis_data = analysisData;
    }
    
    console.log("Inserting message with data:", JSON.stringify(messageData, null, 2));
    
    // Insert the message into the database
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('*')
      .single();
      
    if (error) {
      console.error("Error saving message:", error);
      throw error;
    }
    
    if (!data) {
      console.error("No data returned after inserting message");
      throw new Error("Failed to save message: No data returned");
    }
    
    console.log("Message saved successfully:", data.id);
    
    // Update the thread's updated_at timestamp
    const { error: updateError } = await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    if (updateError) {
      console.error("Error updating thread timestamp:", updateError);
      // Continue anyway as this is not critical
    }
    
    // For user messages, log in user_queries table
    if (sender === 'user') {
      try {
        const { data: userData, error: userError } = await supabase
          .from('chat_threads')
          .select('user_id')
          .eq('id', threadId)
          .single();
          
        if (!userError && userData && userData.user_id) {
          await supabase.functions.invoke('ensure-chat-persistence', {
            body: {
              userId: userData.user_id,
              messageId: data.id,
              threadId: threadId,
              queryText: content
            }
          });
          console.log("User query logged successfully");
        } else {
          console.error("Could not find user_id for thread:", threadId);
        }
      } catch (queryError) {
        console.error("Error logging user query:", queryError);
        // Continue anyway as this is not critical
      }
    }
    
    // Format the message in the standard structure
    const typedMessage: ChatMessage = {
      id: data.id,
      thread_id: data.thread_id,
      content: data.content,
      created_at: data.created_at,
      sender: data.sender === 'user' ? 'user' : 'assistant',
      role: data.sender === 'user' ? 'user' : 'assistant',
      reference_entries: data.reference_entries ? 
        Array.isArray(data.reference_entries) ? 
          data.reference_entries : 
          [] : 
        undefined,
      has_numeric_result: data.has_numeric_result || false
    };
    
    // Only add analysis_data if it exists in the response
    if (analysisData) {
      typedMessage.analysis_data = analysisData;
    } else if (data.analysis_data) {
      typedMessage.analysis_data = data.analysis_data;
    }
    
    return typedMessage;
  } catch (error) {
    console.error("Failed to save message:", error);
    throw error; // Re-throw to ensure errors are properly caught upstream
  }
};
