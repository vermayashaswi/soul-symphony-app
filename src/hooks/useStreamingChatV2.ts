import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  reconcileStateWithDatabase, 
  updateMessageTracking, 
  shouldProcessMessage, 
  coordinateAcrossTabsForIdempotency,
  cleanupExpiredTracking
} from './useIdempotencyStateManager';

// Capacitor imports with error handling
let CapacitorApp: any = null;
try {
  CapacitorApp = require('@capacitor/app').App;
} catch (error) {
  console.log('[useStreamingChatV2] Capacitor App plugin not available (web environment)');
}

// Streaming message interface
export interface StreamingMessage {
  id: string;
  type: 'user_message' | 'backend_task' | 'progress' | 'final_response' | 'error';
  content: string;
  isVisible: boolean;
  timestamp?: number;
}

// Enhanced message tracking for idempotency
export interface MessageTrackingInfo {
  idempotencyKey: string;
  correlationId?: string;
  status: 'pending' | 'completed' | 'failed' | 'orphaned';
  timestamp: number;
  retryCount: number;
  messageId?: string;
}

// Thread-specific streaming state interface with enhanced idempotency tracking
export interface ThreadStreamingState {
  isStreaming: boolean;
  streamingMessages: StreamingMessage[];
  showDynamicMessages: boolean;
  showBackendAnimation: boolean;
  pausedDueToBackground: boolean;
  navigationSafe: boolean;
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
  // Enhanced idempotency tracking
  messageTracking: Map<string, MessageTrackingInfo>;
  pendingIdempotencyKeys: Set<string>;
  completedIdempotencyKeys: Set<string>;
  failedIdempotencyKeys: Set<string>;
  lastReconciliationCheck?: number;
  // Original dynamic message system
  dynamicMessages: string[];
  translatedDynamicMessages: string[];
  currentMessageIndex: number;
  useThreeDotFallback: boolean;
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

  // Create initial state for a thread with enhanced idempotency tracking
  function createInitialState(): ThreadStreamingState {
    return {
      isStreaming: false,
      streamingMessages: [],
      showDynamicMessages: false,
      showBackendAnimation: false,
      pausedDueToBackground: false,
      navigationSafe: true,
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
      // Enhanced idempotency tracking
      messageTracking: new Map(),
      pendingIdempotencyKeys: new Set(),
      completedIdempotencyKeys: new Set(),
      failedIdempotencyKeys: new Set(),
      lastReconciliationCheck: undefined,
      // Original dynamic message system
      dynamicMessages: [],
      translatedDynamicMessages: [],
      currentMessageIndex: 0,
      useThreeDotFallback: true,
    };
  }

  // Get thread state from map or create new one
  const getThreadState = useCallback((threadId: string): ThreadStreamingState => {
    if (!threadStatesRef.current.has(threadId)) {
      threadStatesRef.current.set(threadId, createInitialState());
    }
    return threadStatesRef.current.get(threadId)!;
  }, []);

