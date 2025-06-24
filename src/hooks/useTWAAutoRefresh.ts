
import { useEffect, useRef, useState } from 'react';
import { detectTWAEnvironment } from '@/utils/twaDetection';

interface AutoRefreshState {
  isStuckDetected: boolean;
  refreshCount: number;
  lastRefreshTime: number;
}

const MAX_REFRESH_ATTEMPTS = 2;
const STUCK_DETECTION_TIMEOUT = 12000; // 12 seconds
const MIN_REFRESH_INTERVAL = 5000; // 5 seconds between refreshes

export const useTWAAutoRefresh = () => {
  const [refreshState, setRefreshState] = useState<AutoRefreshState>({
    isStuckDetected: false,
    refreshCount: 0,
    lastRefreshTime: 0
  });
  
  const stuckDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationStartTimeRef = useRef<number>(0);
  const twaEnv = detectTWAEnvironment();

  // Start monitoring for stuck loader
  const startStuckDetection = () => {
    if (!twaEnv.isTWA && !twaEnv.isStandalone) return;
    
    initializationStartTimeRef.current = Date.now();
    console.log('[TWA AutoRefresh] Starting stuck detection monitoring');
    
    // Clear any existing timeout
    if (stuckDetectionTimeoutRef.current) {
      clearTimeout(stuckDetectionTimeoutRef.current);
    }
    
    stuckDetectionTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastRefresh = now - refreshState.lastRefreshTime;
      
      // Only trigger if we haven't refreshed recently and haven't exceeded max attempts
      if (timeSinceLastRefresh > MIN_REFRESH_INTERVAL && refreshState.refreshCount < MAX_REFRESH_ATTEMPTS) {
        console.log('[TWA AutoRefresh] Stuck loader detected, triggering automatic refresh');
        triggerAutoRefresh();
      } else if (refreshState.refreshCount >= MAX_REFRESH_ATTEMPTS) {
        console.warn('[TWA AutoRefresh] Max refresh attempts reached, stopping auto-refresh');
        setRefreshState(prev => ({ ...prev, isStuckDetected: true }));
      }
    }, STUCK_DETECTION_TIMEOUT);
  };

  // Stop monitoring
  const stopStuckDetection = () => {
    console.log('[TWA AutoRefresh] Stopping stuck detection monitoring');
    if (stuckDetectionTimeoutRef.current) {
      clearTimeout(stuckDetectionTimeoutRef.current);
      stuckDetectionTimeoutRef.current = null;
    }
  };

  // Trigger automatic refresh
  const triggerAutoRefresh = () => {
    const now = Date.now();
    
    setRefreshState(prev => ({
      isStuckDetected: true,
      refreshCount: prev.refreshCount + 1,
      lastRefreshTime: now
    }));
    
    console.log('[TWA AutoRefresh] Executing automatic refresh attempt', refreshState.refreshCount + 1);
    
    // Add a small delay to ensure state is updated before refresh
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Reset refresh state when initialization completes successfully
  const resetRefreshState = () => {
    console.log('[TWA AutoRefresh] Resetting refresh state - initialization successful');
    setRefreshState({
      isStuckDetected: false,
      refreshCount: 0,
      lastRefreshTime: 0
    });
    stopStuckDetection();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stuckDetectionTimeoutRef.current) {
        clearTimeout(stuckDetectionTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...refreshState,
    startStuckDetection,
    stopStuckDetection,
    resetRefreshState,
    triggerAutoRefresh,
    isTWAEnvironment: twaEnv.isTWA || twaEnv.isStandalone
  };
};
