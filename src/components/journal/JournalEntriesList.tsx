
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JournalEntryCard, { JournalEntry } from './JournalEntryCard';
import EmptyJournalState from './EmptyJournalState';
import { Skeleton } from '@/components/ui/skeleton';
import { Smile, Meh, Frown } from 'lucide-react';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries?: string[]; // Entries that are currently being processed
  onStartRecording: () => void;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({ 
  entries, 
  loading,
  processingEntries = [],
  onStartRecording
}) => {
  if (loading && entries.length === 0) {
    return (
      <div className="flex justify-center my-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (entries.length === 0 && processingEntries.length === 0) {
    return <EmptyJournalState onStartRecording={onStartRecording} />;
  }

  // Helper function to get sentiment emoji based on score
  const getSentimentEmoji = (sentiment?: string) => {
    if (!sentiment) return <Meh className="h-6 w-6 text-gray-400" aria-label="Neutral sentiment" />;
    
    const score = parseFloat(sentiment);
    if (score > 0.25) return <Smile className="h-6 w-6 text-green-500" aria-label="Positive sentiment" />;
    if (score < -0.25) return <Frown className="h-6 w-6 text-red-500" aria-label="Negative sentiment" />;
    return <Meh className="h-6 w-6 text-amber-500" aria-label="Neutral sentiment" />;
  };

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
            key={tempId}
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

        {/* Actual entries */}
        {entries.map((entry) => (
          <JournalEntryCard key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

export default JournalEntriesList;
