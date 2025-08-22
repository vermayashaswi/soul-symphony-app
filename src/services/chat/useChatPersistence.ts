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

  // Handle message deletions
  useMessageDeletion(
    (messageId: string, threadId: string) => {
      console.log(`[useChatPersistence] Handling deletion of message ${messageId} in thread ${threadId}`);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    },
    activeThread
  );

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      if (!userId) return;
      
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
      } finally {
        setLoading(false);
      }
    };
    
    loadThreads();
  }, [userId]);

  // Load messages for active thread
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeThread || !userId) {
        setMessages([]);
        return;
      }
      
      setLoading(true);
      try {
        const threadMessages = await getChatMessages(activeThread, userId);
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
        }
      } catch (error) {
        console.error("Error loading thread messages:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMessages();
  }, [activeThread, userId]);

  // Set up real-time subscription to thread messages
  useEffect(() => {
    if (!activeThread) return;
    
    const subscription = supabase
      .channel(`thread:${activeThread}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThread}` 
      }, (payload) => {
        const newMessage = payload.new as any;
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
        setMessages(prev => [...prev, persistenceMessage]);
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThread}` 
      }, (payload) => {
        const deletedMessage = payload.old as any;
        console.log(`[useChatPersistence] Message deleted in thread ${activeThread}:`, deletedMessage.id);
        
        // Remove deleted message from local state
        setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
      })
      .subscribe();

    // Listen for custom deletion events from other components
    const handleMessageDeletion = (event: CustomEvent) => {
      const { messageId, threadId } = event.detail;
      if (threadId === activeThread) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    };

    window.addEventListener('chatMessageDeleted', handleMessageDeletion as EventListener);
      
    return () => {
      supabase.removeChannel(subscription);
      window.removeEventListener('chatMessageDeleted', handleMessageDeletion as EventListener);
    };
  }, [activeThread]);

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
    
    // Enhanced save with retry logic and better error handling
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[useChatPersistence] Message save attempt ${attempt}/${maxRetries}`);
        
        const savedMessage = await createChatMessage(activeThread, content, 'user', userId);
        
        if (savedMessage) {
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
          console.log(`[useChatPersistence] Message saved successfully: ${savedMessage.id}`);
          return persistenceMessage;
        } else {
          throw new Error('createChatMessage returned null');
        }
      } catch (error) {
        lastError = error;
        console.error(`[useChatPersistence] Save attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[useChatPersistence] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    console.error("[useChatPersistence] All save attempts failed. Last error:", lastError);
    
    // Remove temp message from UI to avoid confusion
    setMessages(prev => prev.filter(msg => msg.id !== tempId));
    
    toast({
      title: "Error",
      description: "Failed to save your message after multiple attempts. Please try again.",
      variant: "destructive"
    });
    return null;
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
    updateTitle
  };
};
