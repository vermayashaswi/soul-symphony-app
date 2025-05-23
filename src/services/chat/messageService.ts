
import { supabase } from '@/integrations/supabase/client';
import { processChatMessage } from '../chatService';
import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';
import { ChatMessage, ChatThread } from './types';
import { v4 as uuidv4 } from 'uuid';

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
    return data || [];
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
    return data || [];
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
    return data;
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
