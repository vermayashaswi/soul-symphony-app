
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./types";

interface SmartQueryResult {
  success: boolean;
  response?: string;
  planDetails?: any;
  executionResults?: any[];
  error?: string;
  diagnostics?: any;
}

/**
 * Process a query through the smart query orchestrator.
 * All query classification happens server-side in the edge function.
 * @param message The user's query
 * @param userId The user's ID
 * @param threadId Optional thread ID for context
 */
export async function processSmartQuery(
  message: string,
  userId: string,
  threadId: string | null = null
): Promise<SmartQueryResult> {
  try {
    console.log("[SmartQueryService] Processing query:", message.substring(0, 30) + "...");
    
    // Detect if this is a complex query with multiple questions
    const isComplex = detectComplexQuery(message);
    if (isComplex) {
      console.log("[SmartQueryService] Detected complex multi-part query");
    }
    
    // Send the query directly to the orchestrator with additional metadata
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        metadata: {
          isComplexQuery: isComplex,
          clientTimestamp: new Date().toISOString()
        }
      }
    });

    if (error) {
      console.error('[SmartQueryService] Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process query'
      };
    }

    if (data?.error) {
      console.error('[SmartQueryService] Processing error:', data.error);
      return {
        success: false,
        error: data.error || 'Unknown error in query processing'
      };
    }

    if (!data?.response) {
      console.error('[SmartQueryService] No response returned from orchestrator');
      return {
        success: false,
        error: 'No response returned from server'
      };
    }

    console.log('[SmartQueryService] Query processed successfully');
    
    return {
      success: true,
      response: data.response,
      planDetails: data.planDetails,
      executionResults: data.executionResults,
      diagnostics: data.diagnostics
    };
  } catch (error: any) {
    console.error('[SmartQueryService] Error in processSmartQuery:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Helper function to detect if a query is complex (contains multiple questions)
 * @param message The user's query
 * @returns boolean indicating if the query is complex
 */
function detectComplexQuery(message: string): boolean {
  if (!message) return false;
  
  // Count question marks as a basic heuristic
  const questionMarkCount = (message.match(/\?/g) || []).length;
  
  // Look for conjunctions followed by question patterns
  const conjunctionPatterns = [
    /and\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am)/i,
    /also\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am)/i,
    /additionally\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am)/i
  ];
  
  const hasConjunctionPattern = conjunctionPatterns.some(pattern => pattern.test(message));
  
  // Consider a query complex if it has multiple question marks or conjunction patterns
  return questionMarkCount > 1 || hasConjunctionPattern;
}

/**
 * Process a query and save it as a chat message
 * @param message The user's query
 * @param userId The user's ID
 * @param threadId Thread ID for the conversation
 */
export async function processAndSaveSmartQuery(
  message: string,
  userId: string,
  threadId: string
): Promise<{ success: boolean; userMessage?: ChatMessage; assistantMessage?: ChatMessage; error?: string; diagnostics?: any }> {
  try {
    console.log("[SmartQueryService] Processing and saving query:", message.substring(0, 30) + "...");
    
    // Check if this is a complex query
    const isComplexQuery = detectComplexQuery(message);
    if (isComplexQuery) {
      console.log("[SmartQueryService] Detected complex multi-part query, using enhanced processing");
    }
    
    // Save the user message first
    const { data: savedUserMsg, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: message,
        sender: 'user',
        role: 'user',
        analysis_data: isComplexQuery ? { queryComplexity: 'multi-part' } : undefined
      })
      .select()
      .single();
      
    if (userMsgError) {
      console.error('[SmartQueryService] Error saving user message:', userMsgError);
      throw userMsgError;
    }
    
    // Process the query through the orchestrator with additional timeout for complex queries
    // Use a longer timeout for complex queries to prevent premature timeouts
    const timeoutDuration = isComplexQuery ? 90000 : 30000; // 90 seconds for complex, 30 for simple
    
    try {
      const result = await Promise.race([
        processSmartQuery(message, userId, threadId),
        new Promise<SmartQueryResult>((_, reject) => 
          setTimeout(() => reject(new Error('Query processing timeout')), timeoutDuration)
        )
      ]);
      
      if (!result.success) {
        const errorMsg = result.error || 'Failed to process query';
        
        // Save error message as assistant response
        const { data: savedErrorMsg, error: errorMsgError } = await supabase
          .from('chat_messages')
          .insert({
            thread_id: threadId,
            content: `I'm having trouble processing your complex query. ${errorMsg} For multi-part questions, try breaking them into separate questions for better results.`,
            sender: 'assistant',
            role: 'assistant',
            analysis_data: {
              error: errorMsg,
              queryComplexity: isComplexQuery ? 'multi-part' : 'simple',
              processingStage: result.diagnostics?.steps?.at(-1)?.name || 'unknown'
            }
          })
          .select()
          .single();
          
        if (errorMsgError) {
          console.error('[SmartQueryService] Error saving error message:', errorMsgError);
        }
        
        return {
          success: false,
          userMessage: savedUserMsg as ChatMessage,
          error: errorMsg,
          diagnostics: result.diagnostics
        };
      }
      
      // Save the assistant response with enhanced metadata
      const analysisData = {
        planDetails: result.planDetails,
        executionResults: result.executionResults,
        diagnostics: result.diagnostics,
        queryComplexity: isComplexQuery ? 'multi-part' : 'simple',
        processingStages: ['query_analysis', 'orchestration', 'response_generation']
      };
      
      const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: result.response,
          sender: 'assistant',
          role: 'assistant',
          analysis_data: analysisData
        })
        .select()
        .single();
        
      if (assistantMsgError) {
        console.error('[SmartQueryService] Error saving assistant message:', assistantMsgError);
        throw assistantMsgError;
      }
      
      return {
        success: true,
        userMessage: savedUserMsg as ChatMessage,
        assistantMessage: savedAssistantMsg as ChatMessage,
        diagnostics: result.diagnostics
      };
    } catch (processingError: any) {
      console.error('[SmartQueryService] Query processing error:', processingError);
      
      // Provide more helpful error message for complex queries
      let errorMessage = processingError.message || 'An error occurred during processing';
      
      // Specially handle complex query errors with more helpful messaging
      if (isComplexQuery && (
        errorMessage.includes('timeout') || 
        errorMessage.includes('AbortError') ||
        errorMessage.includes('failed to fetch')
      )) {
        errorMessage = 'Your multi-part question is complex and might need to be broken down. Try asking one question at a time for better results.';
      }
      
      // Save specific error message as assistant response
      const { data: errorResponse, error: saveError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: `${errorMessage} I can better answer questions when they're asked one at a time.`,
          sender: 'assistant',
          role: 'assistant',
          analysis_data: {
            error: processingError.message,
            queryComplexity: isComplexQuery ? 'multi-part' : 'simple',
            errorType: processingError.name || 'ProcessingError'
          }
        })
        .select()
        .single();
      
      if (saveError) {
        console.error('[SmartQueryService] Error saving error response:', saveError);
      }
      
      return {
        success: false,
        userMessage: savedUserMsg as ChatMessage,
        assistantMessage: errorResponse as ChatMessage,
        error: errorMessage
      };
    }
  } catch (error: any) {
    console.error('[SmartQueryService] Error in processAndSaveSmartQuery:', error);
    
    // Handle specific known errors
    let errorMessage = error.message || 'Unknown error occurred';
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      errorMessage = 'Your multi-part question is taking longer than expected to process. Please try breaking it into smaller, more specific questions.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

