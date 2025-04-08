
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
        return await getThreadMessages(threadId);
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
    }
  };
};
