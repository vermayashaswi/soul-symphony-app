
import { useState, useEffect, useCallback, useRef } from 'react';
import { processingStateManager, ProcessingEntry, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function useProcessingEntries() {
  const [entries, setEntries] = useState<ProcessingEntry[]>([]);
  const [activeProcessingIds, setActiveProcessingIds] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const completedEntriesRef = useRef<Set<string>>(new Set());
  const processingToEntryMapRef = useRef<Map<string, number>>(new Map());
  
  // Track when entries were last seen to prevent flicker
  const entryLastSeenTimestampRef = useRef<Map<string, number>>(new Map());
  
  // Add this function to immediately mark an entry as completed
  const markEntryAsCompleted = useCallback((tempId: string, entryId?: number) => {
    console.log(`[useProcessingEntries] Marking entry ${tempId} as completed` + (entryId ? ` with entryId ${entryId}` : ''));
    
    // Add to completed entries set to prevent it from showing again
    completedEntriesRef.current.add(tempId);
    
    if (entryId) {
      processingToEntryMapRef.current.set(tempId, entryId);
    }
    
    // Update state immediately
    setActiveProcessingIds(prev => prev.filter(id => id !== tempId));
    
    // Tell the processing state manager this entry is completed
    processingStateManager.updateEntryState(tempId, EntryProcessingState.COMPLETED);
    
    // If we have an entry ID, associate it
    if (entryId) {
      processingStateManager.setEntryId(tempId, entryId);
    }
    
    // Remove after a very short delay
    setTimeout(() => {
      processingStateManager.removeEntry(tempId);
    }, 50);
    
    // Force refresh all entries
    const currentEntries = processingStateManager.getProcessingEntries();
    const filteredEntries = currentEntries.filter(entry => entry.tempId !== tempId);
    setEntries(filteredEntries);
  }, []);
  
  const isEntryCompleted = useCallback((tempId: string): boolean => {
    return completedEntriesRef.current.has(tempId);
  }, []);

  useEffect(() => {
    // Initialize from localStorage on first mount
    processingStateManager.restoreFromLocalStorage();
    
    // Update the state immediately to prevent blank screens
    const initialEntries = processingStateManager.getProcessingEntries();
    setEntries(initialEntries);
    
    // Extract just the ids of entries in processing state
    const initialProcessingIds = initialEntries
      .filter(entry => entry.state === EntryProcessingState.PROCESSING && 
              !completedEntriesRef.current.has(entry.tempId))
      .map(entry => entry.tempId);
    
    setActiveProcessingIds(initialProcessingIds);
    
    // Subscribe to entries changes
    const subscription = processingStateManager.entriesChanges().subscribe(updatedEntries => {
      // Filter out any entries that are already marked as completed in our local tracking
      const validEntries = updatedEntries.filter(entry => !completedEntriesRef.current.has(entry.tempId));
      
      setEntries(validEntries);
      setLastUpdate(Date.now());
      
      // Extract just the ids of entries in processing state
      const processingIds = validEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds(processingIds);
      
      // Update last seen timestamps
      validEntries.forEach(entry => {
        entryLastSeenTimestampRef.current.set(entry.tempId, Date.now());
      });
    });
    
    // Handle entry mapped event (when a tempId is associated with a real entry)
    const handleEntryMapped = (event: CustomEvent<any>) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        const { tempId, entryId } = event.detail;
        console.log(`[useProcessingEntries] Entry mapped event: ${tempId} -> ${entryId}`);
        
        markEntryAsCompleted(tempId, entryId);
        
        // Force refresh UI
        window.dispatchEvent(new CustomEvent('journalUIForceRefresh', {
          detail: { timestamp: Date.now() }
        }));
      }
    };
    
    // Handle entry completed event
    const handleEntryCompleted = (event: CustomEvent<any>) => {
      if (event.detail && event.detail.tempId) {
        const { tempId } = event.detail;
        console.log(`[useProcessingEntries] Entry completed event for ${tempId}`);
        markEntryAsCompleted(tempId, event.detail.entryId);
      }
    };
    
    // Handle force refresh events
    const handleForceRefresh = () => {
      console.log('[useProcessingEntries] Force refresh requested');
      // Force update of all entries
      const currentEntries = processingStateManager.getProcessingEntries();
      
      // Filter out any entries that we know are completed
      const validEntries = currentEntries.filter(entry => !completedEntriesRef.current.has(entry.tempId));
      setEntries([...validEntries]);
      
      // Extract just the ids of entries in processing state
      const processingIds = validEntries
        .filter(entry => entry.state === EntryProcessingState.PROCESSING)
        .map(entry => entry.tempId);
      
      setActiveProcessingIds([...processingIds]);
      setLastUpdate(Date.now());
    };
    
    window.addEventListener('journalUIForceRefresh', handleForceRefresh);
    window.addEventListener('processingEntryMapped', handleEntryMapped as EventListener);
    window.addEventListener('processingEntryCompleted', handleEntryCompleted as EventListener);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('journalUIForceRefresh', handleForceRefresh);
      window.removeEventListener('processingEntryMapped', handleEntryMapped as EventListener);
      window.removeEventListener('processingEntryCompleted', handleEntryCompleted as EventListener);
    };
  }, [markEntryAsCompleted]);
  
  // Return the entries and helper functions
  return {
    entries,
    activeProcessingIds,
    lastUpdate,
    isProcessing: processingStateManager.isProcessing.bind(processingStateManager),
    hasError: processingStateManager.hasError.bind(processingStateManager),
    getEntryId: processingStateManager.getEntryId.bind(processingStateManager),
    removeEntry: processingStateManager.removeEntry.bind(processingStateManager),
    retryProcessing: processingStateManager.retryProcessing.bind(processingStateManager),
    markEntryAsCompleted,
    isEntryCompleted
  };
}
