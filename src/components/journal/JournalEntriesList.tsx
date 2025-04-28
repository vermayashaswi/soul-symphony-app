
import React from 'react';
import { JournalEntry } from '@/types/journal';
import JournalEntryCard from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Plus } from 'lucide-react';
import JournalEntriesHeader from './JournalEntriesHeader';
import EmptyJournalState from './EmptyJournalState';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';

interface JournalEntriesListProps {
  entries: JournalEntry[];
  loading: boolean;
  processingEntries: string[];
  processedEntryIds: number[];
  onStartRecording: () => void;
  onDeleteEntry: (entryId: number) => void;
  tempEntries?: Array<{id: string; tempId: string}>;
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  onDeleteEntry,
  tempEntries = [],
}) => {
  // IMPROVED: More reliable check for entries with fallbacks
  const hasEntries = entries && entries.length > 0;
  
  // IMPROVED: Only show loading on initial load, not during refreshes
  const isLoading = loading && !hasEntries;
  
  const handleDeleteEntry = (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling delete for entry: ${entryId}`);
      
      if (!entryId) {
        console.error("[JournalEntriesList] Invalid entry ID for deletion");
        return;
      }
      
      // Call the parent component's delete handler
      onDeleteEntry(entryId);
    } catch (error) {
      console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
      throw error; // Re-throw to let DeleteEntryDialog handle the error display
    }
  };

  // Check for active processing entries to show loaders
  const hasProcessingEntries = processingEntries.length > 0;
  
  // NEW: Debug logging for better visibility
  console.log(`[JournalEntriesList] Rendering with: entries=${entries?.length || 0}, loading=${loading}, hasEntries=${hasEntries}, isLoading=${isLoading}, processingEntries=${processingEntries.length}, tempEntries=${tempEntries?.length || 0}`);

  return (
    <div className="journal-entries-list" id="journal-entries-container">
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : hasEntries || hasProcessingEntries ? (
        <div className="grid gap-4" data-entries-count={entries.length + processingEntries.length}>
          {/* Show placeholder entries for processing entries */}
          {processingEntries.map((tempId) => (
            <JournalEntryCard
              key={`processing-${tempId}`}
              entry={{
                id: -1, // Use placeholder ID
                created_at: new Date().toISOString(),
                content: "",
                // Add required fields for the entry type
              }}
              processing={true}
              tempId={tempId}
              processed={false}
              onDelete={() => {}}
            />
          ))}
          
          {/* Display actual entries */}
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
