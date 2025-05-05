import { supabase } from "@/integrations/supabase/client";
import { createFallbackQueryPlan, convertGptPlanToQueryPlan } from "./chat/queryPlannerService";

export type ChatMessage = {
  role: string;
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
};

// Helper function to store user queries in the user_queries table using an edge function instead
const logUserQuery = async (
  userId: string,
  queryText: string,
  threadId: string | null,
  messageId?: string
): Promise<void> => {
  try {
    // Use an edge function to log the query instead of direct table access
    await supabase.functions.invoke('ensure-chat-persistence', {
      body: {
        userId,
        queryText,
        threadId,
        messageId
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
  enableDiagnostics: boolean = false
): Promise<ChatMessage> => {
  console.log("Processing chat message:", message.substring(0, 30) + "...");
  
  try {
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
      return await processWithQueryPlan(message, userId, queryTypes, threadId, queryPlan, enableDiagnostics);
    }
    
    console.log("Received response from smart-query-planner:", plannerData);
    
    // Handle direct responses for non-journal-specific queries
    if (plannerData.queryType !== 'journal_specific' && plannerData.directResponse) {
      console.log(`Returning direct response for ${plannerData.queryType} query`);
      return {
        role: "assistant",
        content: plannerData.directResponse
      };
    }
    
    // Convert GPT plan to our internal format
    const queryPlan = convertGptPlanToQueryPlan(plannerData.plan);
    console.log("Generated query plan:", queryPlan);
    
    // Process with the query plan
    return await processWithQueryPlan(message, userId, queryTypes, threadId, queryPlan, enableDiagnostics);
  } catch (error) {
    console.error("Error processing chat message:", error);
    return {
      role: "error",
      content: `I encountered an unexpected error. Please try again or rephrase your question. Technical details: ${error.message}`
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
  enableDiagnostics: boolean
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
          role: "assistant",
          content: segmentResults[0].response,
          references: segmentResults[0].references,
          diagnostics
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
          threadId // Pass threadId for context
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
          role: "assistant",
          content: segmentResults[0].response + "\n\n(Note: There was an error combining all parts of your question. This is a partial answer.)",
          references: segmentResults[0].references,
          diagnostics
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
        role: "assistant",
        content: combinedData.response,
        references: allReferences,
        diagnostics
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

    if (error) {
      console.error("Edge function error:", error);
      return {
        role: "error",
        content: `I'm having trouble processing your request. Technical details: ${error.message}`,
        diagnostics: enableDiagnostics ? { 
          steps: [{ name: "Edge Function Error", status: "error", details: error.message }]
        } : undefined
      };
    }

    if (!data) {
      console.error("No data returned from edge function");
      return {
        role: "error",
        content: "I'm having trouble retrieving a response. Please try again in a moment.",
        diagnostics: enableDiagnostics ? { 
          steps: [{ name: "No Data Returned", status: "error", details: "Empty response from edge function" }]
        } : undefined
      };
    }

    // Handle error responses that come with status 200
    if (data.error) {
      console.error("Error in data:", data.error);
      return {
        role: "error",
        content: data.response || `There was an issue retrieving information: ${data.error}`,
        diagnostics: enableDiagnostics ? data.diagnostics || {
          steps: [{ name: "Processing Error", status: "error", details: data.error }]
        } : undefined
      };
    }

    // Prepare the response
    const chatResponse: ChatMessage = {
      role: "assistant",
      content: data.response
    };

    // Include references if available
    if (data.references && data.references.length > 0) {
      chatResponse.references = data.references;
    }

    // Include analysis if available
    if (data.analysis) {
      chatResponse.analysis = data.analysis;
      if (data.analysis.type === 'quantitative_emotion' || 
          data.analysis.type === 'top_emotions' ||
          data.analysis.type === 'time_patterns' ||
          data.analysis.type === 'combined_analysis') {
        chatResponse.hasNumericResult = true;
      }
    }
    
    // Include diagnostics if enabled
    if (enableDiagnostics && data.diagnostics) {
      chatResponse.diagnostics = data.diagnostics;
    }

    return chatResponse;
  } catch (error) {
    console.error("Error in processWithQueryPlan:", error);
    return {
      role: "error",
      content: `I encountered an unexpected error. Please try again or rephrase your question. Technical details: ${error.message}`
    };
  }
}
