
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
    const messageQueryTypes = queryTypes || analyzeQueryTypes(message);
    console.log("Query analysis results:", messageQueryTypes);
    
    let queryResponse: any = null;
    let retryAttempted = false;
    let inProgressContent = "I'm thinking about your question..."; 
    
    const searchStrategy = messageQueryTypes.searchStrategy || 'vector_search';
    console.log("Selected search strategy:", searchStrategy);
    
    switch (searchStrategy) {
      case 'temporal_vector_search':
        console.log("Using temporal vector search strategy");
        queryResponse = await handleTemporalVectorSearch(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'frequency_analysis':
        console.log("Using frequency analysis strategy");
        queryResponse = await handleFrequencyAnalysis(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'emotion_aggregation':
        console.log("Using emotion aggregation strategy");
        queryResponse = await handleEmotionAggregation(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'emotion_causal_analysis':
        console.log("Using emotion causal analysis strategy");
        queryResponse = await handleEmotionCausalAnalysis(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'relationship_analysis':
        console.log("Using relationship analysis strategy");
        queryResponse = await handleRelationshipAnalysis(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'contextual_advice':
        console.log("Using contextual advice strategy");
        queryResponse = await handleContextualAdvice(message, userId, messageQueryTypes, threadId);
        break;
        
      case 'data_aggregation':
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
        console.log("Using standard vector search strategy");
        queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
        break;
      case 'correlation_analysis':
        console.log("Using correlation analysis strategy");
        queryResponse = await handleCorrelationAnalysis(message, userId, messageQueryTypes, threadId);
        break;
    }
    
    if (!queryResponse) {
      console.log("No response from primary strategy, falling back to RAG");
      queryResponse = await handleVectorSearch(message, userId, messageQueryTypes, threadId);
    }
    
    console.log("Response received:", queryResponse ? "yes" : "no");
    
    const responseContent = queryResponse.response || "I couldn't find an answer to your question.";
    const chatResponse: ChatMessage = {
      role: 'assistant',
      content: responseContent,
    };
    
    if (queryResponse.diagnostics && queryResponse.diagnostics.relevantEntries) {
      chatResponse.references = queryResponse.diagnostics.relevantEntries;
    }
    
    if (queryResponse.diagnostics) {
      chatResponse.analysis = queryResponse.diagnostics;
      chatResponse.diagnostics = queryResponse.diagnostics;
    }
    
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

async function handleTemporalVectorSearch(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing temporal vector search for 'when' question");
  
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: { 
      message, 
      userId,
      threadId,
      includeDiagnostics: true,
      isTemporalQuery: true,
      needsTimeRetrieval: true,
      isComplexQuery: false,
      requiresEntryDates: true
    }
  });
  
  if (error) {
    console.error("Error in temporal vector search:", error);
    throw error;
  }
  
  return data;
}

async function handleFrequencyAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing frequency analysis for 'how often' question");
  
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

async function handleEmotionAggregation(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing emotion aggregation for top emotions question");
  
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
  
  const isWhyQuestion = queryTypes.isWhyQuestion || message.toLowerCase().includes('why');
  
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

async function handleEmotionCausalAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing emotion causal analysis");
  
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

async function handleRelationshipAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing relationship analysis");
  
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

async function handleContextualAdvice(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing contextual advice strategy");
  
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

async function handleCorrelationAnalysis(message: string, userId: string, queryTypes: Record<string, any>, threadId?: string) {
  console.log("Executing correlation analysis for pattern question", {
    emotions: queryTypes.targetEmotions,
    behaviors: queryTypes.targetBehaviors,
    entities: queryTypes.relatedEntities
  });
  
  try {
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
    
    const targetEmotions = queryTypes.targetEmotions || [];
    const targetBehaviors = queryTypes.targetBehaviors || [];
    const relationshipEntity = queryTypes.relatedEntities?.[0] || null;
    
    const entriesWithTargetEmotions = emotionEntries.filter(entry => {
      if (!entry.emotions) return false;
      return targetEmotions.some(emotion => {
        const emotionScore = entry.emotions[emotion];
        return emotionScore !== undefined && emotionScore > 0.3;
      });
    });
    
    const correlatedEntries = entriesWithTargetEmotions.filter(entry => {
      if (!entry["refined text"]) return false;
      const text = entry["refined text"].toLowerCase();
      return targetBehaviors.some(behavior => text.includes(behavior.toLowerCase()));
    });
    
    const entityEntries = relationshipEntity ? 
      correlatedEntries.filter(entry => {
        if (!entry["refined text"]) return false;
        return entry["refined text"].toLowerCase().includes(relationshipEntity.toLowerCase());
      }) : 
      correlatedEntries;
    
    const correlationRate = entriesWithTargetEmotions.length > 0 ? 
      entityEntries.length / entriesWithTargetEmotions.length : 0;
    
    const evidenceContext = entityEntries.map((entry, i) => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const emotionStr = Object.entries(entry.emotions || {})
        .filter(([_, score]) => score > 0.3)
        .map(([emotion, score]) => `${emotion}: ${Math.round(Number(score) * 100)}%`)
        .join(", ");
      
      return `Entry ${i+1} (${date}):\nText: ${entry["refined text"]}\nEmotions: ${emotionStr}`;
    }).join("\n\n");
    
    const correlationFound = correlationRate > 0.2;
    
    if (!correlationFound || entityEntries.length < 2) {
      console.log("No significant correlation found, falling back to standard RAG");
      return handleVectorSearch(message, userId, queryTypes, threadId);
    }
    
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
    // Fixed: Adding the missing threadId parameter to the function call
    return handleVectorSearch(message, userId, queryTypes, threadId);
  }
}
