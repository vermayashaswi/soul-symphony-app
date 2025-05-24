
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

// Database schema context for GPT
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
 * FIXED: Extract date ranges from natural language temporal references with correct calculations
 */
function extractDateRangeFromQuery(message: string): { startDate: string; endDate: string } | null {
  const now = new Date();
  const lowerMessage = message.toLowerCase();
  
  console.log(`[Date Calculator] Current time: ${now.toISOString()}`);
  console.log(`[Date Calculator] Processing query: "${lowerMessage}"`);
  
  if (lowerMessage.includes('last week')) {
    // FIXED: Last week calculation - Monday to Sunday of previous week
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? 6 : currentDay - 1; // Days since Monday
    
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - mondayOffset - 7); // Go back to last Monday
    lastWeekStart.setHours(0, 0, 0, 0);
    
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Sunday of last week
    lastWeekEnd.setHours(23, 59, 59, 999);
    
    console.log(`[Date Calculator] Last week: ${lastWeekStart.toISOString()} to ${lastWeekEnd.toISOString()}`);
    
    return {
      startDate: lastWeekStart.toISOString(),
      endDate: lastWeekEnd.toISOString()
    };
  }
  
  if (lowerMessage.includes('this week')) {
    // FIXED: This week calculation - Monday to current date
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? 6 : currentDay - 1; // Days since Monday
    
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - mondayOffset); // Go back to this Monday
    thisWeekStart.setHours(0, 0, 0, 0);
    
    console.log(`[Date Calculator] This week: ${thisWeekStart.toISOString()} to ${now.toISOString()}`);
    
    return {
      startDate: thisWeekStart.toISOString(),
      endDate: now.toISOString()
    };
  }
  
  if (lowerMessage.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    console.log(`[Date Calculator] Yesterday: ${yesterday.toISOString()} to ${yesterdayEnd.toISOString()}`);
    
    return {
      startDate: yesterday.toISOString(),
      endDate: yesterdayEnd.toISOString()
    };
  }
  
  if (lowerMessage.includes('today')) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    console.log(`[Date Calculator] Today: ${today.toISOString()} to ${now.toISOString()}`);
    
    return {
      startDate: today.toISOString(),
      endDate: now.toISOString()
    };
  }
  
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
 * FIXED: Create enhanced fallback that preserves temporal context with current dates
 */
