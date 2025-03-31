
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format emotions data into a readable string
function formatEmotions(emotions: Record<string, number> | null | undefined): string {
  if (!emotions) return "No emotion data available";
  
  // Sort emotions by intensity (highest first)
  const sortedEmotions = Object.entries(emotions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3); // Take top 3 emotions for brevity
    
  return sortedEmotions
    .map(([emotion, intensity]) => {
      // Convert intensity to percentage and format emotion name
      const percentage = Math.round(intensity * 100);
      const formattedEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      return `${formattedEmotion} (${percentage}%)`;
    })
    .join(", ");
}

// Function to detect timeframe from query
function detectTimeframe(text: string): {timeType: string | null, startDate: string | null, endDate: string | null} {
  const lowerText = text.toLowerCase();
  const now = new Date();
  let timeType = null;
  let startDate = null;
  let endDate = now.toISOString();
  
  // Check for each time range
  if (lowerText.includes('yesterday')) {
    timeType = 'day';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startDate = yesterday.toISOString();
    
    const endOfYesterday = new Date(now);
    endOfYesterday.setDate(now.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    endDate = endOfYesterday.toISOString();
  } else if (lowerText.includes('today')) {
    timeType = 'day';
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    startDate = today.toISOString();
  } else if (lowerText.includes('last week') || lowerText.includes('this week') || 
      lowerText.includes('past week') || lowerText.includes('recent days')) {
    timeType = 'week';
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    startDate = lastWeek.toISOString();
  } else if (lowerText.includes('last month') || lowerText.includes('this month') || 
      lowerText.includes('past month') || lowerText.includes('recent weeks')) {
    timeType = 'month';
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);
    startDate = lastMonth.toISOString();
  } else if (lowerText.includes('last year') || lowerText.includes('this year') || 
      lowerText.includes('past year')) {
    timeType = 'year';
    const lastYear = new Date(now);
    lastYear.setFullYear(now.getFullYear() - 1);
    startDate = lastYear.toISOString();
  }
  
  return { timeType, startDate, endDate };
}

// Generate sample answer and execution plan using OpenAI
async function generateQueryPlan(message: string, userId: string) {
  try {
    const timeframe = detectTimeframe(message);
    
    // Get a few recent entries to give GPT some context
    const { data: recentEntries, error: recentError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at, emotions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
      
    let journalContext = "";
    if (recentEntries && recentEntries.length > 0) {
      journalContext = "Here are some sample journal entries to better understand the user's journaling style:\n\n" + 
        recentEntries.map((entry, index) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const emotionsText = formatEmotions(entry.emotions);
          return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
        }).join('\n\n') + "\n\n";
    } else {
      // Add context about no entries found, but don't fail completely
      journalContext = "Note: The user doesn't have any journal entries yet. Generate a response that acknowledges this but is still helpful.\n\n";
    }
    
    // First, generate the sample answer
    const plannerPrompt = `You are a query planning system for a smart journal app that handles emotional analysis.
${journalContext}
The user has asked: "${message}"

1. First, generate a sample answer to this query as if you had complete access to the user's journal data. If there are no journal entries yet, acknowledge this but still provide a helpful response.
2. Then, break down how to execute this query into logical segments, specifying what type of operation is needed for each segment:

For each segment, indicate:
- SEGMENT_TYPE: "SQL" (for statistical/factual queries), "VECTOR" (for context-based responses), or "HYBRID"
- SQL_QUERY: If applicable, write a SQL-like query that would extract this data from a "Journal Entries" table with columns [id, refined text, created_at, emotions (JSON), user_id]
- VECTOR_SEARCH: If applicable, describe what terms to use for vector similarity search
- REQUIRES_TIMEFRAME: Whether this segment needs timeframe filtering (${timeframe.timeType ? 'Yes, ' + timeframe.timeType : 'No'})
- REQUIRES_EMOTION_FILTER: Whether this requires filtering by specific emotions

The response should be formatted as valid JSON with the following structure:
{
  "sample_answer": "The complete sample answer text",
  "execution_plan": [
    {
      "segment": "Description of what this segment answers",
      "segment_type": "SQL|VECTOR|HYBRID",
      "sql_query": "Optional SQL query",
      "vector_search": "Optional vector search description",
      "requires_timeframe": true|false,
      "requires_emotion_filter": true|false,
      "emotions": ["joy", "sadness"]
    }
  ]
}`;

    // Send to GPT to generate plan
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: plannerPrompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from OpenAI:', errorText);
      throw new Error(`Failed to generate query plan: ${errorText}`);
    }

    const result = await response.json();
    let planJson;
    
    try {
      planJson = JSON.parse(result.choices[0].message.content);
      console.log("Generated execution plan:", planJson);
      return planJson;
    } catch (e) {
      console.error("Error parsing plan JSON:", e);
      console.log("Raw content:", result.choices[0].message.content);
      throw new Error("Failed to parse execution plan");
    }
  } catch (error) {
    console.error("Error generating query plan:", error);
    throw error;
  }
}

