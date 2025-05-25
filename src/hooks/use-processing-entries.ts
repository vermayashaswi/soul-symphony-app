
import { useState, useEffect } from 'react';
import { processingStateManager, ProcessingEntry, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function useProcessingEntries() {
  const [entries, setEntries] = useState<ProcessingEntry[]>([]);
  const [visibleEntries, setVisibleEntries] = useState<ProcessingEntry[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  
  useEffect(() => {
    // Initialize from localStorage on first mount
    processingStateManager.restoreFromLocalStorage();
    
    // Update the state immediately
    const initialEntries = processingStateManager.getProcessingEntries();
    const initialVisible = processingStateManager.getVisibleProcessingEntries();
    
    setEntries(initialEntries);
    setVisibleEntries(initialVisible);
    
    // Subscribe to entries changes
    const subscription = processingStateManager.entriesChanges().subscribe(updatedEntries => {
      setEntries(updatedEntries);
      setVisibleEntries(updatedEntries.filter(entry => entry.isVisible));
      setLastUpdate(Date.now());
    });
    
    // Handle immediate hide events
    const handleEntryHidden = (event: CustomEvent) => {
      console.log('[useProcessingEntries] Entry hidden event received');
      const currentEntries = processingStateManager.getProcessingEntries();
      const currentVisible = processingStateManager.getVisibleProcessingEntries();
      setEntries([...currentEntries]);
      setVisibleEntries([...currentVisible]);
    };
    
    window.addEventListener('processingEntryHidden', handleEntryHidden as EventListener);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('processingEntryHidden', handleEntryHidden as EventListener);
    };
  }, []);
  
  // Return simplified interface focused on visible entries
  return {
    entries,
    visibleEntries, // Only visible processing entries
    activeProcessingIds: visibleEntries.map(entry => entry.tempId),
    lastUpdate,
    isProcessing: (tempId: string) => {
      return processingStateManager.isProcessing(tempId);
    },
    isVisible: (tempId: string) => {
      return processingStateManager.isVisible(tempId);
    },
    hasError: processingStateManager.hasError.bind(processingStateManager),
    getEntryId: processingStateManager.getEntryId.bind(processingStateManager),
    removeEntry: processingStateManager.removeEntry.bind(processingStateManager),
    hideEntry: processingStateManager.hideEntry.bind(processingStateManager),
    retryProcessing: processingStateManager.retryProcessing.bind(processingStateManager)
  };
}
