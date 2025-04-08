
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

// Types
export type ChatThread = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
  reference_entries?: any[];
  analysis_data?: any;
  has_numeric_result?: boolean;
};

// Function to get all chat threads for a user
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

// Function to get messages for a specific thread
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
    
    // Fixed: Ensure proper mapping of database fields to ChatMessage type
    return (data || []).map(msg => {
      const typedMessage: ChatMessage = {
        id: msg.id,
        thread_id: msg.thread_id,
        content: msg.content,
        created_at: msg.created_at,
        sender: msg.sender === 'user' ? 'user' : 'assistant',
        reference_entries: msg.reference_entries ? 
          Array.isArray(msg.reference_entries) ? 
            msg.reference_entries : 
            [] : 
          undefined,
        has_numeric_result: msg.has_numeric_result || false
      };
      
      // Only add analysis_data if it exists in the database response
      if (msg.reference_entries && typeof msg.reference_entries === 'object') {
        const refObj = msg.reference_entries as Record<string, any>;
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

// Function to save a new message and record it in user_queries if it's from a user
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant',
  references?: any[],
  analysisData?: any,
  hasNumericResult?: boolean
): Promise<ChatMessage | null> => {
  try {
    // Validate sender type - ensure it's exactly 'user' or 'assistant'
    if (sender !== 'user' && sender !== 'assistant') {
      console.error("Invalid sender type:", sender);
      throw new Error("Invalid sender type. Must be 'user' or 'assistant'");
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content,
        sender,
        reference_entries: references || null,
        has_numeric_result: hasNumericResult || false
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error saving message:", error);
      throw error;
    }
    
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
    
    if (sender === 'user') {
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('user_id')
        .eq('id', threadId)
        .single();
        
      if (!threadError && threadData) {
        try {
          await supabase.functions.invoke('ensure-chat-persistence', {
            body: {
              userId: threadData.user_id,
              messageId: data.id,
              threadId: threadId,
              queryText: content
            }
          });
        } catch (queryError) {
          console.error("Error logging user query:", queryError);
        }
      }
    }
    
    const typedMessage: ChatMessage = {
      id: data.id,
      thread_id: data.thread_id,
      content: data.content,
      created_at: data.created_at,
      sender: data.sender === 'user' ? 'user' : 'assistant',
      reference_entries: data.reference_entries ? 
        Array.isArray(data.reference_entries) ? 
          data.reference_entries : 
          [] : 
        undefined,
      has_numeric_result: data.has_numeric_result || false
    };
    
    if (analysisData) {
      typedMessage.analysis_data = analysisData;
    }
    
    return typedMessage;
  } catch (error) {
    console.error("Failed to save message:", error);
    return null;
  }
};

// Function to create a new chat thread
export const createChatThread = async (userId: string, title: string = "New Conversation"): Promise<string | null> => {
  try {
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
    
    return data?.id || null;
  } catch (error) {
    console.error("Failed to create chat thread:", error);
    return null;
  }
};

// Function to update a thread title
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

// Hook to handle database errors and show toast notifications
export const useChatPersistence = () => {
  const { toast } = useToast();
  
  const handleError = (message: string) => {
    toast({
      title: "Connection Error",
      description: message,
      variant: "destructive",
    });
  };
  
  return {
    getUserChatThreads: async (userId: string) => {
      try {
        return await getUserChatThreads(userId);
      } catch (error) {
        handleError("Failed to retrieve your chat conversations.");
        return [];
      }
    },
    
    getThreadMessages: async (threadId: string) => {
      try {
        return await getThreadMessages(threadId);
      } catch (error) {
        handleError("Failed to load conversation messages.");
        return [];
      }
    },
    
    saveMessage: async (
      threadId: string, 
      content: string, 
      sender: 'user' | 'assistant',
      references?: any[],
      analysisData?: any,
      hasNumericResult?: boolean
    ) => {
      try {
        return await saveMessage(threadId, content, sender, references, analysisData, hasNumericResult);
      } catch (error) {
        handleError("Failed to save your message. Please try again.");
        return null;
      }
    },
    
    createChatThread: async (userId: string, title: string = "New Conversation") => {
      try {
        return await createChatThread(userId, title);
      } catch (error) {
        handleError("Failed to create a new conversation. Please try again.");
        return null;
      }
    },
    
    updateThreadTitle: async (threadId: string, newTitle: string) => {
      try {
        return await updateThreadTitle(threadId, newTitle);
      } catch (error) {
        handleError("Failed to update conversation title.");
        return false;
      }
    }
  };
};
