import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Thread-isolated real-time state management
interface ThreadRealtimeState {
  subscription: any | null;
}

const createInitialRealtimeState = (): ThreadRealtimeState => ({
  subscription: null
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
  };

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
      prevThreadIdRef.current = null;
      return;
    }

    console.log(`[useChatRealtime] Setting up real-time for thread: ${threadId}`);

    // Set up subscription for new thread
    const threadState = getThreadRealtimeState(threadId);
    
    // Only create subscription if it doesn't exist
    if (!threadState.subscription) {
      // Check for missed messages immediately when subscription starts
      const checkForMissedMessages = async () => {
        try {
          console.log(`[useChatRealtime] Checking for completed messages in thread ${threadId}`);
          
          // Check for any assistant messages that completed while we were away
          const { data: recentAssistantMessages } = await supabase
            .from('chat_messages')
            .select('id, sender, created_at, is_processing')
            .eq('thread_id', threadId)
            .eq('sender', 'assistant')
            .order('created_at', { ascending: false })
            .limit(5);

          if (recentAssistantMessages && recentAssistantMessages.length > 0) {
            // Check if there are any completed assistant messages (not processing)
            const completedMessages = recentAssistantMessages.filter(msg => !msg.is_processing);
            
            if (completedMessages.length > 0) {
              console.log(`[useChatRealtime] Found ${completedMessages.length} completed assistant messages, triggering reload`);
              
              // SIMPLIFIED: Force immediate reload for completed messages
              const chatResponseReadyEvent = new CustomEvent('chatResponseReady', {
                detail: { 
                  threadId, 
                  forceReload: true
                }
              });
              window.dispatchEvent(chatResponseReadyEvent);
            }
          }
        } catch (error) {
          console.warn(`[useChatRealtime] Failed to check for missed messages:`, error);
          // SIMPLIFIED: Still dispatch event to ensure basic reload
          const chatResponseReadyEvent = new CustomEvent('chatResponseReady', {
            detail: { 
              threadId, 
              forceReload: true 
            }
          });
          window.dispatchEvent(chatResponseReadyEvent);
        }
      };

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
            
            // SIMPLIFIED: Trigger immediate reload for assistant messages
            if (messageData.sender === 'assistant') {
              setTimeout(() => {
                const event = new CustomEvent('chatResponseReady', {
                  detail: { 
                    threadId, 
                    forceReload: true 
                  }
                });
                window.dispatchEvent(event);
              }, 100);
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
            
            // SIMPLIFIED: Trigger immediate reload for assistant messages
            if (messageData.sender === 'assistant') {
              setTimeout(() => {
                const event = new CustomEvent('chatResponseReady', {
                  detail: { 
                    threadId, 
                    forceReload: true 
                  }
                });
                window.dispatchEvent(event);
              }, 100);
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
        .subscribe((status) => {
          console.log(`[useChatRealtime] Subscription status for ${threadId}:`, status);
          
          // When subscription is ready, check for missed messages
          if (status === 'SUBSCRIBED') {
            checkForMissedMessages();
          }
        });

      // Store subscription in thread state
      updateThreadRealtimeState(threadId, { subscription: messageChannel });
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

  return {
    // No processing state - handled by useStreamingChat
  };
}