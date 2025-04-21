import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  role: string;
  content: string;
  references?: any[];
  analysis?: any;
  diagnostics?: any;
  hasNumericResult?: boolean;
};

const logUserQuery = async (
  userId: string,
  queryText: string,
  threadId: string | null,
  messageId?: string
): Promise<void> => {
  try {
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
  _queryTypes: any, 
  threadId: string | null = null,
  enableDiagnostics: boolean = false
): Promise<ChatMessage> => {
  console.log("Processing chat message:", message.substring(0, 30) + "...");

  try {
    await logUserQuery(userId, message, threadId);

    const matchThreshold = 0.5;
    const matchCount = 10;

    const isComplexQuery = message.includes(" and ") || message.includes("also") || 
                         message.split("?").length > 2 || 
                         message.length > 100;

    let diagnostics = enableDiagnostics ? {
      steps: [],
      references: [],
      similarityScores: [],
      queryAnalysis: null
    } : undefined;
    
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Query Analysis", 
        status: "success", 
        details: `Query identified as ${isComplexQuery ? 'complex' : 'simple'}`
      });
    }

    if (isComplexQuery) {
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Query Segmentation",
          status: "loading",
          details: "Breaking down complex query into simpler segments"
        });
      }
      try {
        const { data: segmentationData, error: segmentationError } = await supabase.functions.invoke('segment-complex-query', {
          body: {
            query: message,
            userId,
            threadId, // Pass threadId for context
            vectorSearch: {
              matchThreshold,
              matchCount
            }
          }
        });
        
        if (segmentationError) {
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Query Segmentation",
              status: "error",
              details: `Failed to segment query: ${segmentationError.message}`
            });
          }
          throw new Error(`Segmentation failed: ${segmentationError.message}`);
        }
        
        let segmentedQueries;
        try {
          segmentedQueries = JSON.parse(segmentationData);
          if (!Array.isArray(segmentedQueries)) {
            throw new Error("Expected array of query segments");
          }
        } catch (parseError) {
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
          const { data: segmentData, error: segmentError } = await supabase.functions.invoke('chat-with-rag', {
            body: {
              message: segment,
              userId,
              threadId, // don't pass any other structured query types
              includeDiagnostics: false,
              vectorSearch: {
                matchThreshold,
                matchCount
              }
            }
          });
          if (segmentError) {
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
          if (enableDiagnostics && segmentData.references) {
            diagnostics.references = [...diagnostics.references, ...segmentData.references];
          }
        }
        
        if (segmentResults.length === 0) {
          throw new Error("Failed to process any query segments");
        }
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
            threadId
          }
        });
        
        if (combineError) {
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: "Response Combination",
              status: "error",
              details: `Failed: ${combineError.message}`
            });
          }
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
      }
    }
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Knowledge Base Search",
        status: "loading",
        details: "Retrieving relevant journal entries"
      });
    }

    const prompt = `You are **SOuLO**, a smart, emotionally intelligent assistant that helps users reflect on their mental and emotional well-being through journal data.

The user asked:
"{query}"

Relevant information has been retrieved from the user's journal entries, including patterns, emotion trends, sentiment scores, and mentions of people, places, or events.

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
   - Don't speculate or assume beyond what's in the journal data.

---

Now generate a clear, emotionally intelligent, insight-driven response to the user's question.`;

    const conversationContext = [];
    const messages = [];
    messages.push({ role: 'system', content: prompt.replace('{query}', message) });
    messages.push({ role: 'user', content: message });
    const apiKey = await getOpenAIKey();
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
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Language Model Processing",
        status: "success"
      });
    }

    const { data: entries, error: entriesError } = await supabase.functions.invoke('chat-with-rag', {
      body: {
        message,
        userId,
        threadId,
        retrieveOnly: true,
        vectorSearch: {
          matchThreshold,
          matchCount
        }
      }
    });

    if (entriesError) {
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Entry Retrieval",
          status: "error",
          details: entriesError.message
        });
      }
    }
    const journalEntries = entries?.references || [];
    const processedEntries = journalEntries.map(entry => {
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
    return {
      role: "error",
      content: `I'm having trouble with the chat service. ${error instanceof Error ? error.message : "Please try again later."}`,
      diagnostics: enableDiagnostics ? { 
        steps: [{ name: "Chat Service Error", status: "error", details: error instanceof Error ? error.message : String(error) }]
      } : undefined
    };
  }
};

async function getOpenAIKey(): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('get-openai-key', {
      body: {}
    });
    
    if (error) {
      console.error("Error getting OpenAI API key:", error);
      throw error;
    }
    
    if (data?.apiKey) {
      return data.apiKey;
    } else {
      throw new Error("No API key returned from edge function");
    }
  } catch (error) {
    console.error("Failed to get OpenAI API key:", error);
    throw new Error("Could not retrieve API key for OpenAI");
  }
}
