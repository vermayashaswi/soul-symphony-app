
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
 * Enhanced query planning service to determine the best approach for handling user queries
 * @param message User query message
 * @param threadId Chat thread ID
 * @param userId User ID
 * @returns Query plan with strategy and parameters
 */
export async function planQuery(message: string, threadId: string, userId: string) {
  try {
    console.log("[Query Planner] Planning strategy for:", message);
    console.log(`[Query Planner] Current time: ${new Date().toISOString()}`);
    
    // For debugging timezone issues
    if (message.toLowerCase().includes('debug timezone')) {
      debugTimezoneInfo();
    }
    
    // Get client's device time information for accurate date calculations
    const clientInfo: ClientTimeInfo = getClientTimeInfo();
    
    console.log(`[Query Planner] Client time information:`, clientInfo);
    
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
        console.log(`[Query Planner] User timezone from profile: ${userTimezone}`);
      } else {
        console.log(`[Query Planner] No timezone found in user profile, using client timezone`);
        userTimezone = clientInfo.timezoneName;
      }
    } catch (error) {
      console.error("Error fetching user timezone from profile:", error);
      userTimezone = clientInfo.timezoneName;
    }
    
    // Check if this is a direct date query, including last week queries
    const isLastWeekQuery = message.toLowerCase().includes('last week') && 
                           (message.toLowerCase().includes('date') || 
                            message.toLowerCase().includes('what') || 
                            message.toLowerCase().includes('when'));
                           
    const isCurrentWeekQuery = isDirectDateQuery(message);
    
    if (isCurrentWeekQuery || isLastWeekQuery) {
      console.log("[Query Planner] Detected direct date query:", isLastWeekQuery ? "last week" : "current week");
      
      let dateResponse, dateRange;
      
      if (isLastWeekQuery) {
        // Get last week dates using the client's time information and user timezone
        const lastWeekResult = getLastWeekDateRange(clientInfo, userTimezone);
        dateResponse = lastWeekResult.formattedRange;
        dateRange = lastWeekResult.rangeObj;
        console.log(`[Query Planner] Last week dates calculated: ${dateResponse}`);
      } else {
        // Get current week dates using the client's time information and user timezone
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
        dateResponse: dateResponse // Include the formatted date response
      };
    }
    
    // Analyze the query types
    const queryTypes = analyzeQueryTypes(message);
    
    // Add properties needed by the code
    queryTypes.needsDataAggregation = queryTypes.isQuantitative || 
                                     queryTypes.isStatisticalQuery || 
                                     message.toLowerCase().includes('how many times');
                                     
    queryTypes.needsMoreContext = message.length < 10 || 
                               message.split(' ').length < 3 || 
                               /^(tell me|show)( more| about)?/i.test(message);
    
    console.log("[Query Planner] Query type analysis:", queryTypes);
    
    // Check if this is a time pattern analysis query
    const isTimePatternQuery = queryTypes.isTemporalQuery && 
                             (message.toLowerCase().includes('pattern') || 
                              message.toLowerCase().includes('when do i') || 
                              message.toLowerCase().includes('what time') || 
                              message.toLowerCase().includes('how often') || 
                              message.toLowerCase().includes('frequency'));
    
    // Enhance query analysis based on thread context
    const enhancedQuery = await enhanceWithThreadContext(message, threadId, queryTypes);
    
    // Define query plan strategy
    let strategy = 'default';
    
    if (queryTypes.needsMoreContext) {
      strategy = 'request_clarification';
    } 
    else if (isTimePatternQuery) {
      strategy = 'time_pattern_analysis';
      console.log("[Query Planner] Using time pattern analysis strategy");
    }
    else if (queryTypes.needsDataAggregation) {
      strategy = 'data_aggregation';
      console.log("[Query Planner] Using data aggregation strategy");
    }
    else if (queryTypes.isEmotionFocused) {
      strategy = 'emotion_analysis';
    }
    else if (queryTypes.isWhyQuestion) {
      strategy = 'causal_analysis';
    }
    
    // Determine if historical data should be used
    let useHistoricalData = false;
    if (message.toLowerCase().includes('historical data') || message.toLowerCase().includes('past entries')) {
      useHistoricalData = true;
    }
    
    // Determine if personal context should be used
    let usePersonalContext = false;
    if (message.toLowerCase().includes('personal context') || message.toLowerCase().includes('my feelings')) {
      usePersonalContext = true;
    }
    
    return {
      strategy,
      timeRange: queryTypes.timeRange,
      useHistoricalData: useHistoricalData,
      usePersonalContext: usePersonalContext || false,
      filterByEmotion: queryTypes.emotion || null,
      enhancedQuery,
      originalQuery: message,
      timestamp: new Date().toISOString(),
      clientDeviceTime: clientInfo.timestamp,
      clientTimezone: clientInfo.timezoneName,
      clientTimezoneOffset: clientInfo.timezoneOffset,
      userTimezone: userTimezone
    };
  } catch (error) {
    console.error("[Query Planner] Error planning query:", error);
    return {
      strategy: 'default',
      originalQuery: message,
      enhancedQuery: message,
      errorState: true,
      timestamp: new Date().toISOString()
    };
  }
}
