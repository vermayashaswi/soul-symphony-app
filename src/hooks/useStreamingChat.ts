import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showEdgeFunctionRetryToast } from '@/utils/toast-messages';
import { saveChatStreamingState, getChatStreamingState, clearChatStreamingState } from '@/utils/chatStateStorage';

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
  onFinalResponse?: (response: string, analysis: any | undefined, originThreadId: string | null) => void;
  onError?: (error: string) => void;
  threadId?: string | null; // Thread-specific hook instance
}

// Thread-isolated streaming state management
interface ThreadStreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  currentUserMessage: string;
  showBackendAnimation: boolean;
  dynamicMessages: string[];
  currentMessageIndex: number;
  useThreeDotFallback: boolean;
  queryCategory: string;
  expectedProcessingTime: number | null;
  processingStartTime: number | null;
  isRetrying: boolean;
  retryAttempts: number;
  lastFailedMessage: any | null;
  abortController: AbortController | null;
}

const createInitialState = (): ThreadStreamingState => ({
  isStreaming: false,
  streamingMessages: [],
  currentUserMessage: '',
  showBackendAnimation: false,
  dynamicMessages: [],
  currentMessageIndex: 0,
  useThreeDotFallback: false,
  queryCategory: '',
  expectedProcessingTime: null,
  processingStartTime: null,
  isRetrying: false,
  retryAttempts: 0,
  lastFailedMessage: null,
  abortController: null,
});

// Global thread state store
const threadStates = new Map<string, ThreadStreamingState>();

