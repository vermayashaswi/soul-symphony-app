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

Available SQL query types:
- get_top_emotions_with_entries(user_id, start_date, end_date, limit)
- get_top_entities_with_entries(user_id, start_date, end_date, limit) 
- get_theme_statistics(user_id, start_date, end_date, limit)
- get_entity_emotion_statistics(user_id, start_date, end_date, limit)
- match_journal_entries_by_theme(theme, user_id, threshold, limit, start_date, end_date)
- match_journal_entries_by_emotion(emotion, user_id, min_score, start_date, end_date, limit)
- match_journal_entries_by_entities(entities_array, user_id, threshold, limit, start_date, end_date)

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
  "reasoning": "brief_explanation_of_strategy_choice"
}

Focus on extracting specific entities, emotions, or themes mentioned in the sub-question. Be precise with parameter extraction.
`;

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-2025-04-14',
              messages: [
                { role: 'system', content: 'You are an expert analysis planner. Respond only with valid JSON.' },
                { role: 'user', content: analysisPrompt }
              ],
              temperature: 0.3,
              max_tokens: 500,
            }),
          });

          const data = await response.json();
          const planText = data.choices[0].message.content;
          
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
              const { data: vectorResults, error: vectorError } = await supabase.rpc(
                'match_journal_entries',
                {
                  query_embedding: embedding,
                  match_threshold: 0.3,
                  match_count: 10,
                  user_id_filter: userId
                }
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
              const params = { 
                user_id_filter: userId,
                ...analysisPlan.sqlParameters 
              };

              const { data: sqlResults, error: sqlError } = await supabase.rpc(
                analysisPlan.sqlFunction,
                params
              );

              if (sqlError) {
                console.error('SQL query error:', sqlError);
                results.error = sqlError.message;
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