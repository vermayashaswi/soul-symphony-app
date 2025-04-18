import React, { useEffect, useState, useRef, useCallback } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Mic, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';
import JournalSearch from './JournalSearch';
import { 
  getProcessingEntries, 
  getEntryIdForProcessingId, 
  removeProcessingEntryById, 
  isEntryDeleted,
  isProcessingEntryCompleted,
  getDeletedEntryIds
} from '@/utils/audio-processing';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[];
  processedEntryIds?: number[];
  onStartRecording: () => void;
  onDeleteEntry?: (entryId: number) => Promise<void> | void;
}

const JournalEntriesList = ({ 
  entries = [],
  loading = false, 
  processingEntries = [], 
  processedEntryIds = [],
  onStartRecording, 
  onDeleteEntry 
}: JournalEntriesListProps) => {
  const [animatedEntryIds, setAnimatedEntryIds] = useState<number[]>([]);
  const [prevEntriesLength, setPrevEntriesLength] = useState(0);
  const [localEntries, setLocalEntriesState] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [renderRetryCount, setRenderRetryCount] = useState(0);
  const [persistedProcessingEntries, setPersistedProcessingEntries] = useState<string[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [processingToEntryMap, setProcessingToEntryMap] = useState<Map<string, number>>(new Map());
  const [visibleProcessingEntries, setVisibleProcessingEntries] = useState<string[]>([]);
  const [recentlyCompletedEntries, setRecentlyCompletedEntries] = useState<number[]>([]);
  const [processingToActualEntry, setProcessingToActualEntry] = useState<Map<string, JournalEntry>>(new Map());
  const [transitionalLoadingEntries, setTransitionalLoadingEntries] = useState<string[]>([]);
  const [seenEntryIds, setSeenEntryIds] = useState<Set<number>>(new Set());
  const [processedProcessingIds, setProcessedProcessingIds] = useState<Set<string>>(new Set());
  const [fullyProcessedEntries, setFullyProcessedEntries] = useState<Set<number>>(new Set());
  const [deletedEntryIds, setDeletedEntryIds] = useState<Set<number>>(new Set());
  const [deletedProcessingTempIds, setDeletedProcessingTempIds] = useState<Set<string>>(new Set());
  const [processingCardShouldShow, setProcessingCardShouldShow] = useState<boolean>(false);
  
  const mainProcessingEntryId = visibleProcessingEntries.length > 0 ? visibleProcessingEntries[0] : null;
  const hasProcessingEntries = mainProcessingEntryId !== null && processingEntries.length > 0;
  
  const componentMounted = useRef(true);
  const pendingDeletions = useRef<Set<number>>(new Set());
  const [renderError, setRenderError] = useState<Error | null>(null);
  const hasNoValidEntries = useRef(false);
  const processingStepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entryTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const displayedProcessingId = useRef<string | null>(null);
  const processingStateChangedRef = useRef(false);
  const dialogOpenRef = useRef(false);

  // Fix for the duplicate setLocalEntries issue - use a callback that uses the state setter
  const setLocalEntries = useCallback((entriesUpdate: React.SetStateAction<JournalEntry[]>) => {
    const newEntries = typeof entriesUpdate === 'function' 
      ? entriesUpdate(localEntries || []) 
      : entriesUpdate;
    
    setLocalEntriesState(newEntries);
    
    console.log('[JournalEntriesList] Local entries updated, count:', newEntries.length);
  }, [localEntries]);

  useEffect(() => {
    const handleEntryDeleted = (event: CustomEvent) => {
      if (event.detail && event.detail.entryId) {
        console.log(`[JournalEntriesList] Entry deleted event: ${event.detail.entryId}`);
        
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
        console.error('[JournalEntriesList] Error syncing deleted entries:', error);
      }
    };
    
    syncDeletedEntries();
    
    const syncInterval = setInterval(syncDeletedEntries, 2000);
    
    return () => {
      window.removeEventListener('entryDeleted', handleEntryDeleted as EventListener);
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[JournalEntriesList] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        
        if (deletedEntryIds.has(event.detail.entryId) || deletedProcessingTempIds.has(event.detail.tempId)) {
          console.log(`[JournalEntriesList] Skipping mapped entry ${event.detail.entryId} as it was deleted`);
          return;
        }
        
        if (processedProcessingIds.has(event.detail.tempId)) {
          console.log(`[JournalEntriesList] Already processed this tempId: ${event.detail.tempId}, skipping`);
          return;
        }
        
        setProcessingCardShouldShow(false);
        
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
          console.log(`[JournalEntriesList] Found matching entry for ${event.detail.tempId}:`, matchedEntry.id);
          
          setProcessingToActualEntry(prev => {
            const newMap = new Map(prev);
            newMap.set(event.detail.tempId, matchedEntry);
            return newMap;
          });
          
          setTransitionalLoadingEntries(prev => {
            if (prev.includes(event.detail.tempId)) return prev;
            return [...prev, event.detail.tempId];
          });
          
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
          console.log(`[JournalEntriesList] No matching entry found yet for ${event.detail.entryId}`);
          
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
          
          setAnimatedEntryIds(prev => {
            if (prev.includes(newEntryId)) return prev;
            return [...prev, newEntryId];
          });
          
          setTimeout(() => {
            if (componentMounted.current) {
              setAnimatedEntryIds(prev => prev.filter(id => id !== newEntryId));
              
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
    
    return () => {
      window.removeEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    };
  }, [entries, processedProcessingIds, deletedEntryIds, deletedProcessingTempIds]);

  useEffect(() => {
    if (entries.length > 0 && processingToEntryMap.size > 0) {
      processingToEntryMap.forEach((entryId, tempId) => {
        if (transitionalLoadingEntries.includes(tempId)) return;
        if (processedProcessingIds.has(tempId)) return;
        
        const matchedEntry = entries.find(entry => entry.id === entryId);
        
        if (matchedEntry) {
          console.log(`[JournalEntriesList] Found actual entry data for ${tempId}:`, matchedEntry.id);
          
          setProcessingCardShouldShow(false);
          
          setFullyProcessedEntries(prev => {
            const newSet = new Set(prev);
            newSet.add(matchedEntry.id);
            return newSet;
          });
          
          setProcessingToActualEntry(prev => {
            const newMap = new Map(prev);
            newMap.set(tempId, matchedEntry);
            return newMap;
          });
          
          if (!transitionalLoadingEntries.includes(tempId)) {
            setTransitionalLoadingEntries(prev => [...prev, tempId]);
          }
          
          setProcessedProcessingIds(prev => {
            const newSet = new Set(prev);
            newSet.add(tempId);
            return newSet;
          });
        }
      });
    }
  }, [entries, processingToEntryMap, transitionalLoadingEntries, processedProcessingIds]);

  useEffect(() => {
    const loadPersistedProcessingEntries = () => {
      const persistedEntries = getProcessingEntries();
      
      if (persistedEntries.length > 0) {
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        const validEntries = persistedEntries.filter(id => {
          const timestamp = parseInt(id.split('-').pop() || '0');
          const isRecent = !isNaN(timestamp) && timestamp > tenMinutesAgo;
          const isNotProcessed = !processedProcessingIds.has(id);
          const isNotDeleted = !deletedProcessingTempIds.has(id);
          const isNotCompleted = !isProcessingEntryCompleted(id);
          return isRecent && isNotProcessed && isNotDeleted && isNotCompleted;
        });
        
        setPersistedProcessingEntries(validEntries);
        
        const visibleEntries = validEntries
          .filter(id => !deletedProcessingTempIds.has(id))
          .slice(0, 1);
          
        setVisibleProcessingEntries(visibleEntries);
        
        setProcessingCardShouldShow(visibleEntries.length > 0);
      } else {
        setPersistedProcessingEntries([]);
        setVisibleProcessingEntries([]);
        setProcessingCardShouldShow(false);
      }
    };
    
    loadPersistedProcessingEntries();
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      processingStateChangedRef.current = true;
      
      if (event.detail && Array.isArray(event.detail.entries)) {
        if (event.detail.removedId) {
          const removedId = event.detail.removedId;
          if (typeof removedId === 'number' || !isNaN(Number(removedId))) {
            const numId = Number(removedId);
            setDeletedEntryIds(prev => {
              const newSet = new Set(prev);
              newSet.add(numId);
              return newSet;
            });
          } else {
            setDeletedProcessingTempIds(prev => {
              const newSet = new Set(prev);
              newSet.add(String(removedId));
              return newSet;
            });
          }
          
          setProcessingCardShouldShow(false);
        }
        
        if (event.detail.entries.length > 0) {
          const newEntries = event.detail.entries.filter(id => 
            !processedProcessingIds.has(id) && 
            !deletedProcessingTempIds.has(id) &&
            !isProcessingEntryCompleted(id)
          );
          
          setPersistedProcessingEntries(newEntries);
          
          const entriesToDisplay = newEntries
            .filter(tempId => 
              !Array.from(processingToEntryMap.keys()).includes(tempId) &&
              !deletedProcessingTempIds.has(tempId) &&
              !isProcessingEntryCompleted(tempId)
            )
            .slice(0, 1);
          
          setVisibleProcessingEntries(entriesToDisplay);
          
          setProcessingCardShouldShow(entriesToDisplay.length > 0 && !dialogOpenRef.current);
        } else {
          setPersistedProcessingEntries([]);
          setVisibleProcessingEntries([]);
          setProcessingCardShouldShow(false);
        }
      }
    };
    
    window.addEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPersistedProcessingEntries();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [processingToEntryMap, processedProcessingIds, deletedProcessingTempIds]);

  useEffect(() => {
    try {
      if (Array.isArray(entries)) {
        const currentEntryIds = new Set<number>();
        const entryIdToKeep = new Map<number, JournalEntry>();
        
        for (const entry of entries) {
          if (!entry || 
              typeof entry !== 'object' || 
              !entry.id || 
              pendingDeletions.current.has(entry.id) || 
              deletedEntryIds.has(entry.id) || 
              (!entry.content && !entry.created_at)) {
            continue;
          }
          
          entryIdToKeep.set(entry.id, entry);
          currentEntryIds.add(entry.id);
        }
        
        const filteredEntries = Array.from(entryIdToKeep.values());
        
        hasNoValidEntries.current = filteredEntries.length === 0 && entries.length > 0;
        
        const recentlyProcessedEntries = filteredEntries.filter(
          entry => recentlyCompletedEntries.includes(entry.id)
        );
        
        const regularEntries = filteredEntries.filter(
          entry => !recentlyCompletedEntries.includes(entry.id)
        );
        
        const uniqueEntries = [...recentlyProcessedEntries, ...regularEntries];
        const entryIds = uniqueEntries.map(entry => entry.id);
        
        setLocalEntriesState(uniqueEntries);
        setFilteredEntries(uniqueEntries);
        setSeenEntryIds(new Set(entryIds));
        
        setVisibleProcessingEntries(prev => {
          const filtered = prev.filter(tempId => {
            if (transitionalLoadingEntries.includes(tempId)) return true;
            if (deletedProcessingTempIds.has(tempId)) return false;
            
            const mappedEntryId = getEntryIdForProcessingId(tempId);
            if (!mappedEntryId) return true;
            
            if (!entryIds.includes(mappedEntryId) && !deletedEntryIds.has(mappedEntryId)) {
              return true;
            }
            
            return false;
          });
          
          setProcessingCardShouldShow(filtered.length > 0 && !dialogOpenRef.current);
          
          return filtered;
        });
      } else {
        console.warn('[JournalEntriesList] Entries is not an array:', entries);
        setLocalEntriesState([]);
        setFilteredEntries([]);
      }
    } catch (error) {
      console.error('[JournalEntriesList] Error processing entries:', error);
      setRenderError(error instanceof Error ? error : new Error('Unknown error processing entries'));
      setLocalEntriesState([]);
      setFilteredEntries([]);
    }

    return () => {
      componentMounted.current = false;
    };
  }, [entries, recentlyCompletedEntries, transitionalLoadingEntries, deletedEntryIds]);

  useEffect(() => {
    if (!componentMounted.current) return;
    
    try {
      if (Array.isArray(entries) && entries.length > 0) {
        if (entries.length > prevEntriesLength) {
          const newEntryIds: number[] = [];
          
          if (persistedProcessingEntries.length > 0) {
            persistedProcessingEntries.forEach(tempId => {
              if (processedProcessingIds.has(tempId)) return;
              if (deletedProcessingTempIds.has(tempId)) return;
              
              const mappedEntryId = getEntryIdForProcessingId(tempId);
              if (mappedEntryId && !animatedEntryIds.includes(mappedEntryId)) {
                console.log(`[JournalEntriesList] Found mapped entry ID for processing ${tempId}: ${mappedEntryId}`);
                newEntryIds.push(mappedEntryId);
                
                setFullyProcessedEntries(prev => {
                  const newSet = new Set(prev);
                  newSet.add(mappedEntryId);
                  return newSet;
                });
                
                setVisibleProcessingEntries(prev => 
                  prev.filter(id => id !== tempId)
                );
                
                setProcessedProcessingIds(prev => {
                  const newSet = new Set(prev);
                  newSet.add(tempId);
                  return newSet;
                });
                
                setProcessingCardShouldShow(false);
              }
            });
          }
          
          if (newEntryIds.length === 0) {
            for (const entry of entries) {
              if (entry && typeof entry === 'object' && entry.id && 
                  !animatedEntryIds.includes(entry.id) && 
                  !seenEntryIds.has(entry.id)) {
                newEntryIds.push(entry.id);
                
                setFullyProcessedEntries(prev => {
                  const newSet = new Set(prev);
                  newSet.add(entry.id);
                  return newSet;
                });
              }
            }
          }
            
          if (newEntryIds.length > 0) {
            console.log('[JournalEntriesList] New entries detected:', newEntryIds);
            setAnimatedEntryIds(prev => [...prev, ...newEntryIds]);
            
            setTimeout(() => {
              if (componentMounted.current) {
                setAnimatedEntryIds([]);
              }
            }, 5000);
          }
        }
        
        setPrevEntriesLength(entries.length);
      } else {
        setPrevEntriesLength(0);
      }
    } catch (error) {
      console.error('[JournalEntriesList] Error processing entry animations:', error);
      setAnimatedEntryIds([]);
    }
  }, [entries.length, prevEntriesLength, entries, persistedProcessingEntries, animatedEntryIds, seenEntryIds, processedProcessingIds, deletedProcessingTempIds]);
  
  const handleEntryDelete = async (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling deletion of entry ${entryId}`);
      
      dialogOpenRef.current = true;
      
      pendingDeletions.current.add(entryId);
      setDeletedEntryIds(prev => {
        const newSet = new Set(prev);
        newSet.add(entryId);
        return newSet;
      });
      
      setProcessingCardShouldShow(false);
      
      const tempIdsToDelete: string[] = [];
      visibleProcessingEntries.forEach(tempId => {
        const mappedId = getEntryIdForProcessingId(tempId);
        if (mappedId === entryId) {
          tempIdsToDelete.push(tempId);
        }
      });
      
      persistedProcessingEntries.forEach(tempId => {
        const mappedId = getEntryIdForProcessingId(tempId);
        if (mappedId === entryId) {
          tempIdsToDelete.push(tempId);
        }
      });
      
      processingToEntryMap.forEach((mappedEntryId, tempId) => {
        if (mappedEntryId === entryId) {
          tempIdsToDelete.push(tempId);
        }
      });
      
      if (tempIdsToDelete.length > 0) {
        console.log(`[JournalEntriesList] Marking temp IDs as deleted:`, tempIdsToDelete);
        setDeletedProcessingTempIds(prev => {
          const newSet = new Set(prev);
          tempIdsToDelete.forEach(id => newSet.add(id));
          return newSet;
        });
      }
      
      setVisibleProcessingEntries(prev => prev.filter(tempId => {
        const mappedId = getEntryIdForProcessingId(tempId);
        return mappedId !== entryId && !tempIdsToDelete.includes(tempId);
      }));
      
      setPersistedProcessingEntries(prev => prev.filter(tempId => {
        const mappedId = getEntryIdForProcessingId(tempId);
        return mappedId !== entryId && !tempIdsToDelete.includes(tempId);
      }));
      
      setTransitionalLoadingEntries(prev => {
        return prev.filter(tempId => {
          const mappedEntry = processingToActualEntry.get(tempId);
          return !mappedEntry || mappedEntry.id !== entryId;
        });
      });
      
      removeProcessingEntryById(entryId);
      
      setLocalEntries(prev => prev.filter(entry => entry.id !== entryId));
      setFilteredEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      if (onDeleteEntry) {
        setTimeout(async () => {
          if (componentMounted.current) {
            try {
              await onDeleteEntry(entryId);
              pendingDeletions.current.delete(entryId);
              dialogOpenRef.current = false;
            } catch (error) {
              console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
              pendingDeletions.current.delete(entryId);
              dialogOpenRef.current = false;
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error(`[JournalEntriesList] Error in handleEntryDelete for entry ${entryId}:`, error);
      
      if (componentMounted.current) {
        pendingDeletions.current.delete(entryId);
        dialogOpenRef.current = false;
      }
    }
  };

  useEffect(() => {
    return () => {
      console.log("[JournalEntriesList] Component unmounting");
      componentMounted.current = false;
      pendingDeletions.current.clear();
      if (processingStepTimeoutRef.current) {
        clearTimeout(processingStepTimeoutRef.current);
      }
      if (entryTransitionTimeoutRef.current) {
        clearTimeout(entryTransitionTimeoutRef.current);
      }
    };
  }, []);
  
  const handleEntrySelect = (entry: JournalEntry) => {
    console.log('Selected entry:', entry);
  };

  const handleSearchResults = (results: JournalEntry[]) => {
    setFilteredEntries(results);
    setIsSearchActive(results.length !== localEntries.length);
  };
  
  const showInitialLoading = loading && (!Array.isArray(localEntries) || localEntries.length === 0) && !hasProcessingEntries;
  
  const isLikelyNewUser = !loading && (!Array.isArray(localEntries) || localEntries.length === 0) && !visibleProcessingEntries.length;

  if (hasNoValidEntries.current) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">Your entries are still being processed</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      </div>
    );
  }

  if (showInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Loading your journal entries...</p>
      </div>
    );
  }

  if (isLikelyNewUser) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  const displayEntries = isSearchActive ? filteredEntries : localEntries;
  
  const uniqueEntriesMap = new Map<number, JournalEntry>();
  const safeLocalEntries = Array.isArray(displayEntries) ? displayEntries : [];
  
  for (const entry of safeLocalEntries) {
    if (!pendingDeletions.current.has(entry.id) && !deletedEntryIds.has(entry.id)) {
      uniqueEntriesMap.set(entry.id, entry);
    }
  }
  
  const finalDisplayEntries = Array.from(uniqueEntriesMap.values());
  
  const processedTransitionalEntries = transitionalLoadingEntries.filter(tempId => {
    const actualEntry = processingToActualEntry.get(tempId);
    return actualEntry && 
           fullyProcessedEntries.has(actualEntry.id) && 
           !deletedEntryIds.has(actualEntry.id);
  });
  
  const finalLocalEntries = finalDisplayEntries.filter(entry => {
    if (deletedEntryIds.has(entry.id)) return false;
    
    const hasMatchingTransitional = processedTransitionalEntries.some(tempId => {
      const transitionalEntry = processingToActualEntry.get(tempId);
      return transitionalEntry && transitionalEntry.id === entry.id;
    });
    return !hasMatchingTransitional;
  });

  const renderTransitionalEntry = (tempId: string) => {
    const actualEntry = processingToActualEntry.get(tempId);
    
    if (!actualEntry) {
      return (
        <div className="mb-4 bg-muted/40 border rounded-lg p-4 shadow-sm">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Processing New Entry</h3>
              <div className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                In Progress
              </div>
            </div>
            
            <div className="pt-2 text-sm">
              <LoadingEntryContent />
            </div>
          </div>
        </div>
      );
    }
    
    if (deletedEntryIds.has(actualEntry.id)) {
      return null;
    }
    
    return (
      <motion.div
        key={`transitional-${tempId}`}
        initial={{ opacity: 0.8 }}
        animate={{ 
          opacity: 1,
          transition: { duration: 0.5 }
        }}
        className="relative rounded-lg shadow-md overflow-hidden ring-2 ring-primary ring-opacity-50"
      >
        <JournalEntryCard 
          entry={actualEntry}
          onDelete={handleEntryDelete}
          isNew={true}
          isProcessing={false}
          setEntries={setLocalEntries}
        />
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="absolute inset-0 bg-white dark:bg-black pointer-events-none flex items-center justify-center"
        >
          <CheckCircle2 className="h-12 w-12 text-green-500 animate-pulse" />
        </motion.div>
      </motion.div>
    );
  };

  const shouldShowProcessingCard = hasProcessingEntries && 
    processingCardShouldShow &&
    !processedTransitionalEntries.some(id => id === mainProcessingEntryId) &&
    (!mainProcessingEntryId || 
      !getEntryIdForProcessingId(mainProcessingEntryId) || 
      (!deletedEntryIds.has(getEntryIdForProcessingId(mainProcessingEntryId)!) &&
       !deletedProcessingTempIds.has(mainProcessingEntryId))) &&
    !dialogOpenRef.current;

  return (
    <ErrorBoundary>
      <div className="space-y-4 pb-20">
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Journal Entries</h2>
            <Button onClick={onStartRecording} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </div>
        </div>

        <JournalSearch 
          entries={localEntries}
          onSelectEntry={handleEntrySelect}
          onSearchResults={handleSearchResults}
        />

        <AnimatePresence>
          <div className="space-y-4 mt-6">
            {processedTransitionalEntries.length > 0 && processedTransitionalEntries.map(tempId => (
              <ErrorBoundary key={`transitional-boundary-${tempId}`}>
                {renderTransitionalEntry(tempId)}
              </ErrorBoundary>
            ))}
            
            {shouldShowProcessingCard && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-4 bg-muted/40 border rounded-lg p-4 shadow-sm"
              >
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Processing New Entry</h3>
                    <div className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                      In Progress
                    </div>
                  </div>
                  
                  <div className="pt-2 text-sm">
                    <LoadingEntryContent />
                  </div>
                </div>
              </motion.div>
            )}
            
            {finalDisplayEntries.length === 0 && !shouldShowProcessingCard && !loading ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-64 p-8 text-center"
              >
                <div className="mb-6">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Mic className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Welcome to SOuLO!</h3>
                  <p className="text-muted-foreground mb-6">
                    Your journal journey begins with your voice. Start recording your first entry now.
                  </p>
                </div>
                <Button 
                  onClick={onStartRecording} 
                  size="lg" 
                  className="gap-2 animate-pulse"
                >
                  <Mic className="h-5 w-5" />
                  Start Journaling
                </Button>
              </motion.div>
            ) : (
              finalDisplayEntries.map((entry, index) => (
                <ErrorBoundary key={`entry-boundary-${entry.id}`}>
                  <motion.div
                    key={`entry-${entry.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      boxShadow: animatedEntryIds.includes(entry.id) ? 
                        '0 0 0 2px rgba(var(--color-primary), 0.5)' : 
                        'none'
                    }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: index === 0 && safeLocalEntries.length > prevEntriesLength ? 0 : 0.05 * Math.min(index, 5) 
                    }}
                    className={animatedEntryIds.includes(entry.id) ? 
                      "rounded-lg shadow-md relative overflow-hidden ring-2 ring-primary ring-opacity-50" : 
                      "relative overflow-hidden"
                    }
                  >
                    <
