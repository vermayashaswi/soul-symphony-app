import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useCircuitBreaker } from './useCircuitBreaker';

interface SessionState {
  id: string | null;
  isActive: boolean;
  startTime: number;
}

interface OptimizedSessionOptions {
  enableDebug?: boolean;
  deferLocationDetection?: boolean;
  skipUTMTracking?: boolean;
}

/**
 * Optimized session tracking hook that prevents blocking the UI thread
 * Key optimizations:
 * - Deferred location detection
 * - Circuit breaker for failed operations
 * - Minimal database calls
 * - Non-blocking session creation
 */
export const useOptimizedSessionTracking = (options: OptimizedSessionOptions = {}) => {
  const {
    enableDebug = false,
    deferLocationDetection = true,
    skipUTMTracking = true
  } = options;

  const { user } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>({
    id: null,
    isActive: false,
    startTime: 0
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const sessionStartedRef = useRef(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Circuit breaker for session operations
  const sessionBreaker = useCircuitBreaker(
    async () => {
      // This will be the actual session creation logic
      return true;
    },
    {
      failureThreshold: 3,
      resetTimeout: 30000, // 30 seconds
      monitorInterval: 5000
    }
  );

  // Fast session creation without blocking operations
  const createLightweightSession = useCallback(async (userId: string) => {
    if (sessionBreaker.isBlocked) {
      if (enableDebug) {
        console.log('[OptimizedSession] Session creation blocked by circuit breaker');
      }
      return null;
    }

    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Create session in background using edge function
      const sessionPromise = supabase.functions.invoke('enhanced-session-manager', {
        body: {
          action: 'create',
          userId,
          deviceType: getSimpleDeviceType(),
          entryPage: window.location.pathname,
          timestamp: Date.now()
        }
      });

      // Don't wait for the response - let it complete in background
      sessionPromise.catch(error => {
        console.warn('[OptimizedSession] Background session creation failed:', error);
      });

      setSessionState({
        id: sessionId,
        isActive: true,
        startTime: Date.now()
      });

      if (enableDebug) {
        console.log('[OptimizedSession] Lightweight session created:', sessionId);
      }

      return sessionId;
    } catch (error) {
      console.error('[OptimizedSession] Error creating session:', error);
      throw error;
    }
  }, [enableDebug, sessionBreaker.isBlocked]);

  // Simple device detection without user agent parsing
  const getSimpleDeviceType = (): string => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  // Deferred operations that don't block initial load
  const runDeferredOperations = useCallback(async (sessionId: string, userId: string) => {
    // Run these operations 5 seconds after session creation
    setTimeout(async () => {
      try {
        const operations = [];

        // Only detect location if enabled and not already cached
        if (!deferLocationDetection) {
          operations.push(detectLocationDeferred());
        }

        // Only extract UTM if enabled
        if (!skipUTMTracking) {
          operations.push(extractUTMDeferred());
        }

        // Run all deferred operations in parallel
        const results = await Promise.allSettled(operations);
        
        if (enableDebug) {
          console.log('[OptimizedSession] Deferred operations completed:', results);
        }

        // Update session with additional data if needed
        if (results.some(r => r.status === 'fulfilled')) {
          supabase.functions.invoke('enhanced-session-manager', {
            body: {
              action: 'update',
              sessionId,
              userId,
              deferredData: results
            }
          }).catch(error => {
            console.warn('[OptimizedSession] Deferred update failed:', error);
          });
        }
      } catch (error) {
        console.warn('[OptimizedSession] Deferred operations failed:', error);
      }
    }, 5000); // 5 second delay
  }, [deferLocationDetection, skipUTMTracking, enableDebug]);

  // Fast location detection with timeout
  const detectLocationDeferred = async (): Promise<any> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ country: 'Unknown', source: 'timeout' });
      }, 3000); // 3 second timeout

      fetch('https://ipapi.co/json/', { 
        method: 'GET',
        signal: AbortSignal.timeout ? AbortSignal.timeout(2000) : undefined
      })
        .then(response => response.json())
        .then(data => {
          clearTimeout(timeout);
          resolve({ country: data.country_code || 'Unknown', source: 'ipapi' });
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve({ country: 'Unknown', source: 'error' });
        });
    });
  };

  // Fast UTM extraction
  const extractUTMDeferred = async (): Promise<any> => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign')
    };
  };

  // Initialize session tracking
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        // Set a 2-second timeout for initialization
        initializationTimeoutRef.current = setTimeout(() => {
          if (!isInitialized) {
            console.warn('[OptimizedSession] Initialization timeout, proceeding anyway');
            setIsInitialized(true);
          }
        }, 2000);

        if (user?.id && !sessionStartedRef.current) {
          const sessionId = await createLightweightSession(user.id);
          
          if (sessionId) {
            sessionStartedRef.current = true;
            
            // Start deferred operations in background
            runDeferredOperations(sessionId, user.id);
          }
        }

        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
        }
        setIsInitialized(true);

      } catch (error) {
        console.error('[OptimizedSession] Initialization failed:', error);
        setIsInitialized(true); // Still mark as initialized to prevent blocking
      }
    };

    if (user?.id) {
      initializeTracking();
    }

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
      }
    };
  }, [user?.id, createLightweightSession, runDeferredOperations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionState.isActive && sessionState.id) {
        // Terminate session in background
        supabase.functions.invoke('enhanced-session-manager', {
          body: {
            action: 'terminate',
            sessionId: sessionState.id,
            userId: user?.id
          }
        }).catch(error => {
          console.warn('[OptimizedSession] Session termination failed:', error);
        });
      }
    };
  }, []);

  return {
    sessionState,
    isInitialized,
    circuitBreakerState: sessionBreaker.state,
    resetCircuitBreaker: sessionBreaker.reset
  };
};