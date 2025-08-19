import { useCallback } from 'react';
import { editMessageWithDownstreamDeletion } from '@/services/chat/messageEditingService';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { useToast } from '@/hooks/use-toast';
import { ChatMessage } from '@/types/chat';

export const useMessageEditingHandlers = (
  userId: string | undefined,
  currentThreadId: string | null,
  chatHistory: ChatMessage[],
  setChatHistory: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void,
  setEditingMessageId: (id: string | null) => void,
  setIsEditLoading: (loading: boolean) => void,
  stopStreaming: (threadId?: string) => void
) => {
  const { toast } = useToast();

  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!userId || !currentThreadId) {
      toast({
        title: "Error",
        description: "Authentication required to edit messages",
        variant: "destructive"
      });
      return;
    }

    setIsEditLoading(true);
    
    try {
      // Stop any ongoing streaming
      stopStreaming(currentThreadId);
      
      const result = await editMessageWithDownstreamDeletion(messageId, newContent, userId);
      
      if (result.success && result.editedMessage) {
        // Update local state: replace edited message and remove downstream ones
        setChatHistory(prev => {
          const editedMessageIndex = prev.findIndex(msg => msg.id === messageId);
          if (editedMessageIndex === -1) return prev;
          
          // Keep messages up to and including the edited one, remove everything after
          const newHistory = prev.slice(0, editedMessageIndex + 1);
          newHistory[editedMessageIndex] = result.editedMessage!;
          return newHistory;
        });
        
        setEditingMessageId(null);
        
        toast({
          title: "Success",
          description: `Message edited successfully. ${result.deletedCount || 0} downstream messages were removed.`,
          variant: "default"
        });
      } else {
        throw new Error(result.error || 'Failed to edit message');
      }
    } catch (error: any) {
      console.error('Error editing message:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to edit message',
        variant: "destructive"
      });
    } finally {
      setIsEditLoading(false);
    }
  }, [userId, currentThreadId, setChatHistory, setEditingMessageId, setIsEditLoading, stopStreaming, toast]);

  const handleStartEdit = useCallback((messageId: string) => {
    // Stop any ongoing streaming before starting edit
    if (currentThreadId) {
      stopStreaming(currentThreadId);
    }
    setEditingMessageId(messageId);
  }, [currentThreadId, stopStreaming, setEditingMessageId]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
  }, [setEditingMessageId]);

  return {
    handleEditMessage,
    handleStartEdit,
    handleCancelEdit
  };
};
