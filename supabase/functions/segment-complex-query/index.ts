
import { serve } from 'std/server';
import { cors } from '../_shared/cors.ts';
import { supabase } from '../_shared/supabase.ts';
import { OpenAI } from "https://deno.land/x/openai@v1.3.0/mod.ts";

const apiKey = Deno.env.get('OPENAI_API_KEY');
const openai = new OpenAI(apiKey || '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors(req.headers) });
  }

  try {
    const { query: userQuery, userId, timeRange } = await req.json();

    if (!userQuery || !userId) {
      console.error('Missing user query or user ID');
      return new Response(JSON.stringify({ error: 'Missing user query or user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors(req.headers) },
      });
    }

    console.log(`Received query: ${userQuery} for user ID: ${userId}`);

    // 1. Generate embedding for the user query
    console.log('Generating embedding for the user query');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: userQuery,
    });

    if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
      console.error('Failed to generate embedding for the query');
      return new Response(JSON.stringify({ error: 'Failed to generate embedding for the query' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors(req.headers) },
      });
    }

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Search for relevant journal entries
    console.log('Searching for relevant journal entries');
    const entries = await searchJournalEntries(userId, queryEmbedding, timeRange);

    // 3. Segment the complex query based on journal entries
    console.log('Segmenting the complex query based on journal entries');
    const segmentedQuery = await segmentComplexQuery(userQuery, entries);

    // 4. Return the segmented query
    console.log('Returning the segmented query');
    return new Response(JSON.stringify({ data: segmentedQuery }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors(req.headers) },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors(req.headers) },
    });
  }
});

// Update any function that searches journal entries using vector similarity
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

async function segmentComplexQuery(userQuery: string, entries: any[]) {
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
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
    });

    if (!completion.choices || completion.choices.length === 0) {
      console.error('Failed to segment the query');
      return 'Failed to segment the query';
    }

    const segmentedQuery = completion.choices[0].message.content;
    console.log(`Segmented query: ${segmentedQuery}`);
    return segmentedQuery;
  } catch (error) {
    console.error('Error segmenting complex query:', error);
    throw error;
  }
}
