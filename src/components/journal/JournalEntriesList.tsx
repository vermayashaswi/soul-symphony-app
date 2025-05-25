
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
  const { 
    visibleEntries, 
    isVisible, 
    forceRefresh, 
    immediateProcessingCount,
    hasAnyProcessing,
    isImmediatelyProcessing 
  } = useProcessingEntries();
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [fallbackProcessingIds, setFallbackProcessingIds] = useState<string[]>([]);
  const [immediateProcessingFlag, setImmediateProcessingFlag] = useState<boolean>(false);
  const deletedEntryIdsRef = useRef<Set<number>>(new Set());
  
  const hasEntries = entries && entries.length > 0;
  const isLoading = loading && !hasEntries;
  
  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    setLastAction('Component Mounted');
    
    // Listen for immediate processing events
    const handleImmediateProcessingStarted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Immediate processing started event received:', event.detail);
      setImmediateProcessingFlag(true);
      // Clear the flag after a short time to allow normal state to take over
      setTimeout(() => setImmediateProcessingFlag(false), 2000);
      forceRefresh();
    };
    
    // Listen for processing events to update fallback state
    const handleProcessingStarted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing started event received:', event.detail);
      if (event.detail?.tempId) {
        setFallbackProcessingIds(prev => {
          if (!prev.includes(event.detail.tempId)) {
            console.log('[JournalEntriesList] Adding fallback processing ID:', event.detail.tempId);
            return [...prev, event.detail.tempId];
          }
          return prev;
        });
        // Force refresh the hook state
        setTimeout(forceRefresh, 50);
      }
    };
    
    const handleProcessingCompleted = (event: CustomEvent) => {
      console.log('[JournalEntriesList] Processing completed event received:', event.detail);
      if (event.detail?.tempId) {
        setFallbackProcessingIds(prev => prev.filter(id => id !== event.detail.tempId));
        setImmediateProcessingFlag(false);
      }
    };
    
    window.addEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
    window.addEventListener('processingStarted', handleProcessingStarted as EventListener);
    window.addEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
    window.addEventListener('processingEntryHidden', handleProcessingCompleted as EventListener);
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
      window.removeEventListener('immediateProcessingStarted', handleImmediateProcessingStarted as EventListener);
      window.removeEventListener('processingStarted', handleProcessingStarted as EventListener);
      window.removeEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
      window.removeEventListener('processingEntryHidden', handleProcessingCompleted as EventListener);
    };
  }, [forceRefresh]);
  
  // Handle entries that have both ID and tempId (completed processing)
  useEffect(() => {
    entries.forEach(entry => {
      if (entry.id && entry.tempId) {
        const processingEntry = processingStateManager.getEntryById(entry.tempId);
        
        if (processingEntry && processingEntry.state !== EntryProcessingState.COMPLETED) {
          console.log(`[JournalEntriesList] Found entry with both id and tempId: ${entry.id} / ${entry.tempId} - marking as completed`);
          processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
          processingStateManager.setEntryId(entry.tempId, entry.id);
          
          // Remove from fallback state
          setFallbackProcessingIds(prev => prev.filter(id => id !== entry.tempId));
          setImmediateProcessingFlag(false);
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
  
  // Combine visible entries from hook and fallback state
  const visibleProcessingIds = visibleEntries.map(entry => entry.tempId);
  const allProcessingIds = [...new Set([...visibleProcessingIds, ...fallbackProcessingIds])];
  
  // Also check state manager directly as final fallback
  const directProcessingEntries = processingStateManager.getVisibleProcessingEntries();
  const directProcessingIds = directProcessingEntries.map(entry => entry.tempId);
  const finalProcessingIds = [...new Set([...allProcessingIds, ...directProcessingIds])];
  
  // Check for any immediate processing happening
  const hasImmediateProcessing = immediateProcessingFlag || hasAnyProcessing() || immediateProcessingCount > 0;
  
  console.log(`[JournalEntriesList] Rendering: entries=${filteredEntries.length}, visibleProcessingIds=${visibleProcessingIds.length}, fallbackIds=${fallbackProcessingIds.length}, directIds=${directProcessingIds.length}, finalIds=${finalProcessingIds.length}, hasImmediateProcessing=${hasImmediateProcessing}`);

  // CRITICAL FIX: Update conditional logic to prioritize loading cards over empty state
  const shouldShowProcessing = finalProcessingIds.length > 0 || hasImmediateProcessing;
  const shouldShowEmpty = !filteredEntries.length && !isLoading && !shouldShowProcessing;
  const shouldShowEntries = filteredEntries.length > 0 || shouldShowProcessing;
  
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
          {/* Show processing entry skeletons - using final combined list */}
          {shouldShowProcessing && (
            <div data-processing-cards-container="true" className="processing-cards-container">
              {finalProcessingIds.map((tempId) => {
                const entry = processingStateManager.getEntryById(tempId);
                const shouldShow = entry ? isVisible(tempId) : true; // Fallback to true if no entry found
                
                console.log(`[JournalEntriesList] Rendering processing card for: ${tempId}, visible: ${shouldShow}, hasEntry: ${!!entry}`);
                
                return (
                  <JournalEntryLoadingSkeleton
                    key={`processing-${tempId}`}
                    count={1}
                    tempId={tempId}
                    isVisible={shouldShow}
                  />
                );
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
