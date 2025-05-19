import { serve } from '@supabase/functions-js'
import OpenAI from 'openai';

// Initialize Supabase client
const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// We're updating just the main handler function to better handle temporal context
// and to pass the reference date and topic preservation information correctly

// Main function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { message, userId, conversationContext = [], timezoneOffset = 0, appContext = {}, checkForMultiQuestions = false, isFollowUp = false, referenceDate, preserveTopicContext = false } = await req.json();
    
    console.log(`Request received:
      Message: ${message}
      User ID: ${userId}
      Context length: ${conversationContext.length}
      Is follow-up: ${isFollowUp}
      Reference date provided: ${referenceDate ? 'yes' : 'no'}
      Preserve topic context: ${preserveTopicContext}
    `);
    
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check for direct responses that don't need AI processing
    const directResponse = checkForDirectResponse(message);
    if (directResponse) {
      console.log(`Direct response detected: ${directResponse}`);
      return new Response(
        JSON.stringify({ directResponse }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Improved handling of time expressions
    const timeExpression = detectTimeExpression(message);
    console.log(`Time expression detected: ${timeExpression || 'none'}`);
    
    let calculatedDateRange = null;
    let extractedTimeContext = null;
    
    // If we have a time expression, calculate the date range
    if (timeExpression) {
      const parsedReferenceDate = referenceDate ? new Date(referenceDate) : undefined;
      calculatedDateRange = calculateDateRange(timeExpression, timezoneOffset, parsedReferenceDate);
      extractedTimeContext = timeExpression;
      console.log(`Calculated date range for "${timeExpression}": ${JSON.stringify(calculatedDateRange)}`);
    }

    // Create the query analysis request
    const queryAnalysisRequest = {
      role: "system",
      content: generateSystemPrompt(appContext, calculatedDateRange, extractedTimeContext, preserveTopicContext)
    };
    
    // Prepare the conversation context for the query analysis
    const queryAnalysisMessages = prepareQueryAnalysisMessages(queryAnalysisRequest, message, conversationContext);
    
    // Get query plan from OpenAI
    const plan = await getQueryPlanFromOpenAI(queryAnalysisMessages);
    if (!plan) {
      throw new Error('Failed to generate query plan');
    }
    
    // Enhance the plan with our calculated date range if we have one
    if (calculatedDateRange && plan.plan) {
      if (!plan.plan.filters) plan.plan.filters = {};
      if (!plan.plan.filters.date_range) {
        plan.plan.filters.date_range = {
          startDate: calculatedDateRange.startDate,
          endDate: calculatedDateRange.endDate,
          periodName: calculatedDateRange.periodName
        };
      }
    }
    
    // If we need to preserve topic context, make sure it's included
    if (preserveTopicContext && plan.plan && appContext?.userContext?.previousTopicContext) {
      plan.plan.topic_context = appContext.userContext.previousTopicContext;
      console.log(`Preserved topic context in plan: ${appContext.userContext.previousTopicContext}`);
    }
    
    // Add the time context to the plan
    if (extractedTimeContext && plan.plan) {
      plan.plan.previous_time_context = extractedTimeContext;
    }
    
    // Check if this might be a multi-part question
    if (checkForMultiQuestions && shouldSegmentQuery(message)) {
      plan.plan.is_segmented = true;
    }
    
    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in smart-query-planner:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper function to generate system prompt with better temporal and topic context
function generateSystemPrompt(appContext: any, dateRange: any, timeContext: string | null, preserveTopicContext: boolean): string {
  // Get app information from the context
  const appInfo = appContext?.appInfo || {
    name: "Journal Analysis App",
    type: "Voice Journaling App",
    features: ["Journal Analysis", "Emotion Tracking"]
  };
  
  // Get user context
  const userContext = appContext?.userContext || {};
  const previousTimeContext = userContext.previousTimeContext || null;
  const previousTopicContext = userContext.previousTopicContext || null;
  
  let basePrompt = `You are an AI assistant for ${appInfo.name}, a ${appInfo.type} focused on mental health and self-reflection. 
Your task is to analyze user queries about their journal entries and create a structured plan for searching and retrieving relevant information.`;

  // Add information about previous context if available
  if (previousTimeContext || previousTopicContext) {
    basePrompt += `\n\nIMPORTANT CONTEXT FROM PREVIOUS CONVERSATION:`;
    
    if (previousTimeContext) {
      basePrompt += `\n- User's previous question was about time period: "${previousTimeContext}"`;
    }
    
    if (previousTopicContext) {
      basePrompt += `\n- User's previous question was about topic: "${previousTopicContext}"`;
      
      // If we're preserving topic context (meaning this is just a time-based follow-up),
      // emphasize that the topic should be maintained
      if (preserveTopicContext) {
        basePrompt += `\n\nTHIS IS A TIME-BASED FOLLOW-UP QUESTION. The user is asking about a different time period but is still interested in the SAME TOPIC ("${previousTopicContext}").`;
      }
    }
  }
  
  // Add date range information if available from a time expression
  if (dateRange) {
    basePrompt += `\n\nI've detected a time expression "${timeContext}" in the query. 
Time range already calculated: 
- Start date: ${dateRange.startDate}
- End date: ${dateRange.endDate}
- Period name: ${dateRange.periodName}`;
  }

  // Add complete instructions
  basePrompt += `\n\nYour task:
1. Analyze the query to understand what type of information the user is seeking from their journal entries.
2. Create a structured plan for searching and retrieving the relevant information.
3. Return your analysis in a structured JSON format.`;
  
  // Add specific temporal context handling
  basePrompt += `\n\nWhen handling follow-up questions about different time periods:
- If the user is asking about a new time period (e.g. "What about last month?") but their previous question was about a specific topic, MAINTAIN THE SAME TOPIC while changing just the time period.
- Do not switch to a general analysis when the user is simply changing the time frame.`;

  // Add output format instructions
  basePrompt += `\n\nOutput your plan as a JSON object with the following structure:
{
  "plan": {
    "strategy": "vector" | "sql" | "hybrid",
    "filters": {
      "date_range": {
        "startDate": "ISO string or null",
        "endDate": "ISO string or null",
        "periodName": "description of the time period"
      },
      "emotions": ["emotion1", "emotion2"],
      "themes": ["theme1", "theme2"],
      "entities": [{"type": "PERSON", "name": "name"}]
    },
    "match_count": number,
    "needs_data_aggregation": boolean,
    "needs_more_context": boolean,
    "is_segmented": boolean,
    "topic_context": "the main topic of the query",
    "reasoning": "explanation of the plan"
  },
  "queryType": "journal_specific" | "general_analysis" | "emotional_analysis" | "pattern_detection" | "personality_reflection"
}`;

  return basePrompt;
}

/**
 * Prepare conversation context for query analysis
 */
function prepareQueryAnalysisMessages(queryAnalysisRequest: any, message: string, conversationContext: any[]): any[] {
  const userMessage = { role: "user", content: message };
  
  // Add the system prompt
  const messages = [queryAnalysisRequest];
  
  // Add previous conversation context
  for (const contextMessage of conversationContext) {
    messages.push(contextMessage);
  }
  
  // Add the user's message
  messages.push(userMessage);
  
  return messages;
}

/**
 * Get query plan from OpenAI
 */
async function getQueryPlanFromOpenAI(messages: any): Promise<any> {
  try {
    console.log(`Calling OpenAI with messages: ${JSON.stringify(messages).substring(0, 200)}...`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: messages,
      temperature: 0.0,
      // max_tokens: 500,
      response_format: { type: "json_object" }
    });
    
    const response = completion.choices[0].message?.content;
    console.log(`Received from OpenAI: ${response?.substring(0, 200)}...`);
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }
    
    try {
      const plan = JSON.parse(response);
      return plan;
    } catch (error) {
      console.error('Failed to parse JSON response from OpenAI:', error);
      console.log('Raw response from OpenAI:', response);
      return { plan: null, queryType: 'journal_specific' };
    }
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return { plan: null, queryType: 'journal_specific' };
  }
}

/**
 * Check for direct responses that don't need AI processing
 */
function checkForDirectResponse(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return "Hello! How can I help you today?";
  }
  
  if (lowerMessage.includes("thank you") || lowerMessage.includes("thanks")) {
    return "You're welcome!";
  }
  
  return null;
}

