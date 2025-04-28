
import React from 'react';
import { motion } from 'framer-motion';
import { LoadingEntryContent } from './LoadingEntryContent';
import { CheckCircle2 } from 'lucide-react';
import { JournalEntryCard } from '../JournalEntryCard';
import { JournalEntry } from '@/types/journal';

interface ProcessingEntryCardProps {
  tempId: string;
  actualEntry: JournalEntry | undefined;
  deletedEntryIds: Set<number>;
  onDelete: (entryId: number) => void;
  setLocalEntries: (entriesUpdate: React.SetStateAction<JournalEntry[]>) => void;
}

export const ProcessingEntryCard: React.FC<ProcessingEntryCardProps> = ({
  tempId,
  actualEntry,
  deletedEntryIds,
  onDelete,
  setLocalEntries
}) => {
  if (!actualEntry) {
    return (
      <div className="mb-4 bg-muted/40 border rounded-lg p-4 shadow-sm">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Processing New Entry</h3>
            <div className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
              In Progress
            </div>
          </div>
          
          <div className="pt-2 text-sm">
            <LoadingEntryContent />
          </div>
        </div>
      </div>
    );
  }
  
  if (deletedEntryIds.has(actualEntry.id)) {
    return null;
  }
  
  return (
    <motion.div
      key={`transitional-${tempId}`}
      initial={{ opacity: 0.8 }}
      animate={{ 
        opacity: 1,
        transition: { duration: 0.5 }
      }}
      className="relative rounded-lg shadow-md overflow-hidden ring-2 ring-primary ring-opacity-50"
    >
      <JournalEntryCard 
        entry={actualEntry}
        onDelete={onDelete}
        isNew={true}
        isProcessing={false}
        setEntries={setLocalEntries}
      />
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.5, delay: 0.5 }}
        className="absolute inset-0 bg-white dark:bg-black pointer-events-none flex items-center justify-center"
      >
        <CheckCircle2 className="h-12 w-12 text-green-500 animate-pulse" />
      </motion.div>
    </motion.div>
  );
};
