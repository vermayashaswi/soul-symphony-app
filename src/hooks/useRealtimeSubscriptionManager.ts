import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionState {
  isConnected: boolean;
  connectionHealth: 'healthy' | 'degraded' | 'disconnected';
  lastHeartbeat: number;
  reconnectAttempts: number;
  subscriptions: Map<string, RealtimeChannel>;
}

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000; // 1 second

export const useRealtimeSubscriptionManager = () => {
  const { toast } = useToast();
  const [state, setState] = useState<SubscriptionState>({
    isConnected: false,
    connectionHealth: 'disconnected',
    lastHeartbeat: 0,
    reconnectAttempts: 0,
    subscriptions: new Map()
  });

  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Check connection health
  const checkConnectionHealth = useCallback((): 'healthy' | 'degraded' | 'disconnected' => {
    const timeSinceHeartbeat = Date.now() - state.lastHeartbeat;
    
    if (timeSinceHeartbeat < HEARTBEAT_INTERVAL * 1.5) {
      return 'healthy';
    } else if (timeSinceHeartbeat < HEARTBEAT_INTERVAL * 3) {
      return 'degraded';
    } else {
      return 'disconnected';
    }
  }, [state.lastHeartbeat]);

  // Send heartbeat to test connection
  const sendHeartbeat = useCallback(async () => {
    try {
      // Create a minimal test subscription to check connectivity
      const testChannel = supabase.channel('heartbeat_test');
      
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Heartbeat timeout')), 5000)
      );

      await Promise.race([
        new Promise((resolve) => {
          testChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              resolve(true);
            }
          });
        }),
        timeout
      ]);

      // Clean up test channel
      supabase.removeChannel(testChannel);

      setState(prev => ({
        ...prev,
        isConnected: true,
        connectionHealth: 'healthy',
        lastHeartbeat: Date.now(),
        reconnectAttempts: 0
      }));

      return true;
    } catch (error) {
      console.warn('[RealtimeManager] Heartbeat failed:', error);
      
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionHealth: 'disconnected'
      }));

      return false;
    }
  }, []);

  // Reconnect with exponential backoff
  const attemptReconnection = useCallback(async () => {
    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[RealtimeManager] Max reconnection attempts reached');
      toast({
        title: "Connection Issue",
        description: "Unable to maintain real-time connection. Some features may be limited.",
        variant: "destructive"
      });
      return false;
    }

    const delay = RECONNECT_DELAY_BASE * Math.pow(2, state.reconnectAttempts);
    console.log(`[RealtimeManager] Attempting reconnection in ${delay}ms (attempt ${state.reconnectAttempts + 1})`);

    setState(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1
    }));

    return new Promise((resolve) => {
      reconnectTimeoutRef.current = setTimeout(async () => {
        const success = await sendHeartbeat();
        resolve(success);
      }, delay);
    });
  }, [state.reconnectAttempts, sendHeartbeat, toast]);

  // Create a managed subscription
  const createSubscription = useCallback((
    channelName: string,
    config: any,
    onMessage?: (payload: any) => void,
    onError?: (error: any) => void
  ): RealtimeChannel | null => {
    try {
      // Remove existing subscription if it exists
      const existingChannel = state.subscriptions.get(channelName);
      if (existingChannel) {
        supabase.removeChannel(existingChannel);
      }

      const channel = supabase.channel(channelName);
      
      // Configure the channel based on config
      if (config.table && config.schema) {
        channel.on('postgres_changes', config, (payload) => {
          console.log(`[RealtimeManager] Message received on ${channelName}:`, payload.eventType);
          onMessage?.(payload);
        });
      }

      // Subscribe with connection monitoring
      channel.subscribe((status) => {
        console.log(`[RealtimeManager] Subscription ${channelName} status:`, status);
        
        if (status === 'SUBSCRIBED') {
          setState(prev => {
            const newSubscriptions = new Map(prev.subscriptions);
            newSubscriptions.set(channelName, channel);
            return {
              ...prev,
              subscriptions: newSubscriptions,
              isConnected: true,
              connectionHealth: 'healthy',
              lastHeartbeat: Date.now()
            };
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[RealtimeManager] Channel error for ${channelName}`);
          onError?.(new Error(`Channel error for ${channelName}`));
          attemptReconnection();
        }
      });

      return channel;
    } catch (error) {
      console.error(`[RealtimeManager] Failed to create subscription ${channelName}:`, error);
      onError?.(error);
      return null;
    }
  }, [state.subscriptions, attemptReconnection]);

  // Remove a subscription
  const removeSubscription = useCallback((channelName: string) => {
    const channel = state.subscriptions.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      setState(prev => {
        const newSubscriptions = new Map(prev.subscriptions);
        newSubscriptions.delete(channelName);
        return {
          ...prev,
          subscriptions: newSubscriptions
        };
      });
      console.log(`[RealtimeManager] Removed subscription: ${channelName}`);
    }
  }, [state.subscriptions]);

  // Clean up all subscriptions
  const cleanupAllSubscriptions = useCallback(() => {
    state.subscriptions.forEach((channel, channelName) => {
      supabase.removeChannel(channel);
      console.log(`[RealtimeManager] Cleaned up subscription: ${channelName}`);
    });
    
    setState(prev => ({
      ...prev,
      subscriptions: new Map()
    }));
  }, [state.subscriptions]);

  // Monitor connection health
  useEffect(() => {
    const startHealthMonitoring = () => {
      heartbeatIntervalRef.current = setInterval(async () => {
        const health = checkConnectionHealth();
        
        if (health === 'disconnected') {
          console.warn('[RealtimeManager] Connection appears disconnected, attempting heartbeat');
          const isHealthy = await sendHeartbeat();
          
          if (!isHealthy) {
            await attemptReconnection();
          }
        }
      }, HEARTBEAT_INTERVAL);
    };

    // Initial heartbeat
    sendHeartbeat().then(() => {
      startHealthMonitoring();
    });

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [checkConnectionHealth, sendHeartbeat, attemptReconnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllSubscriptions();
    };
  }, [cleanupAllSubscriptions]);

  return {
    isConnected: state.isConnected,
    connectionHealth: state.connectionHealth,
    reconnectAttempts: state.reconnectAttempts,
    activeSubscriptions: state.subscriptions.size,
    createSubscription,
    removeSubscription,
    cleanupAllSubscriptions,
    sendHeartbeat
  };
};