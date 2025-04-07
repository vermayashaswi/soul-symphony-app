
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers directly in the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum number of previous messages to include for context
const MAX_CONTEXT_MESSAGES = 10;

// Define the general question prompt
const GENERAL_QUESTION_PROMPT = `You are a mental health assistant of a voice journaling app called "SOuLO". Here's a query from a user. Respond like a chatbot. IF it concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly. If it contains any other abstract question like "Who is the president of India" , "What is quantum physics" or anything that doesn't concern the app's purpose, feel free to deny politely.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // First check if this is a title generation request
    const reqBody = await req.json();
    if (reqBody.generateTitleOnly && reqBody.userId && reqBody.messages) {
      // Special handling for thread title generation
      const { messages, userId } = reqBody;
      
      const titleCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
        }),
      });
      
      if (!titleCompletionResponse.ok) {
        const error = await titleCompletionResponse.text();
        console.error('Failed to generate title:', error);
        throw new Error('Failed to generate title');
      }
      
      const titleData = await titleCompletionResponse.json();
      const title = titleData.choices[0]?.message?.content || 'New Conversation';
      
      return new Response(
        JSON.stringify({ title }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Normal chat processing flow
    const { message, userId, timeRange, threadId } = reqBody;

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log("Time range received:", timeRange);
    
    // Fetch previous messages from this thread if a threadId is provided
    let conversationContext = [];
    if (threadId) {
      try {
        console.log(`Retrieving context from thread ${threadId}`);
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES * 2); // Get more messages than needed to ensure we have message pairs
        
        if (error) {
          console.error('Error fetching thread context:', error);
        } else if (previousMessages && previousMessages.length > 0) {
          // Process messages to create conversation context
          // We need to reverse the messages to get them in chronological order
          const chronologicalMessages = [...previousMessages].reverse();
          
          // Format as conversation context
          conversationContext = chronologicalMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          
          // Limit to the most recent messages to avoid context length issues
          if (conversationContext.length > MAX_CONTEXT_MESSAGES) {
            conversationContext = conversationContext.slice(-MAX_CONTEXT_MESSAGES);
          }
          
          console.log(`Added ${conversationContext.length} previous messages as context`);
        } else {
          console.log("No previous messages found in thread");
        }
      } catch (contextError) {
        console.error('Error processing thread context:', contextError);
      }
    }
    
    // NEW: First categorize if this is a general question or a journal-specific question
    console.log("Categorizing question type");
    const categorizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a classifier that determines if a user's query is a general question about mental health, greetings, or an abstract question unrelated to journaling (respond with "GENERAL") OR if it's a question seeking insights from the user's journal entries (respond with "JOURNAL_SPECIFIC"). 
            Respond with ONLY "GENERAL" or "JOURNAL_SPECIFIC".
            
            Examples:
            - "How are you doing?" -> "GENERAL"
            - "What is journaling?" -> "GENERAL"
            - "Who is the president of India?" -> "GENERAL"
            - "How was I feeling last week?" -> "JOURNAL_SPECIFIC"
            - "What patterns do you see in my anxiety?" -> "JOURNAL_SPECIFIC"
            - "Am I happier on weekends based on my entries?" -> "JOURNAL_SPECIFIC"
            - "Did I mention being stressed in my entries?" -> "JOURNAL_SPECIFIC"`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 10
      }),
    });

    if (!categorizationResponse.ok) {
      const error = await categorizationResponse.text();
      console.error('Failed to categorize question:', error);
      throw new Error('Failed to categorize question');
    }

    const categorization = await categorizationResponse.json();
    const questionType = categorization.choices[0]?.message?.content.trim();
    console.log(`Question categorized as: ${questionType}`);

    // If it's a general question, respond directly without journal entry retrieval
    if (questionType === "GENERAL") {
      console.log("Processing as general question, skipping journal entry retrieval");
      
      const generalCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: GENERAL_QUESTION_PROMPT },
            ...(conversationContext.length > 0 ? conversationContext : []),
            { role: 'user', content: message }
          ],
        }),
      });

      if (!generalCompletionResponse.ok) {
        const error = await generalCompletionResponse.text();
        console.error('Failed to get general completion:', error);
        throw new Error('Failed to generate response');
      }

      const generalCompletionData = await generalCompletionResponse.json();
      const generalResponse = generalCompletionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log("General response generated successfully");

      return new Response(
        JSON.stringify({ data: generalResponse }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // If it's a journal-specific question, continue with the existing RAG flow
    // 1. Generate embedding for the message
    console.log("Generating embedding for message");
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: message,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding:', error);
      throw new Error('Could not generate embedding for the message');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('Could not generate embedding for the message');
    }

    const queryEmbedding = embeddingData.data[0].embedding;
    console.log("Embedding generated successfully");

    // 2. Search for relevant entries with proper temporal filtering
    console.log("Searching for relevant entries");
    
    // Use different search function based on whether we have a time range
    let entries = [];
    if (timeRange && (timeRange.startDate || timeRange.endDate)) {
      console.log(`Using time-filtered search with range: ${JSON.stringify(timeRange)}`);
      entries = await searchEntriesWithTimeRange(userId, queryEmbedding, timeRange);
    } else {
      console.log("Using standard vector search without time filtering");
      entries = await searchEntriesWithVector(userId, queryEmbedding);
    }
    
    console.log(`Found ${entries.length} relevant entries`);

    // Check if we found any entries for the requested time period
    if (timeRange && (timeRange.startDate || timeRange.endDate) && entries.length === 0) {
      console.log("No entries found for the specified time range");
      
      // Return a friendly message indicating no entries were found
      return new Response(
        JSON.stringify({ 
          data: "Sorry, it looks like you don't have any journal entries for the time period you're asking about.",
          noEntriesForTimeRange: true
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Format entries for the prompt with dates
    const entriesWithDates = entries.map(entry => {
      const formattedDate = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      return `- Entry from ${formattedDate}: ${entry.content}`;
    }).join('\n\n');

    // 3. Prepare prompt with updated instructions
    const prompt = `You are SOuLO, a personal mental well-being assistant designed to help users reflect on their emotions, understand patterns in their thoughts, and gain insight from their journaling practice.

Below are excerpts from the user's journal entries, along with dates:
${entriesWithDates}

The user has now asked:
"${message}"

Please respond with the following guidelines:

1. **Tone & Purpose**
   - Be emotionally supportive, non-judgmental, and concise.
   - Avoid generic advice—make your response feel personal, grounded in the user's own journal reflections.

2. **Data Grounding**
   - Use the user's past entries as the primary source of truth.
   - Reference journal entries with specific bullet points that include dates.
   - Do not make assumptions or speculate beyond what the user has written.

3. **Handling Ambiguity**
   - If the user's question is broad, philosophical, or ambiguous (e.g., "Am I introverted?"), respond with thoughtful reflection:
     - Acknowledge the ambiguity or complexity of the question.
     - Offer the most likely patterns or insights based on journal entries.
     - Clearly state when there isn't enough information to give a definitive answer, and gently suggest what the user could explore further in their journaling.

4. **Insight & Structure**
   - Highlight recurring patterns, emotional trends, or changes over time.
   - Suggest gentle, practical self-reflections or actions, only if relevant.
   - Keep responses between 120–180 words, formatted for easy reading.

Example format (only to be used when you feel the need to) :
- "On Mar 18 and Mar 20, you mentioned feeling drained after social interactions."
- "Your entry on Apr 2 reflects a desire for deeper connection with others."
- "Based on these entries, it seems you may lean toward introversion, but more context would help."

Now generate your thoughtful, emotionally intelligent response:`;

    // 4. Call OpenAI
    console.log("Calling OpenAI for completion");
    
    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: prompt });
    
    // Add conversation context if available
    if (conversationContext.length > 0) {
      // Log that we're using conversation context
      console.log(`Including ${conversationContext.length} messages of conversation context`);
      
      // Add the conversation context messages
      messages.push(...conversationContext);
      
      // Add the current user message
      messages.push({ role: 'user', content: message });
    } else {
      // If no context, just use the system prompt
      console.log("No conversation context available, using only system prompt");
    }
    
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: conversationContext.length > 0 ? messages : [{ role: 'system', content: prompt }],
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    console.log("Response generated successfully");

    // 5. Return response
    return new Response(
      JSON.stringify({ data: responseContent }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// Standard vector search without time filtering
async function searchEntriesWithVector(
  userId: string, 
  queryEmbedding: any[]
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
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
    console.error('Error searching entries with vector:', error);
    throw error;
  }
}

// Time-filtered vector search
async function searchEntriesWithTimeRange(
  userId: string, 
  queryEmbedding: any[], 
  timeRange: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`Searching entries with time range for userId: ${userId}`);
    console.log(`Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId,
        start_date: timeRange.startDate || null,
        end_date: timeRange.endDate || null
      }
    );
    
    if (error) {
      console.error(`Error in time-filtered vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with time-filtered vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching entries with time range:', error);
    throw error;
  }
}
