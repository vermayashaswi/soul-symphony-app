
import { useState, useEffect, useCallback } from 'react';
import { useJournalRefresh } from './use-journal-refresh';

/**
 * A hook for implementing pull-to-refresh functionality on mobile devices
 * This works with the journal entries list to provide a native-like refresh experience
 */
export function useMobilePullRefresh(containerRef: React.RefObject<HTMLElement>) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const { refreshEntries, isRefreshing } = useJournalRefresh();
  
  const THRESHOLD = 80; // Distance in pixels to trigger refresh
  
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only enable pull-to-refresh when already at the top of the content
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  }, [containerRef]);
  
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    // Only allow pulling down, not up
    if (distance > 0) {
      // Apply resistance to make it feel more natural
      const resistedDistance = Math.min(distance * 0.4, THRESHOLD * 1.5);
      setPullDistance(resistedDistance);
      
      // Prevent default scrolling behavior while pulling
      if (resistedDistance > 5) {
        e.preventDefault();
      }
    }
  }, [isPulling, startY, THRESHOLD]);
  
  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;
    
    if (pullDistance > THRESHOLD) {
      // Trigger refresh
      refreshEntries();
    }
    
    // Reset pull state
    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, THRESHOLD, refreshEntries]);
  
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
  
  return {
    pullDistance,
    isPulling,
    isRefreshing,
    refreshEntries
  };
}
