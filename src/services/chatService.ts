import { supabase } from "@/integrations/supabase/client";
import { planQueryExecution, executeResearchStep, synthesizeResponses } from "./chat/queryPlannerService";

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
    // Log the user query
    await logUserQuery(userId, message, threadId);
    
    // Initialize diagnostics
    let diagnostics = enableDiagnostics ? {
      steps: [],
      references: [],
      similarityScores: [],
      queryAnalysis: null,
      researchPlan: null
    } : undefined;
    
    // First, categorize if this is a general question or a journal-specific question
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Question Categorization", 
        status: "loading"
      });
    }
    
    console.log("Categorizing question type");
    const categorizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a classifier that determines if a user's query is a general question about mental health, greetings, or an abstract question unrelated to journaling (respond with "GENERAL") OR if it's a question seeking insights from the user's journal entries (respond with "JOURNAL_SPECIFIC"). 
            Respond with ONLY "GENERAL" or "JOURNAL_SPECIFIC".
            
            Examples:
            - "How are you doing?" -> "GENERAL"
            - "What is journaling?" -> "GENERAL"
            - "Who is the president of India?" -> "GENERAL"
            - "How was I feeling last week?" -> "JOURNAL_SPECIFIC"
            - "What patterns do you see in my anxiety?" -> "JOURNAL_SPECIFIC"
            - "Am I happier on weekends based on my entries?" -> "JOURNAL_SPECIFIC"
            - "Did I mention being stressed in my entries?" -> "JOURNAL_SPECIFIC"`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 10
      }),
    });

    if (!categorizationResponse.ok) {
      const error = await categorizationResponse.text();
      console.error('Failed to categorize question:', error);
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "Question Categorization", 
          status: "error", 
          details: error
        });
      }
      throw new Error('Failed to categorize question');
    }

    const categorization = await categorizationResponse.json();
    const questionType = categorization.choices[0]?.message?.content.trim();
    console.log(`Question categorized as: ${questionType}`);
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Question Categorization", 
        status: "success", 
        details: `Classified as ${questionType}`
      });
    }

    // If it's a general question, respond directly without journal entry retrieval
    if (questionType === "GENERAL") {
      console.log("Processing as general question, skipping journal entry retrieval");
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "General Question Processing", 
          status: "loading"
        });
      }
      
      // Get previous messages for context if available
      let conversationContext = [];
      if (threadId) {
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (!error && previousMessages && previousMessages.length > 0) {
          // Format as conversation context (reverse to get chronological order)
          conversationContext = [...previousMessages].reverse().map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
        }
      }
      
      const generalCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system', 
              content: `You are a mental health assistant of a voice journaling app called "SOuLO". Here's a query from a user. Respond like a chatbot. IF it concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly. If it contains any other abstract question like "Who is the president of India" , "What is quantum physics" or anything that doesn't concern the app's purpose, feel free to deny politely.` 
            },
            ...(conversationContext.length > 0 ? conversationContext : []),
            { role: 'user', content: message }
          ],
        }),
      });

      if (!generalCompletionResponse.ok) {
        const error = await generalCompletionResponse.text();
        console.error('Failed to get general completion:', error);
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: "General Question Processing", 
            status: "error", 
            details: error
          });
        }
        throw new Error('Failed to generate response');
      }

      const generalCompletionData = await generalCompletionResponse.json();
      const generalResponse = generalCompletionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log("General response generated successfully");
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "General Question Processing", 
          status: "success"
        });
      }

      return {
        role: "assistant",
        content: generalResponse,
        diagnostics
      };
    }
    
    // For journal-specific questions, use our improved research planning approach
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Research Planning", 
        status: "loading", 
        details: "Generating research plan for the query"
      });
    }
    
    // Generate research plan
    const researchPlan = await planQueryExecution(message);
    
    if (enableDiagnostics) {
      diagnostics.researchPlan = researchPlan;
      diagnostics.steps.push({
        name: "Research Planning", 
        status: "success", 
        details: `Generated plan with ${researchPlan.length} steps`
      });
      diagnostics.steps.push({
        name: "Research Execution", 
        status: "loading", 
        details: "Executing research steps"
      });
    }
    
    // Execute each research step
    const researchResults = [];
    for (let i = 0; i < researchPlan.length; i++) {
      try {
        const stepResult = await executeResearchStep(researchPlan[i], userId);
        researchResults.push(stepResult);
        
        if (enableDiagnostics) {
          if (stepResult.type === "vector_search_results") {
            diagnostics.references = [...(diagnostics.references || []), ...(stepResult.entries || [])];
          }
        }
      } catch (stepError) {
        console.error(`Error executing research step ${i}:`, stepError);
        if (enableDiagnostics) {
          diagnostics.steps.push({
            name: `Research Step ${i + 1}`, 
            status: "error", 
            details: stepError.message
          });
        }
      }
    }
    
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Research Execution", 
        status: "success", 
        details: `Completed ${researchResults.length} research steps`
      });
      diagnostics.steps.push({
        name: "Response Synthesis", 
        status: "loading", 
        details: "Generating final response"
      });
    }
    
    // Extract references from research results for the response
    const references = researchResults
      .filter(result => result.type === "vector_search_results")
      .flatMap(result => result.entries || [])
      .map(entry => ({
        id: entry.id,
        content: entry.content,
        date: entry.created_at,
        snippet: entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : ''),
        similarity: entry.similarity || 0
      }));
    
    // Synthesize the final response
    const synthesizedResponse = await synthesizeResponses(message, researchPlan, researchResults);
    
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Response Synthesis", 
        status: "success"
      });
    }

    return {
      role: "assistant",
      content: synthesizedResponse,
      references: references.length > 0 ? references : undefined,
      diagnostics
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
