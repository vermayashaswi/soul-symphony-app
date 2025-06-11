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

// Database context for intelligent planning with correct column references
const DATABASE_SCHEMA_CONTEXT = `
Available PostgreSQL Functions:
1. get_top_emotions_with_entries(user_id, start_date, end_date, limit_count) - Returns top emotions with sample entries
2. match_journal_entries_by_emotion(emotion_name, user_id, min_score, start_date, end_date, limit_count) - Find entries by specific emotion
3. match_journal_entries_by_theme(theme_query, user_id, match_threshold, match_count, start_date, end_date) - Find entries by theme
4. match_journal_entries_fixed(query_embedding, match_threshold, match_count, user_id) - Vector similarity search
5. match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id, start_date, end_date) - Vector search with date filter

Table Structure:
- Journal Entries: id, user_id, created_at, "refined text", "transcription text", emotions (jsonb), master_themes (array), themeemotion (jsonb), sentiment
- Emotions: Stored as jsonb with emotion names as keys and scores (0-1) as values
- Master Themes: Array of theme strings extracted from entries  
- Theme-Emotion Links: Stored in themeemotion column as jsonb with theme names as keys and emotion objects as values

Common Emotions: happy, sad, anxious, excited, calm, stressed, angry, peaceful, grateful, frustrated, hopeful, lonely
Common Themes: work, relationships, family, health, goals, travel, creativity, learning, challenges, growth

MANDATORY SEARCH STRATEGY:
- Use BOTH SQL and vector search unless confidence > 90% that only one method is needed
- Always prefer dual search approach for comprehensive results
- SQL provides structured data access (emotions, themes, theme-emotion relationships)
- Vector search provides semantic similarity and context understanding
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
 * Enhanced conversational query analysis with mandatory dual-search and 90% confidence threshold
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

    const prompt = `You are SOULo's intelligent query planner with MANDATORY dual-search requirements. Help me understand how to best answer this user's question using their journal data.

${DATABASE_SCHEMA_CONTEXT}

User query: "${message}"
User has ${userEntryCount} journal entries.${contextString}

**CRITICAL SEARCH REQUIREMENTS:**
- You MUST use BOTH SQL and vector search unless you have >90% confidence that only one method is sufficient
- SQL search provides: emotion filtering, theme filtering, theme-emotion relationship analysis
- Vector search provides: semantic similarity, context understanding, nuanced matching
- Default to dual search - only use single method if extremely confident (>90%)

**PERSONAL PRONOUN PRIORITY RULES:**
- Personal pronouns (I, me, my) WITHOUT time references → analyze ALL entries (useAllEntries: true)
- Personal pronouns WITH time references → respect the time constraint
- Questions like "How am I doing?" should use ALL entries for comprehensive insights
- Questions like "How was I last week?" should use date filters

**THEME-EMOTION ANALYSIS:**
- Use themeemotion column for theme-emotion relationship insights
- Filter by specific themes when mentioned in query
- Filter by emotions when emotional states are discussed
- Combine theme and emotion filters for complex relationship analysis

Return ONLY valid JSON:
{
  "queryType": "journal_specific" | "general_question" | "direct_response",
  "strategy": "intelligent_sub_query",
  "searchConfidence": number (0.0-1.0),
  "useOnlySQL": boolean (only if searchConfidence > 0.9),
  "useOnlyVector": boolean (only if searchConfidence > 0.9),
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
        "fallbackStrategy": null | "recent_entries" | "theme_based"
      }
    }
  ],
  "confidence": number,
  "reasoning": "brief explanation focusing on dual-search rationale",
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed",
  "useAllEntries": boolean,
  "hasPersonalPronouns": boolean,
  "hasExplicitTimeReference": boolean,
  "themeFilters": string[],
  "emotionFilters": string[]
}

