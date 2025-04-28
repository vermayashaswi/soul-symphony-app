
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';
import { JournalEntry } from '@/types/journal';
import { JournalEntryCard } from './JournalEntryCard';

interface JournalEntryListProps {
  entries: JournalEntry[];
  animatedEntryIds: number[];
  recentlyCompletedEntries: number[];
  onDelete: (entryId: number) => void;
  setLocalEntries: (entriesUpdate: React.SetStateAction<JournalEntry[]>) => void;
  prevEntriesLength: number;
}

export const JournalEntryList: React.FC<JournalEntryListProps> = ({
  entries,
  animatedEntryIds,
  recentlyCompletedEntries,
  onDelete,
  setLocalEntries,
  prevEntriesLength
}) => {
  return (
    <AnimatePresence>
      {entries.map((entry, index) => (
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
              delay: index === 0 && entries.length > prevEntriesLength ? 0 : 0.05 * Math.min(index, 5) 
            }}
            className={animatedEntryIds.includes(entry.id) ? 
              "rounded-lg shadow-md relative overflow-hidden ring-2 ring-primary ring-opacity-50" : 
              "relative overflow-hidden"
            }
          >
            <JournalEntryCard 
              entry={entry} 
              onDelete={onDelete} 
              isNew={animatedEntryIds.includes(entry.id) || recentlyCompletedEntries.includes(entry.id)}
              isProcessing={false}
              setEntries={setLocalEntries}
            />
          </motion.div>
        </ErrorBoundary>
      ))}
    </AnimatePresence>
  );
};
