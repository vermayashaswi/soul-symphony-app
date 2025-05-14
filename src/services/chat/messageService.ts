
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

export const getThreadMessages = async (threadId: string) => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return [];
  }
};

export const saveMessage = async (
  threadId: string,
  content: string,
  sender: 'user' | 'assistant',
  references: any[] | null = null,
  analysis: any = null,
  hasNumericResult: boolean = false,
  isInteractive: boolean = false,
  interactiveOptions: any[] = []
) => {
  try {
    const messageId = uuidv4();
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId,
        thread_id: threadId,
        content,
        sender,
        role: sender, // Role is the same as sender for compatibility
        reference_entries: references,
        analysis_data: analysis,
        has_numeric_result: hasNumericResult,
        isInteractive,
        interactiveOptions
      })
      .select()
      .single();

    if (error) throw error;
    
    // Update the thread's updated_at timestamp to sort by recent activity
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
    // Dispatch event for external listeners
    window.dispatchEvent(
      new CustomEvent('messageCreated', {
        detail: {
          threadId,
          messageId,
          content,
          sender,
          isFirstMessage: false // This will be updated by checking in the component
        }
      })
    );

    return data;
  } catch (error) {
    console.error('Error saving message:', error);
    return null;
  }
};

export const getUserMessages = async (userId: string, limit: number = 20) => {
  try {
    const { data: threads, error: threadsError } = await supabase
      .from('chat_threads')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (threadsError) throw threadsError;
    
    if (!threads || threads.length === 0) return [];
    
    const threadIds = threads.map(t => t.id);
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user messages:', error);
    return [];
  }
};
