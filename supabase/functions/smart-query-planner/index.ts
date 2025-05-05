
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
    const { 
      message, 
      userId, 
      conversationContext = [], 
      clientDetectedTimeRange = null,  // Accept client-detected time range
      clientTime = null                // Accept client's current time
    } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);
    if (clientTime) {
      console.log(`Client-side time: ${clientTime}`);
    }
    if (clientDetectedTimeRange) {
      console.log(`Client-detected time range: ${JSON.stringify(clientDetectedTimeRange)}`);
    }
    
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

    // Process time-based queries - use client-detected time range if available
    let hasTimeFilter = false;
    let timeRangeMentioned = null;

    // If client has already detected a time range, use it
    if (clientDetectedTimeRange) {
      hasTimeFilter = true;
      timeRangeMentioned = clientDetectedTimeRange.periodName;
      console.log(`Using client-detected time range: ${timeRangeMentioned}`);
    } else {
      // Enhanced time detection as backup - look for time expressions in the query
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
        
        // Handle special case for time-based queries - use client date range if available
        const tempPlan = JSON.parse(jsonStr);
        
        if (clientDetectedTimeRange && !tempPlan.filters?.date_range) {
          // Add client-detected time range to the plan
          console.log("Adding client-detected time range to plan");
          tempPlan.filters = tempPlan.filters || {};
          tempPlan.filters.date_range = clientDetectedTimeRange;
        } else if (timeRangeMentioned && !tempPlan.filters?.date_range && !clientDetectedTimeRange) {
          // If GPT did not provide a date range but we detected a time keyword, note this for the client to handle
          console.log("Time keyword detected but no date range provided in plan");
          tempPlan.filters = tempPlan.filters || {};
          tempPlan.filters.detected_time_keyword = timeRangeMentioned;
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
        
        // Add client-detected time range if available
        if (clientDetectedTimeRange) {
          plan.filters.date_range = clientDetectedTimeRange;
        } else if (hasTimeFilter) {
          plan.filters.detected_time_keyword = timeRangeMentioned;
        }
      }
    }

    // Return the plan
    return new Response(
      JSON.stringify({ 
        plan, 
        queryType: isRatingOrAnalysisRequest ? 'journal_specific' : queryType,
        directResponse,
        clientTime: clientTime // Echo back the client time for reference
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
