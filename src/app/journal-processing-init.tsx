
import { useEffect } from 'react';
import { initializeJournalProcessing } from '@/utils/journal/initialize-processing';

export function JournalProcessingInitializer() {
  useEffect(() => {
    console.log('[JournalProcessingInitializer] Initializing journal processing system');
    
    const { processingStateManager } = initializeJournalProcessing();
    
    // Force cleanup any stale entries that might be causing duplicate cards
    const cleanupTimeout = setTimeout(() => {
      console.log('[JournalProcessingInitializer] Running delayed cleanup of stale entries');
      // Find any completed entries and force cleanup
      const entries = processingStateManager.getProcessingEntries();
      let completedCount = 0;
      
      entries.forEach(entry => {
        if (entry.state === 'completed') {
          processingStateManager.removeEntry(entry.tempId);
          completedCount++;
        }
      });
      
      if (completedCount > 0) {
        console.log(`[JournalProcessingInitializer] Cleaned up ${completedCount} completed entries`);
        
        // Dispatch event to notify all components
        window.dispatchEvent(new CustomEvent('processingEntriesForceCleanup', {
          detail: { timestamp: Date.now(), forceUpdate: true }
        }));
      }
    }, 2000);
    
    // Cleanup on unmount
    return () => {
      console.log('[JournalProcessingInitializer] Cleaning up processing state manager');
      processingStateManager.dispose();
      clearTimeout(cleanupTimeout);
    };
  }, []);
  
  // This component doesn't render anything
  return null;
}
