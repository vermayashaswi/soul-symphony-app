
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding for the search query
async function generateEmbedding(text: string) {
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002',
    }),
  });

  if (!embeddingResponse.ok) {
    const errorData = await embeddingResponse.json();
    console.error('OpenAI API error:', errorData);
    throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
  }

  const embeddingData = await embeddingResponse.json();
  return embeddingData.data[0].embedding;
}

// Store the user query for analytics
async function storeUserQuery(userId: string, queryText: string, threadId: string, messageId?: string) {
  try {
    const embedding = await generateEmbedding(queryText);
    
    // Use direct SQL query to store the user query
    const { data, error } = await supabase
      .from('user_queries')
      .insert({
        user_id: userId,
        query_text: queryText,
        embedding: embedding,
        thread_id: threadId,
        message_id: messageId
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error storing user query:', error);
    } else {
      console.log('Successfully stored user query with ID:', data.id);
    }
    
    return data?.id;
  } catch (error) {
    console.error('Error in storeUserQuery:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userId, threadId, messageId, similarityThreshold = 0.7, matchCount = 5 } = await req.json();
    
    if (!query || !userId) {
      throw new Error('Query and userId are required');
    }

    console.log(`Searching for journal entries similar to: "${query}"`);
    
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Store the user query for analytics
    await storeUserQuery(userId, query, threadId, messageId);
    
    // Directly query the journal_embeddings table and join with Journal Entries
    // This avoids using the function with the fixed search path that might not work correctly
    const { data: matchResults, error: matchError } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: embedding,
        match_threshold: similarityThreshold,
        match_count: matchCount,
        user_id_filter: userId
      }
    );

    if (matchError) {
      console.error('Error using match_journal_entries RPC:', matchError);
      
      // Fallback to direct query if the RPC fails
      const { data: entries, error: entriesError } = await supabase
        .from('journal_embeddings')
        .select(`
          content,
          journal_entry_id,
          "Journal Entries!journal_entry_id"(id, "refined text", "transcription text", created_at, emotions, master_themes, user_id)
        `)
        .filter('Journal Entries.user_id', 'eq', userId)
        .limit(matchCount);
        
      if (entriesError) {
        console.error('Error with fallback query:', entriesError);
        throw new Error(`Database query error: ${entriesError.message}`);
      }
      
      // Process entries from the fallback query
      const results = entries?.map(entry => {
        const journalEntry = entry["Journal Entries!journal_entry_id"];
        return {
          id: journalEntry.id,
          content: journalEntry["refined text"] || journalEntry["transcription text"] || entry.content,
          created_at: journalEntry.created_at,
          emotions: journalEntry.emotions,
          master_themes: journalEntry.master_themes,
          similarity: 0.7 // Default similarity since we can't easily calculate it here
        };
      }) || [];
      
      return new Response(
        JSON.stringify({ 
          results,
          count: results.length,
          query
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If the RPC was successful, we need to fetch the full journal entries
    if (matchResults && matchResults.length > 0) {
      const entryIds = matchResults.map(result => result.id);
      
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text", created_at, emotions, master_themes')
        .in('id', entryIds)
        .eq('user_id', userId);
        
      if (entriesError) {
        console.error('Error fetching full journal entries:', entriesError);
        throw new Error(`Error fetching journal entries: ${entriesError.message}`);
      }
      
      // Combine the match results with the full entries
      const results = matchResults.map(match => {
        const entry = entries?.find(e => e.id === match.id);
        return {
          ...match,
          content: entry ? (entry["refined text"] || entry["transcription text"] || match.content) : match.content,
          created_at: entry?.created_at,
          emotions: entry?.emotions,
          master_themes: entry?.master_themes
        };
      });
      
      console.log(`Found ${results.length} journal entries`);
      
      return new Response(
        JSON.stringify({ 
          results,
          count: results.length,
          query
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          results: [],
          count: 0,
          query
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in search-journal function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        success: false,
        message: "Error occurred during journal search"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
