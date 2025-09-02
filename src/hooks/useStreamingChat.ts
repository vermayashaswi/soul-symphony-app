import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showEdgeFunctionRetryToast } from '@/utils/toast-messages';
import { useTranslation } from '@/contexts/TranslationContext';

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
  requestId?: string;
}

interface UseStreamingChatProps {
  onFinalResponse?: (response: string, analysis: any | undefined, originThreadId: string | null, requestId?: string | null) => void;
  onError?: (error: string) => void;
  threadId?: string | null;
}

// Thread-isolated streaming state management
interface ThreadStreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  currentUserMessage: string;
  showBackendAnimation: boolean;
  dynamicMessages: string[];
  translatedDynamicMessages: string[];
  currentMessageIndex: number;
  useThreeDotFallback: boolean;
  queryCategory: string;
  expectedProcessingTime: number | null;
  processingStartTime: number | null;
  isRetrying: boolean;
  retryAttempts: number;
  lastFailedMessage: any | null;
  abortController: AbortController | null;
  activeRequestId: string | null;
  lastMessageFingerprint: string | null;
}

const createInitialState = (): ThreadStreamingState => ({
  isStreaming: false,
  streamingMessages: [],
  currentUserMessage: '',
  showBackendAnimation: false,
  dynamicMessages: [],
  translatedDynamicMessages: [],
  currentMessageIndex: 0,
  useThreeDotFallback: false,
  queryCategory: '',
  expectedProcessingTime: null,
  processingStartTime: null,
  isRetrying: false,
  retryAttempts: 0,
  lastFailedMessage: null,
  abortController: null,
  activeRequestId: null,
  lastMessageFingerprint: null,
});

// Global thread state store
const threadStates = new Map<string, ThreadStreamingState>();

