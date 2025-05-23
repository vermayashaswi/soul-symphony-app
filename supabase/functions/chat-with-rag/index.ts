
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { searchEntriesWithVector, searchEntriesWithTimeRange, searchEntriesByMonth } from './utils/searchService.ts';
import { detectMentalHealthQuery, detectMonthInQuery, isDirectDateQuery, isJournalAnalysisQuery, isMonthSpecificQuery, detectTimeframeInQuery, classifyQueryComplexity, generateSubQueries } from './utils/queryClassifier.ts';
import { generateSystemPrompt, generateUserPrompt, generateResponse } from './utils/responseGenerator.ts';
import { planQuery, shouldUseComprehensiveSearch, getMaxEntries } from './utils/queryPlanner.ts';

// Import date functions directly from date-fns
import { format, parseISO, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'https://esm.sh/date-fns@4.1.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Validate OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[chat-with-rag] CRITICAL: OpenAI API key not configured');
      return "I'm sorry, but the AI service is not properly configured. Please contact support.";
    }
    
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
    
    // Create query plan
    const queryPlan = planQuery(message, processedTimeRange);
    console.log(`[chat-with-rag] Query plan:`, queryPlan);
    
    // Handle multi-part queries
    if (complexity === 'multi_part') {
      const subQueries = generateSubQueries(message);
      console.log(`[chat-with-rag] Generated sub-queries:`, subQueries);
      
      const subResponses = [];
      for (const subQuery of subQueries) {
        const subResponse = await processSingleQuery(subQuery, userId, supabase, processedTimeRange, clientTimeInfo, userTimezone, openAiApiKey);
        subResponses.push({
          query: subQuery,
          response: subResponse
        });
      }
      
      // Combine responses
      return combineSubQueryResponses(message, subResponses);
    }
    
    // Process single query
    return await processSingleQuery(message, userId, supabase, processedTimeRange, clientTimeInfo, userTimezone, openAiApiKey, conversationContext);
    
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
  openAiApiKey?: string,
  conversationContext: any[] = []
): Promise<string> {
  console.log(`[chat-with-rag] Processing single query: "${message}"`);
  
  try {
    if (!openAiApiKey) {
      openAiApiKey = Deno.env.get('OPENAI_API_KEY');
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
      console.log(`[chat-with-rag] Using time-filtered search with range:`, timeRange);
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
      if (timeRange) {
        return `I don't have any journal entries for the specified time period (${timeRange.startDate ? new Date(timeRange.startDate).toLocaleDateString() : 'start'} to ${timeRange.endDate ? new Date(timeRange.endDate).toLocaleDateString() : 'end'}). Try asking about a different time period or add more journal entries!`;
      } else {
        return "I don't have enough journal entries to provide insights about that topic. Try writing more journal entries to get better personalized responses!";
      }
    }
    
    // Determine if this is a comprehensive query
    const isComprehensive = isComprehensiveAnalysisQuery(message);
    const maxEntries = isComprehensive ? 50 : 10;
    const entriesToUse = relevantEntries.slice(0, maxEntries);
    
    console.log(`[chat-with-rag] Using ${entriesToUse.length} entries for analysis (comprehensive: ${isComprehensive})`);
    
    // Generate system and user prompts
    const systemPrompt = generateSystemPrompt(
      userTimezone || clientTimeInfo?.timezoneName || 'UTC',
      timeRange,
      isComprehensive ? 'aggregated' : 'analysis'
    );
    
    const userPrompt = generateUserPrompt(message, entriesToUse);
    
    // Generate response using OpenAI
    console.log(`[chat-with-rag] Generating response with OpenAI`);
    const response = await generateResponse(
      systemPrompt,
      userPrompt,
      conversationContext,
      openAiApiKey
    );
    
    console.log(`[chat-with-rag] Successfully generated response: ${response.substring(0, 100)}...`);
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
        console.log(`[chat-with-rag] Returning direct date response: ${directResponse}`);
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

    console.log(`[chat-with-rag] Final response ready, length: ${response.length}`);

    return new Response(JSON.stringify({ data: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-with-rag] Error in chat-with-rag:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      data: "I encountered an unexpected error. Please try again or contact support if the problem persists."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
