
import React, { useEffect, useState } from 'react';
import { JournalEntry, JournalEntryCard } from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Update entries count when entries change to trigger animation for new entries
  useEffect(() => {
    if (entries.length > showEntriesCount) {
      // Small delay to ensure smooth animation
      setTimeout(() => {
        setShowEntriesCount(entries.length);
      }, 300);
    } else {
      setShowEntriesCount(entries.length);
    }
  }, [entries.length]);
  
  // Track which entries should have highlight animation
  useEffect(() => {
    if (processedEntryIds && processedEntryIds.length > 0) {
      // Add the processed entry IDs to the animated entries
      setAnimatedEntryIds(prev => [...prev, ...processedEntryIds]);
      
      // Remove animation after 5 seconds
      const timer = setTimeout(() => {
        setAnimatedEntryIds([]);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [processedEntryIds]);
  
  // Show primary loading state only when loading initial entries
  // But don't show loading indefinitely for new users with no entries
  const showInitialLoading = loading && entries.length === 0 && !processingEntries.length;

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
          {entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                border: animatedEntryIds.includes(entry.id) ? 
                  '2px solid rgba(var(--color-primary), 0.7)' : 
                  '1px solid transparent' 
              }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ 
                duration: 0.3, 
                delay: index === 0 && entries.length > showEntriesCount ? 0 : 0.05 * index 
              }}
              className={animatedEntryIds.includes(entry.id) ? 
                "rounded-lg shadow-md relative overflow-hidden" : 
                "relative overflow-hidden"
              }
            >
              <JournalEntryCard 
                entry={entry} 
                onDelete={onDeleteEntry} 
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      
      {processingEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mt-4 p-3 bg-primary-foreground/10 border border-primary/20 rounded-lg"
        >
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing new entries...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
