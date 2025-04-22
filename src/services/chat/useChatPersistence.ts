import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, ChatThread, SubQueryResponse } from "./types";

/**
 * Custom hook to manage chat persistence with Supabase
 */
export function useChatPersistence(userId?: string | null) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load user's chat threads
  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setIsLoading(false);
      return;
    }
    
    const loadThreads = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
          
        if (error) {
          console.error("Error loading chat threads:", error);
          setError(error.message);
        } else {
          setThreads(data || []);
        }
      } catch (err: any) {
        console.error("Exception loading chat threads:", err);
        setError(err.message || 'An error occurred while loading conversations');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadThreads();
    
    // Set up real-time subscription for thread updates
    const subscription = supabase
      .channel(`threads_for_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadThreads();
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);
  
  // Function to create a new thread
  const createThread = async (title: string = "New Conversation"): Promise<ChatThread | null> => {
    try {
      if (!userId) {
        setError('You must be logged in to create a conversation');
        return null;
      }
      
      const { data, error } = await supabase
        .from('chat_threads')
        .insert({
          title,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating chat thread:", error);
        setError(error.message);
        return null;
      }
      
      // Update local state
      setThreads(prevThreads => [data, ...prevThreads]);
      return data;
    } catch (err: any) {
      console.error("Exception creating chat thread:", err);
      setError(err.message || 'An error occurred while creating the conversation');
      return null;
    }
  };
  
  // Function to delete a thread
  const deleteThread = async (threadId: string): Promise<boolean> => {
    try {
      // First delete all messages in the thread
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', threadId);
        
      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        setError(messagesError.message);
        return false;
      }
      
      // Then delete the thread
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId);
        
      if (threadError) {
        console.error("Error deleting thread:", threadError);
        setError(threadError.message);
        return false;
      }
      
      // Update local state
      setThreads(prevThreads => prevThreads.filter(thread => thread.id !== threadId));
      return true;
    } catch (err: any) {
      console.error("Exception deleting chat thread:", err);
      setError(err.message || 'An error occurred while deleting the conversation');
      return false;
    }
  };
  
  // Function to get messages for a thread
  const getMessages = async (threadId: string): Promise<ChatMessage[]> => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error("Error loading chat messages:", error);
        setError(error.message);
        return [];
      }
      
      // Add the role property based on sender
      const messagesWithRole = data?.map(msg => ({
        ...msg,
        role: msg.sender as 'user' | 'assistant'
      })) || [];
      
      return messagesWithRole;
    } catch (err: any) {
      console.error("Exception loading chat messages:", err);
      setError(err.message || 'An error occurred while loading messages');
      return [];
    }
  };
  
  // Function to save a message
  const saveMessage = async (
    threadId: string,
    content: string,
    sender: 'user' | 'assistant',
    references?: any[],
    analysisData?: any,
    hasNumericResult?: boolean,
    subQueries?: string[],
    subQueryResponses?: SubQueryResponse[]
  ): Promise<ChatMessage | null> => {
    try {
      const messageData: Partial<ChatMessage> = {
        thread_id: threadId,
        content,
        sender,
        role: sender,
        created_at: new Date().toISOString()
      };
      
      if (references) {
        messageData.reference_entries = references;
      }
      
      if (analysisData) {
        messageData.analysis_data = analysisData;
      }
      
      if (hasNumericResult !== undefined) {
        messageData.has_numeric_result = hasNumericResult;
      }
      
      // Add sub-queries if provided
      if (subQueries && subQueries.length > 0) {
        if (subQueries[0]) messageData.sub_query1 = subQueries[0];
        if (subQueries[1]) messageData.sub_query2 = subQueries[1];
        if (subQueries[2]) messageData.sub_query3 = subQueries[2];
      }
      
      // Add sub-query responses if provided
      if (subQueryResponses && subQueryResponses.length > 0) {
        messageData.sub_query_responses = subQueryResponses;
      }
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select()
        .single();
        
      if (error) {
        console.error("Error saving chat message:", error);
        setError(error.message);
        return null;
      }
      
      // Update thread's updated_at timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
        
      return data;
    } catch (err: any) {
      console.error("Exception saving chat message:", err);
      setError(err.message || 'An error occurred while saving the message');
      return null;
    }
  };
  
  return {
    threads,
    isLoading,
    error,
    createThread,
    deleteThread,
    getMessages,
    saveMessage
  };
}

export default useChatPersistence;
