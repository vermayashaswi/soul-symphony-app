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
        const { data: threadData, error } = await supabase
          .from('chat_threads')
          .select('processing_status')
          .eq('id', threadId)
          .single();
          
        if (error) {
          console.error("Error fetching thread status:", error);
          return;
        }
        
        if (threadData && threadData.processing_status) {
          const processingStatus = threadData.processing_status as ThreadProcessingStatus;
          
          setRealtimeState(prev => ({
            ...prev,
            isLoading: processingStatus === 'processing',
            isProcessing: processingStatus === 'processing',
            processingStatus: processingStatus,
            processingStage: processingStatus === 'processing' ? 'Retrieving information...' : null
          }));
        }
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
          const threadData = payload.new as any;
          const processingStatus = threadData.processing_status as ThreadProcessingStatus;
          
          setRealtimeState(prev => ({
            ...prev,
            isLoading: processingStatus === 'processing',
            isProcessing: processingStatus === 'processing',
            processingStatus: processingStatus,
            // Keep the current processing stage if we're still processing
            processingStage: processingStatus === 'processing' 
              ? prev.processingStage || 'Retrieving information...'
              : null
          }));
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