export const useStreamingChat = ({ onFinalResponse, onError, threadId }: UseStreamingChatProps = {}) => {
  // Get or create thread-specific state
  const getThreadState = useCallback((id: string): ThreadStreamingState => {
    if (!threadStates.has(id)) {
      threadStates.set(id, createInitialState());
    }
    return threadStates.get(id)!;
  }, []);

  const updateThreadState = useCallback((id: string, updates: Partial<ThreadStreamingState>) => {
    const currentState = getThreadState(id);
    const newState = { ...currentState, ...updates };
    threadStates.set(id, newState);
    
    // Only update local state if this is the active thread
    if (id === threadId) {
      setState(newState);
    }
  }, [threadId]);

  // Local state mirrors the active thread state
  const [state, setState] = useState<ThreadStreamingState>(() => 
    threadId ? getThreadState(threadId) : createInitialState()
  );

  const maxRetryAttempts = 2;

  // Thread switch handler - abort current operations and switch state
  useEffect(() => {
    if (!threadId) {
      setState(createInitialState());
      return;
    }

    console.log(`[useStreamingChat] Switching to thread: ${threadId}`);
    
    // Abort any ongoing requests for previous threads
    threadStates.forEach((threadState, id) => {
      if (id !== threadId && threadState.abortController) {
        console.log(`[useStreamingChat] Aborting operations for thread: ${id}`);
        threadState.abortController.abort();
        threadState.abortController = null;
        threadState.isStreaming = false;
      }
    });

    // Set state to the new thread's state
    const threadState = getThreadState(threadId);
    setState(threadState);
    
    // Clear any event listeners from previous threads
    return () => {
      // Cleanup will be handled by the abort controller
    };
  }, [threadId, getThreadState]);

  // Utility function to detect edge function errors
  const isEdgeFunctionError = useCallback((error: any): boolean => {
    const errorMessage = error?.message || error?.toString() || '';
    return (
      errorMessage.includes('non-2xx code') ||
      errorMessage.includes('edge function') ||
      errorMessage.includes('FunctionsError') ||
      error?.status >= 400
    );
  }, []);

  // Detect network errors (offline, fetch failures)
  const isNetworkError = useCallback((error: any): boolean => {
    const msg = (error?.message || error?.toString() || '').toLowerCase();
    return (
      !navigator.onLine ||
      error instanceof TypeError ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network error') ||
      msg.includes('timeout')
    );
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Backoff wrapper for supabase.functions.invoke with abort support
  const invokeWithBackoff = useCallback(
    async (
      body: Record<string, any>,
      options?: { attempts?: number; baseDelay?: number },
      targetThreadId?: string
    ): Promise<{ data: any; error: any }> => {
      if (!targetThreadId || targetThreadId !== threadId) {
        throw new Error('Thread mismatch - operation aborted');
      }

      const attempts = options?.attempts ?? 3;
      const baseDelay = options?.baseDelay ?? 900;
      const threadState = getThreadState(targetThreadId);

      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        // Check if thread is still active
        if (targetThreadId !== threadId) {
          throw new Error('Thread switched - operation aborted');
        }

        // Check abort signal
        if (threadState.abortController?.signal.aborted) {
          throw new Error('Operation aborted');
        }

        try {
          const timeoutMs = 20000 + i * 5000;
          const timeoutPromise = new Promise((_, rej) =>
            setTimeout(() => rej(new Error('Request timed out')), timeoutMs)
          );

          const result = (await Promise.race([
            supabase.functions.invoke('chat-with-rag', { body }),
            timeoutPromise,
          ])) as { data: any; error: any };

          if ((result as any)?.error) {
            lastErr = (result as any).error;
            if (isEdgeFunctionError(lastErr) || isNetworkError(lastErr)) {
              // retryable
            } else {
              return result;
            }
          } else {
            return result;
          }
        } catch (e) {
          lastErr = e;
        }
        
        const delay = Math.min(6000, baseDelay * Math.pow(2, i)) + Math.floor(Math.random() * 250);
        await sleep(delay);
      }
      return { data: null, error: lastErr || new Error('Unknown error') };
    },
    [isEdgeFunctionError, isNetworkError, threadId, getThreadState]
  );

  const addStreamingMessage = useCallback((message: StreamingMessage, targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    console.log(`[useStreamingChat] Adding message to thread ${activeThreadId}:`, message.type);
    
    const threadState = getThreadState(activeThreadId);
    const newMessages = [...threadState.streamingMessages, message];
    
    const updates: Partial<ThreadStreamingState> = {
      streamingMessages: newMessages
    };
    
    // Handle different message types
    switch (message.type) {
      case 'user_message':
        updates.currentUserMessage = message.message || '';
        updates.showBackendAnimation = false;
        break;
      case 'backend_task':
        updates.showBackendAnimation = true;
        break;
      case 'final_response':
        updates.isStreaming = false;
        updates.showBackendAnimation = false;
        updates.retryAttempts = 0;
        updates.lastFailedMessage = null;
        updates.isRetrying = false;
        
        // Clear persisted state and abort controller
        clearChatStreamingState(activeThreadId);
        if (threadState.abortController) {
          threadState.abortController = null;
        }
        
        // Only call callback if this is for the current thread
        if (activeThreadId === threadId) {
          onFinalResponse?.(message.response || '', message.analysis, activeThreadId);
        }
        break;
      case 'error':
        updates.isStreaming = false;
        updates.showBackendAnimation = false;
        
        // Clear persisted state and abort controller
        clearChatStreamingState(activeThreadId);
        if (threadState.abortController) {
          threadState.abortController = null;
        }
        
        // Only call callback if this is for the current thread
        if (activeThreadId === threadId) {
          onError?.(message.error || 'Unknown error occurred');
        }
        break;
    }

    updateThreadState(activeThreadId, updates);
  }, [threadId, getThreadState, updateThreadState, onFinalResponse, onError]);

  // Reset retry state when starting new conversation
  const resetRetryState = useCallback((targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    updateThreadState(activeThreadId, {
      retryAttempts: 0,
      lastFailedMessage: null,
      isRetrying: false
    });
  }, [threadId, updateThreadState]);

  // Generate streaming messages based on category
  const generateStreamingMessages = useCallback(async (
    message: string, 
    category: string, 
    conversationContext?: any[], 
    userProfile?: any,
    targetThreadId?: string
  ) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId || activeThreadId !== threadId) return;

    try {
      const { data, error } = await supabase.functions.invoke('generate-streaming-messages', {
        body: {
          userMessage: message,
          category,
          conversationContext,
          userProfile
        }
      });

      if (error) throw error;

      // Only update if still on the same thread
      if (activeThreadId === threadId) {
        if (data.shouldUseFallback || !data.messages || data.messages.length === 0) {
          updateThreadState(activeThreadId, {
            useThreeDotFallback: true,
            dynamicMessages: []
          });
        } else {
          updateThreadState(activeThreadId, {
            useThreeDotFallback: false,
            dynamicMessages: data.messages,
            currentMessageIndex: 0
          });
        }
      }
    } catch (error) {
      console.error('[useStreamingChat] Error generating streaming messages:', error);
      if (activeThreadId === threadId) {
        updateThreadState(activeThreadId, {
          useThreeDotFallback: true,
          dynamicMessages: []
        });
      }
    }
  }, [threadId, updateThreadState]);

  // Automatic retry function for failed messages
  const retryLastMessage = useCallback(async (targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId || activeThreadId !== threadId) return;

    const threadState = getThreadState(activeThreadId);
    
    if (!threadState.lastFailedMessage || threadState.retryAttempts >= maxRetryAttempts || threadState.isRetrying) {
      return;
    }

    console.log(`[useStreamingChat] Retrying message for thread ${activeThreadId} (attempt ${threadState.retryAttempts + 1}/${maxRetryAttempts})`);
    
    updateThreadState(activeThreadId, {
      isRetrying: true,
      retryAttempts: threadState.retryAttempts + 1
    });

    showEdgeFunctionRetryToast();
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Check if still on same thread
      if (activeThreadId !== threadId) return;

      await generateStreamingMessages(
        threadState.lastFailedMessage.message, 
        'GENERAL_MENTAL_HEALTH', 
        threadState.lastFailedMessage.conversationContext, 
        threadState.lastFailedMessage.userProfile,
        activeThreadId
      );

      const { data, error } = await invokeWithBackoff({
        message: threadState.lastFailedMessage.message,
        userId: threadState.lastFailedMessage.userId,
        threadId: threadState.lastFailedMessage.threadId,
        conversationContext: threadState.lastFailedMessage.conversationContext,
        userProfile: threadState.lastFailedMessage.userProfile,
        streamingMode: false
      }, undefined, activeThreadId);

      if (error) {
        if (isEdgeFunctionError(error) && threadState.retryAttempts < maxRetryAttempts - 1) {
          throw error;
        } else {
          addStreamingMessage({
            type: 'error',
            error: 'Unable to process your request after multiple attempts. Please try again later.',
            timestamp: Date.now()
          }, activeThreadId);
          resetRetryState(activeThreadId);
          return;
        }
      }

      const text = data?.response ?? data?.data ?? data?.message ?? (typeof data === 'string' ? data : null);
      if (text) {
        addStreamingMessage({
          type: 'final_response',
          response: text,
          analysis: data?.analysis,
          timestamp: Date.now()
        }, activeThreadId);
        resetRetryState(activeThreadId);
      } else {
        throw new Error('No response received from chat service');
      }

    } catch (error) {
      console.error('[useStreamingChat] Retry failed:', error);
      const currentState = getThreadState(activeThreadId);
      if (currentState.retryAttempts >= maxRetryAttempts - 1) {
        addStreamingMessage({
          type: 'error',
          error: 'Unable to process your request after multiple attempts. Please try again later.',
          timestamp: Date.now()
        }, activeThreadId);
        resetRetryState(activeThreadId);
      }
    } finally {
      updateThreadState(activeThreadId, { isRetrying: false });
    }
  }, [threadId, getThreadState, updateThreadState, generateStreamingMessages, invokeWithBackoff, isEdgeFunctionError, addStreamingMessage, resetRetryState]);

  // Enhanced timing logic with thread validation
  useEffect(() => {
    if (!threadId || !state.isStreaming || state.useThreeDotFallback || state.dynamicMessages.length === 0) return;

    let timeoutId: NodeJS.Timeout;
    
    if (state.queryCategory === 'JOURNAL_SPECIFIC') {
      const remainingTime = state.expectedProcessingTime ? 
        Math.max(0, state.expectedProcessingTime - (Date.now() - (state.processingStartTime || Date.now()))) : 
        15000;
      
      const messagesLeft = state.dynamicMessages.length - state.currentMessageIndex;
      const timePerMessage = messagesLeft > 1 ? Math.min(5000, remainingTime / messagesLeft) : remainingTime;
      
      if (state.currentMessageIndex < state.dynamicMessages.length - 1) {
        timeoutId = setTimeout(() => {
          // Double-check we're still on the same thread
          if (threadId && getThreadState(threadId).isStreaming) {
            updateThreadState(threadId, {
              currentMessageIndex: state.currentMessageIndex + 1
            });
          }
        }, timePerMessage);
      }
    } else {
      const interval = setInterval(() => {
        if (threadId && getThreadState(threadId).isStreaming) {
          const currentState = getThreadState(threadId);
          updateThreadState(threadId, {
            currentMessageIndex: (currentState.currentMessageIndex + 1) % currentState.dynamicMessages.length
          });
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [threadId, state.isStreaming, state.useThreeDotFallback, state.dynamicMessages.length, state.currentMessageIndex, state.queryCategory, state.expectedProcessingTime, state.processingStartTime, getThreadState, updateThreadState]);

  // Safety completion guard with thread validation
  useEffect(() => {
    if (!threadId || !state.isStreaming) return;
    
    const graceMs = 45000;
    const budget = (state.expectedProcessingTime ?? 60000) + graceMs;
    const startedAt = state.processingStartTime ?? Date.now();
    const remaining = Math.max(5000, budget - (Date.now() - startedAt));
    
    const timer = setTimeout(() => {
      // Verify we're still on the same thread before showing error
      if (threadId && getThreadState(threadId).isStreaming) {
        console.warn(`[useStreamingChat] Safety guard triggered for thread: ${threadId}`);
        addStreamingMessage({
          type: 'error',
          error: 'Connection seems unstable. Please retry.',
          timestamp: Date.now()
        }, threadId);
        
        const currentState = getThreadState(threadId);
        if (currentState.lastFailedMessage) {
          updateThreadState(threadId, { lastFailedMessage: currentState.lastFailedMessage });
        }
      }
    }, remaining);
    
    return () => clearTimeout(timer);
  }, [threadId, state.isStreaming, state.expectedProcessingTime, state.processingStartTime, getThreadState, addStreamingMessage, updateThreadState]);

  const startStreamingChat = useCallback(async (
    message: string,
    userId: string,
    targetThreadId: string,
    conversationContext: any[] = [],
    userProfile: any = {}
  ) => {
    // Validate thread consistency
    if (targetThreadId !== threadId) {
      console.warn(`[useStreamingChat] Thread mismatch: target=${targetThreadId}, current=${threadId}`);
      return;
    }

    const threadState = getThreadState(targetThreadId);
    if (threadState.isStreaming) {
      console.warn(`[useStreamingChat] Already streaming for thread ${targetThreadId}, ignoring new request`);
      return;
    }

    console.log(`[useStreamingChat] Starting chat for thread: ${targetThreadId}`);

    // Create abort controller for this streaming session
    const abortController = new AbortController();
    
    // Reset and initialize state
    const updates: Partial<ThreadStreamingState> = {
      isStreaming: true,
      processingStartTime: Date.now(),
      streamingMessages: [],
      currentUserMessage: '',
      showBackendAnimation: false,
      useThreeDotFallback: false,
      dynamicMessages: [],
      currentMessageIndex: 0,
      retryAttempts: 0,
      lastFailedMessage: null,
      isRetrying: false,
      abortController
    };

    updateThreadState(targetThreadId, updates);

    // Add user message immediately
    addStreamingMessage({
      type: 'user_message',
      message,
      timestamp: Date.now()
    }, targetThreadId);

    // Classify message to determine streaming behavior
    let messageCategory = 'GENERAL_MENTAL_HEALTH';
    try {
      const { data: classificationData, error: classificationError } = await supabase.functions.invoke('chat-query-classifier', {
        body: {
          message,
          conversationContext: conversationContext || []
        }
      });
      
      if (!classificationError && classificationData?.category) {
        messageCategory = classificationData.category;
        console.log(`[useStreamingChat] Message classified as: ${messageCategory} for thread: ${targetThreadId}`);
      }
    } catch (error) {
      console.error('[useStreamingChat] Classification failed, using fallback:', error);
    }

    // Check thread consistency before proceeding
    if (targetThreadId !== threadId) {
      console.warn(`[useStreamingChat] Thread switched during classification, aborting`);
      return;
    }

    updateThreadState(targetThreadId, { queryCategory: messageCategory });

    await generateStreamingMessages(message, messageCategory, conversationContext, userProfile, targetThreadId);
    
    const estimatedTime = messageCategory === 'JOURNAL_SPECIFIC' ? 20000 : 10000;
    updateThreadState(targetThreadId, { expectedProcessingTime: estimatedTime });
    
    // Save streaming state for persistence
    saveChatStreamingState(targetThreadId, {
      isStreaming: true,
      streamingMessages: [],
      currentUserMessage: message,
      showBackendAnimation: false,
      dynamicMessages: [],
      currentMessageIndex: 0,
      useThreeDotFallback: false,
      queryCategory: messageCategory,
      expectedProcessingTime: estimatedTime,
      processingStartTime: Date.now()
    });

    try {
      const { data, error } = await invokeWithBackoff({
        message,
        userId,
        threadId: targetThreadId,
        conversationContext,
        userProfile,
        streamingMode: false
      }, { attempts: 3, baseDelay: 900 }, targetThreadId);

      // Final thread check before processing response
      if (targetThreadId !== threadId) {
        console.warn(`[useStreamingChat] Thread switched before response, ignoring result`);
        return;
      }

      if (error) {
        if (isEdgeFunctionError(error) || isNetworkError(error)) {
          updateThreadState(targetThreadId, {
            lastFailedMessage: { message, userId, threadId: targetThreadId, conversationContext, userProfile }
          });
          setTimeout(() => retryLastMessage(targetThreadId), 800);
          return;
        }
        throw new Error(error?.message || 'Request failed');
      }

      const text = data?.response ?? data?.data ?? data?.message ?? (typeof data === 'string' ? data : null);
      if (text) {
        addStreamingMessage({
          type: 'final_response',
          response: text,
          analysis: data?.analysis,
          timestamp: Date.now()
        }, targetThreadId);
      } else {
        throw new Error('No response received from chat service');
      }
    } catch (err: any) {
      console.warn(`[useStreamingChat] Backoff flow failed for thread ${targetThreadId}:`, err);
      
      // Only show error if still on the same thread
      if (targetThreadId === threadId) {
        addStreamingMessage({
          type: 'error',
          error: err?.message || 'Unknown error occurred',
          timestamp: Date.now()
        }, targetThreadId);
      }
    }
  }, [threadId, getThreadState, updateThreadState, addStreamingMessage, generateStreamingMessages, invokeWithBackoff, isEdgeFunctionError, isNetworkError, retryLastMessage]);

  const stopStreaming = useCallback((targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    console.log(`[useStreamingChat] Stopping streaming for thread: ${activeThreadId}`);
    
    const threadState = getThreadState(activeThreadId);
    if (threadState.abortController) {
      threadState.abortController.abort();
    }
    
    updateThreadState(activeThreadId, {
      isStreaming: false,
      showBackendAnimation: false,
      abortController: null
    });
    
    clearChatStreamingState(activeThreadId);
  }, [threadId, getThreadState, updateThreadState]);

  const clearStreamingMessages = useCallback((targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    console.log(`[useStreamingChat] Clearing messages for thread: ${activeThreadId}`);
    
    updateThreadState(activeThreadId, {
      streamingMessages: [],
      currentUserMessage: '',
      showBackendAnimation: false,
      useThreeDotFallback: false,
      dynamicMessages: [],
      currentMessageIndex: 0,
      queryCategory: ''
    });
  }, [threadId, updateThreadState]);

  const restoreStreamingState = useCallback((targetThreadId: string) => {
    if (targetThreadId !== threadId) return false;

    try {
      const savedState = getChatStreamingState(targetThreadId);
      if (savedState && savedState.isStreaming) {
        console.log(`[useStreamingChat] Restoring streaming state for thread: ${targetThreadId}`);
        
        updateThreadState(targetThreadId, {
          ...savedState,
          abortController: new AbortController() // Create new abort controller
        });
        
        return true;
      }
    } catch (error) {
      console.error('[useStreamingChat] Error restoring streaming state:', error);
    }
    return false;
  }, [threadId, updateThreadState]);

  // Cleanup when thread changes or component unmounts
  useEffect(() => {
    return () => {
      if (threadId) {
        const threadState = getThreadState(threadId);
        if (threadState.abortController) {
          threadState.abortController.abort();
        }
      }
    };
  }, [threadId, getThreadState]);

  return {
    // Thread-isolated state
    isStreaming: state.isStreaming,
    streamingMessages: state.streamingMessages,
    currentUserMessage: state.currentUserMessage,
    showBackendAnimation: state.showBackendAnimation,
    dynamicMessages: state.dynamicMessages,
    currentMessageIndex: state.currentMessageIndex,
    useThreeDotFallback: state.useThreeDotFallback,
    queryCategory: state.queryCategory,
    expectedProcessingTime: state.expectedProcessingTime,
    processingStartTime: state.processingStartTime,
    isRetrying: state.isRetrying,
    retryAttempts: state.retryAttempts,
    
    // Thread-safe methods
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    restoreStreamingState,
    retryLastMessage: () => retryLastMessage(threadId),
    
    // Utility methods
    addStreamingMessage: (message: StreamingMessage) => addStreamingMessage(message, threadId)
  };
};