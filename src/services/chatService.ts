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
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session || !sessionData.session.user) {
      console.error("Session verification failed:", sessionError);
      return {
        role: 'error',
        content: "Authentication required. Please sign in again.",
      };
    }
    
    if (sessionData.session.user.id !== userId) {
      console.error("User ID mismatch:", sessionData.session.user.id, userId);
      return {
        role: 'error',
        content: "You cannot access another user's data.",
      };
    }
  } catch (sessionCheckError) {
    console.error("Error checking session:", sessionCheckError);
    return {
      role: 'error',
      content: "Authentication verification failed. Please try signing in again.",
    };
  }

  try {
    console.log("Processing message:", message);
    const messageQueryTypes = queryTypes || analyzeQueryTypes(message);
    console.log("Query analysis results:", messageQueryTypes);
    
    let queryResponse: any = null;
    let retryAttempted = false;
    
    if (messageQueryTypes.requiresFiltering) {
      console.log("Query requires filtering. Applying filters first...");
    }
    
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
          if (typeof error === 'object' && error.message && error.message.includes('auth')) {
            return {
              role: 'error',
              content: "Authentication required for accessing your data. Please sign in again.",
            };
          }
          
          console.error("Error using smart-query-planner:", error);
        } else if (data && !data.fallbackToRag) {
          console.log("Successfully used smart query planner");
          queryResponse = data;
          retryAttempted = data.retryAttempted || false;
          
          if (data.response === "I couldn't find a direct answer to your question using the available data. I will try a different approach." && !data.fallbackToRag) {
            if (retryAttempted) {
              data.response = "Based on your journal entries, " + data.response.toLowerCase();
            }
          }
          
          if (data.hasNumericResult && data.diagnostics && data.diagnostics.executionResults) {
            const isEmotionData = messageQueryTypes.isEmotionFocused || 
                                 message.toLowerCase().includes('emotion') || 
                                 message.toLowerCase().includes('feel');
            
            const executionResults = data.diagnostics.executionResults;
            const lastResult = executionResults[executionResults.length - 1];
            
            const hasOnlyNumericIds = data.response.includes("Here's what I found:") && 
                data.response.split("Here's what I found:")[1].trim().match(/^\d+(,\s*\d+)*$/);
            
            if (hasOnlyNumericIds && lastResult && lastResult.result && Array.isArray(lastResult.result)) {
              let formattedData = '';
              
              if (isEmotionData) {
                const emotionCounts: {[key: string]: {count: number, total: number}} = {};
                
                if (lastResult.result[0] && (lastResult.result[0].emotion || lastResult.result[0].name)) {
                  formattedData = lastResult.result.map((item: any) => {
                    const emotion = item.emotion || item.name || Object.keys(item)[0];
                    const score = item.score || (item[emotion] ? item[emotion] : null);
                    return `${emotion}${score ? ` (${typeof score === 'number' ? score.toFixed(2) : score})` : ''}`;
                  }).join(', ');
                } else if (lastResult.result[0] && lastResult.result[0].emotions) {
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
                  
                  const sortedEmotions = Object.entries(emotionCounts)
                    .sort((a, b) => {
                      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
                      return (b[1].total / b[1].count) - (a[1].total / a[1].count);
                    })
                    .slice(0, 3)
                    .map(([emotion, stats]) => {
                      const avgScore = (stats.total / stats.count).toFixed(2);
                      return `${emotion} (${avgScore})`;
                    });
                  
                  formattedData = sortedEmotions.join(', ');
                } else if (Array.isArray(lastResult.result) && lastResult.result.every((item: any) => typeof item === 'number' || (typeof item === 'object' && item.id))) {
                  const entryIds = lastResult.result.map((item: any) => 
                    typeof item === 'number' ? item : item.id
                  );
                  
                  const { data: entriesData, error: entriesError } = await supabase
                    .from('Journal Entries')
                    .select('id, "refined text", emotions')
                    .in('id', entryIds);
                    
                  if (!entriesError && entriesData && entriesData.length > 0) {
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
                      
                      data.response = `Based on your journal entries from last month, your top emotions were: ${emotionsList}.`;
                      
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
                }
                
                if (formattedData) {
                  if (data.response.includes("Here's what I found:")) {
                    data.response = data.response.split("Here's what I found:")[0] + 
                      "Here's what I found: " + formattedData;
                  } else if (!data.response.includes(formattedData)) {
                    data.response += " " + formattedData;
                  }
                }
              }
              
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
                  
                  data.response = data.response.replace(/\[object Object\](, \[object Object\])*/, emotionData);
                }
              }
            }
          }
        } else {
          console.log("Smart query planner couldn't handle the query, falling back to RAG");
        }
      } catch (smartQueryError) {
        if (smartQueryError instanceof Error && 
            smartQueryError.message && 
            smartQueryError.message.includes('auth')) {
          return {
            role: 'error',
            content: "Authentication issue when processing your request. Please sign in again.",
          };
        }
        
        console.error("Exception in smart-query-planner:", smartQueryError);
      }
    }
    
    if (!queryResponse || queryResponse.fallbackToRag) {
      console.log("Using RAG approach for query");
      
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
        if (typeof error === 'object' && error.message) {
          if (error.message.includes('auth') || error.message.includes('Authentication')) {
            return {
              role: 'error',
              content: "Authentication required for accessing your data. Please sign in again.",
            };
          }
        }
        
        console.error("Error in chat-with-rag:", error);
        return {
          role: 'error',
          content: "I'm having trouble connecting to the AI service. Please try again later.",
        };
      }
      
      queryResponse = data;
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
    
    if (error instanceof Error && 
        (error.message.includes('auth') || 
         error.message.includes('Authentication') || 
         error.message.includes('JWT'))) {
      return {
        role: 'error',
        content: "Authentication required. Please sign in again to continue using the chat.",
      };
    }
    
    return {
      role: 'error',
      content: "I apologize, but I encountered an error processing your request. Please try again.",
    };
  }
}
