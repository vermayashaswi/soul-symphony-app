import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { saveChatStreamingState, getChatStreamingState, clearChatStreamingState } from '@/utils/chatStateStorage';
import { useAuth } from '@/contexts/AuthContext';
import { showEdgeFunctionRetryToast } from '@/utils/toast-messages';
import { useTranslation } from '@/contexts/TranslationContext';

// Enhanced streaming message interface with original features
export interface StreamingMessage {
  id?: string;
  type: 'user_message' | 'backend_task' | 'progress' | 'final_response' | 'error';
  message?: string;
  task?: string;
  description?: string;
  stage?: string;
  progress?: number;
  response?: string;
  analysis?: any;
  error?: string;
  content?: string;
  isVisible?: boolean;
  timestamp: number;
  requestId?: string; // correlate to activeRequestId to avoid bleed
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
  // Additional state for comprehensive restoration
  pausedDueToBackground?: boolean;
  currentUserMessage?: string;
  showBackendAnimation?: boolean;
  navigationSafe?: boolean;
  dynamicMessages?: string[];
  currentMessageIndex?: number;
  lastMessageFingerprint?: string | null;
  useThreeDotFallback?: boolean;
  expectedProcessingTime?: number;
  processingStartTime?: number;
  activeRequestId?: string;
  translatedDynamicMessages?: string[];
  isRetrying?: boolean;
  retryAttempts?: number;
  lastFailedMessage?: any;
  isAppBackgrounded?: boolean;
  isPageHidden?: boolean;
  wasBackgroundProcessing?: boolean;
}

// Props interface for the hook
export interface UseStreamingChatProps {
  onFinalResponse?: (response: any) => void;
  onError?: (error: any) => void;
}

