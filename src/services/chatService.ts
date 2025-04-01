
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  analysis?: any;
  references?: any[];
  diagnostics?: any;
}

export const processChatMessage = async (
  userMessage: string, 
  userId: string,
  queryTypes: Record<string, boolean>
): Promise<ChatMessage> => {
  try {
    console.log("Using smart-query-planner for message:", userMessage);
    
    try {
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
      
      // Enhanced detection for quantitative queries
      const isQuantitativeEmotionQuery = 
        /how (happy|sad|angry|anxious|stressed|content|joyful|depressed)/i.test(userMessage) &&
        /(score|rate|level|out of|percentage|quantify)/i.test(userMessage);
      
      // Check if the query planner indicates we should fallback to RAG
      if ((data.response.includes("couldn't find any") && data.fallbackToRag) || 
          (queryTypes.isQuantitative && !data.hasNumericResult) ||
          isQuantitativeEmotionQuery) {
        console.log("Planning indicated fallback to RAG may be useful, trying chat-with-rag...");
        throw new Error("Trigger RAG fallback");
      }
      
      return { 
        role: 'assistant', 
        content: data.response,
        diagnostics: data.diagnostics
      };
      
    } catch (smartQueryError) {
      console.error("Smart query planner failed, falling back to chat-with-rag:", smartQueryError);
      
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message: userMessage,
          userId,
          threadId: null,
          isNewThread: true,
          includeDiagnostics: true,
          queryTypes
        }
      });
      
      if (error) throw error;
      
      return { 
        role: 'assistant', 
        content: data.response, 
        analysis: data.analysis,
        references: data.references,
        diagnostics: data.diagnostics
      };
    }
  } catch (error) {
    console.error("Error processing chat message:", error);
    throw error;
  }
};
