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
    
    // First, check the current processing status of the thread
    const fetchThreadStatus = async () => {
      try {
        // Since processing_status column no longer exists, just set to idle
        setRealtimeState(prev => ({
          ...prev,
          isLoading: false,
          isProcessing: false,
          processingStatus: 'idle',
          processingStage: null
        }));
      } catch (error) {
        console.error("Error in fetchThreadStatus:", error);
      }
    };
    
    fetchThreadStatus();
    
    // Subscribe to thread status changes
    const threadChannel = supabase
      .channel(`thread-status-${threadId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'chat_threads',
          filter: `id=eq.${threadId}`
        }, 
        (payload) => {
          // Processing status column removed, keep existing state
          console.log('Thread updated:', payload.new);
        }
      )
      .subscribe();
      
    // Subscribe to new messages in this thread
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
          if (messageData.sender === 'assistant') {
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
      supabase.removeChannel(threadChannel);
      supabase.removeChannel(messageChannel);
    };
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
      processingStage: loading ? (stage || prev.processingStage || 'Processing...') : null
    }));
  };

  return {
    ...realtimeState,
    updateProcessingStage,
    setLocalLoading
  };
}
