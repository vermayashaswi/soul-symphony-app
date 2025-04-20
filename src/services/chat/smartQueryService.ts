
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "./types";
import { journalInsightsService } from "../journalInsightsService";

interface SmartQueryResult {
  success: boolean;
  response?: string;
  planDetails?: any;
  executionResults?: any[];
  error?: string;
}

/**
 * Enhanced data generation capabilities for smart queries
 */
export const insightsFunctions = {
  /**
   * Detects patterns of emotional volatility in journal entries
   */
  async detectEmotionalVolatility(userId: string, timeframe: string = '30days') {
    return journalInsightsService.detectEmotionalVolatility(
      userId, 
      timeframe as '7days' | '30days' | '90days'
    );
  },
  
  /**
   * Summarizes journal entries by life areas and themes
   */
  async summarizeLifeAreas(userId: string, timeframe: string = '30days') {
    return journalInsightsService.summarizeLifeAreasByTheme(
      userId, 
      timeframe as '7days' | '30days' | '90days'
    );
  },
  
  /**
   * Suggests personalized journal prompts based on past entries
   */
  async suggestReflectionPrompts(userId: string, timeframe: string = '30days', count: number = 5) {
    return journalInsightsService.suggestReflectionPrompts(
      userId, 
      timeframe as '7days' | '30days' | '90days',
      count
    );
  },
  
  /**
   * Compares current and past journaling periods
   */
  async compareTimePeriods(userId: string, currentPeriod: string = '30days', comparisonType: string = 'previous') {
    return journalInsightsService.compareWithPastPeriods(
      userId, 
      currentPeriod as '7days' | '30days' | '90days',
      comparisonType as 'previous' | 'year_ago'
    );
  },
  
  /**
   * Recommends microhabits based on journal analysis
   */
  async recommendMicrohabits(userId: string, timeframe: string = '30days', count: number = 5) {
    return journalInsightsService.recommendMicrohabits(
      userId, 
      timeframe as '7days' | '30days' | '90days',
      count
    );
  },
  
  /**
   * Identifies patterns of silence or gaps in journaling
   */
  async detectSilencePeriods(userId: string, timeframe: string = '90days', gapThreshold: number = 3) {
    return journalInsightsService.detectSilencePeriods(
      userId, 
      timeframe as '30days' | '90days' | '180days' | '365days',
      gapThreshold
    );
  },
  
  /**
   * Recommends journal entries worth saving or sharing
   */
  async recommendShareableEntries(userId: string, timeframe: string = '90days', count: number = 3) {
    return journalInsightsService.recommendSharedEntries(
      userId, 
      timeframe as '30days' | '90days' | '180days' | '365days',
      count
    );
  }
};

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
        threadId,
        availableFunctions: Object.keys(insightsFunctions)
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
        userMessage: savedUserMsg as ChatMessage,
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
      userMessage: savedUserMsg as ChatMessage,
      assistantMessage: savedAssistantMsg as ChatMessage
    };
  } catch (error: any) {
    console.error('[SmartQueryService] Error in processAndSaveSmartQuery:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}
