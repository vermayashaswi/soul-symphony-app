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
}

export const useStreamingChat = ({ onFinalResponse, onError }: UseStreamingChatProps = {}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState<string>('');
  const [showBackendAnimation, setShowBackendAnimation] = useState(false);
  const [dynamicMessages, setDynamicMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [useThreeDotFallback, setUseThreeDotFallback] = useState(false);
  const [queryCategory, setQueryCategory] = useState<string>('');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  // The thread id for which a streaming request is currently active
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [expectedProcessingTime, setExpectedProcessingTime] = useState<number | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  
  // Retry state management
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [lastFailedMessage, setLastFailedMessage] = useState<{
    message: string;
    userId: string;
    threadId: string;
    conversationContext: any[];
    userProfile: any;
  } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
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

  // Backoff wrapper for supabase.functions.invoke
  const invokeWithBackoff = useCallback(
    async (
      body: Record<string, any>,
      options?: { attempts?: number; baseDelay?: number }
    ): Promise<{ data: any; error: any }> => {
      const attempts = options?.attempts ?? 3;
      const baseDelay = options?.baseDelay ?? 900;

      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          const timeoutMs = 20000 + i * 5000; // grow timeout slightly per attempt
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
        // exponential backoff with jitter
        const delay = Math.min(6000, baseDelay * Math.pow(2, i)) + Math.floor(Math.random() * 250);
        await sleep(delay);
      }
      return { data: null, error: lastErr || new Error('Unknown error') };
    },
    [isEdgeFunctionError, isNetworkError]
  );

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
        // Reset retry state on success
        setRetryAttempts(0);
        setLastFailedMessage(null);
        setIsRetrying(false);
        // Clear persisted state on completion
        if (streamingThreadId) {
          clearChatStreamingState(streamingThreadId);
        }
        onFinalResponse?.(message.response || '', message.analysis, streamingThreadId);
        setStreamingThreadId(null);
        break;
      case 'error':
        setIsStreaming(false);
        setShowBackendAnimation(false);
        if (streamingThreadId) {
          clearChatStreamingState(streamingThreadId);
        }
        setStreamingThreadId(null);
        onError?.(message.error || 'Unknown error occurred');
        break;
    }
  }, [onFinalResponse, onError]);

  // Reset retry state when starting new conversation
  const resetRetryState = useCallback(() => {
    setRetryAttempts(0);
    setLastFailedMessage(null);
    setIsRetrying(false);
  }, []);

  // Generate streaming messages based on category
  const generateStreamingMessages = useCallback(async (message: string, category: string, conversationContext?: any[], userProfile?: any) => {
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

      if (data.shouldUseFallback || !data.messages || data.messages.length === 0) {
        setUseThreeDotFallback(true);
        setDynamicMessages([]);
      } else {
        setUseThreeDotFallback(false);
        setDynamicMessages(data.messages);
        setCurrentMessageIndex(0);
      }
    } catch (error) {
      console.error('[useStreamingChat] Error generating streaming messages:', error);
      setUseThreeDotFallback(true);
      setDynamicMessages([]);
    }
  }, []);

  // Automatic retry function for failed messages
  const retryLastMessage = useCallback(async () => {
    if (!lastFailedMessage || retryAttempts >= maxRetryAttempts || isRetrying) {
      return;
    }

    console.log(`[useStreamingChat] Retrying message (attempt ${retryAttempts + 1}/${maxRetryAttempts})`);
    setIsRetrying(true);
    setRetryAttempts(prev => prev + 1);

    // Show toast notification
    showEdgeFunctionRetryToast();

    // Small delay to let user see the retry message
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Continue showing streaming UI while retrying
      await generateStreamingMessages(
        lastFailedMessage.message, 
        'GENERAL_MENTAL_HEALTH', 
        lastFailedMessage.conversationContext, 
        lastFailedMessage.userProfile
      );

      // Try the request again
      const { data, error } = await invokeWithBackoff({
        message: lastFailedMessage.message,
        userId: lastFailedMessage.userId,
        threadId: lastFailedMessage.threadId,
        conversationContext: lastFailedMessage.conversationContext,
        userProfile: lastFailedMessage.userProfile,
        streamingMode: false
      });

      if (error) {
        if (isEdgeFunctionError(error) && retryAttempts < maxRetryAttempts - 1) {
          // Will retry again
          throw error;
        } else {
          // Max retries reached, show final error
          addStreamingMessage({
            type: 'error',
            error: 'Unable to process your request after multiple attempts. Please try again later.',
            timestamp: Date.now()
          });
          resetRetryState();
          return;
        }
      }

      // Success! Handle the response
      const text = data?.response ?? data?.data ?? data?.message ?? (typeof data === 'string' ? data : null);
      if (text) {
        addStreamingMessage({
          type: 'final_response',
          response: text,
          analysis: data?.analysis,
          timestamp: Date.now()
        });
        resetRetryState();
      } else {
        throw new Error('No response received from chat service');
      }

    } catch (error) {
      console.error('[useStreamingChat] Retry failed:', error);
      // If this was the last retry attempt, show error
      if (retryAttempts >= maxRetryAttempts - 1) {
        addStreamingMessage({
          type: 'error',
          error: 'Unable to process your request after multiple attempts. Please try again later.',
          timestamp: Date.now()
        });
        resetRetryState();
      }
    } finally {
      setIsRetrying(false);
    }
  }, [lastFailedMessage, retryAttempts, isRetrying, isEdgeFunctionError, addStreamingMessage, resetRetryState, generateStreamingMessages]);

  // Enhanced timing logic with proper calculation for streaming messages
  useEffect(() => {
    if (!isStreaming || useThreeDotFallback || dynamicMessages.length === 0) return;

    let timeoutId: NodeJS.Timeout;
    
    if (queryCategory === 'JOURNAL_SPECIFIC') {
      // Calculate timing based on expected processing time
      const remainingTime = expectedProcessingTime ? 
        Math.max(0, expectedProcessingTime - (Date.now() - (processingStartTime || Date.now()))) : 
        15000; // Default 15 seconds
      
      const messagesLeft = dynamicMessages.length - currentMessageIndex;
      const timePerMessage = messagesLeft > 1 ? Math.min(5000, remainingTime / messagesLeft) : remainingTime;
      
      // Sequential display with calculated timing
      if (currentMessageIndex < dynamicMessages.length - 1) {
        timeoutId = setTimeout(() => {
          setCurrentMessageIndex(prev => prev + 1);
        }, timePerMessage);
        
        console.log(`[StreamingChat] Next message in ${timePerMessage}ms (${messagesLeft} left, ${remainingTime}ms remaining)`);
      }
      // If we're at the last message, stay there until processing completes
    } else {
      // Regular cycling every 2 seconds for other categories
      const interval = setInterval(() => {
        setCurrentMessageIndex(prev => (prev + 1) % dynamicMessages.length);
      }, 2000);
      
      return () => clearInterval(interval);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isStreaming, useThreeDotFallback, dynamicMessages.length, currentMessageIndex, queryCategory, expectedProcessingTime, processingStartTime]);

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

    // Reset retry state for new conversation
    resetRetryState();

    // Set current thread and timing info
    setCurrentThreadId(threadId);
    setStreamingThreadId(threadId);
    setProcessingStartTime(Date.now());
    
    setIsStreaming(true);
    setStreamingMessages([]);
    setCurrentUserMessage('');
    setShowBackendAnimation(false);
    setUseThreeDotFallback(false);
    setDynamicMessages([]);
    setCurrentMessageIndex(0);

    // Add user message immediately
    addStreamingMessage({
      type: 'user_message',
      message,
      timestamp: Date.now()
    });

    // Classify message to determine streaming behavior
    let messageCategory = 'GENERAL_MENTAL_HEALTH'; // Default fallback
    try {
      const { data: classificationData, error: classificationError } = await supabase.functions.invoke('chat-query-classifier', {
        body: {
          message,
          conversationContext: conversationContext || []
        }
      });
      
    if (!classificationError && classificationData?.category) {
        messageCategory = classificationData.category;
        setQueryCategory(messageCategory);
        console.log(`[useStreamingChat] Message classified as: ${messageCategory}`);
      }
    } catch (error) {
      console.error('[useStreamingChat] Classification failed, using fallback:', error);
    }

    // Generate appropriate streaming messages based on category
    await generateStreamingMessages(message, messageCategory, conversationContext, userProfile);
    
    // Set expected processing time based on category
    const estimatedTime = messageCategory === 'JOURNAL_SPECIFIC' ? 20000 : 10000;
    setExpectedProcessingTime(estimatedTime);
    
    // Save streaming state for persistence
    saveChatStreamingState(threadId, {
      isStreaming: true,
      streamingMessages,
      currentUserMessage: message,
      showBackendAnimation: false,
      dynamicMessages,
      currentMessageIndex: 0,
      useThreeDotFallback: false,
      queryCategory: messageCategory,
      expectedProcessingTime: estimatedTime,
      processingStartTime: Date.now()
    });

    // Directly use robust non-streaming flow with backoff; keep streaming UI
    try {
      const { data, error } = await invokeWithBackoff({
        message,
        userId,
        threadId,
        conversationContext,
        userProfile,
        streamingMode: false
      }, { attempts: 3, baseDelay: 900 });

      if (error) {
        // Store for auto-retry when coming back online
        if (isEdgeFunctionError(error) || isNetworkError(error)) {
          setLastFailedMessage({ message, userId, threadId, conversationContext, userProfile });
          // schedule a quick retry
          setTimeout(() => { retryLastMessage(); }, 800);
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
        });
      } else {
        throw new Error('No response received from chat service');
      }
    } catch (err: any) {
      console.warn('[useStreamingChat] Backoff flow failed:', err);
      addStreamingMessage({
        type: 'error',
        error: err?.message || 'Unknown error occurred',
        timestamp: Date.now()
      });
    }
  }, [isStreaming, addStreamingMessage, resetRetryState, generateStreamingMessages, invokeWithBackoff, isEdgeFunctionError, isNetworkError, retryLastMessage]);

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
      
      // First classify the query to show appropriate UI
      const { data: classification } = await supabase.functions.invoke('chat-query-classifier', {
        body: { message, conversationContext }
      });

      const queryCategory = classification?.category || 'GENERAL_MENTAL_HEALTH';
      
      // Show different UI based on classification - don't add backend_task for non-journal queries
      if (queryCategory === 'JOURNAL_SPECIFIC') {
        // For journal queries, simulate streaming with progressive messages and show backend animation
        addStreamingMessage({
          type: 'user_message',
          message: 'Understanding your question',
          timestamp: Date.now()
        });
        
        // Add backend processing task for journal queries only
        setTimeout(() => {
          addStreamingMessage({
            type: 'backend_task',
            task: 'analyzing_journal',
            description: 'Searching through your journal entries...',
            timestamp: Date.now()
          });
        }, 500);
        
        setTimeout(() => {
          addStreamingMessage({
            type: 'user_message',
            message: 'Analyzing your patterns and insights',
            timestamp: Date.now()
          });
        }, 1500);
      } else {
        // For other types (GENERAL_MENTAL_HEALTH, JOURNAL_SPECIFIC_NEEDS_CLARIFICATION, UNRELATED), 
        // only show simple three-dot animation - no backend_task messages
        addStreamingMessage({
          type: 'user_message',
          message: 'Processing your request...',
          timestamp: Date.now()
        });
      }

      const { data, error } = await invokeWithBackoff({
        message,
        userId,
        threadId,
        conversationContext,
        userProfile,
        streamingMode: false
      });

      if (error) {
        // Check if this is an edge function error that should trigger retry
        if (isEdgeFunctionError(error) && retryAttempts < maxRetryAttempts) {
          console.log('[useStreamingChat] Edge function error in non-streaming mode, storing message for retry');
          setLastFailedMessage({ message, userId, threadId, conversationContext, userProfile });
          
          // Trigger automatic retry
          setTimeout(() => {
            retryLastMessage();
          }, 500);
          return;
        }
        
        // Show custom error toast for "non-2xx code" errors
        if (error.message?.includes('non-2xx code')) {
          onError?.('Oops! I faced a hiccup. Try again!');
        }
        
        throw new Error(error.message);
      }

      // Handle non-streaming response
      const text = data?.response ?? data?.data ?? data?.message ?? (typeof data === 'string' ? data : null);
      if (text) {
        addStreamingMessage({
          type: 'final_response',
          response: text,
          analysis: data?.analysis,
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
  }, [addStreamingMessage, isEdgeFunctionError, retryAttempts, maxRetryAttempts, retryLastMessage]);

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
    setDynamicMessages([]);
    setCurrentMessageIndex(0);
    setUseThreeDotFallback(false);
    // Clear persisted state
    const target = streamingThreadId || currentThreadId;
    if (target) {
      clearChatStreamingState(target);
    }
  }, [currentThreadId, streamingThreadId]);

  // Function to restore streaming state for a thread
  const restoreStreamingState = useCallback((threadId: string) => {
    const savedState = getChatStreamingState(threadId);
    if (!savedState) return false;

    // If a prior session clearly exceeded its expected window, don't restore
    if (
      savedState.isStreaming &&
      savedState.processingStartTime &&
      savedState.expectedProcessingTime &&
      Date.now() - savedState.processingStartTime > savedState.expectedProcessingTime + 2 * 60 * 1000
    ) {
      clearChatStreamingState(threadId);
      return false;
    }

    console.log('[StreamingChat] Restoring streaming state for thread:', threadId);
    
    setCurrentThreadId(threadId);
    setIsStreaming(savedState.isStreaming);
    setStreamingThreadId(savedState.isStreaming ? threadId : null);
    setStreamingMessages(savedState.streamingMessages);
    setCurrentUserMessage(savedState.currentUserMessage);
    setShowBackendAnimation(savedState.showBackendAnimation);
    setDynamicMessages(savedState.dynamicMessages);
    setCurrentMessageIndex(savedState.currentMessageIndex);
    setUseThreeDotFallback(savedState.useThreeDotFallback);
    setQueryCategory(savedState.queryCategory);
    setExpectedProcessingTime(savedState.expectedProcessingTime || null);
    setProcessingStartTime(savedState.processingStartTime || null);

    // Asynchronously validate against database to avoid restoring stale state
    (async () => {
      try {
        const { data: msgs, error } = await supabase
          .from('chat_messages')
          .select('id,sender,is_processing,created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.warn('[StreamingChat] Validation query failed, keeping restored state temporarily:', error);
          return;
        }

        const lastMsg: any | undefined = msgs?.[0];
        const lastProcessing = lastMsg?.is_processing ?? false;

        // If there is no message, or last message is not processing anymore -> clear stale UI
        if (!lastMsg || !lastProcessing) {
          console.log('[StreamingChat] Cleared stale streaming state after DB validation');
          clearChatStreamingState(threadId);
          setIsStreaming(false);
          setShowBackendAnimation(false);
          setUseThreeDotFallback(false);
          setDynamicMessages([]);
          setCurrentMessageIndex(0);
        }
      } catch (e) {
        console.warn('[StreamingChat] DB validation threw, ignoring:', e);
      }
    })();
    
    return true;
  }, []);

  // Auto-retry when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (lastFailedMessage && !isRetrying) {
        retryLastMessage();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [lastFailedMessage, isRetrying, retryLastMessage]);
 
  return {
    isStreaming,
    streamingThreadId,
    streamingMessages,
    currentUserMessage,
    showBackendAnimation,
    startStreamingChat,
    startNonStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    restoreStreamingState,
    dynamicMessages,
    currentMessageIndex,
    useThreeDotFallback,
    queryCategory,
    isRetrying,
    retryAttempts,
    expectedProcessingTime,
    processingStartTime,
    retryLastMessage
  };
};