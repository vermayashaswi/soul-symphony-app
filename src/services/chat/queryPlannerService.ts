
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
 * Enhanced query planning service with prioritized personal pronoun support, theme detection, and entity filtering
 */
export async function planQuery(message: string, threadId: string, userId: string) {
  try {
    console.log("[Query Planner] Enhanced planning with theme and entity detection for:", message);
    console.log(`[Query Planner] Current time: ${new Date().toISOString()}`);
    
    // For debugging timezone issues
    if (message.toLowerCase().includes('debug timezone')) {
      debugTimezoneInfo();
    }
    
    // Get client's device time information for accurate date calculations
    const clientInfo: ClientTimeInfo = getClientTimeInfo();
    console.log(`[Query Planner] Client time information:`, clientInfo);
    
    // Get user's timezone from their profile with optimized timeout
    let userTimezone = clientInfo.timezoneName;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
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
      }
    } catch (error) {
      console.error("Error fetching user timezone from profile:", error);
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
        useAllEntries: false,
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
    
    // ENHANCED: Check for personal pronouns for all-entries analysis - HIGHEST PRIORITY
    const personalPronounPatterns = [
      /\b(i|me|my|mine|myself)\b/i,
      /\bam i\b/i,
      /\bdo i\b/i,
      /\bhow am i\b/i,
      /\bhow do i\b/i,
      /\bwhat makes me\b/i,
      /\bhow was i\b/i,
      /\bwhat do i\b/i,
      /\bwhere do i\b/i,
      /\bwhen do i\b/i,
      /\bwhy do i\b/i,
      /\bwhat about me\b/i,
      /\bam i getting\b/i,
      /\bwhat can i\b/i
    ];
    
    const hasPersonalPronouns = personalPronounPatterns.some(pattern => pattern.test(message.toLowerCase()));
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night)\b/i.test(message.toLowerCase());
    
    // Enhanced detection for personality queries requiring all entries
    const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality|negative|positive|improve|rate|worst|best/.test(message.toLowerCase());
    
    // NEW: Enhanced theme detection
    const themePatterns = [
      /\b(work|job|career|office|meeting|project|colleague|boss)\b/i,
      /\b(family|relationship|friend|partner|spouse|love|marriage)\b/i,
      /\b(health|exercise|fitness|workout|diet|medical|doctor)\b/i,
      /\b(stress|anxiety|depression|worry|fear|panic|mental health)\b/i,
      /\b(travel|vacation|trip|journey|adventure|explore)\b/i,
      /\b(goal|achievement|success|failure|challenge|growth)\b/i,
      /\b(money|finance|budget|expense|income|financial)\b/i,
      /\b(hobby|interest|passion|creative|art|music|reading)\b/i
    ];
    
    const detectedThemes = [];
    for (const pattern of themePatterns) {
      const match = message.match(pattern);
      if (match) {
        detectedThemes.push(match[0].toLowerCase());
      }
    }
    
    // NEW: Enhanced entity detection
    const entityPatterns = [
      // People patterns
      /\b(mom|dad|mother|father|parent|brother|sister|friend|colleague|boss|manager|doctor|teacher)\b/i,
      // Place patterns  
      /\b(home|office|gym|restaurant|hospital|school|university|park|beach|store|mall)\b/i,
      // Organization patterns
      /\b(company|workplace|team|department|organization|clinic|hospital|school)\b/i,
      // Event patterns
      /\b(meeting|appointment|party|wedding|conference|interview|vacation|trip)\b/i
    ];
    
    const detectedEntities = [];
    for (const pattern of entityPatterns) {
      const match = message.match(pattern);
      if (match) {
        detectedEntities.push(match[0].toLowerCase());
      }
    }
    
    console.log("[Query Planner] Enhanced analysis:", {
      hasPersonalPronouns,
      hasExplicitTimeReference,
      isPersonalityQuery,
      detectedThemes,
      detectedEntities,
      originalQueryTypes: queryTypes
    });
    
    // CRITICAL: Override time range logic for personal pronoun queries - HIGHEST PRIORITY
    let useAllEntries = false;
    let usePersonalContext = true;
    
    if (hasPersonalPronouns) {
      // If personal pronouns detected without explicit time reference, use all entries
      useAllEntries = !hasExplicitTimeReference;
      console.log(`[Query Planner] PERSONAL PRONOUNS DETECTED - Use all entries: ${useAllEntries} (explicit time ref: ${hasExplicitTimeReference})`);
    } else if (isPersonalityQuery) {
      // Personality queries should also use all entries
      useAllEntries = true;
      console.log("[Query Planner] Personality query detected - using all entries");
    }
    
    // Add properties needed for intelligent planning
    queryTypes.needsDataAggregation = queryTypes.isQuantitative || 
                                     queryTypes.isStatisticalQuery || 
                                     message.toLowerCase().includes('how many times');
                                     
    queryTypes.needsMoreContext = message.length < 10 || 
                               message.split(' ').length < 3 || 
                               /^(tell me|show)( more| about)?/i.test(message);
    
    queryTypes.needsEmergencyFixes = isPersonalityQuery || queryTypes.isEmotionFocused;
    
    // Check if this is a time pattern analysis query
    const isTimePatternQuery = queryTypes.isTemporalQuery && 
                             (message.toLowerCase().includes('pattern') || 
                              message.toLowerCase().includes('when do i') || 
                              message.toLowerCase().includes('what time') || 
                              message.toLowerCase().includes('how often') || 
                              message.toLowerCase().includes('frequency'));
    
    // Enhance query with thread context only for complex queries
    let enhancedQuery = message;
    if (queryTypes.needsMoreContext || isPersonalityQuery) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('content, sender')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(3)
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (!error && messages) {
          const context = messages
            .filter(msg => msg.sender === 'user')
            .map(msg => msg.content)
            .slice(0, 2)
            .join('\n');

          if (context.length > 10) {
            enhancedQuery = `${message}\nContext:\n${context}`;
            console.log("[Query Planner] Enhanced query with thread context");
          }
        }
      } catch (error) {
        console.error("Error enhancing query with thread context:", error);
      }
    }
    
    // Define intelligent sub-query strategy
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
      console.log("[Query Planner] Using intelligent sub-query strategy for personality/emotion analysis");
    }
    else if (queryTypes.isWhyQuestion) {
      strategy = 'intelligent_sub_query';
      console.log("[Query Planner] Using intelligent sub-query strategy for causal analysis");
    }
    
    // Return enhanced plan with prioritized personal pronoun support and entity filtering
    return {
      strategy,
      timeRange: queryTypes.timeRange,
      useHistoricalData: false,
      usePersonalContext,
      useAllEntries, // CRITICAL: This will override time constraints when personal pronouns are detected
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
      hasPersonalPronouns, // Flag for personal pronoun detection
      hasExplicitTimeReference, // Flag for explicit time references
      detectedThemes, // NEW: Detected themes for enhanced filtering
      detectedEntities, // NEW: Detected entities for enhanced filtering
      emergencyFixPriority: isPersonalityQuery ? 'high' : queryTypes.isEmotionFocused ? 'medium' : 'low',
      optimizedForSpeed: true,
      enhancedFiltering: {
        themes: detectedThemes.length > 0 ? detectedThemes : null,
        entities: detectedEntities.length > 0 ? detectedEntities : null,
        supportsArrayOperations: true,
        supportsJsonbOperations: true
      }
    };
  } catch (error) {
    console.error("[Query Planner] Error planning query:", error);
    return {
      strategy: 'intelligent_sub_query',
      originalQuery: message,
      enhancedQuery: message,
      useAllEntries: true, // Default to all entries on error for personal questions
      usePersonalContext: true,
      errorState: true,
      timestamp: new Date().toISOString(),
      requiresIntelligentPlanning: true,
      needsEmergencyFixes: true,
      emergencyFixPriority: 'high',
      optimizedForSpeed: true,
      fallbackMode: true,
      enhancedFiltering: {
        themes: null,
        entities: null,
        supportsArrayOperations: true,
        supportsJsonbOperations: true
      }
    };
  }
}
