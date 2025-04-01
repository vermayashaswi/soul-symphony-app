
import { supabase } from "@/integrations/supabase/client";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  references?: any[];
  hasNumericResult?: boolean;
  analysis?: any;
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
    
    // Check for emotion top N queries which can be handled directly
    if (message.toLowerCase().includes("top") && 
        (message.toLowerCase().includes("emotion") || message.toLowerCase().includes("feeling")) &&
        messageQueryTypes.timeRange) {
      
      console.log("Detected top emotions query, using direct database function");
      
      try {
        // Extract date range
        let startDate = null;
        let endDate = null;
        
        if (messageQueryTypes.timeRange) {
          startDate = messageQueryTypes.timeRange.startDate;
          endDate = messageQueryTypes.timeRange.endDate;
        }
        
        // Extract limit (default to 3 if not specified)
        let limit = 3;
        const matches = message.match(/top\s+(\d+)/i);
        if (matches && matches[1]) {
          limit = parseInt(matches[1], 10);
          if (isNaN(limit) || limit < 1) limit = 3;
          if (limit > 10) limit = 10; // Cap at 10 to prevent abuse
        }
        
        console.log(`Using get_top_emotions with: start=${startDate}, end=${endDate}, limit=${limit}`);
        
        const { data, error } = await supabase.rpc('get_top_emotions', {
          user_id_param: userId,
          start_date: startDate,
          end_date: endDate,
          limit_count: limit
        });
        
        if (error) {
          console.error("Error using get_top_emotions:", error);
        } else if (data && data.length > 0) {
          console.log("Successfully retrieved top emotions:", data);
          
          // Format the response
          const emotionsList = data.map(item => `${item.emotion} (${item.score})`).join(', ');
          const content = `Based on your journal entries, your top ${limit} emotions during this period were: ${emotionsList}.`;
          
          return {
            role: 'assistant',
            content: content,
            hasNumericResult: true,
            analysis: {
              emotions: data,
              timeRange: {
                start: startDate,
                end: endDate
              }
            }
          };
        }
      } catch (directQueryError) {
        console.error("Exception in direct top emotions query:", directQueryError);
      }
    }
    
    // First try using the smart query planner for direct data querying
    if (messageQueryTypes.isQuantitative || messageQueryTypes.isEmotionFocused) {
      console.log("Using smart query planner for direct data query");
      
      try {
        const { data, error } = await supabase.functions.invoke('smart-query-planner', {
          body: { 
            message, 
            userId, 
            includeDiagnostics: true,
            enableQueryBreakdown: true,
            generateSqlQueries: true,
            analyzeComponents: true
          }
        });
        
        if (error) {
          console.error("Error using smart-query-planner:", error);
        } else if (data && !data.fallbackToRag) {
          console.log("Successfully used smart query planner");
          queryResponse = data;
        } else {
          console.log("Smart query planner couldn't handle the query, falling back to RAG");
        }
      } catch (smartQueryError) {
        console.error("Exception in smart-query-planner:", smartQueryError);
      }
    }
    
    // If direct querying didn't work, use RAG
    if (!queryResponse) {
      console.log("Using RAG approach for query");
      
      // Process time range if present
      let timeRange = null;
      
      if (messageQueryTypes.timeRange && typeof messageQueryTypes.timeRange === 'object') {
        timeRange = {
          type: messageQueryTypes.timeRange.type,
          startDate: messageQueryTypes.timeRange.startDate,
          endDate: messageQueryTypes.timeRange.endDate
        };
      }
      
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: { 
          message, 
          userId,
          threadId,
          includeDiagnostics: true,
          timeRange
        }
      });
      
      if (error) {
        console.error("Error in chat-with-rag:", error);
        return {
          role: 'error',
          content: "I'm having trouble connecting to the AI service. Please try again later.",
        };
      }
      
      queryResponse = data;
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
