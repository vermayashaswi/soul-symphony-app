import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

interface MessageCache {
  [threadId: string]: {
    messages: ChatMessage[];
    lastSync: number;
    version: number;
  };
}

interface PersistenceState {
  cache: MessageCache;
  pendingMessages: Map<string, ChatMessage>;
  integrityChecks: Map<string, number>;
  syncStatus: Map<string, 'synced' | 'syncing' | 'failed'>;
}

const CACHE_VALIDITY_MS = 30000; // 30 seconds
const INTEGRITY_CHECK_INTERVAL = 60000; // 1 minute
const WATCHDOG_TIMEOUT = 3000; // Extended from 500ms to 3s

export const useMessagePersistenceReliability = (userId?: string) => {
  const { toast } = useToast();
  const [state, setState] = useState<PersistenceState>({
    cache: {},
    pendingMessages: new Map(),
    integrityChecks: new Map(),
    syncStatus: new Map()
  });

  // Cache messages with versioning
  const cacheMessages = useCallback((threadId: string, messages: ChatMessage[]) => {
    setState(prev => ({
      ...prev,
      cache: {
        ...prev.cache,
        [threadId]: {
          messages,
          lastSync: Date.now(),
          version: (prev.cache[threadId]?.version || 0) + 1
        }
      },
      syncStatus: new Map(prev.syncStatus).set(threadId, 'synced')
    }));

    // Store in localStorage as backup
    try {
      localStorage.setItem(`chat_cache_${threadId}`, JSON.stringify({
        messages,
        lastSync: Date.now(),
        userId
      }));
    } catch (error) {
      console.warn('[MessagePersistence] Failed to cache to localStorage:', error);
    }
  }, [userId]);

  // Restore from cache if available
  const restoreFromCache = useCallback((threadId: string): ChatMessage[] | null => {
    // Check memory cache first
    const cached = state.cache[threadId];
    if (cached && (Date.now() - cached.lastSync) < CACHE_VALIDITY_MS) {
      console.log('[MessagePersistence] Restored from memory cache:', threadId);
      return cached.messages;
    }

    // Try localStorage backup
    try {
      const stored = localStorage.getItem(`chat_cache_${threadId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.userId === userId && (Date.now() - parsed.lastSync) < CACHE_VALIDITY_MS * 2) {
          console.log('[MessagePersistence] Restored from localStorage cache:', threadId);
          return parsed.messages;
        }
      }
    } catch (error) {
      console.warn('[MessagePersistence] Failed to restore from localStorage:', error);
    }

    return null;
  }, [state.cache, userId]);

  // Enhanced message fetching with retry logic
  const fetchMessagesWithRetry = useCallback(async (
    threadId: string,
    maxRetries: number = 3
  ): Promise<ChatMessage[]> => {
    if (!userId) {
      console.error('[MessagePersistence] User ID required for fetching messages');
      return [];
    }

    setState(prev => ({
      ...prev,
      syncStatus: new Map(prev.syncStatus).set(threadId, 'syncing')
    }));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[MessagePersistence] Fetching messages for ${threadId}, attempt ${attempt}`);

        // Verify thread ownership first
        const { data: thread, error: threadError } = await supabase
          .from('chat_threads')
          .select('id')
          .eq('id', threadId)
          .eq('user_id', userId)
          .single();

        if (threadError || !thread) {
          console.error('[MessagePersistence] Thread verification failed:', threadError);
          setState(prev => ({
            ...prev,
            syncStatus: new Map(prev.syncStatus).set(threadId, 'failed')
          }));
          return [];
        }

        // Fetch messages with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);

        if (error) {
          console.error(`[MessagePersistence] Fetch attempt ${attempt} failed:`, error);
          if (attempt === maxRetries) {
            setState(prev => ({
              ...prev,
              syncStatus: new Map(prev.syncStatus).set(threadId, 'failed')
            }));
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        const messages: ChatMessage[] = (data || []).map(msg => ({
          ...msg,
          sender: msg.sender as 'user' | 'assistant' | 'error',
          role: msg.role as 'user' | 'assistant' | 'error',
          sub_query_responses: Array.isArray(msg.sub_query_responses) ? msg.sub_query_responses : []
        }));

        console.log(`[MessagePersistence] Successfully fetched ${messages.length} messages for ${threadId}`);
        cacheMessages(threadId, messages);
        return messages;

      } catch (error) {
        console.error(`[MessagePersistence] Fetch attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          setState(prev => ({
            ...prev,
            syncStatus: new Map(prev.syncStatus).set(threadId, 'failed')
          }));
          
          // Try to restore from cache as fallback
          const cached = restoreFromCache(threadId);
          if (cached) {
            toast({
              title: "Connection Issue",
              description: "Showing cached messages. Some recent messages may be missing.",
              variant: "destructive"
            });
            return cached;
          }
          
          return [];
        }
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    return [];
  }, [userId, cacheMessages, restoreFromCache, toast]);

  // Message existence validation
  const validateMessageExists = useCallback(async (
    messageId: string,
    threadId: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('id', messageId)
        .eq('thread_id', threadId)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('[MessagePersistence] Message validation failed:', error);
      return false;
    }
  }, []);

  // Integrity verification for thread messages
  const verifyMessageIntegrity = useCallback(async (threadId: string): Promise<boolean> => {
    try {
      const cached = state.cache[threadId];
      if (!cached) return true; // No cache to verify

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[MessagePersistence] Integrity check failed:', error);
        return false;
      }

      const dbMessageIds = (data || []).map(m => m.id);
      const cachedMessageIds = cached.messages.map(m => m.id);

      // Check if all cached messages exist in DB
      const missingFromDb = cachedMessageIds.filter(id => !dbMessageIds.includes(id));
      const missingFromCache = dbMessageIds.filter(id => !cachedMessageIds.includes(id));

      if (missingFromDb.length > 0 || missingFromCache.length > 0) {
        console.warn('[MessagePersistence] Integrity mismatch detected:', {
          threadId,
          missingFromDb: missingFromDb.length,
          missingFromCache: missingFromCache.length
        });
        
        // Re-fetch messages to fix inconsistency
        await fetchMessagesWithRetry(threadId);
        return false;
      }

      setState(prev => ({
        ...prev,
        integrityChecks: new Map(prev.integrityChecks).set(threadId, Date.now())
      }));

      return true;
    } catch (error) {
      console.error('[MessagePersistence] Integrity verification error:', error);
      return false;
    }
  }, [state.cache, fetchMessagesWithRetry]);

  // Enhanced watchdog with longer timeout and better error handling
  const createMessageWatchdog = useCallback((
    messageId: string,
    threadId: string,
    onFailure: () => void
  ) => {
    const timeoutId = setTimeout(async () => {
      console.warn(`[MessagePersistence] Watchdog timeout for message ${messageId} in thread ${threadId}`);
      
      // Check if message actually exists
      const exists = await validateMessageExists(messageId, threadId);
      if (!exists) {
        console.error(`[MessagePersistence] Message ${messageId} not found in database`);
        onFailure();
      } else {
        console.log(`[MessagePersistence] Message ${messageId} exists, may be a sync delay`);
        // Trigger a fresh fetch to update the UI
        await fetchMessagesWithRetry(threadId);
      }
    }, WATCHDOG_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, [validateMessageExists, fetchMessagesWithRetry]);

  // Periodic integrity checks
  useEffect(() => {
    if (!userId) return;

    const intervalId = setInterval(async () => {
      const threadsToCheck = Object.keys(state.cache);
      for (const threadId of threadsToCheck) {
        const lastCheck = state.integrityChecks.get(threadId) || 0;
        if (Date.now() - lastCheck > INTEGRITY_CHECK_INTERVAL) {
          await verifyMessageIntegrity(threadId);
        }
      }
    }, INTEGRITY_CHECK_INTERVAL / 2);

    return () => clearInterval(intervalId);
  }, [userId, state.cache, state.integrityChecks, verifyMessageIntegrity]);

  return {
    fetchMessagesWithRetry,
    cacheMessages,
    restoreFromCache,
    validateMessageExists,
    verifyMessageIntegrity,
    createMessageWatchdog,
    syncStatus: state.syncStatus,
    hasCachedMessages: (threadId: string) => !!state.cache[threadId]
  };
};