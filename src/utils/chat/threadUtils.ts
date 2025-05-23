import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a title for a chat thread using GPT based on the existing messages
 */
export const generateThreadTitle = async (threadId: string, userId: string | undefined): Promise<string | null> => {
  if (!threadId || !userId) return null;
  
  try {
    console.log(`Generating title for thread ${threadId}`);
    
    // Fetch the first few messages from the thread
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(3);
    
    if (error) {
      console.error("Error fetching messages for title generation:", error);
      return null;
    }
    
    if (!messages || messages.length === 0) {
      return "New Conversation";
    }
    
    // Check if this thread already has a real title
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('title')
      .eq('id', threadId)
      .single();
      
    // Don't regenerate if it already has a non-default title
    if (thread && thread.title && thread.title !== "New Conversation") {
      console.log("Thread already has a title, skipping generation:", thread.title);
      return thread.title;
    }
    
    // Create a prompt for title generation
    const userMessages = messages
      .filter(msg => msg.sender === 'user')
      .map(msg => msg.content)
      .join("\n");
    
    if (!userMessages) {
      return "New Conversation";
    }
    
    // Use the "smart-chat" function to generate a title
    try {
      const response = await supabase.functions.invoke("smart-chat", {
        body: {
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that creates short, concise titles (maximum 5 words) for chat conversations. Based on the user's messages, create a title that captures the main topic or theme of the conversation."
            },
            {
              role: "user",
              content: `Create a short, concise title (maximum 5 words) for a conversation about: ${userMessages}`
            }
          ],
          userId: userId,
          generateTitleOnly: true
        }
      });
      
      if (response.error) {
        console.error("Error generating title:", response.error);
        return null;
      }
      
      // Extract and sanitize the title
      const generatedTitle = response.data?.title || 
                            response.data?.content || 
                            (typeof response.data === 'string' ? response.data : null);
      
      const sanitizedTitle = generatedTitle 
        ? generatedTitle.replace(/^["']|["']$/g, '').substring(0, 30) 
        : "New Conversation";
      
      console.log(`Generated title: ${sanitizedTitle}`);
      
      // Update the thread title in the database
      try {
        await supabase
          .from('chat_threads')
          .update({ title: sanitizedTitle })
          .eq('id', threadId);
      } catch (updateError) {
        console.error("Error updating thread title:", updateError);
      }
      
      return sanitizedTitle;
    } catch (error) {
      console.error("Error in title generation:", error);
      return "New Conversation";
    }
  } catch (error) {
    console.error("Error in generateThreadTitle:", error);
    return null;
  }
};

/**
 * Ensures a chat thread exists and belongs to the user
 */
export const ensureThreadExists = async (threadId: string, userId: string): Promise<{
  thread: any;
  messages: any[];
  restored: boolean;
}> => {
  try {
    const response = await supabase.functions.invoke("ensure-chat-persistence", {
      body: { threadId, userId }
    });
    
    if (response.error) {
      console.error("Error ensuring thread exists:", response.error);
      throw new Error(response.error.message);
    }
    
    return {
      thread: response.data.thread,
      messages: response.data.messages || [],
      restored: response.data.restored || false
    };
  } catch (error) {
    console.error("Failed to ensure thread exists:", error);
    throw error;
  }
};

/**
 * Updates the processing status of a chat thread
 */
export const updateThreadProcessingStatus = async (
  threadId: string, 
  status: 'idle' | 'processing' | 'failed'
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ 
        processing_status: status,
        updated_at: new Date().toISOString() 
      })
      .eq('id', threadId);
      
    if (error) {
      console.error("Error updating thread processing status:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in updateThreadProcessingStatus:", error);
    return false;
  }
};

/**
 * Creates a processing message placeholder
 */
export const createProcessingMessage = async (
  threadId: string,
  initialContent: string = "Processing your request..."
): Promise<string | null> => {
  try {
    // Create a placeholder message that shows we're processing
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender: 'assistant',
        role: 'assistant',
        content: initialContent,
        is_processing: true,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) {
      console.error("Error creating processing message:", error);
      return null;
    }
    
    return data?.id || null;
  } catch (error) {
    console.error("Error in createProcessingMessage:", error);
    return null;
  }
};

/**
 * Updates a processing message with final content or removes it
 */
export const updateProcessingMessage = async (
  messageId: string,
  finalContent: string | null,
  references?: any[],
  analysis?: any,
  hasNumericResult?: boolean
): Promise<boolean> => {
  try {
    if (finalContent === null) {
      // Delete the processing message if we don't have final content
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);
        
      if (error) {
        console.error("Error deleting processing message:", error);
        return false;
      }
    } else {
      // Update the processing message with the final content
      const { error } = await supabase
        .from('chat_messages')
        .update({
          content: finalContent,
          is_processing: false,
          reference_entries: references || null,
          analysis_data: analysis || null,
          has_numeric_result: hasNumericResult || false
        })
        .eq('id', messageId);
        
      if (error) {
        console.error("Error updating processing message:", error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error in updateProcessingMessage:", error);
    return false;
  }
};
