import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subQuestions, userMessage, userId, timeRange } = await req.json();
    
    console.log('GPT Analysis Orchestrator called with:', { 
      subQuestionsCount: subQuestions?.length || 0,
      userMessage: userMessage?.substring(0, 100),
      userId,
      timeRange 
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate analysis plans for each sub-question using GPT
    const analysisPlans = await Promise.all(
      subQuestions.map(async (subQuestion: any, index: number) => {
        const analysisPrompt = `
You are an expert analysis planner for a journal analytics system. Given a sub-question, determine the optimal search and analysis strategy.

Sub-question: "${subQuestion.question}"
Sub-question type: ${subQuestion.type}
Priority: ${subQuestion.priority}
Original user message: "${userMessage}"

Available search methods:
1. VECTOR_SEARCH: Semantic similarity search through journal embeddings (best for thematic, emotional, or conceptual queries)
2. SQL_QUERY: Structured data queries for entities, themes, emotions, dates (best for factual, statistical, or time-based queries)  
3. HYBRID: Both vector and SQL search (best for complex queries needing both semantic and structured data)

Available SQL query types (with EXACT parameter names):
- get_top_emotions_with_entries(user_id_param, start_date, end_date, limit_count)
- get_top_entities_with_entries(user_id_param, start_date, end_date, limit_count) 
- get_theme_statistics(user_id_filter, start_date, end_date, limit_count)
- get_entity_emotion_statistics(user_id_filter, start_date, end_date, limit_count)
- match_journal_entries_by_theme(theme_query, user_id_filter, match_threshold, match_count, start_date, end_date)
- match_journal_entries_by_emotion(emotion_name, user_id_filter, min_score, start_date, end_date, limit_count)
- match_journal_entries_by_entities(entity_queries, user_id_filter, match_threshold, match_count, start_date, end_date)

CRITICAL PARAMETER MAPPING:
- Use "user_id_param" ONLY for: get_top_emotions_with_entries, get_top_entities_with_entries
- Use "user_id_filter" for ALL other functions
- Use "match_threshold" and "match_count" for theme/entity matching functions
- Use "min_score" for emotion matching functions
- Use "limit_count" for statistics functions

Respond with a JSON object containing:
{
  "searchStrategy": "VECTOR_SEARCH" | "SQL_QUERY" | "HYBRID",
  "sqlFunction": "function_name_if_applicable" | null,
  "sqlParameters": {
    "theme": "extracted_theme_if_applicable",
    "emotion": "extracted_emotion_if_applicable", 
    "entities": ["entity1", "entity2"] | null,
    "limit": number,
    "threshold": number_if_applicable
  } | null,
  "vectorQuery": "reformulated_query_for_semantic_search" | null,
  "reasoning": "brief_explanation_of_strategy_choice",
  "userStatusMessage": "exactly 5 words describing this analysis step (e.g., 'Analyzing emotional patterns from entries' or 'Finding relevant themes and topics')"
}

Focus on extracting specific entities, emotions, or themes mentioned in the sub-question. Be precise with parameter extraction.
`;

        try {
          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-5-mini',
              input: [
                { role: 'system', content: [{ type: 'input_text', text: 'You are an expert analysis planner. Respond only with valid JSON.' }] },
                { role: 'user', content: [{ type: 'input_text', text: analysisPrompt }] }
              ],
              max_output_tokens: 500,
              text: { format: "json" }
            }),
          });

          const data = await response.json();
          let planText = '';
          if (typeof data.output_text === 'string' && data.output_text.trim()) {
            planText = data.output_text;
          } else if (Array.isArray(data.output)) {
            planText = data.output
              .map((item: any) => (item?.content ?? [])
                .map((c: any) => c?.text ?? '')
                .join(''))
              .join('');
          } else if (Array.isArray(data.content)) {
            planText = data.content.map((c: any) => c?.text ?? '').join('');
          }
          
          let analysisPlan;
          try {
            analysisPlan = JSON.parse(planText);
          } catch (parseError) {
            console.warn(`Failed to parse GPT response for sub-question ${index}:`, planText);
            // Fallback plan
            analysisPlan = {
              searchStrategy: "HYBRID",
              sqlFunction: null,
              sqlParameters: null,
              vectorQuery: subQuestion.question,
              reasoning: "Fallback due to parsing error"
            };
          }

          // Add time range to SQL parameters if applicable
          if (analysisPlan.sqlParameters && timeRange) {
            analysisPlan.sqlParameters.start_date = timeRange.start;
            analysisPlan.sqlParameters.end_date = timeRange.end;
          }

          return {
            subQuestion,
            analysisPlan,
            index
          };

        } catch (error) {
          console.error(`Error planning analysis for sub-question ${index}:`, error);
          return {
            subQuestion,
            analysisPlan: {
              searchStrategy: "VECTOR_SEARCH",
              sqlFunction: null,
              sqlParameters: null,
              vectorQuery: subQuestion.question,
              reasoning: "Fallback due to error"
            },
            index
          };
        }
      })
    );

    // Execute the planned analyses
    const analysisResults = await Promise.all(
      analysisPlans.map(async ({ subQuestion, analysisPlan, index }) => {
        const results = {
          subQuestion,
          analysisPlan,
          vectorResults: null,
          sqlResults: null,
          error: null
        };

        try {
          // Execute vector search if needed
          if (analysisPlan.searchStrategy === "VECTOR_SEARCH" || analysisPlan.searchStrategy === "HYBRID") {
            if (analysisPlan.vectorQuery) {
              const vectorResponse = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openAIApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'text-embedding-3-small',
                  input: analysisPlan.vectorQuery,
                }),
              });

              const vectorData = await vectorResponse.json();
              const embedding = vectorData.data[0].embedding;

              // Use the vector to search journal entries
              // Choose correct RPC based on presence of time range
              const useDate = !!(timeRange && (timeRange.start || timeRange.end));
              const rpcName = useDate ? 'match_journal_entries_with_date' : 'match_journal_entries_fixed';
              const rpcParams: any = {
                query_embedding: embedding,
                match_threshold: 0.3,
                match_count: 10,
                user_id_filter: userId
              };
              if (useDate) {
                rpcParams.start_date = timeRange.start || null;
                rpcParams.end_date = timeRange.end || null;
              }

              const { data: vectorResults, error: vectorError } = await supabase.rpc(
                rpcName,
                rpcParams
              );

              if (vectorError) {
                console.error('Vector search error:', vectorError);
              } else {
                results.vectorResults = vectorResults;
              }
            }
          }

          // Execute SQL query if needed
          if (analysisPlan.searchStrategy === "SQL_QUERY" || analysisPlan.searchStrategy === "HYBRID") {
            if (analysisPlan.sqlFunction && analysisPlan.sqlParameters) {
              let params = {};
              
              // Map parameters correctly based on function signature
              switch (analysisPlan.sqlFunction) {
                case 'get_top_emotions_with_entries':
                case 'get_top_entities_with_entries':
                  params = {
                    user_id_param: userId,
                    start_date: analysisPlan.sqlParameters.start_date || null,
                    end_date: analysisPlan.sqlParameters.end_date || null,
                    limit_count: analysisPlan.sqlParameters.limit || 5
                  };
                  break;
                  
                case 'get_theme_statistics':
                case 'get_entity_emotion_statistics':
                  params = {
                    user_id_filter: userId,
                    start_date: analysisPlan.sqlParameters.start_date || null,
                    end_date: analysisPlan.sqlParameters.end_date || null,
                    limit_count: analysisPlan.sqlParameters.limit || 20
                  };
                  break;
                  
                case 'match_journal_entries_by_theme':
                  params = {
                    theme_query: analysisPlan.sqlParameters.theme,
                    user_id_filter: userId,
                    match_threshold: analysisPlan.sqlParameters.threshold || 0.5,
                    match_count: analysisPlan.sqlParameters.limit || 5,
                    start_date: analysisPlan.sqlParameters.start_date || null,
                    end_date: analysisPlan.sqlParameters.end_date || null
                  };
                  break;
                  
                case 'match_journal_entries_by_emotion':
                  params = {
                    emotion_name: analysisPlan.sqlParameters.emotion,
                    user_id_filter: userId,
                    min_score: analysisPlan.sqlParameters.threshold || 0.3,
                    start_date: analysisPlan.sqlParameters.start_date || null,
                    end_date: analysisPlan.sqlParameters.end_date || null,
                    limit_count: analysisPlan.sqlParameters.limit || 5
                  };
                  break;
                  
                case 'match_journal_entries_by_entities':
                  params = {
                    entity_queries: analysisPlan.sqlParameters.entities || [],
                    user_id_filter: userId,
                    match_threshold: analysisPlan.sqlParameters.threshold || 0.3,
                    match_count: analysisPlan.sqlParameters.limit || 10,
                    start_date: analysisPlan.sqlParameters.start_date || null,
                    end_date: analysisPlan.sqlParameters.end_date || null
                  };
                  break;
                  
                default:
                  console.warn(`Unknown SQL function: ${analysisPlan.sqlFunction}`);
                  params = {
                    user_id_filter: userId,
                    ...analysisPlan.sqlParameters
                  };
              }

              console.log(`Executing SQL function: ${analysisPlan.sqlFunction}`, params);

              const { data: sqlResults, error: sqlError } = await supabase.rpc(
                analysisPlan.sqlFunction,
                params
              );

              if (sqlError) {
                console.error(`SQL query error for ${analysisPlan.sqlFunction}:`, sqlError);
                results.error = `SQL Error: ${sqlError.message}`;
                
                // Fallback to vector search if SQL fails
                console.log('Attempting fallback to vector search...');
                const fallbackQuery = analysisPlan.vectorQuery || subQuestion.question;
                
                try {
                  const vectorResponse = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${openAIApiKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'text-embedding-3-small',
                      input: fallbackQuery,
                    }),
                  });

                  const vectorData = await vectorResponse.json();
                  const embedding = vectorData.data[0].embedding;

                  const useDate = !!(timeRange && (timeRange.start || timeRange.end));
                  const fallbackRpc = useDate ? 'match_journal_entries_with_date' : 'match_journal_entries_fixed';
                  const fallbackParams: any = {
                    query_embedding: embedding,
                    match_threshold: 0.3,
                    match_count: 5,
                    user_id_filter: userId
                  };
                  if (useDate) {
                    fallbackParams.start_date = timeRange.start || null;
                    fallbackParams.end_date = timeRange.end || null;
                  }

                  const { data: fallbackResults, error: fallbackError } = await supabase.rpc(
                    fallbackRpc,
                    fallbackParams
                  );

                  if (!fallbackError) {
                    results.vectorResults = fallbackResults;
                    results.error = `SQL failed, used vector search fallback: ${sqlError.message}`;
                  }
                } catch (fallbackError) {
                  console.error('Fallback vector search also failed:', fallbackError);
                  results.error = `Both SQL and vector search failed: ${sqlError.message}`;
                }
              } else {
                results.sqlResults = sqlResults;
              }
            }
          }

        } catch (error) {
          console.error(`Error executing analysis for sub-question ${index}:`, error);
          results.error = error.message;
        }

        return results;
      })
    );

    return new Response(JSON.stringify({
      success: true,
      analysisResults,
      summary: {
        totalSubQuestions: subQuestions.length,
        completedAnalyses: analysisResults.length,
        strategies: analysisResults.map(r => r.analysisPlan.searchStrategy)
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