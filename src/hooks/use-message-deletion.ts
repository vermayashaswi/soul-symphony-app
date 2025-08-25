import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MessageDeletionEvent {
  messageId: string;
  threadId: string;
}

export const useMessageDeletion = (
  onMessageDeleted: (messageId: string, threadId: string) => void,
  currentThreadId?: string | null
) => {
  const handleMessageDeletion = useCallback((event: CustomEvent<MessageDeletionEvent>) => {
    const { messageId, threadId } = event.detail;
    console.log(`[useMessageDeletion] Message deleted: ${messageId} in thread: ${threadId}`);
    
    // Only handle deletions for the current thread or all threads if no current thread specified
    if (!currentThreadId || threadId === currentThreadId) {
      onMessageDeleted(messageId, threadId);
    }
  }, [onMessageDeleted, currentThreadId]);

  useEffect(() => {
    window.addEventListener('chatMessageDeleted', handleMessageDeletion as EventListener);
    
    return () => {
      window.removeEventListener('chatMessageDeleted', handleMessageDeletion as EventListener);
    };
  }, [handleMessageDeletion]);

  // Utility function to emit deletion events
  const emitMessageDeletion = useCallback((messageId: string, threadId: string) => {
    const deleteEvent = new CustomEvent('chatMessageDeleted', {
      detail: { messageId, threadId }
    });
    window.dispatchEvent(deleteEvent);
  }, []);

  return { emitMessageDeletion };
};

// Setup global DELETE event listener for all chat messages
export const setupGlobalMessageDeletionListener = (userId: string) => {
  const subscription = supabase
    .channel(`global-message-deletions-${userId}`)
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'chat_messages',
    }, (payload) => {
      const deletedMessage = payload.old as any;
      console.log(`[GlobalDeletion] Message deleted: ${deletedMessage.id}`);
      
      // Find which thread this message belonged to by checking the thread ownership
      supabase
        .from('chat_threads')
        .select('id, user_id')
        .eq('id', deletedMessage.thread_id)
        .eq('user_id' as any, userId as any)
        .single()
        .then(({ data: thread, error }) => {
          if (!error && thread) {
            // Emit custom event for message deletion
            const deleteEvent = new CustomEvent('chatMessageDeleted', {
              detail: { 
                messageId: deletedMessage.id, 
                threadId: deletedMessage.thread_id 
              }
            });
            window.dispatchEvent(deleteEvent);
          }
        });
    })
    .subscribe();

  return subscription;
};