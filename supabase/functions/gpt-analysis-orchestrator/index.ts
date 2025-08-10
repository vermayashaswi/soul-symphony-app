import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { JOURNAL_ENTRY_SCHEMA, THEMES_MASTER_TABLE, EMOTIONS_MASTER_TABLE } from "../_shared/databaseSchemaContext.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Enhanced schema context with complete master tables
const ENHANCED_SCHEMA_CONTEXT = `
**COMPLETE DATABASE CONTEXT FOR RESEARCHER AGENT:**

**Journal Entries Table:**
${Object.entries(JOURNAL_ENTRY_SCHEMA.columns).map(([column, info]) => 
  `- ${column} (${info.type}): ${info.description}${info.example ? `\n  Example: ${JSON.stringify(info.example)}` : ''}`
).join('\n')}

**THEMES MASTER TABLE:**
${THEMES_MASTER_TABLE.map(theme => 
  `- "${theme.name}": ${theme.description}`
).join('\n')}

**EMOTIONS MASTER TABLE:**
${EMOTIONS_MASTER_TABLE.map(emotion => 
  `- "${emotion.name}": ${emotion.description}`
).join('\n')}

**SECURITY & ANALYSIS CONSTRAINTS:**
- ALL queries MUST include WHERE user_id = $user_id for data isolation
- Use proper SQL escaping and parameterization
- Leverage themeemotion column for theme-emotion correlations
- Use emotions column for emotion-based filtering and analysis
- Apply temporal filtering via created_at when date ranges are specified
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisPlan, userMessage, userId, timeRange, messageId } = await req.json();
    
    console.log('GPT Analysis Orchestrator (Researcher Agent) called with:', { 
      subQuestionsCount: analysisPlan?.subQuestions?.length || 0,
      userMessage: userMessage?.substring(0, 100),
      userId,
      timeRange,
      messageId 
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate input
    if (!analysisPlan || !analysisPlan.subQuestions) {
      throw new Error("Invalid analysis plan received from Analyst Agent");
    }

    // Process each sub-question through the Researcher Agent
    const researchResults = await Promise.all(
      analysisPlan.subQuestions.map(async (subQuestion: any, index: number) => {
        try {
          // Researcher Agent: Validate and refine the analysis plan
          const researcherPrompt = `
You are SOULo's Researcher Agent. Your role is to validate, refine, and execute the analysis plan created by the Analyst Agent.

**CONTEXT:**
${ENHANCED_SCHEMA_CONTEXT}

**ANALYST AGENT OUTPUT TO VALIDATE:**
Sub-question: "${subQuestion.question}"
Purpose: "${subQuestion.purpose}"
Search Strategy: "${subQuestion.searchStrategy}"
Analysis Steps: ${JSON.stringify(subQuestion.analysisSteps, null, 2)}

**ORIGINAL USER MESSAGE:** "${userMessage}"
**TIME RANGE:** ${timeRange ? JSON.stringify(timeRange) : 'null'}

**YOUR TASKS AS RESEARCHER AGENT:**
1. **Validate** the analysis plan for correctness and completeness
2. **Refine** SQL queries to ensure proper user scoping and time filtering
3. **Enhance** the plan with missing elements (date filters, emotion thresholds, etc.)
4. **Generate** the final execution plan with validated queries

**VALIDATION RULES:**
- All SQL queries MUST include WHERE user_id = $user_id
- Add time range filters if timeRange is provided
- Ensure emotion queries use proper jsonb operators
- Validate theme queries use correct array operations
- Add missing analysis steps if plan is incomplete

**OUTPUT SCHEMA:**
Return ONLY valid JSON:
{
  "validatedPlan": {
    "subQuestion": "${subQuestion.question}",
    "searchStrategy": "sql_primary" | "vector_primary" | "hybrid",
    "executionSteps": [
      {
        "stepId": 1,
        "type": "sql_query" | "vector_search",
        "description": "what this step accomplishes",
        "sql": {
          "query": "SELECT ... FROM \\"Journal Entries\\" WHERE user_id = $1 AND ...",
          "parameters": ["$user_id"],
          "purpose": "calculation/count/analysis description"
        } | null,
        "vector": {
          "queryText": "semantic search query",
          "threshold": 0.3,
          "limit": 10,
          "dateFilter": true/false
        } | null
      }
    ]
  },
  "confidence": 0.9,
  "validationIssues": ["list of issues found and fixed"],
  "enhancements": ["list of improvements made"]
}

