
import { analyzeQueryTypes } from '@/utils/chat/queryAnalyzer';
import { analyzeQueryComplexity, getOptimizedSearchParams } from '@/services/chat/queryComplexityAnalyzer';
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
 * Enhanced query planning service with performance optimizations
 */
export async function planQuery(message: string, threadId: string, userId: string) {
  try {
    console.log("[Query Planner] Enhanced planning with performance optimizations for:", message);
    console.log(`[Query Planner] Current time: ${new Date().toISOString()}`);
    
    // For debugging timezone issues
    if (message.toLowerCase().includes('debug timezone')) {
      debugTimezoneInfo();
    }
    
    // PHASE 1 OPTIMIZATION: Query Complexity Assessment
    const complexityAnalysis = analyzeQueryComplexity(message);
    const optimizedParams = getOptimizedSearchParams(complexityAnalysis);
    
    console.log("[Query Planner] Complexity analysis:", {
      level: complexityAnalysis.complexityLevel,
      score: complexityAnalysis.complexityScore,
      strategy: complexityAnalysis.recommendedStrategy,
      optimizedParams
    });
    
    // Get client's device time information for accurate date calculations
    const clientInfo: ClientTimeInfo = getClientTimeInfo();
    console.log(`[Query Planner] Client time information:`, clientInfo);
    
    // Get user's timezone from their profile with optimized timeout
    let userTimezone = clientInfo.timezoneName;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced from 5000ms
      
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
        dateResponse: dateResponse,
        complexityAnalysis,
        optimizedParams
      };
    }
    
    // Analyze the query types for intelligent sub-query planning
    const queryTypes = analyzeQueryTypes(message);
    
    // Enhanced detection logic with complexity awareness
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
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|since|past)\b/i.test(message.toLowerCase()) ||
      /\bsince\s+(late|early|mid)\s+\w+/i.test(message.toLowerCase());  // FIXED: Include "since" patterns
    
    // Enhanced detection for personality queries requiring all entries
    const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality|negative|positive|improve|rate|worst|best/.test(message.toLowerCase());
    
    // Entity detection from complexity analysis
    const detectedEntities = [];
    const entityPatterns = [
      /\b(mom|dad|mother|father|parent|brother|sister|friend|colleague|boss|manager|doctor|teacher|partner|spouse|wife|husband)\b/i,
      /\b(home|office|gym|restaurant|hospital|school|university|park|beach|store|mall|workplace|clinic)\b/i,
      /\b(company|workplace|team|department|organization|clinic|hospital|school)\b/i,
      /\b(meeting|appointment|party|wedding|conference|interview|vacation|trip|date|presentation)\b/i
    ];
    
    for (const pattern of entityPatterns) {
      const match = message.match(pattern);
      if (match) {
        detectedEntities.push(match[0].toLowerCase());
      }
    }
    
    // Emotion detection from complexity analysis
    const detectedEmotions = [];
    const emotionPatterns = [
      /\b(happy|happiness|joy|excited|elated|cheerful|delighted|joyful)\b/i,
      /\b(sad|sadness|depressed|down|melancholy|grief|sorrow|upset)\b/i,
      /\b(angry|anger|mad|furious|irritated|annoyed|frustrated|rage)\b/i,
      /\b(anxious|anxiety|worried|nervous|stressed|panic|fear|fearful)\b/i,
      /\b(love|loving|affection|caring|tender|devoted|adore)\b/i,
      /\b(proud|pride|accomplished|confident|satisfied|achievement)\b/i,
      /\b(grateful|thankful|appreciation|blessed|appreciative)\b/i,
      /\b(disappointed|letdown|discouraged|dejected|frustrated)\b/i,
      /\b(confused|uncertainty|bewildered|puzzled|uncertain)\b/i,
      /\b(calm|peaceful|relaxed|serene|tranquil|content)\b/i
    ];
    
    for (const pattern of emotionPatterns) {
      const match = message.match(pattern);
      if (match) {
        detectedEmotions.push(match[0].toLowerCase());
      }
    }
    
    // Entity-emotion relationship detection
    const relationshipPatterns = [
      /\b(feel about|feelings toward|emotional connection|relationship with|how.*makes me feel)\b/i,
      /\b(when.*with|around.*feel|being with.*makes)\b/i,
      /\b(my relationship|how i feel about|what.*means to me)\b/i
    ];
    
    const isEntityEmotionQuery = (
      detectedEntities.length > 0 && 
      detectedEmotions.length > 0
    ) || 
    relationshipPatterns.some(pattern => pattern.test(message.toLowerCase()));
    
    console.log("[Query Planner] Enhanced analysis:", {
      hasPersonalPronouns,
      hasExplicitTimeReference,
      isPersonalityQuery,
      detectedEntities,
      detectedEmotions,
      isEntityEmotionQuery,
      complexityLevel: complexityAnalysis.complexityLevel,
      recommendedStrategy: complexityAnalysis.recommendedStrategy
    });
    
    // Strategy selection based on complexity analysis
    let useAllEntries = false;
    let usePersonalContext = true;
    
    if (hasPersonalPronouns) {
      useAllEntries = !hasExplicitTimeReference;
      console.log(`[Query Planner] PERSONAL PRONOUNS DETECTED - Use all entries: ${useAllEntries}`);
    } else if (isPersonalityQuery) {
      useAllEntries = true;
      console.log("[Query Planner] Personality query detected - using all entries");
    }
    
    // Enhanced query context (only for complex queries to avoid overhead)
    let enhancedQuery = message;
    if (complexityAnalysis.complexityLevel === 'complex' || complexityAnalysis.complexityLevel === 'very_complex') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduced timeout
        
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('content, sender')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(2) // Reduced from 3
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (!error && messages) {
          const context = messages
            .filter(msg => msg.sender === 'user')
            .map(msg => msg.content)
            .slice(0, 1) // Reduced context
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
    
    // Strategy determination with complexity awareness
    let strategy = complexityAnalysis.recommendedStrategy;
    
    if (isEntityEmotionQuery) {
      strategy = 'comprehensive'; // Use comprehensive instead of intelligent_sub_query
      console.log("[Query Planner] Using comprehensive strategy for entity-emotion analysis");
    }
    
    // Return enhanced plan with performance optimizations
    return {
      strategy,
      timeRange: queryTypes.timeRange,
      useHistoricalData: false,
      usePersonalContext,
      useAllEntries,
      filterByEmotion: queryTypes.emotion || null,
      enhancedQuery,
      originalQuery: message,
      timestamp: new Date().toISOString(),
      clientDeviceTime: clientInfo.timestamp,
      clientTimezone: clientInfo.timezoneName,
      clientTimezoneOffset: clientInfo.timezoneOffset,
      userTimezone: userTimezone,
      requiresIntelligentPlanning: true,
      queryComplexity: complexityAnalysis.complexityLevel,
      complexityAnalysis,
      optimizedParams,
      hasPersonalPronouns,
      hasExplicitTimeReference,
      detectedEntities,
      detectedEmotions,
      isEntityEmotionQuery,
      emergencyFixPriority: isPersonalityQuery ? 'high' : queryTypes.isEmotionFocused ? 'medium' : 'low',
      optimizedForSpeed: true,
      enhancedFiltering: {
        themes: null,
        entities: detectedEntities.length > 0 ? detectedEntities : null,
        emotions: detectedEmotions.length > 0 ? detectedEmotions : null,
        entityEmotionAnalysis: isEntityEmotionQuery,
        supportsArrayOperations: true,
        supportsJsonbOperations: true,
        supportsEntityEmotionRelationships: true
      }
    };
  } catch (error) {
    console.error("[Query Planner] Error planning query:", error);
    return {
      strategy: 'comprehensive', // Use comprehensive instead of intelligent_sub_query
      originalQuery: message,
      enhancedQuery: message,
      useAllEntries: true,
      usePersonalContext: true,
      errorState: true,
      timestamp: new Date().toISOString(),
      requiresIntelligentPlanning: true,
      emergencyFixPriority: 'high',
      optimizedForSpeed: true,
      fallbackMode: true,
      complexityAnalysis: { complexityLevel: 'moderate', recommendedStrategy: 'standard' },
      optimizedParams: { maxEntries: 10, searchTimeout: 5000 },
      enhancedFiltering: {
        themes: null,
        entities: null,
        emotions: null,
        entityEmotionAnalysis: false,
        supportsArrayOperations: true,
        supportsJsonbOperations: true,
        supportsEntityEmotionRelationships: true
      }
    };
  }
}
