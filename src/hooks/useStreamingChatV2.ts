import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

// Simplified streaming message interface
export interface StreamingMessage {
  id?: string;
  type: 'user_message' | 'backend_task' | 'progress' | 'final_response' | 'error';
  message?: string;
  content?: string;
  isVisible?: boolean;
  timestamp: number;
}

// Simplified thread streaming state interface  
export interface ThreadStreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  showDynamicMessages: boolean;
  lastUserInput: string;
  requestCorrelationId?: string;
  dynamicMessageIndex: number;
  queryCategory: string;
  abortController: AbortController | null;
  dynamicMessages?: string[];
  translatedDynamicMessages?: string[];
  useThreeDotFallback?: boolean;
}

// Props interface for the hook
export interface UseStreamingChatProps {
  onFinalResponse?: (response: any) => void;
  onError?: (error: any) => void;
}

export const useStreamingChatV2 = (threadId: string, props: UseStreamingChatProps = {}) => {
  const { user } = useAuth();
  const { translate } = useTranslation();
  const { onFinalResponse, onError } = props;
  
  // Thread states map for managing multiple concurrent streams
  const threadStatesRef = useRef<Map<string, ThreadStreamingState>>(new Map());
  
  // Current thread state
  const [state, setState] = useState<ThreadStreamingState>(() => 
    createInitialState()
  );

  // Create simplified initial state
  function createInitialState(): ThreadStreamingState {
    return {
      isStreaming: false,
      streamingMessages: [],
      showDynamicMessages: false,
      lastUserInput: '',
      requestCorrelationId: undefined,
      dynamicMessageIndex: 0,
      queryCategory: 'JOURNAL_SPECIFIC',
      abortController: null,
      dynamicMessages: [],
      translatedDynamicMessages: [],
      useThreeDotFallback: false
    };
  }

  // Get thread state from map or create new one
  const getThreadState = useCallback((threadId: string): ThreadStreamingState => {
    if (!threadStatesRef.current.has(threadId)) {
      threadStatesRef.current.set(threadId, createInitialState());
    }
    return threadStatesRef.current.get(threadId)!;
  }, []);

  // Update thread state in map (simplified - no persistence)
  const updateThreadState = useCallback((targetThreadId: string, newState: Partial<ThreadStreamingState>) => {
    const currentState = getThreadState(targetThreadId);
    const updatedState = { ...currentState, ...newState };
    threadStatesRef.current.set(targetThreadId, updatedState);
    
    // Update local state if this is the current thread
    if (targetThreadId === threadId) {
      setState(updatedState);
    }
  }, [threadId, getThreadState]);

  // Generate correlation ID for request tracking
  const generateCorrelationId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Simplified streaming messages generation
  const generateStreamingMessages = useCallback(async (threadId: string, userMessage: string) => {
    const fallbackMessages = [
      "Analyzing your journal entries...",
      "Looking for patterns and insights...",
      "Examining emotional themes...",
      "Processing your personal data...",
      "Generating personalized insights..."
    ];

    updateThreadState(threadId, {
      dynamicMessages: fallbackMessages,
      translatedDynamicMessages: fallbackMessages,
      useThreeDotFallback: false
    });

    let messageIndex = 0;
    
    const showNextMessage = () => {
      const state = getThreadState(threadId);
      if (!state.showDynamicMessages) return;
      
      const messageContent = fallbackMessages[messageIndex % fallbackMessages.length];
      
      const newMessage: StreamingMessage = {
        id: `dynamic-${messageIndex}`,
        type: 'progress',
        content: messageContent,
        message: messageContent,
        isVisible: true,
        timestamp: Date.now()
      };
      
      updateThreadState(threadId, {
        streamingMessages: [newMessage],
        dynamicMessageIndex: messageIndex + 1
      });
      
      messageIndex++;
      setTimeout(showNextMessage, 2000);
    };
    
    showNextMessage();
  }, [getThreadState, updateThreadState]);

  // Add streaming message to current thread
  const addStreamingMessage = useCallback((threadId: string, message: StreamingMessage) => {
    const currentState = getThreadState(threadId);
    const updatedMessages = [...currentState.streamingMessages, message];
    
    updateThreadState(threadId, {
      streamingMessages: updatedMessages
    });

    // Call onFinalResponse if this is a final response
    if (message.type === 'final_response' && onFinalResponse) {
      onFinalResponse(message.content);
    }

    // Call onError if this is an error
    if (message.type === 'error' && onError) {
      onError(message.content);
    }
  }, [getThreadState, updateThreadState, onFinalResponse, onError]);

  // Enhanced start streaming chat - SIMPLIFIED
  const startStreamingChat = useCallback(async (
    messageContent: string,
    targetThreadId: string,
    userId: string,
    messageCategory: string = 'JOURNAL_SPECIFIC',
    userProfile?: any,
    parameters: Record<string, any> = {},
    messageId?: string
  ): Promise<void> => {
    if (!messageContent?.trim() || !targetThreadId || !userId) {
      console.error('[useStreamingChatV2] Invalid parameters for streaming chat');
      return;
    }

    console.log(`[useStreamingChatV2] Starting streaming chat for thread: ${targetThreadId}`);
    const threadState = getThreadState(targetThreadId);
    
    // Generate correlation ID for this request
    const correlationId = generateCorrelationId();
    
    console.log(`[useStreamingChatV2] Generated correlation ID: ${correlationId}`);
    
    // Reset state for new request
    const newState = {
      ...threadState,
      isStreaming: true,
      streamingMessages: [],
      showDynamicMessages: messageCategory === 'JOURNAL_SPECIFIC',
      lastUserInput: messageContent,
      requestCorrelationId: correlationId,
      abortController: new AbortController(),
      queryCategory: messageCategory
    };
    
    updateThreadState(targetThreadId, newState);

    try {
      console.log(`[useStreamingChatV2] Generating streaming messages for category: ${messageCategory}`);
      
      // Generate dynamic messages for JOURNAL_SPECIFIC queries
      if (messageCategory === 'JOURNAL_SPECIFIC') {
        generateStreamingMessages(targetThreadId, messageContent);
      } else {
        // For non-journal queries, show a simple processing state
        addStreamingMessage(targetThreadId, {
          id: 'processing-general',
          type: 'progress',
          content: 'Processing your request...',
          isVisible: true,
          timestamp: Date.now()
        });
      }

      console.log('[useStreamingChatV2] Calling chat backend...');
      
      // Get conversation context
      const { data: contextMessages } = await supabase
        .from('chat_messages')
        .select('content, sender, created_at')
        .eq('thread_id', targetThreadId)
        .order('created_at', { ascending: true })
        .limit(10);

      const conversationContext = (contextMessages || []).map(msg => ({
        content: msg.content,
        role: msg.sender === 'user' ? 'user' : 'assistant',
        timestamp: msg.created_at
      }));

      // Call the backend function with correlation ID
      const { data: result, error } = await supabase.functions.invoke('chat-with-rag', {
        body: {
          message: messageContent,
          userId: userId,
          threadId: targetThreadId,
          messageId: messageId,
          conversationContext: conversationContext,
          category: messageCategory,
          parameters: parameters,
          correlationId: correlationId
        }
      });

      const currentState = getThreadState(targetThreadId);
      if (currentState.abortController?.signal.aborted) {
        console.log('[useStreamingChatV2] Request was aborted during execution');
        return;
      }

      if (error) {
        console.error('[useStreamingChatV2] Backend function error:', error);
        
        addStreamingMessage(targetThreadId, {
          id: 'error-' + Date.now(),
          type: 'error',
          content: `Error: ${error.message || 'Unknown error occurred'}`,
          isVisible: true,
          timestamp: Date.now()
        });

        updateThreadState(targetThreadId, {
          ...currentState,
          isStreaming: false,
          showDynamicMessages: false
        });
        return;
      }

      console.log('[useStreamingChatV2] Backend response received:', result);

      // Clear streaming messages and update state
      updateThreadState(targetThreadId, {
        ...currentState,
        isStreaming: false,
        streamingMessages: [],
        showDynamicMessages: false
      });

      // Emit completion event for UI updates - SIMPLIFIED
      const completionEvent = new CustomEvent('chatResponseReady', {
        detail: { 
          threadId: targetThreadId, 
          response: result, 
          correlationId: correlationId, 
          completed: true,
          forceReload: true 
        }
      });
      window.dispatchEvent(completionEvent);

      // Call final response handler
      if (onFinalResponse && result?.response) {
        onFinalResponse(result.response);
      }

      console.log('[useStreamingChatV2] Successfully completed streaming chat');

    } catch (error) {
      console.error('[useStreamingChatV2] Exception in streaming chat:', error);
      
      const currentState = getThreadState(targetThreadId);
      if (!currentState.abortController?.signal.aborted) {
        addStreamingMessage(targetThreadId, {
          id: 'error-' + Date.now(),
          type: 'error',
          content: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isVisible: true,
          timestamp: Date.now()
        });

        updateThreadState(targetThreadId, {
          ...currentState,
          isStreaming: false,
          showDynamicMessages: false
        });
      }
    }
  }, [getThreadState, updateThreadState, addStreamingMessage, generateStreamingMessages, generateCorrelationId, onFinalResponse]);

  // Stop streaming for current thread
  const stopStreaming = useCallback((targetThreadId?: string) => {
    const threadToStop = targetThreadId || threadId;
    const currentState = getThreadState(threadToStop);
    
    if (currentState.abortController) {
      currentState.abortController.abort();
    }
    
    updateThreadState(threadToStop, {
      isStreaming: false,
      showDynamicMessages: false,
      streamingMessages: [],
      abortController: null
    });
    
    console.log(`[useStreamingChatV2] Stopped streaming for thread: ${threadToStop}`);
  }, [threadId, getThreadState, updateThreadState]);

  // Clear streaming messages
  const clearStreamingMessages = useCallback((targetThreadId?: string) => {
    const threadToClear = targetThreadId || threadId;
    updateThreadState(threadToClear, {
      streamingMessages: [],
      showDynamicMessages: false
    });
  }, [threadId, updateThreadState]);

  // Force recovery - SIMPLIFIED
  const forceRecovery = useCallback((targetThreadId?: string, reason: string = 'manual') => {
    const threadToRecover = targetThreadId || threadId;
    console.warn(`[useStreamingChatV2] Force recovery triggered for thread ${threadToRecover}, reason: ${reason}`);
    
    const currentState = getThreadState(threadToRecover);
    
    // Abort any active request
    if (currentState.abortController) {
      currentState.abortController.abort();
    }
    
    // Clear state completely
    updateThreadState(threadToRecover, createInitialState());
    
    console.log(`[useStreamingChatV2] Recovery completed for thread: ${threadToRecover}`);
  }, [threadId, getThreadState, updateThreadState]);

  // 30-second completion check - DEFENSIVE RECOVERY
  useEffect(() => {
    if (!threadId || !state.isStreaming) return;

    const timeoutId = setTimeout(() => {
      const currentState = getThreadState(threadId);
      if (currentState.isStreaming || currentState.showDynamicMessages) {
        console.warn('[useStreamingChatV2] 30-second timeout reached, checking for completion');
        
        // Emit event to trigger reload
        const completionEvent = new CustomEvent('chatResponseReady', {
          detail: { 
            threadId, 
            reason: 'timeout_completion_check',
            forceReload: true 
          }
        });
        window.dispatchEvent(completionEvent);
      }
    }, 30000);

    return () => clearTimeout(timeoutId);
  }, [threadId, state.isStreaming, getThreadState]);

  // Message deletion handler
  useEffect(() => {
    const handleMessageDeleted = (event: CustomEvent) => {
      const { messageId, threadId: deletedThreadId } = event.detail;
      if (deletedThreadId === threadId) {
        console.log('[useStreamingChatV2] Message deleted, clearing streaming state');
        forceRecovery(threadId, 'message_deleted');
      }
    };
    
    window.addEventListener('chatMessageDeleted', handleMessageDeleted as EventListener);
    
    return () => {
      window.removeEventListener('chatMessageDeleted', handleMessageDeleted as EventListener);
    };
  }, [threadId, forceRecovery]);

  return {
    ...state,
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    forceRecovery: () => forceRecovery(threadId, 'user_manual'),
    isStuck: false // Simplified - no complex stuck detection
  };
};