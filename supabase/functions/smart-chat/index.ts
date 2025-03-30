
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

// Define relevant database schema for GPT
const DATABASE_SCHEMA = `
Table: "Journal Entries"
- id: bigint (primary key)
- user_id: uuid (references user)
- created_at: timestamp with time zone
- "refined text": text (contains the cleaned journal content)
- transcription_text: text (raw transcription)
- master_themes: text[] (array of themes extracted from the journal)
- emotions: jsonb (emotion analysis with scores, e.g. {"happy": 0.8, "sad": 0.2})
- sentiment: text (overall sentiment classification)
- entities: jsonb (array of entities detected in the text, e.g. [{"type": "organization", "name": "Acme Inc"}])

Table: journal_embeddings
- id: bigint (primary key)
- journal_entry_id: bigint (references "Journal Entries".id)
- content: text (the text that was embedded)
- embedding: vector(1536) (the embedding vector)
- created_at: timestamp with time zone
`;

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    console.log("Generating embedding for query:", text.substring(0, 50) + "...");
    
    if (!openAIApiKey) {
      console.error("OpenAI API key is not set");
      throw new Error('OpenAI API key is not configured');
    }
    
    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
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
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error generating embedding:', errorText);
      throw new Error(`Failed to generate embedding: ${errorText}`);
    }

    const result = await response.json();
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      console.error('Unexpected embedding response structure:', result);
      throw new Error('Invalid embedding response structure');
    }
    
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    if (error.name === 'AbortError') {
      throw new Error('Embedding generation timed out after 15 seconds');
    }
    throw error;
  }
}

// Function to ask GPT to analyze the query and generate SQL
async function analyzeQueryWithGPT(
  userQuery: string, 
  userId: string
) {
  try {
    console.log("Asking GPT to analyze query and generate SQL");
    
    const systemPrompt = `You are an AI assistant specialized in analyzing user queries about journal entries and generating appropriate SQL queries.

${DATABASE_SCHEMA}

Your task:
1. Analyze the user's question about their journal entries
2. Determine if the question requires:
   a) Direct SQL querying for factual/statistical questions (e.g., "How many journal entries did I write last week?")
   b) Vector similarity search for semantic/content questions (e.g., "What did I write about happiness?")
   c) A combination of both approaches

3. If SQL is needed, generate a PostgreSQL query that:
   - Filters by the correct user_id (provided separately)
   - Includes appropriate WHERE clauses based on the user's question
   - Uses appropriate aggregations if needed
   - Is secure and properly parameterized
   - Returns only the necessary columns
   - If the question involves filtering by emotions, use the emotions jsonb field
   - If the question involves filtering by entities, use the entities jsonb field (an array of objects with type and name)

4. For vector similarity parts, specify what text should be used for the embedding search.

Return your response in the following JSON format:
{
  "analysis": "Brief explanation of how you're approaching this query",
  "requiresSql": true/false,
  "sqlQuery": "The SQL query to execute (if applicable)",
  "requiresVectorSearch": true/false,
  "vectorSearchText": "The text to use for vector search (if applicable)",
  "combinedApproach": true/false,
  "explanation": "Explanation of your reasoning"
}

Important: For the SQL query, the user_id parameter will be passed separately, so use $1 as a parameter placeholder for the user_id in the SQL query.

Special attention to entity and emotion filtering: 
- For emotion filters (e.g., "when was I happy?"), check if the emotions jsonb field contains the emotion key with significant value (e.g., WHERE emotions->>'happy' > '0.5')
- For entity filters (e.g., "what did I write about my workplace?"), check if any of the entities match the type or name mentioned (e.g., WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(entities) e WHERE e->>'type' = 'organization'))`;

    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

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
          { role: 'user', content: userQuery }
        ],
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from GPT API:', errorText);
      throw new Error(`Failed to get response from GPT: ${errorText}`);
    }

    const result = await response.json();
    const analysisText = result.choices[0].message.content;
    
    try {
      const analysisJson = JSON.parse(analysisText);
      return analysisJson;
    } catch (parseError) {
      console.error("Failed to parse GPT response as JSON:", parseError);
      console.log("Raw response:", analysisText);
      throw new Error('Invalid JSON response from GPT');
    }
  } catch (error) {
    console.error("Error in analyzeQueryWithGPT:", error);
    if (error.name === 'AbortError') {
      throw new Error('GPT analysis timed out after 20 seconds');
    }
    throw error;
  }
}

