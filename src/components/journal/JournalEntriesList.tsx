
import React, { useEffect, useRef } from 'react';
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
  // Use our hook to get processing entries
  const { activeProcessingIds, isProcessing } = useProcessingEntries();
  
  // Keep track of rendered tempIds to prevent duplicates
  const renderedTempIdsRef = useRef<Set<string>>(new Set());
  // Keep track of rendered entry IDs to prevent duplicates
  const renderedEntryIdsRef = useRef<Set<number>>(new Set());
  
  // Determine if we have any entries to show
  const hasEntries = entries && entries.length > 0;
  
  // Only show loading on initial load, not during refreshes
  const isLoading = loading && !hasEntries;
  
  // Track when component mounts/unmounts
  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    
    // Clean up any stale processing entries on mount
    const entries = processingStateManager.getProcessingEntries();
    console.log(`[JournalEntriesList] Found ${entries.length} entries in state manager on mount`);
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
    };
  }, []);
  
  // Update processing manager with any entries we receive from props
  useEffect(() => {
    console.log('[JournalEntriesList] Processing entries from props:', processingEntries);
    
    // Clear our tracking sets at the beginning of each update
    renderedTempIdsRef.current.clear();
    renderedEntryIdsRef.current = new Set(entries.map(entry => entry.id));
    
    // Check for entries that have IDs and tempIds - these are completed and should be removed from processing
    entries.forEach(entry => {
      if (entry.id && entry.tempId) {
        console.log(`[JournalEntriesList] Found entry with both id and tempId: ${entry.id} / ${entry.tempId} - marking as completed`);
        processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
        
        // Force remove after a short delay to ensure UI updates
        setTimeout(() => {
          processingStateManager.removeEntry(entry.tempId);
          // Dispatch event to force UI update
          window.dispatchEvent(new CustomEvent('forceRemoveProcessingCard', {
            detail: { tempId: entry.tempId, entryId: entry.id, timestamp: Date.now(), forceCleanup: true }
          }));
        }, 500);
      }
    });
    
    // Check if any processing entries are no longer in the processingEntries list from props
    // These may be stale entries that should be removed
    activeProcessingIds.forEach(tempId => {
      if (!processingEntries.includes(tempId)) {
        console.log(`[JournalEntriesList] Processing entry ${tempId} is no longer in props list, removing`);
        processingStateManager.removeEntry(tempId);
      }
    });
    
    // Register any processingEntries from props with our manager
    // But ONLY if they're not already associated with a real entry
    const entryTempIds = new Set(entries.map(entry => entry.tempId).filter(Boolean));
    
    processingEntries.forEach(tempId => {
      // Skip if this tempId is already associated with a real entry
      if (entryTempIds.has(tempId)) {
        console.log(`[JournalEntriesList] Skipping ${tempId} as it's already associated with a real entry`);
        return;
      }
      
      // Only add if not already tracked
      if (!isProcessing(tempId)) {
        console.log(`[JournalEntriesList] Registering new processing entry: ${tempId}`);
        processingStateManager.startProcessing(tempId);
      } else {
        console.log(`[JournalEntriesList] Entry ${tempId} already being tracked, skipping registration`);
      }
    });
    
    // Mark processed entries as completed
    entries.forEach(entry => {
      if (entry.tempId && processedEntryIds.includes(entry.id)) {
        console.log(`[JournalEntriesList] Marking entry as completed: ${entry.tempId} -> ${entry.id}`);
        processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
        processingStateManager.setEntryId(entry.tempId, entry.id);
        
        // Force remove after a short delay
        setTimeout(() => {
          processingStateManager.removeEntry(entry.tempId);
        }, 1000);
      }
    });
  }, [processingEntries, entries, processedEntryIds, isProcessing, activeProcessingIds]);
  
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
  
  // Filter active processing IDs to prevent duplicates with real entries
  const filteredProcessingIds = activeProcessingIds.filter(tempId => {
    // Skip if we've already seen this tempId in this render cycle
    if (renderedTempIdsRef.current.has(tempId)) {
      return false;
    }
    
    // Skip if this tempId already exists in the real entries list
    const alreadyInEntries = entries.some(entry => entry.tempId === tempId);
    if (alreadyInEntries) {
      console.log(`[JournalEntriesList] Skipping processing card for tempId ${tempId} as it's already in entries`);
      return false;
    }
    
    // Skip if this processing entry is older than 30 seconds
    const entry = processingStateManager.getEntryById(tempId);
    if (entry && (Date.now() - entry.startTime > 30000)) {
      console.log(`[JournalEntriesList] Skipping stale processing card for tempId ${tempId} (age: ${Date.now() - entry.startTime}ms)`);
      // Clean it up
      processingStateManager.removeEntry(tempId);
      return false;
    }
    
    // Add to our tracking set and include in the filtered list
    renderedTempIdsRef.current.add(tempId);
    return true;
  });
  
  console.log(`[JournalEntriesList] Rendering with: entries=${entries?.length || 0}, activeProcessingIds=${activeProcessingIds.length}, filteredProcessingIds=${filteredProcessingIds.length}`);

  return (
    <div className="journal-entries-list" id="journal-entries-container">
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : hasEntries || filteredProcessingIds.length > 0 ? (
        <div className="grid gap-4" data-entries-count={entries.length}>
          {/* Show processing entry skeletons for any active processing entries */}
          {filteredProcessingIds.length > 0 && (
            <div data-processing-cards-container="true" className="processing-cards-container">
              {filteredProcessingIds.map((tempId) => {
                console.log(`[JournalEntriesList] Rendering processing card for: ${tempId}`);
                return (
                  <JournalEntryLoadingSkeleton
                    key={`processing-${tempId}`}
                    count={1}
                    tempId={tempId}
                  />
                );
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
