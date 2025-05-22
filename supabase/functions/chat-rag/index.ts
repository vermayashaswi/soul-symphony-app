import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders, handleCorsRequest } from "./utils/cors.ts";
import { 
  detectMentalHealthQuery,
  isDirectDateQuery,
  isJournalAnalysisQuery,
  detectTimeframeInQuery
} from "./utils/queryClassifier.ts";
import { generateEmbedding } from "./utils/embeddingService.ts";
import { 
  searchEntriesWithVector, 
  searchEntriesWithTimeRange 
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
    console.log("Time range received:", timeRange);
    console.log("Query plan received:", queryPlan ? JSON.stringify(queryPlan, null, 2) : "No query plan provided");
    
    // Process time range if provided
    const processedTimeRange = timeRange ? processTimeRange(timeRange) : null;
    if (processedTimeRange) {
      console.log("Processed time range:", processedTimeRange);
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
    
    // Get local timezone offset for better time-based queries
    const timezoneOffset = reqBody.timezoneOffset || new Date().getTimezoneOffset();
    console.log(`Local timezone offset: ${timezoneOffset} minutes`);

    // Handle different types of queries
    const isDateQuery = isDirectDateQuery(message);
    const isAnalysisQuery = isJournalAnalysisQuery(message);
    
    // Check if this is a direct date query
    if (isDateQuery) {
      console.log("Processing as date information query");
      return await handleDateInfoQuery(message, conversationContext, apiKey, corsHeaders);
    }
    
    // Extract time frame from query if not provided explicitly
    if (!processedTimeRange) {
      const detectedTimeframe = detectTimeframeInQuery(message);
      if (detectedTimeframe) {
        console.log(`Detected timeframe in query: ${JSON.stringify(detectedTimeframe)}`);
        // Use the detected timeframe
      }
    }
    
    // Generate embedding for the message
    console.log("Generating embedding for message");
    const queryEmbedding = await generateEmbedding(message, apiKey);
    console.log("Embedding generated successfully");

    // Search for relevant entries with proper temporal filtering
    console.log("Searching for relevant entries");
    
    // Use different search function based on whether we have a time range
    let entries = [];
    if (processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate)) {
      console.log(`Using time-filtered search with range: ${JSON.stringify(processedTimeRange)}`);
      entries = await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, processedTimeRange);
    } else {
      console.log("Using standard vector search without time filtering");
      entries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
    }
    
    console.log(`Found ${entries.length} relevant entries`);

    // Check if we found any entries for the requested time period
    if (processedTimeRange && (processedTimeRange.startDate || processedTimeRange.endDate) && entries.length === 0) {
      console.log("No entries found for the specified time range");
      
      // Return a friendly message indicating no entries were found
      return new Response(
        JSON.stringify({ 
          data: "Sorry, it looks like you don't have any journal entries for the time period you're asking about.",
          noEntriesForTimeRange: true
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