// Function to execute SQL query generated by GPT
async function executeSqlQuery(sqlQuery: string, userId: string) {
  try {
    console.log("Executing SQL query:", sqlQuery);
    
    // Execute the SQL query with the userId as a parameter
    const { data, error, count } = await supabase.rpc('execute_dynamic_query', {
      query_text: sqlQuery,
      param_values: [userId]
    });
    
    if (error) {
      console.error("Error executing SQL query:", error);
      
      // Fallback: If the RPC method doesn't exist, try a direct query
      // Note: This is less secure and should be replaced with proper RPC
      console.log("Attempting direct query as fallback");
      
      const fallbackQuery = sqlQuery.replace('$1', `'${userId}'`);
      const { data: fallbackData, error: fallbackError } = await supabase.query(fallbackQuery);
      
      if (fallbackError) {
        console.error("Error in fallback query:", fallbackError);
        throw fallbackError;
      }
      
      return { data: fallbackData, count: fallbackData?.length || 0 };
    }
    
    return { data, count };
  } catch (error) {
    console.error("Error in executeSqlQuery:", error);
    throw error;
  }
}

// Function to perform vector similarity search
async function performVectorSearch(
  queryEmbedding: any,
  userId: string,
  sqlFilteredIds: number[] | null = null,
  matchThreshold: number = 0.5,
  matchCount: number = 5
) {
  try {
    console.log("Performing vector similarity search");
    
    let params: any = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId
    };
    
    let functionName = 'match_journal_entries_with_date';
    
    // If we have SQL filtered IDs, we need to further filter the vector search
    if (sqlFilteredIds && sqlFilteredIds.length > 0) {
      console.log(`Restricting vector search to ${sqlFilteredIds.length} pre-filtered entries`);
      
      // This would require a custom function that accepts an array of IDs
      // For now, we'll implement a client-side filter
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        console.error("Error in vector similarity search:", error);
        throw error;
      }
      
      // Filter the results client-side to only include the pre-filtered IDs
      const filteredResults = data?.filter(item => 
        sqlFilteredIds.includes(Number(item.id))
      ) || [];
      
      console.log(`Vector search returned ${filteredResults.length} results after filtering`);
      return filteredResults;
    } else {
      // Standard vector search without pre-filtering
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        console.error("Error in vector similarity search:", error);
        throw error;
      }
      
      console.log(`Vector search returned ${data?.length || 0} results`);
      return data || [];
    }
  } catch (error) {
    console.error("Error in performVectorSearch:", error);
    throw error;
  }
}

