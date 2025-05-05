
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import OpenAI from "https://deno.land/x/openai@v4.27.0/mod.ts";
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openai = new OpenAI(openAIApiKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Utility function to extract text content from HTML
function extractTextFromHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc ? doc.body.textContent : '';
}

// Utility function to count journal entries for a user
async function countJournalEntries(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('Journal Entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error("Error counting journal entries:", error);
    return 0;
  }

  return count || 0;
}

// Utility function to get date range based on time range
function getDateRangeForTimeframe(timeframe: string): { startDate: string, endDate: string } {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  // Set end date to current time
  endDate = now;

  // Calculate start date based on timeframe
  if (timeframe === 'last month' || timeframe === 'previous month') {
    // First day of previous month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Last day of previous month
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (timeframe === 'this month' || timeframe === 'current month') {
    // First day of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    // Current day
    endDate = now;
  } else if (timeframe === 'last week' || timeframe === 'previous week') {
    // Start of previous week (Monday)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    // End of previous week (Sunday)
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (timeframe === 'this week' || timeframe === 'current week') {
    // Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    // Current day
    endDate = now;
  } else if (timeframe === 'yesterday') {
    // Yesterday
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (timeframe === 'today') {
    // Today
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
  } else if (timeframe === 'last year' || timeframe === 'previous year') {
    // Last year
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (timeframe === 'this year' || timeframe === 'current year') {
    // This year
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else {
    // Default to last 30 days if timeframe not recognized
    startDate = new Date();
    startDate.setDate(now.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

// Utility function to analyze the query using OpenAI
async function generateQueryAnalysis(message: string, entryCount: number) {
  try {
    const prompt = `You are an expert query analyzer for a personal journal application. Your task is to analyze user queries and create a structured plan for retrieving relevant information from a database.
      
      Here's how you should respond:
      - goal: A concise statement of what the user is trying to find out.
      - context: Important background information or entities mentioned in the query.
      - intent: The specific action or information the user is seeking (e.g., "find entries about a specific emotion", "analyze patterns", etc.).
      - query_type: One of: "time-based", "theme-based", "emotion-based", "reflection", "insight-seeking", "specific-memory", "pattern-recognition".
      - time_period: Any timeframes mentioned or implied in the query.
      - themes_to_search: An array of themes or topics mentioned that should be searched.
      - emotions_to_search: An array of emotions mentioned that should be searched.
      - requires_aggregation: Whether the query requires gathering and analyzing multiple entries rather than just retrieving them.
      - search_strategy: Recommended approach: "vector", "keyword", "hybrid", "emotion", "time" - based on the nature of the query.
      - query_plan: A step-by-step plan for how to retrieve and process the information.
      
      Format your response as JSON.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `User query: "${message}"\nNumber of journal entries: ${entryCount}` }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating query analysis:", error);
    return JSON.stringify({
      error: "Failed to analyze query",
      search_strategy: "vector" // Default fallback
    });
  }
}

// Step 1: Query Classification with GPT
async function classifyQuery(query: string, conversationContext: any[] = []) {
  try {
    const prompt = `You are the assistant engine inside the SOuLO voice journaling app. A user has asked the following query:
    
    "${query}"
    
    You also have access to the user's journal database schema and the conversation history so far. Based on this, classify the query into one of the following:
    - "journal_specific": The query relates to journal entries, experiences, or emotions the user has recorded.
    - "mental_health_general": The query is about mental wellness, coping strategies, self-care, or emotional regulation but not tied to journal entries.
    - "general_irrelevant": The query is not related to journaling, mental health, or spirituality.
    
    Respond ONLY with the label: journal_specific / mental_health_general / general_irrelevant`;

    let messages = [{ role: "system", content: prompt }];
    
    // Add conversation context if available
    if (conversationContext && conversationContext.length > 0) {
      // Add a limited amount of previous messages for context
      const limitedContext = conversationContext.slice(-5); // Last 5 messages
      limitedContext.forEach(msg => {
        messages.push({ 
          role: msg.sender === 'user' ? 'user' : 'assistant', 
          content: msg.content 
        });
      });
    }
    
    messages.push({ role: "user", content: query });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.1,
      max_tokens: 50
    });

    const classification = response.choices[0].message.content.trim().toLowerCase();
    console.log(`Query classified as: ${classification}`);
    
    // Normalize the response to one of our expected values
    if (classification.includes('journal_specific')) {
      return 'journal_specific';
    } else if (classification.includes('mental_health_general')) {
      return 'mental_health_general';
    } else {
      return 'general_irrelevant';
    }
  } catch (error) {
    console.error("Error classifying query:", error);
    // Default to journal_specific as a safe fallback
    return 'journal_specific';
  }
}

// Step 2: Query Planning with GPT
async function createQueryPlan(query: string, userId: string, conversationContext: any[] = []) {
  try {
    const entryCount = await countJournalEntries(userId);
    
    // Get journal schema
    const { data: columnData, error: columnError } = await supabase.rpc(
      'check_table_columns',
      { table_name: 'Journal Entries' }
    );
    
    if (columnError) {
      console.error("Error getting table schema:", columnError);
      throw columnError;
    }
    
    // Format table schema
    const schema = columnData.map(col => `${col.column_name} (${col.data_type})`).join('\n');
    
    const prompt = `You are the query planning module for SOuLO's journal assistant. Your task is to analyze the user's query and design a step-by-step plan to retrieve relevant information from the user's journal.

    Here is the user's query:
    "${query}"
    
    Here is the full journal schema:
    ${schema}
    
    The user has ${entryCount} journal entries.
    
    Your output should be a JSON object with:
    - "is_segmented": true/false (whether query needs to be broken down)
    - "subqueries": [array of sub-questions if segmented]
    - "strategy": "vector", "sql", "hybrid", "emotion", or "time"
    - "filters": { 
        "date_range": { "startDate": ISO date or null, "endDate": ISO date or null, "periodName": string description },
        "emotions": [array of emotions to filter by],
        "themes": [array of themes to filter by]
      }
    - "match_count": number of matches to return (10-30 based on query complexity)
    - "needs_data_aggregation": true/false (whether results need to be analyzed together)
    - "needs_more_context": true/false (whether more entries than usual should be fetched)
    - "reasoning": why this strategy works best
    
    Include only what's applicable to this specific query.`;

    let messages = [{ role: "system", content: prompt }];
    
    // Add conversation context if available
    if (conversationContext && conversationContext.length > 0) {
      // Summarize conversation context
      const contextSummary = `Previous conversation context (${conversationContext.length} messages):\n` +
        conversationContext.slice(-5).map(msg => 
          `${msg.sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
        ).join('\n');
      
      messages.push({ role: "user", content: contextSummary });
    }
    
    messages.push({ role: "user", content: query });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const planText = response.choices[0].message.content || "{}";
    console.log("Generated query plan:", planText);
    
    // Try to parse the response as JSON
    try {
      const plan = JSON.parse(planText);
      return plan;
    } catch (parseError) {
      console.error("Error parsing query plan:", parseError);
      return {
        strategy: "vector",
        match_count: 10,
        is_segmented: false,
        needs_data_aggregation: false,
        needs_more_context: false,
        filters: {}
      };
    }
  } catch (error) {
    console.error("Error creating query plan:", error);
    return {
      strategy: "vector",
      match_count: 10,
      is_segmented: false,
      needs_data_aggregation: false,
      needs_more_context: false,
      filters: {}
    };
  }
}

// Step 3: Response Synthesis with GPT (will be done after retrieval)
// This function is implemented in chat-with-rag after entries are retrieved

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, conversationContext } = await req.json();
    
    if (!message) {
      throw new Error("Message is required");
    }
    
    if (!userId) {
      throw new Error("User ID is required");
    }
    
    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);
    
    // Step 1: Classify the query
    const queryType = await classifyQuery(message, conversationContext);
    console.log(`Query classified as: ${queryType}`);
    
    // For non-journal-specific queries, we'll return early
    if (queryType !== 'journal_specific') {
      return new Response(
        JSON.stringify({
          queryType,
          plan: null,
          directResponse: queryType === 'general_irrelevant' ? 
            "I'm designed to help with your journal entries and mental wellbeing. I can't assist with unrelated topics, but I'm here if you'd like to discuss your journaling or well-being." : null
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Step 2: Create a query plan for journal-specific queries
    const queryPlan = await createQueryPlan(message, userId, conversationContext);
    
    // Return the plan
    return new Response(
      JSON.stringify({
        queryType,
        plan: queryPlan,
        directResponse: null
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in smart query planner:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        queryType: 'journal_specific', // Default to this for error cases
        plan: {
          strategy: "vector",
          match_count: 10,
          is_segmented: false,
          needs_data_aggregation: false,
          needs_more_context: false,
          filters: {}
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
