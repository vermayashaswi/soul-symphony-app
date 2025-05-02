
import { useEffect } from 'react';
import { initializeJournalProcessing } from '@/utils/journal/initialize-processing';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function JournalProcessingInitializer() {
  useEffect(() => {
    console.log('[JournalProcessingInitializer] Initializing journal processing system');
    
    const { processingStateManager } = initializeJournalProcessing();
    
    // Force immediate cleanup of any stale entries that might be causing duplicate cards
    console.log('[JournalProcessingInitializer] Running immediate cleanup of stale entries');
    
    // Find any entries and force cleanup regardless of state
    const entries = processingStateManager.getProcessingEntries();
    console.log(`[JournalProcessingInitializer] Found ${entries.length} entries to check for cleanup`);
    
    let cleanedCount = 0;
    
    entries.forEach(entry => {
      // If an entry has been in the system for more than 10 seconds, force cleanup
      // Reduced from 15 seconds to 10 seconds to be more aggressive
      const entryAge = Date.now() - entry.startTime;
      const shouldClean = entryAge > 10000 || entry.state === EntryProcessingState.COMPLETED;
      
      if (shouldClean) {
        processingStateManager.removeEntry(entry.tempId);
        cleanedCount++;
        console.log(`[JournalProcessingInitializer] Force cleaned up entry ${entry.tempId} (age: ${entryAge}ms, state: ${entry.state})`);
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`[JournalProcessingInitializer] Cleaned up ${cleanedCount} entries on init`);
      
      // Dispatch event to notify all components
      window.dispatchEvent(new CustomEvent('processingEntriesForceCleanup', {
        detail: { timestamp: Date.now(), forceUpdate: true, immediate: true }
      }));
      
      // Additional event to force UI cleanup
      window.dispatchEvent(new CustomEvent('forceRemoveAllProcessingCards', {
        detail: { timestamp: Date.now(), forceCleanup: true }
      }));
    }
    
    // Also set up a periodic cleanup check - reduced interval from 10s to 5s
    const cleanupInterval = setInterval(() => {
      const currentEntries = processingStateManager.getProcessingEntries();
      const now = Date.now();
      let removedCount = 0;
      
      currentEntries.forEach(entry => {
        const entryAge = now - entry.startTime;
        // Remove entries older than 20 seconds (reduced from 30s)
        if (entryAge > 20000) { 
          processingStateManager.removeEntry(entry.tempId);
          removedCount++;
          console.log(`[JournalProcessingInitializer] Cleaned up stale entry ${entry.tempId} (age: ${entryAge}ms)`);
        }
      });
      
      if (removedCount > 0) {
        console.log(`[JournalProcessingInitializer] Cleaned up ${removedCount} stale entries in periodic check`);
        
        // Notify components about the cleanup
        window.dispatchEvent(new CustomEvent('processingEntriesForceCleanup', {
          detail: { timestamp: now, forceUpdate: true, immediate: true }
        }));
        
        // Add a new event that forces all components to refresh their UI state
        window.dispatchEvent(new CustomEvent('journalUIForceRefresh', {
          detail: { timestamp: now, forceUpdate: true }
        }));
      }
    }, 5000); // Check every 5 seconds
    
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
