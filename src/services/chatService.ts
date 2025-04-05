
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  role: string;
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
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
    // Check for emotion analysis queries to use smart-chat function directly
    const emotionQueryPattern = /top\s+emotions|emotions\s+summary|main\s+emotions|emotional\s+state|emotion\s+analysis/i;
    const isEmotionQuery = emotionQueryPattern.test(message);
    
    // Call the appropriate Supabase Edge Function
    const { data, error } = isEmotionQuery 
      ? await supabase.functions.invoke('smart-chat', {
          body: {
            message,
            userId
          }
        })
      : await supabase.functions.invoke('chat-rag', {
          body: {
            message,
            userId,
            queryTypes,
            threadId,
            includeDiagnostics: enableDiagnostics
          }
        });

    if (error) {
      console.error("Edge function error:", error);
      return {
        role: "error",
        content: `I'm having trouble processing your request. Technical details: ${error.message}`,
        diagnostics: enableDiagnostics ? { error: error.message } : undefined
      };
    }

    if (!data) {
      console.error("No data returned from edge function");
      return {
        role: "error",
        content: "I'm having trouble retrieving a response. Please try again in a moment.",
        diagnostics: enableDiagnostics ? { error: "No data returned" } : undefined
      };
    }

    // Handle error responses that come with status 200
    if (data.error) {
      console.error("Error in data:", data.error);
      return {
        role: "error",
        content: data.response || `There was an issue retrieving information: ${data.error}`,
        diagnostics: enableDiagnostics ? data.diagnostics : undefined
      };
    }

    // For emotion queries that use smart-chat
    if (isEmotionQuery && data.data) {
      const chatResponse: ChatMessage = {
        role: "assistant",
        content: data.data
      };

      // Add references if available
      if (data.references && data.references.length > 0) {
        chatResponse.references = data.references;
      }

      // Add analysis if available
      if (data.analysis) {
        chatResponse.analysis = data.analysis;
        if (data.analysis.type === 'quantitative_emotion' || 
            data.analysis.type === 'top_emotions') {
          chatResponse.hasNumericResult = true;
        }
      }
      
      return chatResponse;
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
          data.analysis.type === 'top_emotions') {
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
      diagnostics: enableDiagnostics ? { error: error instanceof Error ? error.message : String(error) } : undefined
    };
  }
};
