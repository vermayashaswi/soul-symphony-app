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

// Enhanced thread streaming state interface with persistence
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
  startTime?: number;
  persistenceKey?: string;
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
  
  // Global thread states map with persistence
  const threadStatesRef = useRef<Map<string, ThreadStreamingState>>(new Map());
  
  // Global streaming intervals to survive component unmounts
  const globalIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Current thread state with restoration
  const [state, setState] = useState<ThreadStreamingState>(() => 
    createInitialState(threadId)
  );

  // Persistence functions
  const saveStateToStorage = useCallback((threadId: string, state: ThreadStreamingState) => {
    try {
      const persistenceKey = `streaming_state_${threadId}`;
      const stateToSave = {
        ...state,
        startTime: state.startTime || Date.now(),
        persistenceKey,
        // Don't persist abortController
        abortController: null
      };
      localStorage.setItem(persistenceKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('[useStreamingChatV2] Failed to save state to localStorage:', error);
    }
  }, []);

  const loadStateFromStorage = useCallback((threadId: string): ThreadStreamingState | null => {
    try {
      const persistenceKey = `streaming_state_${threadId}`;
      const stored = localStorage.getItem(persistenceKey);
      if (!stored) return null;
      
      const state = JSON.parse(stored);
      
      // Check if state is expired (older than 5 minutes)
      const now = Date.now();
      if (state.startTime && (now - state.startTime > 300000)) {
        localStorage.removeItem(persistenceKey);
        return null;
      }
      
      return state;
    } catch (error) {
      console.warn('[useStreamingChatV2] Failed to load state from localStorage:', error);
      return null;
    }
  }, []);

  const clearStateFromStorage = useCallback((threadId: string) => {
    try {
      const persistenceKey = `streaming_state_${threadId}`;
      localStorage.removeItem(persistenceKey);
    } catch (error) {
      console.warn('[useStreamingChatV2] Failed to clear state from localStorage:', error);
    }
  }, []);

  // Create initial state with storage restoration
  function createInitialState(threadId?: string): ThreadStreamingState {
    // Try to restore from localStorage first
    if (threadId) {
      const stored = loadStateFromStorage(threadId);
      if (stored) {
        console.log(`[useStreamingChatV2] Restored state from localStorage for thread: ${threadId}`);
        return {
          ...stored,
          abortController: null // Create new AbortController
        };
      }
    }

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
      useThreeDotFallback: false,
      startTime: Date.now()
    };
  }

  // Get thread state with storage restoration
  const getThreadState = useCallback((threadId: string): ThreadStreamingState => {
    if (!threadStatesRef.current.has(threadId)) {
      const initialState = createInitialState(threadId);
      threadStatesRef.current.set(threadId, initialState);
    }
    return threadStatesRef.current.get(threadId)!;
  }, [loadStateFromStorage]);

  // Update thread state with persistence
  const updateThreadState = useCallback((targetThreadId: string, newState: Partial<ThreadStreamingState>) => {
    const currentState = getThreadState(targetThreadId);
    const updatedState = { ...currentState, ...newState };
    threadStatesRef.current.set(targetThreadId, updatedState);
    
    // Persist to localStorage
    saveStateToStorage(targetThreadId, updatedState);
    
    // Update local state if this is the current thread
    if (targetThreadId === threadId) {
      setState(updatedState);
    }
  }, [threadId, getThreadState, saveStateToStorage]);

  // Generate correlation ID for request tracking
  const generateCorrelationId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Enhanced streaming messages generation with persistence
  const generateStreamingMessages = useCallback(async (threadId: string, userMessage: string, queryCategory: string) => {
    const fallbackMessages = [
      "Analyzing your journal entries...",
      "Looking for patterns and insights...",
      "Examining emotional themes...",
      "Processing your personal data...",
      "Generating personalized insights..."
    ];

    // Update state with correct fallback setting
    updateThreadState(threadId, {
      dynamicMessages: fallbackMessages,
      translatedDynamicMessages: fallbackMessages,
      useThreeDotFallback: queryCategory !== 'JOURNAL_SPECIFIC' // True for non-journal queries
    });

    let messageIndex = 0;
    
    const showNextMessage = () => {
      const state = getThreadState(threadId);
      if (!state.showDynamicMessages || !state.isStreaming) {
        // Clear global interval
        const intervalId = globalIntervalsRef.current.get(threadId);
        if (intervalId) {
          clearTimeout(intervalId);
          globalIntervalsRef.current.delete(threadId);
        }
        return;
      }
      
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
      
      // Use global interval that survives component unmounts
      const timeoutId = setTimeout(showNextMessage, 2000);
      globalIntervalsRef.current.set(threadId, timeoutId);
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
    
    // Reset state for new request with immediate UI feedback
    const newState = {
      ...threadState,
      isStreaming: true,
      streamingMessages: [],
      showDynamicMessages: messageCategory === 'JOURNAL_SPECIFIC',
      lastUserInput: messageContent,
      requestCorrelationId: correlationId,
      abortController: new AbortController(),
      queryCategory: messageCategory,
      useThreeDotFallback: messageCategory !== 'JOURNAL_SPECIFIC', // Set correct fallback logic
      startTime: Date.now()
    };
    
    updateThreadState(targetThreadId, newState);

    try {
      console.log(`[useStreamingChatV2] Generating streaming messages for category: ${messageCategory}`);
      
      // Generate dynamic messages for JOURNAL_SPECIFIC queries
      if (messageCategory === 'JOURNAL_SPECIFIC') {
        generateStreamingMessages(targetThreadId, messageContent, messageCategory);
      } else {
        // For non-journal queries, show three-dot animation
        updateThreadState(targetThreadId, {
          useThreeDotFallback: true,
          showDynamicMessages: true
        });
        
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
      
      // Clear persistence and global intervals
      clearStateFromStorage(targetThreadId);
      const intervalId = globalIntervalsRef.current.get(targetThreadId);
      if (intervalId) {
        clearTimeout(intervalId);
        globalIntervalsRef.current.delete(targetThreadId);
      }

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

  // Stop streaming for current thread with cleanup
  const stopStreaming = useCallback((targetThreadId?: string) => {
    const threadToStop = targetThreadId || threadId;
    const currentState = getThreadState(threadToStop);
    
    if (currentState.abortController) {
      currentState.abortController.abort();
    }
    
    // Clear global interval
    const intervalId = globalIntervalsRef.current.get(threadToStop);
    if (intervalId) {
      clearTimeout(intervalId);
      globalIntervalsRef.current.delete(threadToStop);
    }
    
    updateThreadState(threadToStop, {
      isStreaming: false,
      showDynamicMessages: false,
      streamingMessages: [],
      abortController: null
    });
    
    // Clear persistence
    clearStateFromStorage(threadToStop);
    
    console.log(`[useStreamingChatV2] Stopped streaming for thread: ${threadToStop}`);
  }, [threadId, getThreadState, updateThreadState, clearStateFromStorage]);

  // Clear streaming messages
  const clearStreamingMessages = useCallback((targetThreadId?: string) => {
    const threadToClear = targetThreadId || threadId;
    updateThreadState(threadToClear, {
      streamingMessages: [],
      showDynamicMessages: false
    });
  }, [threadId, updateThreadState]);

  // Enhanced force recovery with persistence cleanup
  const forceRecovery = useCallback((targetThreadId?: string, reason: string = 'manual') => {
    const threadToRecover = targetThreadId || threadId;
    console.warn(`[useStreamingChatV2] Force recovery triggered for thread ${threadToRecover}, reason: ${reason}`);
    
    const currentState = getThreadState(threadToRecover);
    
    // Abort any active request
    if (currentState.abortController) {
      currentState.abortController.abort();
    }
    
    // Clear global interval
    const intervalId = globalIntervalsRef.current.get(threadToRecover);
    if (intervalId) {
      clearTimeout(intervalId);
      globalIntervalsRef.current.delete(threadToRecover);
    }
    
    // Clear persistence
    clearStateFromStorage(threadToRecover);
    
    // Clear state completely
    updateThreadState(threadToRecover, createInitialState());
    
    console.log(`[useStreamingChatV2] Recovery completed for thread: ${threadToRecover}`);
  }, [threadId, getThreadState, updateThreadState, clearStateFromStorage]);

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

  // Component mount recovery - check for background processing
  useEffect(() => {
    if (!threadId || !user?.id) return;

    const checkBackgroundProcessing = async () => {
      try {
        // Check for any processing messages in the database
        const { data: processingMessages } = await supabase
          .from('chat_messages')
          .select('id, content, is_processing')
          .eq('thread_id', threadId)
          .eq('is_processing', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (processingMessages && processingMessages.length > 0) {
          console.log(`[useStreamingChatV2] Found background processing for thread: ${threadId}`);
          
          // Restore streaming state
          updateThreadState(threadId, {
            isStreaming: true,
            showDynamicMessages: true,
            useThreeDotFallback: false, // Will be updated by generateStreamingMessages
            lastUserInput: 'Background processing...'
          });
          
          // Start streaming messages for recovery
          generateStreamingMessages(threadId, 'Background processing...', 'JOURNAL_SPECIFIC');
        }
      } catch (error) {
        console.warn('[useStreamingChatV2] Failed to check background processing:', error);
      }
    };

    // Check on mount
    setTimeout(checkBackgroundProcessing, 100);
  }, [threadId, user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all global intervals for this thread
      const intervalId = globalIntervalsRef.current.get(threadId);
      if (intervalId) {
        clearTimeout(intervalId);
        globalIntervalsRef.current.delete(threadId);
      }
    };
  }, [threadId]);

  return {
    ...state,
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    forceRecovery: () => forceRecovery(threadId, 'user_manual'),
    isStuck: false
  };
};