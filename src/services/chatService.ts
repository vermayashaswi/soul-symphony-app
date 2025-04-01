
import { supabase } from "@/integrations/supabase/client";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  references?: any[];
  hasNumericResult?: boolean;
  analysis?: any;
  diagnostics?: any;
}

export async function processChatMessage(
  message: string, 
  userId: string | undefined,
  queryTypes?: Record<string, any>,
  threadId?: string
): Promise<ChatMessage> {
  if (!userId) {
    console.error("processChatMessage: No userId provided");
    return {
      role: 'error',
      content: "You must be logged in to use the chat feature.",
    };
  }

  try {
    console.log("[Chat Service] Processing message:", message);
    console.log("[Chat Service] User ID:", userId);
    console.log("[Chat Service] Thread ID:", threadId);
    
    // Use provided queryTypes or generate them
    const messageQueryTypes = queryTypes || analyzeQueryTypes(message);
    console.log("[Chat Service] Query analysis results:", JSON.stringify(messageQueryTypes));
    
    let queryResponse: any = null;
    let retryAttempted = false;
    let inProgressContent = "I'm thinking about your question..."; 
    
    // First determine the search strategy based on query type
    const searchStrategy = messageQueryTypes.searchStrategy || 'vector_search';
    console.log("[Chat Service] Selected search strategy:", searchStrategy);
    
    // Check if chunking should be used (default to true for better results)
    const preferChunks = messageQueryTypes.preferChunks !== false;
    console.log("[Chat Service] Using chunked search:", preferChunks ? "yes" : "no");
    
    // Execute the appropriate search strategy
    try {
      // Simple function to check if the Supabase Edge Function is available
      const checkEdgeFunctionAvailability = async (functionName: string) => {
        try {
          console.log(`[Chat Service] Checking if edge function '${functionName}' is available...`);
          const { data, error } = await supabase.functions.invoke(functionName, {
            body: { ping: true }
          });
          
          if (error) {
            console.error(`[Chat Service] Edge function '${functionName}' check failed:`, error);
            return false;
          }
          return true;
        } catch (e) {
          console.error(`[Chat Service] Edge function '${functionName}' availability check exception:`, e);
          return false;
        }
      };
      
      switch (searchStrategy) {
        case 'temporal_vector_search':
          // For "when" questions - vector search with temporal focus
          console.log("[Chat Service] Using temporal vector search strategy");
          queryResponse = await handleTemporalVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
          
        case 'frequency_analysis':
          // For "how often" questions - analyze frequency patterns
          console.log("[Chat Service] Using frequency analysis strategy");
          queryResponse = await handleFrequencyAnalysis(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
          
        case 'emotion_aggregation':
          // For emotion aggregation questions (top emotions)
          console.log("[Chat Service] Using emotion aggregation strategy");
          queryResponse = await handleEmotionAggregation(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
          
        case 'emotion_causal_analysis':
          // For emotion "why" questions
          console.log("[Chat Service] Using emotion causal analysis strategy");
          queryResponse = await handleEmotionCausalAnalysis(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
          
        case 'relationship_analysis':
          // For relationship-related queries
          console.log("[Chat Service] Using relationship analysis strategy");
          queryResponse = await handleRelationshipAnalysis(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
          
        case 'contextual_advice':
          // For improvement/advice questions
          console.log("[Chat Service] Using contextual advice strategy");
          queryResponse = await handleContextualAdvice(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
          
        case 'data_aggregation':
          // For queries needing data aggregation
          console.log("[Chat Service] Using data aggregation strategy");
          
          // First check if smart-query-planner is available
          const isSmartQueryPlannerAvailable = await checkEdgeFunctionAvailability('smart-query-planner');
          
          if (isSmartQueryPlannerAvailable) {
            try {
              console.log("[Chat Service] Invoking smart-query-planner");
              const { data, error } = await supabase.functions.invoke('smart-query-planner', {
                body: { 
                  message, 
                  userId, 
                  includeDiagnostics: true,
                  enableQueryBreakdown: true,
                  generateSqlQueries: true,
                  analyzeComponents: true,
                  allowRetry: true,
                  requiresExplanation: messageQueryTypes.needsContext || message.toLowerCase().includes('why'),
                  preferChunks: preferChunks
                }
              });
              
              if (error) {
                console.error("[Chat Service] Error using smart-query-planner:", error);
                console.log("[Chat Service] Falling back to standard vector search");
                queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
              } else if (data && !data.fallbackToRag) {
                console.log("[Chat Service] Successfully used smart query planner");
                queryResponse = data;
              } else {
                console.log("[Chat Service] Smart query planner couldn't handle the query, falling back to RAG");
                queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
              }
            } catch (smartQueryError) {
              console.error("[Chat Service] Exception in smart-query-planner:", smartQueryError);
              console.log("[Chat Service] Falling back to vector search after smart-query-planner exception");
              queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
            }
          } else {
            console.log("[Chat Service] smart-query-planner not available, using vector search");
            queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
          }
          break;
          
        case 'vector_search':
        default:
          // Default case - standard vector search
          console.log("[Chat Service] Using standard vector search strategy");
          queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
          break;
      }
    } catch (strategyError) {
      console.error(`[Chat Service] Error in strategy ${searchStrategy}:`, strategyError);
      console.log("[Chat Service] Falling back to standard vector search after strategy error");
      try {
        queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
      } catch (fallbackError) {
        console.error("[Chat Service] Even fallback vector search failed:", fallbackError);
        throw fallbackError; // Rethrow to be caught by the outer try-catch
      }
    }
    
    if (!queryResponse) {
      console.log("[Chat Service] No response from any strategy, falling back to basic response");
      return {
        role: 'assistant',
        content: "I don't have enough information to answer that. Could you ask in a different way or provide more context?",
      };
    }
    
    console.log("[Chat Service] Response received:", queryResponse ? "yes" : "no");
    if (queryResponse.error) {
      console.error("[Chat Service] Error in query response:", queryResponse.error);
    }
    
    // Construct final response
    const responseContent = queryResponse.response || "I couldn't find an answer to your question.";
    const chatResponse: ChatMessage = {
      role: 'assistant',
      content: responseContent,
    };
    
    // Add references if available
    if (queryResponse.diagnostics && queryResponse.diagnostics.relevantEntries) {
      chatResponse.references = queryResponse.diagnostics.relevantEntries;
    }
    
    // Add analysis data if available
    if (queryResponse.diagnostics) {
      chatResponse.analysis = queryResponse.diagnostics;
      chatResponse.diagnostics = queryResponse.diagnostics;
    }
    
    // Set flag if we have a numeric result
    if (queryResponse.hasNumericResult) {
      chatResponse.hasNumericResult = true;
    }
    
    return chatResponse;
  } catch (error) {
    console.error("[Chat Service] Error processing chat message:", error);
    return {
      role: 'error',
      content: "I apologize, but I encountered an error processing your request. Please try again.",
    };
  }
}

// Handler for standard vector search
async function handleVectorSearch(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  try {
    const timeRange = queryTypes.timeRange && typeof queryTypes.timeRange === 'object' 
      ? {
          type: queryTypes.timeRange.type,
          startDate: queryTypes.timeRange.startDate,
          endDate: queryTypes.timeRange.endDate
        } 
      : null;
    
    console.log("[Chat Service] Invoking chat-with-rag function");
    
    // First check if the chat-with-rag function is available (might be called chat-rag in some environments)
    let functionName = 'chat-with-rag';
    let { data: testData, error: testError } = await supabase.functions.invoke(functionName, {
      body: { ping: true }
    });
    
    if (testError) {
      console.log("[Chat Service] chat-with-rag not found, trying chat-rag");
      functionName = 'chat-rag';
      
      const { data: test2, error: test2Error } = await supabase.functions.invoke(functionName, {
        body: { ping: true }
      });
      
      if (test2Error) {
        console.error("[Chat Service] Neither chat-with-rag nor chat-rag could be found:", test2Error);
        throw new Error("Chat function not available");
      }
    }
    
    console.log(`[Chat Service] Using function: ${functionName}`);
    
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { 
        message, 
        userId,
        threadId,
        includeDiagnostics: true,
        timeRange,
        isComplexQuery: queryTypes.isComplexQuery || message.toLowerCase().includes('why'),
        requiresEmotionAnalysis: queryTypes.isEmotionFocused,
        preferChunks: preferChunks
      }
    });
    
    if (error) {
      console.error(`[Chat Service] Error in ${functionName}:`, error);
      throw error;
    }
    
    if (!data) {
      console.error(`[Chat Service] No data returned from ${functionName}`);
      throw new Error("No data returned from edge function");
    }
    
    if (data.error) {
      console.error(`[Chat Service] Error in ${functionName} response:`, data.error);
    }
    
    return data;
  } catch (error) {
    console.error("[Chat Service] Error in handleVectorSearch:", error);
    throw error;
  }
}

// Handler for temporal vector search (when questions)
async function handleTemporalVectorSearch(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  console.log("Executing temporal vector search for 'when' question");
  
  // Include temporal parameters explicitly
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      isTemporalQuery: true,
      needsTimeRetrieval: true,
      isComplexQuery: false, // Usually "when" questions are straightforward
      requiresEntryDates: true, // Specifically request entry dates
      preferChunks: preferChunks
    }
  });
  
  if (error) {
    console.error("Error in temporal vector search:", error);
    throw error;
  }
  
  return data;
}