function createTemporalAwareFallback(originalMessage: string): any {
  const lowerMessage = originalMessage.toLowerCase();
  
  // Detect if this is a temporal query
  const isTemporalQuery = /last week|yesterday|today|this week|this month|last month|recently/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isMentalHealthQuery = /mental health|help|improve|advice|better|support/.test(lowerMessage);
  
  // FIXED: Extract date range with current dates, not 2023
  const dateRange = isTemporalQuery ? extractDateRangeFromQuery(originalMessage) : null;
  
  console.log(`[Fallback] Temporal query: ${isTemporalQuery}, Date range: ${dateRange ? `${dateRange.startDate} to ${dateRange.endDate}` : 'none'}`);
  
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
    queryType: isMentalHealthQuery ? "journal_specific" : "journal_specific", // FIXED: Prefer journal analysis
    strategy: "intelligent_sub_query",
    subQuestions: [subQuestion],
    confidence: 0.6, // FIXED: Higher confidence
    reasoning: isTemporalQuery ? 
      "Enhanced temporal fallback preserving date constraints with current dates" : 
      "Emergency fallback with ultra-low threshold",
    isTemporalQuery,
    isEmotionQuery,
    isMentalHealthQuery,
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
 * IMPROVED: Intelligent query analysis with enhanced temporal handling and better classification
 */
async function analyzeQueryWithSubQuestions(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // FIXED: Extract potential date range with current dates
    const extractedDateRange = extractDateRangeFromQuery(message);
    const dateContext = extractedDateRange ? 
      `\nDetected date range: ${extractedDateRange.startDate} to ${extractedDateRange.endDate}` : '';

    // IMPROVED: Enhanced classification for mental health queries
    const isMentalHealthQuery = /mental health|help|improve|advice|better|support|guidance|tips|suggestions/.test(message.toLowerCase());
    const queryTypeHint = isMentalHealthQuery ? 
      'This appears to be a mental health question that should use personal journal data for personalized advice.' : '';

    const prompt = `You are an intelligent query planner for a voice journaling app called SOULo. Your task is to break down user queries into executable sub-questions with detailed search plans.

${DATABASE_SCHEMA_CONTEXT}

User query: "${message}"
User has ${userEntryCount} journal entries.${contextString}${dateContext}
${queryTypeHint}

CRITICAL RULES FOR TEMPORAL QUERIES:
- If the query mentions "last week", "yesterday", "today", "this week" etc., you MUST include exact date filters
- NEVER use fallback strategies for temporal queries - if no entries exist in the date range, return empty
- Use SQL functions with start_date and end_date parameters for temporal queries
- Set vectorSearch.dateFilter for all temporal queries

CLASSIFICATION RULES:
- Personal mental health questions asking for advice/help should be "journal_specific" to provide personalized responses
- Only classify as "general_question" if the user is asking about the app itself or completely unrelated topics
- Questions about "this week", "today", "recently" should be "journal_specific" with date filters

Break this query into 1-3 strategic sub-questions that will help answer the original query.

Return ONLY valid JSON with this structure:
{
  "queryType": "journal_specific" | "general_question" | "direct_response",
  "strategy": "intelligent_sub_query",
  "subQuestions": [
    {
      "question": "Specific sub-question to answer",
      "purpose": "Why this sub-question helps answer the main query",
      "searchPlan": {
        "vectorSearch": {
          "enabled": boolean,
          "threshold": number (0.01-0.05 for personality, 0.05-0.15 for others),
          "query": "optimized search query for this sub-question",
          "dateFilter": null | {"startDate": "ISO", "endDate": "ISO"}
        },
        "sqlQueries": [
          {
            "function": "function_name",
            "parameters": {...},
            "purpose": "what this query achieves"
          }
        ],
        "fallbackStrategy": null | "recent_entries" | "emotion_based" | "keyword_search"
      }
    }
  ],
  "confidence": number,
  "reasoning": "brief explanation of the approach",
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed"
}

For temporal queries, ALWAYS set fallbackStrategy to null to prevent analyzing entries outside the date range.`;

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
      console.error("Failed to parse GPT response, using temporal-aware fallback");
      return createTemporalAwareFallback(message);
    }
    
    // Validate and enhance the sub-questions with temporal awareness
    const validatedResult = validateAndEnhanceSubQuestions(analysisResult, message);
    
    console.log("Final Analysis Result:", JSON.stringify(validatedResult, null, 2));
    return validatedResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    return createTemporalAwareFallback(message);
  }
}

/**
 * IMPROVED: Validate and enhance sub-questions with strict temporal handling and better classification
 */
