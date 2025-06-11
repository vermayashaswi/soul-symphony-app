import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database context for intelligent planning
const DATABASE_SCHEMA_CONTEXT = `
Available PostgreSQL Functions:
1. get_top_emotions_with_entries(user_id, start_date, end_date, limit_count) - Returns top emotions with sample entries
2. match_journal_entries_by_emotion(emotion_name, user_id, min_score, start_date, end_date, limit_count) - Find entries by specific emotion
3. match_journal_entries_fixed(query_embedding, match_threshold, match_count, user_id) - Vector similarity search
4. match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id, start_date, end_date) - Vector search with date filter

Table Structure:
- Journal Entries: id, user_id, created_at, "refined text", "transcription text", emotions (jsonb), master_themes (array), sentiment
- Emotions: Stored as jsonb with emotion names as keys and scores (0-1) as values
- Master Themes: Array of theme strings extracted from entries

Common Emotions: happy, sad, anxious, excited, calm, stressed, angry, peaceful, grateful, frustrated, hopeful, lonely
Common Themes: work, relationships, family, health, goals, travel, creativity, learning, challenges, growth
`;

/**
 * FIXED: Extract date ranges from natural language temporal references using current year
 */
function extractDateRangeFromQuery(message: string): { startDate: string; endDate: string } | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lowerMessage = message.toLowerCase();
  
  console.log(`[Date Extraction] Processing temporal query: "${message}" at ${now.toISOString()}`);
  
  if (lowerMessage.includes('last week')) {
    // FIXED: Calculate last week using Monday as week start (ISO week)
    const currentDate = new Date(now);
    const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Days back to this Monday
    
    // Start of this week (Monday)
    const thisWeekStart = new Date(currentDate);
    thisWeekStart.setDate(currentDate.getDate() - daysToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    
    // Last week = this week - 7 days
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Sunday end
    lastWeekEnd.setHours(23, 59, 59, 999);
    
    console.log(`[Date Extraction] Last week calculated: ${lastWeekStart.toISOString()} to ${lastWeekEnd.toISOString()}`);
    
    return {
      startDate: lastWeekStart.toISOString(),
      endDate: lastWeekEnd.toISOString()
    };
  }
  
  if (lowerMessage.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log(`[Date Extraction] Yesterday calculated: ${yesterday.toISOString()} to ${yesterdayEnd.toISOString()}`);
    
    return {
      startDate: yesterday.toISOString(),
      endDate: yesterdayEnd.toISOString()
    };
  }
  
  if (lowerMessage.includes('this week')) {
    // FIXED: Calculate this week using Monday as week start
    const currentDate = new Date(now);
    const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Days back to Monday
    
    const thisWeekStart = new Date(currentDate);
    thisWeekStart.setDate(currentDate.getDate() - daysToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    
    console.log(`[Date Extraction] This week calculated: ${thisWeekStart.toISOString()} to ${now.toISOString()}`);
    
    return {
      startDate: thisWeekStart.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  if (lowerMessage.includes('today')) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    console.log(`[Date Extraction] Today calculated: ${today.toISOString()} to ${now.toISOString()}`);
    
    return {
      startDate: today.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  console.log(`[Date Extraction] No temporal pattern found in: "${message}"`);
  return null;
}

/**
 * Enhanced JSON extraction with better temporal query handling
 */
function extractAndParseJSON(content: string, originalMessage: string): any {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.log("Direct JSON parse failed, trying enhanced extraction methods");
    
    // Try to extract JSON from code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        const cleanedJson = jsonBlockMatch[1]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":');
        return JSON.parse(cleanedJson);
      } catch (e) {
        console.log("JSON block extraction failed");
      }
    }
    
    // Try to find JSON pattern
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonText = jsonMatch[0];
        jsonText = jsonText.replace(/,\s*\}/g, '}');
        jsonText = jsonText.replace(/,\s*\]/g, ']');
        jsonText = jsonText.replace(/([{,]\s*)(\w+):/g, '$1"$2":');
        return JSON.parse(jsonText);
      } catch (e) {
        console.log("JSON pattern extraction failed");
      }
    }
    
    console.error("All JSON extraction methods failed, using enhanced temporal fallback");
    return createTemporalAwareFallback(originalMessage);
  }
}

