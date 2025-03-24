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

// Format emotions data into a readable string
function formatEmotions(emotions: Record<string, number> | null | undefined): string {
  if (!emotions) return "No emotion data available";
  
  // Sort emotions by intensity (highest first)
  const sortedEmotions = Object.entries(emotions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3); // Take top 3 emotions for brevity
    
  return sortedEmotions
    .map(([emotion, intensity]) => {
      // Convert intensity to percentage and format emotion name
      const percentage = Math.round(intensity * 100);
      const formattedEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      return `${formattedEmotion} (${percentage}%)`;
    })
    .join(", ");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, isNewThread, threadTitle } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    let currentThreadId = threadId;
    console.log("=== RAG CHAT REQUEST ===");
    console.log("User ID:", userId);
    console.log("Thread ID:", currentThreadId);
    console.log("Is new thread:", isNewThread);
    console.log("Message preview:", message.substring(0, 50) + (message.length > 50 ? "..." : ""));
    
    // Check if this user has any journal entries and generate embeddings if needed
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, refined text')
      .eq('user_id', userId);
      
    if (entriesError) {
      console.error("Error fetching journal entries:", entriesError);
    } else if (entries && entries.length > 0) {
      console.log(`User has ${entries.length} journal entries`);
      
      // Check which entries have embeddings
      const entryIds = entries.map(entry => entry.id);
      const { data: existingEmbeddings, error: embeddingsError } = await supabase
        .from('journal_embeddings')
        .select('journal_entry_id')
        .in('journal_entry_id', entryIds);
        
      if (embeddingsError) {
        console.error("Error checking existing embeddings:", embeddingsError);
      } else {
        const existingEmbeddingIds = existingEmbeddings?.map(e => e.journal_entry_id) || [];
        const entriesWithoutEmbeddings = entries.filter(entry => 
          !existingEmbeddingIds.includes(entry.id) && entry["refined text"]
        );
        
        console.log(`Found ${entriesWithoutEmbeddings.length} entries without embeddings`);
        
        // Generate embeddings for entries that don't have them
        for (const entry of entriesWithoutEmbeddings.slice(0, 5)) { // Limit to 5 to avoid timeout
          if (!entry["refined text"]) continue;
          
          try {
            // Generate embedding
            const embedding = await generateEmbedding(entry["refined text"]);
            
            // Store embedding in database
            await supabase
              .from('journal_embeddings')
              .insert({
                journal_entry_id: entry.id,
                embedding: embedding,
                content: entry["refined text"]
              });
              
            console.log(`Generated embedding for entry ${entry.id}`);
          } catch (error) {
            console.error(`Error generating embedding for entry ${entry.id}:`, error);
          }
        }
      }
    }
    
    // Store user message and get its ID
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: currentThreadId || 'temp',
        content: message,
        sender: 'user'
      })
      .select('id')
      .single();
      
    if (messageError) {
      console.error("Error storing user message:", messageError);
    }
    
    const userMessageId = messageData?.id;
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    
    // Store user query with embedding
    if (userMessageId) {
      await supabase
        .from('user_queries')
        .insert({
          user_id: userId,
          query_text: message,
          embedding: queryEmbedding,
          thread_id: currentThreadId,
          message_id: userMessageId
        });
    }
    
    // Search for journal entries using the embedding
    const { data: matchingEntries, error: matchError } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        user_id_filter: userId
      }
    );
    
    if (matchError) {
      console.error("Error in match_journal_entries function:", matchError);
    }
    
    console.log(`Found ${matchingEntries?.length || 0} matching journal entries`);
    
    // Create RAG context from relevant entries
    let journalContext = "";
    if (matchingEntries && matchingEntries.length > 0) {
      console.log("Found similar entries:", matchingEntries.length);
      
      // Fetch full entries for context
      const entryIds = matchingEntries.map(entry => entry.id);
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at, emotions')
        .in('id', entryIds);
      
      if (entriesError) {
        console.error("Error retrieving journal entries:", entriesError);
      } else if (entries && entries.length > 0) {
        console.log("Retrieved full entries:", entries.length);
        // Format entries as context with emotions data
        journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
          entries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
      }
    } else {
      console.log("No similar entries found, falling back to recent entries");
      // Fallback to recent entries if no similar ones found
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at, emotions')
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
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
      }
    }
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic.`;

    console.log("Sending to GPT with RAG context...");
    
    try {
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
    } catch (apiError) {
      console.error("API error:", apiError);
      
      // Return a 200 status even for errors to avoid CORS issues
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          response: "I'm having trouble connecting right now. Please try again later.",
          success: false 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in chat-rag function:", error);
    
    // Return 200 status even for errors to avoid CORS issues
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        success: false 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
