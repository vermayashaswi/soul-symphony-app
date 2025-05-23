
import { supabase } from '@/integrations/supabase/client';
import { processChatMessage } from '../chatService';
import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';

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
