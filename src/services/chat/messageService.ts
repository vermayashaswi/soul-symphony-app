import { ChatMessage, ChatThread, MessageResponse, SubQueryResponse, isThreadMetadata, subQueryResponseToJson, jsonToSubQueryResponse } from './types';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Json } from '@/integrations/supabase/types';
import { isDirectDateQuery, getClientTimeInfo } from '@/services/dateService';

/**
 * Send a message to the AI assistant and get a response
 */
export async function sendMessage(
  message: string,
  userId: string,
  threadId: string,
  timeRange?: { startDate?: string; endDate?: string; periodName?: string },
  referenceDate?: string
): Promise<MessageResponse> {
  try {
    // Create a message ID for this new message
    const messageId = uuidv4();
    
    // Capture client's device time and timezone information
    const clientTimeInfo = getClientTimeInfo();
    
    console.log(`[sendMessage] Captured client time info:`, clientTimeInfo);
    console.log(`[sendMessage] Enhanced debugging: Processing "${message}" for user ${userId}`);
    
    // Save the user message to the database
    await supabase.from('chat_messages').insert({
      id: messageId,
      thread_id: threadId,
      content: message,
      sender: 'user',
      role: 'user',
      created_at: new Date().toISOString(),
    });
    
    // Update the thread's updated_at timestamp
    await supabase.from('chat_threads').update({
      updated_at: new Date().toISOString(),
      processing_status: 'processing',
    }).eq('id', threadId);
    
    // Get user's timezone from their profile
    let userTimezone;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single();
        
      if (profileData && profileData.timezone) {
        userTimezone = profileData.timezone;
        console.log(`[sendMessage] User timezone from profile: ${userTimezone}`);
      } else {
        console.log(`[sendMessage] No timezone found in user profile, using client timezone`);
        userTimezone = clientTimeInfo.timezoneName;
      }
    } catch (error) {
      console.error("Error fetching user timezone from profile:", error);
      userTimezone = clientTimeInfo.timezoneName;
    }
    
    // Get previous messages from this thread for context (most recent 15)
    const { data: previousMessages, error: contextError } = await supabase
      .from('chat_messages')
      .select('content, sender, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(15);
    
    if (contextError) {
      console.error('Error fetching conversation context:', contextError);
    }
    
    // Build conversation context for OpenAI
    const conversationContext = [];
    if (previousMessages && previousMessages.length > 0) {
      for (const msg of [...previousMessages].reverse()) {
        conversationContext.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }
    
    // Get user context from the thread
    const { data: threadData } = await supabase
      .from('chat_threads')
      .select('metadata')
      .eq('id', threadId)
      .single();
    
    const metadata = threadData?.metadata || {};
    
    let metadataObj: Record<string, any> = {};
    if (isThreadMetadata(metadata)) {
      metadataObj = metadata;
    } else {
      console.warn('Thread metadata is not in expected format:', metadata);
    }
    
    // Check if this appears to be a follow-up query with a time reference
    const isTimeFollowUp = detectTimeFollowUp(message);
    const preserveTopicContext = isTimeFollowUp && metadataObj.topicContext;
    
    // Check if the message appears to be mental health related
    const isMentalHealthQuery = detectMentalHealthQuery(message);
    
    // Prepare function call parameter data with enhanced context
    const queryPlannerParams = {
      message,
      userId,
      conversationContext,
      timezoneOffset: clientTimeInfo.timezoneOffset,
      timezoneName: clientTimeInfo.timezoneName,
      clientTime: clientTimeInfo.timestamp,
      appContext: {
        appInfo: {
          name: "SOULo",
          type: "Voice Journaling App",
          features: ["Journal Analysis", "Emotion Tracking", "Mental Wellbeing", "Pattern Recognition"]
        },
        userContext: {
          previousTimeContext: metadataObj.timeContext || null,
          previousTopicContext: metadataObj.topicContext || null,
          intentType: metadataObj.intentType || 'new_query',
          needsClarity: metadataObj.needsClarity || false,
          confidenceScore: metadataObj.confidenceScore || null,
          ambiguities: metadataObj.ambiguities || [],
          isMentalHealthQuery: isMentalHealthQuery,
          userTimezone: userTimezone
        }
      },
      checkForMultiQuestions: true,
      isFollowUp: conversationContext.length > 0,
      referenceDate,
      preserveTopicContext,
      timeRange
    };
    
    // Create a placeholder/processing message in the database
    const processingMessageId = uuidv4();
    await supabase.from('chat_messages').insert({
      id: processingMessageId,
      thread_id: threadId,
      sender: 'assistant',
      role: 'assistant',
      content: "Analyzing your question...",
      is_processing: true,
      created_at: new Date().toISOString()
    });
    
    // Step 1: Get query plan to determine search strategy
    const queryPlanResponse = await supabase.functions.invoke('smart-query-planner', {
      body: queryPlannerParams
    });
    
    // Check if we have a direct response that doesn't need further processing
    if (queryPlanResponse.data && queryPlanResponse.data.directResponse) {
      await supabase.from('chat_messages')
        .update({
          content: queryPlanResponse.data.directResponse,
          is_processing: false
        })
        .eq('id', processingMessageId);
      
      await updateThreadMetadata(threadId, {
        intentType: 'direct_response',
        timeContext: metadataObj.timeContext,
        topicContext: metadataObj.topicContext,
        confidenceScore: 1.0,
        needsClarity: false,
        lastQueryType: 'direct_response',
        lastUpdated: new Date().toISOString()
      });
      
      return {
        response: queryPlanResponse.data.directResponse,
        status: 'success',
        messageId: processingMessageId,
      };
    }
    
    // Extract the query plan from the response
    const queryPlan = queryPlanResponse.data?.plan || {};
    const queryType = queryPlanResponse.data?.queryType || 'journal_specific';
    
    console.log('[sendMessage] Enhanced debugging - Query plan received:', JSON.stringify(queryPlan, null, 2));
    console.log(`[sendMessage] Enhanced debugging - Query type: ${queryType}`);
    
    // Update the processing message with status based on the query plan
    let processingContent = "Processing your request...";
    
    if (queryPlan.needsMoreContext) {
      // The query needs clarification, so use the clarificationReason as response
      const clarificationResponse = queryPlan.clarificationReason || 
        "Could you provide more details about what you're looking for?";
      
      // Replace the processing message with the clarification request
      await supabase.from('chat_messages')
        .update({
          content: clarificationResponse,
          is_processing: false
        })
        .eq('id', processingMessageId);
      
      // Update thread metadata to track that we need clarity
      await updateThreadMetadata(threadId, {
        intentType: 'needs_clarification',
        timeContext: queryPlan.previousTimeContext || metadataObj.timeContext,
        topicContext: queryPlan.topicContext || metadataObj.topicContext,
        confidenceScore: queryPlan.confidenceScore || 0.3,
        needsClarity: true,
        ambiguities: queryPlan.ambiguities || [],
        lastQueryType: queryType,
        domainContext: queryPlan.domainContext || null,
        lastUpdated: new Date().toISOString()
      });
      
      // Update thread status
      await supabase.from('chat_threads')
        .update({ processing_status: 'idle' })
        .eq('id', threadId);
      
      return {
        response: clarificationResponse,
        status: 'needs_clarification',
        messageId: processingMessageId,
      };
    }
    
    // Set appropriate processing message based on query type
    if (queryType === 'journal_specific') {
      processingContent = "Searching your journal entries for insights...";
    } else if (queryType === 'emotional_analysis') {
      processingContent = "Analyzing emotional patterns in your journal...";
    } else if (queryType === 'pattern_detection') {
      processingContent = "Looking for patterns in your journal entries...";
    } else if (queryType === 'personality_reflection') {
      processingContent = "Reflecting on personality insights from your journal...";
    } else if (queryType === 'mental_health_analysis') {
      processingContent = "Analyzing your journal entries for mental health insights...";
    }
    
    // Update the processing message with the appropriate content
    await supabase.from('chat_messages')
      .update({ content: processingContent })
      .eq('id', processingMessageId);
    
    // Get the appropriate date range from the query plan or use defaults
    let dateRange = timeRange;
    if (!dateRange && queryPlan.filters?.date_range) {
      dateRange = queryPlan.filters.date_range;
    }
    
    // Set defaults if no date range is specified
    if (!dateRange) {
      dateRange = {
        startDate: null,
        endDate: null,
        periodName: 'all time'
      };
    }
    
    console.log(`[sendMessage] Enhanced debugging - Final date range:`, dateRange);
    
    // First, verify that this user has journal entries in the database
    const { count: entryCount, error: countError } = await supabase
      .from('Journal Entries')
      .select('id', { count: "exact", head: true })
      .eq('user_id', userId);
    
    if (countError) {
      console.error('Error checking for user journal entries:', countError);
    }
    
    // If no entries found and this is a mental health query, provide a helpful response
    if ((entryCount === 0 || !entryCount) && isMentalHealthQuery) {
      const noEntriesResponse = 
        "I don't see any journal entries in your account yet. To provide personalized mental health advice, " +
        "I need to analyze your journal entries. Would you like to create a journal entry first? " +
        "That will help me give you more tailored recommendations based on your experiences and emotions.";
      
      await supabase.from('chat_messages')
        .update({
          content: noEntriesResponse,
          is_processing: false
        })
        .eq('id', processingMessageId);
      
      await supabase.from('chat_threads')
        .update({ processing_status: 'idle' })
        .eq('id', threadId);
      
      return {
        response: noEntriesResponse,
        status: 'success',
        messageId: processingMessageId,
      };
    }
    
    // CRUCIAL: Use only chat-with-rag function (the more robust one)
    console.log(`[sendMessage] Enhanced debugging - Calling chat-with-rag function`);
    
    let finalResponse;
    
    if (queryPlan.isSegmented) {
      const subQueries = queryPlan.subqueries || [];
      const queryResponse = await processMultiPartQuery(
        message, 
        userId, 
        threadId, 
        dateRange, 
        referenceDate, 
        subQueries, 
        clientTimeInfo,
        userTimezone
      );
      finalResponse = queryResponse.response;
    } else {
      // Standard query processing - ONLY use chat-with-rag
      const queryResponse = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId,
          threadId,
          timeRange: dateRange,
          referenceDate,
          conversationContext,
          queryPlan,
          isMentalHealthQuery,
          clientTimeInfo: clientTimeInfo,
          userTimezone: userTimezone
        }
      });
      
      console.log(`[sendMessage] Enhanced debugging - chat-with-rag response:`, queryResponse);
      console.log(`[sendMessage] Enhanced debugging - queryResponse.data:`, queryResponse.data);
      console.log(`[sendMessage] Enhanced debugging - queryResponse.error:`, queryResponse.error);
      
      if (queryResponse.error) {
        console.error('Error from chat-with-rag:', queryResponse.error);
        throw new Error(`Chat service error: ${queryResponse.error.message || queryResponse.error}`);
      }
      
      if (!queryResponse.data) {
        console.error('No data received from chat-with-rag:', queryResponse);
        throw new Error('Failed to get response from chat-with-rag engine');
      }
      
      // CRITICAL FIX: The backend returns { data: actualResponseString }
      // So queryResponse.data contains the actual response string
      finalResponse = queryResponse.data;
      
      console.log(`[sendMessage] Enhanced debugging - Final response type: ${typeof finalResponse}`);
      console.log(`[sendMessage] Enhanced debugging - Final response preview: ${finalResponse?.substring(0, 100)}...`);
      
      // Validate that we got a proper string response
      if (!finalResponse || typeof finalResponse !== 'string') {
        console.error('Invalid response format from chat-with-rag:', {
          responseType: typeof finalResponse,
          responseValue: finalResponse,
          fullQueryResponse: queryResponse
        });
        finalResponse = 'I apologize, but I encountered an error processing your request. Please try again.';
      }
      
      if (isMentalHealthQuery && (!finalResponse || finalResponse.trim() === '' || finalResponse.includes("I don't have enough information"))) {
        finalResponse = "Based on the journal entries I have access to, I don't have enough information to provide specific mental health recommendations. " +
          "To give you better personalized advice, could you add more journal entries about your feelings, challenges, and daily experiences? " +
          "In the meantime, some general mental health practices include regular exercise, adequate sleep, mindfulness meditation, and connecting with others.";
      }
    }
    
    console.log(`[sendMessage] Enhanced debugging - Final response: ${finalResponse?.substring(0, 200)}...`);
    
    // Replace the processing message with the final response
    await supabase.from('chat_messages')
      .update({
        content: finalResponse,
        is_processing: false,
      })
      .eq('id', processingMessageId);
    
    // Update thread metadata
    const updatedMetadata = {
      intentType: 'answered',
      timeContext: dateRange?.periodName || metadataObj.timeContext,
      topicContext: queryPlan.topicContext || metadataObj.topicContext,
      confidenceScore: queryPlan.confidenceScore || 0.8,
      needsClarity: false,
      lastQueryType: queryType,
      domainContext: queryPlan.domainContext || null,
      lastUpdated: new Date().toISOString()
    };
    
    await updateThreadMetadata(threadId, updatedMetadata);
    
    await supabase.from('chat_threads')
      .update({ processing_status: 'idle' })
      .eq('id', threadId);
    
    return {
      response: finalResponse,
      status: 'success',
      messageId: processingMessageId,
    };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    
    await supabase.from('chat_threads')
      .update({ processing_status: 'error' })
      .eq('id', threadId);
    
    return {
      response: 'Sorry, I encountered an error while processing your message.',
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Detect if a message is mental health related
 */
function detectMentalHealthQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const mentalHealthPatterns = [
    /mental\s+health/i,
    /\b(anxiety|anxious|depress(ed|ion)|stress(ed)?|mood|emotion|therapy)\b/i,
    /\b(self[\s-]care|well[\s-]being|wellbeing|coping)\b/i,
    /\bhow\s+(to|can|do)\s+I\s+(feel|get|cope|manage|improve|handle)\b/i,
    /what\s+(is|should)\s+(best|good|helpful|recommended)\s+for\s+my\s+(mental|emotional)/i,
    /what\s+(should|can|must)\s+i\s+do/i
  ];
  
  return mentalHealthPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Detect if a message is a time-based follow-up
 */
function detectTimeFollowUp(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const timePatterns = [
    /^(what|how) about (yesterday|today|this week|last week|this month|last month)/i,
    /^(yesterday|today|this week|last week|this month|last month)(\?|\.)?$/i
  ];
  
  return timePatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Process a multi-part query by breaking it into segments
 */
async function processMultiPartQuery(
  message: string, 
  userId: string, 
  threadId: string,
  timeRange: any,
  referenceDate?: string,
  subQueries: string[] = [],
  clientTimeInfo: any = null,
  userTimezone: string = 'UTC'
): Promise<SubQueryResponse> {
  try {
    if (subQueries.length === 0) {
      const questionParts = message.split(/(?:and|also|\?)\s+/i).filter(q => q.trim().length > 0);
      
      if (questionParts.length > 1) {
        subQueries = questionParts.map(q => q.trim() + (q.endsWith('?') ? '' : '?'));
      } else {
        subQueries = [message];
      }
    }
    
    const subQueryResponses: SubQueryResponse[] = [];
    for (const subQuery of subQueries) {
      // Use chat-with-rag for all sub-queries too
      const queryResponse = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message: subQuery,
          userId,
          threadId,
          timeRange,
          referenceDate,
          subQueryMode: true,
          clientTimeInfo: clientTimeInfo,
          userTimezone: userTimezone
        }
      });
      
      if (queryResponse.data && queryResponse.data.data) {
        subQueryResponses.push({
          query: subQuery,
          response: queryResponse.data.data
        });
      }
    }
    
    if (subQueryResponses.length === 1) {
      return {
        query: message,
        response: subQueryResponses[0].response
      };
    }
    
    const combinedResponse = await supabase.functions.invoke('combine-segment-responses', {
      body: {
        originalQuery: message,
        subQueryResponses
      }
    });
    
    if (combinedResponse.data && combinedResponse.data.response) {
      return {
        query: message,
        response: combinedResponse.data.response
      };
    }
    
    let response = '';
    subQueryResponses.forEach((sq, index) => {
      if (index > 0) response += '\n\n';
      response += `**Q${index + 1}: ${sq.query}**\n${sq.response}`;
    });
    
    return {
      query: message,
      response
    };
  } catch (error) {
    console.error('Error in processMultiPartQuery:', error);
    return {
      query: message,
      response: 'Sorry, I encountered an error while processing your multi-part question.'
    };
  }
}

