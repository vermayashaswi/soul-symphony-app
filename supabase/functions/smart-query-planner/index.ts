
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
    const { message, userId, conversationContext = [], timezoneOffset, appContext = {} } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);
    console.log(`User timezone offset: ${timezoneOffset} minutes`);
    console.log(`Received ${conversationContext.length} conversation context messages`);
    console.log(`App context provided: ${JSON.stringify(appContext)}`);
    
    // Log conversation context for debugging
    if (conversationContext.length > 0) {
      console.log("Conversation context summary:");
      conversationContext.forEach((msg, idx) => {
        console.log(`[${idx}] ${msg.role || msg.sender}: ${msg.content.substring(0, 30)}...`);
      });
    }
    
    // Get the user's local time based on timezone offset
    const userLocalTime = new Date(Date.now() - (timezoneOffset || 0) * 60 * 1000);
    const formattedLocalTime = userLocalTime.toISOString();
    
    console.log(`User's local time: ${formattedLocalTime}`);
    
    // Format conversation context for the API request - use ALL conversation history
    const formattedContext = conversationContext.map(msg => ({
      role: msg.role || (msg.sender === 'user' ? 'user' : 'assistant'),
      content: msg.content,
      isClarity: msg.isClarity || false  // Track if this was part of a clarification flow
    }));
    
    // Enhanced detection of responses to clarification questions with more patterns
    let isRespondingToClarification = checkIfResponseToClarification(message, formattedContext);
    
    // Add better contextual understanding by checking for topic continuation
    const isTopicContinuation = checkIfTopicContinuation(message, formattedContext);
    
    // Check for direct time period specification
    const hasDirectTimePeriod = checkForDirectTimePeriod(message);
    
    console.log(`Is responding to clarification: ${isRespondingToClarification}`);
    console.log(`Is topic continuation: ${isTopicContinuation}`);
    console.log(`Has direct time period: ${hasDirectTimePeriod ? hasDirectTimePeriod : 'none'}`);
    
    // Enhanced context-aware query analysis
    // This analyzes if the query is ambiguous while considering the COMPLETE conversation context
    const ambiguityAnalysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an AI context analyst for a journaling application called SOULo, a Voice Journaling App focused on mental health assistance. Your task is to analyze the user's current query and determine if it requires clarification based on the conversation context.

Analyze the user's query for the following types of ambiguity:

1. TIME AMBIGUITY: Does the query refer to a specific time period that's not clearly defined? (e.g., "How was I feeling?", "What are my mood patterns?")

2. ENTITY REFERENCE AMBIGUITY: Does the query contain pronouns or references to entities mentioned in previous messages? (e.g., "Tell me more about that", "How does it affect me?")

3. INTENT AMBIGUITY: Is the user's intention unclear from the query alone? (e.g., "Analyze my journal", "What do you see?")

4. SCOPE AMBIGUITY: Is it unclear whether the user wants analysis of recent entries or their entire journal history? (e.g., "What are my top emotions?", "How would you describe my personality?")

CRITICAL: You must carefully examine the FULL conversation history to determine if clarification is actually needed:
- If the conversation already contains enough context to understand the current query, DO NOT request clarification
- If the user is directly responding to a previous clarification request, DO NOT mark as needing further clarification
- If the user says something like "entire journal", "all entries", "everything", "all", "entire", "yes", "overall", assume they want comprehensive historical data
- If a query is a follow-up to a previous question/answer, interpret it in that context
- If the user asks for a rating or score (like "rate me out of 100"), DO NOT ask for clarification if the topic is clear from conversation history
- Pay special attention to pronouns like "this", "it", "that" and determine their referents from context
- Short responses following a specific question should be interpreted in context of that question
- If the most recent assistant message asked about time period or scope, and the user responds with a short answer, assume they provided their preference

Respond with a JSON object like this:
{
  "needsClarification": boolean,
  "ambiguityType": "TIME"|"ENTITY_REFERENCE"|"INTENT"|"SCOPE"|"NONE",
  "reasoning": "Brief explanation of why clarification is needed or not",
  "suggestedClarificationQuestions": ["Question 1", "Question 2"]  // If clarification is needed
}

