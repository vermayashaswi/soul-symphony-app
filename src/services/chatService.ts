
import { supabase } from "@/integrations/supabase/client";
import { analyzeQueryTypes, segmentQuery } from "@/utils/chat/queryAnalyzer";

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
    
    // Step 1: Segment the query if it's complex
    let segments: string[] = [];
    let segmentResults: any[] = [];
    let finalResponse: any = null;
    
    try {
      segments = await segmentQuery(message, userId);
      console.log("Query segments:", segments);
    } catch (segmentError) {
      console.error("Error during query segmentation:", segmentError);
      // If segmentation fails, treat as a single query
      segments = [message];
    }
    
    // Step 2: Process each segment individually
    const multiSegment = segments.length > 1;
    
    if (multiSegment) {
      console.log("Processing multi-segment query with", segments.length, "segments");
      
      // Process each segment
      for (const segment of segments) {
        console.log("Processing segment:", segment);
        // Use provided queryTypes or generate them for this segment
        const segmentQueryTypes = analyzeQueryTypes(segment);
        
        // Determine the search strategy for this segment
        const searchStrategy = segmentQueryTypes.searchStrategy || 'vector_search';
        console.log("Segment search strategy:", searchStrategy);
        
        // Execute the appropriate search strategy for this segment
        let segmentResponse = null;
        try {
          switch (searchStrategy) {
            case 'temporal_vector_search':
              segmentResponse = await handleTemporalVectorSearch(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'time_pattern_analysis':
              segmentResponse = await handleTimePatternAnalysis(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'frequency_analysis':
              segmentResponse = await handleFrequencyAnalysis(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'emotion_aggregation':
              segmentResponse = await handleEmotionAggregation(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'emotion_causal_analysis':
              segmentResponse = await handleEmotionCausalAnalysis(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'relationship_analysis':
              segmentResponse = await handleRelationshipAnalysis(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'contextual_advice':
              segmentResponse = await handleContextualAdvice(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'data_aggregation':
              segmentResponse = await handleDataAggregation(segment, userId, segmentQueryTypes, threadId);
              break;
            case 'vector_search':
            default:
              segmentResponse = await handleVectorSearch(segment, userId, segmentQueryTypes, threadId);
              break;
          }
          
          // MODIFICATION: Add explicit fallback to vector search if the strategy fails
          if (!segmentResponse) {
            console.log(`Strategy ${searchStrategy} failed, falling back to vector search for segment: ${segment}`);
            segmentResponse = await handleVectorSearch(segment, userId, segmentQueryTypes, threadId);
          }
          
          if (segmentResponse) {
            segmentResults.push({
              segment,
              response: segmentResponse.response || "No answer found for this part of your question.",
              relevantEntries: segmentResponse.diagnostics?.relevantEntries || []
            });
          } else {
            segmentResults.push({
              segment,
              response: "No answer found for this part of your question.",
              relevantEntries: []
            });
          }
        } catch (segmentError) {
          console.error("Error processing segment:", segment, segmentError);
          
          // MODIFICATION: Added explicit fallback to vector search on error
          try {
            console.log("Error in primary strategy, falling back to vector search for segment:", segment);
            const fallbackResponse = await handleVectorSearch(segment, userId, segmentQueryTypes, threadId);
            
            if (fallbackResponse) {
              segmentResults.push({
                segment,
                response: fallbackResponse.response || "I found some relevant information, but couldn't fully answer this part of your question.",
                relevantEntries: fallbackResponse.diagnostics?.relevantEntries || []
              });
            } else {
              segmentResults.push({
                segment,
                response: "I encountered an error processing this part of your question.",
                error: segmentError.message
              });
            }
          } catch (fallbackError) {
            console.error("Fallback vector search also failed:", fallbackError);
            segmentResults.push({
              segment,
              response: "I encountered an error processing this part of your question.",
              error: segmentError.message
            });
          }
        }
      }
      
      // Step 3: Combine segment results for a final comprehensive answer
      finalResponse = await combineSegmentResults(message, segmentResults, userId, threadId);
      
    } else {
      // Single segment (or segmentation failed), process normally
      console.log("Processing single segment query");
      
      // Use provided queryTypes or generate them
      const messageQueryTypes = queryTypes || analyzeQueryTypes(message);
      console.log("Query analysis results:", messageQueryTypes);
      
      // Determine the search strategy based on query type
      const searchStrategy = messageQueryTypes.searchStrategy || 'vector_search';
      console.log("Selected search strategy:", searchStrategy);
      
      // Execute the appropriate search strategy
      try {
        switch (searchStrategy) {
          case 'temporal_vector_search':
            finalResponse = await handleTemporalVectorSearch(message, userId, messageQueryTypes, threadId);
            break;
          case 'time_pattern_analysis':
            finalResponse = await handleTimePatternAnalysis(message, userId, messageQueryTypes, threadId);
            break;
          case 'frequency_analysis':
            finalResponse = await handleFrequencyAnalysis(message, userId, messageQueryTypes, threadId);
            break;
          case 'emotion_aggregation':
            finalResponse = await handleEmotionAggregation(message, userId, messageQueryTypes, threadId);
            break;
          case 'emotion_causal_analysis':
            finalResponse = await handleEmotionCausalAnalysis(message, userId, messageQueryTypes, threadId);
            break;
          case 'relationship_analysis':
            finalResponse = await handleRelationshipAnalysis(message, userId, messageQueryTypes, threadId);
            break;
          case 'contextual_advice':
            finalResponse = await handleContextualAdvice(message, userId, messageQueryTypes, threadId);
            break;
          case 'data_aggregation':
            finalResponse = await handleDataAggregation(message, userId, messageQueryTypes, threadId);
            break;
          case 'vector_search':
          default:
            finalResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
            break;
        }
      } catch (strategyError) {
        console.error(`Error in ${searchStrategy} strategy:`, strategyError);
        // MODIFICATION: Added explicit try/catch with fallback to vector search
        console.log("Primary strategy failed, falling back to vector search");
        finalResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
      }
    }
    
    // MODIFICATION: Final safeguard fallback to RAG if all else fails
    if (!finalResponse) {
      console.log("No response from any strategy, using vector search as ultimate fallback");
      finalResponse = await handleVectorSearch(message, userId, queryTypes || {}, threadId);
    }
    
    console.log("Response received:", finalResponse ? "yes" : "no");
    
    // Construct final response
    const responseContent = finalResponse && finalResponse.response ? 
      finalResponse.response : "I couldn't find an answer to your question.";
      
    const chatResponse: ChatMessage = {
      role: 'assistant',
      content: responseContent,
    };
    
    // Add references if available
    if (finalResponse && finalResponse.diagnostics && finalResponse.diagnostics.relevantEntries) {
      chatResponse.references = finalResponse.diagnostics.relevantEntries;
    }
    
    // Add analysis data if available
    if (finalResponse && finalResponse.diagnostics) {
      chatResponse.analysis = finalResponse.diagnostics;
      chatResponse.diagnostics = finalResponse.diagnostics;
    }
    
    // Set flag if we have a numeric result
    if (finalResponse && finalResponse.hasNumericResult) {
      chatResponse.hasNumericResult = true;
    }
    
    return chatResponse;
  } catch (error) {
    console.error("Error processing chat message:", error);
    // MODIFICATION: Even in the main error handler, try vector search as last resort
    try {
      console.log("Critical error in processing, attempting ultimate vector search fallback");
      const fallbackResponse = await handleVectorSearch(message, userId, {}, threadId);
      if (fallbackResponse) {
        return {
          role: 'assistant',
          content: fallbackResponse.response || "I found some information, but encountered an issue processing your full request.",
          references: fallbackResponse.diagnostics?.relevantEntries,
          analysis: fallbackResponse.diagnostics,
          diagnostics: fallbackResponse.diagnostics,
        };
      }
    } catch (fallbackError) {
      console.error("Ultimate fallback also failed:", fallbackError);
    }
    
    return {
      role: 'error',
      content: "I apologize, but I encountered an error processing your request. Please try again.",
    };
  }
}

// New function to combine segment results into a comprehensive answer
async function combineSegmentResults(
  originalQuery: string, 
  segmentResults: Array<{segment: string, response: string, relevantEntries?: any[], error?: string}>,
  userId: string,
  threadId?: string
): Promise<any> {
  try {
    console.log("Combining results from", segmentResults.length, "segments");
    
    // Format segment results for GPT
    const formattedSegments = segmentResults.map((result, index) => {
      return `Segment ${index + 1}: "${result.segment}"\nAnswer: ${result.response}`;
    }).join("\n\n");
    
    // If there's only one segment with an error, return that error
    if (segmentResults.length === 1 && segmentResults[0].error) {
      return {
        response: `I encountered an error processing your question: ${segmentResults[0].error}`,
        diagnostics: { relevantEntries: segmentResults[0].relevantEntries || [] }
      };
    }
    
    // Use GPT to create a final comprehensive answer
    const { data, error } = await supabase.functions.invoke('combine-segment-responses', {
      body: { 
        originalQuery,
        segmentResults: segmentResults.map(result => ({
          segment: result.segment,
          response: result.response
        })),
        userId
      }
    });
    
    if (error) {
      console.error("Error combining segment responses:", error);
      // Fallback: concatenate all segment responses
      const fallbackResponse = segmentResults.map((result, i) => 
        `Part ${i+1}: ${result.response}`
      ).join("\n\n");
      
      return {
        response: fallbackResponse,
        diagnostics: {
          relevantEntries: segmentResults.flatMap(result => result.relevantEntries || [])
        }
      };
    }
    
    // Collect all relevant entries from all segments
    const allRelevantEntries = segmentResults.flatMap(result => result.relevantEntries || []);
    
    return {
      response: data.response,
      diagnostics: {
        relevantEntries: allRelevantEntries,
        segments: segmentResults.map(result => ({
          query: result.segment,
          response: result.response
        }))
      }
    };
    
  } catch (error) {
    console.error("Error combining segment results:", error);
    
    // Fallback: concatenate all segment responses
    const fallbackResponse = segmentResults.map((result, i) => 
      `Part ${i+1}: ${result.response}`
    ).join("\n\n");
    
    return {
      response: fallbackResponse,
      diagnostics: {
        relevantEntries: segmentResults.flatMap(result => result.relevantEntries || [])
      }
    };
  }
}

// Handler for data aggregation
async function handleDataAggregation(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
        requiresExplanation: queryTypes.needsContext || message.toLowerCase().includes('why')
      }
    });
    
    if (error) {
      console.error("Error using smart-query-planner:", error);
    } else if (data && !data.fallbackToRag) {
      console.log("Successfully used smart query planner");
      return data;
    } else {
      console.log("Smart query planner couldn't handle the query, falling back to RAG");
      return await handleVectorSearch(message, userId, queryTypes, threadId);
    }
  } catch (smartQueryError) {
    console.error("Exception in smart-query-planner:", smartQueryError);
    return await handleVectorSearch(message, userId, queryTypes, threadId);
  }
}

// Handler for standard vector search
async function handleVectorSearch(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
      requiresEmotionAnalysis: queryTypes.isEmotionFocused
    }
  });
  
  if (error) {
    console.error("Error in chat-with-rag:", error);
    throw error;
  }
  
  return data;
}

