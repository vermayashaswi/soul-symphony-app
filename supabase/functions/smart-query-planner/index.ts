
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
 * Intelligent query analysis using GPT
 */
async function analyzeQueryWithGPT(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const prompt = `You are an intelligent query analyzer for a voice journaling app called SOULo. Analyze this user query and determine the optimal search and response strategy.

User query: "${message}"
User has ${userEntryCount} journal entries available.${contextString}

Database schema available:
- Journal Entries table: contains transcription text, refined text, emotions (jsonb), master_themes (array), sentiment, entities, created_at
- Emotions are stored as JSON objects with emotion names as keys and confidence scores (0-1) as values
- Vector embeddings are available for semantic search
- SQL queries can access emotions, themes, sentiment, and date ranges

Analyze this query and return a JSON response with this exact structure:
{
  "queryType": "journal_specific" | "general_question" | "direct_response",
  "strategy": "vector_only" | "sql_only" | "hybrid" | "comprehensive" | "direct",
  "requiresJournalData": boolean,
  "isPersonalityQuery": boolean,
  "isEmotionQuery": boolean,
  "isTemporalQuery": boolean,
  "isPatternAnalysis": boolean,
  "confidence": number (0-1),
  "searchParameters": {
    "vectorThreshold": number (0.1-0.8),
    "useEmotionSQL": boolean,
    "useThemeSQL": boolean,
    "dateRange": object | null,
    "fallbackStrategy": "recent_entries" | "emotion_based" | "comprehensive" | null
  },
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed" | "insufficient_data",
  "reasoning": "brief explanation of the analysis"
}

Guidelines:
- "journal_specific" queries need journal data analysis
- "general_question" queries about journaling/mental health concepts don't need personal data
- "direct_response" queries ask for dates, facts, or app features
- Personality queries (traits, characteristics) need comprehensive analysis with low vector threshold (0.1-0.2)
- Emotion queries benefit from SQL emotion table searches + vector search
- Pattern analysis needs comprehensive data analysis
- Set lower thresholds (0.1-0.3) for complex analysis queries
- Set higher thresholds (0.5-0.7) for specific content searches`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      })
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text());
      throw new Error(`OpenAI API returned error ${response.status}`);
    }

    const data = await response.json();
    const analysisResult = JSON.parse(data.choices[0].message?.content || '{}');
    
    console.log("GPT Query Analysis Result:", JSON.stringify(analysisResult, null, 2));
    return analysisResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    // Return fallback analysis
    return {
      queryType: "journal_specific",
      strategy: "hybrid",
      requiresJournalData: true,
      isPersonalityQuery: message.toLowerCase().includes('trait') || message.toLowerCase().includes('personality'),
      isEmotionQuery: message.toLowerCase().includes('emotion') || message.toLowerCase().includes('feel'),
      isTemporalQuery: false,
      isPatternAnalysis: message.toLowerCase().includes('pattern') || message.toLowerCase().includes('often'),
      confidence: 0.5,
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
}

/**
 * Generate SQL queries for emotion/theme analysis
 */
async function generateSQLQueries(message: string, userId: string, analysisResult: any) {
  if (!analysisResult.searchParameters.useEmotionSQL && !analysisResult.searchParameters.useThemeSQL) {
    return null;
  }

  try {
    const prompt = `Based on this query analysis, generate SQL queries to extract relevant journal data.

User Query: "${message}"
Analysis: ${JSON.stringify(analysisResult, null, 2)}
User ID: ${userId}

Available functions:
- get_top_emotions(user_id, start_date, end_date, limit_count)
- get_top_emotions_with_entries(user_id, start_date, end_date, limit_count)  
- match_journal_entries_by_emotion(emotion_name, user_id, min_score, start_date, end_date, limit_count)

Generate appropriate SQL function calls and return as JSON:
{
  "emotionQueries": [
    {
      "function": "function_name",
      "parameters": {...},
      "purpose": "what this query will find"
    }
  ],
  "shouldExecute": boolean
}

For personality/trait analysis, use get_top_emotions_with_entries to get comprehensive emotion data.
For specific emotion queries, use match_journal_entries_by_emotion.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const sqlPlan = JSON.parse(data.choices[0].message?.content || '{"shouldExecute": false}');
    
    console.log("Generated SQL Plan:", JSON.stringify(sqlPlan, null, 2));
    return sqlPlan;

  } catch (error) {
    console.error("Error generating SQL queries:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, conversationContext = [], isFollowUp = false } = await req.json();

    console.log(`[Smart Query Planner] Analyzing query: "${message}"`);

    // Get user's journal entry count
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
