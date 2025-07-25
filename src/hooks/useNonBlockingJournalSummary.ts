import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCircuitBreaker } from './useCircuitBreaker';

interface SummaryData {
  summary: string | null;
  topEntities: Array<{ name: string; count: number; type?: string }>;
  hasEntries: boolean;
  entryCount?: number;
  cached?: boolean;
  processingTime?: number;
}

interface SummaryState {
  data: SummaryData | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}

/**
 * Non-blocking journal summary hook that prevents UI freezing
 * Key optimizations:
 * - Circuit breaker for failed requests
 * - Local caching with expiration
 * - Background fetch with immediate fallback
 * - Timeout protection
 */
export const useNonBlockingJournalSummary = (days: number = 7) => {
  const { user } = useAuth();
  const [state, setState] = useState<SummaryState>({
    data: null,
    loading: false,
    error: null,
    fromCache: false
  });

  // Circuit breaker for summary requests
  const summaryBreaker = useCircuitBreaker(
    async () => {
      if (!user?.id) throw new Error('No user ID');
      
      const { data, error } = await supabase.functions.invoke('journal-summary', {
        body: { userId: user.id, days }
      });
      
      if (error) throw error;
      return data;
    },
    {
      failureThreshold: 2,
      resetTimeout: 60000, // 1 minute
      monitorInterval: 10000
    }
  );

  // Cache key for local storage
  const getCacheKey = useCallback((userId: string, days: number) => {
    return `journal_summary_${userId}_${days}d`;
  }, []);

  // Get cached summary
  const getCachedSummary = useCallback((userId: string, days: number): SummaryData | null => {
    try {
      const cacheKey = getCacheKey(userId, days);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        const cacheAge = now - parsed.timestamp;
        
        // Cache valid for 1 hour
        if (cacheAge < 3600000) {
          return parsed.data;
        } else {
          // Remove expired cache
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('[NonBlockingSummary] Cache read failed:', error);
    }
    return null;
  }, [getCacheKey]);

  // Cache summary data
  const cacheSummary = useCallback((userId: string, days: number, data: SummaryData) => {
    try {
      const cacheKey = getCacheKey(userId, days);
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[NonBlockingSummary] Cache write failed:', error);
    }
  }, [getCacheKey]);

  // Get fallback summary
  const getFallbackSummary = useCallback((entryCount: number = 0): SummaryData => {
    return {
      summary: entryCount > 0 
        ? `Reflecting on ${entryCount} journal entries from the past ${days} days.`
        : "Ready to start your journaling journey.",
      topEntities: [],
      hasEntries: entryCount > 0,
      entryCount,
      cached: false
    };
  }, [days]);

  // Fetch summary with optimizations
  const fetchSummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Check cache first
      const cached = getCachedSummary(user.id, days);
      if (cached) {
        setState({
          data: cached,
          loading: false,
          error: null,
          fromCache: true
        });
        return;
      }

      // If circuit breaker is open, use fallback immediately
      if (summaryBreaker.isBlocked) {
        const fallback = getFallbackSummary();
        setState({
          data: fallback,
          loading: false,
          error: 'Service temporarily unavailable',
          fromCache: false
        });
        return;
      }

      // Try to fetch from server with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Summary request timeout')), 3000);
      });

      try {
        const data = await Promise.race([
          summaryBreaker.execute(),
          timeoutPromise
        ]);

        // Cache successful response
        if (data) {
          cacheSummary(user.id, days, data);
          setState({
            data,
            loading: false,
            error: null,
            fromCache: false
          });
        } else {
          throw new Error('No data received');
        }

      } catch (fetchError) {
        console.warn('[NonBlockingSummary] Fetch failed, using fallback:', fetchError);
        
        // Get entry count for better fallback
        let entryCount = 0;
        try {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - days);
          
          const { count } = await supabase
            .from('Journal Entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo.toISOString());
          
          entryCount = count || 0;
        } catch (countError) {
          console.warn('[NonBlockingSummary] Entry count failed:', countError);
        }

        const fallback = getFallbackSummary(entryCount);
        setState({
          data: fallback,
          loading: false,
          error: fetchError instanceof Error ? fetchError.message : 'Failed to load summary',
          fromCache: false
        });
      }

    } catch (error) {
      console.error('[NonBlockingSummary] Unexpected error:', error);
      const fallback = getFallbackSummary();
      setState({
        data: fallback,
        loading: false,
        error: 'Unexpected error',
        fromCache: false
      });
    }
  }, [user?.id, days, getCachedSummary, summaryBreaker, getFallbackSummary, cacheSummary]);

  // Refresh summary
  const refreshSummary = useCallback(() => {
    if (user?.id) {
      // Clear cache
      const cacheKey = getCacheKey(user.id, days);
      localStorage.removeItem(cacheKey);
      
      // Reset circuit breaker if needed
      if (summaryBreaker.state === 'OPEN') {
        summaryBreaker.reset();
      }
      
      fetchSummary();
    }
  }, [user?.id, days, getCacheKey, summaryBreaker, fetchSummary]);

  // Auto-fetch on user/days change
  useEffect(() => {
    if (user?.id) {
      fetchSummary();
    }
  }, [user?.id, days, fetchSummary]);

  return {
    ...state,
    refreshSummary,
    circuitBreakerState: summaryBreaker.state,
    resetCircuitBreaker: summaryBreaker.reset
  };
};