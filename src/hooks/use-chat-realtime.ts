
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

// Array of varied processing messages to make the chat feel more dynamic
const processingMessages = [
  "Thinking...",
  "Analyzing your journal entries...",
  "Finding patterns in your writing...",
  "Exploring your emotions...",
  "Connecting the dots...",
  "Looking through your past entries...",
  "Processing your question...",
  "Reflecting on your journals..."
];

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
            isProcessing: processingStatus === 'processing',
            processingStatus: processingStatus,
            // Select a random processing message instead of a fixed one
            processingStage: processingStatus === 'processing' 
              ? processingMessages[Math.floor(Math.random() * processingMessages.length)]
              : null
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
            isProcessing: processingStatus === 'processing',
            processingStatus: processingStatus,
            // Rotate through processing messages when in processing state
            processingStage: processingStatus === 'processing' 
              ? processingMessages[Math.floor(Math.random() * processingMessages.length)]
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
              isProcessing: false,
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

  return {
    ...realtimeState,
    updateProcessingStage
  };
}