/**
 * Create enhanced fallback that preserves temporal context
 */
function createTemporalAwareFallback(originalMessage: string): any {
  const lowerMessage = originalMessage.toLowerCase();
  
  // Detect if this is a temporal query
  const isTemporalQuery = /last week|yesterday|today|this week|this month|last month|recently/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  
  // Extract date range if temporal
  const dateRange = isTemporalQuery ? extractDateRangeFromQuery(originalMessage) : null;
  
  const subQuestion = {
    question: isTemporalQuery ? 
      `Find journal entries from the specified time period with ultra-sensitive search` :
      "Find relevant journal entries with ultra-sensitive search",
    purpose: isTemporalQuery ? 
      "Locate entries within the specific date range mentioned in the query" :
      "Gather relevant information from journal entries",
    searchPlan: {
      vectorSearch: {
        threshold: 0.01,
        enabled: true,
        dateFilter: dateRange
      },
      sqlQueries: isEmotionQuery ? [
        {
          function: "get_top_emotions_with_entries",
          parameters: {
            user_id_param: "USER_ID_PLACEHOLDER",
            start_date: dateRange?.startDate || null,
            end_date: dateRange?.endDate || null,
            limit_count: 5
          },
          purpose: "Get top emotions with sample entries for the time period"
        }
      ] : [],
      fallbackStrategy: isTemporalQuery ? null : "recent_entries" // No fallback for temporal queries
    }
  };
  
  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    subQuestions: [subQuestion],
    confidence: 0.4,
    reasoning: isTemporalQuery ? 
      "Enhanced temporal fallback preserving date constraints" : 
      "Emergency fallback with ultra-low threshold",
    isTemporalQuery,
    isEmotionQuery,
    hasDateConstraints: !!dateRange,
    dateRange
  };
}

/**
 * Retry wrapper for OpenAI API calls with exponential backoff
 */
