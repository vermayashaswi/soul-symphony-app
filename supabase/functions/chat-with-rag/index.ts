
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers directly in the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add diagnostic helper function at the beginning of the edge function
function createDiagnosticStep(name: string, status: string, details: any = null) {
  return {
    name,
    status,
    details,
    timestamp: new Date().toISOString()
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, queryTypes, threadId, includeDiagnostics, vectorSearch, isEmotionQuery, isWhyEmotionQuery, isTimePatternQuery, isTemporalQuery, requiresTimeAnalysis, timeRange } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log("Time range received:", timeRange);

    // Add this where appropriate in the main request handler:
    const diagnostics = {
      steps: [],
      similarityScores: [],
      functionCalls: [],
      references: []
    };
    
    // Safely check properties before using them
    const safeQueryTypes = {
      isEmotionQuery: isEmotionQuery || false,
      isWhyEmotionQuery: isWhyEmotionQuery || false,
      isTemporalQuery: isTemporalQuery || false,
      timeRange: timeRange ? 
        `${timeRange.startDate || 'unspecified'} to ${timeRange.endDate || 'unspecified'}` : 
        "none"
    };
    
    diagnostics.steps.push(createDiagnosticStep(
      "Query Type Analysis", 
      "success", 
      JSON.stringify(safeQueryTypes)
    ));
    
    // 1. Generate embedding for the message
    console.log("Generating embedding for message");
    diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "loading"));
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: message,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding:', error);
      diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "error", error));
      throw new Error('Could not generate embedding for the message');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "error", "No embedding data returned"));
      throw new Error('Could not generate embedding for the message');
    }

    const queryEmbedding = embeddingData.data[0].embedding;
    console.log("Embedding generated successfully");
    diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "success"));

    // 2. Search for relevant entries with proper temporal filtering
    console.log("Searching for relevant entries");
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "loading"));
    
    // Use different search function based on whether we have a time range
    let entries = [];
    if (timeRange && (timeRange.startDate || timeRange.endDate)) {
      console.log(`Using time-filtered search with range: ${JSON.stringify(timeRange)}`);
      entries = await searchEntriesWithTimeRange(userId, queryEmbedding, timeRange);
    } else {
      console.log("Using standard vector search without time filtering");
      entries = await searchEntriesWithVector(userId, queryEmbedding);
    }
    
    console.log(`Found ${entries.length} relevant entries`);
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "success", `Found ${entries.length} entries`));

    // 3. Prepare prompt
    const prompt = `You are a personal mental well-being assistant. Your goal is to provide helpful, empathetic, and insightful responses based on the user's journal entries.
      Here are some of the user's journal entries:
      ${entries.map((entry) => `- ${entry.content}`).join('\n')}
      
      Now, respond to the following message from the user:
      ${message}
      
      Keep your answers concise and to the point. Focus on providing actionable insights and support.`;

    // 4. Call OpenAI
    console.log("Calling OpenAI for completion");
    diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "loading"));
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "error", error));
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    console.log("Response generated successfully");
    diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "success"));

    // 5. Return response
    return new Response(
      JSON.stringify({ 
        response: responseContent, 
        diagnostics: includeDiagnostics ? diagnostics : undefined,
        references: entries.map(entry => ({
          id: entry.id,
          content: entry.content,
          created_at: entry.created_at,
          similarity: entry.similarity
        }))
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// Standard vector search without time filtering
async function searchEntriesWithVector(
  userId: string, 
  queryEmbedding: any[]
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId
      }
    );
    
    if (error) {
      console.error(`Error in vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching entries with vector:', error);
    throw error;
  }
}

// Time-filtered vector search
async function searchEntriesWithTimeRange(
  userId: string, 
  queryEmbedding: any[], 
  timeRange: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`Searching entries with time range for userId: ${userId}`);
    console.log(`Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId,
        start_date: timeRange.startDate || null,
        end_date: timeRange.endDate || null
      }
    );
    
    if (error) {
      console.error(`Error in time-filtered vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with time-filtered vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching entries with time range:', error);
    throw error;
  }
}
