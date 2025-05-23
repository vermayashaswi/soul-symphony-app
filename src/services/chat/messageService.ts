
import { supabase } from '@/integrations/supabase/client';
import { processChatMessage } from '../chatService';
import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';
import { ChatMessage, ChatThread, SubQueryResponse, isSubQueryResponse, jsonToSubQueryResponse } from './types';
import { v4 as uuidv4 } from 'uuid';
import { Json } from '@/integrations/supabase/types';

export interface SendMessageResponse {
  status: 'success' | 'error';
  content: string;
  role: 'assistant' | 'error';
  references?: any[];
  analysis?: any;
  isInteractive?: boolean;
  interactiveOptions?: any[];
  hasNumericResult?: boolean;
  error?: string;
}

export async function sendMessage(
  message: string,
  userId: string,
  threadId: string,
  timeRange?: any,
  referenceDate?: string
): Promise<SendMessageResponse> {
  try {
    console.log(`[messageService] Sending message for user ${userId} in thread ${threadId}`);
    console.log(`[messageService] Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    // Analyze the query to understand its intent
    const queryTypes = analyzeQueryTypes(message);
    console.log(`[messageService] Query analysis:`, queryTypes);

    // Get client time information for better date handling
    const clientTimeInfo = {
      timestamp: new Date().toISOString(),
      timezoneOffset: new Date().getTimezoneOffset(),
      timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone,
      rawOffset: new Date().getTimezoneOffset() * 60000
    };

    // Get conversation history for context
    let conversationHistory = [];
    try {
      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('content, sender, role')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && chatMessages && chatMessages.length > 0) {
        conversationHistory = chatMessages
          .reverse()
          .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
        console.log(`[messageService] Found ${conversationHistory.length} previous messages for context`);
      }
    } catch (error) {
      console.error("[messageService] Error fetching conversation history:", error);
    }

    // Call the chat-with-rag edge function
    const { data: response, error } = await supabase.functions.invoke('chat-with-rag', {
      body: {
        message,
        userId,
        threadId,
        timeRange,
        referenceDate,
        conversationContext: conversationHistory,
        queryPlan: {
          strategy: 'hybrid',
          domainContext: queryTypes.isPersonalInsightQuery ? 'mental_health' : 'general_insights',
          needsComprehensiveAnalysis: queryTypes.isQuantitative || queryTypes.isEmotionFocused
        },
        isMentalHealthQuery: queryTypes.isMentalHealthQuery,
        clientTimeInfo,
        userTimezone: clientTimeInfo.timezoneName
      }
    });

    if (error) {
      console.error(`[messageService] Error calling chat-with-rag:`, error);
      return {
        status: 'error',
        content: "I'm having trouble processing your request right now. Please try again in a moment.",
        role: 'error',
        error: error.message || 'Unknown error'
      };
    }

    console.log(`[messageService] Received response from edge function:`, {
      hasResponse: !!response?.response,
      role: response?.role,
      hasReferences: !!response?.references?.length,
      referencesCount: response?.references?.length || 0
    });

    // Return the processed response
    return {
      status: 'success',
      content: response?.response || "I couldn't generate a response at this time.",
      role: response?.role || 'assistant',
      references: response?.references || [],
      analysis: response?.analysis || null,
      isInteractive: response?.isInteractive || false,
      interactiveOptions: response?.interactiveOptions || [],
      hasNumericResult: response?.hasNumericResult || false
    };

  } catch (error) {
    console.error(`[messageService] Unexpected error:`, error);
    return {
      status: 'error',
      content: "I encountered an unexpected error. Please try again.",
      role: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function createThread(userId: string, title: string = "New Conversation"): Promise<string | null> {
  try {
    const threadId = uuidv4();
    const { error } = await supabase
      .from('chat_threads')
      .insert({
        id: threadId,
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    return threadId;
  } catch (error) {
    console.error("Error creating thread:", error);
    return null;
  }
}

export async function getUserChatThreads(userId: string): Promise<ChatThread[] | null> {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    // Cast the database response to our ChatThread type with proper type safety
    return (data || []).map(thread => {
      // Ensure metadata is an object or undefined
      let typedMetadata: ChatThread['metadata'] = undefined;
      
      if (thread.metadata && typeof thread.metadata === 'object' && !Array.isArray(thread.metadata)) {
        typedMetadata = {
          timeContext: thread.metadata.timeContext || null,
          topicContext: thread.metadata.topicContext || null,
          intentType: thread.metadata.intentType || undefined,
          confidenceScore: thread.metadata.confidenceScore || undefined,
          needsClarity: thread.metadata.needsClarity || false,
          ambiguities: Array.isArray(thread.metadata.ambiguities) ? thread.metadata.ambiguities : [],
          domainContext: thread.metadata.domainContext || null,
          lastUpdated: thread.metadata.lastUpdated || undefined,
          ...(thread.metadata as object) // Include any other properties
        };
      }
      
      return {
        id: thread.id,
        title: thread.title,
        user_id: thread.user_id,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
        processing_status: (thread.processing_status as 'idle' | 'processing' | 'failed') || 'idle',
        metadata: typedMetadata
      };
    });
  } catch (error) {
    console.error("Error fetching user threads:", error);
    return null;
  }
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Cast the database response to our ChatMessage type with proper type safety
    return (data || []).map(message => {
      // Properly handle reference_entries
      let references: any[] = [];
      if (message.reference_entries) {
        if (Array.isArray(message.reference_entries)) {
          references = message.reference_entries;
        } else if (typeof message.reference_entries === 'object') {
          // Convert object to array if possible
          references = Object.values(message.reference_entries);
        }
      }
      
      // Properly handle sub_query_responses
      let subQueryResponses: SubQueryResponse[] = [];
      if (message.sub_query_responses) {
        subQueryResponses = jsonToSubQueryResponse(message.sub_query_responses);
      }
      
      return {
        id: message.id,
        thread_id: message.thread_id,
        content: message.content,
        sender: (message.sender as 'user' | 'assistant' | 'error') || 'user',
        role: (message.role as 'user' | 'assistant' | 'error') || message.sender as 'user' | 'assistant' | 'error' || 'user',
        created_at: message.created_at,
        reference_entries: references,
        analysis_data: message.analysis_data || undefined,
        has_numeric_result: message.has_numeric_result || false,
        sub_query1: message.sub_query1 || undefined,
        sub_query2: message.sub_query2 || undefined,
        sub_query3: message.sub_query3 || undefined,
        sub_query_responses: subQueryResponses,
        isInteractive: false,
        interactiveOptions: undefined,
        references: references,
        analysis: message.analysis_data,
        hasNumericResult: message.has_numeric_result || false
      };
    });
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    return [];
  }
}

export async function saveMessage(
  threadId: string,
  content: string,
  sender: 'user' | 'assistant' | 'error',
  references?: any[],
  analysis?: any,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[]
): Promise<ChatMessage | null> {
  try {
    const messageData = {
      id: uuidv4(),
      thread_id: threadId,
      content,
      sender,
      role: sender,
      created_at: new Date().toISOString(),
      reference_entries: references || null,
      analysis_data: analysis || null,
      has_numeric_result: hasNumericResult || false,
      isInteractive: isInteractive || false,
      interactiveOptions: interactiveOptions || null
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();
    
    if (error) throw error;
    
    // Cast the database response to our ChatMessage type with proper type safety
    // Extract references correctly
    let typedReferences: any[] = [];
    if (data.reference_entries) {
      if (Array.isArray(data.reference_entries)) {
        typedReferences = data.reference_entries;
      } else if (typeof data.reference_entries === 'object') {
        typedReferences = Object.values(data.reference_entries);
      }
    }
    
    // Process sub_query_responses correctly
    let typedSubQueryResponses: SubQueryResponse[] = [];
    if (data.sub_query_responses) {
      typedSubQueryResponses = jsonToSubQueryResponse(data.sub_query_responses);
    }
    
    return {
      id: data.id,
      thread_id: data.thread_id,
      content: data.content,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: (data.role as 'user' | 'assistant' | 'error') || data.sender as 'user' | 'assistant' | 'error',
      created_at: data.created_at,
      reference_entries: typedReferences,
      analysis_data: data.analysis_data,
      has_numeric_result: data.has_numeric_result,
      sub_query1: data.sub_query1,
      sub_query2: data.sub_query2,
      sub_query3: data.sub_query3,
      sub_query_responses: typedSubQueryResponses,
      isInteractive: isInteractive || false,
      interactiveOptions: interactiveOptions,
      references: typedReferences,
      analysis: data.analysis_data,
      hasNumericResult: data.has_numeric_result || false
    };
  } catch (error) {
    console.error("Error saving message:", error);
    return null;
  }
}

export async function updateThreadTitle(threadId: string, title: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ 
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating thread title:", error);
    return false;
  }
}