// Handler for temporal vector search (when questions)
async function handleTemporalVectorSearch(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
      requiresEntryDates: true // Specifically request entry dates
    }
  });
  
  if (error) {
    console.error("Error in temporal vector search:", error);
    throw error;
  }
  
  return data;
}

// NEW: Handler for time pattern analysis (time of day questions)
async function handleTimePatternAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing time pattern analysis for time-of-day question");
  
  // Extract emotion being asked about (e.g., "happy" in "When am I usually happy?")
  const emotionKeywords = extractEmotionKeywords(message);
  const timeRange = queryTypes.timeRange && typeof queryTypes.timeRange === 'object' 
    ? {
        type: queryTypes.timeRange.type,
        startDate: queryTypes.timeRange.startDate,
        endDate: queryTypes.timeRange.endDate
      } 
    : null;
    
  console.log("Analyzing time patterns for emotions:", emotionKeywords);
  
  try {
    // First try using smart-query-planner for SQL-based analysis
    const { data: plannerData, error: plannerError } = await supabase.functions.invoke('smart-query-planner', {
      body: { 
        message, 
        userId, 
        includeDiagnostics: true,
        enableQueryBreakdown: true,
        generateSqlQueries: true,
        analyzeTimeComponents: true,
        emotionKeywords,
        timeRange
      }
    });
    
    if (!plannerError && plannerData && !plannerData.fallbackToRag) {
      console.log("Successfully used smart query planner for time pattern analysis");
      return plannerData;
    }
    
    // If smart-query-planner fails or suggests fallback, use RAG with time analysis parameters
    const { data, error } = await supabase.functions.invoke('chat-with-rag', {
      body: { 
        message, 
        userId,
        threadId,
        includeDiagnostics: true,
        isTimePatternQuery: true, // FIX: changed from function call to boolean property
        requiresTimeAnalysis: true,
        analyzeHourPatterns: true,
        emotionKeywords,
        timeRange,
        requiresEntryDates: true
      }
    });
    
    if (error) {
      console.error("Error in time pattern analysis:", error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error("Error in time pattern analysis:", error);
    // Fall back to standard temporal search as a last resort
    return handleTemporalVectorSearch(message, userId, queryTypes, threadId);
  }
}

// Helper function to extract emotion keywords from a query
function extractEmotionKeywords(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  // Common emotion words to look for
  const emotionWords = [
    'happy', 'sad', 'angry', 'frustrated', 'excited', 'anxious', 'calm', 
    'stressed', 'relaxed', 'motivated', 'tired', 'energetic', 'joyful', 
    'depressed', 'content', 'optimistic', 'pessimistic', 'hopeful'
  ];
  
  // Find any emotion words in the message
  const foundEmotions = emotionWords.filter(emotion => lowerMessage.includes(emotion));
  
  // If no specific emotions found, include general emotional state keywords
  if (foundEmotions.length === 0) {
    // Check for general emotional state references
    if (lowerMessage.includes('feel good') || lowerMessage.includes('positive')) {
      foundEmotions.push('positive');
    }
    if (lowerMessage.includes('feel bad') || lowerMessage.includes('negative')) {
      foundEmotions.push('negative');
    }
    if (foundEmotions.length === 0) {
      // Default to searching for all emotions if none specified
      foundEmotions.push('emotion');
    }
  }
  
  return foundEmotions;
}

// Handler for frequency analysis (how often questions)
async function handleFrequencyAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
        isFrequencyQuery: true
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
      requiresPatternAnalysis: true
    }
  });
  
  if (error) {
    console.error("Error in frequency analysis vector search:", error);
    throw error;
  }
  
  return data;
}