// Function to execute SQL query segments
async function executeSqlSegment(sqlQuery: string, userId: string, startDate: string | null, endDate: string | null) {
  try {
    console.log("Executing SQL segment for user:", userId);
    console.log("Query template:", sqlQuery);
    console.log("Date range:", startDate, "to", endDate);
    
    // Replace placeholders in the SQL query
    let modifiedQuery = sqlQuery
      .replace(/\$user_id/g, `'${userId}'`)
      .replace(/\$start_date/g, startDate ? `'${startDate}'` : 'NULL')
      .replace(/\$end_date/g, endDate ? `'${endDate}'` : 'NULL');
    
    // This would need proper SQL injection protection in production
    // Here we're trusting the GPT-generated SQL

    // Execute dynamic query using Supabase function
    const { data, error } = await supabase.rpc('execute_dynamic_query', {
      query_text: modifiedQuery
    });
    
    if (error) {
      console.error("SQL execution error:", error);
      throw error;
    }
    
    console.log("SQL result:", data);
    return data;
  } catch (error) {
    console.error("Error executing SQL segment:", error);
    throw error;
  }
}

// Function to execute vector search segments
async function executeVectorSegment(query: string, userId: string, startDate: string | null, endDate: string | null) {
  try {
    console.log("Executing vector search for:", query);
    
    // Generate embedding for vector search
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const embeddingResult = await embeddingResponse.json();
    const queryEmbedding = embeddingResult.data[0].embedding;
    
    // Execute vector search
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      }
    );
    
    if (error) {
      console.error("Vector search error:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error executing vector segment:", error);
    throw error;
  }
}

// Check if there are any journal entries for a user
async function checkJournalEntries(userId: string) {
  try {
    const { count, error } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) throw error;
    return { hasEntries: count ? count > 0 : false, count };
  } catch (error) {
    console.error("Error checking journal entries:", error);
    return { hasEntries: false, count: 0 };
  }
}

