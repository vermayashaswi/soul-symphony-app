
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders, handleCorsRequest } from "./utils/cors.ts";
import { 
  detectMentalHealthQuery,
  isDirectDateQuery,
  isJournalAnalysisQuery,
  detectTimeframeInQuery,
  detectMonthInQuery,
  isMonthSpecificQuery
} from "./utils/queryClassifier.ts";
import { generateEmbedding } from "./utils/embeddingService.ts";
import { 
  searchEntriesWithVector, 
  searchEntriesWithTimeRange,
  searchEntriesByMonth 
} from "./utils/searchService.ts";
import { generateResponse } from "./utils/responseGenerator.ts";
import { processTimeRange } from "./utils/dateProcessor.ts";
import { analyzeEmotions } from "./utils/emotionAnalyzer.ts";

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

// Maximum number of previous messages to include for context
const MAX_CONTEXT_MESSAGES = 10;

// Handle the request to chat with RAG (Retrieval-Augmented Generation)
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json();
    const { message, userId, timeRange, threadId, queryPlan } = reqBody;

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log("Time range received:", timeRange ? JSON.stringify(timeRange) : "No time range provided");
    console.log("Query plan received:", queryPlan ? JSON.stringify(queryPlan, null, 2) : "No query plan provided");
    console.log("Timezone information:", reqBody.timezoneOffset, reqBody.timezoneName);
    
    // Get user timezone preference from profile
    let userTimezone = "UTC";
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single();
        
      if (profileData && profileData.timezone) {
        userTimezone = profileData.timezone;
        console.log(`User timezone from profile: ${userTimezone}`);
      } else {
        console.log("No timezone found in user profile, using default UTC");
      }
    } catch (profileError) {
      console.error("Error fetching user profile timezone:", profileError);
    }
    
    // Enhance timeRange with user timezone
    const timeRangeWithTimezone = timeRange ? { 
      ...timeRange, 
      timezone: userTimezone || reqBody.timezoneName || "UTC" 
    } : null;
    
    // Process time range if provided
    let processedTimeRange = timeRangeWithTimezone ? processTimeRange(timeRangeWithTimezone) : null;
    
    // Check for month-specific queries before proceeding
    const monthName = detectMonthInQuery(message);
    const isMonthQuery = isMonthSpecificQuery(message);
    
    if (isMonthQuery && monthName) {
      console.log(`Detected specific month query for: ${monthName}`);
      
      // Extract year if present in the query, otherwise use current year
      const yearMatch = message.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      
      // Override any existing time range with the detected month
      processedTimeRange = processTimeRange({
        type: 'specificMonth',
        monthName: monthName,
        year: year,
        timezone: userTimezone || reqBody.timezoneName || "UTC"
      });
      
      console.log(`Setting time range for ${monthName} ${year}:`, processedTimeRange);
    }
    
    // Extract time frame from query if not provided explicitly
    if (!processedTimeRange) {
      const detectedTimeframe = detectTimeframeInQuery(message);
      if (detectedTimeframe) {
        console.log(`Detected timeframe in query: ${JSON.stringify(detectedTimeframe)}`);
        processedTimeRange = processTimeRange(detectedTimeframe);
        console.log("Processed detected timeframe:", processedTimeRange);
      }
    }
    
    // Determine if this is a mental health query requiring personalized analysis
    const isMentalHealthQuery = (queryPlan?.domainContext === 'mental_health') || 
                               detectMentalHealthQuery(message);
    
    if (isMentalHealthQuery) {
      console.log("Detected mental health query, forcing journal-specific processing");
    }
    
    // Send an immediate response with processing status for long-running requests
    if (reqBody.acknowledgeRequest) {
      EdgeRuntime.waitUntil(async () => {
        console.log("Processing message in background task");
      });
      
      return new Response(
        JSON.stringify({ 
          status: "processing",
          message: "Your request is being processed"
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Fetch previous messages from this thread if a threadId is provided
    let conversationContext = reqBody.conversationContext || [];
    if (threadId && conversationContext.length === 0) {
      try {
        console.log(`Retrieving context from thread ${threadId}`);
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES * 2);
        
        if (error) {
          console.error('Error fetching thread context:', error);
        } else if (previousMessages && previousMessages.length > 0) {
          // Process messages to create conversation context
          const chronologicalMessages = [...previousMessages].reverse();
          
          // Format as conversation context
          conversationContext = chronologicalMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          
          // Limit to the most recent messages to avoid context length issues
          if (conversationContext.length > MAX_CONTEXT_MESSAGES) {
            conversationContext = conversationContext.slice(-MAX_CONTEXT_MESSAGES);
          }
          
          console.log(`Added ${conversationContext.length} previous messages as context`);
        } else {
          console.log("No previous messages found in thread");
        }
      } catch (contextError) {
        console.error('Error processing thread context:', contextError);
      }
    }

    // Handle different types of queries
    const isDateQuery = isDirectDateQuery(message);
    const isAnalysisQuery = isJournalAnalysisQuery(message);
    
    // Check if this is a direct date query
    if (isDateQuery) {
      console.log("Processing as date information query");
      return await handleDateInfoQuery(message, conversationContext, apiKey, corsHeaders);
    }
    
    // Generate embedding for the message
    console.log("Generating embedding for message");
    const queryEmbedding = await generateEmbedding(message, apiKey);
    console.log("Embedding generated successfully");

    // Search for relevant entries with proper temporal filtering
    console.log("Searching for relevant entries");
    
    // Use different search function based on whether we have a time range
    let entries = [];
    
    // Log the exact search parameters for debugging
    console.log("Search parameters:", {
      userId,
      timeRange: processedTimeRange, 
      isMonthQuery,
      monthName,
      queryType: isMonthQuery && monthName ? "month-specific" : processedTimeRange ? "time-filtered" : "standard"
    });
    
    if (isMonthQuery && monthName) {
      // Extract year if present in the query, otherwise use current year
      const yearMatch = message.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      
      console.log(`Using month-specific search for ${monthName} ${year}`);
      entries = await searchEntriesByMonth(supabase, userId, queryEmbedding, monthName, year);
    } else if (processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate)) {
      console.log(`Using time-filtered search with range: ${JSON.stringify(processedTimeRange)}`);
      entries = await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, processedTimeRange);
      
      // Log the returned entries dates for debugging
      if (entries && entries.length > 0) {
        console.log("Entry dates found in time-filtered search:", 
          entries.map(entry => ({id: entry.id, date: new Date(entry.created_at).toISOString()}))
        );
      }
    } else {
      console.log("Using standard vector search without time filtering");
      entries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
    }
    
    console.log(`Found ${entries.length} relevant entries`);

    // Check if we found any entries for the requested time period
    if ((processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate) || (isMonthQuery && monthName)) && entries.length === 0) {
      console.log("No entries found for the specified time range");
      
      let noEntriesMessage = "Sorry, it looks like you don't have any journal entries for the time period you're asking about.";
      
      // Make the message more specific if we know it's a month query
      if (isMonthQuery && monthName) {
        const yearMatch = message.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        noEntriesMessage = `Sorry, it looks like you don't have any journal entries for ${monthName} ${year}.`;
      }
      
      // Return a friendly message indicating no entries were found
      return new Response(
        JSON.stringify({ 
          data: noEntriesMessage,
          noEntriesForTimeRange: true,
          timeRangeDebug: {
            timeRange: processedTimeRange
          }
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // For emotion analysis queries, augment with emotion data
    if (message.toLowerCase().includes('emotion') || message.toLowerCase().includes('feeling')) {
      try {
        const emotionData = await analyzeEmotions(supabase, userId, processedTimeRange);
        console.log("Emotion data retrieved:", emotionData);
        // Augment response with emotion data
      } catch (emotionError) {
        console.error("Error analyzing emotions:", emotionError);
      }
    }

    // Generate the final response
    const responseContent = await generateResponse(
      entries, 
      message, 
      conversationContext, 
      apiKey
    );

    console.log("Response generated successfully");

    // Return the response
    return new Response(
      JSON.stringify({ 
        data: responseContent,
        processingComplete: true,
        references: entries.map(entry => ({
          id: entry.id,
          date: entry.created_at,
          snippet: entry.content?.substring(0, 150) + (entry.content?.length > 150 ? "..." : ""),
          similarity: entry.similarity
        }))
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processingComplete: true
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// Handle queries specifically about dates
async function handleDateInfoQuery(
  message: string,
  conversationContext: any[],
  apiKey: string,
  corsHeaders: Record<string, string>
) {
  // Generate a response for date-related queries
  const dateInfoResponse = "I can help with that! The current week is..."; // This would be generated by OpenAI
  
  return new Response(
    JSON.stringify({ 
      data: dateInfoResponse,
      processingComplete: true
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}
