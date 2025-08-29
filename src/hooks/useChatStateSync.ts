import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChatStateSyncOptions {
  threadId: string | null;
  onStateSync: (reason: string) => void;
  enabled?: boolean;
}

/**
 * Enhanced hook for managing chat state synchronization
 * Handles missed messages and ensures UI consistency when users return
 */
export const useChatStateSync = ({ threadId, onStateSync, enabled = true }: ChatStateSyncOptions) => {
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);
  
  // Debounced sync function to prevent excessive reloads
  const triggerSync = (reason: string, delay: number = 300) => {
    if (!enabled || !threadId) return;
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Prevent sync spam - minimum 1 second between syncs
      if (now - lastSyncRef.current > 1000) {
        lastSyncRef.current = now;
        onStateSync(reason);
      }
    }, delay);
  };

  // Check for completion state on page visibility change
  useEffect(() => {
    if (!enabled) return;
    
    const handleVisibilityChange = () => {
      if (!document.hidden && threadId) {
        console.log('[ChatStateSync] Page became visible, checking for missed messages');
        triggerSync('page_visibility_change', 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [threadId, enabled, onStateSync]);

  // Enhanced message completion detection
  useEffect(() => {
    if (!enabled || !threadId) return;

    const checkForCompletedResponses = async () => {
      try {
        // Check if there are any recently completed assistant messages
        const { data: recentMessages } = await supabase
          .from('chat_messages')
          .select('id, sender, created_at')
          .eq('thread_id', threadId)
          .eq('sender', 'assistant')
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentMessages && recentMessages.length > 0) {
          const latestMessage = recentMessages[0];
          const messageAge = Date.now() - new Date(latestMessage.created_at).getTime();
          
          // If we have a recent assistant message (within last 30 seconds), sync immediately
          if (messageAge < 30000) {
            console.log('[ChatStateSync] Recent assistant message detected, syncing state');
            triggerSync('recent_assistant_message', 100);
          }
        }
      } catch (error) {
        console.warn('[ChatStateSync] Failed to check for completed responses:', error);
      }
    };

    // Run initial check
    checkForCompletedResponses();
    
    // Set up interval to periodically check for missed completions
    const interval = setInterval(checkForCompletedResponses, 5000);
    
    return () => clearInterval(interval);
  }, [threadId, enabled]);

  return {
    triggerSync
  };
};