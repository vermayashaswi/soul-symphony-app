
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
    const { message, userId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    
    // Check if this is an emotion analysis query
    const emotionQueryPattern = /top\s+emotions|emotions\s+summary|main\s+emotions|emotional\s+state|emotion\s+analysis/i;
    const isEmotionQuery = emotionQueryPattern.test(message);
    const isLastMonthPattern = /last\s+month|previous\s+month|past\s+month/i;
    const isLastMonth = isLastMonthPattern.test(message);

    // If it's an emotion query, handle it specially
    if (isEmotionQuery) {
      console.log("Detected emotion analysis query, handling specially");
      return await handleEmotionQuery(userId, isLastMonth, corsHeaders);
    }
    
    // 1. Generate embedding for the message
    console.log("Generating embedding for message");
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
      throw new Error('Could not generate embedding for the message');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Could not generate embedding for the message');
    }

    const queryEmbedding = embeddingData.data[0].embedding;
    console.log("Embedding generated successfully");

    // 2. Search for relevant entries
    console.log("Searching for relevant entries");
    const entries = await searchEntriesWithVector(userId, queryEmbedding);
    console.log(`Found ${entries.length} relevant entries`);

    // 3. Prepare prompt
    const prompt = `You are a personal mental well-being assistant. Your goal is to provide helpful, empathetic, and insightful responses based on the user's journal entries.
      Here are some of the user's journal entries:
      ${entries.map((entry) => `- ${entry.content}`).join('\n')}
      
      Now, respond to the following message from the user:
      ${message}
      
      Keep your answers concise and to the point. Focus on providing actionable insights and support.`;

    // 4. Call OpenAI
    console.log("Calling OpenAI for completion");
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
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    console.log("Response generated successfully");

    // 5. Return response
    return new Response(
      JSON.stringify({ data: responseContent }),
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

// Handle emotion analysis queries
async function handleEmotionQuery(userId: string, isLastMonth: boolean, corsHeaders: Record<string, string>) {
  try {
    console.log(`Processing emotion analysis query for user: ${userId}, isLastMonth: ${isLastMonth}`);
    
    const currentDate = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = currentDate;
    
    if (isLastMonth) {
      // Set to first day of previous month
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      // Set to last day of previous month
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    }
    
    console.log(`Date range: ${startDate?.toISOString()} to ${endDate?.toISOString()}`);
    
    // Call the get_top_emotions_with_entries function
    const { data, error } = await supabase.rpc(
      'get_top_emotions_with_entries',
      {
        user_id_param: userId,
        start_date: startDate,
        end_date: endDate,
        limit_count: 5
      }
    );
    
    if (error) {
      console.error(`Error in emotion analysis: ${error.message}`);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log("No emotion data found");
      return new Response(
        JSON.stringify({ 
          data: "I couldn't find any emotion data for the specified time period. It seems there aren't enough journal entries with emotional content to analyze.",
          analysis: {
            type: 'top_emotions',
            data: []
          }
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    console.log(`Found ${data.length} top emotions`);
    
    // Format the response
    const emotionsList = data.map((item: any) => 
      `${item.emotion} (${(item.score * 100).toFixed(0)}%)`
    ).join(", ");
    
    const responseText = isLastMonth 
      ? `Based on your journal entries from last month, your top emotions were: ${emotionsList}. These emotions were most prominent in your writing during this period.`
      : `Based on your journal entries, your top emotions are: ${emotionsList}. These emotions appear most prominently in your writing.`;
    
    // Return the formatted response
    return new Response(
      JSON.stringify({ 
        data: responseText,
        references: data.flatMap((item: any) => 
          item.sample_entries ? item.sample_entries.map((entry: any) => ({
            id: entry.id,
            snippet: entry.content,
            date: entry.created_at,
            similarity: entry.score,
            emotions: { [item.emotion]: entry.score }
          })) : []
        ),
        analysis: {
          type: 'top_emotions',
          data: data.map((item: any) => ({
            emotion: item.emotion,
            score: item.score
          }))
        }
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error in emotion analysis:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// Update function to correctly pass parameters in the expected order
async function searchEntriesWithVector(
  userId: string, 
  queryEmbedding: any[], 
  timeRange?: { startDate?: Date; endDate?: Date }
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
    // Fix the parameters order according to the function definition
    // match_journal_entries_fixed(query_embedding, match_threshold, match_count, user_id_filter)
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
