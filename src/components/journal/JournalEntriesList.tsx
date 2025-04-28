
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
        <JournalEntryLoadingSkeleton count={3} />
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
        <JournalEntryLoadingSkeleton key={id} />
      ))}
      {entries.map((entry) => (
        <JournalEntryCard
          key={entry.id}
          entry={{
            id: entry.id || 0,
            content: entry["refined text"] || entry["transcription text"] || "",
            created_at: entry.created_at || new Date().toISOString(),
            sentiment: entry.sentiment,
            themes: entry.entities?.map(e => e.type === 'THEME' ? e.name : '').filter(Boolean) || [],
            master_themes: entry.master_themes || [],
            entities: entry.entities || [],
            Edit_Status: entry.Edit_Status,
            user_feedback: entry.user_feedback
          }}
          onDelete={() => entry.id && onDeleteEntry(entry.id)}
          setEntries={() => {}} // Passing empty function as it's required but not used in this context
        />
      ))}
    </div>
  );
};

export default JournalEntriesList;