  // Update thread state in map
  const updateThreadState = useCallback((threadId: string, newState: Partial<ThreadStreamingState>) => {
    const currentState = getThreadState(threadId);
    const updatedState = { ...currentState, ...newState };
    threadStatesRef.current.set(threadId, updatedState);
    
    // Update local state if this is the current thread
    if (threadId === threadId) {
      setState(updatedState);
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

  // Enhanced dual-layer completion detection with idempotency key validation
  const checkIfRequestCompleted = useCallback(async (threadId: string, userId: string, correlationId?: string, idempotencyKey?: string): Promise<boolean> => {
    try {
      console.log(`[useStreamingChatV2] Dual-layer completion check for thread: ${threadId}`, {
        correlationId,
        idempotencyKey
      });
      
      // Primary: Enhanced correlation ID-based check
      if (correlationId) {
        const { data: correlatedMessages, error: correlatedError } = await supabase
          .from('chat_messages')
          .select('id, created_at, sender, content, is_processing, request_correlation_id, idempotency_key')
          .eq('thread_id', threadId)
          .eq('request_correlation_id', correlationId)
          .order('created_at', { ascending: false });

        if (!correlatedError && correlatedMessages && correlatedMessages.length > 0) {
          const assistantMessage = correlatedMessages.find(msg => msg.sender === 'assistant');
          if (assistantMessage) {
            // Enhanced completion validation with dual verification
            const hasContent = assistantMessage.content && assistantMessage.content.trim().length > 0;
            const isNotProcessing = !assistantMessage.is_processing;
            const isNotProcessingMessage = !assistantMessage.content.toLowerCase().includes('processing');
            const isNotTechnicalMessage = !assistantMessage.content.toLowerCase().includes('wait') && 
                                         !assistantMessage.content.toLowerCase().includes('working');
            
            const correlationCompleted = hasContent && isNotProcessing && isNotProcessingMessage && isNotTechnicalMessage;
            
            // Cross-validate with idempotency key if available
            let idempotencyValidated = true;
            if (idempotencyKey) {
              const userMessage = correlatedMessages.find(msg => 
                msg.sender === 'user' && msg.idempotency_key === idempotencyKey
              );
              idempotencyValidated = !!userMessage;
            }
            
            const isCompleted = correlationCompleted && idempotencyValidated;
            console.log(`[useStreamingChatV2] Dual-layer correlation completion check: ${isCompleted}`, {
              correlationCompleted,
              idempotencyValidated,
              hasContent,
              isNotProcessing,
              correlationId,
              idempotencyKey,
              contentPreview: assistantMessage.content.substring(0, 100)
            });
            
            return isCompleted;
          }
        }
      }

      // Secondary: Idempotency key-based fallback detection
      if (idempotencyKey) {
        const { data: idempotentMessages, error: idempotentError } = await supabase
          .from('chat_messages')
          .select('id, created_at, sender, content, is_processing, idempotency_key')
          .eq('thread_id', threadId)
          .eq('idempotency_key', idempotencyKey)
          .order('created_at', { ascending: false });

        if (!idempotentError && idempotentMessages && idempotentMessages.length > 0) {
          const userMessage = idempotentMessages.find(msg => msg.sender === 'user');
          if (userMessage) {
            // Look for corresponding assistant response after user message
            const { data: followupMessages, error: followupError } = await supabase
              .from('chat_messages')
              .select('id, created_at, sender, content, is_processing')
              .eq('thread_id', threadId)
              .eq('sender', 'assistant')
              .gte('created_at', userMessage.created_at)
              .order('created_at', { ascending: false })
              .limit(3);

            if (!followupError && followupMessages && followupMessages.length > 0) {
              const completedResponse = followupMessages.find(msg => {
                const hasContent = msg.content && msg.content.trim().length > 20;
                const isNotProcessing = !msg.is_processing;
                const isNotProcessingText = !msg.content.toLowerCase().includes('processing');
                const isNotWaitingText = !msg.content.toLowerCase().includes('wait') && 
                                        !msg.content.toLowerCase().includes('working');
                
                return hasContent && isNotProcessing && isNotProcessingText && isNotWaitingText;
              });

              if (completedResponse) {
                console.log(`[useStreamingChatV2] Idempotency key completion detected for ${idempotencyKey}`);
                return true;
              }
            }
          }
        }
      }

      // Tertiary: Enhanced fallback pattern matching
      const fallbackTimeWindow = 300000; // 5 minutes for mobile browser compatibility
      const recentTime = new Date(Date.now() - fallbackTimeWindow).toISOString();
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('id, created_at, sender, content, is_processing, request_correlation_id, idempotency_key')
        .eq('thread_id', threadId)
        .gte('created_at', recentTime)
        .eq('sender', 'assistant')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('[useStreamingChatV2] Error in fallback completion check:', error);
        return false;
      }

      if (!messages || messages.length === 0) {
        console.log('[useStreamingChatV2] No recent assistant messages found in extended timeframe');
        return false;
      }

      // Enhanced pattern-based completion detection
      const completedMessage = messages.find(msg => {
        const hasSubstantialContent = msg.content && msg.content.trim().length > 20;
        const isNotProcessing = !msg.is_processing;
        const isNotProcessingText = !msg.content.toLowerCase().includes('processing');
        const isNotWaitingText = !msg.content.toLowerCase().includes('wait') && 
                                !msg.content.toLowerCase().includes('working');
        
        return hasSubstantialContent && isNotProcessing && isNotProcessingText && isNotWaitingText;
      });

      const isCompleted = !!completedMessage;
      console.log(`[useStreamingChatV2] Enhanced fallback completion check result: ${isCompleted}`, {
        messagesFound: messages.length,
        hasCompletedMessage: isCompleted,
        correlationId,
        idempotencyKey,
        mostRecentContent: messages[0]?.content?.substring(0, 100)
      });
      
      return isCompleted;
    } catch (error) {
      console.error('[useStreamingChatV2] Exception in dual-layer completion check:', error);
      return false;
    }
  }, [supabase]);

  // Note: localStorage state management removed to prevent navigation issues

  // Enhanced visibility and app lifecycle handling with mobile browser support
  useEffect(() => {
    if (!threadId || !user?.id) return;

    let timeoutId: NodeJS.Timeout;
    let periodicCheckInterval: NodeJS.Timeout;
    let retryCount = 0;
    const maxRetries = 5; // Increased for mobile browsers

    // Enhanced mobile browser visibility handling with state restoration
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.log(`[useStreamingChatV2] Page visibility changed: ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible) {
        // Page became visible - restore streaming state if backend is still processing
        console.log('[useStreamingChatV2] Page visible, restoring streaming state if needed');
        setTimeout(() => restoreStreamingStateFromDatabase(), 200);
        
        // Start periodic checking for mobile browsers that might miss events
        if (isMobileBrowser()) {
          startPeriodicCompletionCheck();
        }
      } else {
        // Page became hidden - keep state as-is (no localStorage operations)
        console.log('[useStreamingChatV2] Page hidden, maintaining current state');
        // Clear periodic check when hidden
        if (periodicCheckInterval) {
          clearInterval(periodicCheckInterval);
        }
      }
    };

    // Enhanced mobile browser support with focus/blur events
    const handleFocusEvents = () => {
      console.log('[useStreamingChatV2] Window focus/blur event triggered');
      // Trigger streaming state restoration as fallback
      setTimeout(() => restoreStreamingStateFromDatabase(), 100);
    };

    // Restore streaming state from database when user returns
    const restoreStreamingStateFromDatabase = async () => {
      const currentState = getThreadState(threadId);
      
      try {
        // Check if there's an ongoing processing request in the database
        const { data: recentMessages, error } = await supabase
          .from('chat_messages')
          .select('id, created_at, sender, content, is_processing, request_correlation_id')
          .eq('thread_id', threadId)
          .eq('sender', 'assistant')
          .gte('created_at', new Date(Date.now() - 600000).toISOString()) // Last 10 minutes
          .eq('is_processing', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && recentMessages && recentMessages.length > 0) {
          const processingMessage = recentMessages[0];
          console.log('[useStreamingChatV2] Found processing message, restoring streaming state:', processingMessage.id);
          
          // Restore streaming state to show dynamic messages
          updateThreadState(threadId, {
            isStreaming: true,
            showDynamicMessages: true,
            showBackendAnimation: true,
            pausedDueToBackground: false,
            navigationSafe: true,
            requestCorrelationId: processingMessage.request_correlation_id,
            requestStartTime: new Date(processingMessage.created_at).getTime(),
            queryCategory: 'JOURNAL_SPECIFIC' // Default to journal specific for dynamic messages
          });

          // Restart dynamic message rotation
          generateStreamingMessages(threadId);
          
          // Emit event to notify UI components
          window.dispatchEvent(new CustomEvent('streamingStateRestored', {
            detail: { 
              threadId, 
              correlationId: processingMessage.request_correlation_id,
              source: 'navigation_return'
            }
          }));
          
          console.log('[useStreamingChatV2] Streaming state restored from database');
        } else {
          console.log('[useStreamingChatV2] No processing messages found, keeping current state');
        }
      } catch (error) {
        console.error('[useStreamingChatV2] Error restoring streaming state:', error);
      }
    };

    // Detect mobile browser
    const isMobileBrowser = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
    };

    // Periodic completion check for mobile browsers
    const startPeriodicCompletionCheck = () => {
      if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
      }
      
      periodicCheckInterval = setInterval(async () => {
        const currentState = getThreadState(threadId);
        if (currentState.isStreaming || currentState.showBackendAnimation || currentState.showDynamicMessages) {
          console.log('[useStreamingChatV2] Periodic mobile completion check');
          try {
            const isCompleted = await checkIfRequestCompleted(
              threadId, 
              user?.id || '', 
              currentState.requestCorrelationId,
              currentState.idempotencyKey
            );
            
            if (isCompleted) {
              console.log('[useStreamingChatV2] Periodic check detected completion, updating state');
              updateThreadState(threadId, {
                isStreaming: false,
                showBackendAnimation: false,
                showDynamicMessages: false,
                pausedDueToBackground: false,
                navigationSafe: true
              });
              clearInterval(periodicCheckInterval);
              
              // Trigger UI refresh and completion events
              window.dispatchEvent(new CustomEvent('chatCompletionDetected', {
                detail: { 
                  threadId, 
                  correlationId: currentState.requestCorrelationId,
                  source: 'periodic_check'
                }
              }));
              window.dispatchEvent(new CustomEvent('chatStateUpdated', {
                detail: { threadId, completed: true, source: 'periodic_check' }
              }));
            }
          } catch (error) {
            console.error('[useStreamingChatV2] Error in periodic completion check:', error);
          }
        } else {
          // State is not streaming, clear interval
          clearInterval(periodicCheckInterval);
        }
      }, 3000); // Check every 3 seconds for mobile
    };

    // Handle Capacitor app lifecycle (mobile apps)
    const handleAppStateChange = (state: { isActive: boolean }) => {
      console.log(`[useStreamingChatV2] App state changed: ${state.isActive ? 'active' : 'inactive'}`);
      
      if (state.isActive) {
        // App became active - restore state
        setTimeout(() => restoreStateIfStillValid(), 100);
      } else {
        // App became inactive - preserve state
        const currentState = getThreadState(threadId);
        if (currentState.isStreaming || currentState.showBackendAnimation) {
          updateThreadState(threadId, {
            pausedDueToBackground: true,
            navigationSafe: false,
            lastActivity: Date.now()
          });
        }
      }
    };

    // 30-second timeout fallback mechanism
    const setupTimeoutFallback = () => {
      const currentState = getThreadState(threadId);
      if (currentState.isStreaming || currentState.showBackendAnimation) {
        timeoutId = setTimeout(() => {
          console.log(`[useStreamingChatV2] 30s timeout reached for thread: ${threadId}, checking completion`);
          
          checkIfRequestCompleted(threadId, user.id || '', currentState.requestCorrelationId, currentState.idempotencyKey)
            .then((completed) => {
              if (!completed && retryCount < maxRetries) {
                retryCount++;
                console.log(`[useStreamingChatV2] Retry ${retryCount}/${maxRetries} for thread: ${threadId}`);
                setupTimeoutFallback(); // Setup another timeout
              } else if (!completed) {
                console.log(`[useStreamingChatV2] Max retries reached, cleaning up stuck state for thread: ${threadId}`);
                updateThreadState(threadId, {
                  isStreaming: false,
                  showBackendAnimation: false,
                  showDynamicMessages: false,
                  pausedDueToBackground: false,
                  navigationSafe: true
                });
              } else {
                console.log(`[useStreamingChatV2] Request completed during timeout check for thread: ${threadId}`);
              }
            })
            .catch((error) => {
              console.error(`[useStreamingChatV2] Error in timeout fallback: ${error}`);
            });
        }, 30000); // 30 seconds
      }
    };

    const restoreStateIfStillValid = async () => {
      // No localStorage state restoration - just check for completed requests
      console.log(`[useStreamingChatV2] Checking for any completed requests for thread: ${threadId}`);
      
      try {
        // Check if there are any recently completed assistant messages
        const recentMessages = await supabase
          .from('chat_messages')
          .select('id, created_at, sender, is_processing, content')
          .eq('thread_id', threadId)
          .gte('created_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
          .eq('sender', 'assistant')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (recentMessages.data && recentMessages.data.length > 0) {
          const mostRecent = recentMessages.data[0];
          
          // If we found a recent assistant message that's not marked as processing
          if (!mostRecent.is_processing && mostRecent.content) {
            console.log('[useStreamingChatV2] Found completed recent message, ensuring UI is clean');
            
            // Ensure UI indicators are cleared
            updateThreadState(threadId, {
              isStreaming: false,
              showBackendAnimation: false,
              showDynamicMessages: false,
              pausedDueToBackground: false,
              navigationSafe: true,
              streamingMessages: [],
              dynamicMessageIndex: 0
            });
            
            // Emit completion events for UI synchronization
            window.dispatchEvent(new CustomEvent('chatCompletionDetected', {
              detail: { 
                threadId, 
                correlationId: `restore-sync-${Date.now()}`,
                restoredFromBackground: false,
                source: 'restoration_cleanup'
              }
            }));
          }
        }
        
        // Enhanced fresh state handling with mobile completion check
        const threadState = getThreadState(threadId);
        setState(threadState);
        
        // ENHANCED: Mobile browser aggressive completion detection
        if (isMobileBrowser()) {
          console.log('[useStreamingChatV2] Mobile browser: Performing aggressive completion detection');
          
          try {
            // Check for recently completed assistant messages
            const recentMessages = await supabase
              .from('chat_messages')
              .select('id, created_at, sender, is_processing, content')
              .eq('thread_id', threadId)
              .gte('created_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes
              .eq('sender', 'assistant')
              .order('created_at', { ascending: false })
              .limit(3);
            
            if (recentMessages.data && recentMessages.data.length > 0) {
              const mostRecent = recentMessages.data[0];
              
              // If we found a recent assistant message that's not marked as processing
              if (!mostRecent.is_processing && mostRecent.content) {
                console.log('[useStreamingChatV2] Mobile browser: Found completed recent message, forcing UI clear');
                
                // Force-clear any lingering UI indicators
                updateThreadState(threadId, {
                  isStreaming: false,
                  showBackendAnimation: false,
                  showDynamicMessages: false,
                  pausedDueToBackground: false,
                  navigationSafe: true,
                  streamingMessages: [],
                  dynamicMessageIndex: 0
                });
                
                // Emit completion events for mobile UI synchronization
                window.dispatchEvent(new CustomEvent('chatCompletionDetected', {
                  detail: { 
                    threadId, 
                    correlationId: `mobile-sync-${Date.now()}`,
                    restoredFromBackground: false,
                    source: 'mobile_aggressive_detection'
                  }
                }));
              }
            }
          } catch (error) {
            console.warn('[useStreamingChatV2] Mobile completion detection failed:', error);
          }
        }
      } catch (error) {
        console.error(`[useStreamingChatV2] Error in enhanced state restoration: ${error}`);
        // Fallback to fresh state
        const threadState = getThreadState(threadId);
        setState(threadState);
      }
    };

    // Enhanced event listeners for mobile browser compatibility
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocusEvents);
    window.addEventListener('blur', handleFocusEvents);
    
    // Add Capacitor app lifecycle listener if available
    let appStateChangeListener: any = null;
    if (CapacitorApp) {
      CapacitorApp.addListener('appStateChange', handleAppStateChange)
        .then((listener: any) => {
          appStateChangeListener = listener;
        })
        .catch((error: any) => {
          console.log('[useStreamingChatV2] Failed to add app state listener:', error);
        });
    }

    // Enhanced initial state restoration with immediate execution
    setTimeout(() => restoreStateIfStillValid(), 0);
    
    // Setup initial timeout fallback
    setupTimeoutFallback();
    
    // Periodic state reconciliation and cleanup
    const reconciliationInterval = setInterval(async () => {
      const currentState = getThreadState(threadId);
      const now = Date.now();
      
      // Perform reconciliation every 2 minutes
      if (!currentState.lastReconciliationCheck || (now - currentState.lastReconciliationCheck) > 120000) {
        try {
          const reconciliationResult = await reconcileStateWithDatabase(threadId, user?.id || '', currentState);
          
          if (reconciliationResult.hasOrphanedStates || reconciliationResult.recommendations.length > 0) {
            console.log(`[useStreamingChatV2] State reconciliation recommendations:`, reconciliationResult.recommendations);
            
            // Update state based on reconciliation results with proper type handling
            let updatedState: ThreadStreamingState = { 
              ...currentState, 
              lastReconciliationCheck: now 
            };
            
            // Mark completed keys
            for (const completedKey of reconciliationResult.completedKeys) {
              updatedState = updateMessageTracking(updatedState, completedKey, 'completed');
            }
            
            // Mark failed keys
            for (const failedKey of reconciliationResult.failedKeys) {
              updatedState = updateMessageTracking(updatedState, failedKey, 'failed');
            }
            
            // Cleanup expired tracking data
            updatedState = cleanupExpiredTracking(updatedState);
            
            updateThreadState(threadId, updatedState);
          }
        } catch (error) {
          console.error('[useStreamingChatV2] Error during state reconciliation:', error);
        }
      }
    }, 60000); // Check every minute
    
    // Start periodic checking for mobile browsers immediately if there's active state
    const currentState = getThreadState(threadId);
    if (isMobileBrowser() && (currentState.isStreaming || currentState.showBackendAnimation)) {
      setTimeout(() => startPeriodicCompletionCheck(), 1000);
    }
    
    // Enhanced cleanup to include reconciliation interval
    const originalCleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocusEvents);
      window.removeEventListener('blur', handleFocusEvents);
      
      if (appStateChangeListener) {
        appStateChangeListener.remove();
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
      }
      
      if (reconciliationInterval) {
        clearInterval(reconciliationInterval);
      }
    };

    return originalCleanup;
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

  // Generate streaming messages using backend integration (original logic)
  const generateStreamingMessages = useCallback(async (
    threadId: string, 
    userMessage: string = '',
    category: string = 'JOURNAL_SPECIFIC',
    conversationContext: any[] = [],
    userProfile: any = {}
  ) => {
    console.log('[useStreamingChatV2] Generating streaming messages for category:', category);
    
    try {
      // Call backend to generate contextual dynamic messages
      const { data: result, error } = await supabase.functions.invoke('generate-streaming-messages', {
        body: {
          userMessage,
          category,
          conversationContext,
          userProfile
        }
      });

      if (error) {
        console.error('[useStreamingChatV2] Error generating streaming messages:', error);
        // Fall back to three dots
        updateThreadState(threadId, {
          useThreeDotFallback: true,
          dynamicMessages: [],
          translatedDynamicMessages: []
        });
        return;
      }

      const messages = result?.messages || [];
      const shouldUseFallback = result?.shouldUseFallback || messages.length === 0;

      console.log('[useStreamingChatV2] Generated messages:', { messages, shouldUseFallback });

      // Update state with generated messages
      updateThreadState(threadId, {
        dynamicMessages: messages,
        translatedDynamicMessages: messages, // No translation for now
        useThreeDotFallback: shouldUseFallback,
        currentMessageIndex: 0
      });

      // Start cycling through messages if we have them
      if (!shouldUseFallback && messages.length > 0) {
        startMessageCycling(threadId, category);
      }

    } catch (error) {
      console.error('[useStreamingChatV2] Exception generating streaming messages:', error);
      // Fall back to three dots
      updateThreadState(threadId, {
        useThreeDotFallback: true,
        dynamicMessages: [],
        translatedDynamicMessages: []
      });
    }
  }, [getThreadState, updateThreadState]);

  // Start message cycling with proper timing (original logic)
  const startMessageCycling = useCallback((threadId: string, category: string) => {
    const state = getThreadState(threadId);
    const messages = state.translatedDynamicMessages.length > 0 
      ? state.translatedDynamicMessages 
      : state.dynamicMessages;

    if (messages.length === 0) return;

    let currentIndex = state.currentMessageIndex;
    let timeoutId: NodeJS.Timeout | null = null;

    console.log('[useStreamingChatV2] Starting message cycling for category:', category, 'messages:', messages.length);

    const showNextMessage = () => {
      const currentState = getThreadState(threadId);
      if (!currentState.showDynamicMessages || currentState.useThreeDotFallback) {
        console.log('[useStreamingChatV2] Stopping message cycling');
        return;
      }

      // Clear existing timeouts
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const availableMessages = currentState.translatedDynamicMessages.length > 0 
        ? currentState.translatedDynamicMessages 
        : currentState.dynamicMessages;

      if (availableMessages.length === 0) return;

      // Clear previous dynamic messages
      const clearedMessages = currentState.streamingMessages.filter(msg => 
        !msg.id.startsWith('dynamic-')
      );

      // Add current message
      const currentMessage = availableMessages[currentIndex % availableMessages.length];
      const newMessage: StreamingMessage = {
        id: `dynamic-${currentIndex}`,
        type: 'progress',
        content: currentMessage,
        isVisible: true,
        timestamp: Date.now()
      };

      console.log('[useStreamingChatV2] Showing message:', currentMessage);

      updateThreadState(threadId, {
        streamingMessages: [...clearedMessages, newMessage],
        currentMessageIndex: currentIndex
      });

      // Determine timing based on category
      let nextDelay = 2000; // Default for general queries
      let shouldContinue = true;

      if (category === 'JOURNAL_SPECIFIC') {
        nextDelay = 7000; // 7 seconds for journal-specific
        // For journal-specific, stick on the last message
        if (currentIndex >= availableMessages.length - 1) {
          shouldContinue = false;
          console.log('[useStreamingChatV2] Sticking on last message for JOURNAL_SPECIFIC');
        }
      }

      if (shouldContinue) {
        currentIndex++;
        
        timeoutId = setTimeout(() => {
          const state = getThreadState(threadId);
          if (state.showDynamicMessages && !state.useThreeDotFallback) {
            showNextMessage();
          }
        }, nextDelay);
      }
    };

    // Start immediately
    showNextMessage();

    // Return cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
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
    
    // Enhanced deduplication check using idempotency keys
    if (!shouldProcessMessage(threadState, idempotencyKey)) {
      console.log(`[useStreamingChatV2] Blocking duplicate request for idempotency key: ${idempotencyKey}`);
      return;
    }
    
    console.log(`[useStreamingChatV2] Generated correlation ID: ${correlationId}, idempotency key: ${idempotencyKey}`);
    
    // Enhanced state initialization with idempotency tracking
    let updatedState = updateMessageTracking(
      threadState,
      idempotencyKey,
      'pending',
      correlationId,
      messageId
    );
    
    updatedState = {
      ...updatedState,
      isStreaming: true,
      streamingMessages: [],
      showDynamicMessages: messageCategory === 'JOURNAL_SPECIFIC',
      showBackendAnimation: messageCategory !== 'JOURNAL_SPECIFIC',
      pausedDueToBackground: false,
      navigationSafe: true,
      lastUserInput: messageContent,
      requestStartTime: Date.now(),
      requestCorrelationId: correlationId,
      idempotencyKey: idempotencyKey,
      abortController: new AbortController(),
      retryCount: 0,
      queryCategory: messageCategory
    };
    
    // Cross-tab coordination
    coordinateAcrossTabsForIdempotency(targetThreadId, idempotencyKey, 'start');
    
    updateThreadState(targetThreadId, updatedState);

    try {
      console.log(`[useStreamingChatV2] Generating streaming messages for category: ${messageCategory}`);
      
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

      // Generate dynamic messages using backend integration
      await generateStreamingMessages(
        targetThreadId,
        messageContent,
        messageCategory,
        conversationContext,
        {} // userProfile placeholder
      );

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
        
        // Enhanced error handling with idempotency tracking
        const errorState = updateMessageTracking(
          currentState,
          idempotencyKey,
          'failed',
          correlationId
        );
        
        coordinateAcrossTabsForIdempotency(targetThreadId, idempotencyKey, 'fail');
        
        addStreamingMessage(targetThreadId, {
          id: 'error-' + Date.now(),
          type: 'error',
          content: `Error: ${error.message || 'Unknown error occurred'}`,
          isVisible: true
        });

        updateThreadState(targetThreadId, {
          ...errorState,
          isStreaming: false,
          showDynamicMessages: false,
          showBackendAnimation: false,
          pausedDueToBackground: false,
          navigationSafe: true
        });
        return;
      }

      console.log('[useStreamingChatV2] Backend response received:', result);
      console.log('[useStreamingChatV2] Debug: Response completion details:', {
        hasResult: !!result,
        threadId: targetThreadId,
        correlationId: correlationId,
        responseLength: result ? JSON.stringify(result).length : 0
      });

      // Enhanced completion handling with idempotency tracking
      const completedState = updateMessageTracking(
        currentState,
        idempotencyKey,
        'completed',
        correlationId
      );
      
      coordinateAcrossTabsForIdempotency(targetThreadId, idempotencyKey, 'complete');
      
      // Clear streaming messages and update state
      updateThreadState(targetThreadId, {
        ...completedState,
        isStreaming: false,
        streamingMessages: [],
        showDynamicMessages: false,
        showBackendAnimation: false,
        pausedDueToBackground: false,
        navigationSafe: true
      });

      // Request is complete - no localStorage cleanup needed
      
      console.log('[useStreamingChatV2] Debug: State cleared after completion for thread:', targetThreadId);

      // Emit completion event for UI updates
      const completionEvent = new CustomEvent('chatResponseReady', {
        detail: { threadId: targetThreadId, response: result, correlationId: correlationId }
      });
      window.dispatchEvent(completionEvent);
      
      // Also emit the mobile-friendly completion event
      window.dispatchEvent(new CustomEvent('chatCompletionDetected', {
        detail: { 
          threadId: targetThreadId, 
          correlationId: correlationId,
          restoredFromBackground: false,
          source: 'backend_completion'
        }
      }));

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
          showDynamicMessages: false,
          showBackendAnimation: false,
          pausedDueToBackground: false,
          navigationSafe: true
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
      showBackendAnimation: false,
      pausedDueToBackground: false,
      navigationSafe: true,
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
      showDynamicMessages: false,
      showBackendAnimation: false
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