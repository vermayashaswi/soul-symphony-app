
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

// Generate a summarized title for a new chat thread
async function generateThreadTitle(message: string) {
  try {
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
    
    return generatedTitle || message.substring(0, 30) + (message.length > 30 ? "..." : "");
  } catch (error) {
    console.error("Error generating thread title:", error);
    return message.substring(0, 30) + (message.length > 30 ? "..." : "");
  }
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

// Fetch relevant journal entries for the query
async function fetchRelevantJournalEntries(query: string, userId: string) {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Search for similar journal entries
    const { data: similarEntries, error } = await supabase.rpc('match_journal_entries', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 3,
      user_id_filter: userId
    });
    
    if (error) {
      console.error('Error searching journal entries:', error);
      return [];
    }
    
    if (!similarEntries || similarEntries.length === 0) {
      return [];
    }
    
    // Get complete journal entries
    const entryIds = similarEntries.map(entry => entry.id);
    const { data: entries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at')
      .in('id', entryIds);
      
    if (entriesError) {
      console.error('Error fetching full journal entries:', entriesError);
      return [];
    }
    
    // Format the entries with their similarity scores
    return entries.map(entry => {
      const similarEntry = similarEntries.find(se => se.id === entry.id);
      return {
        id: entry.id,
        content: entry["refined text"] || entry["transcription text"] || '',
        created_at: entry.created_at,
        similarity: similarEntry ? similarEntry.similarity : 0
      };
    }).sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error('Error in fetchRelevantJournalEntries:', error);
    return [];
  }
}

// Store user query for analytics
async function storeUserQuery(userId: string, queryText: string, threadId: string, messageId: string) {
  try {
    const embedding = await generateEmbedding(queryText);
    
    const { data, error } = await supabase.rpc('store_user_query', {
      user_id: userId,
      query_text: queryText,
      query_embedding: embedding,
      thread_id: threadId,
      message_id: messageId
    });
    
    if (error) {
      console.error('Error storing user query:', error);
    }
    
    return data;
  } catch (error) {
    console.error('Error in storeUserQuery:', error);
    // Don't throw, just log the error and continue
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== CHAT-RAG REQUEST RECEIVED ===");
    const { message, userId, threadId, isNewThread } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    let currentThreadId = threadId;
    
    // Create a new thread if needed
    if (isNewThread) {
      let title;
      
      try {
        title = await generateThreadTitle(message);
      } catch (error) {
        console.error("Error generating thread title:", error);
        // Fall back to default title if generation fails
        title = message.substring(0, 30) + (message.length > 30 ? "..." : "");
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
    const { data: userMessage, error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: currentThreadId,
        content: message,
        sender: 'user'
      })
      .select('id')
      .single();
      
    if (userMessageError) {
      console.error("Error storing user message:", userMessageError);
      throw userMessageError;
    }
    
    // Find relevant journal entries - RAG approach
    const relevantEntries = await fetchRelevantJournalEntries(message, userId);
    console.log(`Found ${relevantEntries.length} relevant journal entries`);
    
    // Store the user query for analytics
    await storeUserQuery(userId, message, currentThreadId, userMessage.id);
    
    // Get conversation history for this thread
    let previousMessages = [];
    try {
      previousMessages = await getThreadHistory(currentThreadId);
      console.log(`Retrieved ${previousMessages.length} previous messages from thread history`);
    } catch (historyError) {
      console.error("Error getting thread history:", historyError);
    }
    
    // Prepare system prompt with context from relevant journal entries
    let contextString = '';
    if (relevantEntries.length > 0) {
      contextString = 'Here are some relevant journal entries from the user that may help you provide a more personalized response:\n\n';
      relevantEntries.forEach((entry, index) => {
        const date = new Date(entry.created_at).toLocaleDateString();
        contextString += `Entry ${index + 1} (${date}):\n${entry.content}\n\n`;
      });
    }
    
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling.
Your role is to provide thoughtful responses to help users reflect on their emotions and experiences.
Be warm, empathetic, and insightful in your responses. Focus on wellbeing, emotional intelligence, and personal growth.
Encourage journaling as a practice, but don't push it excessively.

${contextString}

If the user's query relates to their journal entries provided above, incorporate insights from them to personalize your response.
However, only reference these journal entries if they're clearly relevant to the current conversation.
Don't explicitly mention that you're using their journal entries unless they specifically ask about them.`;

    console.log("System prompt prepared with relevant journal context");
    
    // Send to GPT with conversation history and context
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
    
    let aiResponse = "";
    try {
      console.log("Sending request to OpenAI API...");
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messagesForGPT,
          temperature: 0.7,
        }),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ GPT API error:", errorText);
        throw new Error(`GPT API error: ${errorText}`);
      }
  
      const result = await response.json();
      aiResponse = result.choices[0].message.content;
      
      console.log("✅ AI response generated successfully");
    } catch (gptError) {
      console.error("❌ Error calling OpenAI API:", gptError);
      
      // Provide a fallback response if OpenAI call fails
      aiResponse = "I'm currently having trouble responding. Could you please try again in a moment?";
    }
    
    // Store assistant response with reference to relevant entries
    try {
      const referenceEntries = relevantEntries.length > 0 
        ? relevantEntries.map(e => ({ id: e.id, similarity: e.similarity })) 
        : null;
        
      const { error: assistantMessageError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content: aiResponse,
          sender: 'assistant',
          reference_entries: referenceEntries
        });
        
      if (assistantMessageError) {
        console.error("Error storing assistant message:", assistantMessageError);
      }
    } catch (storeError) {
      console.error("Error storing assistant message:", storeError);
    }
    
    console.log("=== CHAT-RAG REQUEST COMPLETED SUCCESSFULLY ===");
    
    return new Response(
      JSON.stringify({ 
        response: aiResponse, 
        threadId: currentThreadId,
        relevantEntries: relevantEntries.length > 0 ? relevantEntries : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("=== ERROR IN CHAT-RAG FUNCTION ===");
    console.error(error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm sorry, I couldn't process your request at the moment. Please try again in a moment.",
        success: false 
      }),
      {
        status: 200, // Using 200 to ensure the client receives the error message
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
