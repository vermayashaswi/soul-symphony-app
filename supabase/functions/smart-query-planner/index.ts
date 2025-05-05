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
    const { message, userId, conversationContext = [], timezoneOffset } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);
    console.log(`User timezone offset: ${timezoneOffset} minutes`);
    
    // Check message types and planQuery
    const messageTypesResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a classification tool that determines if a user's query is a general question about mental health (respond with "mental_health_general") OR if it's a question seeking insights from the user's journal entries (respond with "journal_specific"). Respond with ONLY "mental_health_general" or "journal_specific".`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 10
      }),
    });

    if (!messageTypesResponse.ok) {
      console.error('Failed to get message types:', await messageTypesResponse.text());
      throw new Error('Failed to classify message type');
    }

    const response = await messageTypesResponse.json();

    // Process time-based queries more accurately
    let hasTimeFilter = false;
    let timeRangeMentioned = null;

    // Enhanced time detection - look for time expressions in the query
    const timeKeywords = [
      'today', 'yesterday', 'this week', 'last week', 
      'this month', 'last month', 'this year', 'last year',
      'recent', 'latest', 'current', 'past'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    for (const keyword of timeKeywords) {
      if (lowerMessage.includes(keyword)) {
        console.log(`Detected time keyword: ${keyword}`);
        timeRangeMentioned = keyword;
        hasTimeFilter = true;
        break;
      }
    }

    // If the user is asking about a specific date, extract it
    let specificDate = null;
    const dateRegex = /(\d{4}[-./]\d{2}[-./]\d{2})|(\d{2}[-./]\d{2}[-./]\d{4})/;
    const dateMatch = message.match(dateRegex);
    if (dateMatch) {
      try {
        specificDate = new Date(dateMatch[0]).toISOString().split('T')[0];
        console.log(`Detected specific date: ${specificDate}`);
      } catch (error) {
        console.error("Error parsing specific date:", error);
      }
    }

    // Determine the queryType (mental_health_general or journal_specific)
    const queryType = response.data;
    
    // Build the search plan
    let plan = null;
    let directResponse = null;

    if (queryType === 'mental_health_general') {
      console.log("Query classified as:", queryType);
      directResponse = null; // Process general queries with our standard chat flow
    } else if (queryType === 'journal_specific') {
      console.log("Query classified as:", queryType);
      
      // Build a plan for journal-specific queries
      const planResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an AI query planner for a journaling application. Your task is to analyze user questions and create search plans that efficiently retrieve relevant journal entries. 
              
              For the following user query, create a JSON search plan with these components:

              1. "strategy": Choose the most appropriate search method:
                 - "vector" (semantic search, default for conceptual queries)
                 - "sql" (direct filtering, best for time/attribute-based queries)
                 - "hybrid" (combines both approaches)
              
              2. "filters": Add relevant filters based on the query:
                 - "date_range": {startDate, endDate, periodName} (for time-based queries)
                 - "emotions": [] (array of emotions to filter for)
                 - "sentiment": [] (array of sentiments: "positive", "negative", "neutral")
                 - "themes": [] (array of themes to filter for)
                 - "entities": [{type, name}] (people, places, etc. mentioned)
              
              3. "match_count": Number of entries to retrieve (default 15, use 30+ for aggregations)
              
              4. "needs_data_aggregation": Boolean (true if statistical analysis needed)
              
              5. "needs_more_context": Boolean (true if query relates to previous messages)

              Example time periods include "today", "yesterday", "this week", "last week", "this month", "last month", etc.

              Return ONLY the JSON plan, nothing else. Ensure it's valid JSON format.
              `
            },
            { role: 'user', content: message }
          ],
          temperature: 0.3,
        }),
      });

      if (!planResponse.ok) {
        console.error('Failed to get query plan:', await planResponse.text());
        throw new Error('Failed to generate query plan');
      }

      const planData = await planResponse.json();
      const planText = planData.choices[0]?.message?.content || '';
      
      try {
        // Extract just the JSON part if there's any explanatory text
        const jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/) || planText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : planText;
        console.log("Generated raw plan:", jsonStr);
        
        // Handle special case for time-based queries
        if (timeRangeMentioned && !jsonStr.includes('"date_range"')) {
          // Add time range to the plan
          const tempPlan = JSON.parse(jsonStr);
          console.log("Adding time range to plan for:", timeRangeMentioned);
          tempPlan.filters = tempPlan.filters || {};
          
          // Use our service to calculate the proper date range based on timezone
          const dateRange = calculateRelativeDateRange(timeRangeMentioned, timezoneOffset);
          tempPlan.filters.date_range = dateRange;
          
          plan = tempPlan;
        } else {
          plan = JSON.parse(jsonStr);
        }
      } catch (e) {
        console.error('Error parsing plan JSON:', e);
        console.error('Raw plan text:', planText);
        plan = {
          strategy: 'vector',
          filters: hasTimeFilter ? { date_range: calculateRelativeDateRange(timeRangeMentioned || 'recent', timezoneOffset) } : {},
          match_count: 15,
          needs_data_aggregation: message.includes('how many') || message.includes('count') || message.includes('statistics'),
          needs_more_context: false
        };
      }
    } else {
      console.error("Unknown query type:", queryType);
    }

    // If a specific date was detected, ensure it's used in the plan
    if (specificDate && plan) {
      plan.filters = plan.filters || {};
      plan.filters.date_range = {
        startDate: specificDate,
        endDate: specificDate,
        periodName: 'specific date'
      };
      console.log("Forcing date range in plan to:", specificDate);
    }

    // Return the plan
    return new Response(
      JSON.stringify({ 
        plan, 
        queryType,
        directResponse 
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error in query planner:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

/**
 * Calculates relative date ranges based on time expressions
 * @param timePeriod - The time period expression (e.g., "this month", "last week")
 * @param timezoneOffset - User's timezone offset in minutes
 * @returns Date range with start and end dates
 */
function calculateRelativeDateRange(timePeriod: string, timezoneOffset: number = 0): { startDate: string, endDate: string, periodName: string } {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Get current date in user's timezone
  const now = new Date(Date.now() - offsetMs);
  let startDate = new Date(now);
  let endDate = new Date(now);
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${now.toISOString()}`);
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'today';
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'yesterday';
  } 
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Sunday, end at Saturday 23:59:59
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
    endDate.setHours(23, 59, 59, 999);
    periodName = 'this week';
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // Last week: Start at previous week Sunday, end at previous week Saturday 23:59:59
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last week';
  } 
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month 23:59:59
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    periodName = 'this month';
  } 
  else if (lowerTimePeriod.includes('last month')) {
    // Last month: Start at 1st of previous month, end at last day of previous month 23:59:59
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    periodName = 'last month';
  } 
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st 23:59:59
    startDate = new Date(startDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodName = 'this year';
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year 23:59:59
    startDate = new Date(startDate.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodName = 'last year';
  } 
  else {
    // Default to last 30 days if no specific period matched
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last 30 days';
  }

  // Add back the timezone offset to convert to UTC for storage
  startDate = new Date(startDate.getTime() + offsetMs);
  endDate = new Date(endDate.getTime() + offsetMs);
  
  console.log(`Date range calculated: 
    Start: ${startDate.toISOString()} (${startDate.toLocaleDateString()})
    End: ${endDate.toISOString()} (${endDate.toLocaleDateString()})
    Period: ${periodName}`);
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    periodName
  };
}
