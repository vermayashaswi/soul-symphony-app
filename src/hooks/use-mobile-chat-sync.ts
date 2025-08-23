import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';

interface MobileChatSyncState {
  isOnline: boolean;
  isRealtimeConnected: boolean;
  lastSyncTime: number;
  pendingSyncMessages: string[];
  connectionRetries: number;
}

interface UseMobileChatSyncOptions {
  threadId: string | null;
  userId: string | null;
  onMessagesSync: (messages: ChatMessage[]) => void;
  onConnectionRecovered: () => void;
  onError: (error: string) => void;
  getCurrentMessageCount?: () => number;
  onProcessingStateCleared?: () => void;
}

export function useMobileChatSync({
  threadId,
  userId,
  onMessagesSync,
  onConnectionRecovered,
  onError,
  getCurrentMessageCount,
  onProcessingStateCleared
}: UseMobileChatSyncOptions) {
  const [syncState, setSyncState] = useState<MobileChatSyncState>({
    isOnline: navigator.onLine,
    isRealtimeConnected: false,
    lastSyncTime: Date.now(),
    pendingSyncMessages: [],
    connectionRetries: 0
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  const connectionHealthRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const pollInterval = 5000; // Poll every 5 seconds when real-time fails
  const healthCheckInterval = 10000; // Check connection health every 10 seconds

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('[MobileChatSync] Device back online');
      setSyncState(prev => ({ ...prev, isOnline: true, connectionRetries: 0 }));
      if (threadId && userId) {
        reconnectRealtime();
        syncMessagesFromDatabase();
      }
    };

    const handleOffline = () => {
      console.log('[MobileChatSync] Device went offline');
      setSyncState(prev => ({ ...prev, isOnline: false, isRealtimeConnected: false }));
      cleanupConnections();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [threadId, userId]);

  // Sync messages from database (fallback mechanism)
  const syncMessagesFromDatabase = useCallback(async () => {
    if (!threadId || !userId || !syncState.isOnline) return;

    try {
      console.log('[MobileChatSync] Syncing messages from database');
      
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[MobileChatSync] Database sync error:', error);
        onError(`Failed to sync messages: ${error.message}`);
        return;
      }

      if (messages && messages.length > 0) {
        const validMessages = messages.filter(msg => !msg.is_processing);
        onMessagesSync(validMessages as ChatMessage[]);
        setSyncState(prev => ({ ...prev, lastSyncTime: Date.now() }));
        console.log(`[MobileChatSync] Synced ${validMessages.length} messages from database`);
      }
    } catch (error) {
      console.error('[MobileChatSync] Sync exception:', error);
      onError('Failed to sync messages from database');
    }
  }, [threadId, userId, syncState.isOnline, onMessagesSync, onError]);

  // Setup real-time subscription with health monitoring
  const setupRealtimeSubscription = useCallback(() => {
    if (!threadId || !syncState.isOnline) return;

    console.log('[MobileChatSync] Setting up real-time subscription');
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`mobile-sync-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`
      }, (payload) => {
        const message = payload.new as ChatMessage;
        console.log('[MobileChatSync] Real-time INSERT:', message.sender);
        
        if (!message.is_processing) {
          onMessagesSync([message]);
          setSyncState(prev => ({ 
            ...prev, 
            lastSyncTime: Date.now(),
            pendingSyncMessages: prev.pendingSyncMessages.filter(id => id !== message.id)
          }));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`
      }, (payload) => {
        const message = payload.new as ChatMessage;
        console.log('[MobileChatSync] Real-time UPDATE:', message.sender);
        
        if (!message.is_processing) {
          onMessagesSync([message]);
          setSyncState(prev => ({ 
            ...prev, 
            lastSyncTime: Date.now(),
            pendingSyncMessages: prev.pendingSyncMessages.filter(id => id !== message.id)
          }));
        }
      })
      .subscribe((status) => {
        console.log('[MobileChatSync] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setSyncState(prev => ({ 
            ...prev, 
            isRealtimeConnected: true, 
            connectionRetries: 0 
          }));
          onConnectionRecovered();
          
          // Stop polling when real-time is working
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setSyncState(prev => ({ ...prev, isRealtimeConnected: false }));
          startPollingFallback();
        }
      });

    realtimeChannelRef.current = channel;

    // Start connection health monitoring
    startConnectionHealthCheck();
  }, [threadId, syncState.isOnline, onMessagesSync, onConnectionRecovered]);

  // Start polling as fallback when real-time fails
  const startPollingFallback = useCallback(() => {
    if (pollIntervalRef.current || !threadId || !userId) return;

    console.log('[MobileChatSync] Starting polling fallback');
    
    pollIntervalRef.current = setInterval(() => {
      if (syncState.isOnline && !syncState.isRealtimeConnected) {
        syncMessagesFromDatabase();
      }
    }, pollInterval);
  }, [threadId, userId, syncState.isOnline, syncState.isRealtimeConnected, syncMessagesFromDatabase]);

  // Monitor connection health and retry if needed
  const startConnectionHealthCheck = useCallback(() => {
    if (connectionHealthRef.current) {
      clearInterval(connectionHealthRef.current);
    }

    connectionHealthRef.current = setInterval(() => {
      const timeSinceLastSync = Date.now() - syncState.lastSyncTime;
      
      // Much longer timeout - only trigger if truly disconnected for 2+ minutes 
      if (timeSinceLastSync > 120000 && syncState.isOnline && syncState.connectionRetries < maxRetries) {
        console.log('[MobileChatSync] Connection health check failed after 2 minutes, reconnecting...');
        setSyncState(prev => ({ ...prev, connectionRetries: prev.connectionRetries + 1 }));
        reconnectRealtime();
      }
    }, healthCheckInterval * 2); // Check less frequently
  }, [syncState.lastSyncTime, syncState.isOnline, syncState.connectionRetries]);

  // Reconnect real-time subscription
  const reconnectRealtime = useCallback(() => {
    console.log('[MobileChatSync] Reconnecting real-time...');
    cleanupConnections();
    
    setTimeout(() => {
      setupRealtimeSubscription();
      syncMessagesFromDatabase(); // Immediate sync on reconnect
    }, 1000);
  }, [setupRealtimeSubscription, syncMessagesFromDatabase]);

  // Clean up all connections
  const cleanupConnections = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    if (connectionHealthRef.current) {
      clearInterval(connectionHealthRef.current);
      connectionHealthRef.current = null;
    }
  }, []);

  // Setup subscription when thread changes
  useEffect(() => {
    if (threadId && userId && syncState.isOnline) {
      setupRealtimeSubscription();
      syncMessagesFromDatabase(); // Initial sync
    } else {
      cleanupConnections();
    }

    return cleanupConnections;
  }, [threadId, userId, syncState.isOnline]);

  // Check for missing messages and clear stale processing states
  const checkForMissedMessages = useCallback(async () => {
    if (!threadId || !userId) return;

    try {
      console.log('[MobileChatSync] Checking for missed messages...');
      
      // Get current messages count from state
      const currentMessageCount = getCurrentMessageCount?.() || 0;
      
      // Query database for actual message count
      const { count: dbMessageCount, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId);

      if (error) {
        console.error('[MobileChatSync] Error checking message count:', error);
        return;
      }

      // If database has more messages than UI, sync them
      if (dbMessageCount && dbMessageCount > currentMessageCount) {
        console.log(`[MobileChatSync] Found ${dbMessageCount - currentMessageCount} missed messages, syncing...`);
        await syncMessagesFromDatabase();
        
        // Clear any stale processing states
        onProcessingStateCleared?.();
      }
    } catch (error) {
      console.error('[MobileChatSync] Error in checkForMissedMessages:', error);
    }
  }, [threadId, userId, getCurrentMessageCount, onProcessingStateCleared, syncMessagesFromDatabase]);

  // Force sync function for manual recovery
  const forceSyncMessages = useCallback(async () => {
    console.log('[MobileChatSync] Force syncing messages...');
    await syncMessagesFromDatabase();
    await checkForMissedMessages();
    
    if (!syncState.isRealtimeConnected && syncState.isOnline) {
      reconnectRealtime();
    }
  }, [syncMessagesFromDatabase, checkForMissedMessages, syncState.isRealtimeConnected, syncState.isOnline, reconnectRealtime]);

  // Add message to pending sync list
  const addPendingSyncMessage = useCallback((messageId: string) => {
    setSyncState(prev => ({
      ...prev,
      pendingSyncMessages: [...prev.pendingSyncMessages, messageId]
    }));
  }, []);

  return {
    ...syncState,
    forceSyncMessages,
    addPendingSyncMessage,
    reconnectRealtime,
    checkForMissedMessages
  };
}