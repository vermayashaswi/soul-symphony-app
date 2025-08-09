import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

export type ThreadProcessingStatus = 'idle' | 'processing' | 'failed';

export interface ChatRealtimeState {
  isLoading: boolean;
  isProcessing: boolean;
  processingStage: string | null;
  processingStatus: ThreadProcessingStatus;
}

export function useChatRealtime(threadId: string | null) {
  const [realtimeState, setRealtimeState] = useState<ChatRealtimeState>({
    isLoading: false,
    isProcessing: false,
    processingStage: null,
    processingStatus: 'idle'
  });

  useEffect(() => {
    if (!threadId) return;
    
    // Subscribe to new messages in this thread for processing state detection
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
          // New message was added, if it's from the assistant, we're no longer processing
          const messageData = payload.new as any;
          if (messageData.sender === 'assistant' && !messageData.is_processing) {
            setRealtimeState(prev => ({
              ...prev,
              isLoading: false,
              isProcessing: false,
              processingStatus: 'idle',
              processingStage: null
            }));
          }
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [threadId]);
  
  // Reset realtime state when switching threads to prevent indicator leakage across threads
  useEffect(() => {
    setRealtimeState({
      isLoading: false,
      isProcessing: false,
      processingStage: null,
      processingStatus: 'idle'
    });
  }, [threadId]);

  // Update the processing stage - this is a local UI state only
  const updateProcessingStage = (stage: string | null) => {
    setRealtimeState(prev => ({
      ...prev,
      processingStage: stage
    }));
  };

  // Set local loading state for immediate UI feedback
  const setLocalLoading = (loading: boolean, stage?: string) => {
    setRealtimeState(prev => ({
      ...prev,
      isLoading: loading,
      isProcessing: loading,
      processingStatus: loading ? 'processing' : 'idle',
      processingStage: loading ? (stage || prev.processingStage || 'Processing...') : null
    }));
  };

  return {
    ...realtimeState,
    updateProcessingStage,
    setLocalLoading
  };
}