If no clarification is needed, set needsClarification to false and ambiguityType to "NONE".`
          },
          ...formattedContext, // Include ALL conversation context
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (!ambiguityAnalysisResponse.ok) {
      console.error('Failed to analyze ambiguity:', await ambiguityAnalysisResponse.text());
      throw new Error('Failed to analyze query ambiguity');
    }

    const ambiguityAnalysis = await ambiguityAnalysisResponse.json();
    console.log("Ambiguity analysis completed");
    
    let ambiguityResult;
    try {
      // Extract the JSON from the response
      const analysisContent = ambiguityAnalysis.choices[0].message.content.trim();
      ambiguityResult = JSON.parse(analysisContent);
      console.log("Parsed ambiguity analysis:", ambiguityResult);
    } catch (error) {
      console.error("Error parsing ambiguity analysis:", error);
      console.log("Raw analysis content:", ambiguityAnalysis.choices[0].message.content);
      // Default to no ambiguity if parsing fails
      ambiguityResult = { needsClarification: false, ambiguityType: "NONE", reasoning: "Failed to parse analysis" };
    }
    
    // Override ambiguity check if we detect a direct response to a clarification
    // or a direct time period specification
    if (isRespondingToClarification || isTopicContinuation || hasDirectTimePeriod) {
      console.log("Overriding ambiguity check due to detected response to clarification, topic continuation, or direct time period");
      ambiguityResult.needsClarification = false;
      ambiguityResult.ambiguityType = "NONE";
      ambiguityResult.reasoning = "User is responding to a previous clarification, continuing a topic with clear context, or specifying a direct time period";
    }
    
    // Improved message type classification that considers conversation context
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
            content: `You are a classification tool for SOULo, a Voice Journaling App focused on mental health. You determine if a user's query is a general question about mental health (respond with "mental_health_general") OR if it's a question seeking insights from the user's journal entries (respond with "journal_specific"). 

Specifically, if the user is asking for ANY of the following, classify as "journal_specific":
- Personal ratings, scores, or evaluations based on their journal entries
- Analysis of their traits, behaviors, or patterns
- Reviews or assessments of their personal characteristics
- Any query asking to "rate me", "analyze me", "evaluate me", or similar
- Questions seeking quantitative or qualitative assessment of the user
- Any request for statistics or metrics about their journaling data
- Analysis of specific emotions or sentiment patterns in their entries
- Any question that is clearly a follow-up to a previous journal-specific query

Consider the FULL conversation context. If the user is clearly referring to their journal data, classify as "journal_specific".
If the user is continuing a previous topic that was journal-specific, maintain that classification.
If the user mentions ratings, scores, or analysis of any personal characteristic, classify as "journal_specific".
Short responses like "yes", "all", "entire", "overall", "everything" following a question about journal data should be classified as "journal_specific".

