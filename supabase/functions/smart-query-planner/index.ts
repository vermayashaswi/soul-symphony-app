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

// Function to calculate date ranges based on time expressions using provided timestamp
function calculateDateRange(timePeriod: string, clientTimestamp: string): { startDate: string, endDate: string, periodName: string } {
  console.log(`Calculating date range for "${timePeriod}" based on client timestamp: ${clientTimestamp}`);
  
  // Parse the client timestamp
  const now = new Date(clientTimestamp);
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  if (!isValidDate(now)) {
    console.error(`Invalid client timestamp: ${clientTimestamp}, using current time instead`);
    // Fallback to current time if client timestamp is invalid
    const fallbackNow = new Date();
    return calculateDateRange(timePeriod, fallbackNow.toISOString());
  }
  
  console.log(`Reference time for calculations: ${now.toISOString()} (${now.toLocaleDateString()})`);
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  // Helper functions for date calculations
  const startOfDay = (date: Date): Date => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  
  const endOfDay = (date: Date): Date => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  };
  
  const startOfWeek = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  
  const endOfWeek = (date: Date): Date => {
    const result = startOfWeek(date);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  };
  
  const startOfMonth = (date: Date): Date => {
    const result = new Date(date);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  
  const endOfMonth = (date: Date): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
  };
  
  const startOfYear = (date: Date): Date => {
    const result = new Date(date);
    result.setMonth(0, 1);
    result.setHours(0, 0, 0, 0);
    return result;
  };
  
  const endOfYear = (date: Date): Date => {
    const result = new Date(date);
    result.setMonth(11, 31);
    result.setHours(23, 59, 59, 999);
    return result;
  };
  
  const subtractDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  };
  
  const subtractMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
  };
  
  const subtractYears = (date: Date, years: number): Date => {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() - years);
    return result;
  };
  
  try {
    if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
      // Today
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      periodName = 'today';
    } 
    else if (lowerTimePeriod.includes('yesterday')) {
      // Yesterday
      const yesterday = subtractDays(now, 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      periodName = 'yesterday';
    } 
    else if (lowerTimePeriod.includes('this week')) {
      // This week
      startDate = startOfWeek(now);
      endDate = endOfWeek(now);
      periodName = 'this week';
    } 
    else if (lowerTimePeriod.includes('last week')) {
      // Last week
      const lastWeek = subtractDays(now, 7);
      startDate = startOfWeek(lastWeek);
      endDate = endOfWeek(lastWeek);
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
      const lastMonth = subtractMonths(now, 1);
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
      const lastYear = subtractYears(now, 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      periodName = 'last year';
    } 
    else if (lowerTimePeriod.includes('last 7 days') || lowerTimePeriod.includes('past week')) {
      // Last 7 days
      startDate = startOfDay(subtractDays(now, 7));
      endDate = endOfDay(now);
      periodName = 'last 7 days';
    }
    else if (lowerTimePeriod.includes('last 30 days') || lowerTimePeriod.includes('past month')) {
      // Last 30 days
      startDate = startOfDay(subtractDays(now, 30));
      endDate = endOfDay(now);
      periodName = 'last 30 days';
    }
    else if (lowerTimePeriod.includes('last 90 days') || lowerTimePeriod.includes('past 3 months')) {
      // Last 90 days
      startDate = startOfDay(subtractDays(now, 90));
      endDate = endOfDay(now);
      periodName = 'last 90 days';
    }
    else if (lowerTimePeriod.includes('last 365 days') || lowerTimePeriod.includes('past year')) {
      // Last 365 days
      startDate = startOfDay(subtractDays(now, 365));
      endDate = endOfDay(now);
      periodName = 'last 365 days';
    }
    else {
      // Default to last 30 days if no specific period matched
      startDate = startOfDay(subtractDays(now, 30));
      endDate = endOfDay(now);
      periodName = 'last 30 days';
    }
  } catch (calcError) {
    console.error('Error in date calculation:', calcError);
    // Fallback to a simple date range calculation
    startDate = startOfDay(subtractDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'last 7 days (error fallback)';
  }

  // Format dates as ISO strings
  const isoStartDate = startDate.toISOString();
  const isoEndDate = endDate.toISOString();
  
  // Log the calculated dates for debugging
  console.log(`Date range calculated: 
    Start: ${isoStartDate} (${startDate.toLocaleDateString()})
    End: ${isoEndDate} (${endDate.toLocaleDateString()})
    Period: ${periodName}
    Duration in days: ${Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}`);
  
  return {
    startDate: isoStartDate,
    endDate: isoEndDate,
    periodName
  };
}

// Helper function to check if a date is valid
function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

// Function to detect time expressions in a query and calculate a date range
function detectTimeExpressionAndCalculateRange(query: string, clientTimestamp: string): { startDate: string, endDate: string, periodName: string } | null {
  // List of common time expressions to detect
  const timeExpressions = [
    'today', 'yesterday', 
    'this week', 'last week', 
    'this month', 'last month', 
    'this year', 'last year',
    'past week', 'past month', 'past year',
    'previous week', 'previous month', 'previous year',
    'recent', 'lately', 'last 7 days', 'last 30 days',
    'last 90 days', 'last 365 days', 'past 3 months'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for date expressions
  for (const expression of timeExpressions) {
    if (lowerQuery.includes(expression)) {
      console.log(`Detected time expression "${expression}" in query: "${query}"`);
      return calculateDateRange(expression, clientTimestamp);
    }
  }
  
  // Check for "last X days/weeks/months/years" pattern
  const lastNPattern = /last\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/i;
  const lastNMatch = lowerQuery.match(lastNPattern);
  
  if (lastNMatch) {
    const amount = parseInt(lastNMatch[1], 10);
    const unit = lastNMatch[2].toLowerCase();
    console.log(`Detected "last ${amount} ${unit}" in query`);
    
    // Parse the client timestamp
    const now = new Date(clientTimestamp);
    if (!isValidDate(now)) {
      console.error(`Invalid client timestamp: ${clientTimestamp}, using current time instead`);
      return null;
    }
    
    let startDate: Date;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    if (unit.startsWith('day')) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - amount);
      startDate.setHours(0, 0, 0, 0);
    } else if (unit.startsWith('week')) {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - (amount * 7));
      startDate.setHours(0, 0, 0, 0);
    } else if (unit.startsWith('month')) {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - amount);
      startDate.setHours(0, 0, 0, 0);
    } else if (unit.startsWith('year')) {
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - amount);
      startDate.setHours(0, 0, 0, 0);
    } else {
      return null;
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      periodName: `last ${amount} ${unit}`
    };
  }
  
  // Handle specific date
  const specificDatePattern = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}|\d{2}))?/;
  const dateMatch = lowerQuery.match(specificDatePattern);
  
  if (dateMatch) {
    try {
      // Try to parse the date, considering ambiguities in dd/mm vs mm/dd formats
      // Default to current year if not specified
      const now = new Date(clientTimestamp);
      if (!isValidDate(now)) {
        console.error(`Invalid client timestamp: ${clientTimestamp}, using current time instead`);
        return null;
      }
      
      let day = parseInt(dateMatch[1], 10);
      let month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-indexed
      let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
      
      // Handle 2-digit years
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }
      
      // Try to create a valid date object
      const specificDate = new Date(year, month, day);
      
      // Check if the date is valid
      if (isNaN(specificDate.getTime())) {
        console.error('Invalid date detected:', dateMatch[0]);
        return null;
      }
      
      // Set to start and end of the specific date
      const startOfSpecificDate = new Date(specificDate);
      startOfSpecificDate.setHours(0, 0, 0, 0);
      
      const endOfSpecificDate = new Date(specificDate);
      endOfSpecificDate.setHours(23, 59, 59, 999);
      
      return {
        startDate: startOfSpecificDate.toISOString(),
        endDate: endOfSpecificDate.toISOString(),
        periodName: `on ${specificDate.toLocaleDateString()}`
      };
    } catch (error) {
      console.error('Error parsing specific date:', error);
      return null;
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      userId, 
      conversationContext = [], 
      clientTimestamp = null  // Accept client timestamp
    } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);
    
    // Log the client timestamp for reference
    if (clientTimestamp) {
      console.log(`Client timestamp: ${clientTimestamp}`);
    } else {
      console.log("No client timestamp provided, will use server time");
    }
    
    // If clientTimestamp isn't provided, use current server time
    const effectiveTimestamp = clientTimestamp || new Date().toISOString();
    
    // Process time-based queries using the client timestamp
    const detectedDateRange = detectTimeExpressionAndCalculateRange(message, effectiveTimestamp);
    console.log("Detected date range:", detectedDateRange);
    
    // Check message types and plan the query
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
        const tempPlan = JSON.parse(jsonStr);
        
        // Add the detected date range to the plan if available
        if (detectedDateRange && !tempPlan.filters?.date_range) {
          console.log("Adding detected time range to plan");
          tempPlan.filters = tempPlan.filters || {};
          tempPlan.filters.date_range = detectedDateRange;
        }
        
        plan = tempPlan;
        
        // Force data aggregation for rating/analysis requests
        if (isRatingOrAnalysisRequest && !plan.needs_data_aggregation) {
          console.log("Forcing data aggregation for rating/analysis request");
          plan.needs_data_aggregation = true;
          plan.match_count = Math.max(plan.match_count || 15, 30); // Ensure we get enough data
        }
      } catch (e) {
        console.error('Error parsing plan JSON:', e);
        console.error('Raw plan text:', planText);
        
        // Create a fallback plan
        plan = {
          strategy: 'vector',
          filters: {},
          match_count: isRatingOrAnalysisRequest ? 30 : 15,
          needs_data_aggregation: isRatingOrAnalysisRequest || message.includes('how many') || message.includes('count') || message.includes('statistics'),
          needs_more_context: false
        };
        
        // Add detected date range if available
        if (detectedDateRange) {
          plan.filters.date_range = detectedDateRange;
        }
      }
    }

    // Add the detected date range to the plan if available
    if (detectedDateRange && plan && (!plan.filters?.date_range)) {
      console.log("Adding detected time range to plan");
      plan.filters = plan.filters || {};
      plan.filters.date_range = detectedDateRange;
    }
    
    // Return the plan
    return new Response(
      JSON.stringify({ 
        plan, 
        queryType: isRatingOrAnalysisRequest ? 'journal_specific' : queryType,
        directResponse,
        clientTimestamp: effectiveTimestamp // Echo back the timestamp for reference
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
