
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { addDays, startOfDay, endOfDay, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "https://esm.sh/date-fns@2.30.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, includeDiagnostics = false } = await req.json();
    if (!message) {
      throw new Error('No message provided');
    }
    
    console.log(`Processing query planner request for user: ${userId}`);
    console.log(`Message: ${message.substring(0, 50)}...`);
    console.log(`Include diagnostics: ${includeDiagnostics ? 'yes' : 'no'}`);

    // Check if the user has any journal entries first
    const { count, error: countError } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const hasEntries = count && count > 0;
    console.log(`User has ${count || 0} journal entries`);
    
    // If user has no entries, generate a specialized response
    if (!hasEntries) {
      const noEntriesResponse = await generateNoEntriesResponse(message);
      
      return new Response(JSON.stringify({
        response: noEntriesResponse,
        success: true,
        fallbackToRag: false,
        diagnostics: {
          hasJournalEntries: false,
          entriesCount: 0,
          query: message
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Generate a query plan using GPT-4
    const queryPlan = await generateQueryPlan(message, userId, hasEntries, count || 0);
    
    // Step 2: Execute the query plan
    const results = await executeQueryPlan(queryPlan, userId);
    
    // Step 3: Generate the final response
    const response = await generateResponse(message, results, queryPlan);
    
    const responseData: any = {
      response,
      success: true,
      // Allow fallback to RAG if the query plan execution didn't find enough data
      fallbackToRag: results.execution_results.some(r => r.error) || 
                    !results.execution_results.some(r => 
                       r.result && (Array.isArray(r.result) ? r.result.length > 0 : Object.keys(r.result).length > 0)
                    )
    };
    
    if (includeDiagnostics) {
      responseData.diagnostics = {
        query_plan: queryPlan,
        execution_results: results,
        hasJournalEntries: hasEntries,
        entriesCount: count || 0
      };
    }
    
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in smart-query-planner function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallbackToRag: true,
      response: "I'm having trouble processing your request. Please try a different question or check back later."
    }), {
      status: 200, // Using 200 even for errors to avoid CORS issues
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateQueryPlan(query: string, userId: string, hasEntries: boolean, entryCount: number) {
  try {
    console.log(`Generating query plan for "${query}" with ${entryCount} entries available`);
    
    const systemPrompt = `You are an advanced query planning system that creates execution plans for journal analysis.
    
Your task is to:
1. Break down a user's question about their journal into executable segments
2. For each segment, determine what type of operation is needed: SQL query, vector search, or a combination
3. Plan a sequence of operations to answer the question
4. Generate a sample answer format that the system should aim to produce

${!hasEntries ? 
  "IMPORTANT: The user has NO journal entries yet. Create a plan that acknowledges this and provides an appropriate response, encouraging them to create journal entries first." : 
  `The user has ${entryCount} journal entries available for analysis.`}

For time-based references:
- "today" = the current day
- "yesterday" = previous day 
- "this week" = the current week (Monday to Sunday)
- "last week" = the previous week
- "this month" = the current month
- "last month" = the previous month
- "past X days/weeks/months" = that specific timeframe from now

Your response should be in this JSON format:
{
  "sample_answer": "A detailed example of what the final answer should look like (be empathetic and conversational)",
  "has_sufficient_data": boolean indicating if there's enough data to answer,
  "execution_plan": [
    {
      "segment": "description of this part of the query", 
      "segment_type": "sql_query" | "vector_search" | "hybrid",
      "sql_query": "SQL query to execute (if applicable)",
      "vector_search": "Text to use for vector similarity search (if applicable)"
    }
  ]
}

For emotions, always refer to the emotions jsonb field in the Journal Entries table, which contains emotion scores (0-1) as key-value pairs.
For temporal queries involving "last week", "last month", etc., convert these to specific date ranges.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from OpenAI:", errorText);
      throw new Error(`Failed to generate query plan: ${errorText}`);
    }

    const result = await response.json();
    const planText = result.choices[0].message.content;
    
    let queryPlan;
    try {
      queryPlan = JSON.parse(planText);
      console.log("Generated query plan:", JSON.stringify(queryPlan));
      return queryPlan;
    } catch (parseError) {
      console.error("Failed to parse query plan:", parseError);
      console.error("Raw plan text:", planText);
      throw new Error("Failed to parse query plan");
    }
  } catch (error) {
    console.error("Error generating query plan:", error);
    throw error;
  }
}

async function executeQueryPlan(queryPlan, userId) {
  const results = {
    success: true,
    execution_results: []
  };
  
  // If the plan indicates we don't have sufficient data, return early
  if (queryPlan.has_sufficient_data === false) {
    console.log("Query plan indicates insufficient data");
    results.execution_results.push({
      segment: "Data check",
      type: "info",
      result: "Insufficient journal data to provide a meaningful answer"
    });
    return results;
  }

  // Execute each segment of the plan
  for (const segment of queryPlan.execution_plan) {
    try {
      console.log(`Executing segment: ${segment.segment} (${segment.segment_type})`);
      
      if (segment.segment_type === 'sql_query' && segment.sql_query) {
        // SQL query execution
        const { data, error } = await supabase.rpc('execute_dynamic_query', {
          query_text: segment.sql_query,
          user_id_param: userId
        });
        
        if (error) {
          console.error(`SQL error for segment "${segment.segment}":`, error);
          results.execution_results.push({
            segment: segment.segment,
            type: "sql_query",
            error: error.message
          });
        } else {
          console.log(`SQL result for segment "${segment.segment}":`, data);
          results.execution_results.push({
            segment: segment.segment,
            type: "sql_query",
            result: data
          });
        }
      } 
      else if (segment.segment_type === 'vector_search' && segment.vector_search) {
        // Vector search execution
        const embedding = await generateEmbedding(segment.vector_search);
        
        const { data, error } = await supabase.rpc(
          'match_journal_entries_with_date',
          {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: 5,
            user_id_filter: userId
          }
        );
        
        if (error) {
          console.error(`Vector search error for segment "${segment.segment}":`, error);
          results.execution_results.push({
            segment: segment.segment,
            type: "vector_search",
            error: error.message
          });
        } else {
          console.log(`Vector search result for segment "${segment.segment}":`, data.length);
          results.execution_results.push({
            segment: segment.segment,
            type: "vector_search",
            result: data
          });
        }
      }
      else if (segment.segment_type === 'hybrid') {
        // Hybrid approach (combine SQL and vector search as needed)
        let hybridResult = {};
        
        if (segment.sql_query) {
          const { data, error } = await supabase.rpc('execute_dynamic_query', {
            query_text: segment.sql_query,
            user_id_param: userId
          });
          
          if (error) {
            console.error(`Hybrid SQL error for segment "${segment.segment}":`, error);
          } else {
            hybridResult.sql_result = data;
          }
        }
        
        if (segment.vector_search) {
          const embedding = await generateEmbedding(segment.vector_search);
          
          const { data, error } = await supabase.rpc(
            'match_journal_entries_with_date',
            {
              query_embedding: embedding,
              match_threshold: 0.5,
              match_count: 5,
              user_id_filter: userId
            }
          );
          
          if (error) {
            console.error(`Hybrid vector search error for segment "${segment.segment}":`, error);
          } else {
            hybridResult.vector_result = data;
          }
        }
        
        results.execution_results.push({
          segment: segment.segment,
          type: "hybrid",
          result: hybridResult
        });
      }
    } catch (error) {
      console.error(`Error executing segment "${segment.segment}":`, error);
      results.execution_results.push({
        segment: segment.segment,
        type: segment.segment_type,
        error: error.message
      });
    }
  }
  
  return results;
}

async function generateResponse(query, executionResults, queryPlan) {
  try {
    // Format the execution results for GPT-4
    const formattedResults = JSON.stringify(executionResults, null, 2);
    const sampleAnswer = queryPlan.sample_answer || "No sample answer provided";
    
    // Check if we have any successful results
    const hasValidResults = executionResults.execution_results.some(result => !result.error && result.result && 
      (Array.isArray(result.result) ? result.result.length > 0 : Object.keys(result.result || {}).length > 0));
    
    // If no entries exist or no data found, respond appropriately
    const hasSufficientData = queryPlan.has_sufficient_data !== false;
    
    const systemPrompt = `You are an AI assistant specializing in personal journal analysis and emotional insights. 
Your goal is to provide thoughtful, personalized responses based on the user's journal entries.

${!hasSufficientData ? 
  "IMPORTANT: The user has no journal entries yet or there's not enough data to answer their query properly. Acknowledge this in your response and suggest they start journaling to get insights. Be encouraging and helpful, while being honest about the limitations." : 
  hasValidResults ? 
    "Based on the execution results, generate a conversational and empathetic response that answers the user's query." : 
    "The query execution didn't find relevant data in the user's journal. Acknowledge this in your response, but be helpful - suggest what they might want to journal about to get insights on this topic in the future."
}

Follow these guidelines:
1. Be conversational and empathetic, addressing the user directly
2. Reference specific information from their journal entries when available
3. Provide emotional insights and patterns you notice
4. If there's insufficient data, acknowledge this gracefully
5. For emotion-related queries, be specific about which emotions appeared and when
6. For cause analysis, link emotions to events or situations mentioned in journal entries

Here's the sample answer format we're aiming for:
${sampleAnswer}

Please generate a helpful response based on this information.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User query: "${query}"\n\nExecution results:\n${formattedResults}` }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate response: ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response:", error);
    return "I'm having trouble analyzing your journal entries right now. Please try again later.";
  }
}

// Generate specialized response for users with no journal entries
async function generateNoEntriesResponse(query) {
  try {
    const systemPrompt = `You are an AI assistant specializing in personal journal analysis. The user has just asked about their journal entries, but they haven't created any journal entries yet.

Your task is to:
1. Acknowledge that they don't have journal entries yet in a friendly way
2. Explain that the Smart Chat feature works by analyzing their journal entries
3. Encourage them to create some journal entries
4. Suggest types of entries they could create that would be relevant to their query
5. Reassure them that once they have some entries, you'll be able to provide insights

Be conversational, encouraging, and helpful. Avoid sounding judgmental or disappointed.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate no-entries response: ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error generating no-entries response:", error);
    return "I notice you don't have any journal entries yet. To get insights from the Smart Chat feature, start by creating a few journal entries about your day, emotions, or experiences. Once you have some entries, I'll be able to analyze them and provide personalized insights.";
  }
}

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate embedding: ${error}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
