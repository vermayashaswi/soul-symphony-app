
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ChatThread } from './types';

// Get all chat threads for a user
export async function fetchChatThreads(userId: string): Promise<ChatThread[]> {
  try {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching chat threads:', error);
      return [];
    }

    // Map the data to the ChatThread type with correct property names
    const chatThreads: ChatThread[] = data.map(thread => ({
      id: thread.id,
      user_id: thread.user_id,
      title: thread.title,
      created_at: thread.created_at,
      updated_at: thread.updated_at
    }));

    return chatThreads;
  } catch (error) {
    console.error('Error in fetchChatThreads:', error);
    return [];
  }
}

// Update a thread's title
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

// Generate a title for a thread based on its content
export async function generateThreadTitle(threadId: string, userId: string): Promise<string | null> {
  try {
    // Fetch the messages for the thread
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(3); // Consider only the first 3 messages

    if (messagesError) {
      console.error('Error fetching messages for title generation:', messagesError);
      return null;
    }

    // Extract the content of the messages
    const messageContents = messages.map(msg => msg.content).join('\n');

    // Call the Edge Function to generate the title
    const { data, error } = await supabase.functions.invoke('generate-chat-title', {
      body: {
        userId: userId,
        message: messageContents,
      },
    });

    if (error) {
      console.error('Error generating title:', error);
      return null;
    }

    // Return the generated title
    return data?.title || null;
  } catch (error) {
    console.error('Error in generateThreadTitle:', error);
    return null;
  }
}

// Get a query plan from the smart-query-planner function
export async function getPlanForQuery(
  query: string, 
  userId: string, 
  conversationContext: { content: string; sender: string }[] = [],
  clientTimestamp?: string // Modified to only accept timestamp
) {
  try {
    const { data, error } = await supabase.functions.invoke('smart-query-planner', {
      body: {
        message: query,
        userId,
        conversationContext,
        clientTimestamp // Pass only the client timestamp
      }
    });
    
    if (error) {
      console.error('Error getting query plan:', error);
      return { plan: null, queryType: 'journal_specific', directResponse: null };
    }
    
    return {
      plan: data?.plan || null,
      queryType: data?.queryType || 'journal_specific',
      directResponse: data?.directResponse || null
    };
  } catch (error) {
    console.error('Error in getPlanForQuery:', error);
    return { plan: null, queryType: 'journal_specific', directResponse: null };
  }
}