/**
 * Update thread metadata with new values
 */
async function updateThreadMetadata(threadId: string, updates: Record<string, any>) {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('metadata')
      .eq('id', threadId)
      .single();
    
    if (error) {
      console.error('Error fetching thread metadata:', error);
      return;
    }
    
    const currentMetadata = data?.metadata || {};
    let metadataObj: Record<string, any> = {};
    
    if (isThreadMetadata(currentMetadata)) {
      metadataObj = { ...currentMetadata };
    } else {
      console.warn('Thread metadata is not in expected format:', currentMetadata);
    }
    
    const updatedMetadata = {
      ...metadataObj,
      ...updates
    };
    
    await supabase
      .from('chat_threads')
      .update({ metadata: updatedMetadata })
      .eq('id', threadId);
  } catch (error) {
    console.error('Error updating thread metadata:', error);
  }
}

/**
 * Gets the user's timezone offset in minutes
 */
export const getUserTimezoneOffset = (): number => {
  return new Date().getTimezoneOffset();
};

/**
 * Gets all messages for a thread, ordered by creation time
 */
export const getThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    return (data || []).map((msg: any) => {
      const chatMessage: ChatMessage = {
        id: msg.id,
        thread_id: msg.thread_id,
        content: msg.content,
        sender: msg.sender as 'user' | 'assistant' | 'error',
        role: msg.role as 'user' | 'assistant' | 'error',
        created_at: msg.created_at,
        references: Array.isArray(msg.reference_entries) ? msg.reference_entries : [], 
        reference_entries: Array.isArray(msg.reference_entries) ? msg.reference_entries : [],
        analysis: msg.analysis_data,
        analysis_data: msg.analysis_data,
        sub_query_responses: jsonToSubQueryResponse(msg.sub_query_responses),
        is_processing: msg.is_processing,
        hasNumericResult: msg.has_numeric_result,
        has_numeric_result: msg.has_numeric_result
      };
      
      return chatMessage;
    });
  } catch (error) {
    console.error("Error fetching thread messages:", error);
    return [];
  }
};

