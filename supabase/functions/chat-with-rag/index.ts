import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processTimeRange } from './utils/dateProcessor.ts';
import { searchEntriesWithVector, searchEntriesWithTimeRange, searchEntriesByMonth } from './utils/searchService.ts';
import { detectMentalHealthQuery, detectMonthInQuery, isDirectDateQuery, isJournalAnalysisQuery, isMonthSpecificQuery, detectTimeframeInQuery } from './utils/queryClassifier.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Enhanced date calculation functions with proper timezone handling
function getLastWeekDates(clientTimeInfo?: any, userTimezone?: string): { startDate: string; endDate: string; formattedRange: string } {
  // Determine the most appropriate timezone to use
  const timezone = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
  
  console.log(`[chat-with-rag] Getting last week dates for timezone: ${timezone}`);
  console.log(`[chat-with-rag] Client time info:`, clientTimeInfo);
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  console.log(`[chat-with-rag] Using reference time: ${referenceTime.toISOString()}`);
  
  // For last week calculation, we need to get the current date in user's timezone
  const now = new Date(referenceTime);
  
  // Get this week's Monday (start of current week) - week starts on Monday (1)
  const currentDay = now.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday = 0, so it's 6 days from Monday
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - daysFromMonday);
  thisWeekMonday.setHours(0, 0, 0, 0);
  
  // Last week's Monday is 7 days before this week's Monday
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  
  // Last week's Sunday is 1 day before this week's Monday
  const lastWeekSunday = new Date(thisWeekMonday);
  lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);
  lastWeekSunday.setHours(23, 59, 59, 999);
  
  console.log(`[chat-with-rag] LAST WEEK CALCULATION DEBUG:`);
  console.log(`[chat-with-rag] Current time: ${now.toISOString()}`);
  console.log(`[chat-with-rag] This week's Monday: ${thisWeekMonday.toISOString()}`);
  console.log(`[chat-with-rag] Last week's Monday: ${lastWeekMonday.toISOString()}`);
  console.log(`[chat-with-rag] Last week's Sunday: ${lastWeekSunday.toISOString()}`);
  
  // Format for display
  const formatOptions: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const startFormatted = lastWeekMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endFormatted = lastWeekSunday.toLocaleDateString('en-US', formatOptions);
  const formattedRange = `${startFormatted} to ${endFormatted}`;
  
  return {
    startDate: lastWeekMonday.toISOString(),
    endDate: lastWeekSunday.toISOString(),
    formattedRange
  };
}

