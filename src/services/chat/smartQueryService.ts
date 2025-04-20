import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./types";

interface SmartQueryResult {
  success: boolean;
  response?: string;
  planDetails?: any;
  executionResults?: any[];
  error?: string;
}

/**
 * Process a query through the smart query orchestrator
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
    
    // Call the Supabase edge function
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId
      }
    });

    // Handle response errors
    if (error) {
      console.error('[SmartQueryService] Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process query'
      };
    }

    // Check if the response has an error field
    if (data?.error) {
      console.error('[SmartQueryService] Processing error:', data.error);
      return {
        success: false,
        error: data.error || 'Unknown error in query processing'
      };
    }

    // Validate that we have a response
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
      executionResults: data.executionResults
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
 * Process a query and save it as a chat message
 * @param message The user's query
 * @param userId The user's ID
 * @param threadId Thread ID for the conversation
 */
export async function processAndSaveSmartQuery(
  message: string,
  userId: string,
  threadId: string
): Promise<{ success: boolean; userMessage?: ChatMessage; assistantMessage?: ChatMessage; error?: string }> {
  try {
    console.log("[SmartQueryService] Processing and saving query:", message.substring(0, 30) + "...");
    
    // Save the user message first
    const { data: savedUserMsg, error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: message,
        sender: 'user',
        role: 'user'
      })
      .select()
      .single();
      
    if (userMsgError) {
      console.error('[SmartQueryService] Error saving user message:', userMsgError);
      throw userMsgError;
    }
    
    // Process the query
    const result = await processSmartQuery(message, userId, threadId);
    
    if (!result.success) {
      const errorMsg = result.error || 'Failed to process query';
      
      // Save error message as assistant response
      const { data: savedErrorMsg, error: errorMsgError } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          content: `I'm having trouble processing your request. ${errorMsg}`,
          sender: 'assistant',
          role: 'assistant'
        })
        .select()
        .single();
        
      if (errorMsgError) {
        console.error('[SmartQueryService] Error saving error message:', errorMsgError);
      }
      
      return {
        success: false,
        userMessage: savedUserMsg,
        error: errorMsg
      };
    }
    
    // Save the assistant response
    const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: result.response,
        sender: 'assistant',
        role: 'assistant',
        analysis_data: {
          planDetails: result.planDetails,
          executionResults: result.executionResults
        }
      })
      .select()
      .single();
      
    if (assistantMsgError) {
      console.error('[SmartQueryService] Error saving assistant message:', assistantMsgError);
      throw assistantMsgError;
    }
    
    return {
      success: true,
      userMessage: savedUserMsg,
      assistantMessage: savedAssistantMsg
    };
  } catch (error: any) {
    console.error('[SmartQueryService] Error in processAndSaveSmartQuery:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}
