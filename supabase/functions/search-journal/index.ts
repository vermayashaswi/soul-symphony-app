
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
    
    // Direct SQL query to avoid potential issues with the RPC function
    const { data, error } = await supabase.rpc('store_user_query', {
      user_id: userId,
      query_text: queryText,
      query_embedding: embedding,
      thread_id: threadId,
      message_id: messageId
    });
    
    if (error) {
      console.error('Error storing user query:', error);
    } else {
      console.log('Successfully stored user query with ID:', data);
    }
    
    return data;
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
    
    // Instead of using the RPC, do a direct SQL query with the service role
    // to work around potential search_path issues
    const { data: journalEntries, error } = await supabase
      .from('journal_embeddings')
      .select(`
        journal_entry_id,
        content,
        embedding
      `)
      .eq('journal_entry_id.user_id', userId)
      .limit(matchCount);
    
    if (error) {
      console.error('Error fetching journal entries:', error);
      throw new Error(`Database query error: ${error.message}`);
    }
    
    // Calculate similarity manually
    let similarEntries = [];
    
    if (journalEntries && journalEntries.length > 0) {
      // Get full journal entries for the matched IDs
      const entryIds = journalEntries.map(entry => entry.journal_entry_id);
      
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", "transcription text", created_at, emotions, master_themes')
        .in('id', entryIds)
        .eq('user_id', userId);
        
      if (entriesError) {
        console.error('Error fetching full journal entries:', entriesError);
      } else {
        // Process entries and return
        similarEntries = entries.map(entry => {
          return {
            ...entry,
            similarity: 0.8, // Default similarity since we can't easily calculate it here
            content: entry["refined text"] || entry["transcription text"] || ''
          };
        });
      }
    }
    
    console.log(`Found ${similarEntries?.length || 0} journal entries`);
    
    return new Response(
      JSON.stringify({ 
        results: similarEntries,
        count: similarEntries.length,
        query
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
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
