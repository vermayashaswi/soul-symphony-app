
import { useEffect } from 'react';

export function useProcessingCardCleaner() {
  useEffect(() => {
    // On mount, ensure processing cards are cleaned up
    const cleanupCards = () => {
      window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
        detail: {
          timestamp: Date.now(),
          forceCleanup: true,
          source: 'ProcessingCardCleaner-effect'
        }
      }));
      
      window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
        detail: {
          timestamp: Date.now(),
          forceClearProcessingCard: true,
          source: 'ProcessingCardCleaner-effect'
        }
      }));
    };
    
    // Clean immediately on mount
    cleanupCards();
    
    // And set up a periodic cleanup every 10 seconds
    const interval = setInterval(cleanupCards, 10000);
    
    return () => {
      clearInterval(interval);
      
      // Clean up on unmount as well
      cleanupCards();
    };
  }, []);
}

// Also export a direct function for immediate cleanup
export function forceProcessingCardCleanup() {
  window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
    detail: {
      timestamp: Date.now(),
      forceCleanup: true,
      source: 'forceProcessingCardCleanup-direct'
    }
  }));
  
  window.dispatchEvent(new CustomEvent('processingEntryCompleted', {
    detail: {
      timestamp: Date.now(),
      forceClearProcessingCard: true,
      source: 'forceProcessingCardCleanup-direct'
    }
  }));
}
