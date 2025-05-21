
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

export type ThreadProcessingStatus = 'idle' | 'processing' | 'failed';

export interface ChatRealtimeState {
  isLoading: boolean;
  isProcessing: boolean;
  processingStage: string | null;
  processingStatus: ThreadProcessingStatus;
  error: string | null;
}

export function useChatRealtime(threadId: string | null) {
  const [realtimeState, setRealtimeState] = useState<ChatRealtimeState>({
    isLoading: false,
    isProcessing: false,
    processingStage: null,
    processingStatus: 'idle',
    error: null
  });

  useEffect(() => {
    if (!threadId) return;
    
    // First, check the current processing status of the thread
    const fetchThreadStatus = async () => {
      try {
        setRealtimeState(prev => ({
          ...prev,
          isLoading: true
        }));
        
        const { data: threadData, error } = await supabase
          .from('chat_threads')
          .select('processing_status')
          .eq('id', threadId)
          .single();
          
        if (error) {
          console.error("Error fetching thread status:", error);
          setRealtimeState(prev => ({
            ...prev,
            isLoading: false,
            error: `Error fetching thread status: ${error.message}`
          }));
          return;
        }
        
        if (threadData && threadData.processing_status) {
          const processingStatus = threadData.processing_status as ThreadProcessingStatus;
          
          setRealtimeState(prev => ({
            ...prev,
            isLoading: false,
            isProcessing: processingStatus === 'processing',
            processingStatus: processingStatus,
            processingStage: processingStatus === 'processing' ? 'Retrieving information...' : null
          }));
        } else {
          setRealtimeState(prev => ({
            ...prev,
            isLoading: false
          }));
        }
      } catch (error) {
        console.error("Error in fetchThreadStatus:", error);
        setRealtimeState(prev => ({
          ...prev,
          isLoading: false,
          error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
        }));
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
            isProcessing: processingStatus === 'processing',
            processingStatus: processingStatus,
            // Keep the current processing stage if we're still processing
            processingStage: processingStatus === 'processing' 
              ? prev.processingStage || 'Retrieving information...'
              : processingStatus === 'failed'
                ? 'An error occurred while processing your request.'
                : null,
            error: processingStatus === 'failed' ? 'Processing failed' : null
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
              isProcessing: false,
              processingStage: null,
              error: null // Clear any errors when we get a successful response
            }));
          } else if (messageData.sender === 'error' || messageData.role === 'error') {
            // Handle error messages
            setRealtimeState(prev => ({
              ...prev,
              isProcessing: false,
              processingStage: null,
              error: messageData.content || 'An error occurred'
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

  // Clear any errors
  const clearError = () => {
    setRealtimeState(prev => ({
      ...prev,
      error: null
    }));
  };

  return {
    ...realtimeState,
    updateProcessingStage,
    clearError
  };
}
