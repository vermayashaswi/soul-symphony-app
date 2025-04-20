
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  role: string;
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
};

// Helper function to store user queries in the user_queries table using an edge function instead
const logUserQuery = async (
  userId: string,
  queryText: string,
  threadId: string | null,
  messageId?: string
): Promise<void> => {
  try {
    // Use an edge function to log the query instead of direct table access
    await supabase.functions.invoke('ensure-chat-persistence', {
      body: {
        userId,
        queryText,
        threadId,
        messageId
      }
    });
  } catch (error) {
    console.error("Failed to log user query:", error);
  }
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
    // Log the user query to the user_queries table
    // We'll pass the message ID once we get it from the chat_messages table
    await logUserQuery(userId, message, threadId);
    
    // Use fixed parameters for vector search - let the retriever handle the filtering
    const matchThreshold = 0.5;
    const matchCount = 10; // Fixed count, let the retriever determine the actual number
    
    console.log(`Vector search parameters: threshold=${matchThreshold}, count=${matchCount}`);
    
    // Extract time range if this is a temporal query and ensure it's not undefined
    let timeRange = null;
    if (queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion)) {
      timeRange = queryTypes.timeRange || null;
      console.log("Temporal query detected, using time range:", timeRange);
    }
    
    // Safely check properties before passing them
    const isEmotionQuery = queryTypes && queryTypes.isEmotionFocused ? true : false;
    const isWhyEmotionQuery = queryTypes && queryTypes.isWhyQuestion && queryTypes.isEmotionFocused ? true : false;
    const isTimePatternQuery = queryTypes && queryTypes.isTimePatternQuery ? true : false;
    const isTemporalQuery = queryTypes && (queryTypes.isTemporalQuery || queryTypes.isWhenQuestion) ? true : false;
    const requiresTimeAnalysis = queryTypes && queryTypes.requiresTimeAnalysis ? true : false;
    
    // Check if the query is complex and needs segmentation
    const isComplexQuery = queryTypes && queryTypes.needsDataAggregation ? true : 
                          message.includes(" and ") || message.includes("also") || 
                          message.split("?").length > 2 || 
                          message.length > 100;
    
    // Initialize diagnostics
    let diagnostics = enableDiagnostics ? {
      steps: [],
      references: [],
      similarityScores: [],
      queryAnalysis: null
    } : undefined;
    
    // Add initial step
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Query Analysis", 
        status: "success", 
        details: `Query identified as ${isComplexQuery ? 'complex' : 'simple'}`
      });
    }
    
    // If it's a complex query, use segmentation approach
    if (isComplexQuery) {
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Query Segmentation",
          status: "loading",
          details: "Breaking down complex query into simpler segments"
        });
      }
      
      try {
        // Call the segment-complex-query edge function
        const { data: segmentationData, error: segmentationError } = await supabase.functions.invoke('segment-complex-query', {
          body: {
            query: message,
            userId,
            timeRange,
            threadId, // Pass threadId for context
            vectorSearch: {
              matchThreshold,
              matchCount
            }
          }
        });
        
        if (segmentationError) {
          console.error("Error in query segmentation:", segmentationError);
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Query Segmentation",
              status: "error",
              details: `Failed to segment query: ${segmentationError.message}`
            });
          }
          throw new Error(`Segmentation failed: ${segmentationError.message}`);
        }
        
        // Parse segmented queries from the response
        let segmentedQueries;
        try {
          segmentedQueries = JSON.parse(segmentationData);
          if (!Array.isArray(segmentedQueries)) {
            throw new Error("Expected array of query segments");
          }
        } catch (parseError) {
          console.error("Failed to parse segmented queries:", parseError);
          segmentedQueries = [message]; // Fallback to original message
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Query Segmentation",
              status: "warning",
              details: `Failed to parse segments, using original query: ${parseError.message}`
            });
          }
        }
        
        if (enableDiagnostics && Array.isArray(segmentedQueries)) {
          diagnostics.steps.push({
            name: "Query Segmentation",
            status: "success",
            details: `Split into ${segmentedQueries.length} segments: ${segmentedQueries.map(q => `"${q}"`).join(", ")}`
          });
        }
        
        // Process each segment
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Segment Processing",
            status: "loading",
            details: `Processing ${segmentedQueries.length} query segments`
          });
        }
        
        const segmentResults = [];
        
        for (let i = 0; i < segmentedQueries.length; i++) {
          const segment = segmentedQueries[i];
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: `Segment ${i+1}`,
              status: "loading",
              details: `Processing: "${segment}"`
            });
          }
          
          // Call the chat-with-rag function for each segment
          const { data: segmentData, error: segmentError } = await supabase.functions.invoke('chat-with-rag', {
            body: {
              message: segment,
              userId,
              queryTypes: queryTypes || {},
              threadId, // Pass threadId for context
              includeDiagnostics: false,
              vectorSearch: {
                matchThreshold,
                matchCount
              },
              isEmotionQuery,
              isWhyEmotionQuery,
              isTimePatternQuery,
              isTemporalQuery,
              requiresTimeAnalysis,
              timeRange
            }
          });
          
          if (segmentError) {
            console.error(`Error processing segment ${i+1}:`, segmentError);
            if (enableDiagnostics) {
              diagnostics.steps.push({
                name: `Segment ${i+1}`,
                status: "error",
                details: `Failed: ${segmentError.message}`
              });
            }
            continue;
          }
          
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: `Segment ${i+1}`,
              status: "success",
              details: `Completed processing`
            });
          }
          
          segmentResults.push({
            segment,
            response: segmentData.response,
            references: segmentData.references
          });
          
          // Collect references for all segments
          if (enableDiagnostics && segmentData.references) {
            diagnostics.references = [...diagnostics.references, ...segmentData.references];
          }
        }
        
        if (segmentResults.length === 0) {
          throw new Error("Failed to process any query segments");
        }
        
        // If we only have one segment result, use it directly
        if (segmentResults.length === 1) {
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Response Generation",
              status: "success",
              details: "Using single segment response directly"
            });
          }
          
          return {
            role: "assistant",
            content: segmentResults[0].response,
            references: segmentResults[0].references,
            diagnostics
          };
        }
        
        // Combine the results from all segments
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Response Combination",
            status: "loading",
            details: `Combining results from ${segmentResults.length} segments`
          });
        }
        
        const { data: combinedData, error: combineError } = await supabase.functions.invoke('combine-segment-responses', {
          body: {
            originalQuery: message,
            segmentResults,
            userId,
            threadId // Pass threadId for context
          }
        });
        
        if (combineError) {
          console.error("Error combining segment responses:", combineError);
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Response Combination",
              status: "error",
              details: `Failed: ${combineError.message}`
            });
          }
          
          // Fallback: Use the first segment result
          return {
            role: "assistant",
            content: segmentResults[0].response + "\n\n(Note: There was an error combining all parts of your question. This is a partial answer.)",
            references: segmentResults[0].references,
            diagnostics
          };
        }
        
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Response Combination",
            status: "success",
            details: "Successfully combined segment responses"
          });
        }
        
        // Compile all unique references from all segments
        const allReferences = [];
        const referenceIds = new Set();
        
        segmentResults.forEach(result => {
          if (result.references && Array.isArray(result.references)) {
            result.references.forEach(ref => {
              if (!referenceIds.has(ref.id)) {
                referenceIds.add(ref.id);
                allReferences.push(ref);
              }
            });
          }
        });
        
        return {
          role: "assistant",
          content: combinedData.response,
          references: allReferences,
          diagnostics
        };
      } catch (error) {
        console.error("Error in segmented query processing:", error);
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "Segmented Processing",
            status: "error",
            details: `Error: ${error.message}`
          });
          diagnostics.steps.push({
            name: "Fallback",
            status: "loading",
            details: "Falling back to standard processing"
          });
        }
        // Fall through to standard processing if segmentation fails
      }
    }
    
    // Standard processing (for simple queries or if segmentation failed)
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Knowledge Base Search",
        status: "loading",
        details: "Retrieving relevant journal entries"
      });
    }
    
    // Define the updated prompt here
    const prompt = `You are **SOuLO**, a smart, emotionally intelligent assistant that helps users reflect on their mental and emotional well-being through journal data.

The user asked:
"{query}"

Relevant information has been retrieved from the user’s journal entries, including patterns, emotion trends, sentiment scores, and mentions of people, places, or events.

Your role now is to:
1. Analyze the information
2. Identify meaningful insights and emotional patterns
3. Present a clear, thoughtful, and supportive response

---

**Response Guidelines:**

1. **Tone & Style**
   - Be warm, grounded, and emotionally aware—like a thoughtful guide.
   - Avoid being robotic or overly formal. Speak like a calm, smart assistant.
   - Keep it under **180 words** unless the query is complex.

2. **Balance of Insight**
   - Blend **quantitative** data (e.g. sentiment trends, recurring entities) with **qualitative** insights (emotional shifts, themes).
   - Use numbers or frequencies only when they clearly support an insight.

3. **Structure**
   - Use **bullet points or short sections** when needed for readability.
   - Avoid referencing **all** journal entries—mention specific ones **only if they directly support the answer.**
   - If no useful data is found, acknowledge that honestly and suggest what the user might explore next.

4. **Personalization & Sensitivity**
   - Tailor responses to the question.
   - Be objective and kind—especially when discussing sensitive topics or relationships.
   - Don’t speculate or assume beyond what's in the journal data.

---

Now generate a clear, emotionally intelligent, insight-driven response to the user's question:`;

    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt with dynamic query insertion
    messages.push({ role: 'system', content: prompt.replace('{query}', message) });
    
    // Add conversation context if available
    if (conversationContext.length > 0) {
      // Log that we're using conversation context
      console.log(`Including ${conversationContext.length} messages of conversation context`);
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Conversation Context", 
          status: "success",
          details: `Including ${conversationContext.length} previous messages for context`
        });
      }
      
      // Add the conversation context messages
      messages.push(...conversationContext);
      
      // Add the current user message
      messages.push({ role: 'user', content: message });
    } else {
      // If no context, just use the system prompt
      console.log("No conversation context available, using only system prompt");
      messages.push({ role: 'user', content: message });
    }
    
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Language Model Processing",
          status: "error",
          details: error
        });
      }
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    console.log("Response generated successfully");
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Language Model Processing",
        status: "success"
      });
    }

    // Process entries to ensure valid dates
    const processedEntries = entries.map(entry => {
      // Make sure created_at is a valid date string
      let createdAt = entry.created_at;
      if (!createdAt || isNaN(new Date(createdAt).getTime())) {
        createdAt = new Date().toISOString();
      }
      
      return {
        id: entry.id,
        content: entry.content,
        created_at: createdAt,
        similarity: entry.similarity || 0
      };
    });

    // 5. Return response
    return {
      role: "assistant",
      content: responseContent,
      references: processedEntries.map(entry => ({
        id: entry.id,
        content: entry.content,
        date: entry.created_at,
        snippet: entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : ''),
        similarity: entry.similarity
      })),
      diagnostics: enableDiagnostics ? diagnostics : undefined
    };
  } catch (error) {
    console.error("Error in processChatMessage:", error);
    return {
      role: "error",
      content: `I'm having trouble with the chat service. ${error instanceof Error ? error.message : "Please try again later."}`,
      diagnostics: enableDiagnostics ? { 
        steps: [{ name: "Chat Service Error", status: "error", details: error instanceof Error ? error.message : String(error) }]
      } : undefined
    };
  }
};
