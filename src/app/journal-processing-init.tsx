
import { useEffect } from 'react';
import { initializeJournalProcessing } from '@/utils/journal/initialize-processing';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function JournalProcessingInitializer() {
  useEffect(() => {
    console.log('[JournalProcessingInitializer] Initializing journal processing system');
    
    const { processingStateManager } = initializeJournalProcessing();
    
    // Immediate cleanup of any stale entries
    console.log('[JournalProcessingInitializer] Running cleanup of stale entries');
    
    const entries = processingStateManager.getProcessingEntries();
    console.log(`[JournalProcessingInitializer] Found ${entries.length} entries to check for cleanup`);
    
    let cleanedCount = 0;
    
    entries.forEach(entry => {
      // If an entry has been in the system for more than 30 seconds, force cleanup
      const entryAge = Date.now() - entry.startTime;
      const shouldClean = entryAge > 30000;
      
      if (shouldClean) {
        processingStateManager.removeEntry(entry.tempId);
        cleanedCount++;
        console.log(`[JournalProcessingInitializer] Force cleaned up entry ${entry.tempId} (age: ${entryAge}ms)`);
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`[JournalProcessingInitializer] Cleaned up ${cleanedCount} entries on init`);
    }
    
    // Set up a periodic cleanup check every 30 seconds
    const cleanupInterval = setInterval(() => {
      const currentEntries = processingStateManager.getProcessingEntries();
      const now = Date.now();
      let removedCount = 0;
      
      currentEntries.forEach(entry => {
        const entryAge = now - entry.startTime;
        // Remove entries older than 60 seconds
        if (entryAge > 60000) { 
          processingStateManager.removeEntry(entry.tempId);
          removedCount++;
          console.log(`[JournalProcessingInitializer] Cleaned up stale entry ${entry.tempId} (age: ${entryAge}ms)`);
        }
      });
      
      if (removedCount > 0) {
        console.log(`[JournalProcessingInitializer] Cleaned up ${removedCount} stale entries in periodic check`);
      }
    }, 30000); // Check every 30 seconds
    
    // Cleanup on unmount
    return () => {
      console.log('[JournalProcessingInitializer] Cleaning up processing state manager');
      processingStateManager.dispose();
      clearInterval(cleanupInterval);
    };
  }, []);
  
  // This component doesn't render anything
  return null;
}
