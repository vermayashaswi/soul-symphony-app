
import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';
import { supabase } from '@/integrations/supabase/client';
import { 
  isDirectDateQuery, 
  getClientTimeInfo, 
  getLastWeekDateRange, 
  getCurrentWeekDateRange, 
  debugTimezoneInfo, 
  ClientTimeInfo 
} from '@/services/dateService';

/**
 * Enhance query with thread context
 * @param message User query message
 * @param threadId Chat thread ID
 * @returns Enhanced query string
 */
async function enhanceWithThreadContext(message: string, threadId: string, queryTypes: any): Promise<string> {
  try {
    // Fetch the last few messages from the chat thread
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('content, sender')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching thread messages:", error);
      return message;
    }

    // Extract relevant context from previous messages
    const context = messages
      .filter(msg => msg.sender === 'user')
      .map(msg => msg.content)
      .join('\n');

    // Combine the user's query with the context
    const enhancedQuery = `${message}\nContext:\n${context}`;
    
    console.log("[Query Planner] Enhanced query with thread context:", enhancedQuery);
    return enhancedQuery;
  } catch (error) {
    console.error("Error enhancing query with thread context:", error);
    return message;
  }
}

/**
 * Enhanced query planning service with intelligent sub-query generation
 */
export async function planQuery(message: string, threadId: string, userId: string) {
  try {
    console.log("[Query Planner] Planning intelligent sub-query strategy with emergency fixes for:", message);
    console.log(`[Query Planner] Current time: ${new Date().toISOString()}`);
    
    // For debugging timezone issues
    if (message.toLowerCase().includes('debug timezone')) {
      debugTimezoneInfo();
    }
    
    // Get client's device time information for accurate date calculations
    const clientInfo: ClientTimeInfo = getClientTimeInfo();
    
    console.log(`[Query Planner] Client time information:`, clientInfo);
    
    // Get user's timezone from their profile with 25s timeout
    let userTimezone;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single();
        
      clearTimeout(timeoutId);
        
      if (profileData && profileData.timezone) {
        userTimezone = profileData.timezone;
        console.log(`[Query Planner] User timezone from profile: ${userTimezone}`);
      } else {
        console.log(`[Query Planner] No timezone found in user profile, using client timezone`);
        userTimezone = clientInfo.timezoneName;
      }
    } catch (error) {
      console.error("Error fetching user timezone from profile:", error);
      userTimezone = clientInfo.timezoneName;
    }
    
    // Check if this is a direct date query
    const isLastWeekQuery = message.toLowerCase().includes('last week') && 
                           (message.toLowerCase().includes('date') || 
                            message.toLowerCase().includes('what') || 
                            message.toLowerCase().includes('when'));
                           
    const isCurrentWeekQuery = isDirectDateQuery(message);
    
    if (isCurrentWeekQuery || isLastWeekQuery) {
      console.log("[Query Planner] Detected direct date query:", isLastWeekQuery ? "last week" : "current week");
      
      let dateResponse, dateRange;
      
      if (isLastWeekQuery) {
        const lastWeekResult = getLastWeekDateRange(clientInfo, userTimezone);
        dateResponse = lastWeekResult.formattedRange;
        dateRange = lastWeekResult.rangeObj;
        console.log(`[Query Planner] Last week dates calculated: ${dateResponse}`);
      } else {
        const currentWeekResult = getCurrentWeekDateRange(clientInfo, userTimezone);
        dateResponse = currentWeekResult.formattedRange;
        dateRange = currentWeekResult.rangeObj;
        console.log(`[Query Planner] Current week dates calculated: ${dateResponse}`);
      }
      
      return {
        strategy: "direct_date",
        isDirectDateQuery: true,
        timeRange: dateRange,
        useHistoricalData: false,
        usePersonalContext: false,
        filterByEmotion: null,
        enhancedQuery: message,
        originalQuery: message,
        timestamp: new Date().toISOString(),
        clientDeviceTime: clientInfo.timestamp,
        clientTimezone: clientInfo.timezoneName,
        clientTimezoneOffset: clientInfo.timezoneOffset,
        userTimezone: userTimezone,
        dateResponse: dateResponse
      };
    }
    
    // Analyze the query types for intelligent sub-query planning
    const queryTypes = analyzeQueryTypes(message);
    
    // Enhanced detection for personality queries requiring emergency fixes
    const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality|negative|positive|improve|rate|worst|best/.test(message.toLowerCase());
    
    // Add properties needed for intelligent planning with emergency fixes
    queryTypes.needsDataAggregation = queryTypes.isQuantitative || 
                                     queryTypes.isStatisticalQuery || 
                                     message.toLowerCase().includes('how many times');
                                     
    queryTypes.needsMoreContext = message.length < 10 || 
                               message.split(' ').length < 3 || 
                               /^(tell me|show)( more| about)?/i.test(message);
    
    queryTypes.needsEmergencyFixes = isPersonalityQuery || queryTypes.isEmotionFocused;
    
    console.log("[Query Planner] Enhanced query type analysis:", {
      ...queryTypes,
      isPersonalityQuery,
      needsEmergencyFixes: queryTypes.needsEmergencyFixes
    });
    
    // Check if this is a time pattern analysis query
    const isTimePatternQuery = queryTypes.isTemporalQuery && 
                             (message.toLowerCase().includes('pattern') || 
                              message.toLowerCase().includes('when do i') || 
                              message.toLowerCase().includes('what time') || 
                              message.toLowerCase().includes('how often') || 
                              message.toLowerCase().includes('frequency'));
    
    // Enhance query analysis based on thread context
    const enhancedQuery = await enhanceWithThreadContext(message, threadId, queryTypes);
    
    // Define intelligent sub-query strategy with emergency fix priority
    let strategy = 'intelligent_sub_query';
    
    if (queryTypes.needsMoreContext) {
      strategy = 'request_clarification';
    } 
    else if (isTimePatternQuery) {
      strategy = 'intelligent_sub_query';
      console.log("[Query Planner] Using intelligent sub-query strategy for time pattern analysis");
    }
    else if (queryTypes.needsDataAggregation) {
      strategy = 'intelligent_sub_query';
      console.log("[Query Planner] Using intelligent sub-query strategy for data aggregation");
    }
    else if (queryTypes.isEmotionFocused || isPersonalityQuery) {
      strategy = 'intelligent_sub_query';
      console.log("[Query Planner] Using intelligent sub-query strategy with emergency fixes for personality/emotion analysis");
    }
    else if (queryTypes.isWhyQuestion) {
      strategy = 'intelligent_sub_query';
      console.log("[Query Planner] Using intelligent sub-query strategy for causal analysis");
    }
    
    // Return enhanced plan with emergency fix indicators
    return {
      strategy,
      timeRange: queryTypes.timeRange,
      useHistoricalData: false,
      usePersonalContext: true,
      filterByEmotion: queryTypes.emotion || null,
      enhancedQuery,
      originalQuery: message,
      timestamp: new Date().toISOString(),
      clientDeviceTime: clientInfo.timestamp,
      clientTimezone: clientInfo.timezoneName,
      clientTimezoneOffset: clientInfo.timezoneOffset,
      userTimezone: userTimezone,
      requiresIntelligentPlanning: true,
      queryComplexity: queryTypes.needsDataAggregation ? 'high' : 
                      queryTypes.isEmotionFocused || isPersonalityQuery ? 'medium' : 'standard',
      needsEmergencyFixes: queryTypes.needsEmergencyFixes,
      isPersonalityQuery: isPersonalityQuery,
      emergencyFixPriority: isPersonalityQuery ? 'high' : queryTypes.isEmotionFocused ? 'medium' : 'low'
    };
  } catch (error) {
    console.error("[Query Planner] Error planning intelligent sub-query:", error);
    return {
      strategy: 'intelligent_sub_query',
      originalQuery: message,
      enhancedQuery: message,
      errorState: true,
      timestamp: new Date().toISOString(),
      requiresIntelligentPlanning: true,
      needsEmergencyFixes: true,
      emergencyFixPriority: 'high'
    };
  }
}
