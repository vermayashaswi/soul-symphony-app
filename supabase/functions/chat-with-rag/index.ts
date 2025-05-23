
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchEntriesWithVector, searchEntriesWithTimeRange, searchEntriesByMonth } from './utils/searchService.ts';
import { detectMentalHealthQuery, detectMonthInQuery, isDirectDateQuery, isJournalAnalysisQuery, isMonthSpecificQuery, detectTimeframeInQuery } from './utils/queryClassifier.ts';

// Import date functions directly from date-fns
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Process a time range object to ensure dates are in proper format
 */
function processTimeRange(timeRange: any): { startDate?: string; endDate?: string } {
  if (!timeRange) return {};
  
  console.log("[chat-with-rag] Processing time range:", timeRange);
  
  const result: { startDate?: string; endDate?: string } = {};
  
  try {
    // Use timezone from the timeRange object if available
    const timezone = timeRange.timezone || 'UTC';
    console.log(`[chat-with-rag] Using timezone for date processing: ${timezone}`);
    
    // Handle startDate if provided
    if (timeRange.startDate) {
      const startDate = new Date(timeRange.startDate);
      if (!isNaN(startDate.getTime())) {
        result.startDate = startDate.toISOString();
      } else {
        console.warn(`[chat-with-rag] Invalid startDate: ${timeRange.startDate}`);
      }
    }
    
    // Handle endDate if provided
    if (timeRange.endDate) {
      const endDate = new Date(timeRange.endDate);
      if (!isNaN(endDate.getTime())) {
        result.endDate = endDate.toISOString();
      } else {
        console.warn(`[chat-with-rag] Invalid endDate: ${timeRange.endDate}`);
      }
    }
    
    // Calculate current date in user's timezone
    const now = timezone ? toZonedTime(new Date(), timezone) : new Date();
    console.log(`[chat-with-rag] Current date in timezone ${timezone}: ${now.toISOString()}`);
    
    // Handle special time range cases
    if (timeRange.type === 'week') {
      result.startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      result.endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
      console.log(`[chat-with-rag] Generated 'this week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastWeek') {
      console.log("[chat-with-rag] CALCULATING LAST WEEK");
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      console.log("[chat-with-rag] LAST WEEK CALCULATION DETAILED DEBUG:");
      console.log(`[chat-with-rag] Current date in timezone ${timezone}: ${now.toISOString()}`);
      console.log(`[chat-with-rag] This week's Monday: ${thisWeekMonday.toISOString()}`);
      console.log(`[chat-with-rag] Last week's Monday: ${lastWeekMonday.toISOString()}`);
      console.log(`[chat-with-rag] Last week's Sunday: ${lastWeekSunday.toISOString()}`);
      
      result.startDate = startOfDay(lastWeekMonday).toISOString();
      result.endDate = endOfDay(lastWeekSunday).toISOString();
      console.log(`[chat-with-rag] Generated 'last week' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'month') {
      result.startDate = startOfMonth(now).toISOString();
      result.endDate = endOfMonth(now).toISOString();
      console.log(`[chat-with-rag] Generated 'this month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      result.startDate = startOfMonth(lastMonth).toISOString();
      result.endDate = endOfMonth(lastMonth).toISOString();
      console.log(`[chat-with-rag] Generated 'last month' date range: ${result.startDate} to ${result.endDate}`);
    } else if (timeRange.type === 'specificMonth' && timeRange.monthName) {
      console.log(`[chat-with-rag] Processing specific month: ${timeRange.monthName}`);
      processSpecificMonthByName(timeRange.monthName, result, timeRange.year, timezone);
      console.log(`[chat-with-rag] Processed specific month name "${timeRange.monthName}" to date range: ${result.startDate} to ${result.endDate}`);
    }
    
    // Validate the resulting dates
    if (result.startDate && result.endDate) {
      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);
      
      if (startDate > endDate) {
        console.warn(`[chat-with-rag] Invalid date range: startDate (${result.startDate}) is after endDate (${result.endDate})`);
        const temp = result.startDate;
        result.startDate = result.endDate;
        result.endDate = temp;
      }
    }
    
    console.log("[chat-with-rag] Processed time range:", result);
    return result;
  } catch (error) {
    console.error("[chat-with-rag] Error processing time range:", error);
    return {};
  }
}

/**
 * Process a specific month by name
 */
function processSpecificMonthByName(monthName: string, result: { startDate?: string; endDate?: string }, year?: number, timezone?: string) {
  const now = timezone ? toZonedTime(new Date(), timezone) : new Date();
  const currentYear = now.getFullYear();
  const targetYear = year || currentYear;
  
  console.log(`[chat-with-rag] Processing month ${monthName} for year ${targetYear} with timezone ${timezone}`);
  
  const monthMap: Record<string, number> = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };
  
  const normalizedMonthName = monthName.toLowerCase().trim();
  let monthIndex: number | undefined = undefined;
  
  if (monthMap.hasOwnProperty(normalizedMonthName)) {
    monthIndex = monthMap[normalizedMonthName];
    console.log(`[chat-with-rag] Found exact match for month name "${monthName}" -> index ${monthIndex}`);
  }
  
  if (monthIndex !== undefined) {
    let startDate: Date;
    let endDate: Date;
    
    if (timezone) {
      const timezonedDate = toZonedTime(new Date(targetYear, monthIndex, 1), timezone);
      startDate = startOfMonth(timezonedDate);
      endDate = endOfMonth(timezonedDate);
    } else {
      startDate = startOfMonth(new Date(targetYear, monthIndex, 1));
      endDate = endOfMonth(new Date(targetYear, monthIndex, 1));
    }
    
    result.startDate = startOfDay(startDate).toISOString();
    result.endDate = endOfDay(endDate).toISOString();
    
    console.log(`[chat-with-rag] Generated date range for ${monthName} ${targetYear}: ${result.startDate} to ${result.endDate}`);
  } else {
    console.warn(`[chat-with-rag] Unknown month name: "${monthName}"`);
  }
}

