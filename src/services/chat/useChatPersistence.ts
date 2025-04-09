
import { useToast } from "@/hooks/use-toast";
import { 
  getUserChatThreads, 
  getThreadMessages, 
  saveMessage, 
  createChatThread, 
  updateThreadTitle 
} from "./index";

/**
 * Hook to handle database errors and show toast notifications
 */
export const useChatPersistence = () => {
  const { toast } = useToast();
  
  const handleError = (message: string) => {
    toast({
      title: "Connection Error",
      description: message,
      variant: "destructive",
    });
    
    // Clear any loading states when an error occurs
    sessionStorage.removeItem('chatLoadingState');
    sessionStorage.removeItem('chatProcessingStage');
    sessionStorage.removeItem('chatProcessingThreadId');
    sessionStorage.removeItem('chatProcessingTimestamp');
  };
  
  const persistLoadingState = (threadId: string, stage: string) => {
    sessionStorage.setItem('chatLoadingState', 'true');
    sessionStorage.setItem('chatProcessingStage', stage);
    sessionStorage.setItem('chatProcessingThreadId', threadId);
    sessionStorage.setItem('chatProcessingTimestamp', Date.now().toString());
  };
  
  const clearLoadingState = () => {
    sessionStorage.removeItem('chatLoadingState');
    sessionStorage.removeItem('chatProcessingStage');
    sessionStorage.removeItem('chatProcessingThreadId');
    sessionStorage.removeItem('chatProcessingTimestamp');
  };
  
  return {
    getUserChatThreads: async (userId: string) => {
      try {
        return await getUserChatThreads(userId);
      } catch (error) {
        handleError("Failed to retrieve your chat conversations.");
        return [];
      }
    },
    
    getThreadMessages: async (threadId: string) => {
      try {
        const messages = await getThreadMessages(threadId);
        // If we have messages and the last one is from the assistant, we can clear any loading state
        // But only clear if the loading state is for THIS thread
        if (messages && messages.length > 0 && messages[messages.length - 1].sender === 'assistant') {
          const processingThreadId = sessionStorage.getItem('chatProcessingThreadId');
          if (processingThreadId === threadId) {
            clearLoadingState();
          }
        }
        return messages;
      } catch (error) {
        handleError("Failed to load conversation messages.");
        return [];
      }
    },
    
    saveMessage: async (
      threadId: string, 
      content: string, 
      sender: 'user' | 'assistant',
      references?: any[],
      analysisData?: any,
      hasNumericResult?: boolean
    ) => {
      try {
        // If this is a user message, persist the loading state
        if (sender === 'user') {
          persistLoadingState(threadId, "Analyzing your question...");
        } else if (sender === 'assistant') {
          // If this is an assistant response, clear the loading state
          clearLoadingState();
        }
        
        return await saveMessage(threadId, content, sender, references, analysisData, hasNumericResult);
      } catch (error) {
        handleError("Failed to save your message. Please try again.");
        return null;
      }
    },
    
    createChatThread: async (userId: string, title: string = "New Conversation") => {
      try {
        return await createChatThread(userId, title);
      } catch (error) {
        handleError("Failed to create a new conversation. Please try again.");
        return null;
      }
    },
    
    updateThreadTitle: async (threadId: string, newTitle: string) => {
      try {
        return await updateThreadTitle(threadId, newTitle);
      } catch (error) {
        handleError("Failed to update conversation title.");
        return false;
      }
    },
    
    persistLoadingState,
    clearLoadingState,
    
    // New methods for checking loading state
    isLoadingFor: (threadId: string) => {
      const isLoading = sessionStorage.getItem('chatLoadingState') === 'true';
      const processingThreadId = sessionStorage.getItem('chatProcessingThreadId');
      
      // Check if loading and for this specific thread
      return isLoading && processingThreadId === threadId;
    },
    
    getCurrentProcessingStage: () => {
      return sessionStorage.getItem('chatProcessingStage');
    },
    
    // Add a method to check if loading state is stale (over 5 minutes old)
    isLoadingStateStale: () => {
      const timestamp = sessionStorage.getItem('chatProcessingTimestamp');
      if (!timestamp) return false;
      
      const now = Date.now();
      const then = parseInt(timestamp);
      const fiveMinutesMs = 5 * 60 * 1000;
      
      return now - then > fiveMinutesMs;
    },
    
    // Check and clear stale loading state
    checkAndClearStaleLoadingState: () => {
      const isLoading = sessionStorage.getItem('chatLoadingState') === 'true';
      if (isLoading) {
        const timestamp = sessionStorage.getItem('chatProcessingTimestamp');
        if (timestamp) {
          const now = Date.now();
          const then = parseInt(timestamp);
          const fiveMinutesMs = 5 * 60 * 1000;
          
          if (now - then > fiveMinutesMs) {
            clearLoadingState();
            return true; // Was stale and cleared
          }
        }
      }
      return false; // Not stale or not loading
    }
  };
};
