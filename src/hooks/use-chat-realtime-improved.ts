
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThreadProcessingStatus = 'idle' | 'processing' | 'failed';

export interface ChatRealtimeState {
  isLoading: boolean;
  isProcessing: boolean;
  processingStage: string | null;
  processingStatus: ThreadProcessingStatus;
}

export function useChatRealtimeImproved(threadId: string | null) {
  const [realtimeState, setRealtimeState] = useState<ChatRealtimeState>({
    isLoading: false,
    isProcessing: false,
    processingStage: null,
    processingStatus: 'idle'
  });

  useEffect(() => {
    if (!threadId) return;
    
    console.log('[useChatRealtimeImproved] Setting up realtime for thread:', threadId);
    
    // Check current thread status
    const fetchThreadStatus = async () => {
      try {
        const { data: threadData, error } = await supabase
          .from('chat_threads')
          .select('processing_status')
          .eq('id', threadId)
          .single();
          
        if (error) {
          console.error('[useChatRealtimeImproved] Error fetching thread status:', error);
          return;
        }
        
        if (threadData) {
          const status = threadData.processing_status as ThreadProcessingStatus;
          setRealtimeState(prev => ({
            ...prev,
            isProcessing: status === 'processing',
            processingStatus: status,
            processingStage: status === 'processing' ? 'Processing your request...' : null
          }));
        }
      } catch (error) {
        console.error('[useChatRealtimeImproved] Exception in fetchThreadStatus:', error);
      }
    };
    
    fetchThreadStatus();
    
    // Subscribe to thread changes
    const threadChannel = supabase
      .channel(`thread-${threadId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_threads',
        filter: `id=eq.${threadId}`
      }, (payload) => {
        console.log('[useChatRealtimeImproved] Thread status update:', payload);
        const threadData = payload.new as any;
        const status = threadData.processing_status as ThreadProcessingStatus;
        
        setRealtimeState(prev => ({
          ...prev,
          isProcessing: status === 'processing',
          processingStatus: status,
          processingStage: status === 'processing' ? 'Processing your request...' : null
        }));
      })
      .subscribe();
      
    // Subscribe to new messages
    const messageChannel = supabase
      .channel(`messages-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`
      }, (payload) => {
        console.log('[useChatRealtimeImproved] New message:', payload);
        const messageData = payload.new as any;
        
        if (messageData.sender === 'assistant') {
          setRealtimeState(prev => ({
            ...prev,
            isProcessing: false,
            processingStatus: 'idle',
            processingStage: null
          }));
        }
      })
      .subscribe();
      
    return () => {
      console.log('[useChatRealtimeImproved] Cleaning up subscriptions');
      supabase.removeChannel(threadChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [threadId]);

  const updateProcessingStage = (stage: string | null) => {
    setRealtimeState(prev => ({
      ...prev,
      processingStage: stage
    }));
  };

  return {
    ...realtimeState,
    updateProcessingStage
  };
}
