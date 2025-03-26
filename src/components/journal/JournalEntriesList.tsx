
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryCard from './JournalEntryCard';
import { JournalEntry } from '@/types/journal';
import EmptyJournalState from './EmptyJournalState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[]; // Entries that are currently being processed
  onStartRecording: () => void;
  onRefresh?: () => void;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({ 
  entries, 
  loading,
  processingEntries = [],
  onStartRecording,
  onRefresh
}) => {
  if (loading && entries.length === 0 && processingEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 my-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading your journal entries...</p>
        <div>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (entries.length === 0 && processingEntries.length === 0) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  return (
    <motion.div 
      className="grid grid-cols-1 gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ staggerChildren: 0.1 }}
    >
      <AnimatePresence>
        {/* Processing entry placeholders */}
        {processingEntries.map((tempId) => (
          <motion.div 
            key={`processing-${tempId}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-6 shadow-sm relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="w-2/3">
                <Skeleton className="h-7 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-20 w-20 rounded-md" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>Processing your journal entry with AI...</span>
            </div>
          </motion.div>
        ))}

        {/* Actual entries - don't hide these while loading more entries */}
        {entries.map((entry) => (
          <JournalEntryCard key={`entry-${entry.id}`} entry={entry} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export default JournalEntriesList;
