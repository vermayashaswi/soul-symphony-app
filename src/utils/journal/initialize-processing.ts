
import { processingStateManager } from './processing-state-manager';

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
      if (entryId) {
        processingStateManager.setEntryId(tempId, entryId);
      }
    }
  });
  
  console.log('[Journal] Processing state management initialized');
  
  return {
    processingStateManager
  };
}
