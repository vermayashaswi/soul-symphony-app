
import React from 'react';
import { JournalEntryCard } from './JournalEntryCard';
import { JournalEntry } from '@/types/journal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, RefreshCw } from 'lucide-react';
import EmptyJournalState from './EmptyJournalState';
import { Card } from '@/components/ui/card';
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
  // We've moved primary loading state to the Journal page,
  // but keep this as a fallback
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your journal entries...</p>
      </div>
    );
  }

  if (entries.length === 0 && (!processingEntries || processingEntries.length === 0)) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  // Check if there are any entries still being processed that haven't been found yet
  const showProcessingMessage = processingEntries.length > 0 && 
    !processingEntries.every(id => entries.some(entry => entry.foreignKey === id));

  return (
    <div>
      {showProcessingMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 text-primary">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <div>
                <p className="font-medium">Processing your recording...</p>
                <p className="text-sm text-muted-foreground">This may take a minute or two.</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Journal</h2>
          <Button onClick={onStartRecording} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

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
