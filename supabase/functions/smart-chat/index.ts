
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const requestData = await req.json();
    
    // Special case for title generation - skip normal processing
    if (requestData.generateTitleOnly) {
      console.log("Generating title for thread");
      
      // Generate a title based on provided messages
      const messages = requestData.messages || [];
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to generate title: ${error}`);
      }
      
      const data = await response.json();
      const title = data.choices[0]?.message?.content.trim() || "New Conversation";
      
      return new Response(
        JSON.stringify({ title }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Normal processing for chat
    const { message, userId, timeRange, threadId } = requestData;

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log("Time range received:", timeRange);
    console.log("Thread ID received:", threadId);
    
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
    const matchCount = 50; // Increased from 10 to 50 to retrieve more relevant entries
    
    if (timeRange && (timeRange.startDate || timeRange.endDate)) {
      console.log(`Using time-filtered search with range: ${JSON.stringify(timeRange)}`);
      entries = await searchEntriesWithTimeRange(userId, queryEmbedding, timeRange, matchCount);
    } else {
      console.log("Using standard vector search without time filtering");
      entries = await searchEntriesWithVector(userId, queryEmbedding, matchCount);
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

    // 3. Prepare prompt
    const prompt = `You are a personal mental well-being assistant. Your goal is to provide helpful, empathetic, and insightful responses based on the user's journal entries.
      Here are some of the user's journal entries:
      ${entries.map((entry) => `- ${entry.content}`).join('\n')}
      
      Now, respond to the following message from the user:
      ${message}
      
      Keep your answers concise and to the point. Focus on providing actionable insights and support.`;

    // 4. Call OpenAI
    console.log("Calling OpenAI for completion");
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
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

    // 5. Save message to database if threadId is provided
    if (threadId) {
      console.log(`Saving messages to thread ${threadId}`);
      
      try {
        // First, ensure the thread exists - create it if it doesn't
        const { data: threadExists, error: threadCheckError } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('id', threadId)
          .limit(1);
          
        if (threadCheckError) {
          console.error('Error checking if thread exists:', threadCheckError);
          throw threadCheckError;
        }
        
        // Create thread if it doesn't exist
        if (!threadExists || threadExists.length === 0) {
          console.log(`Thread ${threadId} doesn't exist, creating it`);
          const { error: createThreadError } = await supabase
            .from('chat_threads')
            .insert({
              id: threadId,
              user_id: userId,
              title: "New Conversation",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (createThreadError) {
            console.error('Error creating thread:', createThreadError);
            throw createThreadError;
          }
        }
        
        // First save user message 
        const { error: userMsgError } = await supabase
          .from('chat_messages')
          .insert({
            thread_id: threadId,
            content: message,
            sender: 'user'
          });
          
        if (userMsgError) {
          console.error('Error saving user message:', userMsgError);
          throw userMsgError;
        }
        
        // Then save assistant response
        const { error: assistantMsgError } = await supabase
          .from('chat_messages')
          .insert({
            thread_id: threadId,
            content: responseContent,
            sender: 'assistant'
          });
          
        if (assistantMsgError) {
          console.error('Error saving assistant message:', assistantMsgError);
          throw assistantMsgError;
        }
        
        // Update thread's updated_at timestamp
        const { error: threadUpdateError } = await supabase
          .from('chat_threads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', threadId);
          
        if (threadUpdateError) {
          console.error('Error updating thread timestamp:', threadUpdateError);
          throw threadUpdateError;
        }
        
        console.log('Successfully saved both messages to database');
      } catch (dbError) {
        console.error('Database error when saving messages:', dbError);
        // Return the response but include the DB error for debugging
        return new Response(
          JSON.stringify({ 
            data: responseContent,
            dbError: dbError.message
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // 6. Return response
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
  queryEmbedding: any[],
  matchCount: number = 50
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: matchCount,
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
  timeRange: { startDate?: string; endDate?: string },
  matchCount: number = 50
) {
  try {
    console.log(`Searching entries with time range for userId: ${userId}`);
    console.log(`Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: matchCount,
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
