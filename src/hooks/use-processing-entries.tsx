
import { useState, useEffect, useRef, useCallback } from 'react';
import { JournalEntry } from '@/types/journal';
import {
  getProcessingEntries,
  getEntryIdForProcessingId,
  removeProcessingEntryById,
  isEntryDeleted,
  isProcessingEntryCompleted,
  getDeletedEntryIds
} from '@/utils/audio-processing';

interface ProcessingEntriesState {
  visibleProcessingEntries: string[];
  persistedProcessingEntries: string[];
  processingToEntryMap: Map<string, number>;
  processingToActualEntry: Map<string, JournalEntry>;
  transitionalLoadingEntries: string[];
  recentlyCompletedEntries: number[];
  processedProcessingIds: Set<string>;
  deletedEntryIds: Set<number>;
  deletedProcessingTempIds: Set<string>;
  fullyProcessedEntries: Set<number>;
  processingCardShouldShow: boolean;
  setProcessingCardShouldShow: (show: boolean) => void;
  setVisibleProcessingEntries: React.Dispatch<React.SetStateAction<string[]>>;
}

interface UseProcessingEntriesProps {
  entries: JournalEntry[];
  processingEntries: string[];
}

export function useProcessingEntries({
  entries,
  processingEntries = []
}: UseProcessingEntriesProps): ProcessingEntriesState {
  const [visibleProcessingEntries, setVisibleProcessingEntries] = useState<string[]>([]);
  const [persistedProcessingEntries, setPersistedProcessingEntries] = useState<string[]>([]);
  const [processingToEntryMap, setProcessingToEntryMap] = useState<Map<string, number>>(new Map());
  const [processingToActualEntry, setProcessingToActualEntry] = useState<Map<string, JournalEntry>>(new Map());
  const [transitionalLoadingEntries, setTransitionalLoadingEntries] = useState<string[]>([]);
  const [recentlyCompletedEntries, setRecentlyCompletedEntries] = useState<number[]>([]);
  const [processedProcessingIds, setProcessedProcessingIds] = useState<Set<string>>(new Set());
  const [deletedEntryIds, setDeletedEntryIds] = useState<Set<number>>(new Set());
  const [deletedProcessingTempIds, setDeletedProcessingTempIds] = useState<Set<string>>(new Set());
  const [fullyProcessedEntries, setFullyProcessedEntries] = useState<Set<number>>(new Set());
  const [processingCardShouldShow, setProcessingCardShouldShow] = useState<boolean>(false);

  const componentMounted = useRef<boolean>(true);
  const dialogOpenRef = useRef(false);

  // Handle entry deletions
  useEffect(() => {
    const handleEntryDeleted = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId) {
        console.log(`[ProcessingEntries] Entry deleted event: ${event.detail.entryId}`);
        
        if (typeof event.detail.entryId === 'number') {
          setDeletedEntryIds(prev => {
            const newSet = new Set(prev);
            newSet.add(event.detail.entryId);
            return newSet;
          });
        } else if (typeof event.detail.entryId === 'string') {
          setDeletedProcessingTempIds(prev => {
            const newSet = new Set(prev);
            newSet.add(event.detail.entryId);
            return newSet;
          });
        }
        
        setVisibleProcessingEntries(prev => prev.filter(id => {
          if (id === event.detail.entryId) return false;
          const mappedId = getEntryIdForProcessingId(id);
          if (mappedId && mappedId === event.detail.entryId) return false;
          return true;
        }));
        
        setProcessingCardShouldShow(false);
      }
    };
    
    window.addEventListener('entryDeleted', handleEntryDeleted as EventListener);
    
    const syncDeletedEntries = () => {
      try {
        const { processingIds, entryIds } = getDeletedEntryIds();
        
        setDeletedProcessingTempIds(new Set(processingIds));
        setDeletedEntryIds(new Set(entryIds));
      } catch (error) {
        console.error('[ProcessingEntries] Error syncing deleted entries:', error);
      }
    };
    
    syncDeletedEntries();
    
    const syncInterval = setInterval(syncDeletedEntries, 2000);
    
    return () => {
      window.removeEventListener('entryDeleted', handleEntryDeleted as EventListener);
      clearInterval(syncInterval);
    };
  }, []);

  // Handle processing entry mapping
  useEffect(() => {
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[ProcessingEntries] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        
        if (deletedEntryIds.has(event.detail.entryId) || deletedProcessingTempIds.has(event.detail.tempId)) {
          console.log(`[ProcessingEntries] Skipping mapped entry ${event.detail.entryId} as it was deleted`);
          return;
        }
        
        if (processedProcessingIds.has(event.detail.tempId)) {
          console.log(`[ProcessingEntries] Already processed this tempId: ${event.detail.tempId}, skipping`);
          return;
        }
        
        setProcessedProcessingIds(prev => {
          const newSet = new Set(prev);
          newSet.add(event.detail.tempId);
          return newSet;
        });
        
        setFullyProcessedEntries(prev => {
          const newSet = new Set(prev);
          newSet.add(event.detail.entryId);
          return newSet;
        });
        
        const matchedEntry = entries.find(entry => entry.id === event.detail.entryId);
        
        if (matchedEntry) {
          console.log(`[ProcessingEntries] Found matching entry for ${event.detail.tempId}:`, matchedEntry.id);
          
          setProcessingToActualEntry(prev => {
            const newMap = new Map(prev);
            newMap.set(event.detail.tempId, matchedEntry);
            return newMap;
          });
          
          setTransitionalLoadingEntries(prev => {
            if (prev.includes(event.detail.tempId)) return prev;
            return [...prev, event.detail.tempId];
          });
          
          setProcessingCardShouldShow(false);
          
          setTimeout(() => {
            if (componentMounted.current) {
              setVisibleProcessingEntries(prev => 
                prev.filter(id => id !== event.detail.tempId)
              );
              
              setTimeout(() => {
                if (componentMounted.current) {
                  setTransitionalLoadingEntries(prev => 
                    prev.filter(id => id !== event.detail.tempId)
                  );
                }
              }, 100);
            }
          }, 100);
        } else {
          console.log(`[ProcessingEntries] No matching entry found yet for ${event.detail.entryId}`);
          
          setProcessingToEntryMap(prev => {
            const newMap = new Map(prev);
            newMap.set(event.detail.tempId, event.detail.entryId);
            return newMap;
          });
        }
        
        const newEntryId = event.detail.entryId;
        if (newEntryId) {
          setRecentlyCompletedEntries(prev => {
            if (prev.includes(newEntryId)) return prev;
            return [...prev, newEntryId];
          });
          
          setTimeout(() => {
            if (componentMounted.current) {
              setTimeout(() => {
                if (componentMounted.current) {
                  setRecentlyCompletedEntries(prev => prev.filter(id => id !== newEntryId));
                }
              }, 5000);
            }
          }, 5000);
        }
      }
    };
    
    window.addEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    
    const handleProcessingEntryCompleted = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId) {
        console.log(`[ProcessingEntries] Processing entry completed: ${event.detail.tempId}`);
        setProcessingCardShouldShow(false);
        setVisibleProcessingEntries(prev => 
          prev.filter(id => id !== event.detail.tempId)
        );
      }
    };
    
    window.addEventListener('processingEntryCompleted', handleProcessingEntryCompleted as EventListener);
    
    return () => {
      window.removeEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
      window.removeEventListener('processingEntryCompleted', handleProcessingEntryCompleted as EventListener);
    };
  }, [entries, processedProcessingIds, deletedEntryIds, deletedProcessingTempIds]);

  // Check for matching entries when processingToEntryMap updates
  useEffect(() => {
    if (entries.length > 0 && processingToEntryMap.size > 0) {
      processingToEntryMap.forEach((entryId, tempId) => {
        if (transitionalLoadingEntries.includes(tempId)) return;
        if (processedProcessingIds.has(tempId)) return;
        if (deletedProcessingTempIds.has(tempId)) return;
        
        const matchedEntry = entries.find(entry => entry.id === entryId);
        
        if (matchedEntry) {
          console.log(`[ProcessingEntries] Found actual entry data for ${tempId}:`, matchedEntry.id);
          
          setProcessingCardShouldShow(false);
          
          setFullyProcessedEntries(prev => {
            const newSet = new Set(prev);
            newSet.add(matchedEntry.id);
            return newSet;
          });
          
          setProcessedProcessingIds(prev => {
            const newSet = new Set(prev);
            newSet.add(tempId);
            return newSet;
          });
          
          setProcessingToActualEntry(prev => {
            const newMap = new Map(prev);
            newMap.set(tempId, matchedEntry);
            return newMap;
          });
          
          if (!transitionalLoadingEntries.includes(tempId)) {
            setTransitionalLoadingEntries(prev => [...prev, tempId]);
            
            setTimeout(() => {
              if (componentMounted.current) {
                setVisibleProcessingEntries(prev => 
                  prev.filter(id => id !== tempId)
                );
                setProcessingCardShouldShow(false);
              }
            }, 1000);
          }
        }
      });
    }
  }, [entries, processingToEntryMap, transitionalLoadingEntries, processedProcessingIds, deletedProcessingTempIds]);

  // Load persisted processing entries
  useEffect(() => {
    const loadPersistedProcessingEntries = () => {
      const persistedEntries = getProcessingEntries();
      
      if (persistedEntries.length > 0) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const validEntries = persistedEntries.filter(id => {
          const timestamp = parseInt(id.split('-').pop() || '0');
          const isRecent = !isNaN(timestamp) && timestamp > fiveMinutesAgo;
          const isNotProcessed = !processedProcessingIds.has(id);
          const isNotDeleted = !deletedProcessingTempIds.has(id);
          const isNotCompleted = !isProcessingEntryCompleted(id);
          const hasNoExistingEntry = !entries.some(entry => {
            const mappedId = getEntryIdForProcessingId(id);
            return entry.id === mappedId;
          });
          return isRecent && isNotProcessed && isNotDeleted && isNotCompleted && hasNoExistingEntry;
        });
        
        const entriesWithMappedIds = entries.map(entry => entry.id);
        const filteredValidEntries = validEntries.filter(tempId => {
          const mappedId = getEntryIdForProcessingId(tempId);
          return !mappedId || !entriesWithMappedIds.includes(mappedId);
        });
        
        console.log(`[ProcessingEntries] Filtered processing entries from ${validEntries.length} to ${filteredValidEntries.length}`);
        
        setPersistedProcessingEntries(filteredValidEntries);
        const visibleEntries = filteredValidEntries.slice(0, 1);
        setVisibleProcessingEntries(visibleEntries);
        
        const shouldShow = visibleEntries.length > 0 && !dialogOpenRef.current && 
          !visibleEntries.some(tempId => {
            const mappedId = getEntryIdForProcessingId(tempId);
            return mappedId && entriesWithMappedIds.includes(mappedId);
          });
        
        setProcessingCardShouldShow(shouldShow);
        console.log(`[ProcessingEntries] Processing card should show: ${shouldShow}`);
      } else {
        setPersistedProcessingEntries([]);
        setVisibleProcessingEntries([]);
        setProcessingCardShouldShow(false);
      }
    };
    
    loadPersistedProcessingEntries();
    
    const cleanupInterval = setInterval(() => {
      if (componentMounted.current) {
        loadPersistedProcessingEntries();
      }
    }, 2000);
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [entries, processedProcessingIds, deletedProcessingTempIds]);

  useEffect(() => {
    return () => {
      componentMounted.current = false;
    };
  }, []);

  return {
    visibleProcessingEntries,
    persistedProcessingEntries,
    processingToEntryMap,
    processingToActualEntry,
    transitionalLoadingEntries,
    recentlyCompletedEntries,
    processedProcessingIds,
    deletedEntryIds,
    deletedProcessingTempIds,
    fullyProcessedEntries,
    processingCardShouldShow,
    setProcessingCardShouldShow,
    setVisibleProcessingEntries,
  };
}
