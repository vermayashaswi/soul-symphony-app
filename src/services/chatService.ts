
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
            analyzeComponents: true,
            allowRetry: true, // Add flag to indicate retries are allowed
            requiresExplanation: messageQueryTypes.needsContext || message.toLowerCase().includes('why')
          }
        });
        
        if (error) {
          console.error("Error using smart-query-planner:", error);
        } else if (data && !data.fallbackToRag) {
          console.log("Successfully used smart query planner");
          queryResponse = data;
          retryAttempted = data.retryAttempted || false;
          
          // If the system gave a fallback message but we don't want to actually fallback,
          // replace it with something better
          if (data.response === "I couldn't find a direct answer to your question using the available data. I will try a different approach." && !data.fallbackToRag) {
            // This means SQL retries ultimately succeeded
            if (retryAttempted) {
              data.response = "Based on your journal entries, " + data.response.toLowerCase();
            }
          }
          
          // Format emotion data if present
          if (data.hasNumericResult && data.diagnostics && data.diagnostics.executionResults) {
            // Check if the response contains a simple list of IDs
            if (data.response.includes("Here's what I found:") && 
                data.response.split("Here's what I found:")[1].trim().match(/^\d+(,\s*\d+)*$/)) {
              
              // Get the emotion results from diagnostics
              const executionResults = data.diagnostics.executionResults;
              const lastResult = executionResults[executionResults.length - 1];
              
              if (lastResult && lastResult.result && Array.isArray(lastResult.result)) {
                if (lastResult.result[0] && typeof lastResult.result[0] === 'object') {
                  // Format emotion data from the results
                  let formattedData;
                  
                  // Check if we have emotion objects with name and score properties
                  if (lastResult.result[0].emotion || lastResult.result[0].name) {
                    formattedData = lastResult.result.map((item: any) => {
                      const emotion = item.emotion || item.name || Object.keys(item)[0];
                      const score = item.score || (item[emotion] ? item[emotion] : null);
                      return `${emotion}${score ? ` (${typeof score === 'number' ? score.toFixed(2) : score})` : ''}`;
                    }).join(', ');
                  } 
                  // Check if we have objects with emotion as keys
                  else {
                    // Calculate the emotions from all entries returned
                    const emotionCounts: {[key: string]: {count: number, total: number}} = {};
                    
                    lastResult.result.forEach((item: any) => {
                      if (item.emotions && typeof item.emotions === 'object') {
                        Object.entries(item.emotions).forEach(([emotion, score]) => {
                          if (!emotionCounts[emotion]) {
                            emotionCounts[emotion] = { count: 0, total: 0 };
                          }
                          emotionCounts[emotion].count += 1;
                          emotionCounts[emotion].total += Number(score);
                        });
                      }
                    });
                    
                    // Sort emotions by frequency and score
                    const sortedEmotions = Object.entries(emotionCounts)
                      .sort((a, b) => {
                        // Sort by count first, then by average score
                        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
                        return (b[1].total / b[1].count) - (a[1].total / a[1].count);
                      })
                      .slice(0, 3) // Limit to top 3 emotions
                      .map(([emotion, stats]) => {
                        const avgScore = (stats.total / stats.count).toFixed(2);
                        return `${emotion} (${avgScore})`;
                      });
                    
                    formattedData = sortedEmotions.join(', ');
                  }
                  
                  // Replace the IDs with formatted emotion data
                  if (formattedData) {
                    data.response = data.response.split("Here's what I found:")[0] + 
                      "Here's what I found: " + formattedData;
                  }
                }
              }
            }
            
            // Also check for [object Object] in the response
            if (data.response.includes('[object Object]')) {
              const emotionResults = data.diagnostics.executionResults.find(
                (result: any) => Array.isArray(result.result) && 
                  result.result[0] && 
                  typeof result.result[0] === 'object' && 
                  (result.result[0].emotion || result.result[0].emotions)
              );
              
              if (emotionResults && emotionResults.result) {
                const emotionData = emotionResults.result.map((item: any) => {
                  const emotion = item.emotion || Object.keys(item)[0];
                  const score = item.score || item[emotion];
                  return `${emotion} (${typeof score === 'number' ? score.toFixed(2) : score})`;
                }).join(', ');
                
                // Replace the response content with formatted emotion data
                data.response = data.response.replace(/\[object Object\](, \[object Object\])*/, emotionData);
              }
            }
          }
        } else {
          console.log("Smart query planner couldn't handle the query, falling back to RAG");
        }
      } catch (smartQueryError) {
        console.error("Exception in smart-query-planner:", smartQueryError);
      }
    }
    
    // If direct querying didn't work, use RAG
    if (!queryResponse || queryResponse.fallbackToRag) {
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
          timeRange,
          isComplexQuery: messageQueryTypes.isComplexQuery || message.toLowerCase().includes('why'),
          requiresEmotionAnalysis: messageQueryTypes.isEmotionFocused
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
