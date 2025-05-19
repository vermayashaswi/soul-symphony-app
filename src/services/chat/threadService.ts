
import { supabase } from '@/integrations/supabase/client';
import { ChatThread } from './types';

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

export async function getPlanForQuery(query: string, userId: string, conversationContext: any[] = [], timezoneOffset: number = 0) {
  if (!query || !userId) {
    return { plan: null, queryType: null, directResponse: null };
  }

  try {
    // Enhanced system context for the AI with detailed app information
    const enhancedContext = {
      appInfo: {
        name: "SOULo",
        type: "Voice Journaling App",
        purpose: "Mental Health Support and Self-Reflection",
        role: "Mental Health Assistant",
        features: ["Journal Analysis", "Emotion Tracking", "Pattern Detection", "Self-Reflection Support"],
        capabilities: {
          canAnalyzeJournals: true,
          canDetectPatterns: true,
          canProvideRatings: true,
          canSegmentQueries: true
        }
      },
      userContext: {
        hasJournalEntries: true, // This is a placeholder - ideally would be dynamic
        timezoneOffset: timezoneOffset,
        conversationHistory: conversationContext.length
      }
    };

    // Add detailed logging
    console.log(`Calling smart-query-planner with enhanced app context:`, 
                JSON.stringify(enhancedContext, null, 2).substring(0, 200) + "...");
    console.log(`Conversation context length: ${conversationContext.length}`);
    if (conversationContext.length > 0) {
      console.log(`Latest context message: ${conversationContext[conversationContext.length - 1].content.substring(0, 50)}...`);
    }

    // Call the edge function with enhanced context
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message: query,
        userId,
        conversationContext,
        timezoneOffset,
        appContext: enhancedContext, // Pass the enhanced app context
        checkForMultiQuestions: true // New flag to indicate we want to check for multiple questions
      }
    });

    if (error) {
      console.error('Error planning query:', error);
      throw error;
    }

    // Log the returned plan for debugging
    console.log(`Received query plan: ${JSON.stringify(data?.plan || {}, null, 2).substring(0, 200)}...`);

    // If the plan indicates multiple questions, we might want to segment them
    if (data?.plan?.isSegmented) {
      console.log('Query plan indicates this is a segmented query - should process as multi-question');
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
