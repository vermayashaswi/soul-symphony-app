
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

// Generate a summarized title for a new chat thread
async function generateThreadTitle(message: string, userId: string) {
  try {
    console.log("Generating title for thread based on message:", message.substring(0, 30) + "...");
    
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
            content: 'You are a helpful assistant that generates concise, descriptive titles for chat conversations. The title should be no longer than 5-6 words and should capture the essence of the user\'s message.'
          },
          {
            role: 'user',
            content: `Generate a short, descriptive title for a chat that starts with this message: "${message}"`
          }
        ],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate thread title');
    }

    const result = await response.json();
    const generatedTitle = result.choices[0].message.content.trim().replace(/^"|"$/g, '');
    console.log("Generated title:", generatedTitle);
    
    return generatedTitle || message.substring(0, 30) + (message.length > 30 ? "..." : "");
  } catch (error) {
    console.error("Error generating thread title:", error);
    return message.substring(0, 30) + (message.length > 30 ? "..." : "");
  }
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

// Fetch journal entries directly by user ID
async function fetchJournalEntriesByUserId(userId: string, limit: number = 5) {
  console.log(`Directly fetching up to ${limit} journal entries for user ID: ${userId}`);
  
  const { data, error } = await supabase
    .from('Journal Entries')
    .select('id, refined text, created_at, emotions, master_themes')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Error fetching journal entries:", error);
    return [];
  }
  
  console.log(`Successfully retrieved ${data.length} journal entries`);
  return data;
}

// Try to fetch journal entries using vector similarity
async function fetchSimilarJournalEntries(embedding: any, userId: string, limit: number = 5) {
  try {
    console.log(`Attempting to fetch similar journal entries for user ${userId} using vector similarity`);
    
    // First try the match_journal_entries function
    const { data, error } = await supabase
      .rpc('match_journal_entries', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit,
        user_id_filter: userId
      });
    
    if (error) {
      console.error("Error with match_journal_entries function:", error);
      throw error;
    }
    
    console.log(`Vector similarity search returned ${data?.length || 0} results`);
    
    // If we got results, fetch the full entries
    if (data && data.length > 0) {
      const entryIds = data.map(item => item.id);
      const { data: fullEntries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, refined text, created_at, emotions, master_themes')
        .in('id', entryIds);
      
      if (entriesError) {
        console.error("Error fetching full journal entries:", entriesError);
        throw entriesError;
      }
      
      return fullEntries;
    }
    
    return [];
  } catch (error) {
    console.error("Error in fetchSimilarJournalEntries:", error);
    // Fall back to direct fetch if there's any error
    return await fetchJournalEntriesByUserId(userId, limit);
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
      let title = threadTitle;
      
      // Generate a better title using AI if not provided or just a simple truncation
      if (!title || title === message.substring(0, 30) + (message.length > 30 ? "..." : "")) {
        title = await generateThreadTitle(message, userId);
      }
      
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
    } else {
      // Update the thread's updated_at timestamp
      const { error: updateError } = await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
        
      if (updateError) {
        console.error("Error updating thread timestamp:", updateError);
      }
    }
    
    // Store user message
    await storeMessage(currentThreadId, message, 'user');
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    
    // Store user query with embedding for future use
    await storeUserQuery(userId, message, queryEmbedding);
    
    console.log("User ID for journal entries search:", userId);
    
    // Try to find journal entries using vector similarity first, then fall back to direct fetch
    let journalEntries = [];
    try {
      journalEntries = await fetchSimilarJournalEntries(queryEmbedding, userId);
    } catch (error) {
      console.error("Error fetching similar journal entries:", error);
      journalEntries = await fetchJournalEntriesByUserId(userId);
    }
    
    // If we still don't have entries, log this information
    if (!journalEntries || journalEntries.length === 0) {
      console.log("No journal entries found for user ID:", userId);
    } else {
      console.log(`Found ${journalEntries.length} journal entries for context`);
    }
    
    // Create RAG context from relevant entries
    let journalContext = "";
    let referenceEntries = [];
    
    if (journalEntries && journalEntries.length > 0) {
      // Store reference information
      referenceEntries = journalEntries.map(entry => ({
        id: entry.id,
        date: entry.created_at,
        snippet: entry["refined text"]?.substring(0, 100) + "...",
        type: "semantic_match"
      }));
      
      journalContext = "Here are some of your relevant journal entries:\n\n" + 
        journalEntries.map((entry, index) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const emotionsText = formatEmotions(entry.emotions);
          const themesText = entry.master_themes ? 
            `Key themes: ${entry.master_themes.slice(0, 5).join(', ')}` : '';
          return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}\n${themesText}`;
        }).join('\n\n') + "\n\n";
    } else {
      console.log("No journal entries found for user");
      journalContext = "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings.";
    }
    
    // Get conversation history for this thread
    const previousMessages = await getThreadHistory(currentThreadId);
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext}
Based on the above context (if available) and the conversation history, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic. Reference specific themes, emotions, or content from their journal when relevant.`;

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
