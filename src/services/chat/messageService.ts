
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, SubQueryResponse } from "./types";

/**
 * Get all messages for a thread
 */
export const getThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching thread messages:", error);
      throw error;
    }
    
    // Add the role property based on sender
    const messagesWithRole = data?.map(msg => ({
      ...msg,
      role: msg.sender as 'user' | 'assistant'
    })) || [];
    
    return messagesWithRole;
  } catch (error) {
    console.error("Exception fetching thread messages:", error);
    throw error;
  }
};

/**
 * Save a message to a thread
 */
export const saveMessage = async (
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
      role: sender
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
      console.error("Error saving message:", error);
      throw error;
    }
    
    // Update thread's updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    return data;
  } catch (error) {
    console.error("Exception saving message:", error);
    throw error;
  }
};

/**
 * Get sub-queries for a message
 */
export const getMessageSubQueries = async (messageId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('sub_query1, sub_query2, sub_query3')
      .eq('id', messageId)
      .single();
      
    if (error) {
      console.error("Error fetching message sub-queries:", error);
      throw error;
    }
    
    const subQueries: string[] = [];
    if (data?.sub_query1) subQueries.push(data.sub_query1);
    if (data?.sub_query2) subQueries.push(data.sub_query2);
    if (data?.sub_query3) subQueries.push(data.sub_query3);
    
    return subQueries;
  } catch (error) {
    console.error("Exception fetching message sub-queries:", error);
    throw error;
  }
};

/**
 * Get sub-query responses for a message
 */
export const getMessageSubQueryResponses = async (messageId: string): Promise<SubQueryResponse[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('sub_query_responses')
      .eq('id', messageId)
      .single();
      
    if (error) {
      console.error("Error fetching message sub-query responses:", error);
      throw error;
    }
    
    return data?.sub_query_responses || [];
  } catch (error) {
    console.error("Exception fetching message sub-query responses:", error);
    throw error;
  }
};

