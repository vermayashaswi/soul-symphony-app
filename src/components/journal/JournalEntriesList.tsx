
import React, { useEffect, useRef, useState } from 'react';
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
  const { visibleEntries, isVisible } = useProcessingEntries();
  const [lastAction, setLastAction] = useState<string | null>(null);
  const deletedEntryIdsRef = useRef<Set<number>>(new Set());
  
  const hasEntries = entries && entries.length > 0;
  const isLoading = loading && !hasEntries;
  
  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    setLastAction('Component Mounted');
    
    // NO MORE startProcessing calls here - single source of truth
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
    };
  }, []);
  
  // Handle entries that have both ID and tempId (completed processing)
  useEffect(() => {
    entries.forEach(entry => {
      if (entry.id && entry.tempId) {
        const processingEntry = processingStateManager.getEntryById(entry.tempId);
        
        if (processingEntry && processingEntry.state !== EntryProcessingState.COMPLETED) {
          console.log(`[JournalEntriesList] Found entry with both id and tempId: ${entry.id} / ${entry.tempId} - marking as completed`);
          processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
          processingStateManager.setEntryId(entry.tempId, entry.id);
        }
      }
    });
  }, [entries]);
  
  // Handle entry deletion
  const handleDeleteEntry = async (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling delete for entry: ${entryId}`);
      setLastAction(`Deleting Entry ${entryId}`);
      
      if (!entryId) {
        console.error("[JournalEntriesList] Invalid entry ID for deletion");
        return Promise.reject(new Error("Invalid entry ID"));
      }
      
      deletedEntryIdsRef.current.add(entryId);
      
      // Remove any processing entries associated with this entry
      const allProcessingEntries = processingStateManager.getProcessingEntries();
      allProcessingEntries.forEach(entry => {
        if (entry.entryId === entryId) {
          processingStateManager.removeEntry(entry.tempId);
        }
      });
      
      await onDeleteEntry(entryId);
      
      console.log(`[JournalEntriesList] Delete handler completed for entry: ${entryId}`);
      
      window.dispatchEvent(new CustomEvent('journalEntryDeleted', {
        detail: { entryId, timestamp: Date.now() }
      }));
      
      return Promise.resolve();
      
    } catch (error) {
      console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
      return Promise.reject(error);
    }
  };
  
  // Filter entries to remove deleted ones
  const filteredEntries = entries.filter(entry => !deletedEntryIdsRef.current.has(entry.id));
  
  // Only show visible processing entries (smart transparency handled in state manager)
  const visibleProcessingIds = visibleEntries.map(entry => entry.tempId);
  
  console.log(`[JournalEntriesList] Rendering: entries=${filteredEntries.length}, visibleProcessingIds=${visibleProcessingIds.length}`);

  // Determine content to show
  const shouldShowEmpty = !filteredEntries.length && !isLoading && visibleProcessingIds.length === 0;
  const shouldShowEntries = filteredEntries.length > 0 || visibleProcessingIds.length > 0;
  
  return (
    <div className="journal-entries-list" id="journal-entries-container" data-last-action={lastAction}>
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : shouldShowEntries ? (
        <div className="grid gap-4" data-entries-count={filteredEntries.length}>
          {/* Show only visible processing entry skeletons */}
          {visibleProcessingIds.length > 0 && (
            <div data-processing-cards-container="true" className="processing-cards-container">
              {visibleProcessingIds.map((tempId) => {
                const entry = processingStateManager.getEntryById(tempId);
                const shouldShow = entry && isVisible(tempId);
                
                console.log(`[JournalEntriesList] Rendering processing card for: ${tempId}, visible: ${shouldShow}`);
                
                return shouldShow ? (
                  <JournalEntryLoadingSkeleton
                    key={`processing-${tempId}`}
                    count={1}
                    tempId={tempId}
                    isVisible={shouldShow}
                  />
                ) : null;
              })}
            </div>
          )}
          
          {/* Display regular entries */}
          {filteredEntries.map((entry) => {
            const entryIsProcessing = entry.tempId ? processingStateManager.isProcessing(entry.tempId) : false;
            
            return (
              <JournalEntryCard
                key={entry.id || entry.tempId || Math.random()}
                entry={{
                  ...entry,
                  content: entry.content || entry["refined text"] || entry["transcription text"] || ""
                }}
                processing={entryIsProcessing}
                processed={processedEntryIds.includes(entry.id)}
                onDelete={handleDeleteEntry}
                setEntries={null}
              />
            );
          })}
        </div>
      ) : shouldShowEmpty ? (
        <EmptyJournalState onStartRecording={onStartRecording} />
      ) : null}
    </div>
  );
}

export default JournalEntriesList;
