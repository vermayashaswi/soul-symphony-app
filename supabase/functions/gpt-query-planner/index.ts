import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueryPlan {
  subQuestionId: string;
  executionStrategy: 'parallel' | 'sequential' | 'conditional';
  searchMethod: 'vector_similarity' | 'sql_query' | 'hybrid_search' | 'entity_lookup' | 'emotion_analysis';
  parameters: {
    vectorThreshold?: number;
    maxResults?: number;
    timeFilter?: { start?: string; end?: string };
    emotionFilters?: string[];
    themeFilters?: string[];
    entityFilters?: string[];
    sqlConditions?: string[];
    analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
  };
  fallbackStrategy?: string;
  estimatedLatency: number;
  cacheKey?: string;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subQuestions, userContext = {}, performanceConstraints = {} } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get database schema information for intelligent planning
    const [entriesCount, themesData, emotionsData] = await Promise.all([
      supabase.from('Journal Entries').select('id', { count: 'exact', head: true }),
      supabase.from('themes').select('name').eq('is_active', true),
      supabase.from('emotions').select('name')
    ]);

    const systemPrompt = `You are an intelligent query execution planner for a personal journal analysis system. Your task is to create optimal execution plans for sub-questions.

DATABASE CONTEXT:
- Total journal entries: ${entriesCount.count || 'unknown'}
- Available themes: ${themesData.data?.map(t => t.name).join(', ') || 'loading...'}
- Available emotions: ${emotionsData.data?.map(e => e.name).join(', ') || 'loading...'}

SEARCH METHODS:
- vector_similarity: Semantic search using embeddings (best for concept matching)
- sql_query: Direct database queries (best for specific criteria, dates, exact matches)
- hybrid_search: Combination of vector and SQL (best for complex queries)
- entity_lookup: Specific entity-based searches
- emotion_analysis: Emotion-focused analysis

PERFORMANCE CONSTRAINTS:
- Target response time: ${performanceConstraints.maxLatency || 5000}ms
- Max parallel queries: ${performanceConstraints.maxParallel || 3}
- Memory limits: Consider for large result sets

GUIDELINES:
1. Optimize for both accuracy and performance
2. Use vector similarity for semantic matching
3. Use SQL for precise filtering and aggregation
4. Consider data volume when setting maxResults
5. Plan fallback strategies for each method
6. Estimate realistic latency based on complexity

RESPONSE FORMAT:
Return a JSON object with queryPlans array containing QueryPlan objects.`;

    const userPrompt = `
Sub-questions to plan: ${JSON.stringify(subQuestions)}

User Context: ${JSON.stringify(userContext)}

Performance Constraints: ${JSON.stringify(performanceConstraints)}

Create optimal execution plans for each sub-question. Consider the type, priority, and complexity of each question to determine the best search method and parameters.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let queryPlans: QueryPlan[];

    try {
      const parsed = JSON.parse(data.choices[0].message.content);
      queryPlans = parsed.queryPlans || [];
    } catch (parseError) {
      console.error('Failed to parse GPT response:', parseError);
      queryPlans = generateFallbackPlans(subQuestions);
    }

    // Validate and optimize plans
    const optimizedPlans = queryPlans.map((plan, index) => {
      const subQuestion = subQuestions[index];
      return {
        ...plan,
        subQuestionId: subQuestion?.id || `sq_${index}`,
        parameters: {
          ...plan.parameters,
          maxResults: Math.min(plan.parameters?.maxResults || 10, 50),
          vectorThreshold: Math.max(0.1, Math.min(1.0, plan.parameters?.vectorThreshold || 0.7)),
          analysisDepth: plan.parameters?.analysisDepth || 'basic'
        },
        estimatedLatency: Math.max(100, Math.min(10000, plan.estimatedLatency || 2000)),
        cacheKey: generateCacheKey(subQuestion, plan),
        fallbackStrategy: plan.fallbackStrategy || 'basic_vector_search'
      };
    });

    // Determine optimal execution strategy
    const executionStrategy = determineExecutionStrategy(optimizedPlans, performanceConstraints);

    return new Response(JSON.stringify({
      success: true,
      queryPlans: optimizedPlans,
      executionStrategy,
      metadata: {
        totalPlans: optimizedPlans.length,
        estimatedTotalLatency: optimizedPlans.reduce((sum, plan) => sum + plan.estimatedLatency, 0),
        planningMethod: 'gpt'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-query-planner:', error);
    
    const fallbackPlans = generateFallbackPlans(
      req.body ? JSON.parse(await req.text()).subQuestions : []
    );

    return new Response(JSON.stringify({
      success: true,
      queryPlans: fallbackPlans,
      executionStrategy: { type: 'sequential', reason: 'fallback mode' },
      metadata: {
        planningMethod: 'fallback',
        error: error.message
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackPlans(subQuestions: any[]): QueryPlan[] {
  return subQuestions.map((sq, index) => ({
    subQuestionId: sq.id || `sq_${index}`,
    executionStrategy: 'parallel' as const,
    searchMethod: sq.searchStrategy === 'sql' ? 'sql_query' : 
                  sq.searchStrategy === 'hybrid' ? 'hybrid_search' : 'vector_similarity',
    parameters: {
      vectorThreshold: 0.7,
      maxResults: 10,
      timeFilter: sq.parameters?.timeRange,
      emotionFilters: sq.parameters?.emotions,
      themeFilters: sq.parameters?.themes,
      analysisDepth: 'basic' as const
    },
    fallbackStrategy: 'basic_vector_search',
    estimatedLatency: 2000,
    reasoning: 'Fallback plan based on sub-question type'
  }));
}

function determineExecutionStrategy(plans: QueryPlan[], constraints: any) {
  const totalLatency = plans.reduce((sum, plan) => sum + plan.estimatedLatency, 0);
  const maxLatency = constraints.maxLatency || 5000;
  
  if (totalLatency > maxLatency && plans.length > 1) {
    return {
      type: 'parallel',
      reason: 'Parallel execution needed to meet latency constraints',
      maxConcurrent: Math.min(plans.length, constraints.maxParallel || 3)
    };
  }
  
  return {
    type: plans.length > 2 ? 'parallel' : 'sequential',
    reason: 'Optimal based on plan complexity and constraints'
  };
}

function generateCacheKey(subQuestion: any, plan: QueryPlan): string {
  const keyComponents = [
    subQuestion?.question?.slice(0, 50),
    plan.searchMethod,
    JSON.stringify(plan.parameters)
  ];
  return btoa(keyComponents.join('|')).slice(0, 16);
}