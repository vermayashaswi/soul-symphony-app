
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
    return {
      role: 'error',
      content: "You must be logged in to use the chat feature.",
    };
  }

  try {
    console.log("Processing message:", message);
    // Use provided queryTypes or generate them
    const messageQueryTypes = queryTypes || analyzeQueryTypes(message);
    console.log("Query analysis results:", messageQueryTypes);
    
    let queryResponse: any = null;
    let retryAttempted = false;
    let inProgressContent = "I'm thinking about your question..."; 
    
    // First determine the search strategy based on query type
    const searchStrategy = messageQueryTypes.searchStrategy || 'vector_search';
    console.log("Selected search strategy:", searchStrategy);
    
    // Check if chunking should be used (default to true for better results)
    const preferChunks = messageQueryTypes.preferChunks !== false;
    console.log("Using chunked search:", preferChunks ? "yes" : "no");
    
    // Execute the appropriate search strategy
    switch (searchStrategy) {
      case 'temporal_vector_search':
        // For "when" questions - vector search with temporal focus
        console.log("Using temporal vector search strategy");
        queryResponse = await handleTemporalVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
        
      case 'frequency_analysis':
        // For "how often" questions - analyze frequency patterns
        console.log("Using frequency analysis strategy");
        queryResponse = await handleFrequencyAnalysis(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
        
      case 'emotion_aggregation':
        // For emotion aggregation questions (top emotions)
        console.log("Using emotion aggregation strategy");
        queryResponse = await handleEmotionAggregation(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
        
      case 'emotion_causal_analysis':
        // For emotion "why" questions
        console.log("Using emotion causal analysis strategy");
        queryResponse = await handleEmotionCausalAnalysis(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
        
      case 'relationship_analysis':
        // For relationship-related queries
        console.log("Using relationship analysis strategy");
        queryResponse = await handleRelationshipAnalysis(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
        
      case 'contextual_advice':
        // For improvement/advice questions
        console.log("Using contextual advice strategy");
        queryResponse = await handleContextualAdvice(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
        
      case 'data_aggregation':
        // For queries needing data aggregation
        console.log("Using data aggregation strategy");
        
        try {
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
            console.error("Error using smart-query-planner:", error);
          } else if (data && !data.fallbackToRag) {
            console.log("Successfully used smart query planner");
            queryResponse = data;
          } else {
            console.log("Smart query planner couldn't handle the query, falling back to RAG");
            queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
          }
        } catch (smartQueryError) {
          console.error("Exception in smart-query-planner:", smartQueryError);
          queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
        }
        break;
        
      case 'vector_search':
      default:
        // Default case - standard vector search
        console.log("Using standard vector search strategy");
        queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
        break;
    }
    
    if (!queryResponse) {
      console.log("No response from primary strategy, falling back to RAG");
      queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId, preferChunks);
    }
    
    console.log("Response received:", queryResponse ? "yes" : "no");
    
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
    console.error("Error processing chat message:", error);
    return {
      role: 'error',
      content: "I apologize, but I encountered an error processing your request. Please try again.",
    };
  }
}

// Handler for standard vector search
async function handleVectorSearch(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string, preferChunks: boolean = true) {
  const timeRange = queryTypes.timeRange && typeof queryTypes.timeRange === 'object' 
    ? {
        type: queryTypes.timeRange.type,
        startDate: queryTypes.timeRange.startDate,
        endDate: queryTypes.timeRange.endDate
      } 
    : null;
  
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
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
    console.error("Error in chat-with-rag:", error);
    throw error;
  }
  
  return data;
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
