
import { supabase } from "@/integrations/supabase/client";
import { QueryTypes } from '../utils/chat/queryAnalyzer';
import { enhancedQueryClassification } from '../utils/chat/messageClassifier';
import { analyzeTimePatterns } from '@/utils/chat/timePatternAnalyzer';

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
  queryTypes: any, 
  threadId: string,
  isFollowUp: boolean = false,
  parameters: Record<string, any> = {}
) {
  // Check if this is a time pattern query
  if (queryTypes.isTimePatternQuery || message.toLowerCase().includes('what time') || 
      message.toLowerCase().includes('when do i usually')) {
    try {
      console.log("Executing time pattern analysis strategy");
      
      // Get time range from query or use default
      const timeRange = queryTypes.timeRange || {
        startDate: null,
        endDate: null,
        periodName: "all time",
        duration: 0
      };
      
      // Analyze time patterns in journal entries
      const timePatternResults = await analyzeTimePatterns(userId, timeRange);
      
      if (!timePatternResults.hasEntries) {
        return {
          content: "I don't see any journal entries that match what you're asking about for the specified time period.",
          role: "assistant"
        };
      }
      
      // Format the response based on time pattern analysis
      let response = "";
      
      // Add information about when the user journals most frequently
      const { timeDistribution } = timePatternResults;
      const timeOfDayPreference = getTimeOfDayPreference(timeDistribution);
      
      response += `Based on your ${timePatternResults.entryCount} journal entries, `;
      
      if (timeOfDayPreference) {
        response += `you typically prefer journaling during the ${timeOfDayPreference.period} (${timeOfDayPreference.percentage}% of your entries). `;
      } else {
        response += "I don't see a strong pattern in when you journal. ";
      }
      
      // Add frequency information
      const { frequencyPatterns } = timePatternResults;
      if (frequencyPatterns && frequencyPatterns.consistency) {
        response += `Your journaling pattern is ${frequencyPatterns.consistency}. `;
        
        if (frequencyPatterns.longestStreak > 1) {
          response += `Your longest journaling streak was ${frequencyPatterns.longestStreak} consecutive days. `;
        }
      }
      
      // Add most active day information
      if (timePatternResults.mostActiveDay && timePatternResults.mostActiveDay.date) {
        const date = new Date(timePatternResults.mostActiveDay.date);
        const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        response += `Your most active journaling day was ${formattedDate} with ${timePatternResults.mostActiveDay.entryCount} entries.`;
      }
      
      return {
        content: response,
        role: "assistant",
        analysis: timePatternResults
      };
    } catch (error) {
      console.error("Error processing time pattern query:", error);
      return {
        content: "I encountered an error analyzing your journaling time patterns. Please try again later.",
        role: "error"
      };
    }
  }
  
  // Continue with the rest of the processing for other query types
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

    // Get conversation history for better context
    let conversationHistory = [];
    if (threadId) {
      try {
        const { data: chatMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, role')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && chatMessages && chatMessages.length > 0) {
          // Format messages for OpenAI context
          conversationHistory = chatMessages
            .reverse()
            .map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.content
            }));
          console.log(`Found ${conversationHistory.length} previous messages for context`);
        }
      } catch (error) {
        console.error("Error fetching conversation history:", error);
        // Continue with empty history if there's an error
      }
    }

    // Set up the parameters for the query planner
    const queryPlanParams = {
      message,
      userId,
      previousMessages: conversationHistory,  // Pass previous messages for context
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
      conversationHistory // Pass the conversation history to chat-with-rag
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

// Helper function to determine time of day preference
function getTimeOfDayPreference(timeDistribution) {
  if (!timeDistribution) return null;
  
  const total = timeDistribution.morning + timeDistribution.afternoon + 
                timeDistribution.evening + timeDistribution.night;
                
  if (total === 0) return null;
  
  const periods = [
    { period: "morning", count: timeDistribution.morning },
    { period: "afternoon", count: timeDistribution.afternoon },
    { period: "evening", count: timeDistribution.evening },
    { period: "night", count: timeDistribution.night }
  ];
  
  // Sort by count, descending
  periods.sort((a, b) => b.count - a.count);
  
  // Return the highest count period
  if (periods[0].count > 0) {
    return {
      period: periods[0].period,
      count: periods[0].count,
      percentage: Math.round((periods[0].count / total) * 100)
    };
  }
  
  return null;
}
