
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchEntriesWithVector, searchEntriesWithTimeRange, searchEntriesByMonth } from './utils/searchService.ts';
import { detectMentalHealthQuery, detectMonthInQuery, isDirectDateQuery, isJournalAnalysisQuery, isMonthSpecificQuery, detectTimeframeInQuery, classifyQueryComplexity, generateSubQueries } from './utils/queryClassifier.ts';

// Import date functions directly from date-fns
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Enhanced date calculation functions with proper timezone handling
function getLastWeekDates(clientTimeInfo?: any, userTimezone?: string): { startDate: string; endDate: string; formattedRange: string } {
  const timezone = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
  
  console.log(`[chat-with-rag] Getting last week dates for timezone: ${timezone}`);
  
  // Get reference time (prefer client's time over server time)
  const referenceTime = clientTimeInfo?.timestamp ? new Date(clientTimeInfo.timestamp) : new Date();
  const now = timezone !== 'UTC' ? toZonedTime(referenceTime, timezone) : referenceTime;
  
  // Get this week's Monday (start of current week) - week starts on Monday (1)
  const currentDay = now.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
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
  
  console.log(`[chat-with-rag] LAST WEEK CALCULATION:`);
  console.log(`[chat-with-rag] Last week's Monday: ${lastWeekMonday.toISOString()}`);
  console.log(`[chat-with-rag] Last week's Sunday: ${lastWeekSunday.toISOString()}`);
  
  // Format for display
  const startFormatted = lastWeekMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endFormatted = lastWeekSunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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
      }
    }
    
    // Handle endDate if provided
    if (timeRange.endDate) {
      const endDate = new Date(timeRange.endDate);
      if (!isNaN(endDate.getTime())) {
        result.endDate = endDate.toISOString();
      }
    }
    
    // Calculate current date in user's timezone
    const now = timezone ? toZonedTime(new Date(), timezone) : new Date();
    
    // Handle special time range cases
    if (timeRange.type === 'week') {
      result.startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      result.endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
    } else if (timeRange.type === 'lastWeek') {
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      result.startDate = startOfDay(lastWeekMonday).toISOString();
      result.endDate = endOfDay(lastWeekSunday).toISOString();
    } else if (timeRange.type === 'month') {
      result.startDate = startOfMonth(now).toISOString();
      result.endDate = endOfMonth(now).toISOString();
    } else if (timeRange.type === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      result.startDate = startOfMonth(lastMonth).toISOString();
      result.endDate = endOfMonth(lastMonth).toISOString();
    } else if (timeRange.type === 'specificMonth' && timeRange.monthName) {
      processSpecificMonthByName(timeRange.monthName, result, timeRange.year, timezone);
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
  }
}

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

// Enhanced query processing function
async function processQuery(
  message: string,
  userId: string,
  supabase: any,
  clientTimeInfo?: any,
  userTimezone?: string,
  conversationContext: any[] = []
): Promise<string> {
  console.log(`[chat-with-rag] Processing query: "${message}"`);
  
  try {
    // Classify query complexity
    const complexity = classifyQueryComplexity(message);
    console.log(`[chat-with-rag] Query complexity: ${complexity}`);
    
    // Detect timeframe
    const detectedTimeframe = detectTimeframeInQuery(message);
    let processedTimeRange = null;
    
    if (detectedTimeframe) {
      // Add timezone and client info to detected timeframe
      if (detectedTimeframe.timezone === 'UTC' && (clientTimeInfo?.timezoneName || userTimezone)) {
        detectedTimeframe.timezone = clientTimeInfo?.timezoneName || userTimezone;
      }
      processedTimeRange = processTimeRange(detectedTimeframe);
      console.log(`[chat-with-rag] Processed timeframe:`, processedTimeRange);
    }
    
    // Handle multi-part queries
    if (complexity === 'multi_part') {
      const subQueries = generateSubQueries(message);
      console.log(`[chat-with-rag] Generated sub-queries:`, subQueries);
      
      const subResponses = [];
      for (const subQuery of subQueries) {
        const subResponse = await processSingleQuery(subQuery, userId, supabase, processedTimeRange, clientTimeInfo, userTimezone);
        subResponses.push({
          query: subQuery,
          response: subResponse
        });
      }
      
      // Combine responses
      return combineSubQueryResponses(message, subResponses);
    }
    
    // Process single query
    return await processSingleQuery(message, userId, supabase, processedTimeRange, clientTimeInfo, userTimezone, conversationContext);
    
  } catch (error) {
    console.error('[chat-with-rag] Error processing query:', error);
    return "I apologize, but I encountered an error while processing your question. Please try rephrasing your question or try again.";
  }
}

// Process a single query
async function processSingleQuery(
  message: string,
  userId: string,
  supabase: any,
  timeRange?: any,
  clientTimeInfo?: any,
  userTimezone?: string,
  conversationContext: any[] = []
): Promise<string> {
  console.log(`[chat-with-rag] Processing single query: "${message}"`);
  
  try {
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
    
    // Search for relevant entries
    let relevantEntries = [];
    
    if (timeRange && (timeRange.startDate || timeRange.endDate)) {
      console.log(`[chat-with-rag] Using time-filtered search`);
      relevantEntries = await searchEntriesWithTimeRange(
        supabase,
        userId,
        queryEmbedding,
        timeRange
      );
    } else {
      console.log(`[chat-with-rag] Using general vector search`);
      relevantEntries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
    }
    
    console.log(`[chat-with-rag] Found ${relevantEntries?.length || 0} relevant entries`);
    
    if (!relevantEntries || relevantEntries.length === 0) {
      return "I don't have enough journal entries to provide insights about that topic. Try writing more journal entries to get better personalized responses!";
    }
    
    // Determine if this is a comprehensive query
    const isComprehensive = isComprehensiveAnalysisQuery(message);
    const maxEntries = isComprehensive ? 1000 : 10;
    const entriesToUse = relevantEntries.slice(0, maxEntries);
    
    // Generate response using OpenAI
    const systemPrompt = `You are a supportive mental health assistant analyzing journal entries from the SOULo voice journaling app. 

Current date and time: ${new Date().toISOString()}
User timezone: ${userTimezone || clientTimeInfo?.timezoneName || 'UTC'}
Query timeframe: ${timeRange ? `${timeRange.startDate || 'start'} to ${timeRange.endDate || 'end'}` : 'all time'}

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
          ...conversationContext.slice(-10),
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
      throw new Error(`OpenAI API error: ${openAiResponse.status}`);
    }

    const openAiData = await openAiResponse.json();
    const response = openAiData.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    
    console.log(`[chat-with-rag] Generated response: ${response.substring(0, 100)}...`);
    return response;
    
  } catch (error) {
    console.error('[chat-with-rag] Error in processSingleQuery:', error);
    return "I apologize, but I encountered an error while analyzing your journal entries. Please try rephrasing your question.";
  }
}

// Combine sub-query responses
function combineSubQueryResponses(originalQuery: string, subResponses: any[]): string {
  if (subResponses.length === 1) {
    return subResponses[0].response;
  }
  
  let combinedResponse = `Here's what I found regarding your questions:\n\n`;
  
  subResponses.forEach((resp, index) => {
    combinedResponse += `**${index + 1}. ${resp.query}**\n${resp.response}\n\n`;
  });
  
  return combinedResponse.trim();
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
      throw new Error('Missing required parameters: message and userId');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Process the query
    const response = await processQuery(
      message,
      userId,
      supabase,
      clientTimeInfo,
      userTimezone,
      conversationContext || []
    );

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in chat-with-rag:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
