
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { generateThreadTitle } from '@/utils/chat/threadUtils';
import { getPlanForQuery } from './threadService';
import { convertGptPlanToQueryPlan } from './queryPlannerService';
import { Json } from '@/integrations/supabase/types';

export interface ChatMessageType {
  id: string;
  threadId: string;
  content: string;
  sender: 'user' | 'assistant';
  createdAt: string;
  references?: any[] | Json | null;  // Updated to accept Json type as well
  isLoading?: boolean;
  isError?: boolean;
}

export interface ChatThreadType {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function useChatPersistence(queryClient: QueryClient) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThreadType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    // Reset state when user changes
    if (!user) {
      setMessages([]);
      setActiveThread(null);
      setLoading(false);
    }
  }, [user]);

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (!user) {
      console.error("User must be authenticated to create a thread");
      return null;
    }

    setLoading(true);
    try {
      const threadId = uuidv4();
      const { error } = await supabase.from('chat_threads').insert({
        id: threadId,
        user_id: user.id,
        title: 'New Conversation'
      });

      if (error) throw error;

      const newThread: ChatThreadType = {
        id: threadId,
        userId: user.id,
        title: 'New Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setActiveThread(newThread);
      setMessages([]);
      
      // Fix the InvalidateQueryFilters error by using the correct format
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
      return threadId;
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to create a new conversation thread.",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, queryClient]);

  // Function to load a thread by ID
  const loadThread = useCallback(async (threadId: string) => {
    if (!user || !threadId) {
      return;
    }

    setLoading(true);
    try {
      // First fetch thread metadata
      const { data: threadData, error: threadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();

      if (threadError) throw threadError;
      
      if (!threadData) {
        console.error("Thread not found");
        setActiveThread(null);
        setMessages([]);
        return;
      }

      // Set active thread
      const thread: ChatThreadType = {
        id: threadData.id,
        userId: threadData.user_id,
        title: threadData.title,
        createdAt: threadData.created_at,
        updatedAt: threadData.updated_at
      };
      
      setActiveThread(thread);
      
      // Then fetch messages for this thread
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Fixed: Properly type the message data and handle references safely
      const formattedMessages: ChatMessageType[] = (messagesData || []).map(msg => ({
        id: msg.id,
        threadId: msg.thread_id,
        content: msg.content,
        sender: (msg.sender === 'user' || msg.sender === 'assistant') ? msg.sender : 'assistant',
        createdAt: msg.created_at,
        references: msg.reference_entries  // This can be any[] | Json | null
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Error loading thread:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation thread.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function to add a user message and get a response
  const sendMessage = useCallback(async (content: string) => {
    if (!user) {
      console.error("User must be authenticated to send messages");
      return;
    }

    // Create a new thread if needed
    let threadId = activeThread?.id;
    let isFirstMessage = false;
    
    if (!threadId) {
      threadId = await createThread();
      if (!threadId) return;
      isFirstMessage = true;
    }

    setIsSaving(true);

    try {
      // Add user message to UI immediately with loading state
      const userMessageId = uuidv4();
      const userMessage: ChatMessageType = {
        id: userMessageId,
        threadId,
        content,
        sender: 'user',
        createdAt: new Date().toISOString(),
      };

      const assistantMessageId = uuidv4();
      const assistantMessage: ChatMessageType = {
        id: assistantMessageId,
        threadId,
        content: '',
        sender: 'assistant',
        createdAt: new Date().toISOString(),
        isLoading: true
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);

      // Save user message to database
      const { error: saveError } = await supabase.from('chat_messages').insert({
        id: userMessageId,
        thread_id: threadId,
        content,
        sender: 'user'
      });

      if (saveError) throw saveError;
      
      // Dispatch event that message was created
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId, 
            messageId: userMessageId,
            isFirstMessage
          } 
        })
      );
      
      // Update the thread's updated_at timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      // Call edge function to ensure persistence and get user's timezone offset
      const timezoneOffset = new Date().getTimezoneOffset();
      console.log(`Local timezone offset: ${timezoneOffset} minutes`);

      const { data: persistenceData, error: persistenceError } = await supabase.functions.invoke('ensure-chat-persistence', {
        body: {
          userId: user.id,
          threadId,
          messageId: userMessageId,
          content,
          timezoneOffset
        }
      });

      if (persistenceError) {
        console.error("Error ensuring persistence:", persistenceError);
      }

      // Get query plan based on user's message and pass it along with the conversation context
      const contextMessages = messages.map(msg => ({
        content: msg.content,
        sender: msg.sender
      }));

      const { plan, queryType, directResponse } = await getPlanForQuery(content, user.id, contextMessages, timezoneOffset);
      
      let apiResponse: any = null;
      let references: any[] = [];

      if (directResponse) {
        // If we got a direct response, use it
        apiResponse = { data: directResponse };
      } else if (queryType !== 'journal_specific' || !plan) {
        // If not a journal query or no plan, use the smart-chat endpoint
        const { data, error } = await supabase.functions.invoke('smart-chat', {
          body: {
            userId: user.id,
            message: content,
            threadId,
            timeRange: plan?.filters?.dateRange
          }
        });
        
        apiResponse = { data, error };
      } else {
        // For journal queries with a plan, use the chat-with-rag endpoint
        const queryPlan = convertGptPlanToQueryPlan(plan);
        
        const { data, error } = await supabase.functions.invoke('chat-with-rag', {
          body: {
            userId: user.id,
            message: content,
            threadId,
            conversationContext: contextMessages,
            queryPlan,
            includeDiagnostics: false,
            timezoneOffset
          }
        });
        
        if (data?.references) {
          references = data.references;
        }
        
        apiResponse = { 
          data: data?.response || data?.data, 
          error,
          noEntriesForTimeRange: data?.noEntriesForTimeRange
        };
      }

      if (apiResponse.error) {
        throw apiResponse.error;
      }

      // If we get a warning about no entries for a time range
      if (apiResponse.noEntriesForTimeRange) {
        console.log("No entries for specified time range");
      }

      // Save assistant response to database
      const assistantContent = apiResponse.data || "I'm sorry, I couldn't generate a response.";
      
      const { error: assistantSaveError } = await supabase.from('chat_messages').insert({
        id: assistantMessageId,
        thread_id: threadId,
        content: assistantContent,
        sender: 'assistant',
        reference_entries: references.length > 0 ? references : null
      });

      if (assistantSaveError) throw assistantSaveError;

      // Update assistant message in UI
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: assistantContent, isLoading: false, references }
          : msg
      ));

      // Update thread timestamp again after assistant response
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);
      
      // Fix the InvalidateQueryFilters error by using the correct format
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
      return {
        userMessageId,
        assistantMessageId,
        threadId,
        response: assistantContent
      };
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Update assistant message with error
      setMessages(prev => prev.map(msg => 
        msg.sender === 'assistant' && msg.isLoading 
          ? { 
              ...msg, 
              content: "I'm sorry, I encountered an error while processing your request. Please try again.", 
              isLoading: false,
              isError: true
            }
          : msg
      ));
      
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [user, activeThread, messages, createThread]);

  // Function to generate or update thread title
  const updateThreadTitle = useCallback(async (threadId: string, newTitle?: string) => {
    if (!user || !threadId) return;
    
    try {
      let title = newTitle;
      
      // If no title provided, generate one
      if (!title) {
        title = await generateThreadTitle(threadId, user.id);
        if (!title) return;
      }
      
      // Update in database
      const { error } = await supabase
        .from('chat_threads')
        .update({ title })
        .eq('id', threadId);
      
      if (error) throw error;
      
      // Update local state if this is the active thread
      if (activeThread?.id === threadId) {
        setActiveThread(prev => prev ? { ...prev, title } : null);
      }
      
      // Fix the InvalidateQueryFilters error by using the correct format
      queryClient.invalidateQueries({ queryKey: ['chatThreads'] });
      
      // Dispatch event that thread title was updated
      window.dispatchEvent(
        new CustomEvent('threadTitleUpdated', { 
          detail: { threadId, title } 
        })
      );
      
      return title;
    } catch (error) {
      console.error("Error updating thread title:", error);
      return null;
    }
  }, [user, activeThread, queryClient]);

  return {
    messages,
    activeThread,
    loading,
    isSaving,
    createThread,
    loadThread,
    sendMessage,
    updateThreadTitle,
    setActiveThread
  };
}
