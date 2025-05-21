
import { supabase } from '@/integrations/supabase/client';
import { ChatThread } from './types';
import { ConversationStateManager, IntentType } from '@/utils/chat/conversationStateManager';
import { detectRelativeTimeExpression, calculateRelativeDateRange, isRelativeTimeQuery } from '@/utils/chat/dateUtils';
import { enhanceQueryWithContext } from '@/utils/chat/messageProcessor';

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

// IMPROVEMENT: Updated with enhanced context handling and conversation state management, especially for mental health queries
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
    
    // Check if this is likely a mental health related query
    const isMentalHealthQuery = checkForMentalHealthQuery(query);
    const isPersonalQuery = checkForPersonalQuery(query);
    
    if (isMentalHealthQuery) {
      console.log("Detected mental health related query");
    }
    
    if (isPersonalQuery) {
      console.log("Detected personal query requesting specific advice");
    }
    
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

    // IMPROVEMENT: Enhanced system context for the AI with mental health indicators
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
          minimizeUnnecessaryClarifications: true,
          prioritizeJournalAnalysisForMentalHealth: true
        }
      },
      userContext: {
        hasJournalEntries: true,
        timezoneOffset: timezoneOffset,
        conversationHistory: conversationContext.length,
        previousTimeContext: previousTimeContext,
        previousTopicContext: previousTopicContext,
        intentType: intentType,
        needsClarity: previousState?.needsClarity || false,
        isMentalHealthQuery: isMentalHealthQuery,
        isPersonalQuery: isPersonalQuery
      }
    };

    // Log comprehensive debugging information
    console.log(`Calling smart-query-planner with:
      Query: "${query}"
      Intent type: ${intentType}
      Mental health query: ${isMentalHealthQuery}
      Personal query: ${isPersonalQuery}
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
    
    // IMPROVEMENT: If mental health query but no plan returned, create a default plan
    if ((isMentalHealthQuery || isPersonalQuery) && (!data?.plan || !data?.plan.strategy)) {
      console.log('Creating default plan for mental health query');
      data.plan = {
        strategy: 'hybrid',
        filters: {
          date_range: {
            startDate: calculateDefaultDateRange().startDate,
            endDate: calculateDefaultDateRange().endDate,
            periodName: 'recent (last 30 days)'
          }
        },
        match_count: 30,
        needsDataAggregation: true,
        needsMoreContext: false,
        isMentalHealthQuery: isMentalHealthQuery,
        isPersonalQuery: isPersonalQuery,
        topicContext: isMentalHealthQuery ? 'mental health' : 'personal advice',
        confidenceScore: 0.8,
        reasoning: 'Using journal analysis for personalized insights.'
      };
      
      data.queryType = 'journal_specific';
    }
    
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
      // IMPROVEMENT: Ensure mental health context is preserved in conversation state
      if (isMentalHealthQuery && !data.plan.isMentalHealthQuery) {
        data.plan.isMentalHealthQuery = true;
      }
      if (isPersonalQuery && !data.plan.isPersonalQuery) {
        data.plan.isPersonalQuery = true;
      }
    
      const newState = await stateManager.createState(query, data.plan, intentType);
      await stateManager.saveState(newState);
      console.log(`Saved conversation state with topic "${newState.topicContext}" and confidence ${newState.confidenceScore}`);
      
      // Add conversation state to the plan for the chat handler
      data.plan.conversationState = newState;
    }

    // IMPROVEMENT: Enforce journal-specific for mental health queries
    if ((isMentalHealthQuery || isPersonalQuery) && data.queryType === 'general') {
      console.log('Overriding query type from general to journal_specific for mental health query');
      data.queryType = 'journal_specific';
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

// IMPROVEMENT: Helper function to check for mental health related queries
function checkForMentalHealthQuery(query: string): boolean {
  const mentalHealthKeywords = [
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 
    'feeling', 'therapy', 'therapist', 'psychiatrist', 'psychologist', 
    'counselor', 'counseling', 'wellbeing', 'well-being', 'wellness',
    'self-care', 'burnout', 'overwhelm', 'mindfulness', 'meditation',
    'coping', 'psychological', 'emotional health', 'distress'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // Check for mental health keywords
  for (const keyword of mentalHealthKeywords) {
    if (lowerQuery.includes(keyword)) {
      return true;
    }
  }
  
  // Check for phrases commonly used in mental health contexts
  const mentalHealthPatterns = [
    /\b(?:i (?:feel|am feeling|have been feeling))\b/i,
    /\b(?:help|improve) (?:my|with) (?:mental|emotional)/i,
    /\b(?:my|with) (?:mental|emotional) (?:health|state|wellbeing)/i,
    /\bhow (?:to|can i|should i) (?:feel better|improve|help)/i,
    /\badvice (?:for|on|about) (?:my|dealing with|handling)/i
  ];
  
  for (const pattern of mentalHealthPatterns) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

// IMPROVEMENT: Helper function to check for personal queries
function checkForPersonalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Check for first-person pronouns and possessives with advice-seeking language
  const personalIndicators = [
    /\bmy\b.*\b(?:advice|help|suggest|how|what|should)/i,
    /\bi\b.*\b(?:need|want|should|could|would|can)/i,
    /\bshould i\b/i, 
    /\bcan i\b/i, 
    /\bcould i\b/i,
    /\bwould i\b/i, 
    /\bdo i\b/i,
    /\badvice for me\b/i,
    /\bhelp me\b/i,
    /\b(?:advice|help|suggest|recommendation)s?\b.*\bfor\b.*\bme\b/i
  ];
  
  for (const pattern of personalIndicators) {
    if (pattern.test(lowerQuery)) {
      return true;
    }
  }
  
  return false;
}

// IMPROVEMENT: Helper function to calculate default date range for mental health queries
function calculateDefaultDateRange() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  
  return {
    startDate: thirtyDaysAgo.toISOString(),
    endDate: now.toISOString()
  };
}
