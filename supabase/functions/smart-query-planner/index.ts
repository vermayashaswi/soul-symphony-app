
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

/**
 * Enhanced JSON extraction with multiple fallback methods
 */
function extractAndParseJSON(content: string): any {
  try {
    // First try direct parsing
    return JSON.parse(content);
  } catch (error) {
    console.log("Direct JSON parse failed, trying extraction methods");
    
    let cleanedContent = content.trim();
    
    // Remove common markdown or explanation text more aggressively
    cleanedContent = cleanedContent.replace(/^[^{]*/, ''); // Remove everything before first {
    cleanedContent = cleanedContent.replace(/[^}]*$/, '}'); // Keep everything until last }
    
    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1].trim());
      } catch (e) {
        console.log("JSON block extraction failed");
      }
    }
    
    // Try to find JSON within the text (look for { ... })
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonText = jsonMatch[0];
        
        // Clean up common JSON formatting issues
        jsonText = jsonText.replace(/,\s*\}/g, '}'); // Remove trailing commas
        jsonText = jsonText.replace(/,\s*\]/g, ']'); // Remove trailing commas in arrays
        jsonText = jsonText.replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Add quotes to unquoted keys
        
        return JSON.parse(jsonText);
      } catch (e) {
        console.log("JSON pattern extraction failed");
      }
    }
    
    // Create a basic valid response as final fallback
    console.error("All JSON extraction methods failed, using emergency fallback");
    return createEmergencyFallback(content);
  }
}

/**
 * Create emergency fallback when all JSON parsing fails
 */
function createEmergencyFallback(originalContent: string): any {
  const lowerContent = originalContent.toLowerCase();
  
  return {
    queryType: "journal_specific",
    strategy: "hybrid",
    requiresJournalData: true,
    isPersonalityQuery: /personality|trait|character|behavior/.test(lowerContent),
    isEmotionQuery: /emotion|feel|mood|happy|sad|anxious/.test(lowerContent),
    isTemporalQuery: /last week|yesterday|today|recently/.test(lowerContent),
    isPatternAnalysis: /pattern|often|usually|tend/.test(lowerContent),
    confidence: 0.3,
    searchParameters: {
      vectorThreshold: 0.1, // Always use very low threshold for emergency fallback
      useEmotionSQL: true,
      useThemeSQL: false,
      dateRange: null,
      fallbackStrategy: "recent_entries"
    },
    expectedResponse: "analysis",
    reasoning: "Emergency fallback due to JSON parsing failure"
  };
}

/**
 * Intelligent query analysis with reduced timeouts and better error handling
 */
