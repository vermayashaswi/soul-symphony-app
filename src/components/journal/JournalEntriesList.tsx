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
  entries, 
  loading, 
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

  useEffect(() => {
    if (entries.length >= 0) {
      const filteredEntries = entries.filter(
        entry => !pendingDeletions.current.has(entry.id)
      );
      setLocalEntries(filteredEntries);
    }

    return () => {
      componentMounted.current = false;
    };
  }, [entries]);

  useEffect(() => {
    if (!componentMounted.current) return;
    
    if (entries.length > 0) {
      if (entries.length > prevEntriesLength) {
        const newEntryIds = entries
          .slice(0, entries.length - prevEntriesLength)
          .map(entry => entry.id);
          
        setAnimatedEntryIds(prev => [...prev, ...newEntryIds]);
        
        setTimeout(() => {
          if (componentMounted.current) {
            setAnimatedEntryIds([]);
          }
        }, 5000);
      }
      
      setPrevEntriesLength(entries.length);
    } else {
      setPrevEntriesLength(0);
    }
  }, [entries.length, prevEntriesLength, entries]);
  
  const handleEntryDelete = (entryId: number) => {
    console.log(`[JournalEntriesList] Handling deletion of entry ${entryId}`);
    
    pendingDeletions.current.add(entryId);
    
    setLocalEntries(prev => prev.filter(entry => entry.id !== entryId));
    
    if (onDeleteEntry) {
      setTimeout(() => {
        if (componentMounted.current) {
          try {
            const result = onDeleteEntry(entryId);
            
            if (result && typeof result.then === 'function') {
              result
                .then(() => {
                  pendingDeletions.current.delete(entryId);
                })
                .catch(error => {
                  console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
                  pendingDeletions.current.delete(entryId);
                });
            } else {
              pendingDeletions.current.delete(entryId);
            }
          } catch (error) {
            console.error(`[JournalEntriesList] Error calling onDeleteEntry for ${entryId}:`, error);
            pendingDeletions.current.delete(entryId);
          }
        }
      }, 100);
    }
  };
  
  useEffect(() => {
    return () => {
      console.log("[JournalEntriesList] Component unmounting");
      componentMounted.current = false;
      pendingDeletions.current.clear();
    };
  }, []);
  
  const showInitialLoading = loading && localEntries.length === 0 && !hasProcessingEntries;

  const isLikelyNewUser = !loading && localEntries.length === 0 && !processingEntries.length;

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
            
            {localEntries.map((entry, index) => (
              <ErrorBoundary key={entry.id}>
                <motion.div
                  key={entry.id}
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
                    delay: index === 0 && localEntries.length > prevEntriesLength ? 0 : 0.05 * Math.min(index, 5) 
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
            ))}
          </div>
        </AnimatePresence>
        
        {loading && localEntries.length > 0 && !hasProcessingEntries && (
          <div className="flex items-center justify-center h-16 mt-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
