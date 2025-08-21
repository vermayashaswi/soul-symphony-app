import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showEdgeFunctionRetryToast } from '@/utils/toast-messages';
import { saveChatStreamingState, getChatStreamingState, clearChatStreamingState } from '@/utils/chatStateStorage';
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
}

interface UseStreamingChatProps {
  onFinalResponse?: (response: string, analysis: any | undefined, originThreadId: string | null, requestId?: string | null) => void;
  onError?: (error: string) => void;
  threadId?: string | null;
}

// Simplified streaming state
interface StreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  currentUserMessage: string;
  showBackendAnimation: boolean;
  useThreeDotFallback: boolean;
  queryCategory: string;
  isRetrying: boolean;
  retryAttempts: number;
  lastFailedMessage: any | null;
  abortController: AbortController | null;
}

const createInitialState = (): StreamingState => ({
  isStreaming: false,
  streamingMessages: [],
  currentUserMessage: '',
  showBackendAnimation: false,
  useThreeDotFallback: true, // Default to three dots
  queryCategory: '',
  isRetrying: false,
  retryAttempts: 0,
  lastFailedMessage: null,
  abortController: null,
});

export const useStreamingChat = ({ onFinalResponse, onError, threadId }: UseStreamingChatProps = {}) => {
  const { translate, currentLanguage } = useTranslation();
  const [state, setState] = useState<StreamingState>(createInitialState);
  const maxRetryAttempts = 2;

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

  // Simplified invoke with backoff
  const invokeWithBackoff = useCallback(
    async (
      body: Record<string, any>,
      options?: { attempts?: number; baseDelay?: number }
    ): Promise<{ data: any; error: any }> => {
      const attempts = options?.attempts ?? 3;
      const baseDelay = options?.baseDelay ?? 900;

      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        // Check abort signal
        if (state.abortController?.signal.aborted) {
          throw new Error('Operation aborted');
        }

        try {
          // Route ALL queries through chat-with-rag for unified message persistence
          const result = (await supabase.functions.invoke('chat-with-rag', { body })) as { data: any; error: any };
          if (result?.error) {
            lastErr = result.error;
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
    [isEdgeFunctionError, isNetworkError, state.abortController]
  );

  const addStreamingMessage = useCallback((message: StreamingMessage) => {
    if (!threadId) return;

    console.log(`[useStreamingChat] Adding message to thread ${threadId}:`, message.type);
    
    setState(prev => {
      const newMessages = [...prev.streamingMessages, message];
      
      const updates: Partial<StreamingState> = {
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
          clearChatStreamingState(threadId);
          updates.abortController = null;
          
          onFinalResponse?.(message.response || '', message.analysis, threadId, null);
          break;
        case 'error':
          updates.isStreaming = false;
          updates.showBackendAnimation = false;
          
          // Clear persisted state and abort controller
          clearChatStreamingState(threadId);
          updates.abortController = null;
          
          onError?.(message.error || 'Unknown error occurred');
          break;
      }

      return { ...prev, ...updates };
    });
  }, [threadId, onFinalResponse, onError]);

  // Reset retry state when starting new conversation
  const resetRetryState = useCallback(() => {
    setState(prev => ({
      ...prev,
      retryAttempts: 0,
      lastFailedMessage: null,
      isRetrying: false
    }));
  }, []);

  // Force three-dot fallback for ALL categories (removed dynamic streaming messages)
  const generateStreamingMessages = useCallback(async (
    message: string, 
    category: string, 
    conversationContext?: any[], 
    userProfile?: any
  ) => {
    if (!threadId) return;

    // Force three-dot fallback for ALL categories - clean and simple
    setState(prev => ({
      ...prev,
      useThreeDotFallback: true
    }));
  }, [threadId]);

  // Automatic retry function for failed messages
  const retryLastMessage = useCallback(async () => {
    if (!threadId || !state.lastFailedMessage) return;

    if (state.retryAttempts >= maxRetryAttempts) {
      console.log(`[useStreamingChat] Max retry attempts reached for thread: ${threadId}`);
      addStreamingMessage({
        type: 'error',
        error: 'Maximum retry attempts reached. Please try again.',
        timestamp: Date.now()
      });
      return;
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryAttempts: prev.retryAttempts + 1
    }));

    try {
      const lastMessage = state.lastFailedMessage;
      console.log(`[useStreamingChat] Retrying failed message (attempt ${state.retryAttempts + 1}/${maxRetryAttempts}) for thread: ${threadId}`);

      const result = await invokeWithBackoff(lastMessage);

      if (result.error) {
        throw result.error;
      }

      // Success - handle response
      addStreamingMessage({
        type: 'final_response',
        response: result.data.response,
        analysis: result.data.metadata,
        timestamp: Date.now()
      });

      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastFailedMessage: null
      }));

    } catch (error) {
      console.error(`[useStreamingChat] Retry failed for thread ${threadId}:`, error);
      
      if (state.retryAttempts + 1 >= maxRetryAttempts) {
        addStreamingMessage({
          type: 'error',
          error: `Failed after ${maxRetryAttempts} attempts: ${error.message}`,
          timestamp: Date.now()
        });
      } else {
        // Continue retrying
        setState(prev => ({ ...prev, isRetrying: false }));
        setTimeout(() => retryLastMessage(), 2000);
      }
    }
  }, [threadId, state.lastFailedMessage, state.retryAttempts, addStreamingMessage, invokeWithBackoff]);

  // Main streaming chat function
  const startStreamingChat = useCallback(async (
    userMessage: string,
    userId: string,
    conversationContext: any[] = [],
    userProfile: any = {},
    onTypingAnimation?: (isTyping: boolean) => void,
    chatThreadId?: string,
    category?: string
  ) => {
    const activeThreadId = chatThreadId || threadId;
    if (!activeThreadId) {
      console.error('[useStreamingChat] No threadId provided');
      onError?.('No chat thread specified');
      return;
    }

    console.log(`[useStreamingChat] Starting chat for thread: ${activeThreadId}`);

    if (state.isStreaming) {
      console.warn(`[useStreamingChat] Already streaming for thread ${activeThreadId}, ignoring new request`);
      return;
    }

    // Create abort controller
    const abortController = new AbortController();
    
    // Reset state for new conversation
    const currentTime = Date.now();
    const message = userMessage.trim();

    setState(prev => ({
      ...prev,
      isStreaming: true,
      streamingMessages: [],
      currentUserMessage: '',
      showBackendAnimation: false,
      useThreeDotFallback: true, // Always use three dots initially
      retryAttempts: 0,
      lastFailedMessage: null,
      isRetrying: false,
      abortController,
    }));

    // Add user message immediately
    addStreamingMessage({
      type: 'user_message',
      message,
      timestamp: Date.now()
    });

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
        console.log(`[useStreamingChat] Message classified as: ${messageCategory} for thread: ${activeThreadId}`);
      }
    } catch (error) {
      console.error('[useStreamingChat] Classification failed, using fallback:', error);
    }

    setState(prev => ({ ...prev, queryCategory: messageCategory }));

    await generateStreamingMessages(message, messageCategory, conversationContext, userProfile);
    
    // Save streaming state for persistence
    saveChatStreamingState(activeThreadId, {
      isStreaming: true,
      streamingMessages: [],
      currentUserMessage: message,
      showBackendAnimation: false,
      useThreeDotFallback: true,
      queryCategory: messageCategory,
      dynamicMessages: [],
      currentMessageIndex: 0,
      expectedProcessingTime: null,
      processingStartTime: Date.now(),
    });

    try {
      const payload = {
        message: message,
        userId,
        threadId: activeThreadId,
        conversationContext,
        userProfile,
        category: messageCategory
      };

      setState(prev => ({ ...prev, lastFailedMessage: payload }));

      const result = await invokeWithBackoff(payload);

      if (result.error) {
        throw result.error;
      }

      // Success - handle response
      addStreamingMessage({
        type: 'final_response',
        response: result.data.response,
        analysis: result.data.metadata,
        timestamp: Date.now()
      });

    } catch (err: any) {
      console.error(`[useStreamingChat] Error for thread ${activeThreadId}:`, err);

      if (err?.message?.toLowerCase().includes('aborted')) {
        console.log(`[useStreamingChat] Operation aborted silently for thread ${activeThreadId}`);
        setState(prev => ({ ...prev, isStreaming: false }));
        return;
      }

      if (isEdgeFunctionError(err) || isNetworkError(err)) {
        showEdgeFunctionRetryToast();
        setState(prev => ({ ...prev, isStreaming: false }));
      } else {
        addStreamingMessage({
          type: 'error',
          error: err.message || 'An unexpected error occurred',
          timestamp: Date.now()
        });
      }
    }
  }, [threadId, state.isStreaming, addStreamingMessage, generateStreamingMessages, invokeWithBackoff, isEdgeFunctionError, isNetworkError, retryLastMessage, onError]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (!threadId) return;

    console.log(`[useStreamingChat] Stopping streaming for thread: ${threadId}`);
    
    if (state.abortController) {
      state.abortController.abort();
    }
    
    setState(prev => ({
      ...prev,
      isStreaming: false,
      showBackendAnimation: false,
      abortController: null
    }));
    
    clearChatStreamingState(threadId);
  }, [threadId, state.abortController]);

  // Clear streaming messages
  const clearStreamingMessages = useCallback(() => {
    if (!threadId) return;

    setState(createInitialState());
    clearChatStreamingState(threadId);
  }, [threadId]);

  // Restore streaming state
  const restoreStreamingState = useCallback((savedState: any) => {
    if (!threadId || !savedState) return false;

    setState(prev => ({
      ...prev,
      isStreaming: !!savedState.isStreaming,
      streamingMessages: savedState.streamingMessages || [],
      currentUserMessage: savedState.currentUserMessage || '',
      showBackendAnimation: !!savedState.showBackendAnimation,
      useThreeDotFallback: true, // Always use three dots
      queryCategory: savedState.queryCategory || '',
      abortController: new AbortController(),
    }));
    
    return true;
  }, [threadId]);

  // Dynamic message rotation effect (only when NOT using three-dot fallback)
  useEffect(() => {
    if (!state.isStreaming || state.useThreeDotFallback) {
      return;
    }

    // This is now simplified since we always use three-dot fallback
    return;
  }, [state.isStreaming, state.useThreeDotFallback]);

  // Safety timeout to prevent indefinite streaming
  useEffect(() => {
    if (!state.isStreaming || !threadId) return;

    const safetyTimeout = setTimeout(() => {
      console.warn(`[useStreamingChat] Safety timeout reached for thread: ${threadId}`);
      setState(prev => ({ ...prev, isStreaming: false }));
    }, 300000); // 5 minutes

    return () => clearTimeout(safetyTimeout);
  }, [state.isStreaming, threadId]);

    return {
    // State
    isStreaming: state.isStreaming,
    streamingMessages: state.streamingMessages,
    currentUserMessage: state.currentUserMessage,
    showBackendAnimation: state.showBackendAnimation,
    useThreeDotFallback: state.useThreeDotFallback,
    queryCategory: state.queryCategory,
    isRetrying: state.isRetrying,
    retryAttempts: state.retryAttempts,
    
    // Legacy properties for backward compatibility (simplified)
    dynamicMessages: [],
    translatedDynamicMessages: [],
    currentMessageIndex: 0,

    // Methods
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    retryLastMessage,
    resetRetryState,
    restoreStreamingState,
    
    // Legacy methods for backward compatibility (no-op)
    extendStreamingForRealtimeDelivery: async () => true,
    confirmRealtimeDelivery: () => {},
  };
};