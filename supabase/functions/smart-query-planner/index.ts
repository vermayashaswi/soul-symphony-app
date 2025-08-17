
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  generateDatabaseSchemaContext, 
  getEmotionAnalysisGuidelines, 
  getThemeAnalysisGuidelines 
} from '../_shared/databaseSchemaContext.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding for vector searches
async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log(`[Embedding] Generating embedding for text length: ${text.length}`);

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000),
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Embedding] OpenAI API error:', errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.data || data.data.length === 0) {
    throw new Error('Empty embedding data received from OpenAI');
  }

  const embedding = data.data[0].embedding;
  
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding?.length}`);
  }

  console.log(`[Embedding] Successfully generated embedding with ${embedding.length} dimensions`);
  return embedding;
}

// Execute step using GPT-generated queries dynamically
async function executeAnalysisStep(step: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing step:`, step.step, step.description);

  try {
    let stepResult = [];

    if (step.queryType === 'vector_search') {
      console.log(`[${requestId}] Vector search:`, step.vectorSearch.query);
      
      // Generate embedding for vector search
      const embedding = await generateEmbedding(step.vectorSearch.query);
      
      // Use match_journal_entries RPC function with embedding
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: step.vectorSearch.threshold || 0.3,
        match_count: step.vectorSearch.limit || 10,
        user_id_filter: userId
      });

      if (error) {
        console.error(`[${requestId}] Vector search error:`, error);
        throw error;
      }

      stepResult = data || [];
      console.log(`[${requestId}] Vector search returned ${stepResult.length} results`);

    } else if (step.queryType === 'sql_analysis' || step.queryType === 'sql_count' || step.queryType === 'sql_calculation') {
      console.log(`[${requestId}] SQL analysis:`, step.sqlQuery);
      
      // Replace $user_id placeholder with actual user ID
      let processedQuery = step.sqlQuery.replace(/\$user_id/g, `'${userId}'`);
      
      // Execute dynamic SQL query using the RPC function
      const { data, error } = await supabaseClient.rpc('execute_dynamic_query', {
        query_text: processedQuery
      });

      if (error) {
        console.error(`[${requestId}] SQL execution error:`, error);
        throw error;
      }

      if (data && data.success) {
        stepResult = data.data || [];
      } else {
        console.error(`[${requestId}] SQL query failed:`, data?.error);
        throw new Error(data?.error || 'SQL query execution failed');
      }

      console.log(`[${requestId}] SQL analysis returned ${stepResult.length} results`);

    } else if (step.queryType === 'hybrid_search') {
      console.log(`[${requestId}] Hybrid search: Vector + SQL`);
      
      // Execute vector search
      const embedding = await generateEmbedding(step.vectorSearch.query);
      const { data: vectorData, error: vectorError } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: step.vectorSearch.threshold || 0.3,
        match_count: step.vectorSearch.limit || 5,
        user_id_filter: userId
      });

      let vectorResults = [];
      if (!vectorError && vectorData) {
        vectorResults = vectorData;
      }

      // Execute SQL query
      let processedQuery = step.sqlQuery.replace(/\$user_id/g, `'${userId}'`);
      const { data: sqlData, error: sqlError } = await supabaseClient.rpc('execute_dynamic_query', {
        query_text: processedQuery
      });

      let sqlResults = [];
      if (!sqlError && sqlData && sqlData.success) {
        sqlResults = sqlData.data || [];
      }

      // Combine results (simple concatenation, could be enhanced)
      stepResult = [...vectorResults, ...sqlResults];
      console.log(`[${requestId}] Hybrid search: ${vectorResults.length} vector + ${sqlResults.length} SQL = ${stepResult.length} total`);

    } else {
      console.warn(`[${requestId}] Unknown query type:`, step.queryType);
      throw new Error(`Unknown query type: ${step.queryType}`);
    }

    return stepResult;

  } catch (error) {
    console.error(`[${requestId}] Error executing step ${step.step}:`, error);
    throw error;
  }
}