/**
 * Saves a message to the database
 */
export const saveMessage = async (
  threadId: string, 
  content: string, 
  sender: 'user' | 'assistant',
  references?: any[],
  analysis?: any,
  hasNumericResult?: boolean,
  isInteractive?: boolean,
  interactiveOptions?: any[]
): Promise<ChatMessage | null> => {
  try {
    const messageData = {
      thread_id: threadId,
      content,
      sender,
      role: sender,
      reference_entries: references ? references : null,
      analysis_data: analysis ? analysis : null,
      has_numeric_result: !!hasNumericResult
    };
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();
      
    if (error) throw error;
    
    if (!data) {
      throw new Error("No data returned from message insert");
    }
    
    const chatMessage: ChatMessage = {
      id: data.id,
      thread_id: data.thread_id,
      content: data.content,
      sender: data.sender as 'user' | 'assistant' | 'error',
      role: data.role as 'user' | 'assistant' | 'error',
      created_at: data.created_at,
      references: Array.isArray(data.reference_entries) ? data.reference_entries : [],
      reference_entries: Array.isArray(data.reference_entries) ? data.reference_entries : [],
      analysis: data.analysis_data,
      analysis_data: data.analysis_data,
      hasNumericResult: data.has_numeric_result,
      has_numeric_result: data.has_numeric_result,
      sub_query_responses: jsonToSubQueryResponse(data.sub_query_responses)
    };
    
    if (isInteractive && interactiveOptions) {
      chatMessage.isInteractive = true;
      chatMessage.interactiveOptions = interactiveOptions;
    }
    
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    return chatMessage;
  } catch (error) {
    console.error("Error saving message:", error);
    return null;
  }
};

/**
 * Process and convert sub-query responses to the correct type
 */
function processSubQueryResponses(data: any): SubQueryResponse[] {
  return jsonToSubQueryResponse(data);
}

/**
 * Creates a new thread
 */
export const createThread = async (
  userId: string,
  title: string = "New Conversation"
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .insert({
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
      
    if (error) throw error;
    
    return data?.id || null;
  } catch (error) {
    console.error("Error creating thread:", error);
    return null;
  }
};

/**
 * Gets all threads for a user, ordered by update time
 */
export const getUserChatThreads = async (userId: string): Promise<any[] | null> => {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    
    return data || null;
  } catch (error) {
    console.error("Error getting user threads:", error);
    return null;
  }
};

/**
 * Updates the title of a thread
 */
export const updateThreadTitle = async (threadId: string, title: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error("Error updating thread title:", error);
    return false;
  }
};
