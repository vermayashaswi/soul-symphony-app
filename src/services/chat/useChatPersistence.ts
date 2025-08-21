import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  createThread, 
  getUserChatThreads, 
  getChatMessages,
  createChatMessage,
  updateThreadTitle
} from "@/services/chat/messageService";
import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { ChatMessage } from "@/types/chat";
import { useMessageDeletion } from "@/hooks/use-message-deletion";
import { useAuthenticationReliability } from "@/hooks/useAuthenticationReliability";
import { useRealtimeSubscriptionManager } from "@/hooks/useRealtimeSubscriptionManager";
import { useMessagePersistenceReliability } from "@/hooks/useMessagePersistenceReliability";
import { useConversationRecovery } from "@/hooks/useConversationRecovery";

export interface ChatThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessagePersistence {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  role?: string;
  created_at: string;
  reference_entries?: any[];
  analysis_data?: any;
  has_numeric_result?: boolean;
  isInteractive?: boolean;
  interactiveOptions?: any[];
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
  sub_query_responses?: any[];
  diagnostics?: any;
}

export const useChatPersistence = (userId: string | undefined) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessagePersistence[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Enhanced reliability hooks
  const { isAuthenticated, userId: authUserId, sessionValid, validateSession } = useAuthenticationReliability();
  const { isConnected, connectionHealth, createSubscription, removeSubscription } = useRealtimeSubscriptionManager();
  const { fetchMessagesWithRetry, cacheMessages, createMessageWatchdog, syncStatus } = useMessagePersistenceReliability(userId);
  const { detectInconsistencies, attemptRecovery, logDiagnostic } = useConversationRecovery(userId);

  // Handle message deletions
  useMessageDeletion(
    (messageId: string, threadId: string) => {
      console.log(`[useChatPersistence] Handling deletion of message ${messageId} in thread ${threadId}`);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    },
    activeThread
  );

  // Enhanced thread loading with session validation
  useEffect(() => {
    const loadThreads = async () => {
      if (!userId) return;
      
      // Validate session before loading
      if (!sessionValid) {
        console.log('[useChatPersistence] Session invalid, attempting validation');
        const isValid = await validateSession();
        if (!isValid) {
          console.error('[useChatPersistence] Session validation failed');
          toast({
            title: "Session Issue",
            description: "Please refresh the page or log in again",
            variant: "destructive"
          });
          return;
        }
      }
      
      setLoading(true);
      try {
        const userThreads = await getUserChatThreads(userId);
        if (userThreads) {
          setThreads(userThreads);
          
          // Select the most recent thread if none is active
          if (!activeThread && userThreads.length > 0) {
            setActiveThread(userThreads[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading chat threads:", error);
        logDiagnostic('threads_load', 'load_error', { error, userId });
        toast({
          title: "Loading Error",
          description: "Failed to load conversations. Retrying...",
          variant: "destructive"
        });
        
        // Retry after delay
        setTimeout(() => loadThreads(), 2000);
      } finally {
        setLoading(false);
      }
    };
    
    loadThreads();
  }, [userId, sessionValid, validateSession, activeThread, toast, logDiagnostic]);

  // Enhanced message loading with reliability features
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeThread || !userId) {
        setMessages([]);
        return;
      }
      
      setLoading(true);
      try {
        // Use enhanced fetch with retry logic
        const threadMessages = await fetchMessagesWithRetry(activeThread);
        
        if (threadMessages) {
          // Convert ChatMessage to ChatMessagePersistence
          const persistenceMessages: ChatMessagePersistence[] = threadMessages.map(msg => ({
            ...msg,
            references: Array.isArray(msg.reference_entries) ? msg.reference_entries : [],
            analysis: msg.analysis_data,
            hasNumericResult: msg.has_numeric_result,
            reference_entries: Array.isArray(msg.reference_entries) ? msg.reference_entries : [],
            sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
          }));
          
          setMessages(persistenceMessages);
          
          // Cache for reliability
          cacheMessages(activeThread, threadMessages);
          
          // Detect any inconsistencies
          const inconsistencyCheck = await detectInconsistencies(activeThread, threadMessages);
          if (inconsistencyCheck.hasInconsistency) {
            console.warn('[useChatPersistence] Inconsistencies detected:', inconsistencyCheck.issues);
            
            // Attempt automatic recovery for critical issues
            if (inconsistencyCheck.issues.some(issue => issue.includes('missing'))) {
              const recovery = await attemptRecovery(activeThread, threadMessages);
              if (recovery.success) {
                const recoveredPersistenceMessages: ChatMessagePersistence[] = recovery.recoveredMessages.map(msg => ({
                  ...msg,
                  references: Array.isArray(msg.reference_entries) ? msg.reference_entries : [],
                  analysis: msg.analysis_data,
                  hasNumericResult: msg.has_numeric_result,
                  reference_entries: Array.isArray(msg.reference_entries) ? msg.reference_entries : [],
                  sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
                }));
                setMessages(recoveredPersistenceMessages);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading thread messages:", error);
        logDiagnostic(activeThread, 'message_load_error', { error, userId });
        
        toast({
          title: "Message Loading Failed",
          description: "Unable to load conversation. Please try refreshing.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadMessages();
  }, [activeThread, userId, fetchMessagesWithRetry, cacheMessages, detectInconsistencies, attemptRecovery, logDiagnostic, toast]);

  // Enhanced real-time subscription with reliability
  useEffect(() => {
    if (!activeThread || !isConnected) return;
    
    const channelName = `enhanced_thread:${activeThread}`;
    
    const handleNewMessage = (payload: any) => {
      const newMessage = payload.new as any;
      console.log(`[useChatPersistence] Real-time INSERT for thread ${activeThread}:`, newMessage.id);
      
      // Convert to ChatMessagePersistence
      const persistenceMessage: ChatMessagePersistence = {
        ...newMessage,
        sender: newMessage.sender as 'user' | 'assistant' | 'error',
        references: Array.isArray(newMessage.reference_entries) ? newMessage.reference_entries : [],
        analysis: newMessage.analysis_data,
        hasNumericResult: newMessage.has_numeric_result,
        reference_entries: Array.isArray(newMessage.reference_entries) ? newMessage.reference_entries : [],
        sub_query_responses: Array.isArray(newMessage.sub_query_responses) ? newMessage.sub_query_responses : []
      };
      
      setMessages(prev => {
        // Prevent duplicates
        const exists = prev.some(msg => msg.id === persistenceMessage.id);
        if (exists) {
          console.warn(`[useChatPersistence] Duplicate message prevented: ${persistenceMessage.id}`);
          return prev;
        }
        return [...prev, persistenceMessage];
      });

      // Create watchdog to ensure message persistence
      const clearWatchdog = createMessageWatchdog(
        newMessage.id,
        activeThread,
        () => {
          console.error(`[useChatPersistence] Message ${newMessage.id} failed persistence check`);
          setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
          toast({
            title: "Message Sync Issue", 
            description: "A message may not have been saved properly",
            variant: "destructive"
          });
        }
      );

      // Clear watchdog after successful validation
      setTimeout(clearWatchdog, 5000);
    };

    const handleDeletedMessage = (payload: any) => {
      const deletedMessage = payload.old as any;
      console.log(`[useChatPersistence] Real-time DELETE for thread ${activeThread}:`, deletedMessage.id);
      
      // Remove deleted message from local state
      setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
    };

    const handleSubscriptionError = (error: any) => {
      console.error(`[useChatPersistence] Subscription error for ${channelName}:`, error);
      logDiagnostic(activeThread, 'subscription_error', { error, connectionHealth });
      
      if (connectionHealth === 'disconnected') {
        toast({
          title: "Connection Issue",
          description: "Real-time updates may be delayed",
          variant: "destructive"
        });
      }
    };

    // Create managed subscription
    const subscription = createSubscription(
      channelName,
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThread}` 
      },
      handleNewMessage,
      handleSubscriptionError
    );

    // Add DELETE listener if subscription was created successfully
    if (subscription) {
      subscription.on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThread}` 
      }, handleDeletedMessage);
    }

    // Listen for custom deletion events from other components
    const handleMessageDeletion = (event: CustomEvent) => {
      const { messageId, threadId } = event.detail;
      if (threadId === activeThread) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    };

    window.addEventListener('chatMessageDeleted', handleMessageDeletion as EventListener);
      
    return () => {
      removeSubscription(channelName);
      window.removeEventListener('chatMessageDeleted', handleMessageDeletion as EventListener);
    };
  }, [activeThread, isConnected, connectionHealth, createSubscription, removeSubscription, createMessageWatchdog, logDiagnostic, toast]);

  const selectThread = (threadId: string) => {
    setActiveThread(threadId);
  };

  const createNewThread = async (title: string = "New Conversation") => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to create a conversation",
        variant: "destructive"
      });
      return null;
    }
    
    try {
      const newThreadId = await createThread(userId, title);
      
      if (newThreadId) {
        // Get the new thread details
        const { data: newThread, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('id', newThreadId)
          .single();
          
        if (error || !newThread) throw new Error("Failed to retrieve new thread");
        
        setThreads(prev => [newThread, ...prev]);
        setActiveThread(newThreadId);
        return newThreadId;
      }
      return null;
    } catch (error) {
      console.error("Error creating new thread:", error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
      return null;
    }
  };

  const sendMessage = async (
    content: string, 
    parameters: Record<string, any> = {}
  ) => {
    if (!userId || !activeThread) {
      toast({
        title: "Error",
        description: "No active conversation selected",
        variant: "destructive"
      });
      return null;
    }
    
    const tempId = uuidv4();
    const tempMessage: ChatMessagePersistence = {
      id: tempId,
      thread_id: activeThread,
      content,
      sender: 'user',
      created_at: new Date().toISOString()
    };
    
    // Add to local state immediately
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      console.log('[useChatPersistence] Saving message to thread:', activeThread);
      const savedMessage = await createChatMessage(activeThread, content, 'user', userId);
      
      if (savedMessage) {
        console.log('[useChatPersistence] Message saved successfully:', savedMessage.id);
        // Convert to ChatMessagePersistence to avoid type mismatch
        const persistenceMessage: ChatMessagePersistence = {
          ...savedMessage,
          references: Array.isArray(savedMessage.reference_entries) ? savedMessage.reference_entries : [],
          analysis: savedMessage.analysis_data,
          hasNumericResult: savedMessage.has_numeric_result as boolean,
          reference_entries: Array.isArray(savedMessage.reference_entries) ? savedMessage.reference_entries : [],
          sub_query_responses: Array.isArray(savedMessage.sub_query_responses) ? savedMessage.sub_query_responses : []
        };
        
        // Replace temp message with saved one
        setMessages(prev => 
          prev.map(msg => msg.id === tempId ? persistenceMessage : msg)
        );
        return persistenceMessage;
      } else {
        console.error('[useChatPersistence] createChatMessage returned null');
        throw new Error('Message save failed - no response from database');
      }
    } catch (error) {
      console.error("[useChatPersistence] Error saving message:", error);
      
      // Remove temp message on failure
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      toast({
        title: "Failed to save message",
        description: error instanceof Error ? error.message : "Could not save your message",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateTitle = async (threadId: string, title: string) => {
    if (!userId) return false;
    
    try {
      const updated = await updateThreadTitle(threadId, title);
      
      if (updated) {
        setThreads(prev => 
          prev.map(thread => 
            thread.id === threadId ? { ...thread, title } : thread
          )
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error updating thread title:", error);
      return false;
    }
  };

  return {
    threads,
    activeThread,
    messages,
    loading,
    selectThread,
    createNewThread,
    sendMessage,
    updateTitle,
    // Enhanced reliability status
    isAuthenticated,
    sessionValid,
    isConnected,
    connectionHealth,
    syncStatus: syncStatus.get(activeThread || '') || 'synced'
  };
};
