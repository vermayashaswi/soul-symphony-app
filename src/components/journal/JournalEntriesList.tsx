
import React from 'react';
import { motion } from 'framer-motion';
import JournalEntryCard from './JournalEntryCard';
import { JournalEntry } from '@/types/journal';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import EmptyJournalState from './EmptyJournalState';
import { useIsMobile } from '@/hooks/use-mobile';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  isLoading,
  isError,
  onRetry,
}) => {
  const isMobile = useIsMobile();
  
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <JournalEntryLoadingSkeleton key={index} />
        ))}
      </div>
    );
  }
  
  // Error state
  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Failed to load journal entries. Please check your connection and try again.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  
  // Empty state
  if (entries.length === 0) {
    return <EmptyJournalState />;
  }
  
  // List of entries
  return (
    <motion.div 
      className="space-y-4 journal-entries-list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {entries.map((entry) => (
        <JournalEntryCard
          key={entry.id}
          entry={entry}
          compact={isMobile}
        />
      ))}
    </motion.div>
  );
};

export default JournalEntriesList;
