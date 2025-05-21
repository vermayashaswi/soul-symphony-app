
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ChatThread } from './types';
import { 
  createThread, 
  getUserChatThreads, 
  getThreadMessages, 
  saveMessage, 
  updateThreadTitle 
} from './messageService';

export function useChatPersistence(userId?: string | null, threadId?: string | null) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user threads
  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setLoadingThreads(false);
      return;
    }

    const loadThreads = async () => {
      try {
        setLoadingThreads(true);
        const userThreads = await getUserChatThreads(userId);
        setThreads(userThreads);
        setError(null);
      } catch (err) {
        console.error('Error loading threads:', err);
        setError('Failed to load conversation threads');
      } finally {
        setLoadingThreads(false);
      }
    };

    loadThreads();

    // Set up real-time subscription for thread updates
    const threadsSubscription = supabase
      .channel('public:chat_threads')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_threads', filter: `user_id=eq.${userId}` },
        () => {
          loadThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(threadsSubscription);
    };
  }, [userId]);

  // Load messages for a specific thread
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const threadMessages = await getThreadMessages(threadId);
        setMessages(threadMessages);
        setError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError('Failed to load conversation messages');
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();

    // Set up real-time subscription for message updates
    const messagesSubscription = supabase
      .channel('public:chat_messages')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSubscription);
    };
  }, [threadId]);

  // Function to create a new thread
  const createNewThread = async (title = 'New Conversation') => {
    if (!userId) {
      setError('User must be logged in to create a conversation');
      return null;
    }

    try {
      const newThread = await createThread(userId, title);
      setThreads(prev => [newThread, ...prev]);
      return newThread.id;
    } catch (err) {
      console.error('Error creating thread:', err);
      setError('Failed to create new conversation');
      return null;
    }
  };

  // Function to send a message
  const sendMessage = async (content: string, sender: 'user' | 'assistant' | 'error' = 'user') => {
    if (!threadId || !userId) {
      setError('Thread or user is not defined');
      return null;
    }

    try {
      const message: ChatMessage = {
        id: `temp-${Date.now()}`,
        thread_id: threadId,
        content,
        sender,
        role: sender,
        created_at: new Date().toISOString(),
      };

      // Update local state immediately for responsive UI
      setMessages(prev => [...prev, message]);

      // Update thread's updated_at timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      // Save the message to the database
      const savedMessage = await saveMessage(threadId, content, sender);
      
      if (savedMessage) {
        // Replace the temporary message with the saved version
        setMessages(prev => 
          prev.map(msg => msg.id === message.id ? savedMessage : msg)
        );
      }

      return savedMessage;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return null;
    }
  };

  // Function to update thread title
  const changeThreadTitle = async (newTitle: string) => {
    if (!threadId) {
      setError('Thread is not defined');
      return;
    }

    try {
      await updateThreadTitle(threadId, newTitle);
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId 
            ? { ...thread, title: newTitle, updated_at: new Date().toISOString() }
            : thread
        )
      );
    } catch (err) {
      console.error('Error updating thread title:', err);
      setError('Failed to update conversation title');
    }
  };

  return {
    threads,
    messages,
    loadingThreads,
    loadingMessages,
    error,
    createNewThread,
    sendMessage,
    changeThreadTitle
  };
}

export default useChatPersistence;
