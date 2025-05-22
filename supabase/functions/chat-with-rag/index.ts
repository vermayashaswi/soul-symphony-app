import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { format, addDays, startOfWeek, endOfWeek, subDays } from "https://esm.sh/date-fns@3.3.1";
import { toZonedTime } from "https://esm.sh/date-fns-tz@3.2.0";

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

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum number of journal entries to retrieve for vector search
// Keep this reasonable for vector search to ensure quality results
const MAX_ENTRIES = 10;

// Don't limit entries for time pattern or special analysis queries
// Set to a higher value to ensure all entries are analyzed
const MAX_TIME_ANALYSIS_ENTRIES = 1000; // Increased from 100 to handle more entries

/**
 * Get the formatted date range for the current week
 */
function getCurrentWeekDates(timezone?: string): string {
  // Default to UTC if no timezone specified
  const tz = timezone || 'UTC';
  console.log(`Getting current week dates for timezone: ${tz}`);
  
  try {
    // Get the current date in the user's timezone
    const now = toZonedTime(new Date(), tz);
    console.log(`Current date in ${tz}: ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);
    
    // Get the start of the week (Monday)
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    // Get the end of the week (Sunday)
    const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 });
    
    console.log(`Start of current week: ${format(startOfCurrentWeek, 'yyyy-MM-dd')}`);
    console.log(`End of current week: ${format(endOfCurrentWeek, 'yyyy-MM-dd')}`);
    
    // Format the dates in a user-friendly way
    const formattedStart = format(startOfCurrentWeek, 'MMMM d');
    const formattedEnd = format(endOfCurrentWeek, 'MMMM d, yyyy');
    
    return `${formattedStart} to ${formattedEnd}`;
  } catch (error) {
    console.error("Error calculating current week dates:", error);
    // Fallback calculation if there's an error with timezone handling
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to get Monday
    
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(now);
    sunday.setDate(monday.getDate() + 6);
    
    return `${format(monday, 'MMMM d')} to ${format(sunday, 'MMMM d, yyyy')}`;
  }
}

/**
 * Get the formatted date range for the last week
 */
function getLastWeekDates(timezone?: string): string {
  // Default to UTC if no timezone specified
  const tz = timezone || 'UTC';
  console.log(`Getting last week dates for timezone: ${tz}`);
  
  try {
    // Get the current date in the user's timezone
    const now = toZonedTime(new Date(), tz);
    console.log(`Current date in ${tz}: ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);
    
    // Get this week's Monday and Sunday
    const thisWeekMonday = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekSunday = endOfWeek(now, { weekStartsOn: 1 });
    
    // Last week is 7 days before this week
    const lastWeekMonday = subDays(thisWeekMonday, 7);
    const lastWeekSunday = subDays(thisWeekSunday, 7);
    
    console.log("LAST WEEK CALCULATION (EDGE FUNCTION):");
    console.log(`Current date: ${format(now, 'yyyy-MM-dd')}`);
    console.log(`This week's Monday: ${format(thisWeekMonday, 'yyyy-MM-dd')}`);
    console.log(`This week's Sunday: ${format(thisWeekSunday, 'yyyy-MM-dd')}`);
    console.log(`Last week's Monday: ${format(lastWeekMonday, 'yyyy-MM-dd')}`);
    console.log(`Last week's Sunday: ${format(lastWeekSunday, 'yyyy-MM-dd')}`);
    
    // Format the dates in a user-friendly way
    const formattedStart = format(lastWeekMonday, 'MMMM d');
    const formattedEnd = format(lastWeekSunday, 'MMMM d, yyyy');
    
    return `${formattedStart} to ${formattedEnd}`;
  } catch (error) {
    console.error("Error calculating last week dates:", error);
    // Fallback calculation if there's an error with timezone handling
    const now = new Date();
    const todayDay = now.getDay(); // 0 is Sunday
    
    // Get last week's Monday (current day - 7 - days since last Monday)
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - 7 - todayDay + (todayDay === 0 ? -6 : 1)); 
    
    // Get last week's Sunday (last Monday + 6 days)
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    
    return `${format(lastMonday, 'MMMM d')} to ${format(lastSunday, 'MMMM d, yyyy')}`;
  }
}

/**
 * Detect if query appears to be a time-based summary query
 */
function isTimeSummaryQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Check for phrases that suggest the user wants a summary of a period
  const summaryPatterns = [
    'how has', 'how have', 'how was', 'how were',
    'summarize', 'summary of', 'recap',
    'what happened', 'what was happening',
    'how did i feel', 'how was i feeling'
  ];
  
  // Check for time periods
  const timePatterns = [
    'day', 'week', 'month', 'year',
    'last few days', 'past few days',
    'last night', 'yesterday',
    'last week', 'last month', 'past month',
    'recent', 'lately'
  ];
  
  // Check if the query contains both a summary pattern and a time pattern
  const hasSummaryPattern = summaryPatterns.some(pattern => lowerQuery.includes(pattern));
  const hasTimePattern = timePatterns.some(pattern => lowerQuery.includes(pattern));
  
  return hasSummaryPattern && hasTimePattern;
}

/**
 * Detect if the query is about journal patterns, habits, or personality insights
 * These queries should analyze all entries regardless of time mentions
 */
function isJournalAnalysisQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Patterns suggesting the query is about overall journal insights or patterns
  const analysisPatterns = [
    'pattern', 'habit', 'routine', 'tendency', 'prefer', 
    'typically', 'usually', 'often', 'frequently',
    'what do i', 'how do i', 'am i', 'do i',
    'personality', 'trait', 'characteristic',
    'my top', 'most common', 'most frequent', 'overall',
    'in general', 'generally', 'typically', 'trends',
    'insights', 'analysis', 'reflect'
  ];
  
  return analysisPatterns.some(pattern => lowerQuery.includes(pattern));
}

/**
 * Check if query is asking about current or last week dates
 */
function isDirectDateQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Patterns for direct date inquiries
  const dateQueryPatterns = [
    /\bwhat\s+(is|are)\s+(the\s+)?(current|this)\s+week('s)?\s+dates\b/i,
    /\bwhat\s+date\s+is\s+it\b/i,
    /\bwhat\s+day\s+is\s+(it|today)\b/i,
    /\bwhat\s+(is|are)\s+(the\s+)?dates?\s+for\s+(this|current|last|previous)\s+week\b/i,
    /\bcurrent\s+week\s+dates?\b/i,
    /\blast\s+week\s+dates?\b/i,
    /\blast\s+week('s)?\s+dates?\b/i,
    /\bthis\s+week('s)?\s+dates?\b/i, 
    /\bwhat\s+dates?\s+(is|are)\s+(this|last)\s+week\b/i,
    /\btoday's\s+date\b/i
  ];
  
  // Check if any of the patterns match
  for (const pattern of dateQueryPatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Handle the request to chat with RAG (Retrieval-Augmented Generation)
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const {
      message,
      userId,
      threadId,
      usePersonalContext = false,
      queryPlan = null,
      conversationHistory = []
    } = await req.json();

    console.log(`Processing request for user ${userId}: ${message}`);

    // Check if this is a direct date query that needs a simple calendar response
    const isDateQuery = queryPlan?.isDirectDateQuery || isDirectDateQuery(message);
    if (isDateQuery) {
      console.log("Processing as direct date query");
      
      // Get user's timezone from their profile
      let userTimezone;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', userId)
          .single();
          
        if (data && !error) {
          userTimezone = data.timezone;
          console.log(`Found user timezone: ${userTimezone}`);
        }
      } catch (error) {
        console.error("Error fetching user timezone:", error);
      }
      
      // Check if asking about current week or last week
      const isLastWeekQuery = message.toLowerCase().includes('last week') || 
                             message.toLowerCase().includes('previous week');
      
      let response;
      
      if (isLastWeekQuery) {
        // Get the last week's date range in user's timezone
        const dateRange = getLastWeekDates(userTimezone);
        console.log(`Last week date range: ${dateRange}`);
        response = `The last week dates were: ${dateRange}`;
      } else {
        // Get the current week's date range in user's timezone
        const dateRange = getCurrentWeekDates(userTimezone);
        console.log(`Current week date range: ${dateRange}`);
        const today = new Date();
        response = `The current week dates are: ${dateRange}\n\nToday is ${format(today, 'EEEE, MMMM d, yyyy')}.`;
      }
      
      return new Response(
        JSON.stringify({
          response: response,
          references: [],
          isDirectDateResponse: true
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Determine the appropriate query strategy based on usePersonalContext and queryPlan
    let searchStrategy = 'default';
    let filters = {};
    let needsDataAggregation = false;
    let domainContext = null;
    let isTimePatternQuery = false;
    let isTimeSummary = isTimeSummaryQuery(message);
    let isPersonalityQuery = false;
    let isJournalAnalysis = isJournalAnalysisQuery(message);
    
    // Check if this is a time pattern related query
    if (message.toLowerCase().includes('time') || 
        message.toLowerCase().includes('when') || 
        message.toLowerCase().includes('pattern') ||
        message.toLowerCase().includes('schedule') ||
        message.toLowerCase().includes('frequent')) {
      isTimePatternQuery = true;
    }

    if (queryPlan) {
      searchStrategy = queryPlan.strategy || queryPlan.searchStrategy || 'hybrid';
      filters = queryPlan.filters || {};
      needsDataAggregation = queryPlan.needsDataAggregation || false;
      domainContext = queryPlan.domainContext || null;
      isTimePatternQuery = queryPlan.isTimePatternQuery || isTimePatternQuery;
      isPersonalityQuery = queryPlan.isPersonalityQuery || false;
    }

    console.log(`Using search strategy: ${searchStrategy}`);
    console.log(`Domain context: ${domainContext}`);
    console.log(`Is time pattern query: ${isTimePatternQuery}`);
    console.log(`Is time summary query: ${isTimeSummary}`);
    console.log(`Is personality query: ${isPersonalityQuery}`);
    console.log(`Is journal analysis query: ${isJournalAnalysis}`);
    console.log(`Conversation history length: ${conversationHistory.length}`);

    // Generate an OpenAI embedding for the user's message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: message
      })
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding for query");
    }

    const { data: embeddingData } = await embeddingResponse.json();
    const embedding = embeddingData[0].embedding;

    // Different handling based on whether personal context is needed or not
    if (usePersonalContext || searchStrategy !== 'default') {
      console.log("Processing as journal-specific question");
      
      // Process the query with vector similarity search on journal entries
      return await handleJournalQuestion(
        message, 
        userId, 
        embedding, 
        filters, 
        searchStrategy, 
        needsDataAggregation, 
        conversationHistory, 
        isTimePatternQuery || isJournalAnalysis || isPersonalityQuery, 
        isTimeSummary
      );
    } else {
      console.log("Processing as general question (no personal context)");
      
      // Process the query as a general question without personal context
      return await handleGeneralQuestion(message, userId, conversationHistory);
    }
  } catch (error) {
    console.error("Error in chat-with-rag function:", error);
    
    return new Response(
      JSON.stringify({
        response: `I encountered an error: ${error.message}. Please try again.`,
        error: error.message
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      }
    );
  }
});

/**
 * Handle general questions that don't require personal context
 */
async function handleGeneralQuestion(message, userId, conversationHistory = []) {
  try {
    console.log("Handling general question");
    
    // Call OpenAI to process the general question
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful conversational assistant. Respond naturally to the user's queries without referencing any specific personal data unless provided."
          },
          ...conversationHistory,
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error from OpenAI:", error);
      throw new Error("Failed to generate response");
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    return new Response(
      JSON.stringify({
        response: answer,
        references: []
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error("Error in handleGeneralQuestion:", error);
    throw error;
  }
}

/**
 * Handle journal questions that require personal context
 */
async function handleJournalQuestion(message, userId, embedding, filters = {}, searchStrategy = 'hybrid', needsDataAggregation = false, conversationHistory = [], isComprehensiveAnalysisQuery = false, isTimeSummary = false) {
  try {
    console.log("Handling journal question");
    console.log(`Is comprehensive analysis query: ${isComprehensiveAnalysisQuery}`);
    
    // Step 1: Search for relevant journal entries using the appropriate strategy
    let relevantEntries = [];
    let textSearchEntries = [];
    let vectorSearchEntries = [];
    
    console.log(`Searching for relevant journal entries using strategy: ${searchStrategy}`);
    
    // Apply the search strategy
    if (searchStrategy === 'text' || searchStrategy === 'hybrid') {
      try {
        console.log("Performing text search");
        textSearchEntries = await searchEntriesWithSQL(userId, message, filters, isComprehensiveAnalysisQuery);
        console.log(`Found ${textSearchEntries.length} entries with text search`);
      } catch (error) {
        console.error("Error in text search:", error);
      }
    }
    
    if (searchStrategy === 'vector' || searchStrategy === 'hybrid') {
      try {
        console.log("Performing vector search");
        vectorSearchEntries = await searchEntriesWithVector(userId, embedding, filters, isComprehensiveAnalysisQuery);
        console.log(`Found ${vectorSearchEntries.length} entries with vector search`);
      } catch (error) {
        console.error("Error in vector search:", error);
      }
    }
    
    // Merge results depending on search strategy
    if (searchStrategy === 'hybrid') {
      const entryIds = new Set();
      relevantEntries = [];
      
      // First add vector search results (typically higher quality)
      for (const entry of vectorSearchEntries) {
        if (!entryIds.has(entry.id)) {
          entryIds.add(entry.id);
          relevantEntries.push(entry);
        }
      }
      
      // Then add text search results that weren't already added
      for (const entry of textSearchEntries) {
        if (!entryIds.has(entry.id)) {
          entryIds.add(entry.id);
          relevantEntries.push(entry);
        }
      }
      
    } else if (searchStrategy === 'vector') {
      relevantEntries = vectorSearchEntries;
    } else {
      relevantEntries = textSearchEntries;
    }
    
    // Determine whether to limit entries based on query type
    // For comprehensive analysis queries, we want all entries
    const shouldLimitEntries = !isComprehensiveAnalysisQuery;
    
    if (relevantEntries.length > MAX_ENTRIES && shouldLimitEntries) {
      console.log(`Limiting entries from ${relevantEntries.length} to ${MAX_ENTRIES} for regular query processing`);
      relevantEntries = relevantEntries.slice(0, MAX_ENTRIES);
    } else {
      console.log(`Using all ${relevantEntries.length} relevant entries for analysis`);
    }
    
    console.log(`Total relevant entries found: ${relevantEntries.length}`);
    
    if (relevantEntries.length === 0) {
      console.log("No relevant journal entries found");
      return new Response(
        JSON.stringify({
          response: "I don't see any journal entries that match what you're asking about. Could you try asking something else or provide more context?",
          references: []
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // Step 2: Format entries for the prompt
    let journalContext = "";
    const references = [];
    
    for (const entry of relevantEntries) {
      // Ensure we use the correct content field from journal entries
      const entryContent = entry.content || 
                          (entry["refined text"] || entry["transcription text"]) || 
                          "";
                          
      const formattedDate = new Date(entry.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      });
      
      // Add entry to context
      journalContext += `Journal entry from ${formattedDate}:\n${entryContent}\n\n`;
      
      // Add entry to references (for citation in UI)
      references.push({
        id: entry.id,
        date: entry.created_at,
        snippet: entryContent.substring(0, 150) + (entryContent.length > 150 ? "..." : "")
      });
    }
    
    // Format conversation history for the prompt
    let conversationContextText = "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContextText = "\n\nRecent conversation history:\n";
      conversationHistory.forEach((msg, i) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        conversationContextText += `${role}: ${msg.content}\n`;
      });
      conversationContextText += "\n";
    }
    
    // Step 3: Determine the appropriate system prompt based on query type
    let systemPrompt = "";
    
    if (isTimeSummary) {
      // Special prompt for time-based summary queries - dynamically include the entry count
      systemPrompt = `You are a helpful personal assistant that summarizes journal entries over time periods. You have access to the following ${relevantEntries.length} journal entries:

${journalContext}

${conversationContextText}

Based on these entries, provide a CONCISE SUMMARY of the user's experiences and emotions during this time period.

RESPONSE GUIDELINES:
1. Keep your summary UNDER 150 WORDS
2. Focus on PATTERNS and TRENDS rather than day-by-day details
3. Highlight emotional themes and significant events only
4. DO NOT list every daily activity or provide a chronological account
5. Include 2-3 key insights about the user's emotional state during this period
6. Use bullet points sparingly and only for the most important insights
7. Maintain a warm, empathetic tone

The user is asking for a summary of their journal entries over a time period. Provide a concise, insightful overview without excessive detail.`;
    } else {
      // Standard prompt for other journal queries
      systemPrompt = `You are a helpful personal assistant that helps users reflect on and analyze their journal entries. You have access to the following ${relevantEntries.length} journal entries from the user:

${journalContext}

${conversationContextText}

Based on these entries and conversation history, help the user by answering their question. 

Formatting guidelines:
1. Structure your response with clear sections using markdown formatting when appropriate
2. For analytical responses, include bullet points to highlight key insights
3. When referencing dates or timeframes, be specific 
4. For personal advice or reflections, use a warm, empathetic tone
5. If the information in the entries is not sufficient to answer completely, clearly state what is missing

Stay factual and only make conclusions that are directly supported by the journal entries. Be empathetic, personal, and thoughtful in your responses.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      // Don't add conversation history here since we've included it in the system prompt
      { role: "user", content: message }
    ];
    
    console.log(`Sending request to OpenAI with ${relevantEntries.length} journal entries in context`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error from OpenAI:", error);
      throw new Error("Failed to generate response");
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    return new Response(
      JSON.stringify({
        response: answer,
        references: references
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error("Error handling journal question:", error);
    throw error;
  }
}

/**
 * Helper function to coalesce values (similar to SQL COALESCE)
 */
function COALESCE(...args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== null && args[i] !== undefined) {
      return args[i];
    }
  }
  return null;
}

/**
 * Search journal entries using SQL-based text search with filters
 */
async function searchEntriesWithSQL(userId, query, filters = {}, isComprehensiveAnalysisQuery = false) {
  try {
    // Start building the query
    let queryBuilder = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, master_themes, emotions')
      .eq('user_id', userId);
    
    // Apply date range filters if provided
    if (filters.dateRange) {
      if (filters.dateRange.startDate) {
        queryBuilder = queryBuilder.gte('created_at', filters.dateRange.startDate);
      }
      if (filters.dateRange.endDate) {
        queryBuilder = queryBuilder.lte('created_at', filters.dateRange.endDate);
      }
    }
    
    // Apply full-text search on content and themes
    // Note: We search in both refined text and transcription text columns since there's no content column
    const searchTerms = query.split(' ').filter(term => term.length > 3).join(' | ');
    if (searchTerms) {
      queryBuilder = queryBuilder.or(`"refined text".ilike.%${searchTerms}%, "transcription text".ilike.%${searchTerms}%`);
    }
    
    // Execute the query - don't limit if it's a comprehensive analysis query
    const entryLimit = isComprehensiveAnalysisQuery ? MAX_TIME_ANALYSIS_ENTRIES : MAX_ENTRIES;
    console.log(`SQL search using entry limit: ${entryLimit} (comprehensive: ${isComprehensiveAnalysisQuery})`);
    
    const { data: entries, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(entryLimit);
    
    if (error) {
      console.error("Error in SQL search:", error);
      throw error;
    }
    
    // Map the results to include a proper content field
    const mappedEntries = entries.map(entry => {
      return {
        ...entry,
        content: COALESCE(entry["refined text"], entry["transcription text"]) || ""
      };
    });
    
    return mappedEntries;
  } catch (error) {
    console.error("Error in text search:", error);
    throw error;
  }
}

/**
 * Search journal entries using vector similarity with filters
 */
async function searchEntriesWithVector(userId, embedding, filters = {}, isComprehensiveAnalysisQuery = false) {
  try {
    let matchFn = 'match_journal_entries_fixed';
    
    // Determine the appropriate match count based on the query type
    const matchCount = isComprehensiveAnalysisQuery ? MAX_TIME_ANALYSIS_ENTRIES : MAX_ENTRIES;
    console.log(`Vector search using match count: ${matchCount} (comprehensive: ${isComprehensiveAnalysisQuery})`);
    
    const params = {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: matchCount,
      user_id_filter: userId
    };
    
    // Use date-aware function if date range filters are provided
    if (filters.dateRange && (filters.dateRange.startDate || filters.dateRange.endDate)) {
      matchFn = 'match_journal_entries_with_date';
      params.start_date = filters.dateRange.startDate || null;
      params.end_date = filters.dateRange.endDate || null;
    }
    
    // Call the appropriate database function for vector search
    const { data: entries, error } = await supabase.rpc(matchFn, params);
    
    if (error) {
      console.error(`Error in vector search using ${matchFn}:`, error);
      throw error;
    }
    
    // Map the results to include a proper content field
    const mappedEntries = entries.map(entry => {
      return {
        ...entry,
        // Ensure we have a content field that uses the correct data
        content: COALESCE(entry["refined text"], entry["transcription text"], entry.content) || ""
      };
    });
    
    return mappedEntries;
  } catch (error) {
    console.error("Error searching entries with vector:", error);
    throw error;
  }
}
