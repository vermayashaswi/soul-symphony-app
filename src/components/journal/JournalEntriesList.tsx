
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
  // Show primary loading state only when loading and no entries exist and no entries are being processed
  if (loading && entries.length === 0 && (!processingEntries || processingEntries.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your journal entries...</p>
      </div>
    );
  }

  // Show empty state only when there are no entries and no processing entries
  if (entries.length === 0 && (!processingEntries || processingEntries.length === 0)) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  return (
    <div>
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Journal</h2>
          <Button onClick={onStartRecording} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Show processing indicator when entries are being processed */}
      {processingEntries && processingEntries.length > 0 && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-100 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-primary-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing {processingEntries.length} journal {processingEntries.length === 1 ? 'entry' : 'entries'}...</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        <div className="space-y-4">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
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
