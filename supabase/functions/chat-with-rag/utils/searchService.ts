
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function searchEntriesWithVector(supabase: any, query: string, userId: string, limit: number = 10) {
  console.log(`Searching entries with vector similarity for user ${userId}`);
  
  try {
    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      console.error('Failed to generate embedding');
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for similar entries using the vector similarity function
    const { data, error } = await supabase.rpc('match_journal_entries', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      user_id_filter: userId
    });

    if (error) {
      console.error('Error in vector search:', error);
      return [];
    }

    console.log(`Found ${data ? data.length : 0} entries with vector similarity`);
    return data || [];

  } catch (error) {
    console.error('Error in searchEntriesWithVector:', error);
    return [];
  }
}

export async function searchEntriesWithTimeRange(
  supabase: any, 
  query: string, 
  userId: string, 
  startDate: string, 
  endDate: string,
  limit: number = 10
) {
  console.log(`Searching entries with time range for userId: ${userId}`);
  console.log(`Time range: from ${startDate} to ${endDate}`);
  
  try {
    // Parse dates to ensure they're valid
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    console.log(`Start date parsed: ${start.toISOString()} (${start})`);
    console.log(`End date parsed: ${end.toISOString()} (${end})`);
    
    console.log(`Sending time range to database: from ${start.toISOString()} to ${end.toISOString()}`);

    // Generate embedding for better matching
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query,
      }),
    });

    let queryEmbedding = null;
    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      queryEmbedding = embeddingData.data[0].embedding;
    }

    // Call the time-filtered vector search function
    const { data, error } = await supabase.rpc('match_journal_entries_time_filtered', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      user_id_filter: userId,
      start_date: start.toISOString(),
      end_date: end.toISOString()
    });

    console.log(`Database function parameters:`, {
      query_embedding: queryEmbedding ? '[array with 1536 elements]' : 'null',
      match_threshold: 0.5,
      match_count: limit,
      user_id_filter: userId,
      start_date: start.toISOString(),
      end_date: end.toISOString()
    });

    if (error) {
      console.error('Error in time-filtered vector search:', error);
      return [];
    }

    console.log(`Found ${data ? data.length : 0} entries with time-filtered vector similarity`);
    return data || [];

  } catch (error) {
    console.error('Error in searchEntriesWithTimeRange:', error);
    return [];
  }
}

export async function searchEntriesByMonth(supabase: any, query: string, userId: string, month: number, year: number) {
  console.log(`Searching entries by month: ${month}/${year} for user ${userId}`);
  
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    return await searchEntriesWithTimeRange(supabase, query, userId, startDate.toISOString(), endDate.toISOString());
  } catch (error) {
    console.error('Error in searchEntriesByMonth:', error);
    return [];
  }
}
