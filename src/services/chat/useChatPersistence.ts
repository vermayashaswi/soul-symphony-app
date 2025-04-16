
import { useState, useEffect } from 'react';
import { ChatThread, ChatMessage } from './types';
import { getUserChatThreads, getThreadMessages } from './threadService';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for managing chat persistence
 * Provides threads, messages, and loading states
 */
export const useChatPersistence = (userId: string | undefined, initialThreadId?: string) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(initialThreadId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  // Listen for real-time updates to threads
  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }
    
    const loadThreads = async () => {
      setThreadsLoading(true);
      try {
        const threads = await getUserChatThreads(userId);
        setThreads(threads);
      } catch (error) {
        console.error("Error loading chat threads:", error);
      } finally {
        setThreadsLoading(false);
        setLoading(false);
      }
    };
    
    loadThreads();
    
    // Subscribe to changes in the chat_threads table
    const threadsSubscription = supabase
      .channel('chat_threads_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('Real-time thread update:', payload);
        loadThreads();
      })
      .subscribe();
      
    // Also listen for thread title updates via custom event
    const handleThreadTitleUpdate = (event: CustomEvent) => {
      if (event.detail?.threadId && event.detail?.title) {
        setThreads(prevThreads => 
          prevThreads.map(thread => 
            thread.id === event.detail.threadId 
              ? { ...thread, title: event.detail.title } 
              : thread
          )
        );
      }
    };
    
    window.addEventListener('threadTitleUpdated' as any, handleThreadTitleUpdate);
    
    return () => {
      threadsSubscription.unsubscribe();
      window.removeEventListener('threadTitleUpdated' as any, handleThreadTitleUpdate);
    };
  }, [userId]);
  
  // Load messages for the current thread
  useEffect(() => {
    if (!currentThreadId) {
      setMessages([]);
      return;
    }
    
    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const messages = await getThreadMessages(currentThreadId);
        setMessages(messages);
      } catch (error) {
        console.error(`Error loading messages for thread ${currentThreadId}:`, error);
      } finally {
        setMessagesLoading(false);
      }
    };
    
    loadMessages();
    
    // Subscribe to message changes for the current thread
    const messagesSubscription = supabase
      .channel(`messages_${currentThreadId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${currentThreadId}`
      }, (payload) => {
        console.log('Real-time message update:', payload);
        loadMessages();
      })
      .subscribe();
      
    return () => {
      messagesSubscription.unsubscribe();
    };
  }, [currentThreadId]);
  
  // Add a message to the current thread
  const addMessage = async (content: string, sender: 'user' | 'assistant') => {
    if (!currentThreadId) return null;
    
    try {
      // Send directly to the database
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: currentThreadId,
          content,
          sender
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Also update thread timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentThreadId);
      
      // Return the new message
      return data as ChatMessage;
    } catch (error) {
      console.error("Error adding message:", error);
      return null;
    }
  };
  
  // Create a new thread
  const createThread = async (title: string = "New Conversation") => {
    if (!userId) return null;
    
    try {
      // Create a new thread
      const { data, error } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Set as current thread
      setCurrentThreadId(data.id);
      
      // Return the new thread
      return data as ChatThread;
    } catch (error) {
      console.error("Error creating thread:", error);
      return null;
    }
  };
  
  return {
    threads,
    messages,
    loading,
    threadsLoading,
    messagesLoading,
    currentThreadId,
    setCurrentThreadId,
    addMessage,
    createThread
  };
};
