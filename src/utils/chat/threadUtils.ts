
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
    
    // Create a prompt for title generation
    const userMessages = messages
      .filter(msg => msg.sender === 'user')
      .map(msg => msg.content)
      .join("\n");
    
    if (!userMessages) {
      return "New Conversation";
    }
    
    // Use the "smart-chat" function to generate a title
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
    const { error: updateError } = await supabase
      .from('chat_threads')
      .update({ title: sanitizedTitle })
      .eq('id', threadId);
    
    if (updateError) {
      console.error("Error updating thread title:", updateError);
    }
    
    return sanitizedTitle;
  } catch (error) {
    console.error("Error in title generation:", error);
    return null;
  }
};
