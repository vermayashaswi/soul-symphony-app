import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StreamingMessage {
  type: 'user_message' | 'backend_task' | 'progress' | 'final_response' | 'error';
  message?: string;
  task?: string;
  description?: string;
  stage?: string;
  progress?: number;
  response?: string;
  analysis?: any;
  error?: string;
  timestamp: number;
}

interface UseStreamingChatProps {
  onFinalResponse?: (response: string, analysis?: any) => void;
  onError?: (error: string) => void;
}

export const useStreamingChat = ({ onFinalResponse, onError }: UseStreamingChatProps = {}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState<string>('');
  const [showBackendAnimation, setShowBackendAnimation] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const addStreamingMessage = useCallback((message: StreamingMessage) => {
    setStreamingMessages(prev => [...prev, message]);
    
    // Handle different message types
    switch (message.type) {
      case 'user_message':
        setCurrentUserMessage(message.message || '');
        setShowBackendAnimation(false);
        break;
      case 'backend_task':
        setShowBackendAnimation(true);
        break;
      case 'final_response':
        setIsStreaming(false);
        setShowBackendAnimation(false);
        onFinalResponse?.(message.response || '', message.analysis);
        break;
      case 'error':
        setIsStreaming(false);
        setShowBackendAnimation(false);
        onError?.(message.error || 'Unknown error occurred');
        break;
    }
  }, [onFinalResponse, onError]);

  const startStreamingChat = useCallback(async (
    message: string,
    userId: string,
    threadId: string,
    conversationContext: any[] = [],
    userProfile: any = {}
  ) => {
    if (isStreaming) {
      console.warn('Already streaming, ignoring new request');
      return;
    }

    setIsStreaming(true);
    setStreamingMessages([]);
    setCurrentUserMessage('');
    setShowBackendAnimation(false);

    try {
      // Call the chat-with-rag function with streaming enabled
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId,
          threadId,
          conversationContext,
          userProfile,
          streamingMode: true
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // If the response includes streaming data, it will be handled by the EventSource
      // For non-streaming responses, handle them directly
      if (!data?.isStreaming && data?.response) {
        addStreamingMessage({
          type: 'final_response',
          response: data.response,
          analysis: data.analysis,
          timestamp: Date.now()
        });
      } else if (data?.isStreaming) {
        // Streaming is active, the SSE events will be handled by the EventSource
        console.log('[useStreamingChat] Streaming mode activated');
      }

    } catch (error) {
      console.error('Streaming chat error:', error);
      addStreamingMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now()
      });
    }
  }, [isStreaming, addStreamingMessage]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsStreaming(false);
    setShowBackendAnimation(false);
  }, []);

  const clearStreamingMessages = useCallback(() => {
    setStreamingMessages([]);
    setCurrentUserMessage('');
    setShowBackendAnimation(false);
  }, []);

  return {
    isStreaming,
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages
  };
};