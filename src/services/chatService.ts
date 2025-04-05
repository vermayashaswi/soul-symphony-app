
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
    // Determine match threshold and count based on query complexity
    const matchThreshold = queryTypes.isSpecificQuery ? 0.65 : 0.5;
    const matchCount = queryTypes.needsMoreContext ? 15 : 8;
    
    console.log(`Vector search parameters: threshold=${matchThreshold}, count=${matchCount}`);
    
    // Call the Supabase Edge Function with dynamic vector search parameters
    const { data, error } = await supabase.functions.invoke('chat-with-rag', {
      body: {
        message,
        userId,
        queryTypes,
        threadId,
        includeDiagnostics: enableDiagnostics,
        vectorSearch: {
          matchThreshold,
          matchCount
        },
        isEmotionQuery: queryTypes.isEmotionFocused,
        isWhyEmotionQuery: queryTypes.isWhyQuestion && queryTypes.isEmotionFocused,
        isTimePatternQuery: queryTypes.isTimePatternQuery,
        isTemporalQuery: queryTypes.isWhenQuestion,
        requiresTimeAnalysis: queryTypes.requiresTimeAnalysis
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
      diagnostics: enableDiagnostics ? { error: error instanceof Error ? error.message : String(error) } : undefined
    };
  }
};
