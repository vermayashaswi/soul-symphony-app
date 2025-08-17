
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { validateSQL, SQL_TEMPLATES, substituteTemplate } from './utils/sqlValidation.ts';
import { executeWithFallback } from './utils/queryFallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Drastically simplified system prompt focusing only on critical patterns
const SIMPLIFIED_SYSTEM_PROMPT = `You are a journal query planner. Generate intelligent sub-queries for journal analysis.

CRITICAL JSONB RULES (NEVER VIOLATE):
1. ALWAYS use jsonb_each() for emotions: jsonb_each(emotions) as em(emotion_key, emotion_value)
2. ALWAYS use jsonb_each() for entities: jsonb_each(entities) as ent(entity_key, entity_value)
3. NEVER use json_object_keys() - PostgreSQL will reject it
4. Cast emotion values: (emotion_value::text)::float
5. Use jsonb_array_elements_text() for entity arrays

MANDATORY SQL PATTERNS:
- Emotions: SELECT emotion_key, AVG((emotion_value::text)::float) FROM "Journal Entries", jsonb_each(emotions) as em(emotion_key, emotion_value) WHERE user_id = 'USER_ID' GROUP BY emotion_key
- Entities: SELECT entity_key, entity_item FROM "Journal Entries", jsonb_each(entities) as ent(entity_key, entity_value), jsonb_array_elements_text(entity_value) as entity_item WHERE user_id = 'USER_ID'

RESPONSE FORMAT:
{
  "queryType": "journal_specific",
  "strategy": "intelligent_sub_query", 
  "subQuestions": [
    {
      "question": "Clear question",
      "searchStrategy": "sql_primary" | "vector_primary" | "hybrid",
      "analysisSteps": [
        {
          "step": 1,
          "queryType": "sql_analysis" | "vector_search",
          "sqlQuery": "VALID SQL ONLY" | null,
          "vectorSearch": {"query": "text", "threshold": 0.7, "limit": 10} | null
        }
      ]
    }
  ]
}

Keep responses under 200 tokens. Focus on 1-3 specific sub-questions max.`;

async function generateEmbedding(text: string, openaiApiKey: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[Embedding] Error generating embedding:', error);
    throw error;
  }
}

async function executeAnalysisStep(
  step: any,
  supabaseClient: any,
  userId: string,
  openaiApiKey: string
): Promise<any> {
  
  if (step.queryType === 'sql_analysis' && step.sqlQuery) {
    console.log(`[Analysis] Executing SQL step: ${step.description}`);
    
    // Validate SQL before execution
    const validation = validateSQL(step.sqlQuery);
    if (!validation.isValid) {
      console.error('[Analysis] SQL validation failed:', validation.errors);
      return {
        success: false,
        error: `SQL validation failed: ${validation.errors.join(', ')}`,
        data: [],
        sqlQuery: step.sqlQuery,
        hasError: true,
        errorType: 'validation_error'
      };
    }
    
    // Execute with fallback
    const result = await executeWithFallback(
      supabaseClient, 
      userId, 
      validation.sanitizedQuery!
    );
    
    return {
      success: result.success,
      data: result.data,
      error: result.errorMessage || null,
      sqlQuery: validation.sanitizedQuery,
      vectorResultCount: 0,
      sqlResultCount: result.data.length,
      hasError: !result.success,
      errorType: result.success ? null : 'execution_error'
    };
  }
  
  if (step.queryType === 'vector_search' && step.vectorSearch) {
    console.log(`[Analysis] Executing vector search: ${step.description}`);
    
    try {
      const embedding = await generateEmbedding(step.vectorSearch.query, openaiApiKey);
      
      const { data, error } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: step.vectorSearch.threshold || 0.3,
        match_count: step.vectorSearch.limit || 10,
        user_id_filter: userId
      });
      
      return {
        success: !error,
        data: data || [],
        vectorResultCount: data?.length || 0,
        sqlResultCount: 0,
        hasError: !!error,
        errorType: error ? 'vector_search_error' : null
      };
    } catch (error) {
      console.error('[Analysis] Vector search error:', error);
      return {
        success: false,
        data: [],
        error: error.message,
        vectorResultCount: 0,
        sqlResultCount: 0,
        hasError: true,
        errorType: 'vector_search_error'
      };
    }
  }
  
  return {
    success: false,
    data: [],
    error: 'Invalid step configuration',
    hasError: true,
    errorType: 'configuration_error'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Smart Query Planner] Starting with enhanced validation...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const requestBody = await req.json();
    const { message, userId, userTimezone = 'UTC' } = requestBody;

    console.log(`[Smart Query Planner] Processing: "${message}" for user: ${userId}`);

    // Generate query plan with simplified prompt
    const planningResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SIMPLIFIED_SYSTEM_PROMPT },
          { role: 'user', content: `User question: "${message}" (User timezone: ${userTimezone})` }
        ],
        temperature: 0.1,
        max_tokens: 800
      }),
    });

    const planningData = await planningResponse.json();
    const planText = planningData.choices[0].message.content;

    console.log('[Smart Query Planner] Generated plan:', planText);

    let queryPlan;
    try {
      // Try to parse the JSON response
      const cleanedPlan = planText.replace(/```json\n?|\n?```/g, '').trim();
      queryPlan = JSON.parse(cleanedPlan);
    } catch (parseError) {
      console.error('[Smart Query Planner] Failed to parse plan:', parseError);
      
      // Fallback to vector search only
      const embedding = await generateEmbedding(message, openaiApiKey);
      const fallbackResult = await executeWithFallback(supabaseClient, userId, '', embedding);
      
      return new Response(JSON.stringify({
        queryPlan: {
          queryType: 'fallback',
          strategy: 'vector_only',
          reasoning: 'Query planning failed, using vector search fallback'
        },
        executionResult: [
          {
            question: message,
            results: [
              {
                step: 1,
                result: {
                  success: fallbackResult.success,
                  data: fallbackResult.data,
                  method: fallbackResult.method
                }
              }
            ]
          }
        ],
        debugInfo: {
          planningError: parseError.message,
          fallbackUsed: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute sub-questions with validation
    const executionResults = [];
    
    for (const subQuestion of queryPlan.subQuestions || []) {
      console.log(`[Smart Query Planner] Executing: ${subQuestion.question}`);
      
      const questionResults = [];
      
      for (const step of subQuestion.analysisSteps || []) {
        const stepResult = await executeAnalysisStep(step, supabaseClient, userId, openaiApiKey);
        questionResults.push({
          step: step.step,
          result: stepResult,
          queryType: step.queryType,
          description: step.description
        });
      }
      
      executionResults.push({
        question: subQuestion.question,
        results: questionResults,
        executionStage: subQuestion.executionStage || 1
      });
    }

    console.log('[Smart Query Planner] Execution complete');

    return new Response(JSON.stringify({
      queryPlan,
      executionResult: executionResults,
      debugInfo: {
        timestamp: new Date().toISOString(),
        userId,
        validationEnabled: true
      },
      timestamp: new Date().toISOString(),
      requestId: `planner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Smart Query Planner] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      debugInfo: {
        errorType: 'planning_error',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
