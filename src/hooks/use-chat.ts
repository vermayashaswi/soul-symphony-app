
import { useState, useEffect, useCallback } from 'react';
import { ChatMessage } from '@/services/chat/types';

interface UseChatProps {
  threadId?: string | null;
  initialMessages?: ChatMessage[];
  onNewMessage?: (message: ChatMessage) => void;
}

export function useChat({ threadId, initialMessages = [], onNewMessage }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset messages when thread changes
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([]);
    }
    setError(null);
  }, [threadId, initialMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setIsComplete(false);
    
    try {
      // In a real implementation, this would call an API
      // For now, we'll simulate sending and receiving a message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        thread_id: threadId || 'temp-thread',
        content,
        sender: 'user',
        role: 'user',
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Simulate a delayed response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        thread_id: threadId || 'temp-thread',
        content: `You said: "${content}"`,
        sender: 'assistant',
        role: 'assistant',
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (onNewMessage) {
        onNewMessage(assistantMessage);
      }
      
      return assistantMessage;
    } catch (e) {
      console.error('Error sending message:', e);
      setError('Failed to send message. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
      setIsComplete(true);
    }
  }, [threadId, onNewMessage]);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    isComplete,
    clearMessages: () => setMessages([])
  };
}
