
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
    
    // First check if the message requires filtering data
    if (messageQueryTypes.requiresFiltering) {
      console.log("Query requires filtering. Applying filters first...");
      // The smart-query-planner will handle the filtering logic
    }
    
    // First try using the smart query planner for direct data querying
    if (messageQueryTypes.isQuantitative || messageQueryTypes.isEmotionFocused || messageQueryTypes.requiresFiltering) {
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
            allowRetry: true,
            requiresFiltering: messageQueryTypes.requiresFiltering,
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
            // Determine if this is emotion data
            const isEmotionData = messageQueryTypes.isEmotionFocused || 
                                 message.toLowerCase().includes('emotion') || 
                                 message.toLowerCase().includes('feel');
            
            const executionResults = data.diagnostics.executionResults;
            const lastResult = executionResults[executionResults.length - 1];
            
            // Check if the response contains just numbers or IDs
            const hasOnlyNumericIds = data.response.includes("Here's what I found:") && 
                data.response.split("Here's what I found:")[1].trim().match(/^\d+(,\s*\d+)*$/);
            
            if (hasOnlyNumericIds && lastResult && lastResult.result && Array.isArray(lastResult.result)) {
              // We need to format this data properly
              let formattedData = '';
              
              if (isEmotionData) {
                // Aggregate emotions from all results
                const emotionCounts: {[key: string]: {count: number, total: number}} = {};
                
                // First check if we have direct emotion objects
                if (lastResult.result[0] && (lastResult.result[0].emotion || lastResult.result[0].name)) {
                  formattedData = lastResult.result.map((item: any) => {
                    const emotion = item.emotion || item.name || Object.keys(item)[0];
                    const score = item.score || (item[emotion] ? item[emotion] : null);
                    return `${emotion}${score ? ` (${typeof score === 'number' ? score.toFixed(2) : score})` : ''}`;
                  }).join(', ');
                }
                // Check if we got journal entries with emotion data
                else if (lastResult.result[0] && lastResult.result[0].emotions) {
                  // Process emotions from entries
                  lastResult.result.forEach((entry: any) => {
                    if (entry.emotions && typeof entry.emotions === 'object') {
                      Object.entries(entry.emotions).forEach(([emotion, score]) => {
                        if (!emotionCounts[emotion]) {
                          emotionCounts[emotion] = { count: 0, total: 0 };
                        }
                        emotionCounts[emotion].count += 1;
                        emotionCounts[emotion].total += Number(score);
                      });
                    }
                  });
                  
                  // Format emotion data
                  const sortedEmotions = Object.entries(emotionCounts)
                    .sort((a, b) => {
                      // Sort by count first, then by average score
                      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
                      return (b[1].total / b[1].count) - (a[1].total / a[1].count);
                    })
                    .slice(0, 3) // Top 3 emotions
                    .map(([emotion, stats]) => {
                      const avgScore = (stats.total / stats.count).toFixed(2);
                      return `${emotion} (${avgScore})`;
                    });
                  
                  formattedData = sortedEmotions.join(', ');
                }
                // If we have journal entry IDs but no emotions explicitly returned
                else if (Array.isArray(lastResult.result) && lastResult.result.every((item: any) => typeof item === 'number' || (typeof item === 'object' && item.id))) {
                  // This is a case where we only got journal entry IDs
                  // We need to fetch emotion data for these entries
                  const entryIds = lastResult.result.map((item: any) => 
                    typeof item === 'number' ? item : item.id
                  );
                  
                  // Create a more meaningful response with emotional analysis
                  data.response = "Based on your journal entries from last month, ";
                  
                  // Fetch the actual journal entries to analyze emotions
                  try {
                    const { data: entriesData, error: entriesError } = await supabase
                      .from('Journal Entries')
                      .select('id, "refined text", emotions')
                      .in('id', entryIds);
                    
                    if (!entriesError && entriesData && entriesData.length > 0) {
                      // Extract all emotions from the entries
                      const emotionsData: {[key: string]: {count: number, total: number}} = {};
                      
                      entriesData.forEach(entry => {
                        if (entry.emotions) {
                          Object.entries(entry.emotions).forEach(([emotion, score]) => {
                            if (!emotionsData[emotion]) {
                              emotionsData[emotion] = { count: 0, total: 0 };
                            }
                            emotionsData[emotion].count += 1;
                            emotionsData[emotion].total += Number(score);
                          });
                        }
                      });
                      
                      // Get the top emotions
                      const topEmotions = Object.entries(emotionsData)
                        .sort((a, b) => {
                          if (b[1].count !== a[1].count) return b[1].count - a[1].count;
                          return (b[1].total / b[1].count) - (a[1].total / a[1].count);
                        })
                        .slice(0, 3);
                      
                      if (topEmotions.length > 0) {
                        const emotionsList = topEmotions.map(([emotion, stats]) => {
                          const avgScore = (stats.total / stats.count).toFixed(2);
                          return `${emotion} (${avgScore})`;
                        }).join(', ');
                        
                        formattedData = emotionsList;
                        
                        // Create a meaningful response
                        data.response = `Based on your journal entries from last month, your top emotions were: ${emotionsList}.`;
                        
                        // Add context about why these emotions were dominant if the query asks for it
                        if (message.toLowerCase().includes('why')) {
                          const { data: completionData } = await supabase.functions.invoke('chat-with-rag', {
                            body: { 
                              message: `Why did I experience these emotions last month: ${emotionsList}? Provide a short analysis based on my journal entries.`, 
                              userId,
                              includeDiagnostics: false
                            }
                          });
                          
                          if (completionData && completionData.response) {
                            data.response += " " + completionData.response;
                          }
                        }
                      }
                    }
                  } catch (entriesError) {
                    console.error("Error fetching journal entries:", entriesError);
                  }
                }
                
                // Replace the IDs with formatted emotion data
                if (formattedData) {
                  if (data.response.includes("Here's what I found:")) {
                    data.response = data.response.split("Here's what I found:")[0] + 
                      "Here's what I found: " + formattedData;
                  } else if (!data.response.includes(formattedData)) {
                    // Only append the formatted data if it's not already in the response
                    data.response += " " + formattedData;
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
          requiresFiltering: messageQueryTypes.requiresFiltering,
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