Focus on ensuring the plan is complete, secure, and executable.`;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-2025-04-14',
              messages: [
                { role: 'system', content: 'You are SOULo\'s Researcher Agent. Validate and refine analysis plans with rigorous attention to security and correctness.' },
                { role: 'user', content: researcherPrompt }
              ],
              response_format: { type: 'json_object' },
              max_tokens: 1000
            }),
          });

          if (!response.ok) {
            throw new Error(`Researcher Agent OpenAI error: ${response.status}`);
          }

          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content || '';
          
          let researcherOutput;
          try {
            researcherOutput = JSON.parse(content);
          } catch (e) {
            console.warn(`Failed to parse Researcher Agent JSON for sub-question ${index}`);
            throw new Error("Researcher Agent returned invalid JSON");
          }

          // Execute the validated plan
          const executionResults = await executeValidatedPlan(
            researcherOutput.validatedPlan,
            userId,
            timeRange,
            supabase
          );

          return {
            subQuestion,
            researcherOutput,
            executionResults,
            index
          };

        } catch (error) {
          console.error(`Error processing sub-question ${index}:`, error);
          return {
            subQuestion,
            researcherOutput: null,
            executionResults: { error: error.message },
            index
          };
        }
      })
    );

    return new Response(JSON.stringify({
      success: true,
      researchResults,
      metadata: {
        orchestratorVersion: "researcher_agent_v1",
        timestamp: new Date().toISOString(),
        processedSubQuestions: researchResults.length,
        hasErrors: researchResults.some(r => r.executionResults.error)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Analysis Orchestrator:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Execute the validated plan from Researcher Agent
 */
async function executeValidatedPlan(validatedPlan: any, userId: string, timeRange: any, supabase: any) {
  const results: any = {
    sqlResults: null,
    vectorResults: null,
    error: null,
    executionDetails: []
  };

  try {
    for (const step of validatedPlan.executionSteps) {
      const stepResult: any = {
        stepId: step.stepId,
        type: step.type,
        description: step.description,
        result: null,
        error: null
      };

      if (step.type === 'sql_query' && step.sql) {
        try {
          // Execute SQL query using dynamic query building
          const sqlResult = await executeDynamicSQL(step.sql, userId, timeRange, supabase);
          stepResult.result = sqlResult;
          
          // Store primary SQL result
          if (!results.sqlResults) {
            results.sqlResults = sqlResult;
          }
        } catch (sqlError) {
          stepResult.error = sqlError.message;
          console.error(`SQL execution error for step ${step.stepId}:`, sqlError);
        }
      }

      if (step.type === 'vector_search' && step.vector) {
        try {
          // Execute vector search
          const vectorResult = await executeVectorSearch(step.vector, userId, timeRange, supabase);
          stepResult.result = vectorResult;
          
          // Store primary vector result
          if (!results.vectorResults) {
            results.vectorResults = vectorResult;
          }
        } catch (vectorError) {
          stepResult.error = vectorError.message;
          console.error(`Vector search error for step ${step.stepId}:`, vectorError);
        }
      }

      results.executionDetails.push(stepResult);
    }

  } catch (error) {
    results.error = error.message;
    console.error('Execution plan error:', error);
  }

  return results;
}

/**
 * Execute dynamic SQL with proper parameterization
 */
async function executeDynamicSQL(sqlConfig: any, userId: string, timeRange: any, supabase: any) {
  try {
    let query = sqlConfig.query;
    let params = [userId];

    // Apply time range filtering if specified
    if (timeRange && (timeRange.start || timeRange.end)) {
      if (timeRange.start && !query.includes('created_at >=')) {
        query = query.replace('WHERE user_id = $1', 'WHERE user_id = $1 AND created_at >= $2');
        params.push(timeRange.start);
      }
      if (timeRange.end && !query.includes('created_at <=')) {
        const paramIndex = params.length + 1;
        query = query.replace(/WHERE (.*?)$/, `WHERE $1 AND created_at <= $${paramIndex}`);
        params.push(timeRange.end);
      }
    }

    console.log('Executing SQL:', { query, params: params.map((p, i) => i === 0 ? '[user_id]' : p) });

    const { data, error } = await supabase.rpc('execute_dynamic_query', {
      query_text: query.replace(/\$\d+/g, (match, offset) => {
        const paramIndex = parseInt(match.substring(1)) - 1;
        return paramIndex === 0 ? `'${userId}'` : `'${params[paramIndex]}'`;
      })
    });

    if (error) {
      throw new Error(`SQL execution error: ${error.message}`);
    }

    return data?.data || [];

  } catch (error) {
    console.error('Dynamic SQL execution error:', error);
    throw error;
  }
}

/**
 * Execute vector search with embeddings
 */
async function executeVectorSearch(vectorConfig: any, userId: string, timeRange: any, supabase: any) {
  try {
    // Generate embedding for the query
    const embedResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: vectorConfig.queryText,
      }),
    });

    if (!embedResponse.ok) {
      throw new Error(`Embedding API error: ${embedResponse.status}`);
    }

    const embedData = await embedResponse.json();
    const embedding = embedData?.data?.[0]?.embedding;

    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }

    // Choose appropriate RPC function based on date filtering
    const useDate = vectorConfig.dateFilter && (timeRange?.start || timeRange?.end);
    const rpcName = useDate ? 'match_journal_entries_with_date' : 'match_journal_entries';
    
    const rpcParams: any = {
      query_embedding: embedding,
      match_threshold: vectorConfig.threshold || 0.3,
      match_count: vectorConfig.limit || 10,
      user_id_filter: userId
    };

    if (useDate) {
      rpcParams.start_date = timeRange?.start || null;
      rpcParams.end_date = timeRange?.end || null;
    }

    console.log(`Executing vector search: ${rpcName}`);
    const { data: vectorResults, error: vectorError } = await supabase.rpc(rpcName, rpcParams);

    if (vectorError) {
      throw new Error(`Vector search error: ${vectorError.message}`);
    }

    return vectorResults || [];

  } catch (error) {
    console.error('Vector search execution error:', error);
    throw error;
  }
}