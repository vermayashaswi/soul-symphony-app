
import { supabase } from '@/integrations/supabase/client';

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

export async function generateThreadTitle(threadId: string, userId: string | undefined) {
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

export async function getPlanForQuery(query: string, userId: string, conversationContext: any[] = [], timezoneOffset: number = 0) {
  if (!query || !userId) {
    return { plan: null, queryType: null, directResponse: null };
  }

  try {
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message: query,
        userId,
        conversationContext,
        timezoneOffset
      }
    });

    if (error) {
      console.error('Error planning query:', error);
      throw error;
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
