
import { supabase } from "@/integrations/supabase/client";
import { ChatThread } from "./types";

/**
 * Get all chat threads for a user
 */
export const getUserChatThreads = async (userId: string): Promise<ChatThread[]> => {
  try {
    console.log("Fetching chat threads for user:", userId);
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching chat threads:", error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} chat threads`);
    return data || [];
  } catch (error) {
    console.error("Failed to get chat threads:", error);
    return [];
  }
};

/**
 * Create a new chat thread
 */
export const createChatThread = async (userId: string, title: string = "New Conversation"): Promise<string | null> => {
  try {
    console.log(`Creating new chat thread for user ${userId} with title "${title}"`);
    
    if (!userId) {
      console.error("User ID is required");
      throw new Error("User ID is required");
    }
    
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error creating chat thread:", error);
      throw error;
    }
    
    console.log("Created chat thread:", data.id);
    return data?.id || null;
  } catch (error) {
    console.error("Failed to create chat thread:", error);
    return null;
  }
};

/**
 * Update a thread title
 */
export const updateThreadTitle = async (threadId: string, newTitle: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ 
        title: newTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);
      
    if (error) {
      console.error("Error updating thread title:", error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Failed to update thread title:", error);
    return false;
  }
};
