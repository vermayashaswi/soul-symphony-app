
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
  };
  
  const persistLoadingState = (stage: string) => {
    sessionStorage.setItem('chatLoadingState', 'true');
    sessionStorage.setItem('chatProcessingStage', stage);
  };
  
  const clearLoadingState = () => {
    sessionStorage.removeItem('chatLoadingState');
    sessionStorage.removeItem('chatProcessingStage');
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
        if (messages && messages.length > 0 && messages[messages.length - 1].sender === 'assistant') {
          clearLoadingState();
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
          persistLoadingState("Analyzing your question...");
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
    clearLoadingState
  };
};
