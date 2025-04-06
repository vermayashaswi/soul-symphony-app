
import React, { useEffect, useState, useRef } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import ErrorBoundary from './ErrorBoundary';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[];
  processedEntryIds?: number[];
  onStartRecording: () => void;
  onDeleteEntry?: (entryId: number) => Promise<void> | void;
}

export default function JournalEntriesList({ 
  entries = [], // Add default value for safety
  loading = false, 
  processingEntries = [], 
  processedEntryIds = [],
  onStartRecording, 
  onDeleteEntry 
}: JournalEntriesListProps) {
  const [animatedEntryIds, setAnimatedEntryIds] = useState<number[]>([]);
  const [prevEntriesLength, setPrevEntriesLength] = useState(0);
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
  const hasProcessingEntries = processingEntries.length > 0;
  const componentMounted = useRef(true);
  const pendingDeletions = useRef<Set<number>>(new Set());
  const [renderError, setRenderError] = useState<Error | null>(null);

  // Safely handle entries updates with error boundaries
  useEffect(() => {
    try {
      if (Array.isArray(entries)) {
        const filteredEntries = entries.filter(
          entry => entry && typeof entry === 'object' && entry.id && !pendingDeletions.current.has(entry.id)
        );
        setLocalEntries(filteredEntries);
      } else {
        console.warn('[JournalEntriesList] Entries is not an array:', entries);
        setLocalEntries([]);
      }
    } catch (error) {
      console.error('[JournalEntriesList] Error processing entries:', error);
      setRenderError(error instanceof Error ? error : new Error('Unknown error processing entries'));
      // Fallback to empty array
      setLocalEntries([]);
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
          const newEntryIds: number[] = [];
          
          // Safely extract new entry IDs
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
      
      // Ensure we clean up even if there's an error
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
  
  // Safe calculation of loading states with fallbacks
  const showInitialLoading = loading && (!Array.isArray(localEntries) || localEntries.length === 0) && !hasProcessingEntries;
  
  // Safe calculation for new user state
  const isLikelyNewUser = !loading && (!Array.isArray(localEntries) || localEntries.length === 0) && !processingEntries.length;

  // If we have a render error, show a friendly message with retry option
  if (renderError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-300">We had trouble displaying your entries</p>
        <Button 
          variant="outline" 
          onClick={() => {
            setRenderError(null);
            if (Array.isArray(entries)) {
              setLocalEntries(entries.filter(entry => 
                entry && typeof entry === 'object' && entry.id && !pendingDeletions.current.has(entry.id)
              ));
            }
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (showInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your journal entries...</p>
      </div>
    );
  }

  if (isLikelyNewUser) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  // Ensure localEntries is actually an array before rendering
  const safeLocalEntries = Array.isArray(localEntries) ? localEntries : [];

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

        <AnimatePresence>
          <div className="space-y-4">
            {hasProcessingEntries && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-primary font-medium mb-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing your new entry...</span>
                </div>
                <JournalEntryLoadingSkeleton count={processingEntries.length} />
              </div>
            )}
            
            {safeLocalEntries.length === 0 && !hasProcessingEntries && !loading ? (
              <div className="flex flex-col items-center justify-center h-64 p-8 border border-dashed border-muted rounded-lg">
                <p className="text-muted-foreground mb-4">No journal entries to display</p>
                <Button onClick={onStartRecording} size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Create Your First Entry
                </Button>
              </div>
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
                      isProcessing={processingEntries.some(id => id.includes(String(entry.id)))}
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
