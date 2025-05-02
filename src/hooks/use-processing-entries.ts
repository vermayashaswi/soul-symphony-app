
import { useState, useEffect } from 'react';
import { processingStateManager, ProcessingEntry, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function useProcessingEntries() {
  const [entries, setEntries] = useState<ProcessingEntry[]>([]);
  const [activeProcessingIds, setActiveProcessingIds] = useState<string[]>([]);
  
  useEffect(() => {
    // Initialize from localStorage on first mount
    processingStateManager.restoreFromLocalStorage();
    
    // Subscribe to entries changes
    const subscription = processingStateManager.entriesChanges().subscribe(updatedEntries => {
      setEntries(updatedEntries);
      
      // Extract just the ids of entries in processing state
      const processingIds = updatedEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds(processingIds);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Return the entries and helper functions
  return {
    entries,
    activeProcessingIds,
    isProcessing: processingStateManager.isProcessing.bind(processingStateManager),
    hasError: processingStateManager.hasError.bind(processingStateManager),
    getEntryId: processingStateManager.getEntryId.bind(processingStateManager),
    removeEntry: processingStateManager.removeEntry.bind(processingStateManager),
    retryProcessing: processingStateManager.retryProcessing.bind(processingStateManager)
  };
}
