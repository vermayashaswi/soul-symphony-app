import React from 'react';
import { JournalEntry } from '@/types/journal';
import JournalEntryCard from './JournalEntryCard';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import EmptyJournalState from './EmptyJournalState';
import { useTranslation } from 'react-i18next';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  onDeleteEntry: (id: number) => void;
}

const JournalEntriesList = ({ entries, loading, processingEntries, processedEntryIds, onStartRecording, onDeleteEntry }: JournalEntriesListProps) => {
  const { t } = useTranslation();
  
  if (loading) {
    return (
      <div className="space-y-6">
        <JournalEntryLoadingSkeleton />
        <JournalEntryLoadingSkeleton />
        <JournalEntryLoadingSkeleton />
      </div>
    );
  }

  if (!entries.length && !processingEntries.length) {
    return (
      <EmptyJournalState onStartRecording={onStartRecording} />
    );
  }

  return (
    <div className="space-y-6">
      {processingEntries.map((id) => (
        <JournalEntryLoadingSkeleton key={id} message={t('journal.entry.processing')} />
      ))}
      {entries.map((entry) => (
        <JournalEntryCard
          key={entry.id}
          entry={entry}
          isProcessed={processedEntryIds.includes(entry.id || 0)}
          onDelete={() => entry.id && onDeleteEntry(entry.id)}
        />
      ))}
    </div>
  );
};

export default JournalEntriesList;
