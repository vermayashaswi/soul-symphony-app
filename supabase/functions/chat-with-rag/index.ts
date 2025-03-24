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
async function generateThreadTitle(message: string) {
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
}

// Store user query with its embedding
async function storeUserQuery(userId: string, queryText: string, embedding: any, threadId: string, messageId: string | null = null) {
  const { error } = await supabase
    .from('user_queries')
    .insert({
      user_id: userId,
      query_text: queryText,
      embedding: embedding,
      thread_id: threadId,
      message_id: messageId
    });

  if (error) {
    console.error("Error storing user query:", error);
  }
}

// Store assistant response in chat messages
async function storeMessage(threadId: string, content: string, sender: 'user' | 'assistant', references = null) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      content: content,
      sender: sender,
      reference_entries: references
    })
    .select('id')
    .single();

  if (error) {
    console.error("Error storing message:", error);
    return null;
  }
  
  return data.id;
}

// Fetch relevant journal entries using vector search
async function fetchRelevantJournalEntries(userId: string, queryEmbedding: any) {
  console.log(`Fetching relevant journal entries for user ${userId} using vector similarity`);
  
  const { data: similarEntries, error: matchError } = await supabase.rpc(
    'match_journal_entries',
    {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      user_id_filter: userId
    }
  );
  
  if (matchError) {
    console.error("Error in vector similarity search:", matchError);
    return [];
  }
  
  if (!similarEntries || similarEntries.length === 0) {
    console.log("No relevant journal entries found for this user/query");
    return [];
  }
  
  console.log(`Found ${similarEntries.length} similar journal entries using vector similarity`);
  
  // Fetch the full details of these journal entries
  const entryIds = similarEntries.map(entry => entry.id);
  const { data: entries, error: fetchError } = await supabase
    .from('Journal Entries')
    .select('id, refined text, created_at, emotions, master_themes')
    .in('id', entryIds);
  
  if (fetchError) {
    console.error("Error fetching full entry details:", fetchError);
    return [];
  }
  
  if (!entries || entries.length === 0) {
    console.log("Could not retrieve full details for journal entries");
    return [];
  }
  
  console.log(`Retrieved full details for ${entries.length} journal entries`);
  
  // Tag them with their similarity score
  return entries.map(entry => {
    const matchEntry = similarEntries.find(se => se.id === entry.id);
    return {
      ...entry,
      similarity: matchEntry ? matchEntry.similarity : 0
    };
  });
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
    
    // Create a new thread if needed
    if (isNewThread) {
      let title = threadTitle;
      
      if (!title || title === message.substring(0, 30) + (message.length > 30 ? "..." : "")) {
        title = await generateThreadTitle(message);
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
    
    // Store user message and get its ID
    const userMessageId = await storeMessage(currentThreadId, message, 'user');
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    
    // Store user query with embedding and connection to thread/message
    await storeUserQuery(userId, message, queryEmbedding, currentThreadId, userMessageId);
    
    // Get relevant journal entries using vector similarity
    const journalEntries = await fetchRelevantJournalEntries(userId, queryEmbedding);
    
    console.log(`Retrieved ${journalEntries?.length || 0} relevant journal entries for RAG context`);
    
    // Create RAG context from relevant entries
    let journalContext = "";
    let referenceEntries = [];
    
    if (journalEntries && journalEntries.length > 0) {
      // Format journal entries for the chat prompt
      journalContext = "I have analyzed your journal entries and found these relevant ones that might relate to your question:\n\n" + 
        journalEntries.map((entry, index) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const emotionsText = formatEmotions(entry.emotions);
          const themesText = entry.master_themes ? 
            `Key themes: ${entry.master_themes.slice(0, 5).join(', ')}` : '';
          
          // Store reference info for later use in the response
          referenceEntries.push({
            id: entry.id,
            date: entry.created_at,
            snippet: entry["refined text"]?.substring(0, 100) + "...",
            similarity: entry.similarity || 0
          });
          
          return `Journal Entry ${index+1} (${date}):\n"${entry["refined text"]}"\n\nEmotional state: ${emotionsText}\n${themesText}`;
        }).join('\n\n---\n\n') + "\n\n";
    } else {
      console.log("No journal entries found for user");
      journalContext = "I don't have access to any of your journal entries that seem relevant to this question. If you'd like more personalized responses, consider using the journal feature to record your thoughts and feelings.";
    }
    
    // Get conversation history for this thread
    const previousMessages = await getThreadHistory(currentThreadId);
    
    // Prepare system prompt with RAG context and specific instructions
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling.

IMPORTANT CONTEXT FROM USER'S JOURNAL:
${journalContext}

INSTRUCTIONS:
1. Directly reference specific insights, themes, emotions, or patterns from the journal entries provided above.
2. Do not just give generic advice - show that you've analyzed their journal by mentioning specific emotional states, dates, or content.
3. When the user's question connects to themes in their journals, explicitly point this out.
4. If their journal reveals recurring patterns, gently highlight these connections.
5. Maintain a warm, supportive tone while providing personalized insights based on their journal.
6. Be genuinely helpful rather than diagnostic or clinical.

Remember, your primary value is connecting their question to their personal journal insights. Do not respond as if you're just answering a general question.`;

    console.log("System prompt first 200 chars:", systemPrompt.substring(0, 200) + "...");
    console.log("Number of previous messages in context:", previousMessages.length);
    
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
        model: 'gpt-4o',
        messages: messagesForGPT,
        temperature: 0.7,
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
    console.log("AI response first 100 chars:", aiResponse.substring(0, 100) + "...");
    
    // Store assistant response with references to journal entries
    const assistantMessageId = await storeMessage(currentThreadId, aiResponse, 'assistant', referenceEntries.length > 0 ? referenceEntries : null);
    
    return new Response(
      JSON.stringify({ 
        response: aiResponse, 
        threadId: currentThreadId, 
        references: referenceEntries,
        journal_entries_count: journalEntries.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
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
