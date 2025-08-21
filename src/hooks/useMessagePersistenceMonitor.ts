import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MessagePersistenceMonitorOptions {
  threadId?: string;
  onMalformedMessage?: (messageId: string, content: string) => void;
  onPersistenceIssue?: (threadId: string, issues: string[]) => void;
}

interface PersistenceHealthStatus {
  isHealthy: boolean;
  healthScore: number;
  issues: string[];
  lastCheck: Date | null;
}

export const useMessagePersistenceMonitor = (options: MessagePersistenceMonitorOptions = {}) => {
  const { threadId, onMalformedMessage, onPersistenceIssue } = options;
  const lastCheck = useRef<Date | null>(null);
  const [healthStatus, setHealthStatus] = useState<PersistenceHealthStatus>({
    isHealthy: true,
    healthScore: 100,
    issues: [],
    lastCheck: null
  });

  const checkMessageHealth = async () => {
    if (!threadId) return;
    
    try {
      console.log(`[MessagePersistenceMonitor] Checking health for thread: ${threadId}`);
      
      // Use the new message persistence monitor function
      const { data: healthResult, error } = await supabase.functions.invoke('message-persistence-monitor', {
        body: {
          threadId,
          action: 'check'
        }
      });
      
      if (error) {
        console.error('[MessagePersistenceMonitor] Error checking thread health:', error);
        setHealthStatus(prev => ({
          ...prev,
          isHealthy: false,
          issues: ['Health check failed'],
          lastCheck: new Date()
        }));
        return;
      }
      
      if (healthResult) {
        const newHealthStatus = {
          isHealthy: healthResult.isHealthy,
          healthScore: healthResult.healthScore,
          issues: healthResult.issues || [],
          lastCheck: new Date()
        };
        
        setHealthStatus(newHealthStatus);
        
        // Check for malformed assistant messages
        const { data: recentMessages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, content, sender')
          .eq('thread_id', threadId)
          .eq('sender', 'assistant')
          .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (!messagesError && recentMessages) {
          for (const message of recentMessages) {
            if (message.content && 
                message.content.includes('"response"') && 
                message.content.includes('"userStatusMessage"') &&
                message.content.startsWith('{')) {
              console.warn(`[MessagePersistenceMonitor] Found malformed message: ${message.id}`);
              onMalformedMessage?.(message.id, message.content);
            }
          }
        }
        
        if (!healthResult.isHealthy && healthResult.issues?.length > 0) {
          console.warn(`[MessagePersistenceMonitor] Thread health issues:`, healthResult.issues);
          onPersistenceIssue?.(threadId, healthResult.issues);
        }
      }
      
      lastCheck.current = new Date();
      console.log(`[MessagePersistenceMonitor] Health check completed for thread: ${threadId}`, healthResult);
      
    } catch (error) {
      console.error('[MessagePersistenceMonitor] Exception during health check:', error);
      setHealthStatus(prev => ({
        ...prev,
        isHealthy: false,
        issues: ['Exception during health check'],
        lastCheck: new Date()
      }));
    }
  };

  useEffect(() => {
    if (!threadId) return;

    // Initial check
    checkMessageHealth();

    // Periodic checks every 30 seconds
    const interval = setInterval(checkMessageHealth, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [threadId]);

  const recoverMissingResponse = async (messageId: string) => {
    if (!threadId) return { success: false, error: 'No thread ID' };
    
    try {
      const { data, error } = await supabase.functions.invoke('message-persistence-monitor', {
        body: {
          threadId,
          messageId,
          action: 'recover'
        }
      });
      
      if (error) {
        console.error('[MessagePersistenceMonitor] Recovery error:', error);
        return { success: false, error: error.message };
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('[MessagePersistenceMonitor] Recovery exception:', error);
      return { success: false, error: (error as Error).message };
    }
  };

  return {
    healthStatus,
    
    triggerHealthCheck: async (targetThreadId?: string) => {
      const checkThreadId = targetThreadId || threadId;
      if (!checkThreadId) return { success: false, error: 'No thread ID' };
      
      try {
        const { data, error } = await supabase.functions.invoke('message-persistence-monitor', {
          body: {
            threadId: checkThreadId,
            action: 'check'
          }
        });
        
        if (error) {
          console.error('[MessagePersistenceMonitor] Manual health check error:', error);
          return { success: false, error: error.message };
        }
        
        return { success: true, data };
      } catch (error) {
        console.error('[MessagePersistenceMonitor] Manual health check exception:', error);
        return { success: false, error: (error as Error).message };
      }
    },
    
    cleanupStuckMessages: async () => {
      if (!threadId) return { success: false, error: 'No thread ID' };
      
      try {
        const { data, error } = await supabase.functions.invoke('message-persistence-monitor', {
          body: {
            threadId,
            action: 'cleanup'
          }
        });
        
        if (error) {
          console.error('[MessagePersistenceMonitor] Cleanup error:', error);
          return { success: false, error: error.message };
        }
        
        return { success: true, data };
      } catch (error) {
        console.error('[MessagePersistenceMonitor] Cleanup exception:', error);
        return { success: false, error: (error as Error).message };
      }
    },
    
    recoverMissingResponse,
    lastCheck
  };
};