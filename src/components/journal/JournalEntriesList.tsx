
import React from 'react';
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
  // Show primary loading state only when loading and no entries exist
  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground text-sm">Loading your journal entries...</p>
      </div>
    );
  }

  if (entries.length === 0 && (!processingEntries || processingEntries.length === 0)) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  return (
    <div>
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Your Journal</h2>
          <Button onClick={onStartRecording} size="sm" className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" />
            New Entry
          </Button>
        </div>
      </div>

      <AnimatePresence>
        <div className="space-y-3">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2 }}
            >
              <JournalEntryCard 
                entry={entry} 
                onDelete={onDeleteEntry} 
              />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
