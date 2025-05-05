
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to calculate relative date range based on query and timezone
function calculateDateRange(timeExpression: string, timezoneOffset: number = 0): { startDate: string, endDate: string, periodName: string } | null {
  // Convert timezone offset to milliseconds
  const offsetMs = timezoneOffset * 60 * 1000;
  
  // Get current date in user's timezone
  const now = new Date(Date.now() - offsetMs);
  let startDate = new Date(now);
  let endDate = new Date(now);
  let periodName = timeExpression;
  
  const lowerTimeExpression = timeExpression.toLowerCase();
  
  // Handle different time expressions
  if (lowerTimeExpression.includes('today')) {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'today';
  } 
  else if (lowerTimeExpression.includes('yesterday')) {
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'yesterday';
  } 
  else if (lowerTimeExpression.includes('this week')) {
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(endDate.getDate() + (6 - dayOfWeek));
    endDate.setHours(23, 59, 59, 999);
    periodName = 'this week';
  } 
  else if (lowerTimeExpression.includes('last week')) {
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last week';
  } 
  else if (lowerTimeExpression.includes('this month')) {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    periodName = 'this month';
  } 
  else if (lowerTimeExpression.includes('last month')) {
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    periodName = 'last month';
  } 
  else if (lowerTimeExpression.match(/october\s+2023/i)) {
    startDate = new Date(2023, 9, 1, 0, 0, 0, 0); // October is month 9 (0-based)
    endDate = new Date(2023, 9, 31, 23, 59, 59, 999);
    periodName = 'October 2023';
  }
  else if (lowerTimeExpression.includes('this year')) {
    startDate = new Date(startDate.getFullYear(), 0, 1, 0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodName = 'this year';
  }
  else if (lowerTimeExpression.includes('last year')) {
    startDate = new Date(startDate.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999);
    periodName = 'last year';
  }
  else {
    return null;
  }

  // Add back the timezone offset to convert to UTC for storage
  startDate = new Date(startDate.getTime() + offsetMs);
  endDate = new Date(endDate.getTime() + offsetMs);
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    periodName
  };
}

