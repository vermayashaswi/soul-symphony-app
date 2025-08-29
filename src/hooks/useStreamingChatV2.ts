import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Simplified streaming message interface
export interface StreamingMessage {
  id?: string;
  type: 'user_message' | 'backend_task' | 'progress' | 'final_response' | 'error';
  message?: string;
  content?: string;
  timestamp: number;
}

// Simplified thread state interface
export interface ThreadStreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  showDynamicMessages: boolean;
  lastUserInput: string;
  requestStartTime: number;
  requestCorrelationId?: string;
  abortController: AbortController | null;
}

// Props interface for the hook
export interface UseStreamingChatProps {
  onFinalResponse?: (response: any) => void;
  onError?: (error: any) => void;
}

export const useStreamingChatV2 = (threadId: string, props: UseStreamingChatProps = {}) => {
  const { user } = useAuth();
  const { onFinalResponse, onError } = props;
  
  // Simple state management
  const [state, setState] = useState<ThreadStreamingState>(() => ({
    isStreaming: false,
    streamingMessages: [],
    showDynamicMessages: false,
    lastUserInput: '',
    requestStartTime: 0,
    requestCorrelationId: undefined,
    abortController: null,
  }));

  // Simple timeout for recovery
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate correlation ID for request tracking
  const generateCorrelationId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Simple dynamic messages
  const dynamicMessages = [
    "Analyzing your journal entries...",
    "Looking for patterns and insights...",
    "Examining emotional themes...",
    "Processing your personal data...",
    "Generating personalized insights..."
  ];

  // Clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, []);

  // Clear streaming state
  const clearStreamingState = useCallback(() => {
    console.log('[useStreamingChatV2] Clearing streaming state');
    clearAllTimeouts();
    
    setState(prevState => ({
      ...prevState,
      isStreaming: false,
      streamingMessages: [],
      showDynamicMessages: false,
      lastUserInput: '',
      requestStartTime: 0,
      requestCorrelationId: undefined,
      abortController: null,
    }));
  }, [clearAllTimeouts]);

  // Force recovery - clear everything and emit event
  const forceRecovery = useCallback(async () => {
    console.log('[useStreamingChatV2] Force recovery initiated');
    clearStreamingState();
    
    // Clear any backend processing flags
    if (threadId && user?.id) {
      try {
        await supabase
          .from('chat_messages')
          .update({ is_processing: false })
          .eq('thread_id', threadId)
          .eq('is_processing', true);
      } catch (error) {
        console.warn('[useStreamingChatV2] Failed to clear backend processing flags:', error);
      }
    }
    
    // Emit recovery event to trigger message reload
    window.dispatchEvent(new CustomEvent('chatResponseReady', {
      detail: { threadId, recovery: true }
    }));
  }, [threadId, user?.id, clearStreamingState]);

  // Start streaming dynamic messages
  const startDynamicMessages = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      showDynamicMessages: true,
      streamingMessages: []
    }));

    let messageIndex = 0;
    
    const showNextMessage = () => {
      setState(prevState => {
        if (!prevState.showDynamicMessages) return prevState;
        
        const newMessage: StreamingMessage = {
          id: `dynamic-${messageIndex}`,
          type: 'progress',
          content: dynamicMessages[messageIndex % dynamicMessages.length],
          timestamp: Date.now()
        };
        
        return {
          ...prevState,
          streamingMessages: [newMessage]
        };
      });
      
      messageIndex++;
      
      // Continue if still showing dynamic messages
      setState(currentState => {
        if (currentState.showDynamicMessages) {
          timeoutRef.current = setTimeout(showNextMessage, 2000);
        }
        return currentState;
      });
    };
    
    // Start first message
    showNextMessage();
  }, [dynamicMessages]);

  // Main streaming chat function
  const startStreamingChat = useCallback(async (
    message: string,
    parameters: any = {},
    targetThreadId: string
  ) => {
    if (!user?.id) {
      console.error('[useStreamingChatV2] No user ID available');
      onError?.('User not authenticated');
      return;
    }

    console.log('[useStreamingChatV2] Starting streaming chat for:', message);
    
    // Clear any existing state
    clearAllTimeouts();
    
    const correlationId = generateCorrelationId();
    const abortController = new AbortController();
    
    setState({
      isStreaming: true,
      streamingMessages: [],
      showDynamicMessages: false,
      lastUserInput: message,
      requestStartTime: Date.now(),
      requestCorrelationId: correlationId,
      abortController
    });

    // Start dynamic messages
    startDynamicMessages();

    // Set 30-second timeout for recovery
    processingTimeoutRef.current = setTimeout(() => {
      console.warn('[useStreamingChatV2] 30-second timeout reached, forcing recovery');
      forceRecovery();
    }, 30000);

    try {
      // Call backend
      const { data, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message,
          userId: user.id,
          threadId: targetThreadId,
          correlationId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...parameters
        }
      });

      if (error) throw error;

      console.log('[useStreamingChatV2] Backend response received:', data?.response?.substring(0, 100));
      
      // Clear dynamic messages and timeouts
      clearAllTimeouts();
      setState(prevState => ({
        ...prevState,
        isStreaming: false,
        showDynamicMessages: false,
        streamingMessages: []
      }));

      // Emit completion event
      window.dispatchEvent(new CustomEvent('chatResponseReady', {
        detail: { 
          threadId: targetThreadId, 
          response: data?.response,
          messageId: data?.assistantMessageId,
          correlationId 
        }
      }));

      // Call final response callback
      onFinalResponse?.(data?.response);

    } catch (error: any) {
      console.error('[useStreamingChatV2] Streaming chat error:', error);
      
      clearAllTimeouts();
      setState(prevState => ({
        ...prevState,
        isStreaming: false,
        showDynamicMessages: false,
        streamingMessages: []
      }));

      onError?.(error);
    }
  }, [user?.id, generateCorrelationId, startDynamicMessages, clearAllTimeouts, forceRecovery, onFinalResponse, onError]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    console.log('[useStreamingChatV2] Stopping streaming');
    clearStreamingState();
  }, [clearStreamingState]);

  // Handle message deletion
  useEffect(() => {
    const handleMessageDeleted = (event: CustomEvent) => {
      const { messageId, threadId: deletedThreadId } = event.detail;
      
      if (deletedThreadId === threadId) {
        console.log('[useStreamingChatV2] Message deleted, clearing streaming state');
        clearStreamingState();
      }
    };

    window.addEventListener('chatMessageDeleted', handleMessageDeleted as EventListener);
    
    return () => {
      window.removeEventListener('chatMessageDeleted', handleMessageDeleted as EventListener);
    };
  }, [threadId, clearStreamingState]);

  // Cleanup on unmount or thread change
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      if (state.abortController) {
        state.abortController.abort();
      }
    };
  }, [threadId, clearAllTimeouts, state.abortController]);

  // Determine if stuck (processing for more than 25 seconds)
  const isStuck = state.isStreaming && 
                  state.requestStartTime > 0 && 
                  (Date.now() - state.requestStartTime) > 25000;

  return {
    // State
    isStreaming: state.isStreaming,
    streamingMessages: state.streamingMessages,
    showDynamicMessages: state.showDynamicMessages,
    lastUserInput: state.lastUserInput,
    isStuck,
    
    // Simplified properties for compatibility
    queryCategory: 'JOURNAL_SPECIFIC',
    dynamicMessages,
    translatedDynamicMessages: dynamicMessages,
    currentMessageIndex: 0,
    useThreeDotFallback: false,
    
    // Functions
    startStreamingChat,
    stopStreaming,
    forceRecovery: () => forceRecovery(),
    clearStreamingMessages: clearStreamingState,
  };
};