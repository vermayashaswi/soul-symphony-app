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

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    console.log("Generating embedding for query:", text.substring(0, 50) + "...");
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
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    
    // Search for relevant journal entries using vector similarity
    console.log("Searching for relevant context using match_journal_entries function...");
    const { data: similarEntries, error: searchError } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        user_id_filter: userId
      }
    );
    
    if (searchError) {
      console.error("Error searching for similar entries:", searchError);
      console.error("Search error details:", JSON.stringify(searchError));
    }
    
    // Create RAG context from relevant entries
    let journalContext = "";
    if (similarEntries && similarEntries.length > 0) {
      console.log("Found similar entries:", similarEntries.length);
      
      // Fetch full entries for context
      const entryIds = similarEntries.map(entry => entry.id);
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at')
        .in('id', entryIds);
      
      if (entriesError) {
        console.error("Error retrieving journal entries:", entriesError);
      } else if (entries && entries.length > 0) {
        console.log("Retrieved full entries:", entries.length);
        // Format entries as context
        journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
          entries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            return `Entry ${index+1} (${date}): ${entry["refined text"]}`;
          }).join('\n\n') + "\n\n";
      }
    } else {
      console.log("No similar entries found, falling back to recent entries");
      // Fallback to recent entries if no similar ones found
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (recentError) {
        console.error("Error retrieving recent entries:", recentError);
      } else if (recentEntries && recentEntries.length > 0) {
        console.log("Retrieved recent entries:", recentEntries.length);
        journalContext = "Here are some of your recent journal entries:\n\n" + 
          recentEntries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            return `Entry ${index+1} (${date}): ${entry["refined text"]}`;
          }).join('\n\n') + "\n\n";
      }
    }
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Focus on being helpful rather than diagnostic.`;

    console.log("Sending to GPT with RAG context...");
    
    // Send to GPT with RAG context
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GPT API error:", errorText);
      throw new Error(`GPT API error: ${errorText}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log("AI response generated successfully");
    
    return new Response(
      JSON.stringify({ response: aiResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Error in chat-rag function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
