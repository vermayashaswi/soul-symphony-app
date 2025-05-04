
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

// Helper function to retrieve conversation history for context
const getConversationContext = async (
  threadId: string | null, 
  limit: number = 5
): Promise<{ role: string, content: string }[]> => {
  if (!threadId) return [];
  
  try {
    const { data: previousMessages, error } = await supabase
      .from('chat_messages')
      .select('content, sender, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Get more messages to ensure we have enough pairs
      
    if (error || !previousMessages || previousMessages.length === 0) {
      return [];
    }
    
    // Process messages to create conversation context
    // We reverse the messages to get them in chronological order
    const chronologicalMessages = [...previousMessages].reverse();
    
    // Format as conversation context
    return chronologicalMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  } catch (error) {
    console.error("Error retrieving conversation context:", error);
    return [];
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
    // Initialize diagnostics with more detailed tracking
    let diagnostics = enableDiagnostics ? {
      steps: [],
      references: [],
      similarityScores: [],
      queryAnalysis: null,
      researchPlan: null,
      processingTime: {
        start: Date.now(),
        categorization: 0,
        queryPlanning: 0,
        execution: 0,
        synthesis: 0,
        total: 0
      }
    } : undefined;
    
    // Log the user query
    await logUserQuery(userId, message, threadId);
    
    // Get conversation history for context
    const conversationContext = await getConversationContext(threadId);
    const hasConversationContext = conversationContext.length > 0;
    
    if (enableDiagnostics && hasConversationContext) {
      diagnostics.steps.push({
        name: "Conversation Context", 
        status: "success",
        details: `Retrieved ${conversationContext.length} previous messages for context`
      });
    }
    
    // First, categorize if this is a general question or a journal-specific question
    const categorizationStartTime = Date.now();
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
            - "Did I mention being stressed in my entries?" -> "JOURNAL_SPECIFIC"
            - "Am I an introvert? Do I like people in general?" -> "JOURNAL_SPECIFIC"`
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
      const categorizationTime = Date.now() - categorizationStartTime;
      diagnostics.processingTime.categorization = categorizationTime;
      diagnostics.steps.push({
        name: "Question Categorization", 
        status: "success", 
        details: `Classified as ${questionType} (${categorizationTime}ms)`
      });
    }

    // If it's a general question, respond directly without journal entry retrieval
    if (questionType === "GENERAL") {
      console.log("Processing as general question, skipping journal entry retrieval");
      const generalStartTime = Date.now();
      
      if (enableDiagnostics) {
        diagnostics.steps.push({
          name: "General Question Processing", 
          status: "loading"
        });
      }
      
      // Enhanced general question handling with conversation context
      const generalCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Updated to modern model
          messages: [
            { 
              role: 'system', 
              content: `You are a mental health assistant of a voice journaling app called "SOULo". Here's a query from a user. Respond like a chatbot. If it concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly. If it contains any other abstract question like "Who is the president of India", "What is quantum physics" or anything that doesn't concern the app's purpose, feel free to deny politely.

              Be friendly, empathetic and helpful. If the question seems unclear or ambiguous, ask for clarification rather than saying you don't understand.`
            },
            ...(hasConversationContext ? conversationContext : []),
            { role: 'user', content: message }
          ],
          temperature: 0.7,
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
        const generalTime = Date.now() - generalStartTime;
        diagnostics.processingTime.total = Date.now() - diagnostics.processingTime.start;
        diagnostics.steps.push({
          name: "General Question Processing", 
          status: "success",
          details: `Generated in ${generalTime}ms`
        });
      }

      return {
        role: "assistant",
        content: generalResponse,
        diagnostics
      };
    }
    
    // For journal-specific questions, use our improved research planning approach
    const planningStartTime = Date.now();
    
    if (enableDiagnostics) {
      diagnostics.steps.push({
        name: "Research Planning", 
        status: "loading", 
        details: "Generating research plan for the query"
      });
    }
    
    // Generate research plan with conversation context
    const researchPlan = await planQueryExecution(message, conversationContext);
    
    if (enableDiagnostics) {
      const planningTime = Date.now() - planningStartTime;
      diagnostics.processingTime.queryPlanning = planningTime;
      diagnostics.researchPlan = researchPlan;
      diagnostics.steps.push({
        name: "Research Planning", 
        status: "success", 
        details: `Generated plan with ${researchPlan.length} steps in ${planningTime}ms`
      });
      diagnostics.steps.push({
        name: "Research Execution", 
        status: "loading", 
        details: "Executing research steps"
      });
    }
    
    // Enhanced execution with retries and error recovery
    const executionStartTime = Date.now();
    const researchResults = [];
    const maxRetries = 2; // Allow up to 2 retries for failed steps
    
    for (let i = 0; i < researchPlan.length; i++) {
      let attempts = 0;
      let success = false;
      let stepResult;
      
      while (attempts <= maxRetries && !success) {
        try {
          // If this is a retry, add retry information to diagnostics
          if (attempts > 0 && enableDiagnostics) {
            diagnostics.steps.push({
              name: `Research Step ${i + 1} (Retry ${attempts})`, 
              status: "loading",
              details: "Retrying failed step"
            });
          }
          
          // Execute the research step
          stepResult = await executeResearchStep(researchPlan[i], userId);
          researchResults.push(stepResult);
          success = true;
          
          if (enableDiagnostics) {
            if (stepResult.type === "vector_search_results") {
              diagnostics.references = [...(diagnostics.references || []), ...(stepResult.entries || [])];
              
              // Track similarity scores for analysis
              stepResult.entries?.forEach(entry => {
                if (entry.similarity) {
                  diagnostics.similarityScores.push({
                    id: entry.id,
                    score: entry.similarity
                  });
                }
              });
            }
            
            // Update the diagnostics for successful step
            diagnostics.steps.push({
              name: `Research Step ${i + 1}${attempts > 0 ? ` (Retry ${attempts})` : ''}`, 
              status: "success", 
              details: `${stepResult.type}: ${stepResult.description || 'Completed'} (${stepResult.entries?.length || stepResult.data?.length || 0} results)`
            });
          }
        } catch (stepError) {
          attempts++;
          console.error(`Error executing research step ${i} (attempt ${attempts}):`, stepError);
          
          if (enableDiagnostics) {
            diagnostics.steps.push({
              name: `Research Step ${i + 1}${attempts > 0 ? ` (Retry ${attempts})` : ''}`, 
              status: attempts >= maxRetries ? "error" : "warning", 
              details: stepError.message
            });
          }
          
          // If we've reached max retries, add a fallback result
          if (attempts > maxRetries) {
            // Create a fallback result to prevent breaking the pipeline
            const fallbackResult = {
              type: "fallback",
              description: `Failed step: ${JSON.parse(researchPlan[i]).description || 'Unknown step'}`,
              error: stepError.message,
              entries: [],
              data: []
            };
            
            researchResults.push(fallbackResult);
            
            if (enableDiagnostics) {
              diagnostics.steps.push({
                name: `Research Step ${i + 1} (Fallback)`, 
                status: "warning", 
                details: `Using fallback result due to repeated failures`
              });
            }
            break;
          }
          
          // Add a small delay before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    if (enableDiagnostics) {
      const executionTime = Date.now() - executionStartTime;
      diagnostics.processingTime.execution = executionTime;
      diagnostics.steps.push({
        name: "Research Execution", 
        status: "success", 
        details: `Completed ${researchResults.length} research steps in ${executionTime}ms`
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
    
    // Synthesize the final response with conversation context
    const synthesisStartTime = Date.now();
    const synthesizedResponse = await synthesizeResponses(
      message, 
      researchPlan, 
      researchResults, 
      conversationContext
    );
    
    if (enableDiagnostics) {
      const synthesisTime = Date.now() - synthesisStartTime;
      diagnostics.processingTime.synthesis = synthesisTime;
      diagnostics.processingTime.total = Date.now() - diagnostics.processingTime.start;
      diagnostics.steps.push({
        name: "Response Synthesis", 
        status: "success",
        details: `Generated in ${synthesisTime}ms`
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
    
    // Enhanced error recovery and reporting
    const errorMessage = error instanceof Error 
      ? error.message 
      : "An unexpected error occurred. Please try again with a simpler question.";
    
    const diagnosticsWithError = enableDiagnostics ? {
      steps: [{ 
        name: "Fatal Error", 
        status: "error", 
        details: errorMessage 
      }],
      processingTime: {
        start: 0,
        categorization: 0,
        queryPlanning: 0,
        execution: 0,
        synthesis: 0,
        total: 0
      }
    } : undefined;
    
    // Try to give a more helpful response based on the error type
    let userFacingMessage = "I'm having trouble processing your question.";
    
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        userFacingMessage = "I'm having trouble connecting to my knowledge base. This might be due to a configuration issue. Please try again later.";
      } else if (error.message.includes("categorize")) {
        userFacingMessage = "I couldn't understand the type of question you're asking. Could you rephrase it more clearly?";
      } else if (error.message.includes("embedding")) {
        userFacingMessage = "I'm having trouble analyzing your question. Could you try asking it differently?";
      } else {
        userFacingMessage = `I encountered a problem while processing your question. ${error.message}`;
      }
    }
    
    return {
      role: "error",
      content: userFacingMessage,
      diagnostics: diagnosticsWithError
    };
  }
};