function detectTimeRange(query: string, timezoneOffset: number = 0): any {
  const timeExpressions = [
    'today', 'yesterday', 
    'this week', 'last week', 
    'this month', 'last month',
    'this year', 'last year',
    'october 2023' // Add support for specific month/year combinations
  ];
  
  const lowerQuery = query.toLowerCase();
  
  for (const expr of timeExpressions) {
    if (lowerQuery.includes(expr)) {
      return calculateDateRange(expr, timezoneOffset);
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
    const { message, userId, conversationContext = [], timezoneOffset = 0 } = await req.json();
    
    // Log the timezone offset from client
    console.log(`User timezone offset: ${timezoneOffset} minutes`);
    
    if (!message || !userId) {
      throw new Error("Message and userId are required");
    }

    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);

    // First check if this is a journal-specific query or not
    const isJournalQuery = await checkIfJournalQuery(message);
    console.log(`Query classified as: ${isJournalQuery}`);
    
    // If it's not a journal query, just return a null plan
    if (isJournalQuery !== 'journal_specific') {
      return new Response(
        JSON.stringify({
          queryType: isJournalQuery,
          plan: null,
          directResponse: isJournalQuery === 'general' 
            ? "I can help answer that, but I won't need to search through your journal entries for this type of question."
            : null
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Manually handle time range detection for queries about emotions in specific time periods
    const lowerMessage = message.toLowerCase();
    const emotionTimeQuery = lowerMessage.match(/top emotions|emotions (?:this|last|in) (?:week|month|year)|emotions (?:today|yesterday)/i);
    
    if (emotionTimeQuery) {
      // This is a query about emotions over time, so extract the time period
      const timeRange = detectTimeRange(lowerMessage, timezoneOffset);
      
      if (timeRange) {
        console.log(`Generated query plan for emotion time query with date range: ${timeRange.periodName}`);
        
        // Build a custom plan for this emotion analysis query
        const plan = {
          is_segmented: false,
          subqueries: [],
          strategy: "hybrid",
          filters: {
            date_range: timeRange,
            emotions: [],
            sentiment: [],
            themes: [],
            entities: []
          },
          match_count: 14,
          needs_data_aggregation: true,
          needs_more_context: false,
          reasoning: `The hybrid strategy is suitable as it allows for filtering entries from the specified ${timeRange.periodName} and aggregating the emotional data to determine the top emotions.`
        };
        
        console.log(`Generated query plan: ${JSON.stringify(plan)}`);
        
        return new Response(
          JSON.stringify({
            queryType: isJournalQuery,
            plan,
            directResponse: null
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }
    
    // For other types of journal queries, use the AI to generate a query plan
    const planResult = await generateQueryPlan(message, conversationContext, timezoneOffset);
    
    return new Response(
      JSON.stringify({
        queryType: isJournalQuery,
        plan: planResult,
        directResponse: null
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error(`Error in query planner: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});

async function checkIfJournalQuery(query: string): Promise<string> {
  if (!query) return 'general';
  
  if (!openaiApiKey) {
    // Simple fallback classification for common patterns when API key is missing
    const lowercaseQuery = query.toLowerCase();
    
    if (lowercaseQuery.includes('journal') || 
        lowercaseQuery.includes('emotion') ||
        lowercaseQuery.includes('feeling') ||
        lowercaseQuery.includes('mood') ||
        lowercaseQuery.includes('entry') ||
        lowercaseQuery.includes('wrote') ||
        lowercaseQuery.includes('theme') ||
        lowercaseQuery.includes('sentiment')) {
      return 'journal_specific';
    }
    
    return 'general';
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are classifying user queries for a journaling app. Determine if this query requires accessing the user\'s journal entries (JOURNAL_SPECIFIC), is a general question about mental health or the app (GENERAL), or is not related to either (OTHER). Respond with only "JOURNAL_SPECIFIC", "GENERAL", or "OTHER".'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1,
        max_tokens: 20
      })
    });
    
    const data = await response.json();
    const classification = data.choices[0].message.content.trim();
    
    if (classification === 'JOURNAL_SPECIFIC') {
      return 'journal_specific';
    } else if (classification === 'GENERAL') {
      return 'general';
    } else {
      return 'other';
    }
  } catch (error) {
    console.error(`Error classifying query: ${error.message}`);
    return 'journal_specific'; // Default to journal-specific on error
  }
}

async function generateQueryPlan(query: string, conversationContext: any[] = [], timezoneOffset: number = 0): Promise<any> {
  if (!openaiApiKey) {
    console.log("No OpenAI API key found. Using basic query plan.");
    // Return a basic query plan with any detected time range
    const timeRange = detectTimeRange(query.toLowerCase(), timezoneOffset);
    return {
      strategy: "vector",
      filters: {
        date_range: timeRange,
        emotions: [],
        themes: [],
        entities: []
      },
      match_count: 10,
      needs_data_aggregation: false,
      needs_more_context: false,
      reasoning: "Basic query plan created without OpenAI."
    };
  }
  
  try {
    const systemPrompt = `
You are an AI query planner for a personal journaling application. Your task is to analyze a user's query about their journal entries
and create a structured query plan.

CONTEXT:
- The application stores journal entries with emotions, themes, and entities.
- For each entry, we have text content, time created, emotion data, and thematic analysis.

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "strategy": "vector" | "sql" | "hybrid",
  "filters": {
    "date_range": { "startDate": "ISO string or null", "endDate": "ISO string or null", "periodName": "string" },
    "emotions": ["emotion1", "emotion2"],
    "sentiment": ["positive", "negative", "neutral"],
    "themes": ["theme1", "theme2"],
    "entities": [{"type": "person", "name": "John"}]
  },
  "match_count": number,
  "needs_data_aggregation": boolean,
  "needs_more_context": boolean,
  "is_segmented": boolean,
  "subqueries": ["subquery1", "subquery2"],
  "reasoning": "string explaining your choices"
}

STRATEGY TYPES:
- "vector": Use semantic search for finding relevant entries (best for conceptual/thematic questions)
- "sql": Use direct database queries (best for specific attributes, time ranges, counting)
- "hybrid": Combine both approaches (good for complex queries with both semantic and structured elements)

The user's timezone offset is ${timezoneOffset} minutes from UTC.
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.1
      })
    });
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI API");
    }
    
    let planText = data.choices[0].message.content;
    let plan;
    
    try {
      // Extract JSON if the response includes additional text
      const jsonMatch = planText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        planText = jsonMatch[0];
      }
      
      plan = JSON.parse(planText);
      
      // Apply manual time range detection if not present in the AI's plan
      if (!plan.filters?.date_range) {
        const timeRange = detectTimeRange(query.toLowerCase(), timezoneOffset);
        if (timeRange) {
          if (!plan.filters) plan.filters = {};
          plan.filters.date_range = timeRange;
        }
      }
      
      // Ensure other required fields are present
      if (!plan.strategy) plan.strategy = "vector";
      if (!plan.match_count) plan.match_count = 10;
      if (plan.needs_data_aggregation === undefined) plan.needs_data_aggregation = false;
      if (plan.needs_more_context === undefined) plan.needs_more_context = false;
      
      // Check for time-based emotion queries and optimize
      if (query.toLowerCase().match(/top emotions|emotions (?:this|last|in) (?:week|month|year)|emotions (?:today|yesterday)/i)) {
        plan.needs_data_aggregation = true;
        plan.strategy = "hybrid";
        plan.match_count = 14; // Increase match count for aggregation
      }
      
      return plan;
    } catch (parseError) {
      console.error(`Error parsing plan: ${parseError.message}`);
      console.log(`Raw plan text: ${planText}`);
      
      // Return a basic fallback plan
      return {
        strategy: "vector",
        filters: {
          date_range: detectTimeRange(query.toLowerCase(), timezoneOffset),
          emotions: [],
          themes: [],
          entities: []
        },
        match_count: 10,
        needs_data_aggregation: false,
        needs_more_context: false,
        reasoning: "Fallback plan due to parsing error."
      };
    }
  } catch (error) {
    console.error(`Error generating query plan: ${error.message}`);
    return null;
  }
}
