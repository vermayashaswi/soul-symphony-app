import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MessagePersistenceMonitorOptions {
  threadId?: string;
  onMalformedMessage?: (messageId: string, content: string) => void;
  onPersistenceIssue?: (issue: string) => void;
}

/**
 * Hook to monitor and validate message persistence health
 */
export function useMessagePersistenceMonitor({
  threadId,
  onMalformedMessage,
  onPersistenceIssue
}: MessagePersistenceMonitorOptions = {}) {
  const lastCheckRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!threadId) return;

    const checkMessageHealth = async () => {
      try {
        // Check for malformed JSON messages in the thread
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('id, content, sender, created_at')
          .eq('thread_id', threadId)
          .eq('sender', 'assistant')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('[MessageMonitor] Error fetching messages:', error);
          onPersistenceIssue?.('Failed to fetch messages for health check');
          return;
        }

        // Check for JSON content in assistant messages
        const malformedMessages = messages?.filter(msg => {
          if (msg.sender === 'assistant' && msg.content) {
            try {
              // Check if content looks like JSON
              if (msg.content.startsWith('{') && msg.content.includes('"response"')) {
                const parsed = JSON.parse(msg.content);
                return parsed.response && parsed.userStatusMessage;
              }
            } catch {
              // Not JSON, which is good for message content
            }
          }
          return false;
        }) || [];

        // Report malformed messages
        malformedMessages.forEach(msg => {
          console.warn('[MessageMonitor] Malformed JSON message detected:', {
            messageId: msg.id,
            contentPreview: msg.content.substring(0, 100)
          });
          onMalformedMessage?.(msg.id, msg.content);
        });

        // Check message persistence health using database function
        const { data: healthResult, error: healthError } = await supabase
          .rpc('check_message_persistence_health', {
            thread_id_param: threadId
          });

        if (healthError) {
          console.error('[MessageMonitor] Health check failed:', healthError);
          onPersistenceIssue?.('Message persistence health check failed');
        } else if (healthResult) {
          const health = healthResult as any;
          if (!health.is_healthy) {
            console.warn('[MessageMonitor] Thread health issues detected:', health.issues);
            onPersistenceIssue?.(
              `Thread health score: ${health.health_score}/100. Issues: ${health.issues.join(', ')}`
            );
          } else {
            console.log('[MessageMonitor] Thread health check passed:', {
              score: health.health_score,
              totalMessages: health.total_messages
            });
          }
        }

        lastCheckRef.current = new Date();
      } catch (error) {
        console.error('[MessageMonitor] Health check exception:', error);
        onPersistenceIssue?.('Message monitoring error occurred');
      }
    };

    // Initial check
    checkMessageHealth();

    // Periodic health checks every 30 seconds
    const interval = setInterval(checkMessageHealth, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [threadId, onMalformedMessage, onPersistenceIssue]);

  // Function to manually trigger a health check
  const triggerHealthCheck = async () => {
    if (!threadId) return null;

    try {
      const { data, error } = await supabase
        .rpc('check_message_persistence_health', {
          thread_id_param: threadId
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[MessageMonitor] Manual health check failed:', error);
      return null;
    }
  };

  // Function to clean up stuck processing messages
  const cleanupStuckMessages = async () => {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_stuck_processing_messages');

      if (error) throw error;
      
      console.log('[MessageMonitor] Cleanup result:', data);
      return data;
    } catch (error) {
      console.error('[MessageMonitor] Cleanup failed:', error);
      return null;
    }
  };

  return {
    triggerHealthCheck,
    cleanupStuckMessages,
    lastCheck: lastCheckRef.current
  };
}