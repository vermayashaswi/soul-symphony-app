import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveChatStreamingState, getChatStreamingState, clearChatStreamingState } from '@/utils/chatStateStorage';
import { useAuth } from '@/contexts/AuthContext';

// Streaming message interface
export interface StreamingMessage {
  id: string;
  type: 'user_message' | 'backend_task' | 'progress' | 'final_response' | 'error';
  content: string;
  isVisible: boolean;
  timestamp?: number;
}

// Thread-specific streaming state interface  
export interface ThreadStreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  showDynamicMessages: boolean;
  lastUserInput: string;
  requestStartTime: number;
  requestCorrelationId?: string;
  idempotencyKey?: string;
  lastActivity?: number;
  dynamicMessageIndex: number;
  lastRotationTime: number;
  retryCount: number;
  queryCategory: string;
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
  
  // Thread states map for managing multiple concurrent streams
  const threadStatesRef = useRef<Map<string, ThreadStreamingState>>(new Map());
  
  // Current thread state
  const [state, setState] = useState<ThreadStreamingState>(() => 
    createInitialState()
  );

  // Create initial state for a thread
  function createInitialState(): ThreadStreamingState {
    return {
      isStreaming: false,
      streamingMessages: [],
      showDynamicMessages: false,
      lastUserInput: '',
      requestStartTime: 0,
      requestCorrelationId: undefined,
      idempotencyKey: undefined,
      lastActivity: Date.now(),
      dynamicMessageIndex: 0,
      lastRotationTime: 0,
      retryCount: 0,
      queryCategory: 'JOURNAL_SPECIFIC',
      abortController: null
    };
  }

  // Get thread state from map or create new one
  const getThreadState = useCallback((threadId: string): ThreadStreamingState => {
    if (!threadStatesRef.current.has(threadId)) {
      threadStatesRef.current.set(threadId, createInitialState());
    }
    return threadStatesRef.current.get(threadId)!;
  }, []);

  // Update thread state in map and persist
  const updateThreadState = useCallback((threadId: string, newState: Partial<ThreadStreamingState>) => {
    const currentState = getThreadState(threadId);
    const updatedState = { ...currentState, ...newState };
    threadStatesRef.current.set(threadId, updatedState);
    
    // Update local state if this is the current thread
    if (threadId === threadId) {
      setState(updatedState);
    }
    
    // Persist state if streaming
    if (updatedState.isStreaming) {
      saveStreamingState(threadId, updatedState);
    }
  }, [threadId]);

  // Generate correlation ID for request tracking
  const generateCorrelationId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Generate idempotency key for message deduplication
  const generateIdempotencyKey = useCallback((content: string, sender: 'user' | 'assistant', threadId: string, userId?: string) => {
    const timestamp = Date.now();
    const contentHash = content.slice(0, 50).toLowerCase().replace(/\s+/g, '');
    return `${sender}_${threadId}_${userId || 'anon'}_${contentHash}_${timestamp}`;
  }, []);

  // Check if a request has completed by looking for responses in Supabase
  const checkIfRequestCompleted = useCallback(async (threadId: string, userId: string, correlationId?: string): Promise<boolean> => {
    try {
      console.log(`[useStreamingChatV2] Checking completion for thread: ${threadId} with correlation ID: ${correlationId}`);
      
      // First try to find messages with matching correlation ID for precise tracking
      if (correlationId) {
        const { data: correlatedMessages, error: correlatedError } = await supabase
          .from('chat_messages')
          .select('id, created_at, sender, content, is_processing, request_correlation_id')
          .eq('thread_id', threadId)
          .eq('request_correlation_id', correlationId)
          .order('created_at', { ascending: false });

        if (!correlatedError && correlatedMessages && correlatedMessages.length > 0) {
          const assistantMessage = correlatedMessages.find(msg => msg.sender === 'assistant');
          if (assistantMessage) {
            const isCompleted = !assistantMessage.is_processing && 
                               !assistantMessage.content.includes('Processing');
            console.log(`[useStreamingChatV2] Correlation-based completion check: ${isCompleted} for correlation ID: ${correlationId}`);
            return isCompleted;
          }
        }
      }

      // Fallback: Look for recent assistant messages (last 2 minutes)
      const recentTime = new Date(Date.now() - 120000).toISOString(); // 2 minutes ago
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, created_at, sender, content, is_processing')
        .eq('thread_id', threadId)
        .gte('created_at', recentTime)
        .eq('sender', 'assistant')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('[useStreamingChatV2] Error checking completion:', error);
        return false;
      }

      if (!messages || messages.length === 0) {
        console.log('[useStreamingChatV2] No recent assistant messages found');
        return false;
      }

      // Check if any recent assistant message is complete
      const completedMessage = messages.find(msg => 
        !msg.is_processing && 
        !msg.content.includes('Processing')
      );

      const isCompleted = !!completedMessage;
      console.log(`[useStreamingChatV2] Fallback completion check result: ${isCompleted}`);
      
      return isCompleted;
    } catch (error) {
      console.error('[useStreamingChatV2] Exception checking completion:', error);
      return false;
    }
  }, [supabase]);

  // Save streaming state to localStorage with better structure
  const saveStreamingState = useCallback((threadId: string, state: ThreadStreamingState) => {
    try {
      const stateToSave = {
        ...state,
        requestCorrelationId: state.requestCorrelationId,
        idempotencyKey: state.idempotencyKey,
        lastActivity: Date.now(),
        // Don't save the abort controller
        abortController: null
      };
      
      saveChatStreamingState(threadId, stateToSave);
      console.log(`[useStreamingChatV2] Saved streaming state for thread: ${threadId} with correlation ID: ${state.requestCorrelationId}`);
    } catch (error) {
      console.warn(`[useStreamingChatV2] Failed to save streaming state: ${error}`);
    }
  }, []);

  // Restore streaming state when switching threads or returning to app
  useEffect(() => {
    if (!threadId || !user?.id) return;

    const restoreStateIfStillValid = async () => {
      try {
        // Restore state if it was saved and still valid
        const savedState = getChatStreamingState(threadId);
        if (savedState && savedState.isStreaming) {
          console.log(`[useStreamingChatV2] Found saved streaming state for thread: ${threadId}`);
          
          // Check if the request might still be processing (within last 5 minutes)
          const timeSinceRequest = savedState.lastActivity ? Date.now() - savedState.lastActivity : 0;
          const maxValidTime = 5 * 60 * 1000; // 5 minutes
          
          if (timeSinceRequest < maxValidTime) {
            // Check if the request has completed using correlation ID
            const isCompleted = await checkIfRequestCompleted(
              threadId, 
              user?.id || '', 
              savedState.requestCorrelationId
            );
            
            if (!isCompleted) {
              console.log(`[useStreamingChatV2] Restoring active streaming state for thread: ${threadId} with correlation ID: ${savedState.requestCorrelationId}`);
              const restoredState = {
                ...createInitialState(),
                ...savedState,
                abortController: new AbortController() // Create new abort controller
              };
              
              updateThreadState(threadId, restoredState);
              setState(restoredState);
              
              // Continue dynamic messages if it's a journal-specific query
              if (savedState.queryCategory === 'JOURNAL_SPECIFIC' && savedState.showDynamicMessages) {
                generateStreamingMessages(threadId);
              }
              return;
            } else {
              console.log(`[useStreamingChatV2] Request completed while away, clearing saved state for thread: ${threadId}`);
              clearChatStreamingState(threadId);
            }
          } else {
            console.log(`[useStreamingChatV2] Saved state too old (${Math.round(timeSinceRequest / 1000)}s), clearing for thread: ${threadId}`);
            clearChatStreamingState(threadId);
          }
        }
        
        // Use fresh state
        const threadState = getThreadState(threadId);
        setState(threadState);
      } catch (error) {
        console.warn(`[useStreamingChatV2] Error restoring thread state: ${error}`);
        // Fallback to fresh state
        const threadState = getThreadState(threadId);
        setState(threadState);
      }
    };

    restoreStateIfStillValid();
  }, [threadId, user?.id, getThreadState, updateThreadState, checkIfRequestCompleted]);

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

  // Generate streaming messages for journal-specific queries
  const generateStreamingMessages = useCallback((threadId: string) => {
    const journalMessages = [
      "Analyzing your journal entries...",
      "Looking for patterns and insights...",
      "Examining emotional themes...",
      "Processing your personal data...",
      "Generating personalized insights..."
    ];

    const currentState = getThreadState(threadId);
    let messageIndex = currentState.dynamicMessageIndex;
    
    const showNextMessage = () => {
      if (!getThreadState(threadId).showDynamicMessages) return;
      
      // Clear previous message
      const state = getThreadState(threadId);
      const clearedMessages = state.streamingMessages.map(msg => 
        msg.id.startsWith('dynamic-') ? { ...msg, isVisible: false } : msg
      );
      
      // Add new message
      const newMessage: StreamingMessage = {
        id: `dynamic-${messageIndex}`,
        type: 'progress',
        content: journalMessages[messageIndex % journalMessages.length],
        isVisible: true,
        timestamp: Date.now()
      };
      
      updateThreadState(threadId, {
        streamingMessages: [...clearedMessages, newMessage],
        dynamicMessageIndex: messageIndex + 1,
        lastRotationTime: Date.now()
      });
      
      messageIndex++;
      
      // Schedule next message
      setTimeout(showNextMessage, 2000);
    };
    
    // Start the first message immediately
    showNextMessage();
  }, [getThreadState, updateThreadState]);

  // Start streaming chat with correlation tracking
  const startStreamingChat = useCallback(async (
    messageContent: string,
    targetThreadId: string,
    userId: string,
    messageCategory: string = 'JOURNAL_SPECIFIC',
    parameters: Record<string, any> = {},
    messageId?: string
  ): Promise<void> => {
    if (!messageContent?.trim() || !targetThreadId || !userId) {
      console.error('[useStreamingChatV2] Invalid parameters for streaming chat');
      return;
    }

    console.log(`[useStreamingChatV2] Starting streaming chat for thread: ${targetThreadId}`);
    const threadState = getThreadState(targetThreadId);
    
    // Generate correlation ID and idempotency key for this request
    const correlationId = generateCorrelationId();
    const idempotencyKey = generateIdempotencyKey(messageContent, 'user', targetThreadId, userId);
    
    console.log(`[useStreamingChatV2] Generated correlation ID: ${correlationId}, idempotency key: ${idempotencyKey}`);
    
    // Reset state for new request
    const newState = {
      ...threadState,
      isStreaming: true,
      streamingMessages: [],
      showDynamicMessages: messageCategory === 'JOURNAL_SPECIFIC',
      lastUserInput: messageContent,
      requestStartTime: Date.now(),
      requestCorrelationId: correlationId,
      idempotencyKey: idempotencyKey,
      abortController: new AbortController(),
      retryCount: 0,
      queryCategory: messageCategory
    };
    
    updateThreadState(targetThreadId, newState);

    try {
      console.log(`[useStreamingChatV2] Generating streaming messages for category: ${messageCategory}`);
      
      // Generate dynamic messages for JOURNAL_SPECIFIC queries
      if (messageCategory === 'JOURNAL_SPECIFIC') {
        generateStreamingMessages(targetThreadId);
      } else {
        // For non-journal queries, show a simple processing state
        addStreamingMessage(targetThreadId, {
          id: 'processing-general',
          type: 'progress',
          content: 'Processing your request...',
          isVisible: true
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
          messageId: messageId, // Pass the user message ID for correlation
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
          isVisible: true
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

      // Clear saved state since request is complete
      clearChatStreamingState(targetThreadId);

      // Emit completion event for UI updates
      const completionEvent = new CustomEvent('chatResponseReady', {
        detail: { threadId: targetThreadId, response: result, correlationId: correlationId }
      });
      window.dispatchEvent(completionEvent);

      console.log('[useStreamingChatV2] Successfully completed streaming chat');

    } catch (error) {
      console.error('[useStreamingChatV2] Exception in streaming chat:', error);
      
      const currentState = getThreadState(targetThreadId);
      if (!currentState.abortController?.signal.aborted) {
        addStreamingMessage(targetThreadId, {
          id: 'error-' + Date.now(),
          type: 'error',
          content: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isVisible: true
        });

        updateThreadState(targetThreadId, {
          ...currentState,
          isStreaming: false,
          showDynamicMessages: false
        });
      }
    }
  }, [getThreadState, updateThreadState, addStreamingMessage, generateStreamingMessages, generateCorrelationId, generateIdempotencyKey, supabase]);

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
    
    clearChatStreamingState(threadToStop);
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

  return {
    ...state,
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    generateCorrelationId,
    generateIdempotencyKey
  };
};