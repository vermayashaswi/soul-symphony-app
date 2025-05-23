
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
 * Enhanced JSON extraction with multiple fallback methods
 */
function extractAndParseJSON(content: string): any {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.log("Direct JSON parse failed, trying extraction methods");
    
    let cleanedContent = content.trim();
    cleanedContent = cleanedContent.replace(/^[^{]*/, '');
    cleanedContent = cleanedContent.replace(/[^}]*$/, '}');
    
    const jsonBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1].trim());
      } catch (e) {
        console.log("JSON block extraction failed");
      }
    }
    
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
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
    strategy: "intelligent_sub_query",
    subQuestions: [
      {
        question: "Find relevant journal entries",
        searchPlan: {
          vectorSearch: {
            threshold: 0.1,
            enabled: true
          },
          sqlQueries: [],
          fallbackStrategy: "recent_entries"
        }
      }
    ],
    confidence: 0.3,
    reasoning: "Emergency fallback due to JSON parsing failure"
  };
}

/**
 * Intelligent query analysis with sub-question generation
 */
async function analyzeQueryWithSubQuestions(message: string, conversationContext: any[], userEntryCount: number) {
  try {
    const contextString = conversationContext.length > 0 
      ? `\nConversation context: ${conversationContext.slice(-2).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    const prompt = `You are an intelligent query planner for a voice journaling app called SOULo. Your task is to break down user queries into executable sub-questions with detailed search plans.

${DATABASE_SCHEMA_CONTEXT}

User query: "${message}"
User has ${userEntryCount} journal entries.${contextString}

Break this query into 2-4 strategic sub-questions that will help answer the original query. For each sub-question, create a detailed search plan.

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
          "threshold": number (0.05-0.3),
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
        "fallbackStrategy": "recent_entries" | "emotion_based" | "theme_based"
      }
    }
  ],
  "confidence": number,
  "reasoning": "brief explanation of the approach",
  "expectedResponse": "analysis" | "direct_answer" | "clarification_needed"
}

