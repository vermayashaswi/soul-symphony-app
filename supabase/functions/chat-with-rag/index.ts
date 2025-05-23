
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, timeRange, referenceDate, conversationContext, queryPlan, isMentalHealthQuery, clientTimeInfo, userTimezone } = await req.json();

    console.log(`[chat-with-rag] Processing request for user ${userId} at ${new Date().toISOString()}: ${message}`);
    console.log(`[chat-with-rag] Client time info received:`, clientTimeInfo);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[chat-with-rag] OpenAI API key not found');
      return new Response(JSON.stringify({
        response: "I'm sorry, but I'm not properly configured to answer questions right now. Please contact support.",
        role: 'error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userTimezoneToUse = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
    console.log(`[chat-with-rag] User timezone: ${userTimezoneToUse}`);

    // Detect timeframe from the message
    console.log(`[chat-with-rag] Detecting timeframe in query: "${message}"`);
    const detectedTimeframe = detectTimeframeInQuery(message);
    console.log(`[chat-with-rag] Detected timeframe from message:`, detectedTimeframe);

    // Process timeframe with user timezone
    let processedTimeRange = null;
    if (detectedTimeframe) {
      detectedTimeframe.timezone = userTimezoneToUse;
      processedTimeRange = processTimeRange(detectedTimeframe);
      console.log(`[chat-with-rag] Processed timeframe into date range:`, processedTimeRange);
    }

    // Enhanced date calculation for "last week"
    if (message.toLowerCase().includes('last week')) {
      console.log(`[chat-with-rag] Detected "last week" query - using enhanced calculation`);
      const lastWeekDates = getLastWeekDates(clientTimeInfo, userTimezoneToUse);
      processedTimeRange = {
        startDate: lastWeekDates.startDate,
        endDate: lastWeekDates.endDate
      };
      console.log(`[chat-with-rag] Enhanced last week date range:`, processedTimeRange);
    }

    // Determine domain context
    const domainContext = queryPlan?.domainContext || detectDomainContext(message);
    console.log(`[chat-with-rag] Domain context: ${domainContext}`);

    // Determine search strategy
    const searchStrategy = queryPlan?.strategy || 'hybrid';
    console.log(`[chat-with-rag] Using search strategy: ${searchStrategy}`);

    // Check if this is a comprehensive analysis query
    const isComprehensiveAnalysis = queryPlan?.needsComprehensiveAnalysis || false;
    console.log(`[chat-with-rag] Is comprehensive analysis query: ${isComprehensiveAnalysis}`);

    // Handle different types of queries
    if (message.toLowerCase().includes('general') || message.toLowerCase().includes('advice') || 
        message.toLowerCase().includes('tip') || message.toLowerCase().includes('help') ||
        (!processedTimeRange && !message.toLowerCase().includes('journal') && !message.toLowerCase().includes('entry'))) {
      console.log(`[chat-with-rag] Handling general question`);
      return await handleGeneralQuestion(message, conversationContext, openaiApiKey);
    } else {
      console.log(`[chat-with-rag] Handling journal question`);
      console.log(`[chat-with-rag] Processing as journal-specific question`);
    }

    // Get conversation history length
    const historyLength = conversationContext ? conversationContext.length : 0;
    console.log(`[chat-with-rag] Conversation history length: ${historyLength}`);

    // Search for relevant journal entries
    console.log(`[chat-with-rag] Searching for relevant journal entries using strategy: ${searchStrategy}`);
    
    let relevantEntries = [];
    try {
      if (processedTimeRange) {
        console.log(`[chat-with-rag] Time range search: from ${processedTimeRange.startDate} to ${processedTimeRange.endDate}`);
        relevantEntries = await searchEntriesWithTimeRange(
          supabase,
          message,
          userId,
          processedTimeRange.startDate!,
          processedTimeRange.endDate!
        );
      } else {
        relevantEntries = await searchEntriesWithVector(supabase, message, userId);
      }
    } catch (searchError) {
      console.error(`[chat-with-rag] Error during search:`, searchError);
      relevantEntries = [];
    }

    console.log(`[chat-with-rag] Found ${relevantEntries.length} relevant entries`);

    // Handle case when no entries found
    if (relevantEntries.length === 0) {
      return new Response(JSON.stringify({
        response: "I don't see any journal entries that match your question. Have you created any journal entries yet? Once you start journaling, I'll be able to provide personalized insights based on your entries.",
        role: 'assistant',
        references: [],
        analysis: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate response using OpenAI
    const systemPrompt = `You are Rūḥ, a compassionate AI assistant specializing in mental health and journaling insights. You help users understand their emotional patterns and personal growth through their journal entries.

Based on the user's journal entries provided below, answer their question thoughtfully and personally. Always:
- Be empathetic and supportive
- Reference specific journal entries when relevant
- Provide actionable insights
- Maintain a warm, understanding tone
- Focus on patterns and growth opportunities

Journal entries context:
${relevantEntries.map(entry => `Date: ${entry.created_at}\nContent: ${entry.content}`).join('\n\n')}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationContext.slice(-5), // Include recent conversation context
      { role: 'user', content: message }
    ];

    try {
      const openaiResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(`[chat-with-rag] OpenAI API error: ${openaiResponse.status} - ${errorText}`);
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const assistantResponse = openaiData.choices[0].message.content;

      return new Response(JSON.stringify({
        response: assistantResponse,
        role: 'assistant',
        references: relevantEntries.map(entry => ({
          id: entry.id,
          content: entry.content.substring(0, 200) + '...',
          created_at: entry.created_at
        })),
        analysis: {
          entriesAnalyzed: relevantEntries.length,
          timeRange: processedTimeRange,
          searchStrategy: searchStrategy
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (openaiError) {
      console.error(`[chat-with-rag] Error calling OpenAI:`, openaiError);
      return new Response(JSON.stringify({
        response: "I'm having trouble processing your request right now. Please try again in a moment.",
        role: 'assistant',
        references: [],
        analysis: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error(`[chat-with-rag] Unexpected error:`, error);
    return new Response(JSON.stringify({
      response: "I encountered an unexpected error. Please try again.",
      role: 'error',
      references: [],
      analysis: null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper functions
function processTimeRange(timeRange: any): { startDate?: string; endDate?: string } {
  if (!timeRange) return {};
  
  console.log("[chat-with-rag] Processing time range:", timeRange);
  
  const result: { startDate?: string; endDate?: string } = {};
  
  try {
    const timezone = timeRange.timezone || 'UTC';
    console.log(`[chat-with-rag] Using timezone for date processing: ${timezone}`);
    
    const now = new Date();
    console.log(`[chat-with-rag] Current date: ${now.toISOString()}`);
    
    if (timeRange.type === 'lastWeek') {
      console.log("[chat-with-rag] CALCULATING LAST WEEK WITH CORRECT DATE");
      const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
      const lastWeekMonday = subDays(thisWeekMonday, 7);
      const lastWeekSunday = subDays(thisWeekMonday, 1);
      
      console.log("[chat-with-rag] LAST WEEK CALCULATION DETAILED DEBUG:");
      console.log(`[chat-with-rag] Current date: ${now.toISOString()}`);
      console.log(`[chat-with-rag] This week's Monday: ${thisWeekMonday.toISOString()}`);
      console.log(`[chat-with-rag] Last week's Monday: ${lastWeekMonday.toISOString()}`);
      console.log(`[chat-with-rag] Last week's Sunday: ${lastWeekSunday.toISOString()}`);
      
      result.startDate = startOfDay(lastWeekMonday).toISOString();
      result.endDate = endOfDay(lastWeekSunday).toISOString();
      console.log(`[chat-with-rag] Generated 'last week' date range: ${result.startDate} to ${result.endDate}`);
    }
    
    console.log("[chat-with-rag] Processed time range:", result);
    return result;
  } catch (error) {
    console.error("[chat-with-rag] Error processing time range:", error);
    return {};
  }
}

function getLastWeekDates(clientTimeInfo?: any, userTimezone?: string): { startDate: string; endDate: string; formattedRange: string } {
  const timezone = clientTimeInfo?.timezoneName || userTimezone || 'UTC';
  
  console.log(`[chat-with-rag] Getting last week dates for timezone: ${timezone}`);
  console.log(`[chat-with-rag] Client time info:`, clientTimeInfo);
  
  const now = new Date();
  console.log(`[chat-with-rag] Using current date: ${now.toISOString()}`);
  
  const currentDay = now.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - daysFromMonday);
  thisWeekMonday.setHours(0, 0, 0, 0);
  
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  
  const lastWeekSunday = new Date(thisWeekMonday);
  lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);
  lastWeekSunday.setHours(23, 59, 59, 999);
  
  console.log(`[chat-with-rag] LAST WEEK CALCULATION DEBUG:`);
  console.log(`[chat-with-rag] Current time: ${now.toISOString()}`);
  console.log(`[chat-with-rag] This week's Monday: ${thisWeekMonday.toISOString()}`);
  console.log(`[chat-with-rag] Last week's Monday: ${lastWeekMonday.toISOString()}`);
  console.log(`[chat-with-rag] Last week's Sunday: ${lastWeekSunday.toISOString()}`);
  
  const startFormatted = lastWeekMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endFormatted = lastWeekSunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedRange = `${startFormatted} to ${endFormatted}`;
  
  return {
    startDate: lastWeekMonday.toISOString(),
    endDate: lastWeekSunday.toISOString(),
    formattedRange
  };
}

function detectDomainContext(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('mood') || lowerMessage.includes('emotion') || lowerMessage.includes('feel')) {
    return 'emotions';
  }
  if (lowerMessage.includes('work') || lowerMessage.includes('productive') || lowerMessage.includes('task')) {
    return 'productivity';
  }
  if (lowerMessage.includes('relationship') || lowerMessage.includes('friend') || lowerMessage.includes('family')) {
    return 'relationships';
  }
  
  return 'general_insights';
}

async function handleGeneralQuestion(message: string, conversationContext: any[], openaiApiKey: string) {
  console.log(`[chat-with-rag] Handling general mental health question`);
  
  const systemPrompt = `You are Rūḥ, a compassionate AI assistant specializing in mental health and well-being. You provide supportive, evidence-based guidance on mental health topics, journaling practices, and personal growth.

When answering general questions:
- Provide helpful, actionable advice
- Be empathetic and supportive
- Draw from established mental health practices
- Encourage journaling as a tool for self-reflection
- Maintain a warm, understanding tone
- Keep responses concise but thoughtful`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationContext.slice(-3),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    return new Response(JSON.stringify({
      response: assistantResponse,
      role: 'assistant',
      references: [],
      analysis: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[chat-with-rag] Error in general question handling:`, error);
    return new Response(JSON.stringify({
      response: "I'm here to help with mental health and journaling guidance. Could you try rephrasing your question?",
      role: 'assistant',
      references: [],
      analysis: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