// Handler for frequency analysis (how often questions)
async function handleFrequencyAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  console.log("Executing frequency analysis for 'how often' question");
  
  // Try smart-query-planner first as it might be able to do frequency counts
  try {
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: { 
        message, 
        userId, 
        includeDiagnostics: true,
        enableQueryBreakdown: true,
        generateSqlQueries: true,
        isFrequencyQuery: true,
        preferChunks: preferChunks
      }
    });
    
    if (error) {
      console.error("Error using smart-query-planner for frequency:", error);
    } else if (data && !data.fallbackToRag) {
      console.log("Successfully used smart query planner for frequency analysis");
      return data;
    }
  } catch (smartQueryError) {
    console.error("Exception in smart-query-planner for frequency:", smartQueryError);
  }
  
  // Fall back to vector search with frequency indicators
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      isFrequencyQuery: true,
      requiresPatternAnalysis: true,
      preferChunks: preferChunks
    }
  });
  
  if (error) {
    console.error("Error in frequency analysis vector search:", error);
    throw error;
  }
  
  return data;
}

// Handler for emotion aggregation (top emotions)
async function handleEmotionAggregation(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  console.log("Executing emotion aggregation for top emotions question");
  
  // Extract time period from query or use default
  const timeRange = queryTypes.timeRange && typeof queryTypes.timeRange === 'object' 
    ? {
        type: queryTypes.timeRange.type,
        startDate: queryTypes.timeRange.startDate,
        endDate: queryTypes.timeRange.endDate
      } 
    : {
        type: 'month',
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
        endDate: new Date().toISOString()
      };
  
  // Determine if this is a "why" question as well
  const isWhyQuestion = queryTypes.isWhyQuestion || message.toLowerCase().includes('why');
  
  // Call the edge function with emotion aggregation parameters
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      timeRange,
      isEmotionQuery: true,
      isWhyEmotionQuery: isWhyQuestion,
      topEmotionsCount: 3,
      preferChunks: preferChunks
    }
  });
  
  if (error) {
    console.error("Error in emotion aggregation:", error);
    throw error;
  }
  
  return data;
}

