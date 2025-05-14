import { supabase } from "@/integrations/supabase/client";
import { createFallbackQueryPlan, convertGptPlanToQueryPlan } from "./chat/queryPlannerService";
import { getUserTimezoneOffset } from "./chat";
import { toast } from "@/hooks/use-toast";
import { ChatMessage } from "@/types/chat";

// Helper function to store user queries in the user_queries table using an edge function instead
const logUserQuery = async (
  userId: string,
  queryText: string,
  threadId: string | null,
  messageId?: string
): Promise<void> => {
  try {
    // Get user's timezone offset
    const timezoneOffset = getUserTimezoneOffset();
    
    // Use an edge function to log the query instead of direct table access
    await supabase.functions.invoke('ensure-chat-persistence', {
      body: {
        userId,
        queryText,
        threadId,
        messageId,
        timezoneOffset
      }
    });
  } catch (error) {
    console.error("Failed to log user query:", error);
  }
};

// Helper function to get recent thread messages for context
const getRecentThreadMessages = async (
  threadId: string | null,
  limit: number = 10
): Promise<any[]> => {
  if (!threadId) return [];
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('content, sender, role, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error("Error fetching thread messages:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in getRecentThreadMessages:", error);
    return [];
  }
};

export const processChatMessage = async (
  message: string, 
  userId: string, 
  queryTypes: any, 
  threadId: string | null = null,
  enableDiagnostics: boolean = false,
  parameters: Record<string, any> = {}
): Promise<ChatMessage> => {
  console.log("Processing chat message:", message.substring(0, 30) + "...");
  console.log("Parameters:", parameters);
  
  try {
    // Get user's timezone offset for accurate time-based queries
    const timezoneOffset = getUserTimezoneOffset();
    console.log(`User timezone offset: ${timezoneOffset} minutes`);
    
    // Log the user query to the user_queries table
    // We'll pass the message ID once we get it from the chat_messages table
    await logUserQuery(userId, message, threadId);
    
    // Get recent messages from the thread for context
    const recentMessages = await getRecentThreadMessages(threadId, 10);
    console.log(`Got ${recentMessages.length} recent messages for context`);
    
    // Step 1: Use smart-query-planner to classify and plan the query
    console.log("Calling smart-query-planner for query analysis and planning");
    const { data: plannerData, error: plannerError } = await supabase.functions.invoke(
      'smart-query-planner',
      {
        body: {
          message,
          userId,
          threadId,
          timezoneOffset,
          conversationContext: recentMessages.reverse() // Reverse to get chronological order
        }
      }
    );
    
    if (plannerError) {
      console.error("Error from smart-query-planner:", plannerError);
      // Fall back to local query planning
      console.log("Falling back to local query planning");
      const queryPlan = createFallbackQueryPlan(message);
      console.log("Generated fallback query plan:", queryPlan);
      
      // Continue with the local query plan
      return await processWithQueryPlan(message, userId, queryTypes, threadId, queryPlan, enableDiagnostics, timezoneOffset);
    }
    
    console.log("Received response from smart-query-planner:", plannerData);
    
    // Check if clarification is needed
    if (plannerData.needsClarification && plannerData.clarificationQuestions) {
      console.log("Query needs clarification, returning interactive message");
      return {
        id: `clarification-${Date.now()}`,
        thread_id: threadId || '',
        role: "assistant",
        sender: "assistant",
        content: "I'd like to understand the scope of your question better. Are you looking for insights from:",
        created_at: new Date().toISOString(),
        isInteractive: true,
        interactiveOptions: plannerData.clarificationQuestions
      };
    }
    
    // Handle direct responses for non-journal-specific queries
    if (plannerData.queryType !== 'journal_specific' && plannerData.directResponse) {
      console.log(`Returning direct response for ${plannerData.queryType} query`);
      return {
        id: `direct-response-${Date.now()}`,
        thread_id: threadId || '',
        role: "assistant",
        sender: "assistant",
        content: plannerData.directResponse,
        created_at: new Date().toISOString()
      };
    }
    
    // Convert GPT plan to our internal format
    const queryPlan = convertGptPlanToQueryPlan(plannerData.plan);
    console.log("Generated query plan:", queryPlan);
    
    // If useHistoricalData parameter is set, remove date filters
    if (parameters.useHistoricalData === true && queryPlan.filters.dateRange) {
      console.log("Removing date filters to search all historical data");
      delete queryPlan.filters.dateRange;
    }
    
    // Process with the query plan
    return await processWithQueryPlan(message, userId, queryTypes, threadId, queryPlan, enableDiagnostics, timezoneOffset);
  } catch (error: any) {
    console.error("Error processing chat message:", error);
    return {
      id: `error-${Date.now()}`,
      thread_id: threadId || '',
      role: "error",
      sender: "error",
      content: `I encountered an unexpected error. Please try again or rephrase your question. Technical details: ${error.message}`,
      created_at: new Date().toISOString()
    };
  }
};