async function analyzeQueryWithGPT(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const prompt = `Analyze this user query for a voice journaling app called SOULo and return ONLY valid JSON:

User query: "${message}"
User has ${userEntryCount} journal entries.${contextString}

Return JSON with these exact fields:
{
  "queryType": "journal_specific" | "general_question" | "direct_response",
  "strategy": "vector_only" | "sql_only" | "hybrid" | "comprehensive",
  "requiresJournalData": boolean,
  "isPersonalityQuery": boolean,
  "isEmotionQuery": boolean,
  "isTemporalQuery": boolean,
  "isPatternAnalysis": boolean,
  "confidence": number,
  "searchParameters": {
    "vectorThreshold": number,
    "useEmotionSQL": boolean,
    "useThemeSQL": boolean,
    "dateRange": object | null,
    "fallbackStrategy": "recent_entries" | "emotion_based" | "comprehensive"
  },
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed",
  "reasoning": "brief explanation"
}

CRITICAL: Use vectorThreshold between 0.05-0.3 ONLY. Lower values find more results.`;

    // Reduced timeout significantly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced from 8s to 5s

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 400, // Further reduced
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      throw new Error(`OpenAI API returned error ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message?.content || '{}';
    
    console.log("Raw GPT response:", content);
    
    const analysisResult = extractAndParseJSON(content);
    
    if (!analysisResult) {
      console.error("Failed to parse GPT response, using fallback");
      return createFallbackAnalysis(message);
    }
    
    // Force lower thresholds and validate
    const validatedResult = validateAndFixAnalysis(analysisResult, message);
    
    console.log("Final Analysis Result:", JSON.stringify(validatedResult, null, 2));
    return validatedResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    return createFallbackAnalysis(message);
  }
}

/**
 * Validate and fix analysis result with aggressive threshold capping
 */
function validateAndFixAnalysis(analysis: any, message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Detect query characteristics
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isTemporalQuery = /last week|yesterday|today|this month|recently/.test(lowerMessage);
  
  // Force very low thresholds based on query type
  let vectorThreshold = 0.2; // Default
  if (isPersonalityQuery) {
    vectorThreshold = 0.05; // Extremely low for personality
  } else if (isEmotionQuery) {
    vectorThreshold = 0.1; // Very low for emotions
  } else if (isTemporalQuery) {
    vectorThreshold = 0.15; // Low for temporal queries
  }
  
  // Cap any threshold above 0.3 to prevent no results
  if (analysis.searchParameters?.vectorThreshold > 0.3) {
    console.warn(`Capping high threshold ${analysis.searchParameters.vectorThreshold} to ${vectorThreshold}`);
  }
  
  const validated = {
    queryType: analysis.queryType || "journal_specific",
    strategy: analysis.strategy || "hybrid",
    requiresJournalData: analysis.requiresJournalData !== false,
    isPersonalityQuery: isPersonalityQuery || analysis.isPersonalityQuery || false,
    isEmotionQuery: isEmotionQuery || analysis.isEmotionQuery || false,
    isTemporalQuery: isTemporalQuery || analysis.isTemporalQuery || false,
    isPatternAnalysis: analysis.isPatternAnalysis || /pattern|often|usually|tend/.test(lowerMessage),
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7,
    searchParameters: {
      vectorThreshold: vectorThreshold, // Use our calculated threshold
      useEmotionSQL: isEmotionQuery || isPersonalityQuery || analysis.searchParameters?.useEmotionSQL || false,
      useThemeSQL: analysis.searchParameters?.useThemeSQL || false,
      dateRange: analysis.searchParameters?.dateRange || null,
      fallbackStrategy: analysis.searchParameters?.fallbackStrategy || "recent_entries"
    },
    expectedResponse: analysis.expectedResponse || "analysis",
    reasoning: analysis.reasoning || `Analysis with optimized threshold ${vectorThreshold}`
  };
  
  console.log(`Applied threshold ${vectorThreshold} for query type - Personality: ${isPersonalityQuery}, Emotion: ${isEmotionQuery}, Temporal: ${isTemporalQuery}`);
  
  return validated;
}

/**
 * Create fallback analysis when GPT fails
 */
function createFallbackAnalysis(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed/.test(lowerMessage);
  const isTemporalQuery = /last week|yesterday|today|this month|recently/.test(lowerMessage);
  
  // Use very aggressive low thresholds for fallback
  let threshold = 0.1;
  if (isPersonalityQuery) threshold = 0.05;
  if (isEmotionQuery) threshold = 0.08;
  
  return {
    queryType: "journal_specific",
    strategy: "hybrid",
    requiresJournalData: true,
    isPersonalityQuery,
    isEmotionQuery,
    isTemporalQuery,
    isPatternAnalysis: /pattern|often|usually|tend/.test(lowerMessage),
    confidence: 0.5,
    searchParameters: {
      vectorThreshold: threshold,
      useEmotionSQL: isEmotionQuery || isPersonalityQuery,
      useThemeSQL: false,
      dateRange: null,
      fallbackStrategy: "recent_entries"
    },
    expectedResponse: "analysis",
    reasoning: `Fallback analysis with threshold ${threshold}`
  };
}

/**
 * Generate SQL queries with reduced timeout
 */
async function generateSQLQueries(message: string, userId: string, analysisResult: any) {
  if (!analysisResult.searchParameters.useEmotionSQL && !analysisResult.searchParameters.useThemeSQL) {
    return { shouldExecute: false, emotionQueries: [] };
  }

  try {
    const prompt = `Generate SQL function calls for: "${message}"

Available functions:
- get_top_emotions_with_entries(user_id, start_date, end_date, limit_count)
- match_journal_entries_by_emotion(emotion_name, user_id, min_score, start_date, end_date, limit_count)

Return JSON:
{
  "emotionQueries": [{"function": "function_name", "parameters": {...}, "purpose": "description"}],
  "shouldExecute": boolean
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced to 3s

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message?.content || '{"shouldExecute": false}';
    
    const sqlPlan = extractAndParseJSON(content);
    
    if (!sqlPlan) {
      return { shouldExecute: false, emotionQueries: [] };
    }
    
    console.log("Generated SQL Plan:", JSON.stringify(sqlPlan, null, 2));
    return sqlPlan;

  } catch (error) {
    console.error("Error generating SQL queries:", error);
    return { shouldExecute: false, emotionQueries: [] };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, conversationContext = [], isFollowUp = false } = await req.json();

    console.log(`[Smart Query Planner] Analyzing query: "${message}"`);

    // Get user's journal entry count with shorter timeout
    let entryCount = 0;
    try {
      const countController = new AbortController();
      const countTimeoutId = setTimeout(() => countController.abort(), 1500); // Reduced to 1.5s
      
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      clearTimeout(countTimeoutId);
        
      if (!error && count !== null) {
        entryCount = count;
        console.log(`User ${userId} has ${entryCount} journal entries`);
      }
    } catch (error) {
      console.error("Error fetching entry count:", error);
      // Continue without count
    }

    // Use GPT to analyze the query intelligently
    const analysisResult = await analyzeQueryWithGPT(message, conversationContext, entryCount);

    // Handle direct responses with better messaging
    if (analysisResult.queryType === "general_question") {
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

    // Generate SQL queries if needed with reduced timeout
    let sqlPlan = null;
    if (analysisResult.searchParameters.useEmotionSQL || analysisResult.searchParameters.useThemeSQL) {
      sqlPlan = await generateSQLQueries(message, userId, analysisResult);
    }

    // Enhanced query plan with optimized settings
    const enhancedPlan = {
      strategy: analysisResult.strategy,
      queryType: analysisResult.queryType,
      requiresJournalData: analysisResult.requiresJournalData,
      searchParameters: {
        ...analysisResult.searchParameters,
        sqlQueries: sqlPlan?.emotionQueries || [],
        executeSQLQueries: sqlPlan?.shouldExecute || false
      },
      filters: {
        date_range: analysisResult.searchParameters.dateRange,
        emotions: null,
        themes: null
      },
      isTimePatternQuery: analysisResult.isTemporalQuery,
      needsDataAggregation: analysisResult.isPatternAnalysis,
      domainContext: analysisResult.isPersonalityQuery ? "personal_insights" : 
                   analysisResult.isEmotionQuery ? "emotional_analysis" : "general_insights",
      isTimeSummaryQuery: analysisResult.isTemporalQuery,
      needsComprehensiveAnalysis: analysisResult.isPersonalityQuery || analysisResult.isPatternAnalysis,
      totalEntryCount: entryCount,
      confidence: analysisResult.confidence,
      reasoning: analysisResult.reasoning,
      expectedResponse: analysisResult.expectedResponse,
      fallbackStrategy: analysisResult.searchParameters.fallbackStrategy,
      isPersonalityQuery: analysisResult.isPersonalityQuery,
      isEmotionQuery: analysisResult.isEmotionQuery
    };

    console.log("Enhanced Query Plan:", JSON.stringify(enhancedPlan, null, 2));

    return new Response(JSON.stringify({
      queryPlan: enhancedPlan,
      rawPlan: JSON.stringify({ plan: enhancedPlan })
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in smart-query-planner:", error);
    
    // Better fallback plan with very low threshold
    const fallbackPlan = {
      strategy: "hybrid",
      queryType: "journal_specific",
      requiresJournalData: true,
      searchParameters: {
        vectorThreshold: 0.05, // Extremely low for fallback
        useEmotionSQL: true,
        useThemeSQL: false,
        dateRange: null,
        fallbackStrategy: "recent_entries",
        sqlQueries: [],
        executeSQLQueries: false
      },
      filters: { date_range: null, emotions: null, themes: null },
      isTimePatternQuery: false,
      needsDataAggregation: false,
      domainContext: "general_insights",
      isTimeSummaryQuery: false,
      needsComprehensiveAnalysis: false,
      totalEntryCount: 0,
      confidence: 0.3,
      reasoning: "Emergency fallback plan with ultra-low threshold",
      expectedResponse: "analysis",
      fallbackStrategy: "recent_entries",
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
