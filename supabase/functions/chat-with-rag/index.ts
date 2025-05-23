
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced query processing function
async function processQuery(
  message: string,
  userId: string,
  supabase: any,
  clientTimeInfo?: any,
  userTimezone?: string
): Promise<string> {
  console.log(`[chat-with-rag] Processing query: "${message}"`);
  
  try {
    // Validate OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[chat-with-rag] CRITICAL: OpenAI API key not configured');
      return "I'm sorry, but the AI service is not properly configured. Please contact support.";
    }
    console.log('[chat-with-rag] OpenAI API key found');
    
    // Check if user has any journal entries
    console.log(`[chat-with-rag] Checking for journal entries for user: ${userId}`);
    const { count: entryCount, error: countError } = await supabase
      .from('Journal Entries')
      .select('id', { count: "exact", head: true })
      .eq('user_id', userId);
    
    if (countError) {
      console.error('[chat-with-rag] Error checking for user journal entries:', countError);
      return "I encountered an error while accessing your journal entries. Please try again.";
    }
    
    console.log(`[chat-with-rag] User has ${entryCount || 0} journal entries`);
    
    if (!entryCount || entryCount === 0) {
      return "I don't have any journal entries to analyze yet. Please add some journal entries first, and then I'll be able to provide insights about your emotions, patterns, and experiences!";
    }
    
    // Detect if this is a time-based query
    const lowerMessage = message.toLowerCase();
    let timeRange = null;
    
    if (lowerMessage.includes('last week')) {
      const now = new Date();
      const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7);
      const lastWeekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 1, 23, 59, 59);
      
      timeRange = {
        startDate: lastWeekStart.toISOString(),
        endDate: lastWeekEnd.toISOString()
      };
      
      console.log(`[chat-with-rag] Detected last week query with range:`, timeRange);
    }
    
    // Get query embedding for semantic search
    console.log(`[chat-with-rag] Getting embedding for query`);
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: message,
        model: 'text-embedding-3-small',
      }),
    });
    
    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('[chat-with-rag] Failed to get embedding:', errorText);
      throw new Error('Failed to get embedding from OpenAI');
    }
    
    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;
    console.log(`[chat-with-rag] Successfully got embedding with ${queryEmbedding.length} dimensions`);
    
    // Search for relevant entries
    let relevantEntries = [];
    
    if (timeRange && (timeRange.startDate || timeRange.endDate)) {
      console.log(`[chat-with-rag] Using time-filtered search`);
      
      // Check if the time-filtered function exists
      const { data: timeFilteredData, error: timeFilteredError } = await supabase.rpc(
        'match_journal_entries_with_date',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 20,
          user_id_filter: userId,
          start_date: timeRange.startDate,
          end_date: timeRange.endDate
        }
      );
      
      if (timeFilteredError) {
        console.error('[chat-with-rag] Time-filtered search failed, falling back to regular search:', timeFilteredError);
        // Fallback to regular search
        const { data: regularData, error: regularError } = await supabase.rpc(
          'match_journal_entries_fixed',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 20,
            user_id_filter: userId
          }
        );
        
        if (regularError) {
          console.error('[chat-with-rag] Regular search also failed:', regularError);
          return "I encountered an error while searching your journal entries. Please try again.";
        }
        
        relevantEntries = regularData || [];
      } else {
        relevantEntries = timeFilteredData || [];
      }
    } else {
      console.log(`[chat-with-rag] Using general vector search`);
      const { data, error } = await supabase.rpc(
        'match_journal_entries_fixed',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 20,
          user_id_filter: userId
        }
      );
      
      if (error) {
        console.error('[chat-with-rag] Vector search failed:', error);
        return "I encountered an error while searching your journal entries. Please try again.";
      }
      
      relevantEntries = data || [];
    }
    
    console.log(`[chat-with-rag] Found ${relevantEntries?.length || 0} relevant entries`);
    
    if (!relevantEntries || relevantEntries.length === 0) {
      if (timeRange) {
        return `I don't have any journal entries for the specified time period (${new Date(timeRange.startDate).toLocaleDateString()} to ${new Date(timeRange.endDate).toLocaleDateString()}). Try asking about a different time period or add more journal entries!`;
      } else {
        return "I don't have enough journal entries to provide insights about that topic. Try writing more journal entries to get better personalized responses!";
      }
    }
    
    // Format entries for analysis
    const formattedEntries = relevantEntries.map(entry => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      let emotionInfo = '';
      if (entry.emotions && typeof entry.emotions === 'object') {
        const emotions = Object.entries(entry.emotions)
          .filter(([_, score]) => typeof score === 'number' && score > 0.3)
          .sort(([_, a], [__, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([emotion, score]) => `${emotion}: ${(score as number).toFixed(2)}`)
          .join(', ');
        
        if (emotions) {
          emotionInfo = `\nEmotions: ${emotions}`;
        }
      }
      
      let themeInfo = '';
      if (entry.themes && Array.isArray(entry.themes)) {
        themeInfo = `\nThemes: ${entry.themes.join(', ')}`;
      }
      
      return `Entry from ${date}: ${entry.content}${emotionInfo}${themeInfo}`;
    }).join('\n\n');
    
    // Generate system prompt
    const systemPrompt = `You are a supportive mental health assistant analyzing journal entries from the SOULo voice journaling app.

Current date and time: ${new Date().toISOString()}
User timezone: ${userTimezone || 'UTC'}

Your role is to:
1. Analyze journal entries with empathy and understanding
2. Provide personalized insights based on patterns and emotions
3. Offer constructive mental health guidance
4. Reference specific dates and timeframes accurately when relevant
5. Be supportive while maintaining appropriate boundaries

Guidelines:
- Always be encouraging, non-judgmental, and focused on the user's wellbeing
- When discussing emotions, provide context and patterns rather than just raw data
- For time-based queries, clearly reference the specific timeframe
- Provide actionable insights when appropriate
- If asking about patterns or trends, explain what the data shows and what it might mean
- For "top emotions" queries, identify the most prominent emotions with specific examples from the entries`;

    // Generate user prompt
    const userPrompt = `Based on these journal entries: 

${formattedEntries}

User question: ${message}

Please provide a thoughtful, personalized response based on the journal entry data. If the question is about "top emotions" or similar, identify the most prominent emotions from the data and provide specific examples.`;
    
    // Generate response using OpenAI
    console.log(`[chat-with-rag] Generating response with OpenAI`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[chat-with-rag] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedResponse = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    
    console.log(`[chat-with-rag] Successfully generated response: ${generatedResponse.substring(0, 100)}...`);
    return generatedResponse;
    
  } catch (error) {
    console.error('[chat-with-rag] Error processing query:', error);
    return `I apologize, but I encountered an error while analyzing your journal entries: ${error.message}. Please try rephrasing your question.`;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, timeRange, referenceDate, conversationContext, queryPlan, isMentalHealthQuery, clientTimeInfo, userTimezone } = await req.json();

    console.log(`[chat-with-rag] Processing request for user ${userId} at ${new Date().toISOString()}: ${message}`);
    console.log(`[chat-with-rag] Client time info received:`, clientTimeInfo);
    console.log(`[chat-with-rag] User timezone: ${userTimezone}`);

    // Validate required parameters
    if (!message || !userId) {
      const errorMsg = 'Missing required parameters: message and userId';
      console.error('[chat-with-rag]', errorMsg);
      return new Response(JSON.stringify({ 
        error: errorMsg,
        data: "I'm missing some required information to process your request. Please try again."
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[chat-with-rag] Missing Supabase configuration');
      return new Response(JSON.stringify({ 
        error: 'Service configuration error',
        data: "The service is not properly configured. Please contact support."
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process the query
    const response = await processQuery(
      message,
      userId,
      supabase,
      clientTimeInfo,
      userTimezone
    );

    console.log(`[chat-with-rag] Final response ready, length: ${response.length}`);

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in chat-with-rag:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      data: `I encountered an unexpected error: ${error.message}. Please try again or contact support if the problem persists.`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
