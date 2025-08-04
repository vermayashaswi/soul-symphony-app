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

    // Create abort controller for timeout
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Set up timeout (30 seconds)
      const timeoutId = setTimeout(() => {
        console.warn('[useStreamingChat] Request timeout, falling back to non-streaming');
        abortController.abort();
        
        // Fall back to non-streaming mode due to timeout
        startNonStreamingChatInternal(message, userId, threadId, conversationContext, userProfile);
      }, 30000);

      // Try streaming using fetch with proper auth headers
      try {
        console.log('[useStreamingChat] Starting streaming request...');
        
        // Get Supabase session for auth headers
        const { data: session } = await supabase.auth.getSession();
        const authToken = session.session?.access_token;
        
        if (!authToken) {
          throw new Error('No auth token available');
        }

        // Make streaming request with fetch
        const streamingResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-rag`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            message,
            userId,
            threadId,
            conversationContext,
            userProfile,
            streamingMode: true
          }),
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        if (!streamingResponse.ok) {
          throw new Error(`HTTP ${streamingResponse.status}: ${streamingResponse.statusText}`);
        }

        // Check if the response is streaming (SSE)
        const contentType = streamingResponse.headers.get('content-type');
        if (contentType?.includes('text/event-stream')) {
          console.log('[useStreamingChat] Processing SSE stream...');
          
          // Process the streaming response
          const reader = streamingResponse.body?.getReader();
          const decoder = new TextDecoder();
          
          if (!reader) {
            throw new Error('No readable stream available');
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('[useStreamingChat] Stream completed');
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const eventData = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
                    console.log('[useStreamingChat] Received SSE event:', eventData);
                    
                    addStreamingMessage({
                      type: eventData.type,
                      message: eventData.message,
                      task: eventData.task,
                      description: eventData.description,
                      stage: eventData.stage,
                      progress: eventData.progress,
                      response: eventData.data?.response,
                      analysis: eventData.data?.analysis,
                      error: eventData.error,
                      timestamp: eventData.timestamp || Date.now()
                    });
                  } catch (parseError) {
                    console.error('[useStreamingChat] Error parsing SSE data:', parseError);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          // Handle non-streaming response
          const data = await streamingResponse.json();
          if (data.response) {
            addStreamingMessage({
              type: 'final_response',
              response: data.response,
              analysis: data.analysis,
              timestamp: Date.now()
            });
          } else {
            throw new Error('No response data received');
          }
        }

      } catch (streamingError) {
        clearTimeout(timeoutId);
        
        // Only fall back if not aborted
        if (streamingError.name !== 'AbortError') {
          console.warn('[useStreamingChat] Streaming failed, falling back to non-streaming:', streamingError);
          await startNonStreamingChatInternal(message, userId, threadId, conversationContext, userProfile);
        } else {
          console.log('[useStreamingChat] Request was aborted');
        }
      }

    } catch (error) {
      console.error('[useStreamingChat] Error in streaming chat:', error);
      addStreamingMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now()
      });
    }
  }, [isStreaming, addStreamingMessage]);

  // Internal function for non-streaming fallback
  const startNonStreamingChatInternal = async (
    message: string,
    userId: string,
    threadId: string,
    conversationContext: any[] = [],
    userProfile: any = {}
  ) => {
    try {
      console.log('[useStreamingChat] Using non-streaming mode');
      
      // Show a simple loading message
      addStreamingMessage({
        type: 'user_message',
        message: 'Analyzing your request...',
        timestamp: Date.now()
      });

      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId,
          threadId,
          conversationContext,
          userProfile,
          streamingMode: false
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Handle non-streaming response
      if (data?.response) {
        addStreamingMessage({
          type: 'final_response',
          response: data.response,
          analysis: data.analysis,
          timestamp: Date.now()
        });
      } else {
        throw new Error('No response received from chat service');
      }

    } catch (error) {
      console.error('[useStreamingChat] Non-streaming fallback error:', error);
      addStreamingMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to get response',
        timestamp: Date.now()
      });
    }
  };

  // Public function for non-streaming chat
  const startNonStreamingChat = useCallback(async (
    message: string,
    userId: string,
    threadId: string,
    conversationContext: any[] = [],
    userProfile: any = {}
  ) => {
    await startNonStreamingChatInternal(message, userId, threadId, conversationContext, userProfile);
  }, [addStreamingMessage]);

  const stopStreaming = useCallback(() => {
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
    startNonStreamingChat,
    stopStreaming,
    clearStreamingMessages
  };
};