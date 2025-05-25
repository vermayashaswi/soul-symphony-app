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
  const { activeProcessingIds, isProcessing } = useProcessingEntries();
  const renderedTempIdsRef = useRef<Set<string>>(new Set());
  const renderedEntryIdsRef = useRef<Set<number>>(new Set());
  const [recoveringFromDelete, setRecoveringFromDelete] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const deletedEntryIdsRef = useRef<Set<number>>(new Set());
  
  const hasEntries = entries && entries.length > 0;
  const isLoading = loading && !hasEntries && !recoveringFromDelete;
  
  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    setLastAction('Component Mounted');
    
    const handleForceRefresh = () => {
      console.log('[JournalEntriesList] Received force refresh event');
      renderedTempIdsRef.current.clear();
      setLastAction('Force Refresh: ' + Date.now());
    };
    
    window.addEventListener('journalUIForceRefresh', handleForceRefresh);
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
      window.removeEventListener('journalUIForceRefresh', handleForceRefresh);
    };
  }, []);
  
  // Improved processing management with better deduplication
  useEffect(() => {
    console.log('[JournalEntriesList] Processing entries from props:', processingEntries);
    
    // Clear tracking sets
    renderedTempIdsRef.current.clear();
    renderedEntryIdsRef.current = new Set(entries.map(entry => entry.id));
    
    // Handle entries that have both ID and tempId (completed processing)
    entries.forEach(entry => {
      if (entry.id && entry.tempId) {
        const processingEntry = processingStateManager.getEntryById(entry.tempId);
        
        if (processingEntry && processingEntry.state !== EntryProcessingState.TRANSITIONING) {
          console.log(`[JournalEntriesList] Found entry with both id and tempId: ${entry.id} / ${entry.tempId} - marking as completed`);
          processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
          processingStateManager.setEntryId(entry.tempId, entry.id);
        }
      }
    });
    
    // Only register truly new processing entries - don't duplicate existing ones
    const entryTempIds = new Set(entries.map(entry => entry.tempId).filter(Boolean));
    
    processingEntries.forEach(tempId => {
      // Skip if this tempId is already associated with a real entry
      if (entryTempIds.has(tempId)) {
        console.log(`[JournalEntriesList] Skipping ${tempId} as it's already associated with a real entry`);
        return;
      }
      
      // Only add if not already tracked AND not already in state manager
      if (!isProcessing(tempId) && !processingStateManager.getEntryById(tempId)) {
        console.log(`[JournalEntriesList] Registering new processing entry: ${tempId}`);
        processingStateManager.startProcessing(tempId);
      } else {
        console.log(`[JournalEntriesList] Skipping duplicate processing entry: ${tempId}`);
      }
    });
    
    if (hasEntries && recoveringFromDelete) {
      setRecoveringFromDelete(false);
      console.log('[JournalEntriesList] Reset recovery state - entries exist');
    }
    
  }, [processingEntries, entries, processedEntryIds, isProcessing, activeProcessingIds, hasEntries, recoveringFromDelete]);
  
  // Handle entry deletion with improved cleanup logic
  const handleDeleteEntry = async (entryId: number) => {
    try {
      console.log(`[JournalEntriesList] Handling delete for entry: ${entryId}`);
      setLastAction(`Deleting Entry ${entryId}`);
      
      if (!entryId) {
        console.error("[JournalEntriesList] Invalid entry ID for deletion");
        return Promise.reject(new Error("Invalid entry ID"));
      }
      
      deletedEntryIdsRef.current.add(entryId);
      setRecoveringFromDelete(true);
      
      processingStateManager.removeEntry(entryId.toString());
      
      const allProcessingEntries = processingStateManager.getProcessingEntries();
      allProcessingEntries.forEach(entry => {
        if (entry.entryId === entryId) {
          processingStateManager.removeEntry(entry.tempId);
        }
      });
      
      await onDeleteEntry(entryId);
      
      console.log(`[JournalEntriesList] Delete handler completed for entry: ${entryId}`);
      
      setTimeout(() => {
        console.log('[JournalEntriesList] Resetting recovery state after deletion');
        setRecoveringFromDelete(false);
      }, 300);
      
      window.dispatchEvent(new CustomEvent('journalEntryDeleted', {
        detail: { entryId, timestamp: Date.now() }
      }));
      
      return Promise.resolve();
      
    } catch (error) {
      console.error(`[JournalEntriesList] Error when deleting entry ${entryId}:`, error);
      setRecoveringFromDelete(false);
      return Promise.reject(error);
    }
  };
  
  // Filter entries to remove any that have been deleted
  const filteredEntries = entries.filter(entry => !deletedEntryIdsRef.current.has(entry.id));
  
  // Much more conservative filtering to prevent duplicate loading cards
  const filteredProcessingIds = activeProcessingIds.filter(tempId => {
    // Prevent duplicates in this render cycle
    if (renderedTempIdsRef.current.has(tempId)) {
      console.log(`[JournalEntriesList] Already rendered ${tempId} in this cycle, skipping`);
      return false;
    }
    
    // Check if this tempId already exists in the real entries list
    const alreadyInEntries = entries.some(entry => entry.tempId === tempId);
    if (alreadyInEntries) {
      // Be very conservative - only skip if we can definitively confirm the real entry is fully rendered
      const realEntryCard = document.querySelector(`[data-temp-id="${tempId}"][data-processing="false"]`);
      const hasVisibleContent = document.querySelector(`[data-temp-id="${tempId}"] .journal-entry-content`);
      
      if (realEntryCard && hasVisibleContent) {
        console.log(`[JournalEntriesList] Real entry card confirmed fully rendered for tempId ${tempId}, skipping processing card`);
        return false;
      } else {
        console.log(`[JournalEntriesList] Real entry exists but not fully rendered yet for tempId ${tempId}, keeping processing card`);
        renderedTempIdsRef.current.add(tempId);
        return true;
      }
    }
    
    // Skip very stale entries (older than 60 seconds)
    const entry = processingStateManager.getEntryById(tempId);
    if (entry && (Date.now() - entry.startTime > 60000)) {
      console.log(`[JournalEntriesList] Removing stale processing card for tempId ${tempId}`);
      processingStateManager.removeEntry(tempId);
      return false;
    }
    
    renderedTempIdsRef.current.add(tempId);
    return true;
  });
  
  console.log(`[JournalEntriesList] Rendering: entries=${filteredEntries.length}, activeProcessingIds=${activeProcessingIds.length}, filteredProcessingIds=${filteredProcessingIds.length}`);

  // Determine what content to show based on filtered entries, loading state, and processing state
  const shouldShowEmpty = !filteredEntries.length && !isLoading && filteredProcessingIds.length === 0 && !recoveringFromDelete;
  const shouldShowEntries = filteredEntries.length > 0 || filteredProcessingIds.length > 0 || recoveringFromDelete;
  
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
          {/* Show processing entry skeletons - with strict deduplication */}
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
          
          {/* Display regular entries */}
          {filteredEntries.map((entry) => {
            const entryIsProcessing = entry.tempId ? isProcessing(entry.tempId) : false;
            
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
