
import { useEffect } from 'react';
import { initializeJournalProcessing } from '@/utils/journal/initialize-processing';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';
import { logger } from '@/utils/logger';

export function JournalProcessingInitializer() {
  const processingLogger = logger.createLogger('JournalProcessingInitializer');
  
  useEffect(() => {
    processingLogger.info('Initializing journal processing system');
    
    const { processingStateManager } = initializeJournalProcessing();
    
    // Immediate cleanup of any stale entries
    processingLogger.debug('Running cleanup of stale entries');
    
    const entries = processingStateManager.getProcessingEntries();
    processingLogger.debug('Found entries to check for cleanup', { entryCount: entries.length });
    
    let cleanedCount = 0;
    
    entries.forEach(entry => {
      // If an entry has been in the system for more than 30 seconds, force cleanup
      const entryAge = Date.now() - entry.startTime;
      const shouldClean = entryAge > 30000;
      
      if (shouldClean) {
        processingStateManager.removeEntry(entry.tempId);
        cleanedCount++;
        processingLogger.debug('Force cleaned up entry', { tempId: entry.tempId, entryAge });
      }
    });
    
    if (cleanedCount > 0) {
      processingLogger.info('Cleaned up stale entries on init', { cleanedCount });
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
          processingLogger.debug('Cleaned up stale entry', { tempId: entry.tempId, entryAge });
        }
      });
      
      if (removedCount > 0) {
        processingLogger.debug('Cleaned up stale entries in periodic check', { removedCount });
      }
    }, 30000); // Check every 30 seconds
    
    // Cleanup on unmount
    return () => {
      processingLogger.debug('Cleaning up processing state manager');
      processingStateManager.dispose();
      clearInterval(cleanupInterval);
    };
  }, []);
  
  // This component doesn't render anything
  return null;
}
