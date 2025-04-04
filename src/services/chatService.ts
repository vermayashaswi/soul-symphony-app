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
    
    // Execute the appropriate search strategy
    switch (searchStrategy) {
      case 'temporal_vector_search':
        // For "when" questions - vector search with temporal focus
        console.log("Using temporal vector search strategy");
        queryResponse = await handleTemporalVectorSearch(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'frequency_analysis':
        // For "how often" questions - analyze frequency patterns
        console.log("Using frequency analysis strategy");
        queryResponse = await handleFrequencyAnalysis(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'emotion_aggregation':
        // For emotion aggregation questions (top emotions)
        console.log("Using emotion aggregation strategy");
        queryResponse = await handleEmotionAggregation(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'emotion_causal_analysis':
        // For emotion "why" questions
        console.log("Using emotion causal analysis strategy");
        queryResponse = await handleEmotionCausalAnalysis(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'relationship_analysis':
        // For relationship-related queries
        console.log("Using relationship analysis strategy");
        queryResponse = await handleRelationshipAnalysis(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'contextual_advice':
        // For improvement/advice questions
        console.log("Using contextual advice strategy");
        queryResponse = await handleContextualAdvice(message, userId, messageQueryTypes, threadId);
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
              requiresExplanation: messageQueryTypes.needsContext || message.toLowerCase().includes('why')
            }
          });
          
          if (error) {
            console.error("Error using smart-query-planner:", error);
          } else if (data && !data.fallbackToRag) {
            console.log("Successfully used smart query planner");
            queryResponse = data;
          } else {
            console.log("Smart query planner couldn't handle the query, falling back to RAG");
            queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
          }
        } catch (smartQueryError) {
          console.error("Exception in smart-query-planner:", smartQueryError);
          queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
        }
        break;
        
      case 'vector_search':
      default:
        // Default case - standard vector search
        console.log("Using standard vector search strategy");
        queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
        break;
      case 'correlation_analysis':
        // For pattern questions about emotional behaviors
        console.log("Using correlation analysis strategy");
        queryResponse = await handleCorrelationAnalysis(message, userId, messageQueryTypes, threadId);
        break;
    }
    
    if (!queryResponse) {
      console.log("No response from primary strategy, falling back to RAG");
      queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
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

// Handler for correlation analysis (pattern questions)
async function handleCorrelationAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing correlation analysis for pattern question", {
    emotions: queryTypes.targetEmotions,
    behaviors: queryTypes.targetBehaviors,
    entities: queryTypes.relatedEntities
  });
  
  try {
    // First, get relevant entries with specified emotions
    const { data: emotionEntries, error: entriesError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at, emotions, entities')
      .eq('user_id', userId)
      .filter('emotions', 'not.is.null');
    
    if (entriesError) {
      console.error("Error getting journal entries:", entriesError);
      throw entriesError;
    }
    
    if (!emotionEntries || emotionEntries.length < 3) {
      console.log("Not enough journal entries for correlation analysis");
      return {
        response: "I don't have enough journal entries with emotion data to analyze this pattern. Continue journaling regularly to build up enough data for this kind of analysis.",
        diagnostics: {
          type: "correlation",
          insufficientData: true,
          entriesFound: emotionEntries?.length || 0
        }
      };
    }
    
    // Target emotions from the query
    const targetEmotions = queryTypes.targetEmotions || [];
    // Target behaviors from the query
    const targetBehaviors = queryTypes.targetBehaviors || [];
    // Related entities (like "partner") from the query
    const relationshipEntity = queryTypes.relatedEntities?.[0] || null;
    
    // Filter entries with target emotions
    const entriesWithTargetEmotions = emotionEntries.filter(entry => {
      if (!entry.emotions) return false;
      return targetEmotions.some(emotion => {
        const emotionScore = entry.emotions[emotion];
        return emotionScore !== undefined && emotionScore > 0.3; // Consider emotion present if score > 0.3
      });
    });
    
    console.log(`Found ${entriesWithTargetEmotions.length} entries with target emotions`);
    
    // From those entries, look for mentions of the behavior
    const correlatedEntries = entriesWithTargetEmotions.filter(entry => {
      if (!entry["refined text"]) return false;
      const text = entry["refined text"].toLowerCase();
      return targetBehaviors.some(behavior => text.includes(behavior.toLowerCase()));
    });
    
    console.log(`Found ${correlatedEntries.length} entries with both emotions and behaviors`);
    
    // If relationshipEntity is specified, further filter
    const entityEntries = relationshipEntity ? 
      correlatedEntries.filter(entry => {
        if (!entry["refined text"]) return false;
        return entry["refined text"].toLowerCase().includes(relationshipEntity.toLowerCase());
      }) : 
      correlatedEntries;
    
    console.log(`Found ${entityEntries.length} entries with emotions, behaviors, and specific relationship entity`);
    
    // Calculate correlation statistics
    const correlationRate = entriesWithTargetEmotions.length > 0 ? 
      entityEntries.length / entriesWithTargetEmotions.length : 0;
    
    // Prepare evidence context for the LLM
    const evidenceContext = entityEntries.map((entry, i) => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const emotionStr = Object.entries(entry.emotions || {})
        .filter(([_, score]) => score > 0.3)
        .map(([emotion, score]) => `${emotion}: ${Math.round(Number(score) * 100)}%`)
        .join(", ");
      
      return `Entry ${i+1} (${date}):\nText: ${entry["refined text"]}\nEmotions: ${emotionStr}`;
    }).join("\n\n");
    
    // Determine if there's a significant correlation
    const correlationFound = correlationRate > 0.2; // 20% threshold for significance
    
    // If no correlation or not enough evidence, use standard RAG approach as fallback
    if (!correlationFound || entityEntries.length < 2) {
      console.log("No significant correlation found, falling back to standard RAG");
      return handleVectorSearch(message, userId, queryTypes, threadId);
    }
    
    // For significant correlations, use the edge function with specialized prompting
    const { data, error } = await supabase.functions.invoke('chat-with-rag', {
      body: { 
        message,
        userId,
        threadId,
        includeDiagnostics: true,
        isCorrelationQuery: true,
        correlationData: {
          emotions: targetEmotions,
          behaviors: targetBehaviors,
          entity: relationshipEntity,
          correlationRate: correlationRate,
          matchingEntryCount: entityEntries.length,
          totalEmotionEntryCount: entriesWithTargetEmotions.length,
          evidence: evidenceContext
        }
      }
    });
    
    if (error) {
      console.error("Error in correlation analysis with edge function:", error);
      throw error;
    }
    
    // Add correlation data to the diagnostics
    if (data) {
      data.analysis = {
        type: "correlation",
        correlationRate: correlationRate,
        matchingEntryCount: entityEntries.length,
        totalEmotionEntryCount: entriesWithTargetEmotions.length,
        targetEmotions,
        targetBehaviors,
        relationshipEntity
      };
    }
    
    return data;
  } catch (error) {
    console.error("Error in correlation analysis:", error);
    return handleVectorSearch(message, userId, queryTypes, threadId);
  }
}
