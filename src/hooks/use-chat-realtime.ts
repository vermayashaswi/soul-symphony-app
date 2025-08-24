import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

export type ThreadProcessingStatus = 'idle' | 'processing' | 'failed';

export interface ChatRealtimeState {
  isLoading: boolean;
  isProcessing: boolean;
  processingStage: string | null;
  processingStatus: ThreadProcessingStatus;
}

// Thread-isolated real-time state management
interface ThreadRealtimeState {
  isLoading: boolean;
  isProcessing: boolean;
  processingStage: string | null;
  processingStatus: ThreadProcessingStatus;
  subscription: any | null;
  watchdogTimer?: ReturnType<typeof setTimeout> | null;
}

const createInitialRealtimeState = (): ThreadRealtimeState => ({
  isLoading: false,
  isProcessing: false,
  processingStage: null,
  processingStatus: 'idle',
  subscription: null,
  watchdogTimer: null
});

// Global thread real-time state store
const threadRealtimeStates = new Map<string, ThreadRealtimeState>();

export function useChatRealtime(threadId: string | null) {
  // Get or create thread-specific state
  const getThreadRealtimeState = (id: string): ThreadRealtimeState => {
    if (!threadRealtimeStates.has(id)) {
      threadRealtimeStates.set(id, createInitialRealtimeState());
    }
    return threadRealtimeStates.get(id)!;
  };

  const updateThreadRealtimeState = (id: string, updates: Partial<ThreadRealtimeState>) => {
    const currentState = getThreadRealtimeState(id);
    const newState = { ...currentState, ...updates };
    threadRealtimeStates.set(id, newState);
    
    // Only update local state if this is the active thread
    if (id === threadId) {
      setRealtimeState({
        isLoading: newState.isLoading,
        isProcessing: newState.isProcessing,
        processingStage: newState.processingStage,
        processingStatus: newState.processingStatus
      });
    }
  };

  // Local state mirrors the active thread state
  const [realtimeState, setRealtimeState] = useState<ChatRealtimeState>(() => {
    if (!threadId) {
      return createInitialRealtimeState();
    }
    const threadState = getThreadRealtimeState(threadId);
    return {
      isLoading: threadState.isLoading,
      isProcessing: threadState.isProcessing,
      processingStage: threadState.processingStage,
      processingStatus: threadState.processingStatus
    };
  });

  // Track previous thread ID to clean up subscriptions
  const prevThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Clean up previous thread subscription if it exists
    if (prevThreadIdRef.current && prevThreadIdRef.current !== threadId) {
      const prevThreadState = threadRealtimeStates.get(prevThreadIdRef.current);
      if (prevThreadState?.subscription) {
        console.log(`[useChatRealtime] Cleaning up subscription for thread: ${prevThreadIdRef.current}`);
        supabase.removeChannel(prevThreadState.subscription);
        prevThreadState.subscription = null;
      }
    }

    if (!threadId) {
      setRealtimeState(createInitialRealtimeState());
      prevThreadIdRef.current = null;
      return;
    }

    console.log(`[useChatRealtime] Setting up real-time for thread: ${threadId}`);
    
    // Reset state when switching threads to prevent indicator leakage
    updateThreadRealtimeState(threadId, {
      isLoading: false,
      isProcessing: false,
      processingStage: null,
      processingStatus: 'idle'
    });

    // Set up subscription for new thread
    const threadState = getThreadRealtimeState(threadId);
    
    // Only create subscription if it doesn't exist
    if (!threadState.subscription) {
      const messageChannel = supabase
        .channel(`thread-messages-${threadId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `thread_id=eq.${threadId}`
          },
          (payload) => {
            const messageData = payload.new as any;
            console.log(`[useChatRealtime] New message in thread ${threadId}:`, messageData.sender);
            
            // Only update if this is still the active thread
            if (threadId && threadRealtimeStates.has(threadId)) {
              if (messageData.sender === 'assistant' && !messageData.is_processing) {
                updateThreadRealtimeState(threadId, {
                  isLoading: false,
                  isProcessing: false,
                  processingStatus: 'idle',
                  processingStage: null
                });
              }
            }
          }
        )
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_messages',
            filter: `thread_id=eq.${threadId}`
          },
          (payload) => {
            const messageData = payload.new as any;
            console.log(`[useChatRealtime] Updated message in thread ${threadId}:`, messageData.sender);
            
            if (threadId && threadRealtimeStates.has(threadId)) {
              if (messageData.sender === 'assistant' && !messageData.is_processing) {
                updateThreadRealtimeState(threadId, {
                  isLoading: false,
                  isProcessing: false,
                  processingStatus: 'idle',
                  processingStage: null
                });
              }
            }
          }
        )
        .on('postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'chat_messages',
            filter: `thread_id=eq.${threadId}`
          },
          (payload) => {
            const deletedMessage = payload.old as any;
            console.log(`[useChatRealtime] Deleted message in thread ${threadId}:`, deletedMessage.id);
            
            // Emit custom event for message deletion handling
            const deleteEvent = new CustomEvent('chatMessageDeleted', {
              detail: { messageId: deletedMessage.id, threadId }
            });
            window.dispatchEvent(deleteEvent);
          }
        )
        .subscribe();

      // Store subscription in thread state
      updateThreadRealtimeState(threadId, { subscription: messageChannel });
    } else {
      // Update local state to match existing thread state
      const currentThreadState = getThreadRealtimeState(threadId);
      setRealtimeState({
        isLoading: currentThreadState.isLoading,
        isProcessing: currentThreadState.isProcessing,
        processingStage: currentThreadState.processingStage,
        processingStatus: currentThreadState.processingStatus
      });
    }

    prevThreadIdRef.current = threadId;

    return () => {
      // Don't clean up subscription here - let the next useEffect handle it
      // This prevents race conditions when switching threads rapidly
    };
  }, [threadId]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      threadRealtimeStates.forEach((threadState, id) => {
        if (threadState.subscription) {
          console.log(`[useChatRealtime] Cleanup subscription for thread: ${id}`);
          supabase.removeChannel(threadState.subscription);
        }
      });
      threadRealtimeStates.clear();
    };
  }, []);

  // Update the processing stage - thread-specific
  const updateProcessingStage = (stage: string | null) => {
    if (!threadId) return;
    
    console.log(`[useChatRealtime] Updating processing stage for thread ${threadId}:`, stage);
    updateThreadRealtimeState(threadId, { processingStage: stage });
  };

  // Set local loading state for immediate UI feedback - thread-specific
  const setLocalLoading = (loading: boolean, stage?: string) => {
    if (!threadId) return;
    
    console.log(`[useChatRealtime] Setting loading state for thread ${threadId}:`, loading, stage);

    // Clear existing watchdog timer
    const current = getThreadRealtimeState(threadId);
    if (current.watchdogTimer) {
      clearTimeout(current.watchdogTimer);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (loading) {
      // iPhone optimization: Much shorter timeout to prevent stuck loaders
      const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : '';
      const isIPhoneMobile = /iPhone|iPod/.test(userAgent) && typeof window !== 'undefined' && !(window.navigator as any).standalone;
      const timeout = isIPhoneMobile ? 10000 : 75000; // 10s for iPhone, 75s for others
      
      timer = setTimeout(() => {
        console.warn(`[useChatRealtime] Watchdog timeout for thread: ${threadId} (${timeout/1000}s)`);
        updateThreadRealtimeState(threadId, {
          isLoading: false,
          isProcessing: false,
          processingStatus: 'failed',
          processingStage: null,
          watchdogTimer: null
        });
      }, timeout);
    }

    updateThreadRealtimeState(threadId, {
      isLoading: loading,
      isProcessing: loading,
      processingStatus: loading ? 'processing' : 'idle',
      processingStage: loading ? (stage || 'Processing...') : null,
      watchdogTimer: timer
    });
  };

  return {
    ...realtimeState,
    updateProcessingStage,
    setLocalLoading
  };
}