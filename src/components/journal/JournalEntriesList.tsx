import React, { useEffect, useState, useRef } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Mic } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';
import JournalSearch from './JournalSearch';
import { getProcessingEntries } from '@/utils/audio-processing';

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
  const hasProcessingEntries = Array.isArray(processingEntries) && processingEntries.length > 0 || persistedProcessingEntries.length > 0;
  const componentMounted = useRef(true);
  const pendingDeletions = useRef<Set<number>>(new Set());
  const [renderError, setRenderError] = useState<Error | null>(null);
  const hasNoValidEntries = useRef(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [processingEntriesLoaded, setProcessingEntriesLoaded] = useState(false);
  const [showTemporaryProcessingEntries, setShowTemporaryProcessingEntries] = useState(true);
  const [visibleProcessingEntries, setVisibleProcessingEntries] = useState<string[]>([]);
  const [entriesInTransition, setEntriesInTransition] = useState<{id: number, tempId: string}[]>([]);
  const [completedProcessingIds, setCompletedProcessingIds] = useState<string[]>([]);

  useEffect(() => {
    const loadPersistedProcessingEntries = () => {
      const persistedEntries = getProcessingEntries();
      setPersistedProcessingEntries(persistedEntries);
      
      if (persistedEntries.length > 0) {
        setProcessingEntriesLoaded(true);
        setShowTemporaryProcessingEntries(true);
      }
    };
    
    loadPersistedProcessingEntries();
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.entries)) {
        setPersistedProcessingEntries(event.detail.entries);
        
        if (event.detail.entries.length > 0) {
          setProcessingEntriesLoaded(true);
          setShowTemporaryProcessingEntries(true);
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
  }, []);

  useEffect(() => {
    const allProcessingEntries = [...new Set([...processingEntries, ...persistedProcessingEntries])];
    setVisibleProcessingEntries(allProcessingEntries);
    
    if (allProcessingEntries.length > 0) {
      setShowTemporaryProcessingEntries(true);
      setProcessingEntriesLoaded(true);
    }
    
    if (Array.isArray(entries) && entries.length > 0 && allProcessingEntries.length > 0) {
      const newCompletedIds: string[] = [];
      const newTransitionEntries: {id: number, tempId: string}[] = [];
      
      entries.forEach(entry => {
        allProcessingEntries.forEach(tempId => {
          if (tempId.includes(String(entry.id)) && 
              entry.content && 
              entry.content !== "Processing entry..." && 
              entry.content.trim() !== "") {
            
            const hasThemes = (Array.isArray(entry.themes) && entry.themes.length > 0) || 
                            (Array.isArray(entry.master_themes) && entry.master_themes.length > 0);
            
            if (hasThemes) {
              newCompletedIds.push(tempId);
            } else {
              newTransitionEntries.push({id: entry.id, tempId});
            }
          }
        });
      });
      
      if (newCompletedIds.length > 0) {
        setCompletedProcessingIds(prev => [...prev, ...newCompletedIds]);
        setTimeout(() => {
          setVisibleProcessingEntries(prev => 
            prev.filter(id => !newCompletedIds.includes(id))
          );
        }, 500);
      }
      
      if (newTransitionEntries.length > 0) {
        setEntriesInTransition(prev => {
          const newEntries = [...prev];
          newTransitionEntries.forEach(item => {
            if (!newEntries.some(e => e.id === item.id)) {
              newEntries.push(item);
            }
          });
          return newEntries;
        });
      }
    }
    
    if (completedProcessingIds.length > 0 && 
        completedProcessingIds.length === allProcessingEntries.length && 
        allProcessingEntries.length > 0) {
      setTimeout(() => {
        setShowTemporaryProcessingEntries(false);
      }, 1000);
    }
  }, [processingEntries, persistedProcessingEntries, entries, completedProcessingIds]);

  useEffect(() => {
    try {
      if (Array.isArray(entries)) {
        const filteredEntries = entries.filter(
          entry => entry && 
                  typeof entry === 'object' && 
                  entry.id && 
                  !pendingDeletions.current.has(entry.id) &&
                  (entry.content || entry.created_at)
        );
        
        hasNoValidEntries.current = filteredEntries.length === 0 && entries.length > 0;
        
        setLocalEntries(filteredEntries);
        setFilteredEntries(filteredEntries);
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
  }, [entries]);

  useEffect(() => {
    if (!componentMounted.current) return;
    
    try {
      if (Array.isArray(entries) && entries.length > 0) {
        if (entries.length > prevEntriesLength) {
          const newEntryIds: number[] = [];
          
          for (let i = 0; i < Math.min(entries.length - prevEntriesLength, entries.length); i++) {
            const entry = entries[i];
            if (entry && typeof entry === 'object' && entry.id) {
              newEntryIds.push(entry.id);
            }
          }
            
          if (newEntryIds.length > 0) {
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
  }, [entries.length, prevEntriesLength, entries]);
  
  const handleEntryDelete = async (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling deletion of entry ${entryId}`);
      
      pendingDeletions.current.add(entryId);
      
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
    };
  }, []);
  
  const handleEntrySelect = (entry: JournalEntry) => {
    console.log('Selected entry:', entry);
  };

  const handleSearchResults = (results: JournalEntry[]) => {
    setFilteredEntries(results);
    setIsSearchActive(results.length !== localEntries.length);
  };
  
  const allProcessingEntries = [...new Set([...processingEntries, ...persistedProcessingEntries])];
  const showInitialLoading = loading && (!Array.isArray(localEntries) || localEntries.length === 0) && !hasProcessingEntries;
  
  const isLikelyNewUser = !loading && (!Array.isArray(localEntries) || localEntries.length === 0) && !allProcessingEntries.length;

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
  const safeLocalEntries = Array.isArray(displayEntries) ? displayEntries : [];
  
  const currentlyProcessingEntries = visibleProcessingEntries.filter(
    id => !completedProcessingIds.includes(id)
  );

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
            {(showTemporaryProcessingEntries || currentlyProcessingEntries.length > 0) && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-primary font-medium mb-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing your new entry...</span>
                </div>
                <JournalEntryLoadingSkeleton count={currentlyProcessingEntries.length || 1} />
              </div>
            )}
            
            {safeLocalEntries.length === 0 && !hasProcessingEntries && !loading && !processingEntriesLoaded ? (
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
              safeLocalEntries.map((entry, index) => {
                const isEntryInTransition = entriesInTransition.some(e => e.id === entry.id);
                const matchingTempId = entriesInTransition.find(e => e.id === entry.id)?.tempId;
                
                const showProcessing = currentlyProcessingEntries.some(id => id.includes(String(entry.id))) ||
                                      isEntryInTransition;
                
                return (
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
                        "rounded-lg shadow-md relative overflow-hidden" : 
                        "relative overflow-hidden"
                      }
                    >
                      <JournalEntryCard 
                        entry={entry} 
                        onDelete={handleEntryDelete} 
                        isNew={animatedEntryIds.includes(entry.id)}
                        isProcessing={showProcessing}
                      />
                    </motion.div>
                  </ErrorBoundary>
                );
              })
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