// Function to generate the final response using GPT
async function generateFinalResponse(
  userQuery: string,
  sqlResults: any[] | null,
  vectorResults: any[] | null,
  analysisJson: any
) {
  try {
    console.log("Generating final response with GPT");
    
    // Create context from SQL results
    let sqlContext = "No SQL results available.";
    if (sqlResults && sqlResults.length > 0) {
      sqlContext = `SQL Query Results (${sqlResults.length} rows):\n${JSON.stringify(sqlResults, null, 2)}`;
    }
    
    // Create context from vector similarity results
    let vectorContext = "No vector similarity results available.";
    if (vectorResults && vectorResults.length > 0) {
      vectorContext = `Vector Similarity Results (${vectorResults.length} entries):\n` +
        vectorResults.map((entry, i) => 
          `Entry ${i+1} (Similarity: ${entry.similarity.toFixed(2)}):\n${entry.content}`
        ).join('\n\n');
    }
    
    // Combine both contexts
    const combinedContext = `
User Query: ${userQuery}

Analysis: ${analysisJson.analysis}

${analysisJson.requiresSql ? sqlContext : ''}

${analysisJson.requiresVectorSearch ? vectorContext : ''}
`;

    // System prompt for response generation
    const systemPrompt = `You are a helpful AI assistant named SOULo that helps users understand their journal entries.
Based on the user's query and the data provided below, generate a thoughtful, helpful response.
Focus on answering the user's question directly using the available data.
If the data doesn't contain relevant information to answer the query, acknowledge this limitation.
Keep your tone warm, supportive, and conversational.

${combinedContext}`;

    console.log("Sending context to GPT for final response");
    
    // Add a timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
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
          { role: 'user', content: userQuery }
        ],
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from GPT API:', errorText);
      throw new Error(`Failed to get response from GPT: ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error in generateFinalResponse:", error);
    if (error.name === 'AbortError') {
      throw new Error('GPT response generation timed out after 20 seconds');
    }
    throw error;
  }
}

// Main handler function for the edge function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const diagnostics = {
    timings: {
      total: 0,
      analysis: 0,
      embedding: 0,
      sqlExecution: 0,
      vectorSearch: 0,
      responseGeneration: 0
    },
    error: null
  };

  try {
    const { message, userId, includeDiagnostics = false } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Missing required parameters: message and userId');
    }

    console.log("Processing smart-chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Step 1: Ask GPT to analyze the query and generate SQL if needed
    const analysisStartTime = Date.now();
    const analysisJson = await analyzeQueryWithGPT(message, userId);
    diagnostics.timings.analysis = Date.now() - analysisStartTime;
    
    console.log("Query analysis:", JSON.stringify(analysisJson));
    
    // Step 2: Generate embedding for the query (for vector search)
    let queryEmbedding = null;
    let vectorResults = null;
    let sqlResults = null;
    let sqlFilteredIds = null;
    
    // Step 3: Execute SQL query if needed
    if (analysisJson.requiresSql) {
      const sqlStartTime = Date.now();
      try {
        const sqlResult = await executeSqlQuery(analysisJson.sqlQuery, userId);
        sqlResults = sqlResult.data;
        
        // If we have SQL results and need vector search, extract IDs for filtering
        if (analysisJson.combinedApproach && sqlResults && sqlResults.length > 0) {
          sqlFilteredIds = sqlResults.map(row => Number(row.id)).filter(id => !isNaN(id));
        }
        
        diagnostics.timings.sqlExecution = Date.now() - sqlStartTime;
      } catch (sqlError) {
        console.error("Error executing SQL:", sqlError);
        // Continue with vector search if applicable
        diagnostics.error = `SQL execution error: ${sqlError.message}`;
      }
    }
    
    // Step 4: Perform vector similarity search if needed
    if (analysisJson.requiresVectorSearch) {
      const embeddingStartTime = Date.now();
      
      try {
        // Use the specified vector search text if available, otherwise use the original query
        const vectorSearchText = analysisJson.vectorSearchText || message;
        queryEmbedding = await generateEmbedding(vectorSearchText);
        diagnostics.timings.embedding = Date.now() - embeddingStartTime;
        
        const vectorStartTime = Date.now();
        vectorResults = await performVectorSearch(
          queryEmbedding, 
          userId,
          sqlFilteredIds
        );
        diagnostics.timings.vectorSearch = Date.now() - vectorStartTime;
      } catch (vectorError) {
        console.error("Error in vector search:", vectorError);
        // Continue with SQL results if available
        if (!diagnostics.error) {
          diagnostics.error = `Vector search error: ${vectorError.message}`;
        } else {
          diagnostics.error += `; Vector search error: ${vectorError.message}`;
        }
      }
    }
    
    // Step 5: Generate final response with GPT
    const responseStartTime = Date.now();
    const finalResponse = await generateFinalResponse(
      message, 
      sqlResults, 
      vectorResults,
      analysisJson
    );
    diagnostics.timings.responseGeneration = Date.now() - responseStartTime;
    
    // Calculate total time
    diagnostics.timings.total = Date.now() - startTime;
    
    // Prepare response object
    const responseObject = {
      response: finalResponse,
      analysis: analysisJson
    };
    
    // Include additional data if diagnostics requested
    if (includeDiagnostics) {
      responseObject.diagnostics = diagnostics;
      
      // Include SQL and vector results for debugging
      if (sqlResults) {
        responseObject.sqlResults = sqlResults;
      }
      
      if (vectorResults) {
        responseObject.vectorResults = vectorResults;
      }
    }
    
    return new Response(
      JSON.stringify(responseObject),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("Error in smart-chat function:", error);
    
    diagnostics.timings.total = Date.now() - startTime;
    diagnostics.error = error.message;
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        diagnostics: diagnostics
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
