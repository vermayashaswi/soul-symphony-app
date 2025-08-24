import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a title for a chat thread using GPT based on the existing messages
 */
export const generateThreadTitle = async (threadId: string, userId: string | undefined): Promise<string | null> => {
  if (!threadId || !userId) {
    console.log('[generateThreadTitle] Missing required parameters:', { threadId, userId });
    return null;
  }
  
  try {
    console.log(`[generateThreadTitle] Starting title generation for thread ${threadId}`);
    
    // Fetch the first few messages from the thread
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(3);
    
    if (error) {
      console.error("[generateThreadTitle] Error fetching messages for title generation:", {
        threadId,
        error
      });
      return null;
    }
    
    console.log(`[generateThreadTitle] Fetched ${messages?.length || 0} messages for thread ${threadId}`);
    
    if (!messages || messages.length === 0) {
      console.log(`[generateThreadTitle] No messages found for thread ${threadId}, using default title`);
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
 * Updates the processing status of a chat thread (client-side only)
 * Note: processing_status column was removed from database
 */
export const updateThreadProcessingStatus = async (
  threadId: string, 
  status: 'idle' | 'processing' | 'failed'
): Promise<boolean> => {
  try {
    // This function now only updates the updated_at timestamp
    // Processing status is managed client-side only
    const { error } = await supabase
      .from('chat_threads')
      .update({ 
        updated_at: new Date().toISOString() 
      })
      .eq('id', threadId);
      
    if (error) {
      console.error("Error updating thread timestamp:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in updateThreadProcessingStatus:", error);
    return false;
  }
};

/**
 * Legacy function - no longer creates processing messages
 * Returns null to maintain compatibility
 */
export const createProcessingMessage = async (
  threadId: string,
  initialContent: string = ""
): Promise<string | null> => {
  console.log("createProcessingMessage called but disabled - using pure streaming");
  return null;
};

/**
 * Legacy function - no longer updates processing messages
 * Returns true to maintain compatibility
 */
export const updateProcessingMessage = async (
  messageId: string,
  finalContent: string | null,
  references?: any[],
  analysis?: any,
  hasNumericResult?: boolean
): Promise<boolean> => {
  console.log("updateProcessingMessage called but disabled - using pure streaming");
  return true;
};