// Enhanced date calculation functions with proper timezone handling
function getLastWeekDates(clientTimeInfo?: any, userTimezone?: string): { startDate: string; endDate: string; formattedRange: string } {
  const timezone = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
  
  console.log(`[chat-with-rag] Getting last week dates for timezone: ${timezone}`);
  console.log(`[chat-with-rag] Client time info:`, clientTimeInfo);
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  console.log(`[chat-with-rag] Using reference time: ${referenceTime.toISOString()}`);
  
  // Convert to user's timezone if provided
  const now = timezone !== 'UTC' ? toZonedTime(referenceTime, timezone) : referenceTime;
  
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
  const timezone = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
  
  console.log(`[chat-with-rag] Getting current week dates for timezone: ${timezone}`);
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  const now = timezone !== 'UTC' ? toZonedTime(referenceTime, timezone) : referenceTime;
  
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

    console.log(`[chat-with-rag] Processing request for user ${userId} at ${new Date().toISOString()}: ${message}`);
    console.log(`[chat-with-rag] Cache breaker: ${Date.now()}`);
    console.log(`[chat-with-rag] Client time info received:`, clientTimeInfo);
    console.log(`[chat-with-rag] User timezone: ${userTimezone}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Check if OpenAI API key exists
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[chat-with-rag] Missing OpenAI API key');
      return new Response(JSON.stringify({
        data: "I'm unable to process your request right now due to a configuration issue. Please contact support."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Enhanced timeframe detection and processing
    let processedTimeRange = timeRange;
    
    // If no time range provided, try to detect it from the message
    if (!processedTimeRange || (!processedTimeRange.startDate && !processedTimeRange.endDate)) {
      const detectedTimeframe = detectTimeframeInQuery(message);
      if (detectedTimeframe) {
        console.log(`[chat-with-rag] Detected timeframe from message:`, detectedTimeframe);
        
        // Add timezone and client info to detected timeframe
        if (detectedTimeframe.timezone === 'UTC' && (clientTimeInfo?.timezoneName || userTimezone)) {
          detectedTimeframe.timezone = clientTimeInfo?.timezoneName || userTimezone;
        }
        
        // Process the detected timeframe into actual dates
        processedTimeRange = processTimeRange(detectedTimeframe);
        console.log(`[chat-with-rag] Processed timeframe into date range:`, processedTimeRange);
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
    
    console.log(`[chat-with-rag] Domain context: ${domainContext}`);
    console.log(`[chat-with-rag] Using search strategy: ${searchStrategy}`);

    const isComprehensiveQuery = isComprehensiveAnalysisQuery(message);
    console.log(`[chat-with-rag] Is comprehensive analysis query: ${isComprehensiveQuery}`);
    
    console.log('[chat-with-rag] Handling journal question');
    console.log(`[chat-with-rag] Processing as journal-specific question`);
    console.log(`[chat-with-rag] Conversation history length: ${conversationContext?.length || 0}`);

    const isTimePatternQuery = /\b(pattern|trend|change|over time|frequency|often|usually|typically)\b/i.test(message);
    const isTimeSummaryQuery = /\b(summary|summarize|overview|review)\b/i.test(message) && 
                               /\b(week|month|year|period|time)\b/i.test(message);
    const isPersonalityQuery = /\b(personality|character|trait|type|am i|who am i)\b/i.test(message);
    const isJournalAnalysis = isJournalAnalysisQuery(message);

    console.log(`[chat-with-rag] Is time pattern query: ${isTimePatternQuery}`);
    console.log(`[chat-with-rag] Is time summary query: ${isTimeSummaryQuery}`);
    console.log(`[chat-with-rag] Is personality query: ${isPersonalityQuery}`);
    console.log(`[chat-with-rag] Is journal analysis query: ${isJournalAnalysis}`);

    // Search for relevant journal entries using enhanced search
    console.log('[chat-with-rag] Searching for relevant journal entries using strategy:', searchStrategy);

    let relevantEntries = [];
    
    try {
      // Enhanced search logic with proper date range handling
      if (processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate)) {
        console.log(`[chat-with-rag] Time range search: from ${processedTimeRange.startDate || 'none'} to ${processedTimeRange.endDate || 'none'}`);
        
        // Get query embedding for semantic search
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: message,
            model: 'text-embedding-3-small',
          }),
        });
        
        if (!embeddingResponse.ok) {
          throw new Error(`Failed to get embedding from OpenAI: ${embeddingResponse.status} ${await embeddingResponse.text()}`);
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
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: message,
            model: 'text-embedding-3-small',
          }),
        });
        
        if (!embeddingResponse.ok) {
          throw new Error(`Failed to get embedding from OpenAI: ${embeddingResponse.status} ${await embeddingResponse.text()}`);
        }
        
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;
        
        relevantEntries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
      }

      console.log(`[chat-with-rag] Found ${relevantEntries?.length || 0} relevant entries`);
    } catch (error) {
      console.error('[chat-with-rag] Error during search:', error);
      // Continue with empty entries array - we'll handle this case below
    }

    if (!relevantEntries || relevantEntries.length === 0) {
      // Provide a helpful response when no entries are found
      const noEntriesMessage = processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate) 
        ? `I don't have any journal entries for the time period you asked about. Try asking about a different time period, or try journaling more regularly to get personalized insights.`
        : `I don't have enough journal entries to provide insights about that topic. Try writing more journal entries to get better personalized responses!`;
      
      console.log(`[chat-with-rag] No entries found, returning helpful message: ${noEntriesMessage}`);
      
      return new Response(JSON.stringify({
        data: noEntriesMessage
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Limit entries for processing
      const maxEntries = isComprehensiveQuery ? 1000 : 10;
      const entriesToUse = relevantEntries.slice(0, maxEntries);
      
      console.log(`[chat-with-rag] Using ${entriesToUse.length} entries for analysis (comprehensive: ${isComprehensiveQuery})`);

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

      // Carefully handle the OpenAI API call with proper error handling
      try {
        const openAiResponse = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini', // Using a more modern model that's reliable
            messages: [
              { role: 'system', content: systemPrompt },
              ...(conversationContext || []).slice(-10), // Include recent conversation context
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
          console.error('[chat-with-rag] OpenAI API error:', errorText);
          throw new Error(`OpenAI API error: ${openAiResponse.status} - ${errorText}`);
        }

        const openAiData = await openAiResponse.json();
        console.log('[chat-with-rag] OpenAI response received:', JSON.stringify(openAiData).substring(0, 200) + '...');
        
        const assistantResponse = openAiData.choices[0]?.message?.content;
        
        if (!assistantResponse) {
          throw new Error('Empty response from OpenAI');
        }

        console.log(`[chat-with-rag] Generated response: ${assistantResponse.substring(0, 100)}...`);

        // CRITICAL: Return the response in the correct format that messageService expects
        return new Response(JSON.stringify({ data: assistantResponse }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (openAiError) {
        console.error('[chat-with-rag] Error in OpenAI processing:', openAiError);
        
        // Provide a fallback response
        return new Response(JSON.stringify({ 
          data: "I'm having trouble analyzing your journal entries right now. Here's what I know: I found relevant entries in your journal, but couldn't generate insights from them. You might want to try asking a different question or trying again later."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('[chat-with-rag] Error processing entries:', error);
      
      // Provide a specific fallback based on what we've found
      return new Response(JSON.stringify({ 
        data: "I found some relevant journal entries, but ran into an issue while analyzing them. Please try asking your question again, maybe with different wording."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('[chat-with-rag] Error in chat-with-rag:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      data: "I'm sorry, but I encountered an error while processing your request. Please try again with a simpler question, or contact support if the issue persists."
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