/**
 * Should we segment the query?
 */
function shouldSegmentQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check for multiple questions
  if ((lowerMessage.match(/\?/g) || []).length > 1) {
    return true;
  }
  
  // Check for conjunctions
  if (lowerMessage.includes(" and ") || lowerMessage.includes(" also ")) {
    return true;
  }
  
  return false;
}

/**
 * Detect time expressions in the query
 */
function detectTimeExpression(query: string): string | null {
  if (!query) return null;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // First check for specific follow-up patterns 
  if (/^(what|how) about (last|this|previous|past|recent)/i.test(lowerQuery)) {
    const match = lowerQuery.match(/(last|this|previous|past|recent)(\s+\w+)+/i);
    if (match) return match[0];
  }
  
  // Then check for specific time expressions
  const timeExpressions = [
    // Days
    { regex: /\btoday\b/i, value: 'today' },
    { regex: /\byesterday\b/i, value: 'yesterday' },
    { regex: /\bthis day\b/i, value: 'today' },
    
    // Weeks
    { regex: /\blast week\b/i, value: 'last week' },
    { regex: /\bthis week\b/i, value: 'this week' },
    { regex: /\bprevious week\b/i, value: 'last week' },
    { regex: /\bpast week\b/i, value: 'past week' },
    
    // Months
    { regex: /\blast month\b/i, value: 'last month' },
    { regex: /\bthis month\b/i, value: 'this month' },
    { regex: /\bprevious month\b/i, value: 'last month' },
    { regex: /\bpast month\b/i, value: 'past month' },
    
    // Years
    { regex: /\blast year\b/i, value: 'last year' },
    { regex: /\bthis year\b/i, value: 'this year' },
    { regex: /\bprevious year\b/i, value: 'last year' },
    
    // Multiple days
    { regex: /\bpast (\d+) days?\b/i, getValue: (match: any) => `past ${match[1]} days` },
    { regex: /\blast (\d+) days?\b/i, getValue: (match: any) => `last ${match[1]} days` },
    
    // Special cases
    { regex: /\ball time\b/i, value: 'all time' },
    { regex: /\bentire\b/i, value: 'all time' },
    { regex: /\beverything\b/i, value: 'all time' },
  ];
  
  // Check each expression
  for (const expr of timeExpressions) {
    const match = lowerQuery.match(expr.regex);
    if (match) {
      // Return either the fixed value or the calculated value
      return expr.getValue ? expr.getValue(match) : expr.value;
    }
  }
  
  // Special case for standalone time expressions as follow-ups
  if (/^(today|yesterday|this week|last week|this month|last month|this year|last year)(\?|\.|$)/i.test(lowerQuery)) {
    return lowerQuery.match(/^(today|yesterday|this week|last week|this month|last month|this year|last year)/i)![0];
  }
  
  return null;
}

