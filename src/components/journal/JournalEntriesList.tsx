
import React, { useEffect } from 'react';
import { JournalEntry } from '@/types/journal';
import JournalEntryCard from './JournalEntryCard';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Plus } from 'lucide-react';
import JournalEntriesHeader from './JournalEntriesHeader';
import EmptyJournalState from './EmptyJournalState';
import JournalEntryLoadingSkeleton from './JournalEntryLoadingSkeleton';
import { useProcessingEntries } from '@/hooks/use-processing-entries';
import { processingStateManager, EntryProcessingState } from '@/utils/journal/processing-state-manager';

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
  // Use our new hook to get processing entries
  const { activeProcessingIds, isProcessing } = useProcessingEntries();
  
  // Determine if we have any entries to show
  const hasEntries = entries && entries.length > 0;
  
  // Only show loading on initial load, not during refreshes
  const isLoading = loading && !hasEntries;
  
  // Update processing manager with any entries we receive from props
  useEffect(() => {
    // Register any processingEntries from props with our manager
    processingEntries.forEach(tempId => {
      // Only add if not already tracked
      if (!isProcessing(tempId)) {
        processingStateManager.startProcessing(tempId);
      }
    });
    
    // Mark processed entries as completed
    entries.forEach(entry => {
      if (entry.tempId && processedEntryIds.includes(entry.id)) {
        processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
        processingStateManager.setEntryId(entry.tempId, entry.id);
      }
    });
  }, [processingEntries, entries, processedEntryIds, isProcessing]);
  
  // Handle entry deletion with improved error handling
  const handleDeleteEntry = (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling delete for entry: ${entryId}`);
      
      if (!entryId) {
        console.error("[JournalEntriesList] Invalid entry ID for deletion");
        return Promise.reject(new Error("Invalid entry ID"));
      }
      
      // Remove from processing state manager if present
      processingStateManager.removeEntry(entryId);
      
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
  
  console.log(`[JournalEntriesList] Rendering with: entries=${entries?.length || 0}, loading=${loading}, activeProcessingIds=${activeProcessingIds.length}`);

  return (
    <div className="journal-entries-list" id="journal-entries-container">
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : hasEntries || activeProcessingIds.length > 0 ? (
        <div className="grid gap-4" data-entries-count={entries.length}>
          {/* Show processing entry skeletons for any active processing entries */}
          {activeProcessingIds.length > 0 && (
            <div data-processing-cards-container="true" className="processing-cards-container">
              {activeProcessingIds.map((tempId) => {
                console.log(`[JournalEntriesList] Rendering processing card for: ${tempId}`);
                
                // Check if this tempId already exists in the real entries list
                const alreadyInEntries = entries.some(entry => entry.tempId === tempId);
                
                // Only render if not already in entries list
                if (!alreadyInEntries) {
                  return (
                    <JournalEntryLoadingSkeleton
                      key={`processing-${tempId}`}
                      count={1}
                      tempId={tempId}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}
          
          {/* Then display regular entries */}
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id || entry.tempId || Math.random()}
              entry={{
                ...entry,
                content: entry.content || entry["refined text"] || entry["transcription text"] || ""
              }}
              processing={isProcessing(entry.tempId || '')}
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