// Handler for emotion aggregation (top emotions)
async function handleEmotionAggregation(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
      topEmotionsCount: 3
    }
  });
  
  if (error) {
    console.error("Error in emotion aggregation:", error);
    throw error;
  }
  
  return data;
}

// Handler for emotion causal analysis (why emotion questions)
async function handleEmotionCausalAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
      requiresCausalAnalysis: true
    }
  });
  
  if (error) {
    console.error("Error in emotion causal analysis:", error);
    throw error;
  }
  
  return data;
}

// Handler for relationship analysis
async function handleRelationshipAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
      themeKeywords: ['partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend', 'relationship', 'marriage']
    }
  });
  
  if (error) {
    console.error("Error in relationship analysis:", error);
    throw error;
  }
  
  return data;
}

// Handler for contextual advice (improvement questions)
async function handleContextualAdvice(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
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
      themeKeywords: ['partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend', 'relationship', 'marriage']
    }
  });
  
  if (error) {
    console.error("Error in contextual advice strategy:", error);
    throw error;
  }
  
  return data;
}

// Handler for correlation analysis
async function handleCorrelationAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing correlation analysis");
  
  try {
    // Try using the smart query planner for correlation analysis
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: { 
        message, 
        userId, 
        includeDiagnostics: true,
        enableQueryBreakdown: true,
        generateSqlQueries: true,
        isCorrelationQuery: true
      }
    });
    
    if (error) {
      console.error("Error using smart-query-planner for correlation:", error);
    } else if (data && !data.fallbackToRag) {
      console.log("Successfully used smart query planner for correlation analysis");
      return data;
    }
  } catch (smartQueryError) {
    console.error("Exception in smart-query-planner for correlation:", smartQueryError);
    return await handleVectorSearch(message, userId, queryTypes, threadId);
  }
  
  // Fall back to vector search with correlation indicators
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      isCorrelationQuery: true,
      requiresPatternAnalysis: true
    }
  });
  
  if (error) {
    console.error("Error in correlation analysis vector search:", error);
    throw error;
  }
  
  return data;
}
