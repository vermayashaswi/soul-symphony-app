
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./types";
import { useToast } from "@/hooks/use-toast";

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
    
    // Enhanced complex query detection with additional patterns
    const isComplex = detectComplexQuery(message);
    if (isComplex) {
      console.log("[SmartQueryService] Detected complex multi-part query");
    }
    
    // Add query length logging to help diagnose issues with long queries
    const queryLength = message.length;
    console.log(`[SmartQueryService] Query length: ${queryLength} characters`);
    
    // Send the query directly to the orchestrator with enhanced metadata
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        metadata: {
          isComplexQuery: isComplex,
          queryLength: queryLength,
          clientTimestamp: new Date().toISOString()
        }
      }
    });

    if (error) {
      console.error('[SmartQueryService] Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process query',
        diagnostics: {
          stage: 'edge_function_invocation',
          error: error
        }
      };
    }

    if (data?.error) {
      console.error('[SmartQueryService] Processing error:', data.error);
      return {
        success: false,
        error: data.error || 'Unknown error in query processing',
        diagnostics: data.diagnostics || { 
          stage: 'query_processing', 
          error: data.error 
        }
      };
    }

    if (!data?.response) {
      console.error('[SmartQueryService] No response returned from orchestrator');
      return {
        success: false,
        error: 'No response returned from server',
        diagnostics: data?.diagnostics || { 
          stage: 'response_generation',
          error: 'Empty response'
        }
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
      error: error.message || 'Unknown error occurred',
      diagnostics: {
        stage: 'client_side_processing',
        error: error.toString(),
        stack: error.stack
      }
    };
  }
}

/**
 * Improved complex query detection with more comprehensive patterns
 * @param message The user's query
 * @returns boolean indicating if the query is complex
 */
function detectComplexQuery(message: string): boolean {
  if (!message) return false;
  
  // Count question marks as a basic heuristic
  const questionMarkCount = (message.match(/\?/g) || []).length;
  
  // Check for long query length - long queries may need segmentation
  const isLongQuery = message.length > 100;
  
  // Look for multiple questions within the query - expanded pattern matching
  const hasMultipleQuestionWords = 
    (message.match(/\b(how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|did|am|have|has|had)\b/gi) || []).length > 1;
  
  // Look for conjunctions followed by question patterns - expanded with more conjunction patterns
  const conjunctionPatterns = [
    /and\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am|have|has|had)/i,
    /also\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am|have|has|had)/i,
    /additionally\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am|have|has|had)/i,
    /but\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am|have|has|had)/i,
    /or\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am|have|has|had)/i,
    /yet\s+(?:how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|am|have|has|had)/i
  ];
  
  const hasConjunctionPattern = conjunctionPatterns.some(pattern => pattern.test(message));
  
  // Consider a query complex if it matches any of our complexity indicators
  const isComplex = questionMarkCount > 1 || hasConjunctionPattern || (isLongQuery && hasMultipleQuestionWords);
  
  // Log the detection results for troubleshooting
  console.log(`[SmartQueryService] Query complexity analysis:
    - Length: ${message.length} chars ${isLongQuery ? '(long)' : '(short)'}
    - Question marks: ${questionMarkCount}
    - Multiple question words: ${hasMultipleQuestionWords}
    - Conjunction patterns: ${hasConjunctionPattern}
    - Final assessment: ${isComplex ? 'Complex' : 'Simple'}`);
  
  return isComplex;
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
    
    // Check if this is a complex query with improved detection
    const isComplexQuery = detectComplexQuery(message);
    let analysisData = {};
    
    if (isComplexQuery) {
      console.log("[SmartQueryService] Detected complex multi-part query, using enhanced processing");
      analysisData = { 
        queryComplexity: 'multi-part', 
        queryLength: message.length 
      };
    }
    
    // Save the user message first with enhanced metadata
    const { data: savedUserMsg, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: message,
        sender: 'user',
        role: 'user',
        analysis_data: analysisData
      })
      .select()
      .single();
      
    if (userMsgError) {
      console.error('[SmartQueryService] Error saving user message:', userMsgError);
      throw userMsgError;
    }
    
    // Use a more appropriate timeout for different query types
    // Long/complex queries need more time, but we don't want to wait too long for simple queries
    const timeoutDuration = isComplexQuery ? 120000 : 45000; // 120 seconds for complex, 45 for simple
    console.log(`[SmartQueryService] Setting timeout: ${timeoutDuration}ms for ${isComplexQuery ? 'complex' : 'simple'} query`);
    
    try {
      const processingStartTime = Date.now();
      
      // Use Promise.race to implement timeout
      const result = await Promise.race([
        processSmartQuery(message, userId, threadId),
        new Promise<SmartQueryResult>((_, reject) => 
          setTimeout(() => reject(new Error(`Query processing timeout after ${timeoutDuration}ms`)), timeoutDuration)
        )
      ]);
      
      const processingTime = Date.now() - processingStartTime;
      console.log(`[SmartQueryService] Query processed in ${processingTime}ms`);
      
      if (!result.success) {
        let errorMsg = result.error || 'Failed to process query';
        console.error('[SmartQueryService] Processing error:', errorMsg, result.diagnostics);
        
        // Provide more helpful error messages for specific error conditions
        if (isComplexQuery && processingTime < 5000) {
          errorMsg = "I'm having trouble understanding your multi-part question. The query orchestrator encountered an early error. Please try asking one question at a time.";
        } else if (errorMsg.includes('timeout') || processingTime >= timeoutDuration - 1000) {
          errorMsg = "Your question is taking longer than expected to process. Please try asking a simpler or shorter question.";
        }
        
        // Save error message as assistant response
        const { data: savedErrorMsg, error: errorMsgError } = await supabase
          .from('chat_messages')
          .insert({
            thread_id: threadId,
            content: errorMsg,
            sender: 'assistant',
            role: 'assistant',
            analysis_data: {
              error: result.error,
              queryComplexity: isComplexQuery ? 'multi-part' : 'simple',
              processingTime,
              diagnostics: result.diagnostics
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
          assistantMessage: savedErrorMsg as ChatMessage,
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
        processingTime,
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
      
      // Provide more detailed error messages based on the type of error and query
      let errorMessage = processingError.message || 'An error occurred during processing';
      
      // Specially handle complex query errors with more helpful messaging
      if (isComplexQuery) {
        if (processingError.message?.includes('timeout')) {
          errorMessage = 'Your multi-part question is taking longer than expected to process. Please try asking one question at a time for better results.';
        } else if (processingError.message?.includes('AbortError') || processingError.message?.includes('failed to fetch')) {
          errorMessage = 'There was a communication error while processing your complex question. Please try asking a simpler question or breaking it down into parts.';
        } else {
          // For unexpected errors with complex queries
          errorMessage = 'I had trouble processing your multi-part question. Please try asking one question at a time for better results.';
        }
      } else {
        // For simple queries - could be a long single question
        if (message.length > 150) {
          errorMessage = 'Your question seems detailed. Please try rephrasing it more concisely for better results.';
        }
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
            errorType: processingError.name || 'ProcessingError',
            queryLength: message.length
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
      errorMessage = 'Your question is taking longer than expected to process. Please try again with a simpler question.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}