Focus on creating a comprehensive dual-search analysis plan that leverages both SQL structured data and vector semantic understanding.`;

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
      console.error("Failed to parse GPT response, using enhanced fallback");
      return createEnhancedFallback(message, hasPersonalPronouns, hasExplicitTimeReference);
    }
    
    // Validate and enhance with dual-search enforcement
    const validatedResult = validateAndEnhanceDualSearch(analysisResult, message, hasPersonalPronouns, hasExplicitTimeReference);
    
    console.log("Final Analysis Result:", JSON.stringify(validatedResult, null, 2));
    return validatedResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    return createEnhancedFallback(message, false, false);
  }
}

/**
 * ENHANCED: Validate and enforce dual-search requirements with 90% confidence threshold
 */
function validateAndEnhanceDualSearch(analysis: any, message: string, hasPersonalPronouns: boolean, hasExplicitTimeReference: boolean) {
  const lowerMessage = message.toLowerCase();
  
  // Enhanced detection
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality|negative|positive|improve|rate|worst|best/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel|creative|learn|challenge|growth/.test(lowerMessage);
  const isTemporalQuery = hasExplicitTimeReference;
  
  // Extract themes and emotions from the query
  const themeFilters = extractThemeFilters(lowerMessage);
  const emotionFilters = extractEmotionFilters(lowerMessage);
  
  console.log("[Validation] Enhanced analysis:", {
    hasPersonalPronouns,
    hasExplicitTimeReference,
    isPersonalityQuery,
    isEmotionQuery,
    isThemeQuery,
    isTemporalQuery,
    themeFilters,
    emotionFilters
  });
  
  // CRITICAL: Determine if we should use all entries
  const useAllEntries = (hasPersonalPronouns && !hasExplicitTimeReference) || isPersonalityQuery;
  
  console.log(`[Validation] USE ALL ENTRIES: ${useAllEntries} (Personal pronouns: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference})`);
  
  // ENFORCE 90% CONFIDENCE THRESHOLD FOR SINGLE-METHOD SEARCH
  const searchConfidence = analysis.searchConfidence || 0.7;
  const mustUseDualSearch = searchConfidence <= 0.9;
  
  if (mustUseDualSearch) {
    console.log(`[Validation] ENFORCING DUAL SEARCH - Confidence: ${searchConfidence} <= 90%`);
    analysis.useOnlySQL = false;
    analysis.useOnlyVector = false;
  }
  
  // Ensure we have valid sub-questions
  if (!analysis.subQuestions || !Array.isArray(analysis.subQuestions) || analysis.subQuestions.length === 0) {
    analysis.subQuestions = createDefaultDualSearchSubQuestions(message, isPersonalityQuery, isEmotionQuery, isThemeQuery, isTemporalQuery, useAllEntries, themeFilters, emotionFilters);
  }
  
  // Validate and enhance each sub-question with dual-search enforcement
  analysis.subQuestions = analysis.subQuestions.map((subQ, index) => {
    if (!subQ.searchPlan) {
      subQ.searchPlan = {};
    }
    
    // ENFORCE DUAL SEARCH UNLESS HIGH CONFIDENCE
    if (mustUseDualSearch) {
      // Ensure vector search is enabled
      if (!subQ.searchPlan.vectorSearch) {
        subQ.searchPlan.vectorSearch = {
          enabled: true,
          threshold: isPersonalityQuery ? 0.01 : isEmotionQuery ? 0.05 : 0.1,
          query: subQ.question || message
        };
      } else {
        subQ.searchPlan.vectorSearch.enabled = true;
      }
      
      // Ensure SQL queries are present
      if (!subQ.searchPlan.sqlQueries || subQ.searchPlan.sqlQueries.length === 0) {
        subQ.searchPlan.sqlQueries = generateRequiredSQLQueries(isEmotionQuery, isThemeQuery, themeFilters, emotionFilters, useAllEntries);
      }
    }
    
    // Apply date range logic
    const dateRange = isTemporalQuery ? extractDateRangeFromQuery(message) : null;
    
    if (useAllEntries) {
      // Override: Remove date filters for personal pronoun queries without time references
      if (subQ.searchPlan.vectorSearch) {
        subQ.searchPlan.vectorSearch.dateFilter = null;
      }
      subQ.searchPlan.fallbackStrategy = "recent_entries";
      console.log(`[Validation] Removing date filter for personal query: ${subQ.question}`);
    } else if (isTemporalQuery && dateRange) {
      // Apply date filters for temporal queries
      if (subQ.searchPlan.vectorSearch) {
        subQ.searchPlan.vectorSearch.dateFilter = dateRange;
      }
      subQ.searchPlan.fallbackStrategy = null;
      console.log(`[Validation] Applying date filter: ${dateRange.startDate} to ${dateRange.endDate}`);
      
      // Update SQL queries to include date parameters
      if (subQ.searchPlan.sqlQueries) {
        subQ.searchPlan.sqlQueries = subQ.searchPlan.sqlQueries.map(sqlQuery => {
          if (sqlQuery.function === 'get_top_emotions_with_entries') {
            sqlQuery.parameters.start_date = dateRange.startDate;
            sqlQuery.parameters.end_date = dateRange.endDate;
          } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
            sqlQuery.parameters.start_date = dateRange.startDate;
            sqlQuery.parameters.end_date = dateRange.endDate;
          } else if (sqlQuery.function === 'match_journal_entries_by_theme') {
            sqlQuery.parameters.start_date = dateRange.startDate;
            sqlQuery.parameters.end_date = dateRange.endDate;
          }
          return sqlQuery;
        });
      }
    }
    
    return subQ;
  });
  
  const validated = {
    queryType: analysis.queryType || "journal_specific",
    strategy: "intelligent_sub_query",
    searchConfidence,
    useOnlySQL: !mustUseDualSearch && (analysis.useOnlySQL || false),
    useOnlyVector: !mustUseDualSearch && (analysis.useOnlyVector || false),
    subQuestions: analysis.subQuestions,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7,
    reasoning: `Enhanced dual-search planning ${mustUseDualSearch ? '(DUAL SEARCH ENFORCED)' : '(Single method allowed)'} - Confidence: ${searchConfidence}`,
    expectedResponse: analysis.expectedResponse || "analysis",
    useAllEntries,
    hasPersonalPronouns,
    hasExplicitTimeReference,
    themeFilters,
    emotionFilters,
    isPersonalityQuery,
    isEmotionQuery,
    isThemeQuery,
    isTemporalQuery,
    hasDateConstraints: isTemporalQuery && !!dateRange,
    dateRange: isTemporalQuery ? dateRange : null
  };
  
  console.log(`Generated ${validated.subQuestions.length} sub-questions - Dual search: ${mustUseDualSearch}, UseAllEntries: ${useAllEntries}`);
  
  return validated;
}

/**
 * Extract theme filters from user query
 */
function extractThemeFilters(lowerMessage: string): string[] {
  const commonThemes = ['work', 'relationship', 'family', 'health', 'goal', 'travel', 'creative', 'learn', 'challenge', 'growth'];
  return commonThemes.filter(theme => lowerMessage.includes(theme));
}

/**
 * Extract emotion filters from user query
 */
function extractEmotionFilters(lowerMessage: string): string[] {
  const commonEmotions = ['happy', 'sad', 'anxious', 'excited', 'calm', 'stressed', 'angry', 'peaceful', 'grateful', 'frustrated', 'hopeful', 'lonely'];
  return commonEmotions.filter(emotion => lowerMessage.includes(emotion));
}

/**
 * Generate required SQL queries for dual-search enforcement
 */
function generateRequiredSQLQueries(isEmotionQuery: boolean, isThemeQuery: boolean, themeFilters: string[], emotionFilters: string[], useAllEntries: boolean) {
  const sqlQueries = [];
  
  if (isEmotionQuery || emotionFilters.length > 0) {
    sqlQueries.push({
      function: "get_top_emotions_with_entries",
      parameters: {
        user_id_param: "USER_ID_PLACEHOLDER",
        start_date: useAllEntries ? null : null,
        end_date: useAllEntries ? null : null,
        limit_count: 5
      },
      purpose: "Get top emotions with examples for emotion-based analysis"
    });
  }
  
  if (isThemeQuery || themeFilters.length > 0) {
    sqlQueries.push({
      function: "match_journal_entries_by_theme",
      parameters: {
        theme_query: themeFilters[0] || "general",
        user_id_filter: "USER_ID_PLACEHOLDER",
        match_threshold: 0.3,
        match_count: 5,
        start_date: useAllEntries ? null : null,
        end_date: useAllEntries ? null : null
      },
      purpose: "Find entries matching theme patterns"
    });
  }
  
  return sqlQueries;
}

/**
 * Create default dual-search sub-questions
 */
function createDefaultDualSearchSubQuestions(message: string, isPersonality: boolean, isEmotion: boolean, isTheme: boolean, isTemporal: boolean, useAllEntries: boolean, themeFilters: string[], emotionFilters: string[]) {
  const subQuestions = [];
  
  console.log(`[Default Dual-Search] Creating for - Personal: ${isPersonality}, Emotion: ${isEmotion}, Theme: ${isTheme}, Temporal: ${isTemporal}, UseAllEntries: ${useAllEntries}`);
  
  // Always include vector search
  subQuestions.push({
    question: isTemporal ? 
      "Find relevant journal entries from the specified time period using semantic search" :
      (useAllEntries ? "Find all relevant journal entries for comprehensive semantic analysis" : "Find relevant journal entries using semantic search"),
    purpose: "Gather contextual information through semantic similarity",
    searchPlan: {
      vectorSearch: {
        enabled: true,
        threshold: isPersonality ? 0.01 : 0.05,
        query: message,
        dateFilter: useAllEntries ? null : null
      },
      sqlQueries: generateRequiredSQLQueries(isEmotion, isTheme, themeFilters, emotionFilters, useAllEntries),
      fallbackStrategy: useAllEntries ? "recent_entries" : (isTemporal ? null : "recent_entries")
    }
  });
  
  return subQuestions;
}

/**
 * Enhanced fallback with dual-search requirements
 */
function createEnhancedFallback(message: string, hasPersonalPronouns: boolean, hasExplicitTimeReference: boolean) {
  const lowerMessage = message.toLowerCase();
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isThemeQuery = /work|relationship|family|health|goal|travel|creative|learn|challenge|growth/.test(lowerMessage);
  
  console.log(`[Enhanced Fallback] Personal pronouns: ${hasPersonalPronouns}, Time ref: ${hasExplicitTimeReference}`);
  
  const subQuestion = {
    question: hasPersonalPronouns ? 
      (hasExplicitTimeReference ? 
        "Find journal entries from the specified time period for personal analysis using dual search" :
        "Find all journal entries for comprehensive personal analysis using dual search") :
      "Find relevant journal entries with enhanced dual search",
    purpose: hasPersonalPronouns ? 
      "Analyze personal patterns using both SQL structured data and semantic search" :
      "Gather relevant information using comprehensive search methods",
    searchPlan: {
      vectorSearch: {
        threshold: hasPersonalPronouns ? 0.01 : 0.05,
        enabled: true,
        dateFilter: (hasPersonalPronouns && !hasExplicitTimeReference) ? null : null
      },
      sqlQueries: [
        {
          function: "get_top_emotions_with_entries",
          parameters: {
            user_id_param: "USER_ID_PLACEHOLDER",
            start_date: (hasPersonalPronouns && !hasExplicitTimeReference) ? null : null,
            end_date: (hasPersonalPronouns && !hasExplicitTimeReference) ? null : null,
            limit_count: 5
          },
          purpose: "Get structured emotion data for comprehensive analysis"
        }
      ],
      fallbackStrategy: (hasExplicitTimeReference && !hasPersonalPronouns) ? null : "recent_entries"
    }
  };
  
  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    searchConfidence: 0.4,
    useOnlySQL: false,
    useOnlyVector: false,
    subQuestions: [subQuestion],
    confidence: 0.4,
    reasoning: hasPersonalPronouns ? 
      `Enhanced dual-search fallback with personal pronoun prioritization (useAllEntries: ${!hasExplicitTimeReference})` :
      (hasExplicitTimeReference ? "Enhanced temporal fallback with dual search" : "Emergency dual-search fallback"),
    isTemporalQuery: hasExplicitTimeReference,
    isEmotionQuery,
    isThemeQuery,
    hasDateConstraints: !!hasExplicitTimeReference,
    useAllEntries: hasPersonalPronouns && !hasExplicitTimeReference,
    hasPersonalPronouns,
    hasExplicitTimeReference,
    themeFilters: [],
    emotionFilters: []
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
