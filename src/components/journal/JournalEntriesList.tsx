
import React, { useState, useEffect } from 'react';
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
}

const JournalEntriesList: React.FC<JournalEntriesListProps> = ({
  entries,
  loading,
  processingEntries,
  processedEntryIds,
  onStartRecording,
  onDeleteEntry,
}) => {
  // IMPROVED: More reliable check for entries with fallbacks
  const hasEntries = entries && entries.length > 0;
  
  // IMPROVED: Only show loading on initial load, not during refreshes
  const isLoading = loading && !hasEntries;
  
  // Track processed temp IDs to prevent duplicate loader cards
  const [processedTempIds, setProcessedTempIds] = useState<Set<string>>(new Set());
  
  // Filter processingEntries to avoid duplicates
  const uniqueProcessingEntries = processingEntries.filter(tempId => !processedTempIds.has(tempId));
  
  // Check if there are unique processing entries to display
  const hasProcessingEntries = uniqueProcessingEntries && uniqueProcessingEntries.length > 0;
  
  // Update processed temp IDs when processed entry IDs change
  useEffect(() => {
    if (processingEntries.length > 0) {
      const tempIdsInEntries = new Set(entries
        .filter(entry => entry.tempId)
        .map(entry => entry.tempId as string));
        
      // Add temp IDs that now appear in entries to processedTempIds
      if (tempIdsInEntries.size > 0) {
        setProcessedTempIds(prev => {
          const newSet = new Set(prev);
          tempIdsInEntries.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    }
  }, [entries, processingEntries]);
  
  const handleDeleteEntry = (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling delete for entry: ${entryId}`);
      
      if (!entryId) {
        console.error("[JournalEntriesList] Invalid entry ID for deletion");
        return Promise.reject(new Error("Invalid entry ID"));
      }
      
      // Call the parent component's delete handler and return the Promise
      return Promise.resolve(onDeleteEntry(entryId))
        .then(() => {
          console.log(`[JournalEntriesList] Delete handler completed for entry: ${entryId}`);
        });
      
    } catch (error) {
      console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
      return Promise.reject(error);
    }
  };

  // NEW: Debug logging for rendered state
  console.log(`[JournalEntriesList] Rendering with: entries=${entries?.length || 0}, loading=${loading}, hasEntries=${hasEntries}, isLoading=${isLoading}, processingEntries=${processingEntries.length}, hasProcessingEntries=${hasProcessingEntries}, uniqueProcessingEntries=${uniqueProcessingEntries.length}`);

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
        <div className="grid gap-4" data-entries-count={entries.length}>
          {/* Display processing entry cards first */}
          {hasProcessingEntries && uniqueProcessingEntries.map((tempId) => (
            <JournalEntryCard
              key={`processing-${tempId}`}
              entry={{
                id: 0, // Temporary ID, will be replaced
                content: "Processing entry...",
                created_at: new Date().toISOString(),
                tempId: tempId
              }}
              processing={true}
              isProcessing={true}
              setEntries={null}
            />
          ))}
          
          {/* Then display regular entries */}
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id || entry.tempId || Math.random()}
              entry={{
                ...entry,
                content: entry.content || entry["refined text"] || entry["transcription text"] || ""
              }}
              processing={processingEntries.includes(entry.tempId) || entry.content === "Processing entry..."}
              processed={processedEntryIds.includes(entry.id)}
              onDelete={handleDeleteEntry}
              setEntries={null} // Pass null since we don't want to modify entries directly here
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