function getCurrentWeekDates(clientTimeInfo?: any, userTimezone?: string): { startDate: string; endDate: string; formattedRange: string } {
  // Determine the most appropriate timezone to use
  const timezone = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
  
  console.log(`[chat-with-rag] Getting current week dates for timezone: ${timezone}`);
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  const now = new Date(referenceTime);
  
  // Get this week's Monday (start of current week)
  const currentDay = now.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - daysFromMonday);
  thisWeekMonday.setHours(0, 0, 0, 0);
  
  // This week's Sunday
  const thisWeekSunday = new Date(thisWeekMonday);
  thisWeekSunday.setDate(thisWeekMonday.getDate() + 6);
  thisWeekSunday.setHours(23, 59, 59, 999);
  
  console.log(`[chat-with-rag] THIS WEEK CALCULATION:`);
  console.log(`[chat-with-rag] This week's Monday: ${thisWeekMonday.toISOString()}`);
  console.log(`[chat-with-rag] This week's Sunday: ${thisWeekSunday.toISOString()}`);
  
  // Format for display
  const startFormatted = thisWeekMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endFormatted = thisWeekSunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedRange = `${startFormatted} to ${endFormatted}`;
  
  return {
    startDate: thisWeekMonday.toISOString(),
    endDate: thisWeekSunday.toISOString(),
    formattedRange
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, timeRange, referenceDate, conversationContext, queryPlan, isMentalHealthQuery, clientTimeInfo, userTimezone } = await req.json();

    console.log(`Processing request for user ${userId} at ${new Date().toISOString()}: ${message}`);
    console.log(`Cache breaker: ${Date.now()}`);
    console.log(`Client time info received:`, clientTimeInfo);
    console.log(`User timezone: ${userTimezone}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Enhanced timeframe detection and processing
    let processedTimeRange = timeRange;
    
    // If no time range provided, try to detect it from the message
    if (!processedTimeRange || (!processedTimeRange.startDate && !processedTimeRange.endDate)) {
      const detectedTimeframe = detectTimeframeInQuery(message);
      if (detectedTimeframe) {
        console.log(`Detected timeframe from message:`, detectedTimeframe);
        
        // Add timezone and client info to detected timeframe
        if (detectedTimeframe.timezone === 'UTC' && (clientTimeInfo?.timezoneName || userTimezone)) {
          detectedTimeframe.timezone = clientTimeInfo?.timezoneName || userTimezone;
        }
        
        // Process the detected timeframe into actual dates
        processedTimeRange = processTimeRange(detectedTimeframe);
        console.log(`Processed timeframe into date range:`, processedTimeRange);
      }
    }

    // Special handling for "last week" queries with enhanced date calculation
    if (message.toLowerCase().includes('last week')) {
      console.log(`[chat-with-rag] Detected "last week" query - using enhanced calculation`);
      const lastWeekDates = getLastWeekDates(clientTimeInfo, userTimezone);
      processedTimeRange = {
        startDate: lastWeekDates.startDate,
        endDate: lastWeekDates.endDate
      };
      console.log(`[chat-with-rag] Enhanced last week date range:`, processedTimeRange);
    }
    
    // Special handling for "this week" queries
    if (message.toLowerCase().includes('this week')) {
      console.log(`[chat-with-rag] Detected "this week" query - using enhanced calculation`);
      const thisWeekDates = getCurrentWeekDates(clientTimeInfo, userTimezone);
      processedTimeRange = {
        startDate: thisWeekDates.startDate,
        endDate: thisWeekDates.endDate
      };
      console.log(`[chat-with-rag] Enhanced this week date range:`, processedTimeRange);
    }

    // Handle direct date queries
    if (isDirectDateQuery(message)) {
      let directResponse = '';
      
      if (message.toLowerCase().includes('current week') || message.toLowerCase().includes('this week')) {
        const currentWeek = getCurrentWeekDates(clientTimeInfo, userTimezone);
        directResponse = `This week's dates are ${currentWeek.formattedRange}.`;
      } else if (message.toLowerCase().includes('last week')) {
        const lastWeek = getLastWeekDates(clientTimeInfo, userTimezone);
        directResponse = `Last week's dates were ${lastWeek.formattedRange}.`;
      }
      
      if (directResponse) {
        return new Response(JSON.stringify({ data: directResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Determine search strategy and domain context
    const domainContext = queryPlan?.domainContext || 'general_insights';
    const searchStrategy = queryPlan?.searchStrategy || 'hybrid';
    
    console.log(`Domain context: ${domainContext}`);
    console.log(`Using search strategy: ${searchStrategy}`);

    // Determine if this is a comprehensive analysis query
    const isComprehensiveQuery = isComprehensiveAnalysisQuery(message);
    console.log(`Is comprehensive analysis query: ${isComprehensiveQuery}`);
    
    // Handle journal question
    console.log('Handling journal question');
    console.log(`Processing as journal-specific question`);
    console.log(`Conversation history length: ${conversationContext?.length || 0}`);

    const isTimePatternQuery = /\b(pattern|trend|change|over time|frequency|often|usually|typically)\b/i.test(message);
    const isTimeSummaryQuery = /\b(summary|summarize|overview|review)\b/i.test(message) && 
                               /\b(week|month|year|period|time)\b/i.test(message);
    const isPersonalityQuery = /\b(personality|character|trait|type|am i|who am i)\b/i.test(message);
    const isJournalAnalysis = isJournalAnalysisQuery(message);

    console.log(`Is time pattern query: ${isTimePatternQuery}`);
    console.log(`Is time summary query: ${isTimeSummaryQuery}`);
    console.log(`Is personality query: ${isPersonalityQuery}`);
    console.log(`Is journal analysis query: ${isJournalAnalysis}`);

    // Search for relevant journal entries using enhanced search
    console.log('Searching for relevant journal entries using strategy:', searchStrategy);

    let relevantEntries = [];
    
    // Enhanced search logic with proper date range handling
    if (processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate)) {
      console.log(`Time range search: from ${processedTimeRange.startDate || 'none'} to ${processedTimeRange.endDate || 'none'}`);
      
      // Get query embedding for semantic search
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: message,
          model: 'text-embedding-3-small',
        }),
      });
      
      if (!embeddingResponse.ok) {
        throw new Error('Failed to get embedding from OpenAI');
      }
      
      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;
      
      // Use time-filtered search
      relevantEntries = await searchEntriesWithTimeRange(
        supabase,
        userId,
        queryEmbedding,
        processedTimeRange
      );
    } else {
      // No time range, use general search
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: message,
          model: 'text-embedding-3-small',
        }),
      });
      
      if (!embeddingResponse.ok) {
        throw new Error('Failed to get embedding from OpenAI');
      }
      
      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;
      
      relevantEntries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
    }

    console.log(`Found ${relevantEntries?.length || 0} relevant entries`);

    if (!relevantEntries || relevantEntries.length === 0) {
      return new Response(JSON.stringify({
        data: "I don't have enough journal entries to provide insights about that topic. Try writing more journal entries to get better personalized responses!"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit entries for processing
    const maxEntries = isComprehensiveQuery ? 1000 : 10;
    const entriesToUse = relevantEntries.slice(0, maxEntries);
    
    console.log(`Using ${entriesToUse.length} entries for analysis (comprehensive: ${isComprehensiveQuery})`);

    // Enhanced system prompt with better context
    const systemPrompt = `You are a supportive mental health assistant analyzing journal entries from the SOULo voice journaling app. 

Current date and time: ${new Date().toISOString()}
User timezone: ${userTimezone || clientTimeInfo?.timezoneName || 'UTC'}
Query timeframe: ${processedTimeRange ? `${processedTimeRange.startDate || 'start'} to ${processedTimeRange.endDate || 'end'}` : 'all time'}

IMPORTANT: When providing insights about timeframes like "last week" or "this week", make sure to reference the correct dates based on the current date ${new Date().toISOString()}.

Your role is to:
1. Analyze journal entries with empathy and understanding
2. Provide personalized insights based on patterns and emotions
3. Offer constructive mental health guidance
4. Reference specific dates and timeframes accurately
5. Be supportive while maintaining appropriate boundaries

Always be encouraging, non-judgmental, and focused on the user's wellbeing.`;

    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationContext.slice(-10), // Include recent conversation context
          { 
            role: 'user', 
            content: `Based on these journal entries: ${JSON.stringify(entriesToUse.map(entry => ({
              date: entry.created_at,
              content: entry.content,
              emotions: entry.emotions
            })))}\n\nUser question: ${message}` 
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAiResponse.status}`);
    }

    const openAiData = await openAiResponse.json();
    const assistantResponse = openAiData.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    console.log(`Generated response: ${assistantResponse.substring(0, 100)}...`);

    return new Response(JSON.stringify({ data: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-with-rag:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to detect comprehensive analysis queries
function isComprehensiveAnalysisQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  const comprehensivePatterns = [
    /\b(all|every|entire|complete|full|total|overall|comprehensive)\b/,
    /\b(pattern|trend|analysis|insight|summary|overview)\b/,
    /\b(emotion|feeling|mood)s?\b.*\b(over|during|in|for)\b/,
    /\btop\s+\d+\b/,
    /\bmost\s+(common|frequent|often)\b/
  ];
  
  return comprehensivePatterns.some(pattern => pattern.test(lowerMessage));
}