async function retryOpenAICall(promptFunction: () => Promise<Response>, maxRetries: number = 2): Promise<any> {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      
      const response = await promptFunction();
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`OpenAI API returned error ${response.status}`);
      }
      
      const data = await response.json();
      return data.choices[0].message?.content || '{}';
      
    } catch (error) {
      lastError = error;
      console.log(`OpenAI attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

/**
 * Enhanced conversational query analysis with SOULo personality
 */
async function analyzeQueryWithSubQuestions(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // Enhanced personal pronoun detection
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
    
    console.log(`[Query Analysis] Personal pronouns: ${hasPersonalPronouns}, Time reference: ${hasExplicitTimeReference}`);

    const prompt = `You are SOULo's intelligent query planner. Help me understand how to best answer this user's question using their journal data.

${DATABASE_SCHEMA_CONTEXT}

User query: "${message}"
User has ${userEntryCount} journal entries.${contextString}

**PERSONAL PRONOUN PRIORITY RULES:**
- Personal pronouns (I, me, my) WITHOUT time references → analyze ALL entries (useAllEntries: true)
- Personal pronouns WITH time references → respect the time constraint
- Questions like "How am I doing?" should use ALL entries for comprehensive insights
- Questions like "How was I last week?" should use date filters

**CONVERSATION FLOW APPROACH:**
Break this into 1-3 strategic sub-questions that will provide warm, insightful responses.

Return ONLY valid JSON:
{
  "queryType": "journal_specific" | "general_question" | "direct_response",
  "strategy": "intelligent_sub_query",
  "subQuestions": [
    {
      "question": "Specific sub-question",
      "purpose": "Why this helps answer the main query",
      "searchPlan": {
        "vectorSearch": {
          "enabled": boolean,
          "threshold": number (0.01-0.05 for personal, 0.05-0.15 for others),
          "query": "optimized search query",
          "dateFilter": null | {"startDate": "ISO", "endDate": "ISO"}
        },
        "sqlQueries": [
          {
            "function": "function_name",
            "parameters": {...},
            "purpose": "what this achieves"
          }
        ],
        "fallbackStrategy": null | "recent_entries" | "emotion_based"
      }
    }
  ],
  "confidence": number,
  "reasoning": "brief explanation focusing on conversational approach",
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed",
  "useAllEntries": boolean,
  "hasPersonalPronouns": boolean,
  "hasExplicitTimeReference": boolean
}

Focus on creating a warm, conversational analysis plan that will help SOULo provide genuinely helpful insights.`;

    const promptFunction = () => fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      })
    });

    const content = await retryOpenAICall(promptFunction, 2);
    console.log("Raw GPT response:", content);
    
    const analysisResult = extractAndParseJSON(content, message);
    
    if (!analysisResult) {
      console.error("Failed to parse GPT response, using conversational fallback");
      return createConversationalFallback(message, hasPersonalPronouns, hasExplicitTimeReference);
    }
    
    // Validate and enhance with conversational focus
    const validatedResult = validateAndEnhanceSubQuestions(analysisResult, message, hasPersonalPronouns, hasExplicitTimeReference);
    
    console.log("Final Analysis Result:", JSON.stringify(validatedResult, null, 2));
    return validatedResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    return createConversationalFallback(message, false, false);
  }
}

/**
 * ENHANCED: Validate and enhance sub-questions with proper personal pronoun and time handling
 */
function validateAndEnhanceSubQuestions(analysis: any, message: string, hasPersonalPronouns: boolean, hasExplicitTimeReference: boolean, extractedDateRange: any) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced detection
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality|negative|positive|improve|rate|worst|best/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isTemporalQuery = hasExplicitTimeReference;
  
  console.log("[Validation] Enhanced analysis:", {
    hasPersonalPronouns,
    hasExplicitTimeReference,
    isPersonalityQuery,
    isEmotionQuery,
    isTemporalQuery,
    extractedDateRange
  });
  
  // CRITICAL: Determine if we should use all entries
  const useAllEntries = (hasPersonalPronouns && !hasExplicitTimeReference) || isPersonalityQuery;
  
  console.log(`[Validation] USE ALL ENTRIES: ${useAllEntries} (Personal pronouns: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference})`);
  
  // Ensure we have valid sub-questions
  if (!analysis.subQuestions || !Array.isArray(analysis.subQuestions) || analysis.subQuestions.length === 0) {
    analysis.subQuestions = createDefaultSubQuestions(message, isPersonalityQuery, isEmotionQuery, isTemporalQuery, extractedDateRange, useAllEntries);
  }
  
  // Validate and enhance each sub-question
  analysis.subQuestions = analysis.subQuestions.map((subQ, index) => {
    if (!subQ.searchPlan) {
      subQ.searchPlan = {};
    }
    
    // Ensure vector search configuration
    if (!subQ.searchPlan.vectorSearch) {
      subQ.searchPlan.vectorSearch = {
        enabled: true,
        threshold: isPersonalityQuery ? 0.01 : isEmotionQuery ? 0.05 : 0.1,
        query: subQ.question || message
      };
    }
    
    // CRITICAL: Apply time range override logic
    if (useAllEntries) {
      // Override: Remove date filters for personal pronoun queries without time references
      subQ.searchPlan.vectorSearch.dateFilter = null;
      subQ.searchPlan.fallbackStrategy = "recent_entries";
      console.log(`[Validation] Removing date filter for personal query: ${subQ.question}`);
    } else if (isTemporalQuery && extractedDateRange) {
      // Apply date filters for temporal queries
      subQ.searchPlan.vectorSearch.dateFilter = extractedDateRange;
      subQ.searchPlan.fallbackStrategy = null; // No fallback for temporal queries
      console.log(`[Validation] Applying date filter: ${extractedDateRange.startDate} to ${extractedDateRange.endDate}`);
      
      // Update SQL queries to include date parameters
      if (subQ.searchPlan.sqlQueries) {
        subQ.searchPlan.sqlQueries = subQ.searchPlan.sqlQueries.map(sqlQuery => {
          if (sqlQuery.function === 'get_top_emotions_with_entries') {
            sqlQuery.parameters.start_date = extractedDateRange.startDate;
            sqlQuery.parameters.end_date = extractedDateRange.endDate;
          } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
            sqlQuery.parameters.start_date = extractedDateRange.startDate;
            sqlQuery.parameters.end_date = extractedDateRange.endDate;
          }
          return sqlQuery;
        });
      }
    }
    
    // Force ultra-low thresholds for personality queries
    if (isPersonalityQuery && subQ.searchPlan.vectorSearch.threshold > 0.05) {
      subQ.searchPlan.vectorSearch.threshold = 0.01;
    }
    
    // Ensure SQL queries array
    if (!subQ.searchPlan.sqlQueries) {
      subQ.searchPlan.sqlQueries = [];
    }
    
    // Add relevant SQL queries for emotion queries
    if (isEmotionQuery && subQ.searchPlan.sqlQueries.length === 0) {
      subQ.searchPlan.sqlQueries.push({
        function: "get_top_emotions_with_entries",
        parameters: {
          user_id_param: "USER_ID_PLACEHOLDER",
          start_date: useAllEntries ? null : extractedDateRange?.startDate,
          end_date: useAllEntries ? null : extractedDateRange?.endDate,
          limit_count: 5
        },
        purpose: "Get top emotions with examples"
      });
    }
    
    return subQ;
  });
  
  const validated = {
    queryType: analysis.queryType || "journal_specific",
    strategy: "intelligent_sub_query",
    subQuestions: analysis.subQuestions,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7,
    reasoning: analysis.reasoning || `Enhanced sub-query planning with personal pronoun prioritization (useAllEntries: ${useAllEntries})`,
    expectedResponse: analysis.expectedResponse || "analysis",
    isPersonalityQuery,
    isEmotionQuery,
    isTemporalQuery,
    hasDateConstraints: isTemporalQuery && !!extractedDateRange,
    dateRange: isTemporalQuery ? extractedDateRange : null,
    useAllEntries,
    hasPersonalPronouns,
    hasExplicitTimeReference
  };
  
  console.log(`Generated ${validated.subQuestions.length} sub-questions - Personal: ${hasPersonalPronouns}, Temporal: ${isTemporalQuery}, UseAllEntries: ${useAllEntries}`);
  
  return validated;
}

/**
 * ENHANCED: Create default sub-questions with proper time handling
 */
function createDefaultSubQuestions(message: string, isPersonality: boolean, isEmotion: boolean, isTemporal: boolean, dateRange: any, useAllEntries: boolean) {
  const subQuestions = [];
  
  console.log(`[Default Sub-Questions] Creating for - Personal: ${isPersonality}, Emotion: ${isEmotion}, Temporal: ${isTemporal}, UseAllEntries: ${useAllEntries}`);
  
  if (isPersonality) {
    subQuestions.push({
      question: "Find entries that reveal personality patterns and behaviors",
      purpose: "Identify behavioral patterns and personality traits",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.01,
          query: message,
          dateFilter: useAllEntries ? null : dateRange
        },
        sqlQueries: [],
        fallbackStrategy: useAllEntries ? "keyword_search" : (isTemporal ? null : "keyword_search")
      }
    });
  }
  
  if (isEmotion) {
    subQuestions.push({
      question: isTemporal ? "Analyze emotional patterns within the specified time period" : "Analyze emotional patterns and triggers",
      purpose: "Understand emotional states and their contexts",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.05,
          query: message,
          dateFilter: useAllEntries ? null : dateRange
        },
        sqlQueries: [
          {
            function: "get_top_emotions_with_entries",
            parameters: {
              user_id_param: "USER_ID_PLACEHOLDER",
              start_date: useAllEntries ? null : dateRange?.startDate,
              end_date: useAllEntries ? null : dateRange?.endDate,
              limit_count: 5
            },
            purpose: "Get top emotions with examples"
          }
        ],
        fallbackStrategy: useAllEntries ? "emotion_based" : (isTemporal ? null : "emotion_based")
      }
    });
  }
  
  // Always add a general search sub-question
  subQuestions.push({
    question: isTemporal ? 
      "Find relevant journal entries from the specified time period" :
      (useAllEntries ? "Find all relevant journal entries for comprehensive analysis" : "Find relevant journal entries related to the query"),
    purpose: "Gather contextual information from journal entries",
    searchPlan: {
      vectorSearch: {
        enabled: true,
        threshold: isPersonality ? 0.03 : 0.1,
        query: message,
        dateFilter: useAllEntries ? null : dateRange
      },
      sqlQueries: [],
      fallbackStrategy: useAllEntries ? "recent_entries" : (isTemporal ? null : (isPersonality ? "keyword_search" : "recent_entries"))
    }
  });
  
  return subQuestions;
}

/**
 * ENHANCED: Create fallback with proper personal pronoun and time handling
 */
function createConversationalFallback(message: string, hasPersonalPronouns: boolean, hasExplicitTimeReference: boolean) {
  const lowerMessage = message.toLowerCase();
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  
  console.log(`[Enhanced Fallback] Personal pronouns: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference}`);
  
  const subQuestion = {
    question: hasPersonalPronouns ? 
      (hasExplicitTimeReference ? 
        "Find journal entries from the specified time period for personal analysis" :
        "Find all journal entries for comprehensive personal analysis") :
      "Find relevant journal entries with ultra-sensitive search",
    purpose: hasPersonalPronouns ? 
      "Analyze personal patterns and insights from journal entries" :
      "Gather relevant information from journal entries",
    searchPlan: {
      vectorSearch: {
        threshold: hasPersonalPronouns ? 0.01 : 0.05,
        enabled: true,
        dateFilter: (hasPersonalPronouns && !hasExplicitTimeReference) ? null : null
      },
      sqlQueries: isEmotionQuery ? [
        {
          function: "get_top_emotions_with_entries",
          parameters: {
            user_id_param: "USER_ID_PLACEHOLDER",
            start_date: (hasPersonalPronouns && !hasExplicitTimeReference) ? null : null,
            end_date: (hasPersonalPronouns && !hasExplicitTimeReference) ? null : null,
            limit_count: 5
          },
          purpose: "Get top emotions with sample entries"
        }
      ] : [],
      fallbackStrategy: (hasExplicitTimeReference && !hasPersonalPronouns) ? null : "recent_entries"
    }
  };
  
  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    subQuestions: [subQuestion],
    confidence: 0.4,
    reasoning: hasPersonalPronouns ? 
      `Enhanced fallback with personal pronoun prioritization (useAllEntries: ${!hasExplicitTimeReference})` :
      (hasExplicitTimeReference ? "Enhanced temporal fallback preserving date constraints" : "Emergency fallback with ultra-low threshold"),
    isTemporalQuery: hasExplicitTimeReference,
    isEmotionQuery,
    hasDateConstraints: !!dateRange && hasExplicitTimeReference,
    dateRange: hasExplicitTimeReference ? dateRange : null,
    useAllEntries: hasPersonalPronouns && !hasExplicitTimeReference,
    hasPersonalPronouns,
    hasExplicitTimeReference
  };
}

/**
 * Create basic fallback plan for error handling
 */
function createBasicFallbackPlan() {
  return {
    strategy: "intelligent_sub_query",
    queryType: "journal_specific",
    subQuestions: [
      {
        question: "Find relevant journal entries with ultra-sensitive search",
        searchPlan: {
          vectorSearch: {
            enabled: true,
            threshold: 0.01
          },
          sqlQueries: [],
          fallbackStrategy: "keyword_search"
        }
      }
    ],
    totalEntryCount: 0,
    confidence: 0.3,
    reasoning: "Emergency fallback plan with enhanced error handling",
    expectedResponse: "analysis",
    useAllEntries: true, // Default to all entries on error
    isErrorFallback: true
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      userId, 
      conversationContext = [], 
      isFollowUp = false, 
      preserveTopicContext = false, 
      threadMetadata = {}, 
      isAnalysisFollowUp = false 
    } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[Smart Query Planner] Conversational analysis: "${message}"`);

    // Get user's entry count for context
    const { count: userEntryCount } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    console.log(`User ${userId} has ${userEntryCount} journal entries`);

    // Generate conversational query plan
    const queryPlan = await analyzeQueryWithSubQuestions(message, conversationContext, userEntryCount || 0);
    
    console.log(`Conversational Query Plan: ${JSON.stringify(queryPlan, null, 2)}`);

    return new Response(JSON.stringify({
      queryPlan,
      conversationMetadata: {
        isFollowUp,
        preserveTopicContext,
        threadMetadata
      },
      userContext: {
        entryCount: userEntryCount,
        hasPersonalPronouns: queryPlan.hasPersonalPronouns,
        hasTimeReference: queryPlan.hasExplicitTimeReference
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart query planner:', error);
    return new Response(JSON.stringify({
      error: error.message,
      fallbackPlan: createBasicFallbackPlan()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