Guidelines:
- Use vector thresholds between 0.05-0.2 for personality/emotion queries
- Use 0.1-0.3 for general queries
- Include SQL queries when specific emotions or patterns are mentioned
- Each sub-question should target a specific aspect of the main query
- Combine different search approaches for comprehensive results`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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
        max_tokens: 800,
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
    
    // Validate and enhance the sub-questions
    const validatedResult = validateAndEnhanceSubQuestions(analysisResult, message);
    
    console.log("Final Analysis Result:", JSON.stringify(validatedResult, null, 2));
    return validatedResult;

  } catch (error) {
    console.error("Error in GPT query analysis:", error);
    return createFallbackAnalysis(message);
  }
}

/**
 * Validate and enhance sub-questions with better defaults
 */
function validateAndEnhanceSubQuestions(analysis: any, message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Detect query characteristics
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i|my personality/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed|emotional/.test(lowerMessage);
  const isTemporalQuery = /last week|yesterday|today|this month|recently/.test(lowerMessage);
  
  // Ensure we have valid sub-questions
  if (!analysis.subQuestions || !Array.isArray(analysis.subQuestions) || analysis.subQuestions.length === 0) {
    analysis.subQuestions = createDefaultSubQuestions(message, isPersonalityQuery, isEmotionQuery, isTemporalQuery);
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
        threshold: isPersonalityQuery ? 0.05 : isEmotionQuery ? 0.1 : 0.15,
        query: subQ.question || message
      };
    }
    
    // Cap thresholds
    if (subQ.searchPlan.vectorSearch.threshold > 0.3) {
      subQ.searchPlan.vectorSearch.threshold = 0.2;
    }
    
    // Ensure SQL queries array
    if (!subQ.searchPlan.sqlQueries) {
      subQ.searchPlan.sqlQueries = [];
    }
    
    // Add relevant SQL queries based on query type
    if (isEmotionQuery && subQ.searchPlan.sqlQueries.length === 0) {
      subQ.searchPlan.sqlQueries.push({
        function: "get_top_emotions_with_entries",
        parameters: {
          user_id_param: "USER_ID_PLACEHOLDER",
          limit_count: 5
        },
        purpose: "Get top emotions with sample entries"
      });
    }
    
    // Ensure fallback strategy
    if (!subQ.searchPlan.fallbackStrategy) {
      subQ.searchPlan.fallbackStrategy = "recent_entries";
    }
    
    return subQ;
  });
  
  const validated = {
    queryType: analysis.queryType || "journal_specific",
    strategy: "intelligent_sub_query",
    subQuestions: analysis.subQuestions,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7,
    reasoning: analysis.reasoning || "Sub-query planning with optimized search strategies",
    expectedResponse: analysis.expectedResponse || "analysis",
    isPersonalityQuery,
    isEmotionQuery,
    isTemporalQuery
  };
  
  console.log(`Generated ${validated.subQuestions.length} sub-questions for query type - Personality: ${isPersonalityQuery}, Emotion: ${isEmotionQuery}, Temporal: ${isTemporalQuery}`);
  
  return validated;
}

/**
 * Create default sub-questions when GPT fails to generate them
 */
function createDefaultSubQuestions(message: string, isPersonality: boolean, isEmotion: boolean, isTemporal: boolean) {
  const subQuestions = [];
  
  if (isPersonality) {
    subQuestions.push({
      question: "Find entries that reveal personality patterns and behaviors",
      purpose: "Identify behavioral patterns and personality traits",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.05,
          query: message
        },
        sqlQueries: [],
        fallbackStrategy: "recent_entries"
      }
    });
  }
  
  if (isEmotion) {
    subQuestions.push({
      question: "Analyze emotional patterns and triggers",
      purpose: "Understand emotional states and their contexts",
      searchPlan: {
        vectorSearch: {
          enabled: true,
          threshold: 0.1,
          query: message
        },
        sqlQueries: [
          {
            function: "get_top_emotions_with_entries",
            parameters: {
              user_id_param: "USER_ID_PLACEHOLDER",
              limit_count: 5
            },
            purpose: "Get top emotions with examples"
          }
        ],
        fallbackStrategy: "emotion_based"
      }
    });
  }
  
  // Always add a general search sub-question
  subQuestions.push({
    question: "Find relevant journal entries related to the query",
    purpose: "Gather contextual information from journal entries",
    searchPlan: {
      vectorSearch: {
        enabled: true,
        threshold: 0.15,
        query: message
      },
      sqlQueries: [],
      fallbackStrategy: "recent_entries"
    }
  });
  
  return subQuestions;
}

/**
 * Create fallback analysis when GPT fails
 */
function createFallbackAnalysis(message: string) {
  const lowerMessage = message.toLowerCase();
  
  const isPersonalityQuery = /trait|personality|character|behavior|habit|am i|do i/.test(lowerMessage);
  const isEmotionQuery = /emotion|feel|mood|happy|sad|anxious|stressed/.test(lowerMessage);
  const isTemporalQuery = /last week|yesterday|today|this month|recently/.test(lowerMessage);
  
  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    subQuestions: createDefaultSubQuestions(message, isPersonalityQuery, isEmotionQuery, isTemporalQuery),
    confidence: 0.5,
    reasoning: "Fallback analysis with default sub-questions",
    expectedResponse: "analysis",
    isPersonalityQuery,
    isEmotionQuery,
    isTemporalQuery
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, conversationContext = [], isFollowUp = false } = await req.json();

    console.log(`[Smart Query Planner] Analyzing query with sub-questions: "${message}"`);

    // Get user's journal entry count
    let entryCount = 0;
    try {
      const countController = new AbortController();
      const countTimeoutId = setTimeout(() => countController.abort(), 1500);
      
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
    }

    // Use GPT to analyze the query and generate sub-questions
    const analysisResult = await analyzeQueryWithSubQuestions(message, conversationContext, entryCount);

    // Handle direct responses
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

    // Enhanced query plan with sub-questions
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
      domainContext: analysisResult.isPersonalityQuery ? "personal_insights" : 
                   analysisResult.isEmotionQuery ? "emotional_analysis" : "general_insights"
    };

    console.log("Enhanced Query Plan with Sub-Questions:", JSON.stringify(enhancedPlan, null, 2));

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
          question: "Find relevant journal entries",
          searchPlan: {
            vectorSearch: {
              enabled: true,
              threshold: 0.05
            },
            sqlQueries: [],
            fallbackStrategy: "recent_entries"
          }
        }
      ],
      totalEntryCount: 0,
      confidence: 0.3,
      reasoning: "Emergency fallback plan",
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
