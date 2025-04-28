
import React from 'react';
import { JournalEntry } from '@/types/journal';
import JournalEntryCard from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Plus } from 'lucide-react';
import JournalEntriesHeader from './JournalEntriesHeader';
import EmptyJournalState from './EmptyJournalState';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  onDeleteEntry: (entryId: number) => void;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  onDeleteEntry,
}) => {
  const hasEntries = entries && entries.length > 0;
  const isLoading = loading && !hasEntries;
  
  const handleDeleteEntry = (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling delete for entry: ${entryId}`);
      onDeleteEntry(entryId);
    } catch (error) {
      console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
    }
  };

  return (
    <div className="journal-entries-list">
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : hasEntries ? (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={{
                ...entry,
                content: (entry as any).content || entry["refined text"] || entry["transcription text"] || "",
                // Make sure id is definitely defined and not optional
                id: entry.id!
              }}
              processing={processingEntries.some(tempId => tempId.includes(String(entry.id)))}
              processed={processedEntryIds.includes(entry.id!)}
              onDelete={handleDeleteEntry}
            />
          ))}
        </div>
      ) : (
        <EmptyJournalState onStartRecording={onStartRecording} />
      )}
    </div>
  );
}

export default JournalEntriesList;
