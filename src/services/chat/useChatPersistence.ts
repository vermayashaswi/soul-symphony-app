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
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
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
    
    try {
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
        return persistenceMessage;
      }
      return null;
    } catch (error) {
      console.error("Error saving message:", error);
      toast({
        title: "Error",
        description: "Failed to save your message",
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
    updateTitle
  };
};
