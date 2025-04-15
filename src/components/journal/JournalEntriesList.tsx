
import React, { useEffect, useState, useRef } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Mic, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';
import JournalSearch from './JournalSearch';
import { getProcessingEntries, getEntryIdForProcessingId } from '@/utils/audio-processing';
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
  const hasProcessingEntries = visibleProcessingEntries.length > 0;
  const componentMounted = useRef(true);
  const pendingDeletions = useRef<Set<number>>(new Set());
  const [renderError, setRenderError] = useState<Error | null>(null);
  const hasNoValidEntries = useRef(false);
  const processingStepTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for mapping events between processing IDs and entry IDs
  useEffect(() => {
    const handleProcessingEntryMapped = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId && event.detail.entryId) {
        console.log(`[JournalEntriesList] Processing entry mapped: ${event.detail.tempId} -> ${event.detail.entryId}`);
        
        setProcessingToEntryMap(prev => {
          const newMap = new Map(prev);
          newMap.set(event.detail.tempId, event.detail.entryId);
          return newMap;
        });
        
        // When we have a mapping, remove this entry from visible processing entries
        setVisibleProcessingEntries(prev => 
          prev.filter(id => id !== event.detail.tempId)
        );
        
        // Check if this entry is in our current entries list and highlight it
        const newEntryId = event.detail.entryId;
        if (newEntryId && !animatedEntryIds.includes(newEntryId)) {
          setAnimatedEntryIds(prev => [...prev, newEntryId]);
          
          // Remove highlight after 5 seconds
          setTimeout(() => {
            if (componentMounted.current) {
              setAnimatedEntryIds(prev => prev.filter(id => id !== newEntryId));
            }
          }, 5000);
        }
      }
    };
    
    window.addEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    
    return () => {
      window.removeEventListener('processingEntryMapped', handleProcessingEntryMapped as EventListener);
    };
  }, [animatedEntryIds]);

  // Load persisted processing entries from localStorage - but only if they're actually being processed
  useEffect(() => {
    const loadPersistedProcessingEntries = () => {
      const persistedEntries = getProcessingEntries();
      
      // Verify these entries are really being processed
      if (persistedEntries.length > 0) {
        // Filter out any entries that might be stale (older than 10 minutes)
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        const validEntries = persistedEntries.filter(id => {
          const timestamp = parseInt(id.split('-').pop() || '0');
          return !isNaN(timestamp) && timestamp > tenMinutesAgo;
        });
        
        setPersistedProcessingEntries(validEntries);
        setVisibleProcessingEntries(validEntries);
      } else {
        setPersistedProcessingEntries([]);
        setVisibleProcessingEntries([]);
      }
    };
    
    loadPersistedProcessingEntries();
    
    const handleProcessingEntriesChanged = (event: CustomEvent) => {
      if (event.detail && Array.isArray(event.detail.entries)) {
        // Only update if we actually have entries to process
        if (event.detail.entries.length > 0) {
          setPersistedProcessingEntries(event.detail.entries);
          
          // Update visible processing entries as well
          const newEntries = event.detail.entries;
          setVisibleProcessingEntries(prev => {
            // Only add entries that aren't already mapped to an entryId
            const entriesWithoutMapping = newEntries.filter(tempId => 
              !Array.from(processingToEntryMap.keys()).includes(tempId)
            );
            
            return entriesWithoutMapping;
          });
        } else {
          // If we have no entries, clear both states
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
  }, [processingToEntryMap]);

  // Process and filter entries
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
        
        // Check if any new entries correspond to processing entries and update visibility
        const entryIds = filteredEntries.map(entry => entry.id);
        
        setVisibleProcessingEntries(prev => {
          return prev.filter(tempId => {
            const mappedEntryId = getEntryIdForProcessingId(tempId);
            // Keep only processing entries that don't have a corresponding entry in the list
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
  }, [entries]);

  // Track new entries for animation
  useEffect(() => {
    if (!componentMounted.current) return;
    
    try {
      if (Array.isArray(entries) && entries.length > 0) {
        if (entries.length > prevEntriesLength) {
          // Find newly added entries
          const newEntryIds: number[] = [];
          
          // Check processing entries first - these have priority for animation
          if (persistedProcessingEntries.length > 0) {
            persistedProcessingEntries.forEach(tempId => {
              const mappedEntryId = getEntryIdForProcessingId(tempId);
              if (mappedEntryId && !animatedEntryIds.includes(mappedEntryId)) {
                console.log(`[JournalEntriesList] Found mapped entry ID for processing ${tempId}: ${mappedEntryId}`);
                newEntryIds.push(mappedEntryId);
                
                // Once we've found the entry, remove it from visible processing entries
                setVisibleProcessingEntries(prev => 
                  prev.filter(id => id !== tempId)
                );
              }
            });
          }
          
          // If no mapped entries were found, use the traditional approach
          if (newEntryIds.length === 0) {
            for (let i = 0; i < Math.min(entries.length - prevEntriesLength, entries.length); i++) {
              const entry = entries[i];
              if (entry && typeof entry === 'object' && entry.id && !animatedEntryIds.includes(entry.id)) {
                newEntryIds.push(entry.id);
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
  }, [entries.length, prevEntriesLength, entries, persistedProcessingEntries, animatedEntryIds]);
  
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
      if (processingStepTimeoutRef.current) {
        clearTimeout(processingStepTimeoutRef.current);
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
  const safeLocalEntries = Array.isArray(displayEntries) ? displayEntries : [];

  // Find any entries that are linked to currently processing entries
  const processingLinkedEntries = safeLocalEntries.filter(entry => {
    return Array.from(processingToEntryMap.entries()).some(([tempId, entryId]) => entryId === entry.id);
  });

  // Remove these entries from the main list as they'll be displayed separately
  const filteredLocalEntries = safeLocalEntries.filter(entry => {
    return !processingLinkedEntries.some(linkedEntry => linkedEntry.id === entry.id);
  });

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
            {hasProcessingEntries && (
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
            
            {safeLocalEntries.length === 0 && !hasProcessingEntries && !loading ? (
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
              filteredLocalEntries.map((entry, index) => (
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
