
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query: userQuery, userId, timeRange } = await req.json();

    if (!userQuery || !userId) {
      console.error('Missing user query or user ID');
      return new Response(JSON.stringify({ error: 'Missing user query or user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Received query: ${userQuery} for user ID: ${userId}`);

    // 1. Generate embedding for the user query
    console.log('Generating embedding for the user query');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: userQuery,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding for the query:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate embedding for the query' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      console.error('Failed to generate embedding for the query');
      return new Response(JSON.stringify({ error: 'Failed to generate embedding for the query' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Search for relevant journal entries
    console.log('Searching for relevant journal entries');
    const entries = await searchJournalEntries(userId, queryEmbedding, timeRange);

    // 3. Segment the complex query based on journal entries
    console.log('Segmenting the complex query based on journal entries');
    const segmentedQuery = await segmentComplexQuery(userQuery, entries, apiKey);

    // 4. Return the segmented query
    console.log('Returning the segmented query');
    return new Response(JSON.stringify({ data: segmentedQuery }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

async function searchJournalEntries(
  userId: string, 
  queryEmbedding: any[],
  timeRange?: { startDate?: Date; endDate?: Date }
) {
  try {
    console.log(`Searching journal entries for userId: ${userId}`);
    
    // Use the fixed function we created
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
    console.error('Error searching journal entries:', error);
    throw error;
  }
}

async function segmentComplexQuery(userQuery: string, entries: any[], apiKey: string) {
  try {
    console.log('Starting query segmentation');

    const prompt = `You are an AI assistant that segments complex user queries into simpler questions based on provided journal entries.
      User Query: ${userQuery}
      Relevant Journal Entries: ${JSON.stringify(entries)}
      Instructions:
      1. Analyze the user query and identify its main components.
      2. Break down the complex query into simpler, more specific questions that can be answered using the journal entries.
      3. Ensure each segmented question is clear, concise, and directly related to the original query.
      4. Provide the segmented questions in a JSON array format.
      Example:
      [
        "What were the main topics discussed in the journal entries?",
        "How did the user feel about these topics?",
        "Were there any specific actions or decisions made regarding these topics?"
      ]`;

    console.log('Calling OpenAI to segment the query');
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!completion.ok) {
      const error = await completion.text();
      console.error('Failed to segment the query:', error);
      return 'Failed to segment the query';
    }

    const completionData = await completion.json();
    if (!completionData.choices || completionData.choices.length === 0) {
      console.error('Failed to segment the query');
      return 'Failed to segment the query';
    }

    const segmentedQuery = completionData.choices[0].message.content;
    console.log(`Segmented query: ${segmentedQuery}`);
    return segmentedQuery;
  } catch (error) {
    console.error('Error segmenting complex query:', error);
    throw error;
  }
}