// Execute the complete analysis plan
async function executePlan(plan: any, userId: string, supabaseClient: any, requestId: string) {
  console.log(`[${requestId}] Executing plan with ${plan.subQuestions?.length || 0} sub-questions`);

  const results = [];

  for (const subQuestion of plan.subQuestions || []) {
    console.log(`[${requestId}] Executing sub-question:`, subQuestion.question);

    const subResults = [];
    for (const step of subQuestion.analysisSteps || []) {
      try {
        const stepResult = await executeAnalysisStep(step, userId, supabaseClient, requestId);
        subResults.push({ 
          step: step.step, 
          result: stepResult,
          description: step.description,
          queryType: step.queryType
        });
      } catch (stepError) {
        console.error(`[${requestId}] Error executing step:`, step.step, stepError);
        subResults.push({ 
          step: step.step, 
          error: stepError.message,
          description: step.description,
          queryType: step.queryType
        });
      }
    }

    results.push({ 
      question: subQuestion.question, 
      purpose: subQuestion.purpose,
      results: subResults 
    });
  }

  console.log(`[${requestId}] Execution complete. Results:`, results.length, 'sub-questions processed');
  return results;
}

// Enhanced Analyst Agent with GPT-driven query generation
async function analyzeQueryWithSubQuestions(message: string, conversationContext: any[], userEntryCount: number, isFollowUp = false, supabaseClient: any, userTimezone = 'UTC') {
  try {
    const last = Array.isArray(conversationContext) ? conversationContext.slice(-5) : [];
    
    console.log(`[Analyst Agent] Processing query with user timezone: ${userTimezone}`);

    // Detect personal pronouns for personalized queries
    const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(message.toLowerCase());
    const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(message.toLowerCase());

    // Get database schema context
    const databaseSchemaContext = await generateDatabaseSchemaContext(supabaseClient);

    const contextString = last.length > 0 ? `
- Recent conversation context: ${last.map(m => `${m.sender}: ${m.content?.slice(0, 50) || 'N/A'}`).join(' | ')}` : '';

    const prompt = `You are SOULo's Analyst Agent - an intelligent query planning specialist for journal data analysis. Your role is to break down user queries into comprehensive, actionable analysis plans.

${databaseSchemaContext}

**CURRENT CONTEXT:**
- Today's date: ${new Date().toISOString()}
- User query: "${message}"
- User has ${userEntryCount} journal entries${contextString}

**YOUR RESPONSIBILITIES:**
1. Break down the query into 1-3 precise sub-questions
2. For each sub-question, create analysis steps using:
   - vector_search: For semantic content analysis
   - sql_analysis: For statistical analysis, counts, percentages
   - hybrid_search: Combine both when needed

**CRITICAL SQL REQUIREMENTS:**
- ALWAYS include WHERE user_id = $user_id (will be replaced with actual user ID)
- Use proper table name: "Journal Entries" (with quotes)
- For emotions: Use emotions JSONB column with jsonb_each() or -> operators
- For themes: Use master_themes array column
- For content: Use "refined text" or "transcription text" columns
- Generate COMPLETE, EXECUTABLE SQL queries

**MANDATORY OUTPUT STRUCTURE:**
{
  "queryType": "journal_specific",
  "strategy": "intelligent_sub_query",
  "userStatusMessage": "exactly 5 words describing analysis approach",
  "subQuestions": [
    {
      "question": "Specific focused sub-question",
      "purpose": "How this helps answer the main query",
      "searchStrategy": "sql_primary" | "vector_primary" | "hybrid",
      "executionStage": 1,
      "analysisSteps": [
        {
          "step": 1,
          "description": "Clear description of what this step accomplishes",
          "queryType": "sql_analysis" | "vector_search" | "hybrid_search",
          "sqlQuery": "COMPLETE SQL query with WHERE user_id = $user_id" | null,
          "vectorSearch": {
            "query": "optimized search query",
            "threshold": 0.3,
            "limit": 10
          } | null,
          "timeRange": { "start": "ISO string or null", "end": "ISO string or null" } | null
        }
      ]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Brief explanation of the analysis strategy"
}

**EXAMPLE SQL PATTERNS:**
- Emotion analysis: SELECT * FROM "Journal Entries" WHERE user_id = $user_id AND emotions ? 'happy'
- Theme analysis: SELECT * FROM "Journal Entries" WHERE user_id = $user_id AND 'work' = ANY(master_themes)
- Count queries: SELECT COUNT(*) as count FROM "Journal Entries" WHERE user_id = $user_id
- Date filtering: SELECT * FROM "Journal Entries" WHERE user_id = $user_id AND created_at >= '2024-01-01'

Generate a comprehensive analysis plan with COMPLETE, EXECUTABLE SQL queries.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Analyst Agent response:", data.choices[0].message.content);

    let analysisResult;
    try {
      analysisResult = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error("Failed to parse Analyst Agent response:", parseError);
      return createFallbackPlan(message, userTimezone);
    }

    if (!analysisResult || !analysisResult.subQuestions) {
      console.error("Invalid Analyst Agent response structure");
      return createFallbackPlan(message, userTimezone);
    }

    // Enhance with detected characteristics
    const finalResult = {
      ...analysisResult,
      hasPersonalPronouns,
      hasExplicitTimeReference,
      userTimezone
    };

    console.log("Final Analyst Plan:", JSON.stringify(finalResult, null, 2));
    return finalResult;

  } catch (error) {
    console.error("Error in Analyst Agent:", error);
    return createFallbackPlan(message, userTimezone);
  }
}

// Create fallback plan for errors
function createFallbackPlan(originalMessage: string, userTimezone = 'UTC') {
  const hasPersonalPronouns = /\b(i|me|my|mine|myself)\b/i.test(originalMessage.toLowerCase());
  const hasExplicitTimeReference = /\b(last week|yesterday|this week|last month|today|recently|lately|this morning|last night|august|january|february|march|april|may|june|july|september|october|november|december)\b/i.test(originalMessage.toLowerCase());

  return {
    queryType: "journal_specific",
    strategy: "intelligent_sub_query",
    userStatusMessage: "Using fallback analysis approach",
    subQuestions: [
      {
        question: `Analysis for: ${originalMessage}`,
        purpose: "Comprehensive analysis using vector search",
        searchStrategy: "vector_primary",
        executionStage: 1,
        analysisSteps: [
          {
            step: 1,
            description: "Vector search to find relevant journal entries",
            queryType: "vector_search",
            sqlQuery: null,
            vectorSearch: {
              query: originalMessage,
              threshold: 0.3,
              limit: 10
            },
            timeRange: null
          }
        ]
      }
    ],
    confidence: 0.7,
    reasoning: `Fallback plan for: "${originalMessage}". Using vector search for comprehensive analysis.`,
    hasPersonalPronouns,
    hasExplicitTimeReference,
    userTimezone
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { 
      message, 
      userId, 
      execute = true, 
      conversationContext = [], 
      timeRange = null, 
      threadId, 
      messageId, 
      isFollowUp = false, 
      userTimezone = 'UTC' 
    } = await req.json();

    const requestId = `planner_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`[REQUEST START] ${requestId}: {
  message: "${message}",
  userId: "${userId}",
  execute: ${execute},
  timestamp: "${new Date().toISOString()}",
  contextLength: ${conversationContext?.length || 0},
  timeRange: ${JSON.stringify(timeRange)},
  threadId: "${threadId}",
  messageId: ${messageId},
  isFollowUp: ${isFollowUp},
  userTimezone: "${userTimezone}"
}`);

    // Get user's journal entry count for context
    const { count: countData } = await supabaseClient
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const userEntryCount = countData || 0;
    console.log(`[${requestId}] User has ${userEntryCount} journal entries`);

    // Generate comprehensive analysis plan
    const analysisResult = await analyzeQueryWithSubQuestions(
      message, 
      conversationContext, 
      userEntryCount, 
      isFollowUp, 
      supabaseClient, 
      userTimezone
    );

    if (!execute) {
      // Return just the plan without execution
      return new Response(JSON.stringify({
        queryPlan: analysisResult,
        timestamp: new Date().toISOString(),
        requestId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute the plan and return results
    const executionResult = await executePlan(analysisResult, userId, supabaseClient, requestId);
    
    return new Response(JSON.stringify({
      queryPlan: analysisResult,
      executionResult,
      timestamp: new Date().toISOString(),
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart query planner:', error);
    return new Response(JSON.stringify({
      error: error.message,
      fallbackPlan: {
        queryType: "error_fallback",
        strategy: "vector_search",
        subQuestions: [{
          question: "Vector search fallback",
          searchStrategy: "vector_primary",
          analysisSteps: [{
            step: 1,
            queryType: "vector_search",
            vectorSearch: {
              query: "personal journal experiences thoughts feelings",
              threshold: 0.6,
              limit: 10
            },
            timeRange: null
          }]
        }],
        userTimezone: 'UTC'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
