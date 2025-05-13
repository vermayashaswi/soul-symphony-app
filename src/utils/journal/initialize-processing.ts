
import { processingStateManager, EntryProcessingState } from './processing-state-manager';
import { showToast } from './toast-helper';

export function initializeJournalProcessing() {
  // Restore state from localStorage on app start
  processingStateManager.restoreFromLocalStorage();
  
  // Add event handlers for when the app is about to be closed
  window.addEventListener('beforeunload', () => {
    // Persist all state to localStorage before unload
    processingStateManager.entriesChanges().subscribe();
  });
  
  // Set up event listeners for external processing events
  window.addEventListener('processingEntryCompleted', (event: any) => {
    if (event.detail && event.detail.tempId) {
      const { tempId, entryId } = event.detail;
      console.log(`[Journal] Processing completed for ${tempId}${entryId ? ` -> ${entryId}` : ''}`);
      
      if (entryId) {
        processingStateManager.setEntryId(tempId, entryId);
      }
      
      // Mark as completed, which will schedule a cleanup after the minimum visibility time
      processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
    }
  });
  
  // Set up event listener for processing entry mapped events (for cross-component sync)
  window.addEventListener('processingEntryMapped', (event: any) => {
    if (event.detail && event.detail.tempId && event.detail.entryId) {
      const { tempId, entryId } = event.detail;
      console.log(`[Journal] Processing entry mapped: ${tempId} -> ${entryId}`);
      
      // Ensure this mapping is recorded in our state manager
      processingStateManager.setEntryId(tempId, entryId);
    }
  });
  
  // Handle forced cleanup events
  window.addEventListener('processingEntriesForceCleanup', () => {
    console.log('[Journal] Received force cleanup event, cleaning stale entries');
    
    // Get all entries and process them
    const entries = processingStateManager.getProcessingEntries();
    const now = Date.now();
    
    entries.forEach(entry => {
      // If entry has been in the system for more than 20 seconds and is completed, force cleanup
      const entryAge = now - entry.startTime;
      if (entry.state === EntryProcessingState.COMPLETED && entryAge > 20000) {
        processingStateManager.removeEntry(entry.tempId);
        console.log(`[Journal] Force cleaned up entry ${entry.tempId} (age: ${entryAge}ms)`);
      }
    });
  });
  
  // Add a new handler for entry deletion
  window.addEventListener('journalEntryDeleted', (event: any) => {
    if (event.detail && event.detail.entryId) {
      const { entryId } = event.detail;
      console.log(`[Journal] Entry deleted event for entry ID: ${entryId}, checking for related processing entries`);
      
      // Find any processing entries related to this entry ID
      const entries = processingStateManager.getProcessingEntries();
      let removedCount = 0;
      
      entries.forEach(entry => {
        if (entry.entryId === entryId) {
          processingStateManager.removeEntry(entry.tempId);
          removedCount++;
          console.log(`[Journal] Removed processing entry ${entry.tempId} related to deleted entry ${entryId}`);
        }
      });
      
      if (removedCount > 0) {
        // Force UI refresh
        window.dispatchEvent(new CustomEvent('journalUIForceRefresh', {
          detail: { timestamp: Date.now(), deletedEntryId: entryId }
        }));
      }
    }
  });
  
  console.log('[Journal] Processing state management initialized');
  
  return {
    processingStateManager
  };
}
