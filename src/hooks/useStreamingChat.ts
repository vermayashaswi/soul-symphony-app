import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamingMessage {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: number;
  isComplete?: boolean;
  analysis?: any;
}

interface StreamingProgress {
  stage: string;
  message: string;
  progress?: number;
  estimatedCompletion?: number;
  data?: any;
}

export const useStreamingChat = () => {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [currentProgress, setCurrentProgress] = useState<StreamingProgress | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(async (message: string, threadId?: string) => {
    const userMessage: StreamingMessage = {
      id: `user_${Date.now()}`,
      content: message,
      type: 'user',
      timestamp: Date.now(),
      isComplete: true
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setCurrentProgress(null);

    try {
      // Create assistant message placeholder
      const assistantMessage: StreamingMessage = {
        id: `assistant_${Date.now()}`,
        content: '',
        type: 'assistant',
        timestamp: Date.now(),
        isComplete: false
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Start streaming request
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId: user?.id,
          threadId,
          streaming: true
        },
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      if (!response.data) {
        throw new Error('No response received');
      }

      // Handle streaming response
      const reader = response.data.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              handleStreamEvent(eventData, assistantMessage.id);
            } catch (e) {
              console.warn('Failed to parse stream event:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Streaming chat error:', error);
      setCurrentProgress({ 
        stage: 'error', 
        message: 'Failed to process message. Please try again.' 
      });
    } finally {
      setIsStreaming(false);
      setCurrentProgress(null);
    }
  }, []);

  const handleStreamEvent = useCallback((event: any, messageId: string) => {
    switch (event.type) {
      case 'progress':
      case 'progress_enhanced':
        setCurrentProgress({
          stage: event.stage || event.data?.stage,
          message: event.message || event.data?.message,
          progress: event.progress || event.data?.progress,
          estimatedCompletion: event.estimatedCompletion,
          data: event.data
        });
        break;

      case 'response_stream':
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                content: msg.content + event.chunk,
                isComplete: event.isComplete 
              }
            : msg
        ));
        break;

      case 'final_response':
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                content: event.data?.response || event.response,
                isComplete: true,
                analysis: event.data?.analysis || event.analysis
              }
            : msg
        ));
        break;

      case 'complete':
        setCurrentProgress(null);
        setIsStreaming(false);
        break;

      case 'error':
        setCurrentProgress({ 
          stage: 'error', 
          message: event.message || event.error || 'An error occurred' 
        });
        setIsStreaming(false);
        break;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentProgress(null);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    currentProgress,
    isStreaming,
    sendMessage,
    clearMessages
  };
};