Respond with ONLY "mental_health_general" or "journal_specific".`
          },
          ...formattedContext, // Include ALL context, not just recent messages
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
    let timeRangeMentioned = hasDirectTimePeriod || null;

    // Enhanced time detection - look for time expressions in the query if not already detected
    if (!timeRangeMentioned) {
      const timeKeywords = [
        'today', 'yesterday', 'this week', 'last week', 
        'this month', 'last month', 'this year', 'last year',
        'recent', 'latest', 'current', 'past', 'all', 'entire', 'everything'
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
    } else {
      // We already detected a direct time period
      hasTimeFilter = true;
    }
    
    // Check for replies to time-based questions in context
    if (!hasTimeFilter && formattedContext.length > 0) {
      // Look for the last assistant message that asked about time
      const lastTimeQuestion = [...formattedContext].reverse().find(msg => 
        msg.role === 'assistant' && 
        (msg.content.includes('time period') || 
         msg.content.includes('what period') || 
         msg.content.includes('which time') ||
         msg.content.includes('recent entries') ||
         msg.content.includes('entire journal'))
      );
      
      // If user message is short and follows a time question, it might be specifying a time period
      if (lastTimeQuestion && message.split(' ').length <= 5) {
        // Check for common responses like "yes", "all", "entire", "overall"
        const shortResponses = ['yes', 'sure', 'ok', 'okay', 'all', 'entire', 'everything', 'overall'];
        const lowerMessage = message.toLowerCase();
        
        if (shortResponses.some(resp => lowerMessage.includes(resp))) {
          console.log(`Detected short response to time question: ${message}`);
          
          if (lastTimeQuestion.content.includes('entire journal') || 
              lastTimeQuestion.content.includes('all entries')) {
            timeRangeMentioned = 'all';
            hasTimeFilter = true;
          } else {
            timeRangeMentioned = 'recent';
            hasTimeFilter = true;
          }
        }
        
        // Check for standard time keywords as well
        for (const keyword of ['today', 'yesterday', 'this week', 'last week', 
                               'this month', 'last month', 'this year', 'last year']) {
          if (lowerMessage.includes(keyword)) {
            console.log(`Detected time keyword in response to time question: ${keyword}`);
            timeRangeMentioned = keyword;
            hasTimeFilter = true;
            break;
          }
        }
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
    
    // Generate dynamic clarification questions based on ambiguity type
    let clarificationQuestions = null;
    
    if (ambiguityResult.needsClarification) {
      console.log(`Query needs clarification, ambiguity type: ${ambiguityResult.ambiguityType}`);
      
      // Enhanced clarification - use a more contextual approach to generate questions
      const clarificationContext = [
        ...formattedContext,
        { role: 'user', content: message },
        { 
          role: 'assistant', 
          content: `Based on your query, I need to clarify something before I can provide a helpful answer. The ambiguity is related to: ${ambiguityResult.ambiguityType.toLowerCase()}. ${ambiguityResult.reasoning}`
        }
      ];
      
      // Generate personalized clarification questions based on the specific ambiguity
      const clarificationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an AI assistant for SOULo, a Voice Journaling App helping users analyze their journal entries. 
              
The user has asked a question that needs clarification. Based on the conversation history and ambiguity type, generate TWO clear, concise clarification options that the user can choose from.

Make these options VERY brief (5 words or less if possible) and highly specific to the ambiguity identified.

Return your response as a JSON array with exactly two objects: 
[
  { "text": "First option text", "action": "expand_search", "parameters": {"useHistoricalData": true} },
  { "text": "Second option text", "action": "default_search", "parameters": {"useHistoricalData": false} }
]

Ensure each option has:
1. "text" - The option text (keep it under 5 words)
2. "action" - Either "expand_search" or "default_search"
3. "parameters" - Include appropriate parameters based on the ambiguity`
            },
            ...clarificationContext
          ],
          temperature: 0.3,
          max_tokens: 250
        }),
      });
      
      if (!clarificationResponse.ok) {
        console.error('Failed to generate clarification questions:', await clarificationResponse.text());
        // Fallback to default questions if generation fails
        clarificationQuestions = getDefaultClarificationQuestions(ambiguityResult.ambiguityType);
      } else {
        try {
          const clarificationData = await clarificationResponse.json();
          const questionsContent = clarificationData.choices[0].message.content;
          clarificationQuestions = JSON.parse(questionsContent);
          console.log("Generated dynamic clarification questions:", clarificationQuestions);
        } catch (error) {
          console.error("Error parsing clarification questions:", error);
          clarificationQuestions = getDefaultClarificationQuestions(ambiguityResult.ambiguityType);
        }
      }
    }
    
    // Build the search plan for journal-specific queries
    let plan = null;
    let directResponse = null;

    if (queryType === 'mental_health_general' && !isRatingOrAnalysisRequest) {
      console.log("Query classified as general mental health question");
      directResponse = null; // Process general queries with our standard chat flow
    } else {
      console.log("Query classified as journal-specific or rating request");
      
      // Build a plan for journal-specific queries with FULL context awareness
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
              content: `You are an AI query planner for SOULo, a Voice Journaling application focused on mental health. Your task is to analyze user questions and create search plans that efficiently retrieve relevant journal entries.

APPLICATION CONTEXT:
- SOULo is a mental health assistance app that helps users track and analyze their emotions through voice journaling
- Users speak their thoughts and the app transcribes, analyzes, and helps them gain insights
- The AI assistant (you) helps users understand patterns in their emotional well-being

IMPORTANT DATABASE INFORMATION:
- All journal entries are stored with UTC timestamps in the database
- The user's current local time is: ${formattedLocalTime} 
- The user's timezone offset from UTC is: ${timezoneOffset || 0} minutes
- When filtering by date ranges, you need to consider the user's timezone

FULL CONVERSATION CONTEXT:
${formattedContext.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

For the following user query, create a JSON search plan with these components:

1. "strategy": Choose the most appropriate search method:
   - "vector" (semantic search, default for conceptual queries)
   - "sql" (direct filtering, best for time/attribute-based queries)
   - "hybrid" (combines both approaches)

2. "filters": Add relevant filters based on the query:
   - "date_range": {startDate, endDate, periodName} (for time-based queries)
     - IMPORTANT: Make sure these dates are in ISO format with timezone (UTC)
     - For relative periods like "last week", compute actual date ranges
     - Account for the user's timezone offset when calculating dates
   - "emotions": [] (array of emotions to filter for)
   - "sentiment": [] (array of sentiments: "positive", "negative", "neutral")
   - "themes": [] (array of themes to filter for)
   - "entities": [{type, name}] (people, places, etc. mentioned)

3. "match_count": Number of entries to retrieve (default 15, use 30+ for aggregations)

4. "needs_data_aggregation": Boolean (true if statistical analysis needed)
   - IMPORTANT: Set this to true for ALL rating, scoring, or evaluation requests
   - Also set to true for any pattern analysis, trait assessment, or statistic requests

5. "needs_more_context": Boolean (true if query relates to previous messages)

6. "is_segmented": Boolean (true if the query should be broken into sub-questions)

7. "subqueries": [] (array of sub-questions if the query is complex and needs to be segmented)

8. "reasoning": String explanation of your planning decisions

9. "topic_context": String (capture what topic this query is about for future reference)

IMPORTANT: If the user's message is a direct response to a clarification question (like "all entries" or "recent only"), 
interpret this in context and create an appropriate plan based on their response.
If the user is continuing a conversation about a specific topic (e.g. happiness, productivity), maintain context.
When a user says something like "rate me out of 100 on this", look at the previous messages to determine what "this" refers to.
Single word responses like "yes", "entire", "all", "overall" should be interpreted in context of the previous question.

Example time periods include "today", "yesterday", "this week", "last week", "this month", "last month", etc.

Return ONLY the JSON plan, nothing else. Ensure it's valid JSON format.
              `
            },
            ...formattedContext, // Include ALL conversation context
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
    
    // Special case handling for historical data requests
    // Look for keywords that indicate the user wants all historical data
    const historicalDataKeywords = ['all entries', 'entire journal', 'all my journal', 'historical data', 'all time', 'all', 'entire', 'everything', 'overall'];
    const wantsHistoricalData = historicalDataKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // If the user wants historical data, remove date filters
    if (wantsHistoricalData && plan && plan.filters && plan.filters.date_range) {
      console.log("User explicitly requested historical data - removing date filters");
      delete plan.filters.date_range;
    }

    // Return the plan
    return new Response(
      JSON.stringify({ 
        plan, 
        queryType: isRatingOrAnalysisRequest ? 'journal_specific' : queryType,
        directResponse,
        needsClarification: ambiguityResult.needsClarification,
        clarificationQuestions,
        ambiguityAnalysis: ambiguityResult
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
 * Enhanced helper function to check if the current message is responding to a previous clarification
 * Considers the full conversation context and better detects clarification responses
 */
function checkIfResponseToClarification(message: string, conversationContext: Array<{role: string, content: string}>): boolean {
  if (conversationContext.length === 0) return false;
  
  // Get the most recent messages with more context
  const recentMessages = conversationContext.slice(-4);
  
  // Check if any of the recent assistant messages was asking for clarification
  const assistantMessages = recentMessages.filter(msg => msg.role === 'assistant');
  if (assistantMessages.length === 0) return false;
  
  // Get the most recent assistant message
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
  
  const clarificationIndicators = [
    'I need to clarify',
    'which time period',
    'what period',
    'could you specify',
    'can you clarify',
    'recent entries',
    'all entries',
    'entire journal',
    'understand your question better',
    'need to understand',
    'not clear',
    'need more information',
    'what do you mean',
    'what are you referring to',
    'want me to focus on',
    'do you want me to analyze',
    'would you like me to',
    'are you asking about',
    'do you mean',
    'would you prefer',
    'should I focus on',
    'entire history or just recent entries',
    'specific timeframe or all entries',
    'more recent journal entries or your entire history'
  ];
  
  const isLastMessageClarification = clarificationIndicators.some(
    indicator => lastAssistantMessage.content.toLowerCase().includes(indicator.toLowerCase())
  );
  
  // If last assistant message was a clarification, check if user's message is a likely response
  if (isLastMessageClarification) {
    // Check for short response (likely a direct reply to a clarification question)
    const isShortResponse = message.split(' ').length <= 10;
    
    // Check for common clarification responses
    const commonResponses = [
      'all', 'everything', 'entire', 'recent', 'just', 'yes', 'no', 'correct', 'overall',
      'today', 'yesterday', 'last week', 'this month', 'happiness', 'mood', 
      'emotions', 'productivity', 'sleep', 'health', 'work', 'relationship',
      'sure', 'ok', 'okay', 'please', 'thanks', 'thank you', 'yep', 'yeah'
    ];
    
    const containsCommonResponse = commonResponses.some(
      response => message.toLowerCase().includes(response.toLowerCase())
    );
    
    return isShortResponse || containsCommonResponse;
  }
  
  return false;
}

/**
 * Helper function to detect if a message is continuing a previous topic
 */
function checkIfTopicContinuation(message: string, conversationContext: Array<{role: string, content: string}>): boolean {
  if (conversationContext.length < 2) return false;
  
  // Check for pronouns and references that usually indicate continuing a topic
  const referenceTerms = ['it', 'this', 'that', 'them', 'these', 'those', 'their', 'its'];
  const messageWords = message.toLowerCase().split(/\s+/);
  
  const containsReference = referenceTerms.some(term => 
    messageWords.includes(term) || messageWords.includes(term + '?')
  );
  
  // Check if the message is very short (likely a follow-up)
  const isShortMessage = message.split(' ').length <= 7;
  
  // Check if the message just asks for a rating/score without specifying context
  const isRatingWithoutContext = /^(rate|score|evaluate|assess|analyze).*\d+(\s*(\/|out of)\s*\d+)?$/i.test(message.trim());
  
  return containsReference || isShortMessage || isRatingWithoutContext;
}

/**
 * New helper function to check if the message directly specifies a time period
 */
function checkForDirectTimePeriod(message: string): string | null {
  const lowerMsg = message.toLowerCase();
  
  // Direct time period expressions
  const directTimeExpressions = [
    { regex: /\b(all|entire|everything)\b/, period: 'all' },
    { regex: /\brecent (only|entries|days|history)\b/, period: 'recent' },
    { regex: /\btoday\b/, period: 'today' },
    { regex: /\byesterday\b/, period: 'yesterday' },
    { regex: /\bthis week\b/, period: 'this week' },
    { regex: /\blast week\b/, period: 'last week' },
    { regex: /\bthis month\b/, period: 'this month' },
    { regex: /\blast month\b/, period: 'last month' },
    { regex: /\bthis year\b/, period: 'this year' },
    { regex: /\blast year\b/, period: 'last year' }
  ];
  
  for (const expr of directTimeExpressions) {
    if (expr.regex.test(lowerMsg)) {
      return expr.period;
    }
  }
  
  // Simple cases where the entire message is just a time period
  if (['all', 'everything', 'entire', 'recent', 'today', 'yesterday'].includes(lowerMsg)) {
    return lowerMsg;
  }
  
  // If a number of days/weeks/months/years is mentioned
  const timeRangeMatch = lowerMsg.match(/\b(\d+)\s*(day|week|month|year)s?\b/);
  if (timeRangeMatch) {
    return `last ${timeRangeMatch[1]} ${timeRangeMatch[2]}s`;
  }
  
  return null;
}

/**
 * Returns default clarification questions based on ambiguity type
 */
function getDefaultClarificationQuestions(ambiguityType: string): Array<{text: string, action: string, parameters: Record<string, any>}> {
  switch(ambiguityType) {
    case "TIME":
      return [
        {
          text: "All journal entries",
          action: "expand_search",
          parameters: { useHistoricalData: true }
        },
        {
          text: "Recent entries only",
          action: "default_search",
          parameters: { useHistoricalData: false }
        }
      ];
    case "SCOPE":
      return [
        {
          text: "Analyze entire journal",
          action: "expand_search",
          parameters: { useHistoricalData: true }
        },
        {
          text: "Focus on recent patterns",
          action: "default_search",
          parameters: { useHistoricalData: false }
        }
      ];
    case "INTENT":
      return [
        {
          text: "Analyze trends",
          action: "expand_search",
          parameters: { analysisType: "trends" }
        },
        {
          text: "Get specific insights",
          action: "default_search",
          parameters: { analysisType: "specific" }
        }
      ];
    default:
      return [
        {
          text: "All journal entries",
          action: "expand_search",
          parameters: { useHistoricalData: true }
        },
        {
          text: "Recent entries only",
          action: "default_search",
          parameters: { useHistoricalData: false }
        }
      ];
  }
}

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
  let startDate: Date;
  let endDate: Date;
  let periodName = timePeriod;
  
  console.log(`Calculating date range for "${timePeriod}" with timezone offset ${timezoneOffset} minutes`);
  console.log(`User's local time: ${now.toISOString()}`);
  
  const lowerTimePeriod = timePeriod.toLowerCase();
  
  if (lowerTimePeriod.includes('today') || lowerTimePeriod.includes('this day')) {
    // Today: Start at midnight, end at 23:59:59
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'today';
  } 
  else if (lowerTimePeriod.includes('yesterday')) {
    // Yesterday: Start at previous day midnight, end at previous day 23:59:59
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'yesterday';
  } 
  else if (lowerTimePeriod.includes('this week')) {
    // This week: Start at current week Monday, end at Sunday 23:59:59
    startDate = new Date(now);
    const dayOfWeek = now.getDay() || 7; // Convert Sunday (0) to 7 to make Monday (1) the first day
    startDate.setDate(now.getDate() - (dayOfWeek - 1)); // Go back to Monday
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Go forward 6 days to Sunday
    endDate.setHours(23, 59, 59, 999);
    periodName = 'this week';
  } 
  else if (lowerTimePeriod.includes('last week')) {
    // Last week: Start at previous week Monday, end at previous week Sunday
    startDate = new Date(now);
    const dayOfWeek = now.getDay() || 7; // Convert Sunday (0) to 7
    startDate.setDate(now.getDate() - (dayOfWeek - 1) - 7); // Go back to previous Monday
    startDate.setHours(0, 0, 0, 0);
    
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Go forward 6 days to Sunday
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last week';
  } 
  else if (lowerTimePeriod.includes('this month')) {
    // This month: Start at 1st of current month, end at last day of month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
    endDate.setHours(23, 59, 59, 999);
    periodName = 'this month';
  } 
  else if (lowerTimePeriod.includes('last month')) {
    // Last month: Start at 1st of previous month, end at last day of previous month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last month';
  } 
  else if (lowerTimePeriod.includes('this year')) {
    // This year: Start at January 1st, end at December 31st
    startDate = new Date(now.getFullYear(), 0, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), 11, 31);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'this year';
  } 
  else if (lowerTimePeriod.includes('last year')) {
    // Last year: Start at January 1st of previous year, end at December 31st of previous year
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last year';
  } 
  else if (lowerTimePeriod === 'entire' || lowerTimePeriod === 'all' || lowerTimePeriod === 'everything' || lowerTimePeriod === 'overall') {
    // Special case for "entire" - use a very broad date range (5 years back)
    startDate = new Date(now);
    startDate.setFullYear(now.getFullYear() - 5);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'entire';
  }
  else {
    // Default to last 30 days if no specific period matched
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    periodName = 'last 30 days';
  }

  // Add back the timezone offset to convert to UTC for storage
  const utcStartDate = new Date(startDate.getTime() + offsetMs);
  const utcEndDate = new Date(endDate.getTime() + offsetMs);
  
  // Validate the date range
  if (utcEndDate < utcStartDate) {
    console.error("Invalid date range calculated: end date is before start date");
    // Fallback to last 7 days as a safe default
    const fallbackStart = new Date(now);
    fallbackStart.setDate(now.getDate() - 7);
    fallbackStart.setHours(0, 0, 0, 0);
    
    const fallbackEnd = new Date(now);
    fallbackEnd.setHours(23, 59, 59, 999);
    
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

