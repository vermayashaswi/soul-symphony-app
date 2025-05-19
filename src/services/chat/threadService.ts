
import { supabase } from '@/integrations/supabase/client';
import { ChatThread } from './types';
import { detectRelativeTimeExpression, calculateRelativeDateRange, extractReferenceDate, isRelativeTimeQuery } from '@/utils/chat/dateUtils';

export async function fetchChatThreads(userId: string | undefined) {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching chat threads:', error);
    return [];
  }
}

// Add this function to fix the getUserChatThreads import error
export const getUserChatThreads = fetchChatThreads;

export async function deleteThread(threadId: string) {
  try {
    // First delete all messages in the thread
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('thread_id', threadId);

    if (messagesError) {
      throw messagesError;
    }

    // Then delete the thread itself
    const { error: threadError } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', threadId);

    if (threadError) {
      throw threadError;
    }

    return true;
  } catch (error) {
    console.error('Error deleting thread:', error);
    return false;
  }
}

export async function generateThreadTitle(threadId: string, userId: string | undefined): Promise<string | null> {
  if (!threadId || !userId) {
    return null;
  }

  try {
    // Get the first few messages from the thread
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('content, sender, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(3);

    if (messagesError) {
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return 'New Conversation';
    }

    // Format messages for the AI
    const formattedMessages = messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add system prompt for title generation
    formattedMessages.unshift({
      role: 'system',
      content: `You are helping to generate a short, concise title (maximum 5-6 words) for a conversation thread. Based on the following conversation, provide ONLY the title with no additional text, quotes or explanation. The title should capture the main topic or question the user was asking about. It should be very concise, like a headline.`
    });

    // Call the smart-chat function to generate a title
    const { data, error } = await supabase.functions.invoke('smart-chat', {
      body: {
        userId,
        generateTitleOnly: true,
        messages: formattedMessages
      }
    });

    if (error) {
      throw error;
    }

    return data?.title || 'New Conversation';
  } catch (error) {
    console.error('Error generating thread title:', error);
    return 'New Conversation';
  }
}

// Add this function to fix the updateThreadTitle import error
export async function updateThreadTitle(threadId: string, title: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chat_threads')
      .update({ title })
      .eq('id', threadId);

    if (error) {
      console.error('Error updating thread title:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateThreadTitle:', error);
    return false;
  }
}

// Store and retrieve conversation context including time context
export async function storeConversationContext(threadId: string, plan: any): Promise<boolean> {
  if (!threadId || !plan) return false;

  try {
    // Extract key context data from the plan
    const contextData = {
      timeContext: plan.filters?.dateRange?.periodName || null,
      topicContext: plan.topicContext || null,
      lastUpdated: new Date().toISOString()
    };

    // Store the context in thread metadata
    const { error } = await supabase
      .from('chat_threads')
      .update({
        metadata: contextData
      })
      .eq('id', threadId);

    if (error) {
      console.error('Error storing conversation context:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in storeConversationContext:', error);
    return false;
  }
}

export async function getConversationContext(threadId: string): Promise<any | null> {
  if (!threadId) return null;

  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('metadata')
      .eq('id', threadId)
      .single();

    if (error || !data) {
      console.error('Error retrieving conversation context:', error);
      return null;
    }

    return data.metadata;
  } catch (error) {
    console.error('Error in getConversationContext:', error);
    return null;
  }
}

export async function getPlanForQuery(query: string, userId: string, conversationContext: any[] = [], timezoneOffset: number = 0, threadId?: string) {
  if (!query || !userId) {
    return { plan: null, queryType: null, directResponse: null };
  }

  try {
    // Get previous conversation context if available
    let previousTimeContext = null;
    let previousTopicContext = null;
    let referenceDate = undefined;
    
    if (threadId) {
      const storedContext = await getConversationContext(threadId);
      if (storedContext) {
        previousTimeContext = storedContext.timeContext;
        previousTopicContext = storedContext.topicContext;
        console.log(`Retrieved previous context - Time: ${previousTimeContext}, Topic: ${previousTopicContext}`);
        
        // Check if this is a time-based follow-up question
        const timeExpression = detectRelativeTimeExpression(query);
        const isTimeQuery = isRelativeTimeQuery(query);
        
        if ((timeExpression || isTimeQuery) && previousTimeContext) {
          console.log(`Detected time expression in follow-up: "${timeExpression || query}"`);
          
          // If we have a previous time context, use it to calculate the reference date
          if (previousTimeContext && storedContext.lastUpdated) {
            // Use the date from last update as reference point
            const lastUpdateDate = new Date(storedContext.lastUpdated);
            
            // Calculate a proper reference date based on previous time context
            if (previousTimeContext.includes("month")) {
              console.log(`Previous context was month-related: ${previousTimeContext}`);
              
              // For month-based references, adjust accordingly
              if (previousTimeContext.includes("last month")) {
                // If previous was "last month", reference should be 1 month before now
                referenceDate = new Date(lastUpdateDate);
                referenceDate.setMonth(referenceDate.getMonth() - 1);
              } else if (previousTimeContext.includes("this month")) {
                // If previous was "this month", reference should be current month
                referenceDate = new Date(lastUpdateDate);
              }
              
              console.log(`Using reference date for time calculation: ${referenceDate?.toISOString()}`);
            } else {
              // For other time periods, use the last update as reference
              referenceDate = new Date(lastUpdateDate);
            }
          }
        }
      }
    }

    // Enhanced system context for the AI with detailed app information
    const enhancedContext = {
      appInfo: {
        name: "SOULo",
        type: "Voice Journaling App",
        purpose: "Mental Health Support and Self-Reflection",
        role: "Mental Health Assistant",
        features: ["Journal Analysis", "Emotion Tracking", "Pattern Detection", "Self-Reflection Support", "Personality Insights"],
        capabilities: {
          canAnalyzeJournals: true,
          canDetectPatterns: true,
          canProvideRatings: true,
          canSegmentQueries: true,
          canAnalyzePersonality: true,
          canHandleMultiQuestions: true
        },
        preferenceDefaults: {
          assumeHistoricalDataForMentalHealth: true, // Default to using all data for mental health insights
          minimizeUnnecessaryClarifications: true    // Try to avoid unnecessary clarifications
        }
      },
      userContext: {
        hasJournalEntries: true, // This is a placeholder - ideally would be dynamic
        timezoneOffset: timezoneOffset,
        conversationHistory: conversationContext.length,
        previousTimeContext: previousTimeContext,
        previousTopicContext: previousTopicContext
      }
    };

    // Add detailed logging
    console.log(`Calling smart-query-planner with enhanced app context:`, 
                JSON.stringify(enhancedContext, null, 2).substring(0, 200) + "...");
    console.log(`Conversation context length: ${conversationContext.length}`);
    console.log(`Previous time context: ${previousTimeContext || 'none'}`);
    console.log(`Previous topic context: ${previousTopicContext || 'none'}`);
    console.log(`Reference date: ${referenceDate ? referenceDate.toISOString() : 'none'}`);
    
    if (conversationContext.length > 0) {
      console.log(`Latest context message: ${conversationContext[conversationContext.length - 1].content.substring(0, 50)}...`);
    }

    // Check if this might be a multi-part question that needs segmentation
    const shouldCheckForMultiQuestions = 
      query.includes(" and ") || 
      query.includes(" also ") || 
      (query.match(/\?/g) || []).length > 1 ||
      query.length > 100;

    console.log(`Query might contain multiple questions: ${shouldCheckForMultiQuestions}`);

    // Call the edge function with enhanced context
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message: query,
        userId,
        conversationContext,
        timezoneOffset,
        appContext: enhancedContext, // Pass the enhanced app context
        checkForMultiQuestions: true, // Always check for multiple questions
        isFollowUp: conversationContext.length > 0, // Indicate if this is a follow-up question
        referenceDate: referenceDate?.toISOString(),  // Pass reference date if available
        preserveTopicContext: isRelativeTimeQuery(query) && previousTopicContext // Preserve topic from previous query if this is just a time change
      }
    });

    if (error) {
      console.error('Error planning query:', error);
      throw error;
    }

    // Log the returned plan for debugging
    console.log(`Received query plan: ${JSON.stringify(data?.plan || {}, null, 2).substring(0, 200)}...`);

    // Check if we need to segment the query
    if (data?.plan?.isSegmented && shouldCheckForMultiQuestions) {
      console.log('Query plan indicates this is a segmented query - processing as multi-question');
      
      // Call segment-complex-query function to break down the complex question
      try {
        const segmentationResult = await supabase.functions.invoke('segment-complex-query', {
          body: {
            query: query,
            userId,
            appContext: enhancedContext,
            referenceDate: referenceDate?.toISOString(),
            previousTopicContext: previousTopicContext
          }
        });
        
        if (segmentationResult.error) {
          console.error('Error segmenting query:', segmentationResult.error);
        } else if (segmentationResult.data) {
          console.log('Successfully segmented query:', segmentationResult.data);
          
          // Update the plan with the segmented queries
          if (data.plan) {
            data.plan.subqueries = JSON.parse(segmentationResult.data.data);
            console.log('Updated plan with segmented queries:', data.plan.subqueries);
          }
        }
      } catch (segmentError) {
        console.error('Exception during query segmentation:', segmentError);
      }
    }
    
    // If this is a time-based follow-up but preserving topic context,
    // make sure the topic gets stored in the plan
    if (isRelativeTimeQuery(query) && previousTopicContext && data?.plan) {
      // Ensure the topic context is preserved
      data.plan.topicContext = previousTopicContext;
      console.log(`Preserved topic context in plan: ${previousTopicContext}`);
    }
    
    // Store context if threadId provided
    if (threadId && data?.plan) {
      await storeConversationContext(threadId, data.plan);
    }

    return {
      plan: data?.plan || null,
      queryType: data?.queryType || null,
      directResponse: data?.directResponse || null
    };
  } catch (error) {
    console.error('Error planning query:', error);
    return { plan: null, queryType: 'journal_specific', directResponse: null };
  }
}