export const useStreamingChat = ({ onFinalResponse, onError, threadId }: UseStreamingChatProps = {}) => {
  const { translate, currentLanguage } = useTranslation();

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

  // Create message fingerprint to prevent duplicates with stronger hash
  const createMessageFingerprint = useCallback((message: string, threadId: string, userId: string, timestamp: number) => {
    const normalizedMessage = message.trim().toLowerCase();
    const timeWindow = Math.floor(timestamp / 5000); // 5-second window for better deduplication
    const messageHash = normalizedMessage.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `${userId}_${threadId}_${messageHash}_${timeWindow}`;
  }, []);

  // Update local state when thread changes
  useEffect(() => {
    if (!threadId) {
      setState(createInitialState());
      return;
    }

    const threadState = getThreadState(threadId);
    setState(threadState);
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

  // Detect network errors
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
      if (!targetThreadId) {
        throw new Error('Missing target thread');
      }

      const attempts = options?.attempts ?? 3;
      const baseDelay = options?.baseDelay ?? 900;
      const threadState = getThreadState(targetThreadId);

      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        // Check abort signal
        if (threadState.abortController?.signal.aborted) {
          throw new Error('Operation aborted');
        }

        try {
          let result: { data: any; error: any };

          console.log(`[useStreamingChat] Invoking chat-with-rag for orchestration`);

          // ALL messages go through chat-with-rag for unified orchestration
          const timeoutMs = 20000 + i * 5000;
          const timeoutPromise = new Promise((_, rej) =>
            setTimeout(() => rej(new Error('Request timed out')), timeoutMs)
          );

          result = (await Promise.race([
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
    [isEdgeFunctionError, isNetworkError, getThreadState]
  );

  const addStreamingMessage = useCallback((message: StreamingMessage, targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    console.log(`[useStreamingChat] Adding message to thread ${activeThreadId}:`, message.type);
    
    const threadState = getThreadState(activeThreadId);

    // Correlate final/error messages to active request - prevent duplicate responses
    if ((message.type === 'final_response' || message.type === 'error') && message.requestId && threadState.activeRequestId && message.requestId !== threadState.activeRequestId) {
      console.warn('[useStreamingChat] Ignoring stale message due to requestId mismatch', { 
        incoming: message.requestId, 
        active: threadState.activeRequestId,
        messageType: message.type 
      });
      return;
    }

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
        updates.activeRequestId = null;
        
        if (threadState.abortController) {
          threadState.abortController = null;
        }
        
        onFinalResponse?.(message.response || '', message.analysis, activeThreadId, message.requestId || null);
        break;
      case 'error':
        updates.isStreaming = false;
        updates.showBackendAnimation = false;
        updates.activeRequestId = null;
        
        if (threadState.abortController) {
          threadState.abortController = null;
        }
        
        onError?.(message.error || 'Unknown error occurred');
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

  // Generate streaming messages with userStatusMessage support
  const generateStreamingMessages = useCallback(async (
    message: string, 
    targetThreadId?: string,
    userStatusMessage?: string | null
  ) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    // Check if we have a userStatusMessage from the query planner
    if (userStatusMessage && userStatusMessage.trim()) {
      console.log(`[useStreamingChat] Using userStatusMessage for dynamic content: ${userStatusMessage}`);
      
      // Create dynamic messages array from the userStatusMessage
      const dynamicMessages = [userStatusMessage];
      const translatedMessages = await Promise.all(
        dynamicMessages.map(msg => translate(msg))
      );

      updateThreadState(activeThreadId, {
        useThreeDotFallback: false,
        dynamicMessages,
        translatedDynamicMessages: translatedMessages,
        currentMessageIndex: 0,
        queryCategory: 'JOURNAL_SPECIFIC', // Set category for proper message rotation
        processingStartTime: Date.now()
      });
    } else {
      // Fallback to simple three-dot animation
      updateThreadState(activeThreadId, {
        useThreeDotFallback: true,
        dynamicMessages: [],
        translatedDynamicMessages: [],
        currentMessageIndex: 0
      });
    }
  }, [threadId, updateThreadState, translate]);

  // Automatic retry function for failed messages
  const retryLastMessage = useCallback(async (targetThreadId?: string) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

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
      await generateStreamingMessages(
        threadState.lastFailedMessage.message,
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

  // Time-based message rotation with resume capability
  useEffect(() => {
    if (!threadId || !state.isStreaming || state.useThreeDotFallback || state.dynamicMessages.length === 0) return;

    let timeoutId: NodeJS.Timeout;
    let interval: NodeJS.Timeout;
    
    if (state.queryCategory === 'JOURNAL_SPECIFIC') {
      // Calculate elapsed time since streaming started
      const elapsedMs = Date.now() - (state.processingStartTime || Date.now());
      const expectedIndex = Math.floor(elapsedMs / 7000);
      const targetIndex = Math.min(expectedIndex, state.dynamicMessages.length - 1);
      
      // Update to correct position if behind
      if (state.currentMessageIndex < targetIndex) {
        updateThreadState(threadId, { currentMessageIndex: targetIndex });
      }
      
      // Continue rotation if not at the end
      const isLast = state.currentMessageIndex >= state.dynamicMessages.length - 1;
      if (!isLast) {
        const nextChangeIn = 7000 - (elapsedMs % 7000);
        timeoutId = setTimeout(() => {
          if (threadId && getThreadState(threadId).isStreaming) {
            updateThreadState(threadId, {
              currentMessageIndex: state.currentMessageIndex + 1
            });
          }
        }, nextChangeIn);
      }
    } else {
      // Calculate elapsed time for circular rotation
      const elapsedMs = Date.now() - (state.processingStartTime || Date.now());
      const expectedIndex = Math.floor(elapsedMs / 2000) % state.dynamicMessages.length;
      
      // Update to correct position if behind
      if (state.currentMessageIndex !== expectedIndex) {
        updateThreadState(threadId, { currentMessageIndex: expectedIndex });
      }
      
      // Continue circular rotation
      const nextChangeIn = 2000 - (elapsedMs % 2000);
      timeoutId = setTimeout(() => {
        interval = setInterval(() => {
          if (threadId && getThreadState(threadId).isStreaming) {
            const currentState = getThreadState(threadId);
            updateThreadState(threadId, {
              currentMessageIndex: (currentState.currentMessageIndex + 1) % currentState.dynamicMessages.length
            });
          }
        }, 2000);
      }, nextChangeIn);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (interval) clearInterval(interval);
    };
  }, [threadId, state.isStreaming, state.useThreeDotFallback, state.dynamicMessages.length, state.currentMessageIndex, state.queryCategory, state.processingStartTime, getThreadState, updateThreadState]);

  // Safety completion guard
  useEffect(() => {
    if (!threadId || !state.isStreaming) return;
    
    // For long-running journal-specific analysis, keep showing dynamic messages
    if (state.queryCategory === 'JOURNAL_SPECIFIC') {
      return;
    }
    
    const graceMs = 45000;
    const budget = (state.expectedProcessingTime ?? 60000) + graceMs;
    const startedAt = state.processingStartTime ?? Date.now();
    const remaining = Math.max(5000, budget - (Date.now() - startedAt));
    
    const timer = setTimeout(() => {
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
    const threadState = getThreadState(targetThreadId);
    
    // Check for duplicate requests with enhanced detection
    const currentTime = Date.now();
    const messageFingerprint = createMessageFingerprint(message, targetThreadId, userId, currentTime);
    
    if (threadState.isStreaming && threadState.activeRequestId) {
      console.warn(`[useStreamingChat] Already streaming for thread ${targetThreadId} (requestId: ${threadState.activeRequestId}), ignoring new request`);
      return;
    }

    if (threadState.lastMessageFingerprint === messageFingerprint && 
        currentTime - (threadState.processingStartTime || 0) < 10000) {
      console.warn(`[useStreamingChat] Duplicate message detected for thread ${targetThreadId} (fingerprint: ${messageFingerprint}), ignoring`);
      return;
    }

    console.log(`[useStreamingChat] Starting chat for thread: ${targetThreadId}`);

    // Create unique request ID
    const requestId = `${targetThreadId}_${currentTime}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create abort controller
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
      abortController,
      activeRequestId: requestId,
      lastMessageFingerprint: messageFingerprint,
    };

    updateThreadState(targetThreadId, updates);

    // Add user message immediately
    addStreamingMessage({
      type: 'user_message',
      message,
      timestamp: Date.now()
    }, targetThreadId);

    // Fetch user timezone
    let userTimezone = 'UTC';
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single();
      
      if (!profileError && profile?.timezone) {
        userTimezone = profile.timezone;
        console.log(`[useStreamingChat] Using user timezone: ${userTimezone}`);
      }
    } catch (error) {
      console.error('[useStreamingChat] Error fetching user timezone:', error);
    }

    // NO FRONTEND CLASSIFICATION - Let chat-with-rag be the sole orchestrator
    console.log(`[useStreamingChat] Sending message to chat-with-rag for classification and orchestration`);
    
    updateThreadState(targetThreadId, { 
      queryCategory: 'unknown', // Will be determined by backend
      expectedProcessingTime: 45000 // Default estimate, backend will adjust if needed
    });

    try {
      const { data, error } = await invokeWithBackoff({
        message,
        userId,
        threadId: targetThreadId,
        conversationContext,
        userProfile: { ...userProfile, timezone: userTimezone },
        streamingMode: false,
        requestId,
        userTimezone,
      }, { attempts: 3, baseDelay: 900 }, targetThreadId);
      
      // Check if request is still active
      const currentThreadState = getThreadState(targetThreadId);
      if (currentThreadState.activeRequestId !== requestId) {
        console.log(`[useStreamingChat] Request superseded for thread ${targetThreadId}, ignoring response`);
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

      // Extract userStatusMessage for dynamic streaming and update messages
      const userStatusMessage = data?.userStatusMessage;
      
      // Update streaming messages with userStatusMessage if available
      if (userStatusMessage && userStatusMessage.trim()) {
        console.log(`[useStreamingChat] Found userStatusMessage from backend: ${userStatusMessage}`);
        await generateStreamingMessages(message, targetThreadId, userStatusMessage);
      } else {
        console.log(`[useStreamingChat] No userStatusMessage found in response - falling back to basic animation`);
        await generateStreamingMessages(message, targetThreadId, null);
      }

      const text = data?.response ?? data?.data ?? data?.message ?? (typeof data === 'string' ? data : null);
      if (text) {
        addStreamingMessage({
          type: 'final_response',
          response: text,
          analysis: data?.analysis,
          timestamp: Date.now(),
          requestId
        }, targetThreadId);
      } else {
        throw new Error('No response received from chat service');
      }
    } catch (err: any) {
      console.warn(`[useStreamingChat] Backoff flow failed for thread ${targetThreadId}:`, err);
      
      // Silent handling for aborted operations
      if (err?.message?.toLowerCase().includes('aborted')) {
        console.log(`[useStreamingChat] Operation aborted silently for thread ${targetThreadId}`);
        updateThreadState(targetThreadId, { isStreaming: false, activeRequestId: null });
        return;
      }
      
      addStreamingMessage({
        type: 'error',
        error: err?.message || 'Unknown error occurred',
        timestamp: Date.now()
      }, targetThreadId);
    }
  }, [getThreadState, updateThreadState, addStreamingMessage, generateStreamingMessages, invokeWithBackoff, isEdgeFunctionError, isNetworkError, retryLastMessage, createMessageFingerprint]);

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
      abortController: null,
      activeRequestId: null
    });
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
      queryCategory: '',
      activeRequestId: null,
      lastMessageFingerprint: null,
    });
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

  // Resume streaming state for active requests
  const resumeStreamingState = useCallback((targetThreadId: string) => {
    if (!targetThreadId) return false;
    
    const threadState = getThreadState(targetThreadId);
    if (!threadState.isStreaming) return false;
    
    // Calculate time-based message position
    const elapsedMs = Date.now() - (threadState.processingStartTime || Date.now());
    let targetIndex = 0;
    
    if (threadState.queryCategory === 'JOURNAL_SPECIFIC') {
      targetIndex = Math.min(Math.floor(elapsedMs / 7000), threadState.dynamicMessages.length - 1);
    } else if (threadState.dynamicMessages.length > 0) {
      targetIndex = Math.floor(elapsedMs / 2000) % threadState.dynamicMessages.length;
    }
    
    updateThreadState(targetThreadId, { currentMessageIndex: targetIndex });
    return true;
  }, [getThreadState, updateThreadState]);

  return {
    // Thread-isolated state
    isStreaming: state.isStreaming,
    streamingMessages: state.streamingMessages,
    currentUserMessage: state.currentUserMessage,
    showBackendAnimation: state.showBackendAnimation,
    dynamicMessages: state.dynamicMessages,
    translatedDynamicMessages: state.translatedDynamicMessages,
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
    retryLastMessage: () => retryLastMessage(threadId),
    
    // Utility methods
    addStreamingMessage: (message: StreamingMessage) => addStreamingMessage(message, threadId),
    resumeStreamingState
  };
};
