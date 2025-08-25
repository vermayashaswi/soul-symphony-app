import { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '@/utils/supabaseClient';
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
  requestId?: string; // correlate to activeRequestId to avoid bleed
}


interface UseStreamingChatProps {
  onFinalResponse?: (response: string, analysis: any | undefined, originThreadId: string | null, requestId?: string | null) => void;
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
  activeRequestId: string | null; // Track active request to prevent duplicates
  lastMessageFingerprint: string | null; // Prevent duplicate messages
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
  
  // Page visibility and app lifecycle tracking
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isAppActive, setIsAppActive] = useState(true);

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

  // Create message fingerprint to prevent duplicates
  const createMessageFingerprint = useCallback((message: string, threadId: string, timestamp: number) => {
    return `${message}_${threadId}_${Math.floor(timestamp / 5000)}`; // 5-second window
  }, []);

  // Enhanced completion check with better detection logic
  const checkIfRequestCompleted = useCallback(async (threadId: string, savedState: any): Promise<boolean> => {
    try {
      // More flexible completion detection
      const processingStartTime = savedState.processingStartTime || savedState.savedAt;
      
      if (!processingStartTime) {
        // If no processing time, check for very recent assistant messages
        const { data: recentMessages, error } = await db.chatMessages.selectByThreadAndSender(
          threadId, 
          'assistant', 
          { columns: 'id, created_at, content', limit: 1 }
        );

        if (!error && recentMessages && recentMessages.length > 0) {
          console.log(`[useStreamingChat] Found recent assistant message for thread ${threadId}`);
          return true;
        }
        return false;
      }

      // Expand time window for better detection
      const searchStartTime = new Date(processingStartTime - 30000); // 30 seconds before processing started
      
      // Query for assistant messages created around the processing time
      const { data: messages, error } = await db.chatMessages.selectByThreadAndSender(
        threadId, 
        'assistant', 
        { columns: 'id, created_at, content', limit: 3 }
      );

      if (error) {
        console.warn('[useStreamingChat] Error checking message completion:', error);
        return false;
      }

      // Enhanced detection logic
      const hasCompletedResponse = messages && messages.length > 0;
      
      if (hasCompletedResponse) {
        // Check if we have a non-processing message
        const latestMessage = messages[0] as any;
        const isProcessingMessage = (latestMessage as any)?.content?.includes('...') || 
                                   (latestMessage as any)?.content?.length < 10;
        
        if (!isProcessingMessage) {
          console.log(`[useStreamingChat] Found completed response for thread ${threadId}, message created at:`, (latestMessage as any)?.created_at);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn('[useStreamingChat] Exception checking request completion:', error);
      return false;
    }
  }, []);

  // Enhanced Page Visibility API for mobile browser handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      
      if (!visible && threadId) {
        // Page backgrounded - pause streaming without aborting
        console.log(`[useStreamingChat] Page backgrounded for thread: ${threadId}`);
        const threadState = getThreadState(threadId);
        if (threadState.isStreaming || threadState.showBackendAnimation) {
          // Enhanced state saving with more complete information
          saveChatStreamingState(threadId, {
            ...threadState,
            pausedDueToBackground: true,
            savedAt: Date.now(),
            navigationSafe: true, // Mark as safe for navigation restoration
          });
          console.log(`[useStreamingChat] Saved enhanced state for navigation: ${threadId}`);
        }
        } else if (visible && threadId) {
        // Page foregrounded - restore UI state if we had an active stream
        console.log(`[useStreamingChat] Page foregrounded for thread: ${threadId}`);
        
        const restoreVisibilityState = async () => {
          try {
            const savedState: any = getChatStreamingState(threadId);
            if (savedState && (savedState.isStreaming || savedState.pausedDueToBackground || savedState.navigationSafe)) {
              
              // Check if request completed while away
              const isAlreadyCompleted = await checkIfRequestCompleted(threadId, savedState);
              
              if (isAlreadyCompleted) {
                console.log(`[useStreamingChat] Request completed while page hidden, clearing state: ${threadId}`);
                clearChatStreamingState(threadId);
                return;
              }
              
              console.log(`[useStreamingChat] Restoring navigation-safe state for thread: ${threadId}`);
              updateThreadState(threadId, {
                isStreaming: true,
                streamingMessages: savedState.streamingMessages || [],
                currentUserMessage: savedState.currentUserMessage || '',
                showBackendAnimation: !!savedState.showBackendAnimation,
                dynamicMessages: savedState.dynamicMessages || [],
                translatedDynamicMessages: savedState.translatedDynamicMessages || [],
                currentMessageIndex: savedState.currentMessageIndex || 0,
                useThreeDotFallback: !!savedState.useThreeDotFallback,
                queryCategory: savedState.queryCategory || '',
                expectedProcessingTime: savedState.expectedProcessingTime || null,
                processingStartTime: savedState.processingStartTime || Date.now(),
                abortController: new AbortController(),
                activeRequestId: savedState.activeRequestId || null,
              });
            }
          } catch (error) {
            console.warn(`[useStreamingChat] Error restoring state: ${error}`);
          }
        };
        
        restoreVisibilityState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [threadId, getThreadState, updateThreadState]);

  // Capacitor app lifecycle handling
  useEffect(() => {
    // Check if Capacitor App plugin is available using the correct path
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.App) {
      try {
        const { App } = (window as any).Capacitor.Plugins;
        
        const handleAppStateChange = (state: any) => {
          setIsAppActive(state.isActive);
          
          if (!state.isActive && threadId) {
            // App backgrounded
            console.log(`[useStreamingChat] Capacitor app backgrounded for thread: ${threadId}`);
            const threadState = getThreadState(threadId);
            if (threadState.isStreaming || threadState.showBackendAnimation) {
              // Enhanced state saving for Capacitor
              saveChatStreamingState(threadId, {
                ...threadState,
                pausedDueToBackground: true,
                savedAt: Date.now(),
                navigationSafe: true,
              });
              console.log(`[useStreamingChat] Saved enhanced Capacitor state: ${threadId}`);
            }
           } else if (state.isActive && threadId) {
               // App foregrounded
               console.log(`[useStreamingChat] Capacitor app foregrounded for thread: ${threadId}`);
               
               const restoreCapacitorState = async () => {
                 try {
                   const savedState: any = getChatStreamingState(threadId);
                   if (savedState && (savedState.isStreaming || savedState.pausedDueToBackground || savedState.navigationSafe)) {
                     
                     // Check if request completed while app was backgrounded
                     const isAlreadyCompleted = await checkIfRequestCompleted(threadId, savedState);
                     
                     if (isAlreadyCompleted) {
                       console.log(`[useStreamingChat] Request completed while app backgrounded, clearing state: ${threadId}`);
                       clearChatStreamingState(threadId);
                       return;
                     }
                     
                     console.log(`[useStreamingChat] Restoring Capacitor navigation-safe state: ${threadId}`);
                     updateThreadState(threadId, {
                       isStreaming: true,
                       streamingMessages: savedState.streamingMessages || [],
                       currentUserMessage: savedState.currentUserMessage || '',
                       showBackendAnimation: !!savedState.showBackendAnimation,
                       dynamicMessages: savedState.dynamicMessages || [],
                       translatedDynamicMessages: savedState.translatedDynamicMessages || [],
                       currentMessageIndex: savedState.currentMessageIndex || 0,
                       useThreeDotFallback: !!savedState.useThreeDotFallback,
                       queryCategory: savedState.queryCategory || '',
                       expectedProcessingTime: savedState.expectedProcessingTime || null,
                       processingStartTime: savedState.processingStartTime || Date.now(),
                       abortController: new AbortController(),
                       activeRequestId: savedState.activeRequestId || null,
                     });
                   }
                 } catch (error) {
                   console.warn(`[useStreamingChat] Error restoring Capacitor state: ${error}`);
                 }
               };
               
               restoreCapacitorState();
            }
        };

        App.addListener('appStateChange', handleAppStateChange);
        
        return () => {
          try {
            App.removeAllListeners();
          } catch (error) {
            console.warn('[useStreamingChat] Error removing Capacitor listeners:', error);
          }
        };
      } catch (error) {
        console.warn('[useStreamingChat] Error setting up Capacitor app lifecycle handlers:', error);
      }
    }
  }, [threadId, getThreadState]);

  // Enhanced thread switch handler with comprehensive state restoration
  useEffect(() => {
    if (!threadId) {
      setState(createInitialState());
      return;
    }

    console.log(`[useStreamingChat] Switching to thread: ${threadId}`);

    // Comprehensive state restoration with improved completion detection
    const restoreStateIfStillValid = async () => {
      try {
        const savedState: any = getChatStreamingState(threadId);
        if (savedState && (savedState.isStreaming || savedState.pausedDueToBackground || savedState.navigationSafe)) {
          
          console.log(`[useStreamingChat] Found saved state for thread: ${threadId}`, {
            isStreaming: savedState.isStreaming,
            hasMessages: savedState.dynamicMessages?.length || 0,
            processingStartTime: savedState.processingStartTime
          });
          
          // Smart restoration: Check if backend has already completed
          const isAlreadyCompleted = await checkIfRequestCompleted(threadId, savedState);
          
          if (isAlreadyCompleted) {
            console.log(`[useStreamingChat] Request already completed, clearing saved state and showing response: ${threadId}`);
            clearChatStreamingState(threadId);
            // Dispatch event so UI can reload messages to show the completed response
            window.dispatchEvent(new CustomEvent('chatResponseReady', { 
              detail: { threadId } 
            }));
            const threadState = getThreadState(threadId);
            setState(threadState);
            return;
          }

          console.log(`[useStreamingChat] Restoring active streaming state for thread: ${threadId}`);
          const restoredState = {
            isStreaming: !!savedState.isStreaming,
            streamingMessages: savedState.streamingMessages || [],
            currentUserMessage: savedState.currentUserMessage || '',
            showBackendAnimation: !!savedState.showBackendAnimation,
            dynamicMessages: savedState.dynamicMessages || [],
            translatedDynamicMessages: savedState.translatedDynamicMessages || [],
            currentMessageIndex: savedState.currentMessageIndex || 0,
            useThreeDotFallback: !!savedState.useThreeDotFallback,
            queryCategory: savedState.queryCategory || '',
            expectedProcessingTime: savedState.expectedProcessingTime || null,
            processingStartTime: savedState.processingStartTime || Date.now(),
            abortController: savedState.isStreaming ? new AbortController() : null,
            activeRequestId: savedState.activeRequestId || null,
            isRetrying: false,
            retryAttempts: savedState.retryAttempts || 0,
          };
          
          updateThreadState(threadId, restoredState);
          
          // Visual feedback that processing state was restored
          console.log(`[useStreamingChat] ✅ Successfully restored processing state for thread: ${threadId}`);
        } else {
          // No saved state, use fresh state
          const threadState = getThreadState(threadId);
          setState(threadState);
        }
      } catch (error) {
        console.warn(`[useStreamingChat] Error restoring thread state: ${error}`);
        // Fallback to fresh state
        const threadState = getThreadState(threadId);
        setState(threadState);
      }
    };

    restoreStateIfStillValid();
    
    // Clear any event listeners from previous threads
    return () => {
      // Cleanup will be handled by the abort controller
    };
  }, [threadId, getThreadState, updateThreadState, checkIfRequestCompleted]);

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
          const category = (body as any)?.category || threadState.queryCategory;
          let result: { data: any; error: any };

          if (category === 'JOURNAL_SPECIFIC') {
            // Disable client-side timeout for long-running analysis
            result = (await supabase.functions.invoke('chat-with-rag', { body })) as { data: any; error: any };
          } else if (category === 'GENERAL_MENTAL_HEALTH') {
            const timeoutMs = 20000 + i * 5000;
            const timeoutPromise = new Promise((_, rej) =>
              setTimeout(() => rej(new Error('Request timed out')), timeoutMs)
            );

            result = (await Promise.race([
              supabase.functions.invoke('general-mental-health-chat', { body }),
              timeoutPromise,
            ])) as { data: any; error: any };
          } else {
            // Fallback for unknown categories
            const timeoutMs = 20000 + i * 5000;
            const timeoutPromise = new Promise((_, rej) =>
              setTimeout(() => rej(new Error('Request timed out')), timeoutMs)
            );

            result = (await Promise.race([
              supabase.functions.invoke('general-mental-health-chat', { body }),
              timeoutPromise,
            ])) as { data: any; error: any };
          }
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

    // Correlate final/error messages to active request to avoid bleed from older requests
    if ((message.type === 'final_response' || message.type === 'error') && message.requestId && threadState.activeRequestId && message.requestId !== threadState.activeRequestId) {
      console.warn('[useStreamingChat] Ignoring message due to requestId mismatch', { incoming: message.requestId, active: threadState.activeRequestId });
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
        
        // Clear persisted state and abort controller
        clearChatStreamingState(activeThreadId);
        if (threadState.abortController) {
          threadState.abortController = null;
        }
        
        onFinalResponse?.(message.response || '', message.analysis, activeThreadId, message.requestId || null);
        break;
      case 'error':
        updates.isStreaming = false;
        updates.showBackendAnimation = false;
        updates.activeRequestId = null;
        
        // Clear persisted state and abort controller
        clearChatStreamingState(activeThreadId);
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

  // Generate streaming messages based on category
  const generateStreamingMessages = useCallback(async (
    message: string, 
    category: string, 
    conversationContext?: any[], 
    userProfile?: any,
    targetThreadId?: string
  ) => {
    const activeThreadId = targetThreadId || threadId;
    if (!activeThreadId) return;

    // Only generate dynamic messages for journal-specific queries
    if (category !== 'JOURNAL_SPECIFIC') {
      updateThreadState(activeThreadId, {
        useThreeDotFallback: true,
        dynamicMessages: [],
        currentMessageIndex: 0
      });
      return;
    }

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
        updateThreadState(activeThreadId, {
          useThreeDotFallback: true,
          dynamicMessages: [],
          translatedDynamicMessages: []
        });
      } else {
        // Pre-translate all messages to avoid repeated loading indicators
        const translatedMessages = await Promise.all(
          data.messages.map(async (message: string) => {
            if (currentLanguage === 'en') {
              return message;
            }
            try {
              const translated = await translate(message, 'en', undefined, true);
              return translated || message;
            } catch (error) {
              console.error('[useStreamingChat] Error translating message:', error);
              return message;
            }
          })
        );

        updateThreadState(activeThreadId, {
          useThreeDotFallback: false,
          dynamicMessages: data.messages,
          translatedDynamicMessages: translatedMessages,
          currentMessageIndex: 0
        });
      }
    } catch (error) {
      console.error('[useStreamingChat] Error generating streaming messages:', error);
      updateThreadState(activeThreadId!, {
        useThreeDotFallback: true,
        dynamicMessages: [],
        translatedDynamicMessages: []
      });
    }
  }, [threadId, updateThreadState, translate, currentLanguage]);

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
      // Rotate through messages every 7 seconds; keep the last one indefinitely until response
      const isLast = state.currentMessageIndex >= state.dynamicMessages.length - 1;
      if (!isLast) {
        timeoutId = setTimeout(() => {
          // Double-check we're still on the same thread
          if (threadId && getThreadState(threadId).isStreaming) {
            updateThreadState(threadId, {
              currentMessageIndex: state.currentMessageIndex + 1
            });
          }
        }, 7000);
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
    
    // For long-running journal-specific analysis, keep showing dynamic messages without forcing an error toast
    if (state.queryCategory === 'JOURNAL_SPECIFIC') {
      return; // disable safety error for this category
    }
    
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
    const threadState = getThreadState(targetThreadId);
    
    // Check for duplicate requests using message fingerprinting
    const currentTime = Date.now();
    const messageFingerprint = createMessageFingerprint(message, targetThreadId, currentTime);
    
    if (threadState.isStreaming || threadState.activeRequestId) {
      console.warn(`[useStreamingChat] Already streaming for thread ${targetThreadId}, ignoring new request`);
      return;
    }

    if (threadState.lastMessageFingerprint === messageFingerprint) {
      console.warn(`[useStreamingChat] Duplicate message detected for thread ${targetThreadId}, ignoring`);
      return;
    }

    // Check if app/page is backgrounded - if so, don't start new requests
    if (!isPageVisible || !isAppActive) {
      console.warn(`[useStreamingChat] App backgrounded, deferring request for thread ${targetThreadId}`);
      return;
    }

    console.log(`[useStreamingChat] Starting chat for thread: ${targetThreadId}`);

    // Create unique request ID
    const requestId = `${targetThreadId}_${currentTime}_${Math.random().toString(36).substr(2, 9)}`;
    
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

    // Fetch user timezone from profiles table
    let userTimezone = 'UTC';
    try {
      const { data: profile, error: profileError } = await db.profiles.select(userId);
      
      if (!profileError && (profile as any)?.timezone) {
        userTimezone = (profile as any).timezone;
        console.log(`[useStreamingChat] Using user timezone: ${userTimezone}`);
      } else {
        console.log(`[useStreamingChat] No timezone found in profile, using UTC`);
      }
    } catch (error) {
      console.error('[useStreamingChat] Error fetching user timezone:', error);
    }

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

    updateThreadState(targetThreadId, { queryCategory: messageCategory });

    await generateStreamingMessages(message, messageCategory, conversationContext, userProfile, targetThreadId);
    
    const estimatedTime = messageCategory === 'JOURNAL_SPECIFIC' ? 65000 : 10000;
    updateThreadState(targetThreadId, { expectedProcessingTime: estimatedTime });
    
    // Save streaming state for persistence
    saveChatStreamingState(targetThreadId, {
      isStreaming: true,
      streamingMessages: [],
      currentUserMessage: message,
      showBackendAnimation: false,
      dynamicMessages: [],
      currentMessageIndex: 0,
      useThreeDotFallback: messageCategory !== 'JOURNAL_SPECIFIC',
      queryCategory: messageCategory,
      expectedProcessingTime: estimatedTime,
      processingStartTime: Date.now(),
      activeRequestId: requestId,
    });

    try {
      const { data, error } = await invokeWithBackoff({
        message,
        userId,
        threadId: targetThreadId,
        conversationContext,
        userProfile: { ...userProfile, timezone: userTimezone },
        streamingMode: false,
        requestId, // Include request ID for deduplication
        category: messageCategory,
        userTimezone, // Pass timezone directly to edge functions
      }, { attempts: 3, baseDelay: 900 }, targetThreadId);
      // Check if request is still active (not superseded by another request)
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
  }, [threadId, getThreadState, updateThreadState, addStreamingMessage, generateStreamingMessages, invokeWithBackoff, isEdgeFunctionError, isNetworkError, retryLastMessage, createMessageFingerprint, isPageVisible, isAppActive]);

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
      queryCategory: '',
      activeRequestId: null,
      lastMessageFingerprint: null,
    });
  }, [threadId, updateThreadState]);

  const restoreStreamingState = useCallback(async (targetThreadId: string) => {
    try {
      const savedState: any = getChatStreamingState(targetThreadId);
      if (savedState && (savedState.isStreaming || savedState.pausedDueToBackground || savedState.navigationSafe)) {
        
        // Enhanced completion check with wider time window
        const isCompleted = await checkIfRequestCompleted(targetThreadId, savedState);
        
        if (isCompleted) {
          console.log(`[useStreamingChat] Request already completed, not restoring streaming state: ${targetThreadId}`);
          clearChatStreamingState(targetThreadId);
          // Notify UI that the response is ready
          window.dispatchEvent(new CustomEvent('chatResponseReady', { 
            detail: { threadId: targetThreadId } 
          }));
          return false;
        }
        
        console.log(`[useStreamingChat] Restoring streaming state for thread: ${targetThreadId}`);
        const updates = {
          isStreaming: true,
          streamingMessages: savedState.streamingMessages || [],
          currentUserMessage: savedState.currentUserMessage || '',
          showBackendAnimation: !!savedState.showBackendAnimation,
          dynamicMessages: savedState.dynamicMessages || [],
          translatedDynamicMessages: savedState.translatedDynamicMessages || [],
          currentMessageIndex: savedState.currentMessageIndex || 0,
          useThreeDotFallback: !!savedState.useThreeDotFallback,
          queryCategory: savedState.queryCategory || '',
          expectedProcessingTime: savedState.expectedProcessingTime || null,
          processingStartTime: savedState.processingStartTime || Date.now(),
          abortController: new AbortController(),
          activeRequestId: savedState.activeRequestId || null,
          // Enhanced restoration flags
          isRetrying: false,
          retryAttempts: savedState.retryAttempts || 0,
        } as Partial<ThreadStreamingState>;
        updateThreadState(targetThreadId, updates);
        
        // If this is the current thread, also update local state
        if (targetThreadId === threadId) {
          setState(prev => ({ ...prev, ...updates }));
        }
        
        return true;
      }
    } catch (error) {
      console.error('[useStreamingChat] Error restoring streaming state:', error);
    }
    return false;
  }, [threadId, updateThreadState, checkIfRequestCompleted]);

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

  // Periodic cleanup of orphaned streaming states
  useEffect(() => {
    const cleanupOrphanedStates = async () => {
      try {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('chat_streaming_state_'));
        const now = Date.now();
        
        for (const key of keys) {
          try {
            const stored = localStorage.getItem(key);
            if (!stored) continue;
            
            const parsed = JSON.parse(stored);
            const threadId = key.replace('chat_streaming_state_', '');
            
            // Check if state is old (more than 10 minutes) and still marked as streaming
            const stateAge = now - (parsed.savedAt || 0);
            const isOld = stateAge > 10 * 60 * 1000; // 10 minutes
            
            if (isOld && (parsed.isStreaming || parsed.pausedDueToBackground)) {
              // Check if request was completed
              const isCompleted = await checkIfRequestCompleted(threadId, parsed);
              
              if (isCompleted) {
                console.log(`[useStreamingChat] Cleaning up orphaned completed state: ${threadId}`);
                localStorage.removeItem(key);
              } else {
                // State is old but no completion found - likely orphaned
                console.log(`[useStreamingChat] Cleaning up potentially orphaned state: ${threadId}, age: ${Math.round(stateAge / 1000)}s`);
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.warn('[useStreamingChat] Error during orphaned state cleanup:', error);
      }
    };

    // Run cleanup every 2 minutes
    const cleanupInterval = setInterval(cleanupOrphanedStates, 2 * 60 * 1000);
    
    // Run initial cleanup after 30 seconds
    const initialCleanup = setTimeout(cleanupOrphanedStates, 30000);
    
    return () => {
      clearInterval(cleanupInterval);
      clearTimeout(initialCleanup);
    };
  }, [checkIfRequestCompleted]);

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
    isPageVisible,
    isAppActive,
    
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
