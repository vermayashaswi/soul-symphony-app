import { supabase } from "@/integrations/supabase/client";

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
    
    // Use fixed parameters for vector search - let the retriever handle the filtering
    const matchThreshold = 0.5;
    const matchCount = 10; // Fixed count, let the retriever determine the actual number
    
    console.log(`Vector search parameters: threshold=${matchThreshold}, count=${matchCount}`);
    
    // Extract time range if this is a temporal query and ensure it's not undefined
    let timeRange = null;
    if (queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion)) {
      timeRange = queryTypes.timeRange || null;
      console.log("Temporal query detected, using time range:", timeRange);
    }
    
    // Safely check properties before passing them
    const isEmotionQuery = queryTypes && queryTypes.isEmotionFocused ? true : false;
    const isWhyEmotionQuery = queryTypes && queryTypes.isWhyQuestion && queryTypes.isEmotionFocused ? true : false;
    const isTimePatternQuery = queryTypes && queryTypes.isTimePatternQuery ? true : false;
    const isTemporalQuery = queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion) ? true : false;
    const requiresTimeAnalysis = queryTypes && queryTypes.requiresTimeAnalysis ? true : false;
    
    // Check if the query is complex and needs segmentation
    const isComplexQuery = queryTypes && queryTypes.needsDataAggregation ? true : 
                          message.includes(" and ") || message.includes("also") || 
                          message.split("?").length > 2 || 
                          message.length > 100;
    
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
        details: `Query identified as ${isComplexQuery ? 'complex' : 'simple'}`
      });
    }
    
    // If it's a complex query, use segmentation approach
    if (isComplexQuery) {
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Query Segmentation",
          status: "loading",
          details: "Breaking down complex query into simpler segments"
        });
      }
      
      try {
        // Call the segment-complex-query edge function
        const { data: segmentationData, error: segmentationError } = await supabase.functions.invoke('segment-complex-query', {
          body: {
            query: message,
            userId,
            timeRange,
            vectorSearch: {
              matchThreshold,
              matchCount
            }
          }
        });
        
        if (segmentationError) {
          console.error("Error in query segmentation:", segmentationError);
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Query Segmentation",
              status: "error",
              details: `Failed to segment query: ${segmentationError.message}`
            });
          }
          throw new Error(`Segmentation failed: ${segmentationError.message}`);
        }
        
        // Parse segmented queries from the response
        let segmentedQueries;
        try {
          segmentedQueries = JSON.parse(segmentationData);
          if (!Array.isArray(segmentedQueries)) {
            throw new Error("Expected array of query segments");
          }
        } catch (parseError) {
          console.error("Failed to parse segmented queries:", parseError);
          segmentedQueries = [message]; // Fallback to original message
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Query Segmentation",
              status: "warning",
              details: `Failed to parse segments, using original query: ${parseError.message}`
            });
          }
        }
        
        if (enableDiagnostics && Array.isArray(segmentedQueries)) {
          diagnostics.steps.push({
            name: "Query Segmentation",
            status: "success",
            details: `Split into ${segmentedQueries.length} segments: ${segmentedQueries.map(q => `"${q}"`).join(", ")}`
          });
        }
        
        // Process each segment
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Segment Processing",
            status: "loading",
            details: `Processing ${segmentedQueries.length} query segments`
          });
        }
        
        const segmentResults = [];
        
        for (let i = 0; i < segmentedQueries.length; i++) {
          const segment = segmentedQueries[i];
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
              threadId,
              includeDiagnostics: false,
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
            userId
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
      } catch (error) {
        console.error("Error in segmented query processing:", error);
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Segmented Processing",
            status: "error",
            details: `Error: ${error.message}`
          });
          diagnostics.steps.push({
            name: "Fallback",
            status: "loading",
            details: "Falling back to standard processing"
          });
        }
        // Fall through to standard processing if segmentation fails
      }
    }
    
    // Standard processing (for simple queries or if segmentation failed)
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Knowledge Base Search",
        status: "loading",
        details: "Retrieving relevant journal entries"
      });
    }
    
    // Call the Supabase Edge Function with fixed vector search parameters
    const { data, error } = await supabase.functions.invoke('chat-with-rag', {
      body: {
        message,
        userId,
        queryTypes: queryTypes || {},
        threadId,
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
    console.error("Error in processChatMessage:", error);
    return {
      role: "error",
      content: `I'm having trouble with the chat service. ${error instanceof Error ? error.message : "Please try again later."}`,
      diagnostics: enableDiagnostics ? { 
        steps: [{ name: "Chat Service Error", status: "error", details: error instanceof Error ? error.message : String(error) }]
      } : undefined
    };
  }
};
