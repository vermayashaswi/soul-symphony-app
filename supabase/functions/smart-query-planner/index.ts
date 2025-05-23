
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
 * Enhanced JSON extraction that handles markdown wrapping and malformed responses
 */
function extractAndParseJSON(content: string): any {
  try {
    // First try direct parsing
    return JSON.parse(content);
  } catch (error) {
    console.log("Direct JSON parse failed, trying extraction methods");
    
    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1]);
      } catch (e) {
        console.log("JSON block extraction failed");
      }
    }
    
    // Try to find JSON within the text (look for { ... })
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.log("JSON pattern extraction failed");
      }
    }
    
    // If all else fails, return null
    console.error("All JSON extraction methods failed for content:", content.substring(0, 200));
    return null;
  }
}

/**
 * Intelligent query analysis using GPT with enhanced error handling
 */
async function analyzeQueryWithGPT(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const prompt = `You are an intelligent query analyzer for a voice journaling app called SOULo. Analyze this user query and determine the optimal search and response strategy.

User query: "${message}"
User has ${userEntryCount} journal entries available.${contextString}

IMPORTANT: Respond with ONLY a valid JSON object, no markdown formatting, no explanations.

{
  "queryType": "journal_specific" | "general_question" | "direct_response",
  "strategy": "vector_only" | "sql_only" | "hybrid" | "comprehensive" | "direct",
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
    "fallbackStrategy": "recent_entries" | "emotion_based" | "comprehensive" | null
  },
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed" | "insufficient_data",
  "reasoning": "brief explanation"
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Lower temperature for more consistent JSON
        max_tokens: 800,
      })
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text());
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
    
    console.log("GPT Query Analysis Result:", JSON.stringify(analysisResult, null, 2));
    return analysisResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    return createFallbackAnalysis(message);
  }
}

/**
 * Create fallback analysis when GPT fails
 */
function createFallbackAnalysis(message: string) {
  const lowerMessage = message.toLowerCase();
  
  return {
    queryType: "journal_specific",
    strategy: "hybrid",
    requiresJournalData: true,
    isPersonalityQuery: lowerMessage.includes('trait') || lowerMessage.includes('personality') || lowerMessage.includes('character'),
    isEmotionQuery: lowerMessage.includes('emotion') || lowerMessage.includes('feel') || lowerMessage.includes('mood'),
    isTemporalQuery: lowerMessage.includes('last week') || lowerMessage.includes('yesterday') || lowerMessage.includes('today'),
    isPatternAnalysis: lowerMessage.includes('pattern') || lowerMessage.includes('often') || lowerMessage.includes('usually'),
    confidence: 0.6,
    searchParameters: {
      vectorThreshold: 0.3,
      useEmotionSQL: true,
      useThemeSQL: false,
      dateRange: null,
      fallbackStrategy: "recent_entries"
    },
    expectedResponse: "analysis",
    reasoning: "Fallback analysis due to GPT error"
  };
}

/**
 * Generate SQL queries for emotion/theme analysis with timeout
 */
async function generateSQLQueries(message: string, userId: string, analysisResult: any) {
  if (!analysisResult.searchParameters.useEmotionSQL && !analysisResult.searchParameters.useThemeSQL) {
    return { shouldExecute: false, emotionQueries: [] };
  }

  try {
    const prompt = `Generate SQL function calls for this query: "${message}"

Available functions:
- get_top_emotions_with_entries(user_id, start_date, end_date, limit_count)
- match_journal_entries_by_emotion(emotion_name, user_id, min_score, start_date, end_date, limit_count)

Respond with ONLY valid JSON:
{
  "emotionQueries": [
    {
      "function": "function_name",
      "parameters": {...},
      "purpose": "description"
    }
  ],
  "shouldExecute": boolean
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
        max_tokens: 400,
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

    // Get user's journal entry count with timeout
    let entryCount = 0;
    try {
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (!error && count !== null) {
        entryCount = count;
        console.log(`User ${userId} has ${entryCount} journal entries`);
      }
    } catch (error) {
      console.error("Error fetching entry count:", error);
    }

    // Use GPT to analyze the query intelligently
    const analysisResult = await analyzeQueryWithGPT(message, conversationContext, entryCount);

    // If it's a general question or direct response, return immediately
    if (analysisResult.queryType === "general_question") {
      return new Response(JSON.stringify({
        directResponse: "I'm SOULo, your voice journaling assistant. I can help you analyze your journal entries to understand emotions, patterns, and personal insights. For general mental health questions, I can provide guidance, but for personalized insights, I'd need to analyze your journal entries. What would you like to explore about your journaling journey?",
        plan: analysisResult
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (analysisResult.queryType === "direct_response") {
      return new Response(JSON.stringify({
        directResponse: "I can help you with that! However, I'd need more specific information to provide an accurate answer. Could you please provide more details about what you're looking for?",
        plan: analysisResult
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate SQL queries if needed
    let sqlPlan = null;
    if (analysisResult.searchParameters.useEmotionSQL || analysisResult.searchParameters.useThemeSQL) {
      sqlPlan = await generateSQLQueries(message, userId, analysisResult);
    }

    // Enhanced query plan with GPT intelligence
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
      fallbackStrategy: analysisResult.searchParameters.fallbackStrategy
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
    
    // Fallback plan
    const fallbackPlan = {
      strategy: "hybrid",
      queryType: "journal_specific",
      requiresJournalData: true,
      searchParameters: {
        vectorThreshold: 0.3,
        useEmotionSQL: false,
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
      reasoning: "Fallback plan due to error",
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
