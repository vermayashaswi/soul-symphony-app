
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  addDays,
  endOfDay, 
  endOfMonth, 
  endOfWeek, 
  endOfYear, 
  startOfDay, 
  startOfMonth, 
  startOfWeek, 
  startOfYear, 
  subDays, 
  subMonths, 
  subWeeks, 
  subYears
} from "https://esm.sh/date-fns@2.30.0";

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
            content: `You are a classification tool that determines if a user's query is a general question about mental health (respond with "mental_health_general") OR if it's a question seeking insights from the user's journal entries (respond with "journal_specific"). 

Specifically, if the user is asking for ANY of the following, classify as "journal_specific":
- Personal ratings, scores, or evaluations based on their journal entries
- Analysis of their traits, behaviors, or patterns
- Reviews or assessments of their personal characteristics
- Any query asking to "rate me", "analyze me", "evaluate me", or similar
- Questions seeking quantitative or qualitative assessment of the user
- Any request for statistics or metrics about their journaling data
- Analysis of specific emotions or sentiment patterns in their entries

Respond with ONLY "mental_health_general" or "journal_specific".

Examples:
- "How are you doing?" -> "mental_health_general"
- "What is journaling?" -> "mental_health_general"
- "Rate my productivity" -> "journal_specific"
- "What are my top 3 negative traits?" -> "journal_specific"
- "Analyze my emotional patterns" -> "journal_specific"
- "Score my happiness level" -> "journal_specific"
- "How was I feeling last week?" -> "journal_specific"
- "What patterns do you see in my anxiety?" -> "journal_specific"`
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
    const queryType = response.choices[0]?.message?.content?.trim() || 'journal_specific';
    console.log("Query classified as:", queryType);
    
    // Check for rating/analysis requests specifically
    const isRatingOrAnalysisRequest = /rate|analyze|evaluate|assess|score|rank|review/i.test(message);
    if (isRatingOrAnalysisRequest) {
      console.log("Detected rating or analysis request, ensuring journal_specific classification");
    }
    
    // Build the search plan
    let plan = null;
    let directResponse = null;

    if (queryType === 'mental_health_general' && !isRatingOrAnalysisRequest) {
      console.log("Query classified as general mental health question");
      directResponse = null; // Process general queries with our standard chat flow
    } else {
      console.log("Query classified as journal-specific or rating request");
      
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
                 - IMPORTANT: Set this to true for ALL rating, scoring, or evaluation requests
                 - Also set to true for any pattern analysis, trait assessment, or statistic requests
              
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
        
        // Force data aggregation for rating/analysis requests
        if (isRatingOrAnalysisRequest && !plan.needs_data_aggregation) {
          console.log("Forcing data aggregation for rating/analysis request");
          plan.needs_data_aggregation = true;
          plan.match_count = Math.max(plan.match_count || 15, 30); // Ensure we get enough data
        }
      } catch (e) {
        console.error('Error parsing plan JSON:', e);
        console.error('Raw plan text:', planText);
        plan = {
          strategy: 'vector',
          filters: hasTimeFilter ? { date_range: calculateRelativeDateRange(timeRangeMentioned || 'recent', timezoneOffset) } : {},
          match_count: isRatingOrAnalysisRequest ? 30 : 15,
          needs_data_aggregation: isRatingOrAnalysisRequest || message.includes('how many') || message.includes('count') || message.includes('statistics'),
          needs_more_context: false
        };
      }
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
        queryType: isRatingOrAnalysisRequest ? 'journal_specific' : queryType,
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
  // Validate the timezone offset
  if (typeof timezoneOffset !== 'number') {
    console.error(`Invalid timezone offset: ${timezoneOffset}, using default 0`);
    timezoneOffset = 0;
  }
  
  // Enforce timezone offset limits (-12:00 to +14:00)
  if (timezoneOffset < -720 || timezoneOffset > 840) {
    console.error(`Timezone offset out of range: ${timezoneOffset}, clamping to valid range`);
    timezoneOffset = Math.max(-720, Math.min(840, timezoneOffset));
  }
  
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Get current date in user's timezone
  const now = new Date(Date.now() - offsetMs);
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${now.toISOString()} (${now.toLocaleDateString()})`);
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  try {
    if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
      // Today
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      periodName = 'today';
    } 
    else if (lowerTimePeriod.includes('yesterday')) {
      // Yesterday
      const yesterday = subDays(now, 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      periodName = 'yesterday';
    } 
    else if (lowerTimePeriod.includes('this week')) {
      // This week (Monday to Sunday)
      startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
      endDate = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
      periodName = 'this week';
    } 
    else if (lowerTimePeriod.includes('last week')) {
      // Last week (previous Monday to Sunday)
      const lastWeek = subWeeks(now, 1);
      startDate = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Start on last Monday
      endDate = endOfWeek(lastWeek, { weekStartsOn: 1 }); // End on last Sunday
      periodName = 'last week';
    } 
    else if (lowerTimePeriod.includes('this month')) {
      // This month
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      periodName = 'this month';
    } 
    else if (lowerTimePeriod.includes('last month')) {
      // Last month
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      periodName = 'last month';
    } 
    else if (lowerTimePeriod.includes('this year')) {
      // This year
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      periodName = 'this year';
    } 
    else if (lowerTimePeriod.includes('last year')) {
      // Last year
      const lastYear = subYears(now, 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      periodName = 'last year';
    } 
    else {
      // Default to last 30 days if no specific period matched
      startDate = startOfDay(subDays(now, 30));
      endDate = endOfDay(now);
      periodName = 'last 30 days';
    }
  } catch (calcError) {
    console.error('Error in date calculation:', calcError);
    // Fallback to a simple date range calculation
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'last 7 days (error fallback)';
  }

  // Add back the timezone offset to convert to UTC for storage
  // Create new Date objects to avoid modifying the originals
  const utcStartDate = new Date(startDate.getTime() + offsetMs);
  const utcEndDate = new Date(endDate.getTime() + offsetMs);
  
  // Validate the date range
  if (utcEndDate < utcStartDate) {
    console.error("Invalid date range calculated: end date is before start date");
    console.error(`Start: ${utcStartDate.toISOString()}, End: ${utcEndDate.toISOString()}`);
    
    // Fallback to last 7 days as a safe default
    const fallbackStart = startOfDay(subDays(now, 7));
    const fallbackEnd = endOfDay(now);
    
    return {
      startDate: new Date(fallbackStart.getTime() + offsetMs).toISOString(),
      endDate: new Date(fallbackEnd.getTime() + offsetMs).toISOString(),
      periodName: 'last 7 days (fallback)'
    };
  }
  
  // Log the calculated dates for debugging
  console.log(`Date range calculated: 
    Start: ${utcStartDate.toISOString()} (${utcStartDate.toLocaleDateString()})
    End: ${utcEndDate.toISOString()} (${utcEndDate.toLocaleDateString()})
    Period: ${periodName}
    Duration in days: ${Math.round((utcEndDate.getTime() - utcStartDate.getTime()) / (1000 * 60 * 60 * 24))}`);
  
  return {
    startDate: utcStartDate.toISOString(),
    endDate: utcEndDate.toISOString(),
    periodName
  };
}