// Handler for emotion causal analysis (why emotion questions)
async function handleEmotionCausalAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  console.log("Executing emotion causal analysis");
  
  // Extract time period from query or use default
  const timeRange = queryTypes.timeRange && typeof queryTypes.timeRange === 'object' 
    ? {
        type: queryTypes.timeRange.type,
        startDate: queryTypes.timeRange.startDate,
        endDate: queryTypes.timeRange.endDate
      } 
    : null;
  
  // Use the new edge function approach with emotion causal parameters
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      timeRange,
      isEmotionQuery: true,
      isWhyEmotionQuery: true,
      requiresCausalAnalysis: true,
      preferChunks: preferChunks
    }
  });
  
  if (error) {
    console.error("Error in emotion causal analysis:", error);
    throw error;
  }
  
  return data;
}

// Handler for relationship analysis
async function handleRelationshipAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  console.log("Executing relationship analysis");
  
  // Extract time period from query or use default
  const timeRange = queryTypes.timeRange && typeof queryTypes.timeRange === 'object' 
    ? {
        type: queryTypes.timeRange.type,
        startDate: queryTypes.timeRange.startDate,
        endDate: queryTypes.timeRange.endDate
      } 
    : null;
  
  // Use theme filtering and vector search
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      timeRange,
      isRelationshipQuery: true,
      requiresThemeFiltering: true,
      themeKeywords: ['partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend', 'relationship', 'marriage'],
      preferChunks: preferChunks
    }
  });
  
  if (error) {
    console.error("Error in relationship analysis:", error);
    throw error;
  }
  
  return data;
}

// Handler for contextual advice (improvement questions)
async function handleContextualAdvice(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  console.log("Executing contextual advice strategy");
  
  // For improvement questions, we need both context and a solution-oriented approach
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      isAdviceQuery: true,
      requiresThemeFiltering: true,
      requiresSolutionFocus: true,
      themeKeywords: ['partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend', 'relationship', 'marriage'],
      preferChunks: preferChunks
    }
  });
  
  if (error) {
    console.error("Error in contextual advice strategy:", error);
    throw error;
  }
  
  return data;
}
