
import { supabase } from "@/integrations/supabase/client";
import { QueryTypes } from '../utils/chat/queryAnalyzer';
import { enhancedQueryClassification } from '../utils/chat/messageClassifier';

type ProcessedResponse = {
  content: string;
  role: 'assistant' | 'error';
  references?: any[];
  analysis?: any;
  isInteractive?: boolean;
  interactiveOptions?: any[];
  hasNumericResult?: boolean;
};

/**
 * Process a chat message with proper personal/general classification
 */
export async function processChatMessage(
  message: string,
  userId: string,
  queryTypes: QueryTypes,
  threadId: string,
  isFollowUp = false,
  parameters: Record<string, any> = {}
): Promise<ProcessedResponse> {
  try {
    console.log("Processing chat message:", message.substring(0, 30) + "...");
    console.log("Parameters:", parameters);
    
    // Determine if this should be processed as a personal query or general question
    let usePersonalContext = parameters.usePersonalContext || false;
    
    // If the query types show this is a personal insight or mental health query,
    // automatically use personal context
    if (queryTypes.isPersonalInsightQuery || queryTypes.isMentalHealthQuery) {
      usePersonalContext = true;
      console.log("Forcing personal context due to query type:", 
        queryTypes.isPersonalInsightQuery ? "personal insight" : "mental health");
    }
    
    // Use our advanced classifier to determine if this should use personal context
    if (!usePersonalContext) {
      try {
        const classification = enhancedQueryClassification(message);
        usePersonalContext = classification.category === 'JOURNAL_SPECIFIC' || classification.forceJournalSpecific;
        
        console.log("Message classification:", {
          category: classification.category,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          forceJournalSpecific: classification.forceJournalSpecific,
          usePersonalContext
        });
      } catch (error) {
        console.error("Error classifying message:", error);
      }
    }

    // Set up the parameters for the query planner
    const queryPlanParams = {
      message,
      userId,
      previousMessages: [], // We could add conversation context here
      isFollowUp,
      useHistoricalData: parameters.useHistoricalData || false
    };

    // Generate a query plan for the message
    const { data: planData, error: planError } = await supabase.functions.invoke('smart-query-planner', {
      body: queryPlanParams
    });

    if (planError) {
      console.error("Error calling query planner:", planError);
      throw new Error(`Failed to plan query: ${planError.message}`);
    }

    const queryPlan = planData?.queryPlan || planData?.plan || null;
    console.log("Generated query plan:", queryPlan);

    // Process the message based on the plan
    const chatParams = {
      message,
      userId,
      threadId,
      usePersonalContext,
      queryPlan,
      conversationHistory: [] // We could add full conversation history here
    };

    const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat-with-rag', {
      body: chatParams
    });

    if (chatError) {
      console.error("Error calling chat-with-rag:", chatError);
      throw new Error(`Failed to process chat: ${chatError.message}`);
    }

    // Prepare the response
    return {
      content: chatResponse?.response || "I couldn't generate a response at this time.",
      role: 'assistant',
      references: chatResponse?.references || [],
      analysis: chatResponse?.analysis || null,
      isInteractive: chatResponse?.isInteractive || false,
      interactiveOptions: chatResponse?.options || [],
      hasNumericResult: chatResponse?.hasNumericResult || false
    };
  } catch (error: any) {
    console.error("Error in processChatMessage:", error);
    return {
      content: `I encountered an error: ${error.message || "Unknown error"}. Please try again.`,
      role: 'error'
    };
  }
}