export const useStreamingChatV2 = (threadId: string, props: UseStreamingChatProps = {}) => {
  const { user } = useAuth();
  const { translate, currentLanguage } = useTranslation();
  const { onFinalResponse, onError } = props;
  
  // Enhanced configuration
  const maxRetryAttempts = 2;
  
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
      abortController: null,
      pausedDueToBackground: false,
      currentUserMessage: '',
      showBackendAnimation: false,
      navigationSafe: false,
      dynamicMessages: [],
      currentMessageIndex: 0,
      lastMessageFingerprint: null,
      useThreeDotFallback: false,
      expectedProcessingTime: null,
      processingStartTime: null,
      activeRequestId: null,
      translatedDynamicMessages: [],
      isRetrying: false,
      retryAttempts: 0,
      lastFailedMessage: null,
      isAppBackgrounded: false,
      isPageHidden: false,
      wasBackgroundProcessing: false
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
  const updateThreadState = useCallback((targetThreadId: string, newState: Partial<ThreadStreamingState>) => {
    const currentState = getThreadState(targetThreadId);
    const updatedState = { ...currentState, ...newState };
    threadStatesRef.current.set(targetThreadId, updatedState);
    
    // Update local state if this is the current thread
    if (targetThreadId === threadId) {
      setState(updatedState);
    }
    
    // Persist state if streaming OR backend processing
    if (updatedState.isStreaming || updatedState.showDynamicMessages || updatedState.queryCategory === 'JOURNAL_SPECIFIC') {
      saveStreamingState(targetThreadId, updatedState);
    }
  }, [threadId]);

  // Generate correlation ID for request tracking
  const generateCorrelationId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Enhanced message fingerprint to prevent duplicates
  const createMessageFingerprint = useCallback((message: string, threadId: string, userId: string, timestamp: number) => {
    const normalizedMessage = message.trim().toLowerCase();
    const timeWindow = Math.floor(timestamp / 3000); // 3-second window for tighter duplicate detection
    return `${userId}_${threadId}_${normalizedMessage.substring(0, 50)}_${timeWindow}`;
  }, []);

  // Smart edge function routing based on query category
  const getEdgeFunctionName = useCallback((category: string) => {
    switch (category) {
      case 'JOURNAL_SPECIFIC':
        return 'chat-with-rag';
      case 'GENERAL':
        return 'general-chat';
      default:
        return 'chat-with-rag';
    }
  }, []);

  // Enhanced error detection
  const isEdgeFunctionError = useCallback((error: any) => {
    return error?.message?.includes('Failed to invoke function') ||
           error?.message?.includes('Edge Function') ||
           error?.statusText?.includes('502') ||
           error?.statusText?.includes('503');
  }, []);

  const isNetworkError = useCallback((error: any) => {
    return error?.message?.includes('network') ||
           error?.message?.includes('fetch') ||
           error?.code === 'NETWORK_ERROR';
  }, []);

  // Retry logic with exponential backoff
  const invokeWithBackoff = useCallback(async (
    functionName: string, 
    payload: any, 
    attempt: number = 1
  ): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn(`[useStreamingChatV2] Function invoke attempt ${attempt} failed:`, error);
      
      if (attempt >= maxRetryAttempts) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const backoffDelay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[useStreamingChatV2] Retrying in ${backoffDelay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return invokeWithBackoff(functionName, payload, attempt + 1);
    }
  }, [maxRetryAttempts]);

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

  // Enhanced streaming messages with external generation and translation
  const generateStreamingMessages = useCallback(async (threadId: string, userMessage: string, userProfile?: any) => {
    const currentState = getThreadState(threadId);
    let fallbackMessages = [
      "Analyzing your journal entries...",
      "Looking for patterns and insights...",
      "Examining emotional themes...",
      "Processing your personal data...",
      "Generating personalized insights..."
    ];

    // Try to get dynamic messages from edge function
    let dynamicMessages = fallbackMessages;
    let translatedMessages = fallbackMessages;
    let useThreeDotFallback = false;

    try {
      const { data } = await supabase.functions.invoke('generate-streaming-messages', {
        body: {
          userMessage,
          category: currentState.queryCategory,
          conversationContext: '', // Add if available
          userProfile
        }
      });

      if (data?.success && data?.messages && Array.isArray(data.messages)) {
        dynamicMessages = data.messages;
        useThreeDotFallback = !!data.shouldUseFallback;
        
        // Translate messages if needed
        if (currentLanguage !== 'en') {
          translatedMessages = await Promise.all(
            dynamicMessages.map(async msg => await translate(msg))
          );
        } else {
          translatedMessages = dynamicMessages;
        }
      } else {
        useThreeDotFallback = true;
      }
    } catch (error) {
      console.warn('[useStreamingChatV2] Failed to generate dynamic messages:', error);
      useThreeDotFallback = true;
    }

    // Update state with generated messages
    updateThreadState(threadId, {
      dynamicMessages,
      translatedDynamicMessages: translatedMessages,
      useThreeDotFallback
    });

    let messageIndex = currentState.dynamicMessageIndex;
    
    const showNextMessage = () => {
      const state = getThreadState(threadId);
      if (!state.showDynamicMessages) return;
      
      // Clear previous message
      const clearedMessages = state.streamingMessages.map(msg => 
        msg.id?.startsWith('dynamic-') ? { ...msg, isVisible: false } : msg
      );
      
      // Determine message to show
      const messages = state.useThreeDotFallback ? fallbackMessages : (state.translatedDynamicMessages || dynamicMessages);
      const messageContent = messages[messageIndex % messages.length];
      
      // Add new message
      const newMessage: StreamingMessage = {
        id: `dynamic-${messageIndex}`,
        type: 'progress',
        content: messageContent,
        message: messageContent,
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
  }, [getThreadState, updateThreadState, currentLanguage, translate]);

  // Save streaming state to localStorage with better structure
  const saveStreamingState = useCallback((threadId: string, state: ThreadStreamingState) => {
    try {
      const stateToSave = {
        ...state,
        requestCorrelationId: state.requestCorrelationId,
        idempotencyKey: state.idempotencyKey,
        lastActivity: Date.now(),
        savedAt: Date.now(),
        navigationSafe: true,
        // Enhanced background state tracking
        pausedDueToBackground: state.pausedDueToBackground || false,
        isAppBackgrounded: state.isAppBackgrounded || false,
        isPageHidden: state.isPageHidden || false,
        wasBackgroundProcessing: state.isStreaming || state.showDynamicMessages || false,
        // Don't save the abort controller
        abortController: null
      };
      
      saveChatStreamingState(threadId, stateToSave);
      console.log(`[useStreamingChatV2] Saved comprehensive streaming state for thread: ${threadId} with correlation ID: ${state.requestCorrelationId}`);
    } catch (error) {
      console.warn(`[useStreamingChatV2] Failed to save streaming state: ${error}`);
    }
  }, []);

  // Enhanced page visibility and app lifecycle handlers
  useEffect(() => {
    if (!threadId || !user?.id) return;

    // Page visibility handler
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      const currentState = getThreadState(threadId);
      
      if (isHidden) {
        // Page backgrounded - save state if processing
        if (currentState.isStreaming || currentState.showDynamicMessages) {
          updateThreadState(threadId, {
            ...currentState,
            isPageHidden: true,
            pausedDueToBackground: true,
            wasBackgroundProcessing: true
          });
          console.log(`[useStreamingChatV2] Page backgrounded, saved state for thread: ${threadId}`);
        }
      } else {
        // Page foregrounded - restore state
        console.log(`[useStreamingChatV2] Page foregrounded, checking state for thread: ${threadId}`);
        restoreStateIfStillValid();
      }
    };

    // Capacitor app lifecycle handler
    const handleAppStateChange = (state: any) => {
      const currentState = getThreadState(threadId);
      
      if (!state.isActive) {
        // App backgrounded
        if (currentState.isStreaming || currentState.showDynamicMessages) {
          updateThreadState(threadId, {
            ...currentState,
            isAppBackgrounded: true,
            pausedDueToBackground: true,
            wasBackgroundProcessing: true
          });
          console.log(`[useStreamingChatV2] App backgrounded, saved state for thread: ${threadId}`);
        }
      } else {
        // App foregrounded
        console.log(`[useStreamingChatV2] App foregrounded, checking state for thread: ${threadId}`);
        restoreStateIfStillValid();
      }
    };

    const restoreStateIfStillValid = async () => {
      try {
        // Enhanced state restoration logic
        const savedState = getChatStreamingState(threadId);
        if (savedState && (savedState.isStreaming || savedState.wasBackgroundProcessing || savedState.navigationSafe)) {
          console.log(`[useStreamingChatV2] Found saved state for thread: ${threadId}`, {
            isStreaming: savedState.isStreaming,
            wasBackgroundProcessing: savedState.wasBackgroundProcessing,
            queryCategory: savedState.queryCategory
          });
          
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
              console.log(`[useStreamingChatV2] Restoring comprehensive state for thread: ${threadId} with correlation ID: ${savedState.requestCorrelationId}`);
              const restoredState = {
                ...createInitialState(),
                ...savedState,
                abortController: new AbortController(), // Create new abort controller
                isPageHidden: false,
                isAppBackgrounded: false,
                pausedDueToBackground: false
              };
              
              updateThreadState(threadId, restoredState);
              setState(restoredState);
              
              // Continue dynamic messages if it's a journal-specific query
              if (savedState.queryCategory === 'JOURNAL_SPECIFIC' && savedState.showDynamicMessages) {
                generateStreamingMessages(threadId, savedState.currentUserMessage || '', null);
              }
              
              // Emit event so UI knows response might be ready
              const completionEvent = new CustomEvent('chatResponseReady', {
                detail: { threadId: threadId, restored: true, correlationId: savedState.requestCorrelationId }
              });
              window.dispatchEvent(completionEvent);
              
              return;
            } else {
              console.log(`[useStreamingChatV2] Request completed while away, emitting ready event for thread: ${threadId}`);
              clearChatStreamingState(threadId);
              
              // Emit event so UI reloads to show completed response
              const completionEvent = new CustomEvent('chatResponseReady', {
                detail: { threadId: threadId, completed: true, correlationId: savedState.requestCorrelationId }
              });
              window.dispatchEvent(completionEvent);
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

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Capacitor app lifecycle
    if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.App) {
      try {
        const { App } = (window as any).Capacitor.Plugins;
        App.addListener('appStateChange', handleAppStateChange);
      } catch (error) {
        console.warn('[useStreamingChatV2] Error setting up Capacitor listeners:', error);
      }
    }

    // Initial state restoration
    restoreStateIfStillValid();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (typeof window !== 'undefined' && (window as any).Capacitor?.Plugins?.App) {
        try {
          const { App } = (window as any).Capacitor.Plugins;
          App.removeAllListeners();
        } catch (error) {
          console.warn('[useStreamingChatV2] Error removing Capacitor listeners:', error);
        }
      }
    };
  }, [threadId, user?.id, getThreadState, updateThreadState, checkIfRequestCompleted, generateStreamingMessages]);


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

  // Enhanced retry functionality  
  const retryLastMessage = useCallback(async (targetThreadId: string) => {
    const threadState = getThreadState(targetThreadId);
    
    if (!threadState.lastFailedMessage) {
      console.warn('[useStreamingChatV2] No failed message to retry');
      return false;
    }

    if (threadState.retryAttempts >= maxRetryAttempts) {
      console.warn('[useStreamingChatV2] Max retry attempts reached');
      showEdgeFunctionRetryToast();
      return false;
    }

    console.log(`[useStreamingChatV2] Retrying message (attempt ${threadState.retryAttempts + 1}/${maxRetryAttempts})`);
    
    updateThreadState(targetThreadId, {
      isRetrying: true,
      retryAttempts: threadState.retryAttempts + 1
    });

    try {
      const { messageContent, userId, messageCategory, userProfile } = threadState.lastFailedMessage;
      return await startStreamingChat(messageContent, targetThreadId, userId, messageCategory, userProfile);
    } catch (error) {
      updateThreadState(targetThreadId, { isRetrying: false });
      throw error;
    }
  }, [getThreadState, updateThreadState, maxRetryAttempts]);

  // Safety completion guard to prevent infinite processing
  const safetyCompletionGuard = useCallback((targetThreadId: string, timeoutMs: number = 120000) => {
    const timer = setTimeout(async () => {
      const state = getThreadState(targetThreadId);
      if (state.isStreaming || state.showDynamicMessages) {
        console.warn(`[useStreamingChatV2] Safety timeout reached for thread: ${targetThreadId}`);
        
        // Check one more time if completion happened
        const isCompleted = await checkIfRequestCompleted(targetThreadId, user?.id || '', state.requestCorrelationId);
        
        if (isCompleted) {
          console.log(`[useStreamingChatV2] Request completed during safety check: ${targetThreadId}`);
          clearChatStreamingState(targetThreadId);
          window.dispatchEvent(new CustomEvent('chatResponseReady', {
            detail: { threadId: targetThreadId, completed: true, correlationId: state.requestCorrelationId }
          }));
        } else {
          // Force completion with timeout message
          updateThreadState(targetThreadId, {
            isStreaming: false,
            showDynamicMessages: false,
            streamingMessages: [...state.streamingMessages, {
              id: `timeout-${Date.now()}`,
              type: 'error',
              content: 'Request timed out. Please try again.',
              error: 'Timeout',
              timestamp: Date.now()
            }]
          });
          clearChatStreamingState(targetThreadId);
        }
      }
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [getThreadState, updateThreadState, checkIfRequestCompleted, user?.id]);

  // Cleanup orphaned states periodically
  const cleanupOrphanedStates = useCallback(() => {
    try {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes
      
      for (const [threadId, state] of threadStatesRef.current.entries()) {
        const stateAge = now - (state.lastActivity || 0);
        if (stateAge > maxAge && !state.isStreaming && !state.showDynamicMessages) {
          console.log(`[useStreamingChatV2] Cleaning up orphaned state for thread: ${threadId}`);
          threadStatesRef.current.delete(threadId);
          clearChatStreamingState(threadId);
        }
      }
    } catch (error) {
      console.warn('[useStreamingChatV2] Error during cleanup:', error);
    }
  }, []);

  // Enhanced start streaming chat with full feature parity
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
        generateStreamingMessages(targetThreadId, messageContent, userProfile);
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
        showDynamicMessages: false,
        showBackendAnimation: false,
        wasBackgroundProcessing: false,
        pausedDueToBackground: false,
        isPageHidden: false,
        isAppBackgrounded: false
      });

      // Clear saved state since request is complete
      clearChatStreamingState(targetThreadId);

      // Emit completion event for UI updates
      const completionEvent = new CustomEvent('chatResponseReady', {
        detail: { threadId: targetThreadId, response: result, correlationId: correlationId, completed: true }
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

  // Enhanced recovery detection and cleanup
  const detectStuckState = useCallback((targetThreadId: string): boolean => {
    const state = getThreadState(targetThreadId);
    const now = Date.now();
    const stuckThreshold = 10 * 60 * 1000; // 10 minutes
    
    return (
      (state.isStreaming || state.showDynamicMessages) &&
      state.requestStartTime > 0 &&
      (now - state.requestStartTime) > stuckThreshold
    );
  }, [getThreadState]);

  const forceRecovery = useCallback((targetThreadId: string, reason: string = 'manual') => {
    console.warn(`[useStreamingChatV2] Force recovery triggered for thread ${targetThreadId}, reason: ${reason}`);
    
    const currentState = getThreadState(targetThreadId);
    
    // Abort any active request
    if (currentState.abortController) {
      currentState.abortController.abort();
    }
    
    // Clear state completely
    updateThreadState(targetThreadId, {
      ...createInitialState(),
      lastActivity: Date.now()
    });
    
    // Clear localStorage state
    clearChatStreamingState(targetThreadId);
    
    // Emit recovery event
    window.dispatchEvent(new CustomEvent('chatStateRecovered', {
      detail: { threadId: targetThreadId, reason }
    }));
    
    console.log(`[useStreamingChatV2] Recovery completed for thread: ${targetThreadId}`);
  }, [getThreadState, updateThreadState]);

  // Auto-recovery on mount for stuck states
  useEffect(() => {
    if (!threadId) return;
    
    const checkAndRecover = async () => {
      // Check localStorage for stuck state
      const savedState = getChatStreamingState(threadId);
      if (savedState) {
        const now = Date.now();
        const stateAge = now - (savedState.savedAt || 0);
        const stuckThreshold = 10 * 60 * 1000; // 10 minutes
        
        if (stateAge > stuckThreshold && (savedState.isStreaming || savedState.showDynamicMessages)) {
          console.warn(`[useStreamingChatV2] Detected stuck state in localStorage for thread ${threadId}, age: ${stateAge}ms`);
          forceRecovery(threadId, 'stuck_state_on_mount');
          return;
        }
      }
      
      // Check current state
      if (detectStuckState(threadId)) {
        console.warn(`[useStreamingChatV2] Detected stuck state for thread ${threadId}`);
        forceRecovery(threadId, 'stuck_state_detected');
      }
    };
    
    // Run check after a short delay to allow state restoration
    const timer = setTimeout(checkAndRecover, 2000);
    return () => clearTimeout(timer);
  }, [threadId, detectStuckState, forceRecovery]);

  // Setup cleanup timer with enhanced stuck state detection
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      cleanupOrphanedStates();
      
      // Check all thread states for stuck conditions
      for (const [checkThreadId] of threadStatesRef.current.entries()) {
        if (detectStuckState(checkThreadId)) {
          forceRecovery(checkThreadId, 'periodic_stuck_check');
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(cleanupTimer);
  }, [cleanupOrphanedStates, detectStuckState, forceRecovery]);

  return {
    ...state,
    startStreamingChat,
    stopStreaming,
    clearStreamingMessages,
    generateCorrelationId,
    generateIdempotencyKey,
    retryLastMessage,
    addStreamingMessage: (message: StreamingMessage) => addStreamingMessage(threadId, message),
    forceRecovery: () => forceRecovery(threadId, 'user_manual'),
    isStuck: detectStuckState(threadId)
  };
};