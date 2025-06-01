import { ChatMessage, ChatThread, MessageResponse, SubQueryResponse, isThreadMetadata, subQueryResponseToJson, jsonToSubQueryResponse } from './types';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Json } from '@/integrations/supabase/types';
import { isDirectDateQuery, getClientTimeInfo } from '@/services/dateService';
import { performanceMonitor, withPerformanceMonitoring, monitorChatOperation } from '@/utils/performance-monitor';

/**
 * Send a message to the AI assistant and get a response with enhanced RAG pipeline
 */
export async function sendMessage(
  message: string,
  userId: string,
  threadId: string,
  timeRange?: { startDate?: string; endDate?: string; periodName?: string },
  referenceDate?: string
): Promise<MessageResponse> {
  const operationId = `send-message-${Date.now()}`;
  performanceMonitor.startOperation(operationId, 'complete-chat-pipeline', {
    messageLength: message.length,
    userId: userId.substring(0, 8) + '...',
    hasTimeRange: !!timeRange
  });
  
  try {
    // Ensure userId is a string for consistent handling
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[sendMessage] Processing query: "${message}" for user: ${userIdString}`);
    
    // Get current session and auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      throw new Error('Authentication required');
    }
    
    if (!session?.access_token) {
      console.error('No valid session found');
      throw new Error('Authentication required');
    }
    
    console.log(`[sendMessage] Using authenticated session for user: ${session.user.id}`);
    
    // Create a message ID for this new message
    const messageId = uuidv4();
    
    // Capture client's device time and timezone information
    const clientTimeInfo = getClientTimeInfo();
    
    console.log(`[sendMessage] Client time info:`, clientTimeInfo);
    
    // Save the user message to the database
    await withPerformanceMonitoring('save-user-message', async () => {
      await supabase.from('chat_messages').insert({
        id: messageId,
        thread_id: threadId,
        content: message,
        sender: 'user',
        role: 'user',
        created_at: new Date().toISOString(),
      });
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
        .eq('id', userIdString)
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
    
    // Get previous messages from this thread for context (increased to 10 for complete context)
    const { data: previousMessages, error: contextError } = await withPerformanceMonitoring(
      'fetch-conversation-context',
      async () => {
        return await supabase
          .from('chat_messages')
          .select('content, sender, role, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(10); // Increased from 5 to 10 for complete thread context
      }
    );
    
    if (contextError) {
      console.error('Error fetching conversation context:', contextError);
    }
    
    // Build enhanced conversation context for the query planner
    const conversationContext = [];
    if (previousMessages && previousMessages.length > 0) {
      console.log(`[sendMessage] Building conversation context from ${previousMessages.length} previous messages`);
      
      // Reverse to get chronological order and include ALL messages (both user and assistant)
      for (const msg of [...previousMessages].reverse()) {
        conversationContext.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.created_at
        });
      }
      
      // Log conversation context for debugging
      console.log(`[sendMessage] Conversation context summary:`, {
        totalMessages: conversationContext.length,
        userMessages: conversationContext.filter(m => m.role === 'user').length,
        assistantMessages: conversationContext.filter(m => m.role === 'assistant').length,
        firstMessage: conversationContext[0]?.content.substring(0, 50) + '...',
        lastMessage: conversationContext[conversationContext.length - 1]?.content.substring(0, 50) + '...'
      });
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
    }
    
    // Enhanced follow-up detection with full conversation context
    const isTimeFollowUp = detectTimeFollowUp(message, conversationContext);
    const isAnalysisFollowUp = detectAnalysisFollowUp(message, conversationContext);
    const preserveTopicContext = (isTimeFollowUp || isAnalysisFollowUp) && metadataObj.topicContext;
    
    console.log(`[sendMessage] Follow-up detection:`, {
      isTimeFollowUp,
      isAnalysisFollowUp,
      preserveTopicContext,
      originalTopic: metadataObj.topicContext
    });
    
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
    
    // STAGE 1: Query Classification
    console.log(`[sendMessage] STAGE 1: Query Classification`);
    const classificationResponse = await withPerformanceMonitoring(
      'query-classification',
      async () => {
        const classificationPromise = supabase.functions.invoke('chat-query-classifier', {
          body: { message, conversationContext }
        });
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Classification timeout')), 5000);
        });
        
        return await Promise.race([classificationPromise, timeoutPromise]);
      }
    );
    
    if ((classificationResponse as any).error) {
      console.error('Classification error:', (classificationResponse as any).error);
    }
    
    const classification = (classificationResponse as any).data || { 
      category: 'JOURNAL_SPECIFIC', 
      shouldUseJournal: true,
      confidence: 0.7
    };
    
    console.log(`[sendMessage] Classification result:`, classification);
    
    // Handle general mental health questions without journal analysis
    if (classification.category === 'GENERAL_MENTAL_HEALTH' || classification.category === 'CONVERSATIONAL') {
      console.log(`[sendMessage] Handling general question without journal analysis`);
      
      try {
        const generalResponse = await supabase.functions.invoke('general-mental-health-chat', {
          body: { 
            message,
            conversationContext: conversationContext.slice(-5) // Pass conversation context
          }
        });
        
        const finalResponse = (generalResponse as any).data?.response || getGeneralMentalHealthFallback(message);
        
        await supabase.from('chat_messages')
          .update({
            content: finalResponse,
            is_processing: false
          })
          .eq('id', processingMessageId);
        
        await supabase.from('chat_threads')
          .update({ processing_status: 'idle' })
          .eq('id', threadId);
        
        performanceMonitor.endOperation(operationId, 'success');
        
        return {
          response: finalResponse,
          status: 'success',
          messageId: processingMessageId,
        };
      } catch (error) {
        console.error('General chat error:', error);
        const fallbackResponse = getGeneralMentalHealthFallback(message);
        
        await supabase.from('chat_messages')
          .update({
            content: fallbackResponse,
            is_processing: false
          })
          .eq('id', processingMessageId);
        
        await supabase.from('chat_threads')
          .update({ processing_status: 'idle' })
          .eq('id', threadId);
        
        return {
          response: fallbackResponse,
          status: 'success',
          messageId: processingMessageId,
        };
      }
    }
    
    // STAGE 2: Query Planning for journal-specific questions
    console.log(`[sendMessage] STAGE 2: Query Planning`);
    
    await supabase.from('chat_messages')
      .update({ content: "Creating analysis plan..." })
      .eq('id', processingMessageId);
    
    const queryPlannerParams = {
      message,
      userId: userIdString,
      conversationContext,
      isFollowUp: conversationContext.length > 0,
      timezoneOffset: clientTimeInfo.timezoneOffset,
      timezoneName: clientTimeInfo.timezoneName,
      clientTime: clientTimeInfo.timestamp,
      referenceDate,
      preserveTopicContext,
      timeRange,
      threadMetadata: metadataObj,
      isAnalysisFollowUp,
      originalQueryScope: metadataObj.lastQueryScope || null
    };
    
    let queryPlanResponse;
    try {
      queryPlanResponse = await monitorChatOperation(
        async () => {
          const queryPlannerPromise = supabase.functions.invoke('smart-query-planner', {
            body: queryPlannerParams
          });
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Query planner timeout')), 8000);
          });
          
          return await Promise.race([queryPlannerPromise, timeoutPromise]);
        },
        'query-planning',
        { message, userId: userIdString, strategy: 'enhanced' }
      );
    } catch (error) {
      console.error('Query planner timeout or error:', error);
      
      // Improved fallback plan with context awareness
      queryPlanResponse = {
        data: {
          queryPlan: {
            strategy: "hybrid",
            queryType: "journal_specific",
            requiresJournalData: true,
            isEmotionQuery: /\b(emotion|feel|mood|happy|sad|anxious|excited)\b/i.test(message),
            isPersonalityQuery: /\b(am|are)\s+(i|we)\b/i.test(message),
            subQuestions: [message],
            searchParameters: {
              vectorThreshold: 0.1,
              useEmotionSQL: /\b(emotion|feel|mood|happy|sad|anxious|excited)\b/i.test(message),
              useThemeSQL: false,
              dateRange: null,
              fallbackStrategy: isAnalysisFollowUp ? "comprehensive_analysis" : "recent_entries"
            },
            filters: { date_range: null, emotions: null, themes: null },
            domainContext: metadataObj.topicContext || "general_insights",
            confidence: 0.5,
            reasoning: "Fallback due to planner timeout",
            useAllEntries: isAnalysisFollowUp,
            hasPersonalPronouns: /\b(my|me|i|myself)\b/i.test(message),
            needsSegmentation: false
          }
        }
      };
    }
    
    console.log(`[sendMessage] Query planner response received`);
    
    // Check if we have a direct response that doesn't need further processing
    if ((queryPlanResponse as any).data && (queryPlanResponse as any).data.directResponse) {
      await supabase.from('chat_messages')
        .update({
          content: (queryPlanResponse as any).data.directResponse,
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
        lastQueryScope: null,
        lastUpdated: new Date().toISOString()
      });
      
      await supabase.from('chat_threads')
        .update({ processing_status: 'idle' })
        .eq('id', threadId);
      
      performanceMonitor.endOperation(operationId, 'success');
      
      return {
        response: (queryPlanResponse as any).data.directResponse,
        status: 'success',
        messageId: processingMessageId,
      };
    }
    
    // Extract the enhanced query plan
    const queryPlan = (queryPlanResponse as any).data?.queryPlan || {};
    console.log(`[sendMessage] Enhanced query plan received:`, {
      strategy: queryPlan.strategy,
      isEmotionQuery: queryPlan.isEmotionQuery,
      isPersonalityQuery: queryPlan.isPersonalityQuery,
      needsSegmentation: queryPlan.needsSegmentation,
      subQuestions: queryPlan.subQuestions?.length || 0
    });
    
    // STAGE 3: Query Segmentation (if needed)
    let finalSubQuestions = queryPlan.subQuestions || [message];
    
    if (queryPlan.needsSegmentation && queryPlan.subQuestions && queryPlan.subQuestions.length > 1) {
      console.log(`[sendMessage] STAGE 3: Query Segmentation - Processing ${queryPlan.subQuestions.length} sub-questions`);
      
      await supabase.from('chat_messages')
        .update({ content: "Breaking down complex question..." })
        .eq('id', processingMessageId);
      
      try {
        const segmentResponse = await supabase.functions.invoke('segment-complex-query', {
          body: {
            originalQuery: message,
            subQuestions: queryPlan.subQuestions,
            conversationContext: conversationContext.slice(-3), // Pass conversation context
            queryPlan
          }
        });
        
        if ((segmentResponse as any).data && (segmentResponse as any).data.subQuestions) {
          finalSubQuestions = (segmentResponse as any).data.subQuestions;
          console.log(`[sendMessage] Enhanced segmentation completed: ${finalSubQuestions.length} segments`);
        }
      } catch (error) {
        console.error('Segmentation error:', error);
        // Fall back to original sub-questions
      }
    } else {
      console.log(`[sendMessage] No segmentation needed - single query processing`);
    }
    
    // Update processing message based on query plan
    let processingContent = "Analyzing your entries...";
    
    if (queryPlan.isPersonalityQuery) {
      processingContent = "Analyzing personality patterns from your journal...";
    } else if (queryPlan.isEmotionQuery) {
      processingContent = "Analyzing emotional patterns from your entries...";
    } else if (queryPlan.needsComprehensiveAnalysis || queryPlan.useAllEntries) {
      processingContent = "Performing comprehensive analysis of all entries...";
    } else if (isAnalysisFollowUp) {
      processingContent = "Expanding analysis based on conversation context...";
    }
    
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
        periodName: queryPlan.useAllEntries || isAnalysisFollowUp ? 'all time' : 'recent entries'
      };
    }
    
    console.log(`[sendMessage] Using date range:`, dateRange);
    
    // STAGE 4: Sub-Query Processing with Enhanced Analysis
    console.log(`[sendMessage] STAGE 4: Enhanced Sub-Query Processing`);
    
    let queryResponse;
    try {
      queryResponse = await monitorChatOperation(
        async () => {
          const chatRagPromise = supabase.functions.invoke('chat-with-rag', {
            body: {
              message,
              userId: userIdString,
              threadId,
              timeRange: dateRange,
              referenceDate,
              conversationContext, // Already being passed
              queryPlan,
              subQuestions: finalSubQuestions,
              clientTimeInfo: clientTimeInfo,
              userTimezone: userTimezone,
              threadMetadata: metadataObj,
              useAllEntries: queryPlan.useAllEntries || isAnalysisFollowUp,
              hasPersonalPronouns: queryPlan.hasPersonalPronouns || /\b(my|me|i|myself)\b/i.test(message),
              hasExplicitTimeReference: queryPlan.hasExplicitTimeReference || false
            },
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Chat-with-rag timeout')), 15000);
          });
          
          return await Promise.race([chatRagPromise, timeoutPromise]);
        },
        'rag-pipeline',
        { message, userId: userIdString, strategy: queryPlan.strategy }
      );
    } catch (error) {
      console.error('Chat-with-rag timeout or error:', error);
      
      // Provide improved fallback response based on query type
      let fallbackResponse = "I'm experiencing high demand right now. Please try your question again in a moment.";
      
      if (queryPlan.isEmotionQuery) {
        fallbackResponse = "I'm having trouble analyzing your emotional patterns right now due to high demand. Please try again in a moment.";
      } else if (queryPlan.isPersonalityQuery) {
        fallbackResponse = "I'm temporarily unable to analyze personality patterns due to high system load. Please try again shortly.";
      } else if (isAnalysisFollowUp) {
        fallbackResponse = "I'm having trouble expanding the analysis based on our conversation context. Please try again in a moment.";
      }
      
      await supabase.from('chat_messages')
        .update({
          content: fallbackResponse,
          is_processing: false,
        })
        .eq('id', processingMessageId);
      
      await supabase.from('chat_threads')
        .update({ processing_status: 'idle' })
        .eq('id', threadId);
      
      performanceMonitor.endOperation(operationId, 'error', 'Chat-with-rag timeout');
      
      return {
        response: fallbackResponse,
        status: 'error',
        messageId: processingMessageId,
      };
    }
    
    console.log(`[sendMessage] Enhanced RAG response received`);
    
    if ((queryResponse as any).error) {
      console.error('Error from chat-with-rag:', (queryResponse as any).error);
      throw new Error(`Chat service error: ${(queryResponse as any).error.message || (queryResponse as any).error}`);
    }
    
    if (!(queryResponse as any).data) {
      console.error('No data received from chat-with-rag:', queryResponse);
      throw new Error('Failed to get response from chat engine');
    }
    
    // The backend returns { data: "response string" }
    const finalResponse = (queryResponse as any).data;
    
    console.log(`[sendMessage] Final response received, length: ${finalResponse?.length || 0}`);
    
    // Validate that we got a proper string response
    if (!finalResponse || typeof finalResponse !== 'string') {
      console.error('Invalid response format from chat-with-rag:', {
        responseType: typeof finalResponse,
        responseValue: finalResponse
      });
      
      // Provide fallback response based on query type
      let fallbackResponse = 'I apologize, but I encountered an error processing your request. Please try again.';
      
      if (queryPlan.isPersonalityQuery) {
        fallbackResponse = 'I had trouble analyzing personality traits. Could you try adding more detailed entries about your thoughts and experiences?';
      } else if (queryPlan.isEmotionQuery) {
        fallbackResponse = 'I had difficulty analyzing emotional patterns. Try adding more entries describing your feelings.';
      }
      
      await supabase.from('chat_messages')
        .update({
          content: fallbackResponse,
          is_processing: false,
        })
        .eq('id', processingMessageId);
      
      await supabase.from('chat_threads')
        .update({ processing_status: 'idle' })
        .eq('id', threadId);
      
      performanceMonitor.endOperation(operationId, 'error', 'Invalid response format');
      
      return {
        response: fallbackResponse,
        status: 'error',
        messageId: processingMessageId,
      };
    }
    
    // Replace the processing message with the final response
    await supabase.from('chat_messages')
      .update({
        content: finalResponse,
        is_processing: false,
      })
      .eq('id', processingMessageId);
    
    // Update thread metadata with enhanced information including query scope
    const updatedMetadata = {
      intentType: 'answered',
      timeContext: dateRange?.periodName || metadataObj.timeContext,
      topicContext: queryPlan.domainContext || metadataObj.topicContext,
      confidenceScore: queryPlan.confidence || 0.8,
      needsClarity: false,
      lastQueryType: queryPlan.queryType || 'journal_specific',
      lastQueryScope: queryPlan.useAllEntries || isAnalysisFollowUp ? 'all_entries' : 'recent_entries',
      domainContext: queryPlan.domainContext || null,
      searchStrategy: queryPlan.strategy || 'hybrid',
      lastUpdated: new Date().toISOString(),
      conversationLength: conversationContext.length + 1,
      processedSubQuestions: finalSubQuestions.length,
      usedEnhancedRAG: true
    };
    
    await updateThreadMetadata(threadId, updatedMetadata);
    
    await supabase.from('chat_threads')
      .update({ processing_status: 'idle' })
      .eq('id', threadId);
    
    performanceMonitor.endOperation(operationId, 'success');
    performanceMonitor.logSummary();
    
    return {
      response: finalResponse,
      status: 'success',
      messageId: processingMessageId,
    };
  } catch (error) {
    console.error(`Error in sendMessage:`, error);
    
    await supabase.from('chat_threads')
      .update({ processing_status: 'error' })
      .eq('id', threadId);
    
    performanceMonitor.endOperation(operationId, 'error', error.message);
    performanceMonitor.logSummary();
    
    return {
      response: 'Sorry, I encountered an error while processing your message. Please try again.',
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
 * Enhanced time-based follow-up detection with conversation context
 */
function detectTimeFollowUp(message: string, conversationContext: any[]): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const timePatterns = [
    /^(what|how) about (yesterday|today|this week|last week|this month|last month)/i,
    /^(yesterday|today|this week|last week|this month|last month)(\?|\.)?$/i
  ];
  
  return timePatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * New: Detect analysis follow-up questions with conversation context
 */
function detectAnalysisFollowUp(message: string, conversationContext: any[]): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // Patterns that indicate wanting to expand previous analysis
  const analysisFollowUpPatterns = [
    /^now (analyze|look at|check|examine) (all|my|the)/i,
    /^(analyze|look at|check|examine) all (my|the|entries)/i,
    /what about (all|my|the) (entries|data|journal)/i,
    /^all (my|the) (entries|data|journal)/i,
    /^expand (the|this) (analysis|search)/i,
    /^broaden (the|this) (analysis|search)/i
  ];
  
  const isFollowUpPattern = analysisFollowUpPatterns.some(pattern => pattern.test(lowerMessage));
  
  if (!isFollowUpPattern) return false;
  
  // Check if there's a previous analytical question in the conversation
  const hasAnalyticalContext = conversationContext.some(msg => {
    if (msg.role !== 'user') return false;
    const content = msg.content.toLowerCase();
    return /\b(when|what time|pattern|trend|analysis|most|least|often|frequency)\b/.test(content);
  });
  
  console.log(`[detectAnalysisFollowUp] Pattern match: ${isFollowUpPattern}, Has context: ${hasAnalyticalContext}`);
  
  return hasAnalyticalContext;
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
      const queryResponse = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message: subQuery,
          userId,
          threadId,
          timeRange,
          referenceDate,
          subQueryMode: true,
          clientTimeInfo: clientTimeInfo,
          userTimezone: userTimezone,
          conversationContext: [] // Pass empty context for sub-queries to avoid confusion
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
        subQueryResponses,
        conversationContext: [] // Pass context for combining responses
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

function getGeneralMentalHealthFallback(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('confident')) {
    return `## Building Confidence: General Strategies

**Practical Ways to Become More Confident:**

- **Practice self-compassion** - Treat yourself with the same kindness you'd show a good friend
- **Set small, achievable goals** - Build momentum with consistent small wins
- **Challenge negative self-talk** - Notice and reframe harsh inner criticism
- **Focus on your strengths** - Make a list of things you're good at and review it regularly
- **Step outside your comfort zone gradually** - Take on challenges that stretch but don't overwhelm you
- **Improve your posture and body language** - Stand tall, make eye contact, and take up space
- **Learn new skills** - Competence builds confidence naturally
- **Exercise regularly** - Physical activity boosts mood and self-esteem
- **Practice mindfulness** - Stay present instead of worrying about future judgments

**Remember:** Confidence is built through consistent practice and self-acceptance, not perfection. Start with one or two strategies that resonate with you and build from there.

Would you like me to analyze your personal confidence patterns from your journal entries? Just ask something like "How can I become more confident?" to get personalized insights.`;
  }
  
  if (lowerMessage.includes('anxiety') || lowerMessage.includes('stress')) {
    return `## Managing Anxiety and Stress: General Approaches

**Evidence-Based Strategies:**

- **Deep breathing exercises** - Practice 4-7-8 breathing or box breathing
- **Progressive muscle relaxation** - Tense and release muscle groups systematically
- **Mindfulness meditation** - Focus on the present moment without judgment
- **Regular exercise** - Physical activity reduces stress hormones
- **Maintain good sleep hygiene** - Aim for 7-9 hours of quality sleep
- **Limit caffeine and alcohol** - These can worsen anxiety symptoms
- **Connect with others** - Share your feelings with trusted friends or family
- **Practice grounding techniques** - Use the 5-4-3-2-1 sensory method
- **Consider professional help** - Therapy can provide personalized coping strategies

**When to seek professional help:** If anxiety significantly impacts your daily life, work, or relationships.

For personalized insights about your stress patterns, I can analyze your journal entries if you'd like!`;
  }

  return `I'd be happy to help with general mental health information! However, for the most helpful response, could you be more specific about what you're looking for?

**I can provide general information about:**
- Stress and anxiety management
- Building confidence and self-esteem  
- Improving mood and emotional well-being
- Sleep and lifestyle factors
- Mindfulness and coping strategies

**For personalized insights,** I can also analyze your journal entries to understand your unique patterns and provide tailored advice. Just ask a more personal question like "How can I..." or "What helps me..." and I'll look at your journal data.

What specific aspect of mental health would you like to explore?`;
}
