import { useEffect, useCallback, useRef } from 'react';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';

interface TouchPosition {
  x: number;
  y: number;
  timestamp: number;
}

interface NotificationPanelDetectorOptions {
  onNotificationPanelClosed?: () => void;
  topThreshold?: number;
  swipeThreshold?: number;
  debounceMs?: number;
}

/**
 * Hook to detect notification panel gestures and trigger immediate status bar hide
 */
export const useNotificationPanelDetector = (options: NotificationPanelDetectorOptions = {}) => {
  const {
    onNotificationPanelClosed,
    topThreshold = 50,
    swipeThreshold = 100,
    debounceMs = 300
  } = options;

  const touchStartRef = useRef<TouchPosition | null>(null);
  const touchMoveRef = useRef<TouchPosition | null>(null);
  const lastHideTimeRef = useRef<number>(0);
  const panelOpenRef = useRef<boolean>(false);

  const hideStatusBarImmediately = useCallback(async () => {
    const now = Date.now();
    
    // Debounce to prevent excessive calls
    if (now - lastHideTimeRef.current < debounceMs) {
      return;
    }
    
    lastHideTimeRef.current = now;
    
    if (nativeIntegrationService.isRunningNatively()) {
      try {
        console.log('[NotificationPanelDetector] Hiding status bar immediately');
        
        await nativeIntegrationService.hideStatusBar();
        
        const statusBarPlugin = nativeIntegrationService.getPlugin('StatusBar');
        if (statusBarPlugin) {
          await statusBarPlugin.setOverlaysWebView({ overlay: true });
          await statusBarPlugin.setStyle({ style: 'dark' });
        }
        
        onNotificationPanelClosed?.();
      } catch (error) {
        console.warn('[NotificationPanelDetector] Failed to hide status bar:', error);
      }
    }
  }, [onNotificationPanelClosed, debounceMs]);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;

    const position: TouchPosition = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    touchStartRef.current = position;
    
    // Detect potential notification panel pull from top edge
    if (position.y <= topThreshold) {
      console.log('[NotificationPanelDetector] Touch detected near top edge');
    }
  }, [topThreshold]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || !touchStartRef.current) return;

    const position: TouchPosition = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    touchMoveRef.current = position;

    // Detect downward swipe from top that indicates notification panel opening
    const deltaY = position.y - touchStartRef.current.y;
    const deltaTime = position.timestamp - touchStartRef.current.timestamp;

    if (
      touchStartRef.current.y <= topThreshold && 
      deltaY > swipeThreshold && 
      deltaTime < 1000
    ) {
      panelOpenRef.current = true;
      console.log('[NotificationPanelDetector] Notification panel opened');
    }
  }, [topThreshold, swipeThreshold]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!touchStartRef.current) {
      touchStartRef.current = null;
      touchMoveRef.current = null;
      return;
    }

    const endTime = Date.now();
    const totalTime = endTime - touchStartRef.current.timestamp;
    const startedFromTop = touchStartRef.current.y <= topThreshold;

    // Check if there was movement (swipe) or just a tap
    if (touchMoveRef.current) {
      const totalDeltaY = touchMoveRef.current.y - touchStartRef.current.y;
      
      // Detect upward swipe that closes the notification panel
      const isUpwardSwipe = totalDeltaY < -50;
      const isFastSwipe = totalTime < 1000;

      if (panelOpenRef.current && isUpwardSwipe && isFastSwipe && startedFromTop) {
        console.log('[NotificationPanelDetector] Notification panel closed via swipe gesture');
        hideStatusBarImmediately();
      }
    } else {
      // Handle tap-to-close gesture (no movement detected)
      const isTap = totalTime < 500; // Quick tap
      
      if (panelOpenRef.current && isTap && startedFromTop) {
        console.log('[NotificationPanelDetector] Notification panel closed via tap gesture');
        hideStatusBarImmediately();
      }
    }

    // Reset tracking state
    touchStartRef.current = null;
    touchMoveRef.current = null;
    panelOpenRef.current = false;
  }, [hideStatusBarImmediately, topThreshold]);

  const handleTouchCancel = useCallback(() => {
    // Reset all tracking state on touch cancel
    touchStartRef.current = null;
    touchMoveRef.current = null;
    panelOpenRef.current = false;
  }, []);

  useEffect(() => {
    // Only add listeners if running natively
    if (!nativeIntegrationService.isRunningNatively()) {
      return;
    }

    console.log('[NotificationPanelDetector] Setting up notification panel gesture detection');

    // Add touch event listeners to capture notification panel gestures
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Enhanced event listeners for Android WebView
    const handleVisibilityChange = () => {
      if (!document.hidden && panelOpenRef.current) {
        console.log('[NotificationPanelDetector] Document visibility changed - hiding status bar');
        hideStatusBarImmediately();
        panelOpenRef.current = false;
      }
    };

    const handleWindowFocus = () => {
      if (panelOpenRef.current) {
        console.log('[NotificationPanelDetector] Window focus regained - hiding status bar');
        hideStatusBarImmediately();
        panelOpenRef.current = false;
      }
    };

    // Add enhanced listeners for notification panel detection
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // Periodic status bar check as fallback (Android WebView specific)
    const statusBarCheckInterval = setInterval(() => {
      if (nativeIntegrationService.isRunningNatively()) {
        // Force status bar hide every 500ms as a safety measure
        hideStatusBarImmediately();
      }
    }, 500);

    return () => {
      console.log('[NotificationPanelDetector] Cleaning up gesture listeners');
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(statusBarCheckInterval);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, hideStatusBarImmediately]);

  return {
    hideStatusBarImmediately
  };
};