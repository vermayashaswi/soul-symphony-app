
import { supabase } from '@/integrations/supabase/client';
import { ChatThread } from './types';
import { ConversationStateManager, IntentType } from '@/utils/chat/conversationStateManager';
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

// Updated with enhanced context handling and conversation state management
export async function getPlanForQuery(
  query: string, 
  userId: string, 
  conversationContext: any[] = [], 
  timezoneOffset: number = 0, 
  threadId?: string
) {
  if (!query || !userId) {
    return { plan: null, queryType: null, directResponse: null };
  }

  try {
    console.log(`Processing query: "${query}"`);
    
    // Initialize conversation state manager if we have a thread ID
    let stateManager: ConversationStateManager | null = null;
    let intentType: IntentType = 'new_query';
    let previousState = null;
    
    if (threadId) {
      stateManager = new ConversationStateManager(threadId, userId);
      previousState = await stateManager.loadState();
      
      // Analyze the intent of this query
      intentType = await stateManager.analyzeIntent(query);
      console.log(`Detected query intent: ${intentType}`);
    }

    // Prepare temporal context and reference date
    let referenceDate = undefined;
    let previousTimeContext = previousState?.timeContext || null;
    let previousTopicContext = previousState?.topicContext || null;
    let preserveTopicContext = false;
    
    // Special handling for time-based follow ups
    if (intentType === 'followup_time') {
      preserveTopicContext = true;
      console.log(`Preserving topic context: "${previousTopicContext}" for time follow-up`);
      
      // Calculate reference date from previous time context
      if (previousState?.timeContext) {
        const lastUpdateMetadata = previousState as any;
        if (lastUpdateMetadata.lastUpdated) {
          const lastUpdateDate = new Date(lastUpdateMetadata.lastUpdated);
          referenceDate = new Date(lastUpdateDate);
          console.log(`Using reference date for time calculation: ${referenceDate.toISOString()}`);
        }
      }
    }

    // Enhanced system context for the AI
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
          assumeHistoricalDataForMentalHealth: true,
          minimizeUnnecessaryClarifications: true
        }
      },
      userContext: {
        hasJournalEntries: true,
        timezoneOffset: timezoneOffset,
        conversationHistory: conversationContext.length,
        previousTimeContext: previousTimeContext,
        previousTopicContext: previousTopicContext,
        intentType: intentType,
        needsClarity: previousState?.needsClarity || false
      }
    };

    // Log comprehensive debugging information
    console.log(`Calling smart-query-planner with:
      Query: "${query}"
      Intent type: ${intentType}
      Conversation context length: ${conversationContext.length}
      Previous time context: ${previousTimeContext || 'none'}
      Previous topic context: ${previousTopicContext || 'none'}
      Preserve topic context: ${preserveTopicContext}
      Reference date: ${referenceDate ? referenceDate.toISOString() : 'none'}
    `);

    // Call the edge function with enhanced context
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message: query,
        userId,
        conversationContext,
        timezoneOffset,
        appContext: enhancedContext,
        checkForMultiQuestions: true,
        isFollowUp: intentType !== 'new_query',
        referenceDate: referenceDate?.toISOString(),
        preserveTopicContext: preserveTopicContext
      }
    });

    if (error) {
      console.error('Error planning query:', error);
      throw error;
    }

    console.log(`Received query plan with strategy: ${data?.plan?.strategy || 'none'}`);
    
    // Handle multi-part questions
    if (data?.plan && (intentType === 'multi_part' || data?.plan?.isSegmented)) {
      console.log('Processing multi-part query...');
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
        
        if (!segmentationResult.error && segmentationResult.data) {
          data.plan.subqueries = JSON.parse(segmentationResult.data.data);
          console.log(`Segmented into ${data.plan.subqueries.length} sub-queries`);
        }
      } catch (segmentError) {
        console.error('Error during query segmentation:', segmentError);
      }
    }
    
    // Save the conversation state if we have a state manager
    if (stateManager && data?.plan) {
      const newState = await stateManager.createState(query, data.plan, intentType);
      await stateManager.saveState(newState);
      console.log(`Saved conversation state with topic "${newState.topicContext}" and confidence ${newState.confidenceScore}`);
      
      // Add conversation state to the plan for the chat handler
      data.plan.conversationState = newState;
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
