
import { useState, useEffect } from 'react';
import { processingStateManager, ProcessingEntry, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function useProcessingEntries() {
  const [entries, setEntries] = useState<ProcessingEntry[]>([]);
  const [activeProcessingIds, setActiveProcessingIds] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [entriesMappedToIds, setEntriesMappedToIds] = useState<Map<string, number>>(new Map());
  
  useEffect(() => {
    // Initialize from localStorage on first mount
    processingStateManager.restoreFromLocalStorage();
    
    // Update the state immediately to prevent blank screens
    const initialEntries = processingStateManager.getProcessingEntries();
    setEntries(initialEntries);
    
    // Extract just the ids of entries in processing state
    const initialProcessingIds = initialEntries
      .filter(entry => entry.state === EntryProcessingState.PROCESSING)
      .map(entry => entry.tempId);
    
    setActiveProcessingIds(initialProcessingIds);
    
    // Build mapping of tempIds to entryIds
    const initialMapping = new Map<string, number>();
    initialEntries.forEach(entry => {
      if (entry.entryId) {
        initialMapping.set(entry.tempId, entry.entryId);
      }
    });
    setEntriesMappedToIds(initialMapping);
    
    // Subscribe to entries changes
    const subscription = processingStateManager.entriesChanges().subscribe(updatedEntries => {
      setEntries(updatedEntries);
      setLastUpdate(Date.now());
      
      // Extract just the ids of entries in processing state
      const processingIds = updatedEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds(processingIds);
      
      // Update the mapping of tempIds to entryIds
      const mapping = new Map<string, number>();
      updatedEntries.forEach(entry => {
        if (entry.entryId) {
          mapping.set(entry.tempId, entry.entryId);
        }
      });
      setEntriesMappedToIds(mapping);
    });
    
    // Handle force refresh events
    const handleForceRefresh = () => {
      console.log('[useProcessingEntries] Force refresh requested');
      // Force update of all entries
      const currentEntries = processingStateManager.getProcessingEntries();
      setEntries([...currentEntries]);
      
      // Extract just the ids of entries in processing state
      const processingIds = currentEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds([...processingIds]);
      setLastUpdate(Date.now());
      
      // Update the mapping of tempIds to entryIds
      const mapping = new Map<string, number>();
      currentEntries.forEach(entry => {
        if (entry.entryId) {
          mapping.set(entry.tempId, entry.entryId);
        }
      });
      setEntriesMappedToIds(new Map(mapping));
    };
    
    window.addEventListener('journalUIForceRefresh', handleForceRefresh);
    
    // Handle entry-to-id mapping events
    const handleEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[useProcessingEntries] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        processingStateManager.setEntryId(event.detail.tempId, event.detail.entryId);
        
        // Update the mapping
        setEntriesMappedToIds(prev => {
          const newMap = new Map(prev);
          newMap.set(event.detail.tempId, event.detail.entryId);
          return newMap;
        });
        
        // Force a quick cleanup of completed entries
        setTimeout(() => {
          processingStateManager.updateEntryState(event.detail.tempId, EntryProcessingState.COMPLETED);
          setTimeout(() => {
            processingStateManager.removeEntry(event.detail.tempId);
            setLastUpdate(Date.now());
          }, 300);
        }, 300);
      }
    };
    
    window.addEventListener('processingEntryMapped', handleEntryMapped as EventListener);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('journalUIForceRefresh', handleForceRefresh);
      window.removeEventListener('processingEntryMapped', handleEntryMapped as EventListener);
    };
  }, []);
  
  // Return the entries and helper functions
  return {
    entries,
    activeProcessingIds,
    lastUpdate,
    entriesMappedToIds,
    isProcessing: processingStateManager.isProcessing.bind(processingStateManager),
    hasError: processingStateManager.hasError.bind(processingStateManager),
    getEntryId: processingStateManager.getEntryId.bind(processingStateManager),
    removeEntry: processingStateManager.removeEntry.bind(processingStateManager),
    retryProcessing: processingStateManager.retryProcessing.bind(processingStateManager),
    markEntryAsCompleted: (tempId: string) => {
      processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
      setTimeout(() => {
        processingStateManager.removeEntry(tempId);
      }, 300);
    }
  };
}