// Extracted function to process a message with a query plan
async function processWithQueryPlan(
  message: string, 
  userId: string, 
  queryTypes: any, 
  threadId: string | null,
  queryPlan: any,
  enableDiagnostics: boolean,
  timezoneOffset: number
): Promise<ChatMessage> {
  try {
    // Use fixed parameters for vector search - let the retriever handle the filtering
    const matchThreshold = 0.5;
    const matchCount = queryPlan.matchCount || 10;
    
    console.log(`Vector search parameters: threshold=${matchThreshold}, count=${matchCount}`);
    
    // Extract time range if this is a temporal query and ensure it's not undefined
    let timeRange = queryPlan.timeRange || null;
    if (!timeRange && queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion)) {
      timeRange = queryTypes.timeRange || null;
      console.log("Temporal query detected, using time range:", timeRange);
    }
    
    // Safely check properties before passing them
    const isEmotionQuery = queryTypes && queryTypes.isEmotionFocused ? true : false;
    const isWhyEmotionQuery = queryTypes && queryTypes.isWhyQuestion && queryTypes.isEmotionFocused ? true : false;
    const isTimePatternQuery = queryTypes && queryTypes.isTimePatternQuery ? true : false;
    const isTemporalQuery = queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion) ? true : false;
    const requiresTimeAnalysis = queryTypes && queryTypes.requiresTimeAnalysis ? true : false;
    
    // Check if query is segmented based on the plan
    const isSegmented = queryPlan.isSegmented || false;
    
    // Initialize diagnostics
    let diagnostics = enableDiagnostics ? {
      steps: [],
      references: [],
      similarityScores: [],
      queryAnalysis: null
    } : undefined;
    
    // Add initial step
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Query Analysis", 
        status: "success", 
        details: `Query identified as ${isSegmented ? 'complex/segmented' : 'simple'}`
      });
    }
    
    // If query is segmented according to the plan, use the segmentation approach
    if (isSegmented && queryPlan.subqueries && queryPlan.subqueries.length > 0) {
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Query Segmentation",
          status: "success",
          details: `Query segmented into ${queryPlan.subqueries.length} subqueries`
        });
      }
      
      // Process each segment
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Segment Processing",
          status: "loading",
          details: `Processing ${queryPlan.subqueries.length} query segments`
        });
      }
      
      const segmentResults = [];
      
      for (let i = 0; i < queryPlan.subqueries.length; i++) {
        const segment = queryPlan.subqueries[i];
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: `Segment ${i+1}`,
            status: "loading",
            details: `Processing: "${segment}"`
          });
        }
        
        // Call the chat-with-rag function for each segment
        const { data: segmentData, error: segmentError } = await supabase.functions.invoke('chat-with-rag', {
          body: {
            message: segment,
            userId,
            queryTypes: queryTypes || {},
            threadId, // Pass threadId for context
            includeDiagnostics: false,
            queryPlan, // Pass the overall query plan
            timezoneOffset, // Pass timezone offset
            vectorSearch: {
              matchThreshold,
              matchCount
            },
            isEmotionQuery,
            isWhyEmotionQuery,
            isTimePatternQuery,
            isTemporalQuery,
            requiresTimeAnalysis,
            timeRange
          }
        });
        
        if (segmentError) {
          console.error(`Error processing segment ${i+1}:`, segmentError);
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: `Segment ${i+1}`,
              status: "error",
              details: `Failed: ${segmentError.message}`
            });
          }
          continue;
        }
        
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: `Segment ${i+1}`,
            status: "success",
            details: `Completed processing`
          });
        }
        
        segmentResults.push({
          segment,
          response: segmentData.response,
          references: segmentData.references
        });
        
        // Collect references for all segments
        if (enableDiagnostics && segmentData.references) {
          diagnostics.references = [...diagnostics.references, ...segmentData.references];
        }
      }
      
      if (segmentResults.length === 0) {
        throw new Error("Failed to process any query segments");
      }
      
      // If we only have one segment result, use it directly
      if (segmentResults.length === 1) {
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Response Generation",
            status: "success",
            details: "Using single segment response directly"
          });
        }
        
        return {
          id: `response-${Date.now()}`,
          thread_id: threadId || '',
          role: "assistant",
          sender: "assistant",
          content: segmentResults[0].response,
          references: segmentResults[0].references,
          diagnostics,
          created_at: new Date().toISOString()
        };
      }
      
      // Combine the results from all segments
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Response Combination",
          status: "loading",
          details: `Combining results from ${segmentResults.length} segments`
        });
      }
      
      const { data: combinedData, error: combineError } = await supabase.functions.invoke('combine-segment-responses', {
        body: {
          originalQuery: message,
          segmentResults,
          userId,
          threadId, // Pass threadId for context
          timezoneOffset // Pass timezone offset
        }
      });
      
      if (combineError) {
        console.error("Error combining segment responses:", combineError);
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Response Combination",
            status: "error",
            details: `Failed: ${combineError.message}`
          });
        }
        
        // Fallback: Use the first segment result
        return {
          id: `response-${Date.now()}`,
          thread_id: threadId || '',
          role: "assistant",
          sender: "assistant",
          content: segmentResults[0].response + "\n\n(Note: There was an error combining all parts of your question. This is a partial answer.)",
          references: segmentResults[0].references,
          diagnostics,
          created_at: new Date().toISOString()
        };
      }
      
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Response Combination",
          status: "success",
          details: "Successfully combined segment responses"
        });
      }
      
      // Compile all unique references from all segments
      const allReferences = [];
      const referenceIds = new Set();
      
      segmentResults.forEach(result => {
        if (result.references && Array.isArray(result.references)) {
          result.references.forEach(ref => {
            if (!referenceIds.has(ref.id)) {
              referenceIds.add(ref.id);
              allReferences.push(ref);
            }
          });
        }
      });
      
      return {
        id: `response-${Date.now()}`,
        thread_id: threadId || '',
        role: "assistant",
        sender: "assistant",
        content: combinedData.response,
        references: allReferences,
        diagnostics,
        created_at: new Date().toISOString()
      };
    }
    
    // Standard processing for non-segmented queries
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Knowledge Base Search",
        status: "loading",
        details: "Retrieving relevant journal entries"
      });
    }
    
    // Call the Supabase Edge Function with the query plan
    const { data, error } = await supabase.functions.invoke('chat-with-rag', {
      body: {
        message,
        userId,
        queryTypes: queryTypes || {},
        queryPlan, // Pass the query plan to the edge function
        threadId, // Ensure threadId is passed for maintaining conversational context
        includeDiagnostics: enableDiagnostics,
        timezoneOffset, // Pass timezone offset
        vectorSearch: {
          matchThreshold: 0.5,
          matchCount: queryPlan.matchCount || 10
        },
        isEmotionQuery: queryTypes && queryTypes.isEmotionFocused ? true : false,
        isWhyEmotionQuery: queryTypes && queryTypes.isWhyQuestion && queryTypes.isEmotionFocused ? true : false,
        isTimePatternQuery: queryTypes && queryTypes.isTimePatternQuery ? true : false,
        isTemporalQuery: queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion) ? true : false,
        requiresTimeAnalysis: queryTypes && queryTypes.requiresTimeAnalysis ? true : false,
        timeRange: queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion) ? queryTypes.timeRange || null : null
      }
    });

    if (error) {
      console.error("Edge function error:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        thread_id: threadId || '',
        role: "error",
        sender: "error",
        content: `I'm having trouble processing your request. Technical details: ${error.message}`,
        created_at: new Date().toISOString()
      };
      
      if (enableDiagnostics) {
        errorMessage.diagnostics = { 
          steps: [{ name: "Edge Function Error", status: "error", details: error.message }]
        };
      }
      
      return errorMessage;
    }

    if (!data) {
      console.error("No data returned from edge function");
      const noDataMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        thread_id: threadId || '',
        role: "error",
        sender: "error",
        content: "I'm having trouble retrieving a response. Please try again in a moment.",
        created_at: new Date().toISOString()
      };
      
      if (enableDiagnostics) {
        noDataMessage.diagnostics = { 
          steps: [{ name: "No Data Returned", status: "error", details: "Empty response from edge function" }]
        };
      }
      
      return noDataMessage;
    }

    // Handle error responses that come with status 200
    if (data.error) {
      console.error("Error in data:", data.error);
      const dataErrorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        thread_id: threadId || '',
        role: "error",
        sender: "error",
        content: data.response || `There was an issue retrieving information: ${data.error}`,
        created_at: new Date().toISOString()
      };
      
      if (enableDiagnostics) {
        dataErrorMessage.diagnostics = data.diagnostics || {
          steps: [{ name: "Processing Error", status: "error", details: data.error }]
        };
      }
      
      return dataErrorMessage;
    }

    // Prepare the response
    const chatResponse: ChatMessage = {
      id: `response-${Date.now()}`,
      thread_id: threadId || '',
      content: data.response,
      sender: "assistant",
      role: "assistant",
      created_at: new Date().toISOString()
    };

    // Include references if available
    if (data.references && data.references.length > 0) {
      chatResponse.reference_entries = data.references;
      chatResponse.references = data.references; // For backward compatibility
    }

    // Include analysis if available
    if (data.analysis) {
      chatResponse.analysis_data = data.analysis;
      chatResponse.analysis = data.analysis; // For backward compatibility
      if (data.analysis.type === 'quantitative_emotion' || 
          data.analysis.type === 'top_emotions' ||
          data.analysis.type === 'time_patterns' ||
          data.analysis.type === 'combined_analysis') {
        chatResponse.has_numeric_result = true;
        chatResponse.hasNumericResult = true; // For backward compatibility
      }
    }
    
    // Include diagnostics if enabled
    if (enableDiagnostics && data.diagnostics) {
      chatResponse.diagnostics = data.diagnostics;
    }

    return chatResponse;
  } catch (error: any) {
    console.error("Error in processWithQueryPlan:", error);
    return {
      id: `error-${Date.now()}`,
      thread_id: threadId || '',
      role: "error",
      sender: "error",
      content: `I encountered an unexpected error. Please try again or rephrase your question. Technical details: ${error.message}`,
      created_at: new Date().toISOString()
    };
  }
}
