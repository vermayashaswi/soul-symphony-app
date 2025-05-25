
import { useState, useEffect, useRef } from 'react';

interface IdleDetectionOptions {
  timeout?: number; // milliseconds
  events?: string[];
  element?: Element | Document;
}

export function useIdleDetection(options: IdleDetectionOptions = {}) {
  const {
    timeout = 300000, // 5 minutes default
    events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'],
    element = document
  } = options;

  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const resetTimer = () => {
      if (!isMountedRef.current) return;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsIdle(false);
      
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsIdle(true);
        }
      }, timeout);
    };

    // Initialize timer
    resetTimer();

    // Add event listeners
    const eventListeners = events.map(event => {
      const handler = resetTimer;
      element.addEventListener(event, handler, { passive: true });
      return { event, handler };
    });

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!isMountedRef.current) return;
      
      if (document.hidden) {
        setIsIdle(true);
      } else {
        resetTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Remove event listeners
      eventListeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });

      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [timeout, element, events]);

  return { isIdle, isActive: !isIdle };
}
