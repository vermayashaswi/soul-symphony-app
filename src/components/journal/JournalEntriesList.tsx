
import React, { useEffect, useState } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[];
  processedEntryIds?: number[];
  onStartRecording: () => void;
  onDeleteEntry?: (entryId: number) => void;
}

export default function JournalEntriesList({ 
  entries, 
  loading, 
  processingEntries = [], 
  processedEntryIds = [],
  onStartRecording, 
  onDeleteEntry 
}: JournalEntriesListProps) {
  const [showEntriesCount, setShowEntriesCount] = useState(0);
  const [animatedEntryIds, setAnimatedEntryIds] = useState<number[]>([]);
  const [prevEntriesLength, setPrevEntriesLength] = useState(0);
  const hasProcessingEntries = processingEntries.length > 0;

  // Update entries count when entries change to trigger animation for new entries
  useEffect(() => {
    if (entries.length > 0) {
      if (entries.length > prevEntriesLength) {
        // New entries have been added, highlight them
        const newEntryIds = entries
          .slice(0, entries.length - prevEntriesLength)
          .map(entry => entry.id);
          
        setAnimatedEntryIds(prev => [...prev, ...newEntryIds]);
        
        // Remove animation after 5 seconds
        setTimeout(() => {
          setAnimatedEntryIds([]);
        }, 5000);
      }
      
      setPrevEntriesLength(entries.length);
      
      // Small delay to ensure smooth animation
      setTimeout(() => {
        setShowEntriesCount(entries.length);
      }, 300);
    } else {
      setShowEntriesCount(entries.length);
      setPrevEntriesLength(0);
    }
  }, [entries.length, prevEntriesLength]);
  
  // Show primary loading state only when loading initial entries
  // But don't show loading indefinitely for new users with no entries
  const showInitialLoading = loading && entries.length === 0 && !hasProcessingEntries;

  // New flag to check if this is likely a new user who hasn't created any entries yet
  const isLikelyNewUser = !loading && entries.length === 0 && !processingEntries.length;

  if (showInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your journal entries...</p>
      </div>
    );
  }

  // Show empty state for new users or users with no entries
  if (isLikelyNewUser) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  return (
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
          {/* Processing entry skeletons */}
          {hasProcessingEntries && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-primary font-medium mb-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing your new entry...</span>
              </div>
              <JournalEntryLoadingSkeleton count={processingEntries.length} />
            </div>
          )}
          
          {entries.map((entry, index) => (
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
                delay: index === 0 && entries.length > showEntriesCount ? 0 : 0.05 * Math.min(index, 5) 
              }}
              className={animatedEntryIds.includes(entry.id) ? 
                "rounded-lg shadow-md relative overflow-hidden" : 
                "relative overflow-hidden"
              }
            >
              <JournalEntryCard 
                entry={entry} 
                onDelete={onDeleteEntry} 
                isNew={animatedEntryIds.includes(entry.id)}
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      
      {/* Show loading state at the bottom if needed */}
      {loading && entries.length > 0 && !hasProcessingEntries && (
        <div className="flex items-center justify-center h-16 mt-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
