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
import { useDebugLog } from '@/utils/debug/DebugContext';

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
  const [stableVisibleProcessingEntries, setStableVisibleProcessingEntries] = useState<string[]>([]);
  const lastProcessingChangeTimestamp = useRef(0);
  const processingEntriesTimerRef = useRef<NodeJS.Timeout | null>(null);
  const processingEntryRemovalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateUpdateVersionRef = useRef(0);
  const entriesCheckedForCompletionRef = useRef<Record<string, boolean>>({});
  const { addEvent } = useDebugLog();

  useEffect(() => {
    addEvent('JournalEntries', 'Processing entries state', 'info', {
      processingEntries,
      persistedProcessingEntries,
      showTemporaryProcessingEntries,
      stableVisibleProcessingEntries: stableVisibleProcessingEntries.length
    });
  }, [processingEntries, persistedProcessingEntries, showTemporaryProcessingEntries, stableVisibleProcessingEntries, addEvent]);

  useEffect(() => {
    const loadPersistedProcessingEntries = () => {
      const persistedEntries = getProcessingEntries();
      addEvent('JournalEntries', 'Loaded persisted entries', 'info', persistedEntries);
      setPersistedProcessingEntries(persistedEntries);
      
      if (persistedEntries.length > 0) {
        setProcessingEntriesLoaded(true);
        setShowTemporaryProcessingEntries(true);
        setStableVisibleProcessingEntries(persistedEntries);
      }
    };
    
    loadPersistedProcessingEntries();
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      addEvent('JournalEntries', 'Processing entries changed event received', 'info', event.detail);
      if (event.detail && Array.isArray(event.detail.entries)) {
        setPersistedProcessingEntries(event.detail.entries);
        
        if (event.detail.entries.length > 0) {
          setProcessingEntriesLoaded(true);
          setShowTemporaryProcessingEntries(true);
          if (event.detail.forceUpdate) {
            setStableVisibleProcessingEntries(event.detail.entries);
            addEvent('JournalEntries', 'Force updated visible processing entries', 'success', event.detail.entries);
          }
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
    
    addEvent('JournalEntries', 'JournalEntriesList mounted', 'info');
    
    return () => {
      window.removeEventListener('processingEntriesChanged', handleProcessingEntriesChanged as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (processingEntriesTimerRef.current) {
        clearTimeout(processingEntriesTimerRef.current);
      }
      addEvent('JournalEntries', 'JournalEntriesList unmounted', 'info');
    };
  }, [addEvent]);

  useEffect(() => {
    const allProcessingEntries = [...new Set([...processingEntries, ...persistedProcessingEntries])];
    console.log('[JournalEntriesList] Combined processing entries:', allProcessingEntries);
    
    const now = Date.now();
    const timeSinceLastChange = now - lastProcessingChangeTimestamp.current;
    
    if (processingEntriesTimerRef.current) {
      clearTimeout(processingEntriesTimerRef.current);
    }
    
    const currentVersion = ++stateUpdateVersionRef.current;
    
    const entriesIds = entries.map(entry => String(entry.id));
    const uniqueProcessingEntries = allProcessingEntries.filter(tempId => {
      const possibleId = tempId.split('-').pop();
      return !entriesIds.some(id => id === possibleId || tempId.includes(id));
    });
    
    if (uniqueProcessingEntries.length > 0) {
      setStableVisibleProcessingEntries(uniqueProcessingEntries);
      setShowTemporaryProcessingEntries(true);
      setProcessingEntriesLoaded(true);
    } else if (allProcessingEntries.length === 0) {
      setShowTemporaryProcessingEntries(false);
      setStableVisibleProcessingEntries([]);
    }

    let hasNewCompletedEntries = false;
    let hasEntriesWithContentButNoMetadata = false;
    
    entries.forEach(entry => {
      if (!entry || !entry.id) return;
      
      const entryIdStr = String(entry.id);
      const isBeingProcessed = allProcessingEntries.some(tempId => tempId.includes(entryIdStr));
      
      if (!isBeingProcessed) return;
      
      if (entriesCheckedForCompletionRef.current[entryIdStr]) return;
      
      const isContentComplete = entry.content && 
                            entry.content !== "Processing entry..." && 
                            entry.content.trim() !== "";
                       
      const hasThemesOrSentiment = (Array.isArray(entry.themes) && entry.themes.length > 0) || 
                              (Array.isArray(entry.master_themes) && entry.master_themes.length > 0) ||
                              entry.sentiment;
      
      if (isContentComplete && !hasThemesOrSentiment) {
        hasEntriesWithContentButNoMetadata = true;
        console.log(`[JournalEntriesList] Entry ${entry.id} has content but metadata is still processing`);
      }
      
      if (isContentComplete && hasThemesOrSentiment) {
        console.log(`[JournalEntriesList] Entry ${entry.id} is fully complete with content and metadata`);
        entriesCheckedForCompletionRef.current[entryIdStr] = true;
        hasNewCompletedEntries = true;
      }
    });
    
    if (hasNewCompletedEntries) {
      console.log("[JournalEntriesList] New completed entries detected, scheduling processing indicators removal");
      
      if (processingEntryRemovalTimerRef.current) {
        clearTimeout(processingEntryRemovalTimerRef.current);
      }
      
      processingEntryRemovalTimerRef.current = setTimeout(() => {
        console.log("[JournalEntriesList] Executing delayed removal of processing indicators");
        setShowTemporaryProcessingEntries(false);
        
        const updatedProcessingEntries = allProcessingEntries.filter(tempId => {
          return !entries.some(entry => tempId.includes(String(entry.id)));
        });
        
        if (updatedProcessingEntries.length !== allProcessingEntries.length) {
          localStorage.setItem('processingEntries', JSON.stringify(updatedProcessingEntries));
          
          window.dispatchEvent(new CustomEvent('processingEntriesChanged', {
            detail: { entries: updatedProcessingEntries, lastUpdate: Date.now() }
          }));
        }
      }, 500);
    }
  }, [processingEntries, persistedProcessingEntries, entries]);

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
            console.log('[JournalEntriesList] New entries detected:', newEntryIds);
            setAnimatedEntryIds(prev => [...prev, ...newEntryIds]);
            
            setShowTemporaryProcessingEntries(false);
            
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
            {(showTemporaryProcessingEntries && stableVisibleProcessingEntries.length > 0) && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4"
                onAnimationStart={() => addEvent('JournalEntries', 'Processing loader animation started', 'info')}
                onAnimationComplete={() => addEvent('JournalEntries', 'Processing loader animation completed', 'info')}
              >
                <div className="flex items-center gap-2 text-sm text-primary font-medium mb-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing your new entry...</span>
                </div>
                <JournalEntryLoadingSkeleton count={stableVisibleProcessingEntries.length || 1} />
              </motion.div>
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
              safeLocalEntries.map((entry, index) => (
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
