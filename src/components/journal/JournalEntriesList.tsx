import React, { useEffect, useState, useRef } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Mic, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';
import JournalSearch from './JournalSearch';
import { getProcessingEntries, getEntryIdForProcessingId, removeProcessingEntryById } from '@/utils/audio-processing';
import { LoadingEntryContent } from './entry-card/LoadingEntryContent';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[];
  processedEntryIds?: number[];
  onStartRecording: () => void;
  onDeleteEntry?: (entryId: number) => Promise<void> | void;
}

export default function JournalEntriesList({ 
  entries = [],
  loading = false, 
  processingEntries = [], 
  processedEntryIds = [],
  onStartRecording, 
  onDeleteEntry 
}: JournalEntriesListProps) {
  const [animatedEntryIds, setAnimatedEntryIds] = useState<number[]>([]);
  const [prevEntriesLength, setPrevEntriesLength] = useState(0);
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
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
  
  const mainProcessingEntryId = visibleProcessingEntries.length > 0 ? visibleProcessingEntries[0] : null;
  const hasProcessingEntries = mainProcessingEntryId !== null && processingEntries.length > 0;
  
  const componentMounted = useRef(true);
  const pendingDeletions = useRef<Set<number>>(new Set());
  const [renderError, setRenderError] = useState<Error | null>(null);
  const hasNoValidEntries = useRef(false);
  const processingStepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const entryTransitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const displayedProcessingId = useRef<string | null>(null);

  useEffect(() => {
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[JournalEntriesList] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        
        if (processedProcessingIds.has(event.detail.tempId)) {
          console.log(`[JournalEntriesList] Already processed this tempId: ${event.detail.tempId}, skipping`);
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
  }, [entries, processedProcessingIds]);

  useEffect(() => {
    if (entries.length > 0 && processingToEntryMap.size > 0) {
      processingToEntryMap.forEach((entryId, tempId) => {
        if (transitionalLoadingEntries.includes(tempId)) return;
        if (processedProcessingIds.has(tempId)) return;
        
        const matchedEntry = entries.find(entry => entry.id === entryId);
        
        if (matchedEntry) {
          console.log(`[JournalEntriesList] Found actual entry data for ${tempId}:`, matchedEntry.id);
          
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
          return isRecent && isNotProcessed;
        });
        
        setPersistedProcessingEntries(validEntries);
        setVisibleProcessingEntries(validEntries.slice(0, 1));
      } else {
        setPersistedProcessingEntries([]);
        setVisibleProcessingEntries([]);
      }
    };
    
    loadPersistedProcessingEntries();
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.entries)) {
        if (event.detail.entries.length > 0) {
          const newEntries = event.detail.entries.filter(id => !processedProcessingIds.has(id));
          
          setPersistedProcessingEntries(newEntries);
          
          setVisibleProcessingEntries(prev => {
            const entriesWithoutMapping = newEntries
              .filter(tempId => !Array.from(processingToEntryMap.keys()).includes(tempId))
              .slice(0, 1);
            
            return entriesWithoutMapping;
          });
        } else {
          setPersistedProcessingEntries([]);
          setVisibleProcessingEntries([]);
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
  }, [processingToEntryMap, processedProcessingIds]);

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
        
        setLocalEntries(uniqueEntries);
        setFilteredEntries(uniqueEntries);
        setSeenEntryIds(new Set(entryIds));
        
        setVisibleProcessingEntries(prev => {
          return prev.filter(tempId => {
            if (transitionalLoadingEntries.includes(tempId)) return true;
            
            const mappedEntryId = getEntryIdForProcessingId(tempId);
            return !mappedEntryId || !entryIds.includes(mappedEntryId);
          });
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
  }, [entries, recentlyCompletedEntries, transitionalLoadingEntries]);

  useEffect(() => {
    if (!componentMounted.current) return;
    
    try {
      if (Array.isArray(entries) && entries.length > 0) {
        if (entries.length > prevEntriesLength) {
          const newEntryIds: number[] = [];
          
          if (persistedProcessingEntries.length > 0) {
            persistedProcessingEntries.forEach(tempId => {
              if (processedProcessingIds.has(tempId)) return;
              
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
  }, [entries.length, prevEntriesLength, entries, persistedProcessingEntries, animatedEntryIds, seenEntryIds, processedProcessingIds]);
  
  const handleEntryDelete = async (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling deletion of entry ${entryId}`);
      
      pendingDeletions.current.add(entryId);
      
      setVisibleProcessingEntries(prev => prev.filter(tempId => {
        const mappedId = getEntryIdForProcessingId(tempId);
        return mappedId !== entryId;
      }));
      
      setTransitionalLoadingEntries(prev => {
        return prev.filter(tempId => {
          const mappedEntry = processingToActualEntry.get(tempId);
          return !mappedEntry || mappedEntry.id !== entryId;
        });
      });
      
      removeProcessingEntryById(entryId);
      
      setLocalEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      if (onDeleteEntry) {
        setTimeout(async () => {
          if (componentMounted.current) {
            try {
              await onDeleteEntry(entryId);
              pendingDeletions.current.delete(entryId);
            } catch (error) {
              console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
              pendingDeletions.current.delete(entryId);
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error(`[JournalEntriesList] Error in handleEntryDelete for entry ${entryId}:`, error);
      
      if (componentMounted.current) {
        pendingDeletions.current.delete(entryId);
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
    if (!pendingDeletions.current.has(entry.id)) {
      uniqueEntriesMap.set(entry.id, entry);
    }
  }
  
  const finalDisplayEntries = Array.from(uniqueEntriesMap.values());
  
  const processedTransitionalEntries = transitionalLoadingEntries.filter(tempId => {
    const actualEntry = processingToActualEntry.get(tempId);
    return actualEntry && fullyProcessedEntries.has(actualEntry.id);
  });
  
  const finalLocalEntries = finalDisplayEntries.filter(entry => {
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

  return (
    <ErrorBoundary>
      <div>
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
            
            {hasProcessingEntries && !processedTransitionalEntries.some(id => id === mainProcessingEntryId) && (
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
            
            {finalDisplayEntries.length === 0 && !hasProcessingEntries && !loading ? (
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
                    <JournalEntryCard 
                      entry={entry} 
                      onDelete={handleEntryDelete} 
                      isNew={animatedEntryIds.includes(entry.id) || recentlyCompletedEntries.includes(entry.id)}
                      isProcessing={false}
                    />
                  </motion.div>
                </ErrorBoundary>
              ))
            )}
          </div>
        </AnimatePresence>
        
        {loading && safeLocalEntries.length > 0 && !hasProcessingEntries && (
          <div className="flex items-center justify-center h-16 mt-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