/**
 * Calculate date range based on time expression
 */
function calculateDateRange(timePeriod: string, timezoneOffset: number = 0, referenceDate?: Date): { startDate: string, endDate: string, periodName: string } {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Use provided reference date or get current date in user's timezone
  const now = referenceDate ? new Date(referenceDate) : new Date(Date.now() - offsetMs);
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${now.toISOString()}`);
  console.log(`Reference date provided: ${referenceDate ? 'yes' : 'no'}`);
  
  // If referenceDate is provided, log it for debugging
  if (referenceDate) {
    console.log(`Using reference date for date calculation: ${referenceDate.toISOString()}`);
  }
  
  // Normalize time period for better matching
  const lowerTimePeriod = timePeriod.toLowerCase().trim();
  
  // Enhanced pattern matching with more variations
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate = startOfDay(now);
    endDate = endOfDay(now);
    periodName = 'today';
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate = startOfDay(subDays(now, 1));
    endDate = endOfDay(subDays(now, 1));
    periodName = 'yesterday';
  }
  else if (lowerTimePeriod.match(/past (\d+) days?/)) {
    // Past X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/past (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `past ${days} days`;
  }
  else if (lowerTimePeriod.match(/last (\d+) days?/)) {
    // Last X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/last (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `last ${days} days`;
  }
  else if (lowerTimePeriod.match(/recent (\d+) days?/)) {
    // Recent X days: Start X days ago at midnight, end at today 23:59:59
    const matches = lowerTimePeriod.match(/recent (\d+) days?/);
    const days = parseInt(matches![1], 10) || 7; // Default to 7 if parsing fails
    startDate = startOfDay(subDays(now, days));
    endDate = endOfDay(now);
    periodName = `recent ${days} days`;
  }
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Monday, end at Sunday 23:59:59
    startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(now, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'this week';
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // Last week: Start at previous week Monday, end at previous week Sunday 23:59:59
    const prevWeek = subWeeks(now, 1);
    startDate = startOfWeek(prevWeek, { weekStartsOn: 1 }); // Start on Monday
    endDate = endOfWeek(prevWeek, { weekStartsOn: 1 }); // End on Sunday
    periodName = 'last week';
  }
  else if (lowerTimePeriod.includes('past week') || lowerTimePeriod.includes('previous week')) {
    // Past/previous week: Start at 7 days ago, end at today
    startDate = startOfDay(subDays(now, 7));
    endDate = endOfDay(now);
    periodName = 'past week';
  }
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month 23:59:59
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
    periodName = 'this month';
  } 
  else if (lowerTimePeriod.includes('last month') || lowerTimePeriod === 'previous month') {
    // Last month: Start at 1st of previous month, end at last day of previous month 23:59:59
    const prevMonth = subMonths(now, 1);
    startDate = startOfMonth(prevMonth);
    endDate = endOfMonth(prevMonth);
    periodName = 'last month';
  }
  else if (lowerTimePeriod.includes('past month')) {
    // Past month: Start at 30 days ago, end at today
    startDate = startOfDay(subDays(now, 30));
    endDate = endOfDay(now);
    periodName = 'past month';
  }
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st 23:59:59
    startDate = startOfYear(now);
    endDate = endOfYear(now);
    periodName = 'this year';
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year 23:59:59
    const prevYear = subYears(now, 1);
    startDate = startOfYear(prevYear);
    endDate = endOfYear(prevYear);
    periodName = 'last year';
  } 
  else if (lowerTimePeriod === 'entire' || lowerTimePeriod === 'all' || 
           lowerTimePeriod === 'everything' || lowerTimePeriod === 'overall' ||
           lowerTimePeriod === 'all time' || lowerTimePeriod === 'always' ||
           lowerTimePeriod === 'all my entries' || lowerTimePeriod === 'all entries') {
    // Special case for "entire" - use a very broad date range (5 years back)
    startDate = startOfYear(subYears(now, 5));
    endDate = endOfDay(now);
    periodName = 'all time';
  }
  else if (lowerTimePeriod === 'yes' || lowerTimePeriod === 'sure' || 
           lowerTimePeriod === 'ok' || lowerTimePeriod === 'okay' ||
           lowerTimePeriod === 'yep' || lowerTimePeriod === 'yeah') {
    // Special handling for affirmative responses - use a broad date range
    startDate = startOfYear(subYears(now, 5));
    endDate = endOfDay(now);
    periodName = 'all time'; // Use "all time" for affirmative responses
  }
  else {
    // Default to last 30 days if no specific period matched
    startDate = startOfDay(subDays(now, 30));
    endDate = endOfDay(now);
    periodName = 'last 30 days';
  }

  // Add back the timezone offset to convert to UTC for storage
  // We need to explicitly create new Date objects to avoid modifying the originals
  const utcStartDate = new Date(startDate.getTime() + offsetMs);
  const utcEndDate = new Date(endDate.getTime() + offsetMs);
  
  // Validate the date range
  if (utcEndDate < utcStartDate) {
    console.error("Invalid date range calculated: end date is before start date");
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

// Helper function to get start of day
function startOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// Helper function to get end of day
function endOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

// Helper function to get start of week
function startOfWeek(date: Date, options: { weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + (day == (options.weekStartsOn + 7) ? -6: options.weekStartsOn);
  newDate.setDate(diff);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// Helper function to get end of week
function endOfWeek(date: Date, options: { weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 }): Date {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + (day == (options.weekStartsOn + 7) ? -6: options.weekStartsOn) + 6;
  newDate.setDate(diff);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

// Helper function to get start of month
function startOfMonth(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(1);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// Helper function to get end of month
function endOfMonth(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate());
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

// Helper function to get start of year
function startOfYear(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(1);
  newDate.setMonth(0);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

// Helper function to get end of year
function endOfYear(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(31);
  newDate.setMonth(11);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

// Helper function to subtract days from a date
function subDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() - days);
  return newDate;
}

// Helper function to subtract weeks from a date
function subWeeks(date: Date, weeks: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() - weeks * 7);
  return newDate;
}

// Helper function to subtract months from a date
function subMonths(date: Date, months: number): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() - months);
  return newDate;
}

// Helper function to subtract years from a date
function subYears(date: Date, years: number): Date {
  const newDate = new Date(date);
  newDate.setFullYear(newDate.getFullYear() - years);
  return newDate;
}
