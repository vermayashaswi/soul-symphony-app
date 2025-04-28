
import React, { useEffect, useState, useRef } from 'react';
import { JournalEntry } from '@/types/journal';
import { Button } from '@/components/ui/button';
import { Plus, Mic, Loader2 } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';
import JournalSearch from './JournalSearch';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { getEntryIdForProcessingId } from '@/utils/audio-processing';

// Import our refactored components and hooks
import { useProcessingEntries } from '@/hooks/use-processing-entries';
import { useJournalEntriesState } from '@/hooks/use-journal-entries-state';
import { ProcessingEntryCard } from './entry-card/ProcessingEntryCard';
import { ProcessingIndicator } from './entry-card/ProcessingIndicator';
import { WelcomeMessage } from './WelcomeMessage';
import { JournalEntriesHeader } from './JournalEntriesHeader';
import { JournalEntryList } from './JournalEntryList';
import { LoadingIndicator, InitialLoadingState } from './LoadingIndicator';

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
  // State from our custom hooks
  const {
    localEntries,
    filteredEntries,
    animatedEntryIds,
    isSearchActive,
    setLocalEntries,
    setFilteredEntries,
    setAnimatedEntryIds,
    setIsSearchActive,
    pendingDeletions
  } = useJournalEntriesState();

  const {
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
    setVisibleProcessingEntries
  } = useProcessingEntries({
    entries,
    processingEntries
  });

  // Local state
  const [prevEntriesLength, setPrevEntriesLength] = useState(0);
  const [renderRetryCount, setRenderRetryCount] = useState(0);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [seenEntryIds, setSeenEntryIds] = useState<Set<number>>(new Set());
  
  // Refs
  const componentMounted = useRef<boolean>(true);
  const hasNoValidEntries = useRef(false);
  const processingStepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entryTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const displayedProcessingId = useRef<string | null>(null);
  const processingStateChangedRef = useRef(false);
  const dialogOpenRef = useRef(false);

  // Derived values
  const mainProcessingEntryId = visibleProcessingEntries.length > 0 ? visibleProcessingEntries[0] : null;
  const hasProcessingEntries = mainProcessingEntryId !== null && processingEntries.length > 0;

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
              deletedEntryIds.has(entry.id)) {
            continue;
          }
          
          if (entry.content || entry.created_at || entry['transcription text'] || entry['refined text']) {
            entryIdToKeep.set(entry.id, entry);
            currentEntryIds.add(entry.id);
          }
        }
        
        const filteredEntries = Array.from(entryIdToKeep.values());
        
        const processingEntriesToShow = processingEntries.filter(id => {
          const mappedEntryId = getEntryIdForProcessingId(id);
          return !mappedEntryId || !currentEntryIds.has(mappedEntryId);
        });
        
        if (processingEntriesToShow.length > 0) {
          console.log('[JournalEntriesList] Found processing entries to show:', processingEntriesToShow);
          setVisibleProcessingEntries(processingEntriesToShow);
          setProcessingCardShouldShow(true);
        }
        
        hasNoValidEntries.current = filteredEntries.length === 0 && entries.length > 0;
        
        const recentlyProcessedEntries = filteredEntries.filter(
          entry => recentlyCompletedEntries.includes(entry.id)
        );
        
        const regularEntries = filteredEntries.filter(
          entry => !recentlyCompletedEntries.includes(entry.id)
        );
        
        const uniqueEntries = [...recentlyProcessedEntries, ...regularEntries];
        const entryIds = uniqueEntries.map(entry => entry.id);
        
        setLocalEntries(uniqueEntries);
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
        setLocalEntries([]);
        setFilteredEntries([]);
      }
    } catch (error) {
      console.error('[JournalEntriesList] Error processing entries:', error);
      setRenderError(error instanceof Error ? error : new Error('Unknown error processing entries'));
      setLocalEntries([]);
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
        <p className="text-muted-foreground mb-4"><TranslatableText text="Your entries are still being processed" /></p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      </div>
    );
  }

  if (showInitialLoading) {
    return <InitialLoadingState />;
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
  
  const processedTransitionalEntries = transitionalLoadingEntries.filter(tempId => {
    const actualEntry = processingToActualEntry.get(tempId);
    return actualEntry && 
           fullyProcessedEntries.has(actualEntry.id) && 
           !deletedEntryIds.has(actualEntry.id);
  });
  
  const finalDisplayEntries = Array.from(uniqueEntriesMap.values()).filter(entry => {
    const isProcessing = visibleProcessingEntries.some(tempId => {
      const mappedId = getEntryIdForProcessingId(tempId);
      return mappedId === entry.id;
    });
    
    if (deletedEntryIds.has(entry.id)) return false;
    
    const hasMatchingTransitional = processedTransitionalEntries.some(tempId => {
      const transitionalEntry = processingToActualEntry.get(tempId);
      return transitionalEntry && transitionalEntry.id === entry.id;
    });
    
    return !isProcessing && !hasMatchingTransitional;
  });

  const shouldShowProcessingCard = 
    hasProcessingEntries && 
    processingCardShouldShow &&
    !processedTransitionalEntries.some(id => id === mainProcessingEntryId) &&
    (!mainProcessingEntryId || 
      !getEntryIdForProcessingId(mainProcessingEntryId) || 
      (!deletedEntryIds.has(getEntryIdForProcessingId(mainProcessingEntryId)!) &&
       !deletedProcessingTempIds.has(mainProcessingEntryId))) &&
    !dialogOpenRef.current &&
    !visibleProcessingEntries.some(tempId => {
      const mappedId = getEntryIdForProcessingId(tempId);
      return mappedId && entries.some(entry => entry.id === mappedId);
    });

  return (
    <ErrorBoundary>
      <div className="space-y-4 pb-20">
        <JournalEntriesHeader onStartRecording={onStartRecording} />

        <JournalSearch 
          entries={localEntries}
          onSelectEntry={handleEntrySelect}
          onSearchResults={handleSearchResults}
        />

        <AnimatePresence>
          <div className="space-y-4 mt-6">
            {processedTransitionalEntries.length > 0 && processedTransitionalEntries.map(tempId => (
              <ErrorBoundary key={`transitional-boundary-${tempId}`}>
                <ProcessingEntryCard
                  tempId={tempId}
                  actualEntry={processingToActualEntry.get(tempId)}
                  deletedEntryIds={deletedEntryIds}
                  onDelete={handleEntryDelete}
                  setLocalEntries={setLocalEntries}
                />
              </ErrorBoundary>
            ))}
            
            <ProcessingIndicator shouldShow={shouldShowProcessingCard} />
            
            {finalDisplayEntries.length === 0 && !shouldShowProcessingCard && !loading ? (
              <WelcomeMessage onStartRecording={onStartRecording} />
            ) : (
              <JournalEntryList 
                entries={finalDisplayEntries}
                animatedEntryIds={animatedEntryIds}
                recentlyCompletedEntries={recentlyCompletedEntries}
                onDelete={handleEntryDelete}
                setLocalEntries={setLocalEntries}
                prevEntriesLength={prevEntriesLength}
              />
            )}
          </div>
        </AnimatePresence>
        
        <LoadingIndicator show={loading && safeLocalEntries.length > 0 && !hasProcessingEntries} />
      </div>
    </ErrorBoundary>
  );
};

export default JournalEntriesList;