// Main execution handler
async function executeQueryPlan(plan, userId, message) {
  console.log("Executing query plan for:", message);
  
  // First check if the user has any journal entries
  const { hasEntries, count } = await checkJournalEntries(userId);
  
  if (!hasEntries) {
    console.log("User has no journal entries. Returning sample answer with explanation.");
    // If no entries, still return the sample answer but with a note
    return {
      sample_answer: plan.sample_answer,
      execution_results: [],
      no_entries: true,
      count: count
    };
  }
  
  const timeframe = detectTimeframe(message);
  const results = [];
  
  // Execute each segment based on its type
  for (const segment of plan.execution_plan) {
    try {
      let segmentResult;
      
      if (segment.segment_type === "SQL") {
        segmentResult = await executeSqlSegment(
          segment.sql_query, 
          userId,
          segment.requires_timeframe ? timeframe.startDate : null,
          segment.requires_timeframe ? timeframe.endDate : null
        );
      } else if (segment.segment_type === "VECTOR") {
        const searchQuery = segment.vector_search || message;
        segmentResult = await executeVectorSegment(
          searchQuery, 
          userId,
          segment.requires_timeframe ? timeframe.startDate : null,
          segment.requires_timeframe ? timeframe.endDate : null
        );
      } else if (segment.segment_type === "HYBRID") {
        // For hybrid, we'll do both and combine
        const sqlResult = segment.sql_query ? 
          await executeSqlSegment(segment.sql_query, userId, timeframe.startDate, timeframe.endDate) : 
          null;
          
        const vectorResult = await executeVectorSegment(
          segment.vector_search || message, 
          userId,
          segment.requires_timeframe ? timeframe.startDate : null,
          segment.requires_timeframe ? timeframe.endDate : null
        );
        
        segmentResult = { 
          sql: sqlResult, 
          vector: vectorResult 
        };
      }
      
      results.push({
        segment: segment.segment,
        type: segment.segment_type,
        result: segmentResult
      });
    } catch (error) {
      console.error(`Error executing segment "${segment.segment}":`, error);
      results.push({
        segment: segment.segment,
        type: segment.segment_type,
        error: error.message
      });
    }
  }
  
  return {
    sample_answer: plan.sample_answer,
    execution_results: results,
    no_entries: false,
    count: count
  };
}

// Generate the final response using the execution results and sample answer
async function generateFinalResponse(plan, results, message) {
  // Build execution summary for context to GPT
  const executionSummary = results.no_entries 
    ? "The user has no journal entries yet."
    : results.execution_results.map(r => {
        return `
Segment: ${r.segment}
Type: ${r.type}
Result: ${r.error ? `Error: ${r.error}` : JSON.stringify(r.result, null, 2)}
`;
      }).join("\n---\n");
  
  // Create a system prompt for GPT based on execution results
  let promptHeading;
  if (results.no_entries) {
    promptHeading = `You are an AI assistant for a journaling app. The user has asked a question but they don't have any journal entries yet (count: ${results.count}).
You should acknowledge this in a friendly way and provide guidance on how to use the journaling features.
`;
  } else {
    promptHeading = `You are an AI assistant for a journaling app. You need to generate a response to the user's query based on the sample answer and execution results.
`;
  }

  const responseSynthesisPrompt = `${promptHeading}
User query: "${message}"

Sample answer that was planned:
${plan.sample_answer}

Execution results:
${executionSummary}

Please generate a final, natural-sounding response using the actual data from the execution results. Be conversational and helpful. Use the execution results to provide specific details, but follow the structure of the sample answer.

If any segment had an error, gracefully handle it by saying you couldn't retrieve that specific information. If all segments failed but the user has journal entries, acknowledge that you're having trouble processing their data but offer a general response.

${results.no_entries ? "Since there are no journal entries yet, encourage the user to create some journal entries so you can analyze them later." : ""}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: responseSynthesisPrompt
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate final response');
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error generating final response:", error);
    throw error;
  }
}

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

    console.log("Processing smart query for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Step 1: Generate a query plan
    console.log("Generating query plan...");
    const queryPlan = await generateQueryPlan(message, userId);
    
    // Step 2: Execute the plan
    console.log("Executing query plan...");
    const executionResults = await executeQueryPlan(queryPlan, userId, message);
    
    // Step 3: Generate the final response
    console.log("Generating final response...");
    const finalResponse = await generateFinalResponse(queryPlan, executionResults, message);
    
    console.log("Response generated successfully");
    
    // Prepare the result
    const result = {
      response: finalResponse,
      success: true
    };
    
    // Include diagnostics if requested
    if (includeDiagnostics) {
      result.diagnostics = {
        query_plan: queryPlan,
        execution_results: executionResults
      };
    }
    
    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("Error in smart-query-planner function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
