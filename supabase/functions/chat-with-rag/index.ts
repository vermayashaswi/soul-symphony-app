
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

// Retrieve and format thread history as context
async function getThreadHistory(threadId: string) {
  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(10); // Limit to most recent messages

  if (error) {
    console.error("Error retrieving thread history:", error);
    return [];
  }

  return messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
}

// Store user query with its embedding
async function storeUserQuery(userId: string, queryText: string, embedding: any) {
  const { error } = await supabase
    .from('user_queries')
    .insert({
      user_id: userId,
      query_text: queryText,
      embedding: embedding
    });

  if (error) {
    console.error("Error storing user query:", error);
  }
}

// Store assistant response in chat messages
async function storeMessage(threadId: string, content: string, sender: 'user' | 'assistant', references = null) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      content: content,
      sender: sender,
      reference_entries: references
    });

  if (error) {
    console.error("Error storing message:", error);
  }
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
    console.log("Processing chat request for user:", userId);
    console.log("Thread ID:", currentThreadId);
    console.log("Is new thread:", isNewThread);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Create a new thread if needed
    if (isNewThread) {
      const title = threadTitle || message.substring(0, 30) + (message.length > 30 ? "..." : "");
      const { data: newThread, error } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          title: title,
        })
        .select('id')
        .single();
        
      if (error) {
        console.error("Error creating new thread:", error);
        throw error;
      }
      
      currentThreadId = newThread.id;
      console.log("Created new thread with ID:", currentThreadId);
    }
    
    // Store user message
    await storeMessage(currentThreadId, message, 'user');
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    
    // Store user query with embedding for future use
    await storeUserQuery(userId, message, queryEmbedding);
    
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
    let referenceEntries = [];
    
    if (similarEntries && similarEntries.length > 0) {
      console.log("Found similar entries:", similarEntries.length);
      
      // Fetch full entries for context
      const entryIds = similarEntries.map(entry => entry.id);
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, refined text, created_at, emotions')
        .in('id', entryIds);
      
      if (entriesError) {
        console.error("Error retrieving journal entries:", entriesError);
      } else if (entries && entries.length > 0) {
        console.log("Retrieved full entries:", entries.length);
        
        // Store reference information
        referenceEntries = entries.map(entry => ({
          id: entry.id,
          date: entry.created_at,
          snippet: entry["refined text"]?.substring(0, 100) + "...",
          similarity: similarEntries.find(se => se.id === entry.id)?.similarity || 0
        }));
        
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
        .select('id, refined text, created_at, emotions')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (recentError) {
        console.error("Error retrieving recent entries:", recentError);
      } else if (recentEntries && recentEntries.length > 0) {
        console.log("Retrieved recent entries:", recentEntries.length);
        
        // Store reference information
        referenceEntries = recentEntries.map(entry => ({
          id: entry.id,
          date: entry.created_at,
          snippet: entry["refined text"]?.substring(0, 100) + "...",
          type: "recent"
        }));
        
        journalContext = "Here are some of your recent journal entries:\n\n" + 
          recentEntries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
      }
    }
    
    // Get conversation history for this thread
    const previousMessages = await getThreadHistory(currentThreadId);
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}
Based on the above context (if available) and the conversation history, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic.`;

    console.log("Sending to GPT with RAG context and conversation history...");
    
    try {
      // Send to GPT with RAG context and conversation history
      const messagesForGPT = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...previousMessages,
        {
          role: 'user',
          content: message
        }
      ];
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messagesForGPT,
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
      
      // Store assistant response
      await storeMessage(currentThreadId, aiResponse, 'assistant', referenceEntries.length > 0 ? referenceEntries : null);
      
      return new Response(
        JSON.stringify({ 
          response: aiResponse, 
          threadId: currentThreadId, 
          references: referenceEntries 
        }),
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
          success: false,
          threadId: currentThreadId
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in chat-with-rag function:", error);
    
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
