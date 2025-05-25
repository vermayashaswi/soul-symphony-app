
import { useState, useEffect, useCallback } from 'react';
import { processingStateManager, ProcessingEntry, EntryProcessingState } from '@/utils/journal/processing-state-manager';

export function useProcessingEntries() {
  const [entries, setEntries] = useState<ProcessingEntry[]>([]);
  const [visibleEntries, setVisibleEntries] = useState<ProcessingEntry[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [immediateProcessingCount, setImmediateProcessingCount] = useState<number>(0);
  
  // Force refresh function for immediate updates
  const forceRefresh = useCallback(() => {
    console.log('[useProcessingEntries] Force refresh triggered');
    const currentEntries = processingStateManager.getProcessingEntries();
    const currentVisible = processingStateManager.getVisibleProcessingEntries();
    const immediateCount = processingStateManager.getImmediateProcessingCount();
    
    console.log('[useProcessingEntries] Current entries:', currentEntries.length);
    console.log('[useProcessingEntries] Current visible:', currentVisible.length);
    console.log('[useProcessingEntries] Immediate processing count:', immediateCount);
    
    setEntries([...currentEntries]);
    setVisibleEntries([...currentVisible]);
    setImmediateProcessingCount(immediateCount);
    setLastUpdate(Date.now());
  }, []);
  
  useEffect(() => {
    console.log('[useProcessingEntries] Initializing hook');
    
    // Initialize from localStorage on first mount
    processingStateManager.restoreFromLocalStorage();
    
    // Force immediate state sync
    forceRefresh();
    
    // Subscribe to entries changes with immediate callback
    const subscription = processingStateManager.entriesChanges().subscribe(updatedEntries => {
      console.log('[useProcessingEntries] Observable update:', updatedEntries.length);
      const visibleOnly = updatedEntries.filter(entry => entry.isVisible);
      const immediateCount = processingStateManager.getImmediateProcessingCount();
      
      setEntries([...updatedEntries]);
      setVisibleEntries([...visibleOnly]);
      setImmediateProcessingCount(immediateCount);
      setLastUpdate(Date.now());
    });
    
    // Handle immediate hide events with force refresh
    const handleEntryHidden = (event: CustomEvent) => {
      console.log('[useProcessingEntries] Entry hidden event received');
      forceRefresh();
    };
    
    // Handle processing started events with immediate update
    const handleProcessingStarted = (event: CustomEvent) => {
      console.log('[useProcessingEntries] Processing started event received:', event.detail);
      setTimeout(forceRefresh, 10); // Slight delay to ensure state manager is updated
    };
    
    // Handle immediate processing started events
    const handleImmediateProcessingStarted = (event: CustomEvent) => {
      console.log('[useProcessingEntries] Immediate processing started event received:', event.detail);
      forceRefresh(); // No delay for immediate events
    };
    
    // Listen for various processing events
    window.addEventListener('processingEntryHidden', handleEntryHidden as EventListener);
    window.addEventListener('processingStarted', handleProcessingStarted as EventListener);
    window.addEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
    window.addEventListener('processingEntriesChanged', forceRefresh as EventListener);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('processingEntryHidden', handleEntryHidden as EventListener);
      window.removeEventListener('processingStarted', handleProcessingStarted as EventListener);
      window.removeEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
      window.removeEventListener('processingEntriesChanged', forceRefresh as EventListener);
    };
  }, [forceRefresh]);
  
  // Return simplified interface with immediate methods
  return {
    entries,
    visibleEntries,
    activeProcessingIds: visibleEntries.map(entry => entry.tempId),
    lastUpdate,
    immediateProcessingCount,
    forceRefresh, // Expose for manual refresh
    isProcessing: (tempId: string) => {
      return processingStateManager.isProcessing(tempId);
    },
    isVisible: (tempId: string) => {
      return processingStateManager.isVisible(tempId);
    },
    isImmediatelyProcessing: (tempId: string) => {
      return processingStateManager.isImmediatelyProcessing(tempId);
    },
    hasAnyProcessing: () => {
      return processingStateManager.hasAnyProcessing();
    },
    hasError: processingStateManager.hasError.bind(processingStateManager),
    getEntryId: processingStateManager.getEntryId.bind(processingStateManager),
    removeEntry: processingStateManager.removeEntry.bind(processingStateManager),
    hideEntry: processingStateManager.hideEntry.bind(processingStateManager),
    retryProcessing: processingStateManager.retryProcessing.bind(processingStateManager)
  };
}
