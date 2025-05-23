import { supabase } from "@/integrations/supabase/client";
import { QueryTypes } from '../utils/chat/queryAnalyzer';
import { enhancedQueryClassification } from '../utils/chat/messageClassifier';
import { analyzeTimePatterns } from '@/utils/chat/timePatternAnalyzer';
import { showToast } from '@/utils/journal/toast-helper';
import { fetchWithRetry } from '@/utils/api-client';
import { useNetworkStatus, getNetworkStatus } from '@/utils/network';

type ProcessedResponse = {
  content: string;
  role: 'assistant' | 'error';
  references?: any[];
  analysis?: any;
  analysisMetadata?: any;
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
      
      // Show processing state to user
      console.log(`Starting time pattern analysis for user ${userId} over ${timeRange.periodName}`);
      
      // Check if we have entries in the specified time range before proceeding
      let hasEntriesInTimeRange = false;
      let entriesCount = 0;
      
      try {
        // First check if we have any entries in the specified time range
        const queryParams = {
          select: 'id',
          count: 'exact'
        };
        
        let query = supabase
          .from('Journal Entries')
          .select('id', { count: 'exact' })
          .eq('user_id', userId);
          
        // Add date filters if we have them
        if (timeRange.startDate) {
          query = query.gte('created_at', timeRange.startDate);
        }
        
        if (timeRange.endDate) {
          query = query.lte('created_at', timeRange.endDate);
        }
        
        const { count, error } = await query;
        
        if (!error && count !== null) {
          entriesCount = count;
          hasEntriesInTimeRange = count > 0;
          console.log(`Found ${entriesCount} entries in time range ${timeRange.periodName}`);
        } else if (error) {
          console.error("Error checking for entries in time range:", error);
        }
      } catch (checkError) {
        console.error("Error while checking for entries:", checkError);
      }
      
      // If we don't have entries in the time range, return friendly message
      if (!hasEntriesInTimeRange) {
        let noEntriesResponse = "";
        
        // Different messages based on the time period
        if (timeRange.periodName.includes("week")) {
          noEntriesResponse = "It looks like you don't have any journal entries from the last week. Time to start journaling regularly! I'll be here to help you analyze your patterns once you have some entries.";
        } else if (timeRange.periodName.includes("month")) {
          noEntriesResponse = "I don't see any journal entries from this month. Would you like to start a new journaling habit? I can help analyze your patterns once you have some entries.";
        } else if (timeRange.periodName.includes("day")) {
          noEntriesResponse = "You haven't created any journal entries today. Would you like to record your thoughts now?";
        } else {
          noEntriesResponse = `I don't see any journal entries for ${timeRange.periodName}. When you start journaling, I'll be able to analyze your patterns and provide insights.`;
        }
        
        return {
          content: noEntriesResponse,
          role: "assistant"
        };
      }
      
      // Analyze time patterns in journal entries
      const timePatternResults = await analyzeTimePatterns(userId, timeRange);
      
      console.log(`Time pattern analysis complete, found: ${timePatternResults.entryCount} entries`);
      
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
      
      // Clearly indicate how many entries were analyzed - using the ACTUAL count from the analysis
      response += `Based on analyzing ${timePatternResults.entryCount} of your journal entries${timeRange.periodName !== "all time" ? ` from ${timeRange.periodName}` : ""}, `;
      
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
      
      // Get conversation history for better context in future follow-ups
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
            console.log(`Found ${conversationHistory.length} previous messages for context in time analysis`);
          }
        } catch (error) {
          console.error("Error fetching conversation history for time analysis:", error);
        }
      }
      
      return {
        content: response,
        role: "assistant",
        analysis: timePatternResults,
        conversationContext: conversationHistory
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
      }
    }

    // Set up the parameters for the query planner
    const queryPlanParams = {
      message,
      userId,
      previousMessages: conversationHistory,  // Pass previous messages for context
      isFollowUp,
      useHistoricalData: parameters.useHistoricalData || false,
      // Add current date as reference date for better time understanding
      referenceDate: new Date().toISOString()
    };

    // Check network status before calling Edge Function
    const networkStatus = getNetworkStatus();
    if (!networkStatus.online) {
      console.log("User is offline - returning friendly message");
      return {
        content: "It seems you're currently offline. Please check your internet connection and try again.",
        role: 'assistant'
      };
    }

    // Generate a query plan for the message with better error handling
    try {
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

      try {
        const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat-with-rag', {
          body: chatParams
        });

        if (chatError) {
          console.error("Error calling chat-with-rag:", chatError);
          throw new Error(`Failed to process chat: ${chatError.message}`);
        }

        console.log("Raw chat-with-rag response:", chatResponse);
        console.log("Response structure:", {
          hasData: !!chatResponse,
          dataType: typeof chatResponse,
          dataKeys: chatResponse ? Object.keys(chatResponse) : [],
          dataValue: chatResponse
        });

        // Extract the response and analysis metadata
        let finalResponse;
        let analysisMetadata = null;
        
        if (chatResponse && typeof chatResponse === 'string') {
          finalResponse = chatResponse;
        } else if (chatResponse && chatResponse.data) {
          finalResponse = chatResponse.data;
          analysisMetadata = chatResponse.analysisMetadata;
        } else if (chatResponse && chatResponse.response) {
          finalResponse = chatResponse.response;
        } else {
          console.error("Unexpected response format from chat-with-rag:", chatResponse);
          finalResponse = null;
        }

        console.log("Final extracted response:", {
          hasResponse: !!finalResponse,
          responseType: typeof finalResponse,
          responseLength: finalResponse ? finalResponse.length : 0,
          hasAnalysisMetadata: !!analysisMetadata,
          firstChars: finalResponse ? finalResponse.substring(0, 100) : null
        });

        if (!finalResponse || typeof finalResponse !== 'string') {
          console.error("No valid response extracted from chat-with-rag");
          throw new Error("Failed to extract valid response from chat engine");
        }

        // Prepare the response
        return {
          content: finalResponse,
          role: 'assistant',
          references: chatResponse?.references || [],
          analysis: chatResponse?.analysis || null,
          analysisMetadata: analysisMetadata,
          isInteractive: chatResponse?.isInteractive || false,
          interactiveOptions: chatResponse?.options || [],
          hasNumericResult: chatResponse?.hasNumericResult || false
        };
      } catch (chatError) {
        console.error("Failed to process with chat-with-rag:", chatError);
        // Fallback to a simple response if chat-with-rag fails
        return {
          content: "I'm having trouble analyzing your journal entries right now. Please try again in a moment.",
          role: 'assistant'
        };
      }
    } catch (planError) {
      console.error("Failed to generate query plan:", planError);
      
      // Check if this seems to be a time-based question but the planner failed
      if (message.toLowerCase().includes('last week') || 
          message.toLowerCase().includes('yesterday') || 
          message.toLowerCase().includes('this month')) {
        
        // Provide a friendly fallback response for time-based queries
        let fallbackResponse = "I'm having trouble analyzing your entries right now. ";
        
        // Check if we can determine if there are any journal entries at all
        try {
          const { count, error } = await supabase
            .from('Journal Entries')
            .select('id', { count: 'exact' })
            .eq('user_id', userId);
            
          if (!error && count !== null) {
            if (count === 0) {
              fallbackResponse = "It looks like you don't have any journal entries yet. Start journaling, and I'll be able to provide insights based on your entries!";
            } else {
              fallbackResponse += `You have ${count} journal entries. Please try your question again later when the service is back online.`;
            }
          }
        } catch (error) {
          console.error("Error in fallback check for entries:", error);
        }
        
        return {
          content: fallbackResponse,
          role: 'assistant',
        };
      }
      
      // General fallback for other failed queries
      return {
        content: "I'm having trouble processing your question right now. Please try again in a moment.",
        role: 'assistant'
      };
    }
  } catch (error: any) {
    console.error("Error in processChatMessage:", error);
    
    // Format an appropriate error message based on the error type
    let errorMessage = "I encountered an error. Please try again.";
    
    if (error.message?.includes("network") || error.message?.includes("timeout") || 
        error.message?.includes("Failed to fetch")) {
      errorMessage = "There seems to be a network issue. Please check your internet connection and try again.";
    } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
      errorMessage = "We've temporarily reached our processing limit. Please try again in a few minutes.";
    }
    
    return {
      content: errorMessage,
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
