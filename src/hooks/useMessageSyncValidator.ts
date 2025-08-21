import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { messageLifecycleTracker } from '@/services/chat/messageLifecycleTracker';

interface UseMessageSyncValidatorProps {
  threadId: string | null;
  messages: any[];
  onMissingMessagesDetected: (missingMessages: any[]) => void;
}

export const useMessageSyncValidator = ({
  threadId,
  messages,
  onMissingMessagesDetected
}: UseMessageSyncValidatorProps) => {
  
  // Validate message consistency periodically
  const validateConsistency = useCallback(async () => {
    if (!threadId) return;
    
    try {
      console.log(`[MessageSyncValidator] Validating consistency for thread: ${threadId}`);
      
      // Get all messages from database
      const { data: dbMessages, error } = await supabase
        .from('chat_messages')
        .select('id, content, sender, created_at, analysis_data')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error(`[MessageSyncValidator] Error fetching messages:`, error);
        return;
      }
      
      if (!dbMessages) return;
      
      // Find messages in DB that aren't in UI
      const missingInUI = dbMessages.filter(dbMsg => {
        return !messages.some(uiMsg => {
          // Match by content for assistant messages, or by rough content match
          if (dbMsg.sender === 'assistant') {
            return uiMsg.role === 'assistant' && 
                   uiMsg.content && 
                   uiMsg.content.trim() === dbMsg.content.trim();
          } else {
            return uiMsg.role === 'user' && 
                   uiMsg.content && 
                   uiMsg.content.trim() === dbMsg.content.trim();
          }
        });
      });
      
      if (missingInUI.length > 0) {
        console.warn(`[MessageSyncValidator] Found ${missingInUI.length} messages missing from UI:`, missingInUI);
        
        // Track in lifecycle tracker
        await messageLifecycleTracker.validateThreadConsistency(threadId, messages);
        
        // Notify parent component
        onMissingMessagesDetected(missingInUI);
      } else {
        console.log(`[MessageSyncValidator] Thread ${threadId} is consistent (${dbMessages.length} messages)`);
      }
      
    } catch (error) {
      console.error(`[MessageSyncValidator] Error during validation:`, error);
    }
  }, [threadId, messages, onMissingMessagesDetected]);
  
  // Listen for sync requests
  useEffect(() => {
    const handleSyncRequest = (event: CustomEvent) => {
      if (event.detail.threadId === threadId) {
        console.log(`[MessageSyncValidator] Sync requested for thread: ${threadId}`);
        validateConsistency();
      }
    };
    
    window.addEventListener('syncMissingMessages' as any, handleSyncRequest);
    
    return () => {
      window.removeEventListener('syncMissingMessages' as any, handleSyncRequest);
    };
  }, [threadId, validateConsistency]);
  
  // Periodic validation (every 30 seconds)
  useEffect(() => {
    if (!threadId) return;
    
    const interval = setInterval(() => {
      validateConsistency();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [threadId, validateConsistency]);
  
  // Validate on messages change (with debounce)
  useEffect(() => {
    if (!threadId || messages.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      validateConsistency();
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [threadId, messages.length, validateConsistency]);
  
  return {
    validateConsistency,
    getThreadReport: () => messageLifecycleTracker.getThreadReport(threadId || ''),
  };
};