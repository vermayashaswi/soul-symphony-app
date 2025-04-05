
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { cors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { OpenAI } from "https://deno.land/x/openai@v1.3.0/mod.ts";

const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

const openai = new OpenAI(apiKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return cors(req, new Response('ok'));
  }

  try {
    const { message, userId } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    // 1. Generate embedding for the message
    const embeddingData = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: message,
    });

    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Could not generate embedding for the message');
    }

    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Search for relevant entries
    const entries = await searchEntriesWithVector(userId, queryEmbedding);

    // 3. Prepare prompt
    const prompt = `You are a personal mental well-being assistant. Your goal is to provide helpful, empathetic, and insightful responses based on the user's journal entries.
      Here are some of the user's journal entries:
      ${entries.map((entry) => `- ${entry.content}`).join('\n')}
      
      Now, respond to the following message from the user:
      ${message}
      
      Keep your answers concise and to the point. Focus on providing actionable insights and support.`;

    // 4. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: prompt }],
    });

    const responseContent = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // 5. Return response
    return cors(req, new Response(
      JSON.stringify({ data: responseContent }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
  } catch (error) {
    console.error('Error:', error);
    return cors(req, new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    ));
  }
});

// Update any function that searches for journal entries using vector similarity
async function searchEntriesWithVector(
  userId: string, 
  queryEmbedding: any[], 
  timeRange?: { startDate?: Date; endDate?: Date }
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
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
    console.error('Error searching entries with vector:', error);
    throw error;
  }
}
