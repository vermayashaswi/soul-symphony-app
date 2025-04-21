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

export async function processSmartQuery(
  message: string,
  userId: string,
  threadId: string | null = null
): Promise<SmartQueryResult> {
  try {
    console.log("[SmartQueryService] Processing query:", message.substring(0, 30) + "...");
    
    const isComplex = detectComplexQuery(message);
    
    const queryTimeout = isComplex ? 120000 : 45000; // 120s for complex, 45s for simple
    console.log(`[SmartQueryService] Query timeout set to ${queryTimeout}ms`);
    
    console.log(`[SmartQueryService] Query Complexity Analysis:
      - Message Length: ${message.length}
      - Is Complex Query: ${isComplex}
      - Timeout Duration: ${queryTimeout}ms`);
    
    const queryResult = await Promise.race([
      processQueryWithFallback(message, userId, threadId, isComplex),
      new Promise<SmartQueryResult>((_, reject) => 
        setTimeout(() => {
          console.error('[SmartQueryService] Query processing timed out');
          reject(new Error(`Query processing timed out after ${queryTimeout}ms`));
        }, queryTimeout)
      )
    ]);

    return queryResult;
  } catch (error: any) {
    console.error('[SmartQueryService] Comprehensive error handling:', error);
    
    const errorResponse: SmartQueryResult = {
      success: false,
      error: error.message || 'Unexpected query processing error',
      diagnostics: {
        stage: 'query_processing',
        isComplex: detectComplexQuery(message),
        queryLength: message.length,
        fullError: error.toString(),
        timestamp: new Date().toISOString()
      }
    };
    
    return errorResponse;
  }
}

function detectComplexQuery(message: string): boolean {
  if (!message) return false;
  
  const complexityIndicators = [
    (message.match(/\b(how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|did|am|have|has|had)\b/gi) || []).length > 1,
    (message.match(/[?!.]/g) || []).length > 1,
    message.length > 100,
    /\b(and|but|or|additionally|moreover|furthermore)\b/i.test(message)
  ];
  
  const complexityScore = complexityIndicators.filter(Boolean).length;
  
  console.log(`[SmartQueryService] Complexity Score: ${complexityScore}`);
  
  return complexityScore >= 2;
}

async function processQueryWithFallback(
  message: string, 
  userId: string, 
  threadId: string | null, 
  isComplex: boolean
): Promise<SmartQueryResult> {
  try {
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        metadata: {
          isComplexQuery: isComplex,
          queryLength: message.length,
          processingAttempt: 'primary'
        }
      }
    });

    if (error) {
      console.error('[SmartQueryService] Primary query processing failed:', error);
      
      const fallbackResult = await attemptFallbackProcessing(message, userId, threadId);
      if (fallbackResult) return fallbackResult;
      
      throw error;
    }

    if (data?.error) {
      console.error('[SmartQueryService] Query processing error:', data.error);
      
      const fallbackResult = await attemptFallbackProcessing(message, userId, threadId);
      if (fallbackResult) return fallbackResult;
      
      throw new Error(data.error);
    }

    return {
      success: true,
      response: data.response,
      planDetails: data.planDetails,
      executionResults: data.executionResults,
      diagnostics: {
        ...data.diagnostics,
        processingMethod: 'primary'
      }
    };
  } catch (error: any) {
    console.error('[SmartQueryService] Fallback processing error:', error);
    
    const finalFallbackResult = await attemptFinalFallback(message, userId, threadId);
    if (finalFallbackResult) return finalFallbackResult;
    
    throw error;
  }
}

async function attemptFallbackProcessing(
  message: string, 
  userId: string, 
  threadId: string | null
): Promise<SmartQueryResult | null> {
  try {
    console.log('[SmartQueryService] Attempting fallback processing');
    
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        metadata: {
          processingAttempt: 'fallback',
          queryLength: message.length
        }
      }
    });

    if (error || data?.error) return null;

    return {
      success: true,
      response: data.response,
      planDetails: data.planDetails,
      executionResults: data.executionResults,
      diagnostics: {
        ...data.diagnostics,
        processingMethod: 'fallback'
      }
    };
  } catch {
    return null;
  }
}

async function attemptFinalFallback(
  message: string, 
  userId: string, 
  threadId: string | null
): Promise<SmartQueryResult | null> {
  try {
    console.log('[SmartQueryService] Attempting final fallback processing');
    
    return {
      success: true,
      response: "I'm having trouble processing your complex query. Could you rephrase it more simply or break it down into smaller questions?",
      diagnostics: {
        processingMethod: 'final_fallback',
        queryLength: message.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch {
    return null;
  }
}

export async function processAndSaveSmartQuery(
  message: string,
  userId: string,
  threadId: string
): Promise<{ success: boolean; userMessage?: ChatMessage; assistantMessage?: ChatMessage; error?: string; diagnostics?: any }> {
  try {
    console.log("[SmartQueryService] Processing and saving query:", message.substring(0, 30) + "...");
    
    const isComplexQuery = detectComplexQuery(message);
    let analysisData = {};
    
    if (isComplexQuery) {
      console.log("[SmartQueryService] Detected complex multi-part query, using enhanced processing");
      analysisData = { 
        queryComplexity: 'multi-part', 
        queryLength: message.length 
      };
    }
    
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
    
    const timeoutDuration = isComplexQuery ? 120000 : 45000; // 120 seconds for complex, 45 for simple
    console.log(`[SmartQueryService] Setting timeout: ${timeoutDuration}ms for ${isComplexQuery ? 'complex' : 'simple'} query`);
    
    try {
      const processingStartTime = Date.now();
      
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
        
        if (isComplexQuery && processingTime < 5000) {
          errorMsg = "I'm having trouble understanding your multi-part question. The query orchestrator encountered an early error. Please try asking one question at a time.";
        } else if (errorMsg.includes('timeout') || processingTime >= timeoutDuration - 1000) {
          errorMsg = "Your question is taking longer than expected to process. Please try asking a simpler or shorter question.";
        }
        
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
      
      let errorMessage = processingError.message || 'An error occurred during processing';
      
      if (isComplexQuery) {
        if (processingError.message?.includes('timeout')) {
          errorMessage = 'Your multi-part question is taking longer than expected to process. Please try asking one question at a time for better results.';
        } else if (processingError.message?.includes('AbortError') || processingError.message?.includes('failed to fetch')) {
          errorMessage = 'There was a communication error while processing your complex question. Please try asking a simpler question or breaking it down into parts.';
        } else {
          errorMessage = 'I had trouble processing your multi-part question. Please try asking one question at a time for better results.';
        }
      } else {
        if (message.length > 150) {
          errorMessage = 'Your question seems detailed. Please try rephrasing it more concisely for better results.';
        }
      }
      
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