function validateAndEnhanceSubQuestions(analysis: any, message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced detection
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality|negative|positive|improve|rate/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isTemporalQuery = /last week|yesterday|today|this week|this month|recently/.test(lowerMessage);
  const isMentalHealthQuery = /mental health|help|improve|advice|better|support|guidance|tips|suggestions/.test(lowerMessage);
  
  // FIXED: Extract date range with current dates
  const extractedDateRange = isTemporalQuery ? extractDateRangeFromQuery(message) : null;
  
  console.log(`[Validation] Temporal: ${isTemporalQuery}, Mental Health: ${isMentalHealthQuery}, Date Range: ${extractedDateRange ? 'yes' : 'no'}`);
  
  // IMPROVED: Override queryType if it's clearly a personal question
  if (isMentalHealthQuery || isTemporalQuery || isPersonalityQuery || isEmotionQuery) {
    analysis.queryType = "journal_specific";
    console.log(`[Validation] Overriding queryType to journal_specific for personalized response`);
  }
  
  // Ensure we have valid sub-questions
  if (!analysis.subQuestions || !Array.isArray(analysis.subQuestions) || analysis.subQuestions.length === 0) {
    analysis.subQuestions = createDefaultSubQuestions(message, isPersonalityQuery, isEmotionQuery, isTemporalQuery, extractedDateRange, isMentalHealthQuery);
  }
  
  // Validate and enhance each sub-question with strict temporal handling
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
    
    // CRITICAL: Apply date filters for temporal queries with CURRENT dates
    if (isTemporalQuery && extractedDateRange) {
      subQ.searchPlan.vectorSearch.dateFilter = extractedDateRange;
      
      console.log(`[Validation] Applied date filter: ${extractedDateRange.startDate} to ${extractedDateRange.endDate}`);
      
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
      
      // CRITICAL: No fallback for temporal queries
      subQ.searchPlan.fallbackStrategy = null;
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
          start_date: extractedDateRange?.startDate || null,
          end_date: extractedDateRange?.endDate || null,
          limit_count: 5
        },
        purpose: "Get top emotions with sample entries"
      });
    }
    
    // Set appropriate fallback strategy (null for temporal queries)
    if (!subQ.searchPlan.fallbackStrategy && !isTemporalQuery) {
      subQ.searchPlan.fallbackStrategy = isPersonalityQuery ? "keyword_search" : "recent_entries";
    }
    
    return subQ;
  });
  
  const validated = {
    queryType: analysis.queryType || "journal_specific", // FIXED: Default to journal_specific
    strategy: "intelligent_sub_query",
    subQuestions: analysis.subQuestions,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7,
    reasoning: analysis.reasoning || "Enhanced sub-query planning with strict temporal constraints and current dates",
    expectedResponse: analysis.expectedResponse || "analysis",
    isPersonalityQuery,
    isEmotionQuery,
    isTemporalQuery,
    isMentalHealthQuery,
    hasDateConstraints: !!extractedDateRange,
    dateRange: extractedDateRange
  };
  
  console.log(`Generated ${validated.subQuestions.length} sub-questions - Personality: ${isPersonalityQuery}, Emotion: ${isEmotionQuery}, Temporal: ${isTemporalQuery}, Mental Health: ${isMentalHealthQuery}, Date Range: ${!!extractedDateRange}`);
  
  return validated;
}

/**
 * IMPROVED: Create default sub-questions with enhanced temporal awareness and mental health focus
 */
