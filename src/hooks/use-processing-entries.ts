
import { useState, useEffect } from 'react';
import { processingStateManager, ProcessingEntry, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function useProcessingEntries() {
  const [entries, setEntries] = useState<ProcessingEntry[]>([]);
  const [activeProcessingIds, setActiveProcessingIds] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  
  useEffect(() => {
    // Initialize from localStorage on first mount
    processingStateManager.restoreFromLocalStorage();
    
    // Update the state immediately to prevent blank screens
    const initialEntries = processingStateManager.getProcessingEntries();
    setEntries(initialEntries);
    
    // Include both PROCESSING and TRANSITIONING states in activeProcessingIds
    const initialProcessingIds = initialEntries
      .filter(entry => entry.state === EntryProcessingState.PROCESSING || entry.state === EntryProcessingState.TRANSITIONING)
      .map(entry => entry.tempId);
    
    setActiveProcessingIds(initialProcessingIds);
    
    // Subscribe to entries changes
    const subscription = processingStateManager.entriesChanges().subscribe(updatedEntries => {
      setEntries(updatedEntries);
      setLastUpdate(Date.now());
      
      // Include both PROCESSING and TRANSITIONING states in activeProcessingIds
      const processingIds = updatedEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING || entry.state === EntryProcessingState.TRANSITIONING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds(processingIds);
    });
    
    // Handle force refresh events
    const handleForceRefresh = () => {
      console.log('[useProcessingEntries] Force refresh requested');
      const currentEntries = processingStateManager.getProcessingEntries();
      setEntries([...currentEntries]);
      
      const processingIds = currentEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING || entry.state === EntryProcessingState.TRANSITIONING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds([...processingIds]);
      setLastUpdate(Date.now());
    };
    
    window.addEventListener('journalUIForceRefresh', handleForceRefresh);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('journalUIForceRefresh', handleForceRefresh);
    };
  }, []);
  
  // Return the entries and helper functions
  return {
    entries,
    activeProcessingIds,
    lastUpdate,
    isProcessing: (tempId: string) => {
      const entry = processingStateManager.getEntryById(tempId);
      return entry ? (entry.state === EntryProcessingState.PROCESSING || entry.state === EntryProcessingState.TRANSITIONING) : false;
    },
    hasError: processingStateManager.hasError.bind(processingStateManager),
    getEntryId: processingStateManager.getEntryId.bind(processingStateManager),
    removeEntry: processingStateManager.removeEntry.bind(processingStateManager),
    retryProcessing: processingStateManager.retryProcessing.bind(processingStateManager)
  };
}
