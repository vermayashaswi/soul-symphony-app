import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const requestBody = await req.json();
    
    const {
      message,
      userId,
      execute = false,
      conversationContext = [],
      timeRange = null,
      threadId = null,
      messageId = null,
      isFollowUp = false
    } = requestBody;

    console.log(`[REQUEST START] planner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}:`, {
      message: message?.substring(0, 50),
      userId: userId?.substring(0, 8),
      execute,
      timestamp: new Date().toISOString(),
      contextLength: conversationContext?.length || 0,
      timeRange,
      threadId: threadId?.substring(0, 8),
      messageId,
      isFollowUp
    });

    if (!execute) {
      // Generate plan only
      const plan = await generateQueryPlan(message, conversationContext, userId, timeRange);
      return new Response(JSON.stringify({ plan }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate and execute plan
    const queryPlan = await generateQueryPlan(message, conversationContext, userId, timeRange);
    const executionResults = await executePlan(queryPlan, userId, timeRange, requestId);

    return new Response(JSON.stringify({
      plan: queryPlan,
      results: executionResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in smart-query-planner:', error);
    return new Response(JSON.stringify({
      error: error.message,
      plan: null,
      results: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateQueryPlan(message: string, conversationContext: any[], userId: string, timeRange: any) {
  
  const hasPersonalPronouns = /\b(I|me|my|myself)\b/i.test(message);
  const hasTimeReference = /\b(today|yesterday|week|month|recent|lately|past|last|this)\b/i.test(message);
  const isFollowUp = conversationContext && conversationContext.length > 0;

  console.log(`[Analyst Agent] Personal pronouns: ${hasPersonalPronouns}, Time reference: ${hasTimeReference}, Follow-up: ${isFollowUp}`);
  
  // Build conversation context preview for logging
  const contextPreview = conversationContext?.slice(-5).map(msg => 
    `${msg.role}:${msg.content?.substring(0, 30)}`
  ).join(' | ') || '';
  
  console.log(`[Analyst Agent] Context preview: ${contextPreview}`);

  const analystPrompt = `You are an intelligent query analysis agent for a personal wellness journaling app. Your job is to create strategic data retrieval plans.

CONTEXT:
- User query: "${message}"
- Has personal context: ${hasPersonalPronouns}
- Has time references: ${hasTimeReference}
- Is follow-up query: ${isFollowUp}
- Conversation context: ${JSON.stringify(conversationContext?.slice(-3) || [])}

Create a JSON plan with these sub-questions that will gather both statistical insights AND specific content examples:

{
  "queryType": "journal_specific",
  "strategy": "intelligent_sub_query", 
  "userStatusMessage": "exactly 5 words about the analysis approach",
  "subQuestions": [
    {
      "question": "Clear, specific question about the user's journal data",
      "purpose": "Why this question helps answer the user's query",
      "searchStrategy": "sql_primary" | "vector_primary" | "hybrid",
      "executionStage": 1 | 2,
      "analysisSteps": [
        {
          "step": 1,
          "description": "What this step will accomplish",
          "queryType": "sql_analysis" | "vector_search",
          "sqlQuery": "SELECT query with user_id = $user_id" | null,
          "vectorSearch": {
            "query": "semantic search query to find relevant content",
            "threshold": 0.3,
            "limit": 10
          } | null,
          "timeRange": {"start": null, "end": null}
        }
      ]
    }
  ],
  "confidence": 0.8,
  "reasoning": "Why this approach will answer the user's question effectively",
  "useAllEntries": true | false,
  "hasPersonalPronouns": ${hasPersonalPronouns},
  "hasExplicitTimeReference": ${hasTimeReference}
}

IMPORTANT: For queries about "what I talked about" or "what I discussed", include both:
1. SQL queries for statistical analysis (theme counts, emotion patterns)
2. Vector searches to find actual journal content examples

Make the vector search queries specific enough to find relevant content that matches the user's question.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a query analysis agent. Return only valid JSON with the exact structure requested.'
        },
        {
          role: 'user',
          content: analystPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices[0]?.message?.content || '';
  
  console.log('Analyst Agent response:', rawContent);

  try {
    // Clean the response and extract JSON
    const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const plan = JSON.parse(jsonStr);
    
    console.log('Final Analyst Plan:', JSON.stringify(plan, null, 2));
    return plan;
  } catch (parseError) {
    console.error('Failed to parse analyst response:', parseError);
    throw new Error('Failed to generate valid query plan');
  }
}

async function executePlan(queryPlan: any, userId: string, timeRange: any, requestId: string) {
  console.log(`[EXECUTION START] ${requestId}:`, {
    userId,
    timeRange,
    planType: queryPlan.queryType,
    subQuestionCount: queryPlan.subQuestions?.length || 0,
    firstQuestion: queryPlan.subQuestions?.[0]?.question?.substring(0, 50)
  });

  if (!queryPlan.subQuestions || !Array.isArray(queryPlan.subQuestions)) {
    throw new Error('Invalid query plan: missing subQuestions array');
  }

  // Group sub-questions by execution stage
  const stageGroups: { [stage: number]: any[] } = {};
  queryPlan.subQuestions.forEach((sq: any) => {
    const stage = sq.executionStage || 1;
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(sq);
  });

  const stages = Object.keys(stageGroups).map(Number).sort();
  console.log(`[executePlan] Processing ${queryPlan.subQuestions.length} sub-questions across stages: ${stages.join(', ')}`);

  const results: any[] = [];
  
  // Execute stages sequentially
  for (const stage of stages) {
    const subQuestions = stageGroups[stage];
    console.log(`[executePlan] Executing stage ${stage} with ${subQuestions.length} sub-questions in parallel`);
    
    // Execute sub-questions in parallel within each stage
    const stagePromises = subQuestions.map(async (subQuestion: any, index: number) => {
      return await executeSubQuestion(subQuestion, userId, timeRange, requestId, index);
    });
    
    const stageResults = await Promise.all(stagePromises);
    results.push(...stageResults);
  }

  // Enhanced logging with content availability
  const resultsSummary = results.map((r, i) => ({
    index: i,
    question: r.subQuestion?.question?.substring(0, 50) || 'unknown',
    sqlRowCount: r.executionResults?.sqlResults?.length || 0,
    vectorResultCount: r.executionResults?.vectorResults?.length || 0,
    hasError: !!r.executionResults?.error,
    hasContent: r.executionResults?.vectorResults?.some((v: any) => v?.content || v?.["refined text"] || v?.["transcription text"])
  }));

  console.log(`[EXECUTION COMPLETE] ${requestId}:`, {
    totalSubQuestions: queryPlan.subQuestions.length,
    stages: stages.length,
    successfulQuestions: results.filter(r => !r.executionResults?.error).length,
    timeRange,
    resultsSummary
  });

  // Log sample data for debugging
  results.forEach((result, i) => {
    if (result.executionResults?.sqlResults?.length > 0) {
      console.log(`[SAMPLE DATA] ${requestId} #${i + 1}:`, result.executionResults.sqlResults.slice(0, 2));
    }
    if (result.executionResults?.vectorResults?.length > 0) {
      console.log(`[VECTOR CONTENT] ${requestId} #${i + 1}:`, 
        result.executionResults.vectorResults.slice(0, 2).map((v: any) => ({
          hasContent: !!(v?.content || v?.["refined text"] || v?.["transcription text"]),
          contentPreview: (v?.content || v?.["refined text"] || v?.["transcription text"])?.substring(0, 100),
          created_at: v?.created_at,
          themes: v?.master_themes || v?.themes
        }))
      );
    }
    console.log(`[RESULT SUMMARY] ${requestId} #${i + 1}: ${result.executionResults?.sqlResults?.length || 0} SQL rows, ${result.executionResults?.vectorResults?.length || 0} vector results`);
  });

  return results;
}

async function executeSubQuestion(subQuestion: any, userId: string, timeRange: any, requestId: string, index: number) {
  console.log(`[executePlan] Processing sub-question: ${subQuestion.question}`);
  
  const result: any = {
    subQuestion,
    researcherOutput: null,
    executionResults: {
      sqlResults: [],
      vectorResults: [],
      error: null
    }
  };

  try {
    // Execute each analysis step
    for (const step of subQuestion.analysisSteps || []) {
      console.log(`[executePlan] Executing step ${step.step}: ${step.description}`);
      
      if (step.queryType === 'sql_analysis' && step.sqlQuery) {
        // Execute SQL query
        const finalSql = step.sqlQuery.replace(/\$user_id/g, `'${userId}'::uuid`);
        
        console.log(`[SQL EXECUTION] ${requestId}:`, {
          originalQuery: step.sqlQuery,
          finalSql,
          timeRange,
          userId
        });

        const { data, error } = await supabase.rpc('execute_dynamic_query', {
          query_text: finalSql
        });

        if (error) {
          console.error(`[SQL ERROR] ${requestId}:`, error);
          result.executionResults.error = `SQL execution failed: ${error.message}`;
        } else {
          const sqlResults = data?.data || [];
          result.executionResults.sqlResults.push(...sqlResults);
          
          console.log(`[SQL SUCCESS] ${requestId}:`, {
            rowCount: sqlResults.length,
            sampleData: sqlResults.slice(0, 2)
          });
        }
      }
      
      if (step.queryType === 'vector_search' && step.vectorSearch) {
        // Execute vector search with enhanced content retrieval
        try {
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-ada-002',
              input: step.vectorSearch.query
            })
          });

          if (!embeddingResponse.ok) {
            throw new Error(`Embedding API error: ${embeddingResponse.status}`);
          }

          const embeddingData = await embeddingResponse.json();
          const queryEmbedding = embeddingData.data[0].embedding;

          // Enhanced vector search to ensure content is included
          const { data: vectorResults, error: vectorError } = await supabase.rpc('match_journal_entries', {
            query_embedding: queryEmbedding,
            match_threshold: step.vectorSearch.threshold || 0.3,
            match_count: step.vectorSearch.limit || 10,
            user_id_filter: userId
          });

          if (vectorError) {
            console.error(`[VECTOR ERROR] ${requestId}:`, vectorError);
            result.executionResults.error = `Vector search failed: ${vectorError.message}`;
          } else {
            // Ensure content fields are preserved
            const enhancedResults = (vectorResults || []).map((item: any) => ({
              ...item,
              content: item.content || item["refined text"] || item["transcription text"] || 'No content available',
              contentPreview: (item.content || item["refined text"] || item["transcription text"] || '').substring(0, 300),
              hasRefinedText: !!item["refined text"],
              hasTranscriptionText: !!item["transcription text"],
              master_themes: item.themes || item.master_themes || [],
              emotions: item.emotions || {}
            }));
            
            result.executionResults.vectorResults.push(...enhancedResults);
            
            console.log(`[VECTOR SUCCESS] ${requestId}:`, {
              resultCount: enhancedResults.length,
              hasContent: enhancedResults.some((r: any) => r.content && r.content !== 'No content available'),
              sampleContent: enhancedResults.slice(0, 1).map((r: any) => ({
                contentPreview: r.contentPreview,
                hasContent: r.hasRefinedText || r.hasTranscriptionText,
                themes: r.master_themes?.slice(0, 2)
              }))
            });
          }
        } catch (vectorError) {
          console.error(`[VECTOR EXCEPTION] ${requestId}:`, vectorError);
          result.executionResults.error = `Vector search exception: ${vectorError.message}`;
        }
      }
    }
  } catch (stepError) {
    console.error(`[STEP ERROR] ${requestId}:`, stepError);
    result.executionResults.error = `Step execution failed: ${stepError.message}`;
  }

  return result;
}
