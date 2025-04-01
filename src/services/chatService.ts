import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  analysis?: any;
  references?: any[];
  diagnostics?: any;
  hasNumericResult?: boolean;
}

export const processChatMessage = async (
  userMessage: string, 
  userId: string,
  queryTypes: Record<string, boolean>,
  threadId?: string | null
): Promise<ChatMessage> => {
  try {
    console.log("Processing chat message with enhanced query breakdown approach");
    console.log("Query types detected:", JSON.stringify(queryTypes));
    console.log("Thread ID:", threadId || "new thread");
    
    // Check if this is a query that specifically needs GPT-based breakdown
    const needsGptBreakdown = 
      queryTypes.isComplexQuery || 
      queryTypes.needsDataAggregation ||
      queryTypes.hasTopEmotionsPattern || 
      (queryTypes.isEmotionFocused && queryTypes.isQuantitative) ||
      (queryTypes.isEmotionFocused && queryTypes.needsContext) ||
      (queryTypes.isEmotionFocused && queryTypes.hasWhyEmotionsPattern);
    
    if (needsGptBreakdown) {
      console.log("Query identified as requiring GPT-based breakdown and analysis");
      return await processWithQueryBreakdown(userMessage, userId, queryTypes, threadId);
    }
    
    // For simpler queries, try with the smart-query-planner first
    try {
      console.log("Simple query detected: Using standard query planner");
      
      const { data, error } = await supabase.functions.invoke('smart-query-planner', {
        body: {
          message: userMessage,
          userId,
          includeDiagnostics: true,
          enableQueryBreakdown: false
        }
      });
      
      if (error) {
        console.error("Error from smart-query-planner:", error);
        throw error;
      }
      
      // If the planner indicates we should fall back to RAG, do so
      if (data.fallbackToRag || data.response.includes("couldn't find any")) {
        console.log("Query planner suggests fallback to RAG");
        return await processWithQueryBreakdown(userMessage, userId, queryTypes, threadId);
      }
      
      return { 
        role: 'assistant', 
        content: data.response,
        diagnostics: data.diagnostics,
        hasNumericResult: data.hasNumericResult 
      };
      
    } catch (plannerError) {
      console.error("Error in query planner:", plannerError);
      return await processWithQueryBreakdown(userMessage, userId, queryTypes, threadId);
    }
  } catch (error) {
    console.error("Error processing chat message:", error);
    throw error;
  }
};

// New function for processing queries with GPT-based breakdown
async function processWithQueryBreakdown(
  userMessage: string,
  userId: string,
  queryTypes: Record<string, boolean>,
  threadId?: string | null
): Promise<ChatMessage> {
  console.log("Processing query with GPT-based breakdown approach");
  
  try {
    // Call the enhanced query-breakdown edge function
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message: userMessage,
        userId,
        includeDiagnostics: true,
        enableQueryBreakdown: true,   // Enable detailed query breakdown
        generateSqlQueries: true,     // Generate SQL queries where applicable
        analyzeComponents: true       // Analyze query components separately
      }
    });
    
    if (error) {
      console.error("Error from query breakdown:", error);
      // Fall back to comprehensive RAG pipeline if breakdown fails
      return await useComprehensiveRagPipeline(userMessage, userId, queryTypes, threadId);
    }
    
    // If the breakdown produced valid results, return them
    if (data && data.success && !data.fallbackToRag) {
      console.log("Query breakdown successful, using structured response");
      return { 
        role: 'assistant', 
        content: data.response,
        analysis: data.analysis,
        references: data.references,
        diagnostics: data.diagnostics,
        hasNumericResult: data.hasNumericResult
      };
    }
    
    // Otherwise, fall back to comprehensive RAG
    console.log("Query breakdown incomplete, falling back to comprehensive RAG");
    return await useComprehensiveRagPipeline(userMessage, userId, queryTypes, threadId);
  } catch (breakdownError) {
    console.error("Error in query breakdown process:", breakdownError);
    return await useComprehensiveRagPipeline(userMessage, userId, queryTypes, threadId);
  }
}

// Helper function for the comprehensive RAG pipeline (used as fallback)
async function useComprehensiveRagPipeline(
  userMessage: string, 
  userId: string, 
  queryTypes: Record<string, boolean>, 
  threadId?: string | null
): Promise<ChatMessage> {
  console.log("Using comprehensive RAG pipeline");
  
  const { data, error } = await supabase.functions.invoke('chat-with-rag', {
    body: {
      message: userMessage,
      userId,
      threadId: threadId,
      isNewThread: !threadId,
      includeDiagnostics: true,
      enableQueryBreakdown: true,        // Enable query breakdown
      analyzeSeparateComponents: true,   // Analyze components separately
      queryTypes: {
        ...queryTypes,
        // Enhanced query types for better classification
        isHappinessQuery: /happiness|happy|joy|joyful|content|satisfaction/i.test(userMessage),
        isTopEmotionsQuery: /top\s+\d*\s+(positive|negative|intense|strong|happy|sad)?\s*(emotion|emotions|feeling|feelings)/i.test(userMessage) || 
                         /what\s+(were|are)\s+(my|the)\s+(top|main|primary|dominant)\s+emotions/i.test(userMessage),
        isEmotionRankingQuery: /rank\s+(my|the)\s+(emotion|emotions|feeling|feelings)/i.test(userMessage),
        isEmotionChangeQuery: /how\s+(have|has|did)\s+(my|the)\s+(emotion|emotions|feeling|feelings)\s+(change|evolve|develop|progress)/i.test(userMessage),
        isQuantitativeTimeQuery: queryTypes.isQuantitative && queryTypes.isTemporal,
        requiresEmotionAggregation: queryTypes.isEmotionFocused && queryTypes.isQuantitative,
        forceRagPipeline: true,
        isComplexQuery: userMessage.split(' ').length > 10 && 
          (userMessage.includes('and') || userMessage.includes('or') || 
           userMessage.includes('but') || userMessage.includes('while'))
      }
    }
  });
  
  if (error) {
    console.error("Error in comprehensive RAG pipeline:", error);
    throw error;
  }
  
  console.log("RAG pipeline produced response with references:", data.references ? data.references.length : 0);
  
  return { 
    role: 'assistant', 
    content: data.response, 
    analysis: data.analysis,
    references: data.references,
    diagnostics: data.diagnostics,
    hasNumericResult: data.hasNumericResult
  };
}
