
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
    console.log("Processing chat message with enhanced RAG pipeline");
    console.log("Query types detected:", JSON.stringify(queryTypes));
    console.log("Thread ID:", threadId || "new thread");
    
    // Step 1: First try with smart-query-planner for structured queries
    try {
      console.log("Step 1: Attempting smart query planning for structured analysis");
      
      const { data, error } = await supabase.functions.invoke('smart-query-planner', {
        body: {
          message: userMessage,
          userId,
          includeDiagnostics: true
        }
      });
      
      if (error) {
        console.error("Error from smart-query-planner:", error);
        throw error;
      }
      
      console.log("Smart query planner response:", data);
      
      // Step 2: Enhanced detection for query types that need special handling
      const isQuantitativeEmotionQuery = 
        /how (happy|sad|angry|anxious|stressed|content|joyful|depressed)/i.test(userMessage) &&
        /(score|rate|level|out of|percentage|quantify)/i.test(userMessage);
      
      const isHappinessScoreQuery = 
        /(how much|what is|rate) (my|the) happiness/i.test(userMessage) ||
        /happiness (score|rating|level)/i.test(userMessage) ||
        /how happy (am i|was i|have i been)/i.test(userMessage);
      
      const isTopEmotionsQuery = 
        /top\s+\d+\s+(positive|negative|intense|strong|happy|sad)\s+(emotion|emotions|feeling|feelings)/i.test(userMessage) ||
        /(most|least)\s+(common|frequent|intense|strong)\s+(emotion|emotions|feeling|feelings)/i.test(userMessage);
      
      const isEmotionRankingQuery =
        /rank\s+(my|the)\s+(emotion|emotions|feeling|feelings)/i.test(userMessage) ||
        /how\s+(did|do)\s+(i|my)\s+(emotion|emotions|feeling|feelings)\s+(rank|compare)/i.test(userMessage);
      
      const isEmotionChangeQuery =
        /how\s+(have|has|did)\s+(my|the)\s+(emotion|emotions|feeling|feelings)\s+(change|evolve|develop|progress)/i.test(userMessage);
      
      // Step 3: Decide if we need to fallback to RAG based on multiple conditions
      if ((data.response.includes("couldn't find any") && data.fallbackToRag) || 
          (queryTypes.isQuantitative && !data.hasNumericResult) ||
          isQuantitativeEmotionQuery ||
          isHappinessScoreQuery ||  // Added explicit check for happiness score queries
          isTopEmotionsQuery ||
          isEmotionRankingQuery ||
          isEmotionChangeQuery ||
          queryTypes.needsDataAggregation) {
        console.log("Planning indicated fallback to comprehensive RAG pipeline...");
        throw new Error("Trigger RAG fallback");
      }
      
      return { 
        role: 'assistant', 
        content: data.response,
        diagnostics: data.diagnostics,
        hasNumericResult: data.hasNumericResult
      };
      
    } catch (smartQueryError) {
      console.error("Smart query planner failed, activating full RAG pipeline:", smartQueryError);
      
      // Step 4: Multi-strategy RAG pipeline
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message: userMessage,
          userId,
          threadId: threadId,
          isNewThread: !threadId,
          includeDiagnostics: true,
          queryTypes: {
            ...queryTypes,
            // Enhance query types with more detailed classification
            isHappinessQuery: /happiness|happy|joy|joyful|content|satisfaction/i.test(userMessage),
            isTopEmotionsQuery: /top\s+\d+\s+(positive|negative|intense|strong|happy|sad)\s+(emotion|emotions|feeling|feelings)/i.test(userMessage),
            isEmotionRankingQuery: /rank\s+(my|the)\s+(emotion|emotions|feeling|feelings)/i.test(userMessage),
            isEmotionChangeQuery: /how\s+(have|has|did)\s+(my|the)\s+(emotion|emotions|feeling|feelings)\s+(change|evolve|develop|progress)/i.test(userMessage),
            isQuantitativeTimeQuery: queryTypes.isQuantitative && queryTypes.isTemporal,
            requiresEmotionAggregation: queryTypes.isEmotionFocused && queryTypes.isQuantitative
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
  } catch (error) {
    console.error("Error processing chat message:", error);
    throw error;
  }
};
