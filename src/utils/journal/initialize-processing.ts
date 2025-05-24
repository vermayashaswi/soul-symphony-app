
import { processingStateManager, EntryProcessingState } from './processing-state-manager';
import { showToast } from './toast-helper';

export function initializeJournalProcessing() {
  // Restore state from localStorage on app start
  processingStateManager.restoreFromLocalStorage();
  
  // Add event handlers for when the app is about to be closed
  window.addEventListener('beforeunload', () => {
    // Persist all state to localStorage before unload
    processingStateManager.saveToLocalStorage();
  });
  
  // Set up event listeners for external processing events
  window.addEventListener('processingEntryCompleted', (event: any) => {
    if (event.detail && event.detail.tempId) {
      const { tempId, entryId } = event.detail;
      console.log(`[Journal] Processing completed for ${tempId}${entryId ? ` -> ${entryId}` : ''}`);
      
      if (entryId) {
        processingStateManager.setEntryId(tempId, entryId);
      }
      
      // Mark as completed, which will schedule cleanup automatically
      processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
    }
  });
  
  // Set up event listener for processing entry mapped events
  window.addEventListener('processingEntryMapped', (event: any) => {
    if (event.detail && event.detail.tempId && event.detail.entryId) {
      const { tempId, entryId } = event.detail;
      console.log(`[Journal] Processing entry mapped: ${tempId} -> ${entryId}`);
      
      processingStateManager.setEntryId(tempId, entryId);
    }
  });
  
  // Handle entry deletion
  window.addEventListener('journalEntryDeleted', (event: any) => {
    if (event.detail && event.detail.entryId) {
      const { entryId } = event.detail;
      console.log(`[Journal] Entry deleted event for entry ID: ${entryId}`);
      
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
