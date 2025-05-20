import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { OpenAI } from 'https://deno.land/x/openai@v4.20.1/mod.ts';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Main function
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
      timezoneOffset = 0, 
      appContext = {}, 
      checkForMultiQuestions = false, 
      isFollowUp = false, 
      referenceDate, 
      preserveTopicContext = false 
    } = await req.json();
    
    console.log(`Request received:
      Message: ${message}
      User ID: ${userId}
      Context length: ${conversationContext.length}
      Is follow-up: ${isFollowUp}
      Reference date provided: ${referenceDate ? 'yes' : 'no'}
      Preserve topic context: ${preserveTopicContext}
      Intent type: ${appContext?.userContext?.intentType || 'not provided'}
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
    
    // IMPROVEMENT: Check if this is a mental health or personal question
    const isMentalHealthQuery = checkForMentalHealthQuery(message);
    const isPersonalQuery = checkForPersonalQuery(message);
    
    if (isMentalHealthQuery || isPersonalQuery) {
      console.log(`Detected ${isMentalHealthQuery ? 'mental health' : 'personal'} query, prioritizing journal analysis`);
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
    } else if (isMentalHealthQuery || isPersonalQuery) {
      // IMPROVEMENT: For mental health queries without explicit time, default to recent period
      calculatedDateRange = calculateDateRange('recent', timezoneOffset);
      extractedTimeContext = 'recent';
      console.log(`Using default recent time range for mental health query`);
    }

    // Enhanced system prompt with more intelligent conversation handling
    // IMPROVEMENT: Add specialized prompting for mental health and personal queries
    const queryAnalysisRequest = {
      role: "system",
      content: generateEnhancedSystemPrompt(appContext, calculatedDateRange, extractedTimeContext, preserveTopicContext, isMentalHealthQuery, isPersonalQuery)
    };
    
    // Prepare the conversation context for the query analysis
    const queryAnalysisMessages = prepareQueryAnalysisMessages(queryAnalysisRequest, message, conversationContext);
    
    // Get query plan from OpenAI with enhanced temperature settings
    // IMPROVEMENT: Use lower temperature for mental health queries for more reliability
    const temperature = determineTemperature(appContext, isFollowUp, isMentalHealthQuery);
    const plan = await getQueryPlanFromOpenAI(queryAnalysisMessages, temperature);
    
    if (!plan) {
      throw new Error('Failed to generate query plan');
    }
    
    // IMPROVEMENT: For mental health queries without a plan strategy, default to journal analysis
    if (isMentalHealthQuery && (!plan.plan || !plan.plan.strategy)) {
      if (!plan.plan) plan.plan = {};
      plan.plan.strategy = 'hybrid';
      plan.plan.needsJournalAnalysis = true;
      plan.queryType = 'journal_specific';
      console.log('Defaulting to journal analysis for mental health query');
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
    
    // IMPROVEMENT: For personal mental health queries, ensure queryType is set correctly
    if ((isMentalHealthQuery || isPersonalQuery) && plan.queryType === 'general') {
      plan.queryType = 'journal_specific';
      console.log('Corrected query type from general to journal_specific for mental health query');
    }
    
    // Handle topic context preservation
    if (preserveTopicContext && plan.plan && appContext?.userContext?.previousTopicContext) {
      plan.plan.topicContext = appContext.userContext.previousTopicContext;
      console.log(`Preserved topic context in plan: ${appContext.userContext.previousTopicContext}`);
    }
    
    // Add the time context to the plan
    if (extractedTimeContext && plan.plan) {
      plan.plan.previousTimeContext = extractedTimeContext;
    }
    
    // Check if this might be a multi-part question
    if (checkForMultiQuestions && shouldSegmentQuery(message)) {
      plan.plan.isSegmented = true;
    }
    
    // Check if we need clarification based on confidence score
    if (plan.plan && !plan.plan.needsMoreContext && shouldRequestClarification(message, plan, isMentalHealthQuery)) {
      plan.plan.needsMoreContext = true;
      plan.plan.clarificationReason = determineClarificationReason(message, plan, isMentalHealthQuery);
    }
    
    // IMPROVEMENT: Add personalization flags to the plan
    if (plan.plan) {
      plan.plan.isPersonalQuery = isPersonalQuery;
      plan.plan.isMentalHealthQuery = isMentalHealthQuery;
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

/**
 * IMPROVEMENT: Check if this is a mental health related query
 */
function checkForMentalHealthQuery(query: string): boolean {
  const mentalHealthKeywords = [
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 
    'feeling', 'therapy', 'therapist', 'psychiatrist', 'psychologist', 
    'counselor', 'counseling', 'wellbeing', 'well-being', 'wellness',
    'self-care', 'burnout', 'overwhelm', 'mindfulness', 'meditation',
    'coping', 'psychological', 'emotional health', 'distress'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for mental health keywords
  for (const keyword of mentalHealthKeywords) {
    if (lowerQuery.includes(keyword)) {
      return true;
    }
  }
  
  // Check for phrases commonly used in mental health contexts
  const mentalHealthPatterns = [
    /\b(?:i (?:feel|am feeling|have been feeling))\b/i,
    /\b(?:help|improve) (?:my|with) (?:mental|emotional)/i,
    /\b(?:my|with) (?:mental|emotional) (?:health|state|wellbeing)/i,
    /\bhow (?:to|can i|should i) (?:feel better|improve|help)/i,
    /\badvice (?:for|on|about) (?:my|dealing with|handling)/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

/**
 * IMPROVEMENT: Check if this is a personal query
 */
function checkForPersonalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Check for first-person pronouns and possessives
  const personalIndicators = [
    /\bmy\b/i, /\bi\b/i, /\bme\b/i, /\bmine\b/i, /\bmyself\b/i,
    /for me\b/i, /\bshould i\b/i, /\bcan i\b/i, /\bcould i\b/i,
    /\bwould i\b/i, /\bdo i\b/i
  ];
  
  for (const pattern of personalIndicators) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  // Check for direct personal advice requests
  if (/\b(?:advice|help|suggest|recommendation)s?\b.*\bfor\b/i.test(lowerQuery)) {
    return true;
  }
  
  return false;
}

/**
 * Generate an enhanced system prompt with better conversation intelligence
 * IMPROVEMENT: Add mental health specific prompt enhancements
 */
function generateEnhancedSystemPrompt(
  appContext: any, 
  dateRange: any, 
  timeContext: string | null, 
  preserveTopicContext: boolean,
  isMentalHealthQuery: boolean = false,
  isPersonalQuery: boolean = false
): string {
  // Get app information from the context
  const appInfo = appContext?.appInfo || {
    name: "Journal Analysis App",
    type: "Voice Journaling App",
    features: ["Journal Analysis", "Emotion Tracking"]
  };
  
  // Get user context with enhanced properties
  const userContext = appContext?.userContext || {};
  const previousTimeContext = userContext.previousTimeContext || null;
  const previousTopicContext = userContext.previousTopicContext || null;
  const intentType = userContext.intentType || 'new_query';
  
  let basePrompt = `You are an AI assistant for ${appInfo.name}, a ${appInfo.type} focused on mental health and self-reflection. 
Your task is to analyze user queries about their journal entries and create a structured plan for searching and retrieving relevant information.`;

  // IMPROVEMENT: Add specialized instructions for mental health queries
  if (isMentalHealthQuery) {
    basePrompt += `\n\nThis appears to be a MENTAL HEALTH RELATED QUERY. For mental health questions:
1. PRIORITIZE analyzing the user's journal entries to provide personalized insights rather than generic advice.
2. Look for patterns in emotions, behaviors, and thoughts across their journal entries.
3. Focus on providing evidence-based, personalized suggestions based on their journaling history.
4. Default to analyzing recent entries if no time period is specified.`;
  }

  // IMPROVEMENT: Add specialized instructions for personal queries
  if (isPersonalQuery) {
    basePrompt += `\n\nThis appears to be a PERSONAL QUERY where the user is asking for advice specific to their situation.
1. ALWAYS analyze their journal entries to provide personalized insights rather than generic advice.
2. Look for patterns and context in their own writing to make recommendations relevant to them.
3. Avoid generic, one-size-fits-all advice that doesn't consider their personal context.`;
  }

  // Add information about conversation intent and context
  basePrompt += `\n\nCONVERSATION CONTEXT:`;
  basePrompt += `\n- Query intent type: ${intentType}`;
  
  if (previousTimeContext || previousTopicContext) {
    basePrompt += `\n- Previous conversation context:`;
    
    if (previousTimeContext) {
      basePrompt += `\n  - Time period: "${previousTimeContext}"`;
    }
    
    if (previousTopicContext) {
      basePrompt += `\n  - Topic: "${previousTopicContext}"`;
      
      // Emphasize topic preservation for time follow-ups
      if (preserveTopicContext) {
        basePrompt += `\n\nIMPORTANT: This appears to be a TIME-BASED FOLLOW-UP QUESTION. The user is asking about a different time period but is still interested in the SAME TOPIC ("${previousTopicContext}"). Maintain the topic context while updating the time reference.`;
      }
    }
  }
  
  // Add date range information if available from a time expression
  if (dateRange) {
    basePrompt += `\n\nTIME EXPRESSION DETECTED: "${timeContext}"
Time range calculated: 
- Start date: ${dateRange.startDate}
- End date: ${dateRange.endDate}
- Period name: ${dateRange.periodName}`;
  }

  // Add specific instructions based on intent type
  if (intentType === 'new_query') {
    basePrompt += `\n\nThis is a NEW QUERY without previous context. Focus on understanding the main question and identifying the required journal data.`;
  } else if (intentType === 'clarification_response') {
    basePrompt += `\n\nThis is a RESPONSE TO A CLARIFICATION request. Use this new information to refine the query understanding.`;
  } else if (intentType === 'multi_part') {
    basePrompt += `\n\nThis query contains MULTIPLE QUESTIONS or requests. Break it down into its component parts in your analysis.`;
  }

  // Add complete instructions
  basePrompt += `\n\nYour task:
1. Analyze the query to understand what type of information the user is seeking from their journal entries.
2. Identify if clarification is needed before proceeding with the search.
3. Create a structured plan for searching and retrieving the relevant information.
4. Return your analysis in a structured JSON format.`;

  // Add enhanced output format instructions
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
    "needsMoreContext": boolean,
    "clarificationReason": "string explaining why clarification is needed",
    "ambiguities": ["list of ambiguous aspects of the query"],
    "isSegmented": boolean,
    "topicContext": "the main topic of the query",
    "confidenceScore": number between 0 and 1,
    "reasoning": "explanation of the plan",
    "isPersonalQuery": boolean,
    "isMentalHealthQuery": boolean,
    "needsJournalAnalysis": boolean
  },
  "queryType": "journal_specific" | "general_analysis" | "emotional_analysis" | "pattern_detection" | "personality_reflection"
}`;

  return basePrompt;
}

/**
 * Prepare conversation context for query analysis with improved context handling
 */
function prepareQueryAnalysisMessages(queryAnalysisRequest: any, message: string, conversationContext: any[]): any[] {
  const userMessage = { role: "user", content: message };
  
  // Add the system prompt
  const messages = [queryAnalysisRequest];
  
  // Only include relevant previous conversation context
  // For very long contexts, prioritize the most recent exchanges
  let contextToInclude = conversationContext;
  
  if (conversationContext.length > 6) {
    // Take first message (likely contains system info) and last 5 messages
    contextToInclude = [
      conversationContext[0],
      ...conversationContext.slice(-5)
    ];
  }
  
  // Add filtered conversation context
  for (const contextMessage of contextToInclude) {
    messages.push(contextMessage);
  }
  
  // Add the user's message
  messages.push(userMessage);
  
  return messages;
}

/**
 * Determine appropriate temperature setting based on context
 * IMPROVEMENT: Use different temperature for mental health queries
 */
function determineTemperature(appContext: any, isFollowUp: boolean, isMentalHealthQuery: boolean): number {
  const intentType = appContext?.userContext?.intentType || 'new_query';
  const needsClarity = appContext?.userContext?.needsClarity || false;
  
  // Use higher temperature for clarification questions to be more creative
  if (needsClarity) return 0.7;
  
  // Use lower temperature for mental health queries for consistency
  if (isMentalHealthQuery) return 0.0;
  
  // Use lower temperature for time-based follow-ups to be more precise
  if (intentType === 'followup_time') return 0.0;
  
  // Use lower temperature for factual analysis
  if (intentType === 'journal_specific') return 0.2;
  
  // Default to moderate temperature
  return 0.4;
}

/**
 * Get query plan from OpenAI with enhanced parameters
 */
function getQueryPlanFromOpenAI(messages: any, temperature: number = 0.2): Promise<any> {
  try {
    console.log(`Calling OpenAI with temperature ${temperature}`);
    
    return openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: messages,
      temperature: temperature,
      response_format: { type: "json_object" }
    })
    .then(completion => {
      const response = completion.choices[0].message?.content;
      console.log(`Received from OpenAI: ${response?.substring(0, 200)}...`);
      
      if (!response) {
        throw new Error('No response from OpenAI');
      }
      
      try {
        return JSON.parse(response);
      } catch (error) {
        console.error('Failed to parse JSON response from OpenAI:', error);
        console.log('Raw response from OpenAI:', response);
        return { plan: null, queryType: 'journal_specific' };
      }
    })
    .catch(error => {
      console.error('Error calling OpenAI:', error);
      return { plan: null, queryType: 'journal_specific' };
    });
  } catch (error) {
    console.error('Error in getQueryPlanFromOpenAI:', error);
    return Promise.resolve({ plan: null, queryType: 'journal_specific' });
  }
}

/**
 * Check if clarification should be requested based on message and plan
 * IMPROVEMENT: Have different thresholds for mental health queries
 */
function shouldRequestClarification(message: string, plan: any, isMentalHealthQuery: boolean): boolean {
  // For mental health queries, be more lenient with clarification requests
  if (isMentalHealthQuery) {
    // Only request clarification for extremely vague queries
    if (message.length < 5) return true;
    return false;
  }
  
  // Regular clarification logic for non-mental health queries
  // Check message characteristics
  if (message.length < 10 && !message.includes('?')) return true;
  
  // Check if the plan has sufficient filters defined
  const filters = plan?.plan?.filters || {};
  if (Object.keys(filters).length === 0) {
    return message.length < 15; // Only request clarification for short messages with no filters
  }
  
  // Check confidence score if available
  const confidenceScore = plan?.plan?.confidenceScore;
  if (confidenceScore !== undefined && confidenceScore < 0.4) return true;
  
  return false;
}

/**
 * Determine the reason clarification is needed
 * IMPROVEMENT: Provide more specific clarification requests for mental health queries
 */
function determineClarificationReason(message: string, plan: any, isMentalHealthQuery: boolean): string {
  if (isMentalHealthQuery) {
    return "To provide personalized mental health insights, I need to know more about what specific aspects of your mental health you're concerned about.";
  }
  
  if (message.length < 10 && !message.includes('?')) {
    return "The query is very short and lacks specific details about what you're looking for.";
  }
  
  const filters = plan?.plan?.filters || {};
  if (Object.keys(filters).length === 0 && message.length < 15) {
    return "I'm not sure what specific aspect of your journal entries you're interested in.";
  }
  
  if (plan?.plan?.ambiguities && plan.plan.ambiguities.length > 0) {
    return `There are some ambiguities in your question: ${plan.plan.ambiguities.join(', ')}.`;
  }
  
  return "I need more details to provide a relevant answer to your question.";
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
  // ... keep existing code
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
    
    // IMPROVEMENT: Add "recent" as a default time context
    { regex: /\brecent\b/i, value: 'recent' },
    { regex: /\blately\b/i, value: 'recent' }
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
    return lowerQuery.match(/^(today|yesterday|this week|last week|this month|last month|this year)/i)![0];
  }
  
  return null;
}

/**
 * Calculate date range based on time expression
 * IMPROVEMENT: Add support for "recent" as a default time context
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
  // IMPROVEMENT: Add specific handler for "recent" time expressions
  else if (lowerTimePeriod === 'recent' || lowerTimePeriod === 'lately') {
    // For mental health or personal queries use last 2 weeks by default
    startDate = startOfDay(subDays(now, 14)); // Last 14 days
    endDate = endOfDay(now);
    periodName = 'recent (last 2 weeks)';
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

// ... keep existing code (date helper functions)

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