function createDefaultSubQuestions(message: string, isPersonality: boolean, isEmotion: boolean, isTemporal: boolean, dateRange: any, isMentalHealth: boolean) {
  const subQuestions = [];
  
  if (isPersonality) {
    subQuestions.push({
      question: "Find entries that reveal personality patterns and behaviors",
      purpose: "Identify behavioral patterns and personality traits",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.01,
          query: message,
          dateFilter: dateRange
        },
        sqlQueries: [],
        fallbackStrategy: isTemporal ? null : "keyword_search"
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
          dateFilter: dateRange
        },
        sqlQueries: [
          {
            function: "get_top_emotions_with_entries",
            parameters: {
              user_id_param: "USER_ID_PLACEHOLDER",
              start_date: dateRange?.startDate || null,
              end_date: dateRange?.endDate || null,
              limit_count: 5
            },
            purpose: "Get top emotions with examples"
          }
        ],
        fallbackStrategy: isTemporal ? null : "emotion_based"
      }
    });
  }
  
  // IMPROVED: Enhanced mental health sub-question
  if (isMentalHealth) {
    subQuestions.push({
      question: isTemporal ? 
        "Find journal entries from the specified time period that relate to mental health, emotions, and well-being" :
        "Find journal entries that relate to mental health, emotions, challenges, and personal growth",
      purpose: "Gather personal context to provide tailored mental health advice",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.05,
          query: `mental health emotions feelings well-being challenges growth ${message}`,
          dateFilter: dateRange
        },
        sqlQueries: [
          {
            function: "get_top_emotions_with_entries",
            parameters: {
              user_id_param: "USER_ID_PLACEHOLDER",
              start_date: dateRange?.startDate || null,
              end_date: dateRange?.endDate || null,
              limit_count: 3
            },
            purpose: "Get recent emotional patterns for context"
          }
        ],
        fallbackStrategy: isTemporal ? null : "recent_entries"
      }
    });
  }
  
  // Always add a general search sub-question if no specific categories were detected
  if (!isPersonality && !isEmotion && !isMentalHealth) {
    subQuestions.push({
      question: isTemporal ? 
        "Find relevant journal entries from the specified time period" :
        "Find relevant journal entries related to the query",
      purpose: "Gather contextual information from journal entries",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.1,
          query: message,
          dateFilter: dateRange
        },
        sqlQueries: [],
        fallbackStrategy: isTemporal ? null : "recent_entries"
      }
    });
  }
  
  return subQuestions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, conversationContext = [], isFollowUp = false } = await req.json();

    console.log(`[Smart Query Planner] Analyzing query with enhanced temporal handling: "${message}"`);

    // Get user's journal entry count with timeout
    let entryCount = 0;
    try {
      const countController = new AbortController();
      const countTimeoutId = setTimeout(() => countController.abort(), 25000);
      
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .abortSignal(countController.signal);
        
      clearTimeout(countTimeoutId);
        
      if (!error && count !== null) {
        entryCount = count;
        console.log(`User ${userId} has ${entryCount} journal entries`);
      }
    } catch (error) {
      console.error("Error fetching entry count:", error);
    }

    // Use GPT to analyze the query with enhanced temporal awareness
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, entryCount);

    // Handle direct responses - but prefer journal analysis for mental health questions
    if (analysisResult.queryType === "general_question" && !analysisResult.isMentalHealthQuery) {
      return new Response(JSON.stringify({
        directResponse: "I'm SOULo, your voice journaling assistant. I can help you analyze your journal entries to understand emotions, patterns, and personal insights. What would you like to explore about your journaling journey?",
        plan: analysisResult
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (analysisResult.queryType === "direct_response") {
      return new Response(JSON.stringify({
        directResponse: "I can help you with that! Could you please provide more details about what you're looking for in your journal entries?",
        plan: analysisResult
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enhanced query plan with strict temporal constraints
    const enhancedPlan = {
      strategy: analysisResult.strategy,
      queryType: analysisResult.queryType,
      subQuestions: analysisResult.subQuestions,
      totalEntryCount: entryCount,
      confidence: analysisResult.confidence,
      reasoning: analysisResult.reasoning,
      expectedResponse: analysisResult.expectedResponse,
      isPersonalityQuery: analysisResult.isPersonalityQuery,
      isEmotionQuery: analysisResult.isEmotionQuery,
      isTemporalQuery: analysisResult.isTemporalQuery,
      isMentalHealthQuery: analysisResult.isMentalHealthQuery,
      hasDateConstraints: analysisResult.hasDateConstraints,
      dateRange: analysisResult.dateRange,
      domainContext: analysisResult.isPersonalityQuery ? "personal_insights" : 
                   analysisResult.isEmotionQuery ? "emotional_analysis" : 
                   analysisResult.isMentalHealthQuery ? "mental_health_guidance" : "general_insights"
    };

    console.log("Enhanced Query Plan with Temporal Constraints:", JSON.stringify(enhancedPlan, null, 2));

    return new Response(JSON.stringify({
      queryPlan: enhancedPlan,
      rawPlan: JSON.stringify({ plan: enhancedPlan })
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in smart-query-planner:", error);
    
    const fallbackPlan = {
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
      isErrorFallback: true
    };
    
    return new Response(JSON.stringify({
      queryPlan: fallbackPlan,
      rawPlan: JSON.stringify({ plan: fallbackPlan }),
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  }
});
