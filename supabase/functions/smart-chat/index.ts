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

// Define the journal-specific prompt
const JOURNAL_SPECIFIC_PROMPT = `You are **SOuLO**, a personal mental well-being assistant. You help users reflect on emotions, uncover thought patterns, and gain self-insight from their journaling. You're emotionally supportive, grounded in data, and write in a clear, structured tone—like a thoughtful coach or guide.

Here's the user's past journaling data, which includes dates, emotions, sentiment scores, and key entities (like people, places, or themes):
{journalData}

The user has now asked:
"{userMessage}"

---

**How to respond:**

1. **Tone & Personality**
   - Be emotionally warm, grounded, and calm.
   - Write clearly and concisely—just like a thoughtful conversation.
   - Don't over-explain unless the user explicitly asks for detail or a breakdown.

2. **Balance of Insight**
   - Combine **quantitative** analysis (sentiment scores, frequency, patterns) and **qualitative** observations (emotions, shifts, associations).
   - If the question allows, use a data-backed tone ("You've mentioned X 4 times, each with high positive sentiment.")

3. **Structure & Clarity**
   - Respond in short paragraphs or **bullet points** where useful—keep it skimmable and clean.
   - Include only relevant journal entry references—not all entries—unless the user specifically asks for a full breakdown.
   - Aim for **80–150 words**, unless the user requests more detail.

4. **Patterns & Personalization**
   - Surface recurring emotional patterns or shifts (e.g. "You've felt anxious when [Person] is mentioned lately").
   - Mention specific dates or events **only when meaningful** to the query.
   - Avoid speculation—only speak from the journal data.
   - If the user's question is broad or abstract, reflect thoughtfully and suggest journal prompts or reflections.

5. **If rating is requested**
   - Offer a grounded score or metric based on past entries, and explain briefly.

6. **Finish Strong**
   - End with a supportive, encouraging line if it fits—gently empowering, not preachy.

---

Now, generate a smart, structured, emotionally intelligent response grounded in the user's journaling:`;

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
    
    // Send an immediate response with processing status for long-running requests
    if (reqBody.acknowledgeRequest) {
      EdgeRuntime.waitUntil(async () => {
        // This will run in the background after response is sent
        console.log("Processing message in background task");
        // Background processing would happen here
      });
      
      return new Response(
        JSON.stringify({ 
          status: "processing",
          message: "Your request is being processed"
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
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
    
    // Enhanced categorization logic with better examples and strict guidelines for greeting/simple messages
    console.log("Categorizing question type");
    const categorizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a classifier that determines if a user's query is:
1. A general question/greeting unrelated to their journal data (respond with "GENERAL")
2. A question seeking insights from the user's journal entries (respond with "JOURNAL_SPECIFIC")

Respond with ONLY "GENERAL" or "JOURNAL_SPECIFIC". No explanation.

IMPORTANT GUIDELINES:
- ALL greetings, small talk or simple messages like "hi", "hello", "hey", "good morning", etc. are ALWAYS "GENERAL"
- ALL generic questions about mental health, journaling, or the app are "GENERAL"
- Questions that can be answered WITHOUT analyzing journal entries are "GENERAL"
- ONLY classify as "JOURNAL_SPECIFIC" if the query EXPLICITLY requires analyzing their journal data
- Single word messages like "hey", "hi", "hello" are ALWAYS "GENERAL"
- Short phrases like "how are you" are ALWAYS "GENERAL"
- If you're unsure whether a query requires journal data, default to "GENERAL"

Examples:
- "Hi" -> "GENERAL"
- "Hey" -> "GENERAL"
- "Hey there" -> "GENERAL"
- "How are you?" -> "GENERAL"
- "What is journaling?" -> "GENERAL"
- "What can you help with?" -> "GENERAL"
- "How do I use this app?" -> "GENERAL"
- "What's the weather today?" -> "GENERAL"
- "Who is the president?" -> "GENERAL"
- "How was I feeling last week?" -> "JOURNAL_SPECIFIC"
- "What did I write about yesterday?" -> "JOURNAL_SPECIFIC"
- "Show me patterns in my anxiety" -> "JOURNAL_SPECIFIC"
- "Am I happier on weekends?" -> "JOURNAL_SPECIFIC"
- "What emotions do I mention most?" -> "JOURNAL_SPECIFIC"`
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
          temperature: 0.7,
          max_tokens: 250  // Limit token length for general responses
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
    // ... keep existing code (handling journal-specific queries, embedding generation, vector search, etc.)
    
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
      
      // Format entities for display if they exist
      let entityInfo = '';
      if (entry.entities && Array.isArray(entry.entities)) {
        const entityTypes = {};
        entry.entities.forEach(entity => {
          if (!entityTypes[entity.type]) {
            entityTypes[entity.type] = [];
          }
          entityTypes[entity.type].push(entity.name);
        });
        
        // Create a readable string of entities
        const entityStrings = [];
        for (const [type, names] of Object.entries(entityTypes)) {
          entityStrings.push(`${type}: ${names.join(', ')}`);
        }
        if (entityStrings.length > 0) {
          entityInfo = `\nMentioned: ${entityStrings.join(' | ')}`;
        }
      }

      // Format sentiment info
      const sentimentInfo = entry.sentiment 
        ? `\nSentiment: ${entry.sentiment} (${
            entry.sentiment <= -0.2 ? 'negative' :
            entry.sentiment >= 0.2 ? 'positive' : 'neutral'
          })`
        : '';

      return `- Entry from ${formattedDate}: ${entry.content}${entityInfo}${sentimentInfo}`;
    }).join('\n\n');

    // 3. Prepare prompt with updated instructions
    const promptFormatted = JOURNAL_SPECIFIC_PROMPT
      .replace('{journalData}', entriesWithDates)
      .replace('{userMessage}', message);
      
    // 4. Call OpenAI
    console.log("Calling OpenAI for completion");
    
    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: promptFormatted });
    
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
        messages: conversationContext.length > 0 ? messages : [{ role: 'system', content: promptFormatted }],
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
      JSON.stringify({ 
        data: responseContent,
        processingComplete: true 
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processingComplete: true
      }),
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
    
    // Ensure sentiment and entities are included in the response
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
