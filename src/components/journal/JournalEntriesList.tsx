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
  // Use our hook to get processing entries
  const { activeProcessingIds, isProcessing } = useProcessingEntries();
  
  // Keep track of rendered tempIds to prevent duplicates
  const renderedTempIdsRef = useRef<Set<string>>(new Set());
  // Keep track of rendered entry IDs to prevent duplicates
  const renderedEntryIdsRef = useRef<Set<number>>(new Set());
  // Track if we're currently recovering from a deletion
  const [recoveringFromDelete, setRecoveringFromDelete] = useState(false);
  // Track the last action taken
  const [lastAction, setLastAction] = useState<string | null>(null);
  // Track entries that are transitioning to prevent flickering
  const [transitioningEntries, setTransitioningEntries] = useState<Set<string>>(new Set());
  
  // Add a tracking set for deleted entry IDs
  const deletedEntryIdsRef = useRef<Set<number>>(new Set());
  
  // Determine if we have any entries to show
  const hasEntries = entries && entries.length > 0;
  
  // Only show loading on initial load, not during refreshes
  const isLoading = loading && !hasEntries && !recoveringFromDelete;
  
  // Track when component mounts/unmounts
  useEffect(() => {
    console.log('[JournalEntriesList] Component mounted');
    setLastAction('Component Mounted');
    
    // Clean up any stale processing entries on mount
    const entries = processingStateManager.getProcessingEntries();
    console.log(`[JournalEntriesList] Found ${entries.length} entries in state manager on mount`);
    
    // Listen for force refresh events
    const handleForceRefresh = () => {
      console.log('[JournalEntriesList] Received force refresh event');
      renderedTempIdsRef.current.clear();
      setTransitioningEntries(new Set());
      // Force re-render by updating state
      setLastAction('Force Refresh: ' + Date.now());
    };
    
    // Listen for entry transition events
    const handleEntryTransition = (event: CustomEvent) => {
      const { tempId } = event.detail;
      if (tempId) {
        console.log(`[JournalEntriesList] Entry ${tempId} starting transition`);
        setTransitioningEntries(prev => new Set([...prev, tempId]));
        
        // Remove from transitioning after a delay
        setTimeout(() => {
          setTransitioningEntries(prev => {
            const newSet = new Set(prev);
            newSet.delete(tempId);
            return newSet;
          });
        }, 3000);
      }
    };
    
    window.addEventListener('journalUIForceRefresh', handleForceRefresh);
    window.addEventListener('processingEntryCompleted', handleEntryTransition as EventListener);
    
    return () => {
      console.log('[JournalEntriesList] Component unmounted');
      window.removeEventListener('journalUIForceRefresh', handleForceRefresh);
      window.removeEventListener('processingEntryCompleted', handleEntryTransition as EventListener);
    };
  }, []);
  
  // Update processing manager with improved transition handling
  useEffect(() => {
    console.log('[JournalEntriesList] Processing entries from props:', processingEntries);
    
    // Clear our tracking sets at the beginning of each update
    renderedTempIdsRef.current.clear();
    renderedEntryIdsRef.current = new Set(entries.map(entry => entry.id));
    
    // Check for entries that have IDs and tempIds - handle transition more carefully
    entries.forEach(entry => {
      if (entry.id && entry.tempId) {
        const processingEntry = processingStateManager.getEntryById(entry.tempId);
        
        // Only mark as completed if not already in transition state
        if (processingEntry && processingEntry.state !== EntryProcessingState.TRANSITIONING) {
          console.log(`[JournalEntriesList] Found entry with both id and tempId: ${entry.id} / ${entry.tempId} - marking as completed`);
          processingStateManager.updateEntryState(entry.tempId, EntryProcessingState.COMPLETED);
          processingStateManager.setEntryId(entry.tempId, entry.id);
        }
      }
    });
    
    // Check if any processing entries are no longer in the processingEntries list from props
    activeProcessingIds.forEach(tempId => {
      if (!processingEntries.includes(tempId)) {
        const processingEntry = processingStateManager.getEntryById(tempId);
        // Only remove if it's been processing for more than 30 seconds (likely stale)
        if (processingEntry && (Date.now() - processingEntry.startTime > 30000)) {
          console.log(`[JournalEntriesList] Processing entry ${tempId} is stale, removing`);
          processingStateManager.removeEntry(tempId);
        }
      }
    });
    
    // Register any processingEntries from props with our manager
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
      }
    });
    
    // Reset recovering state if we have entries
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
      
      // Track this entry as deleted to prevent it from reappearing
      deletedEntryIdsRef.current.add(entryId);
      
      // Mark that we're recovering from a deletion to prevent blank screen
      setRecoveringFromDelete(true);
      
      // Remove from processing state manager if present
      processingStateManager.removeEntry(entryId.toString());
      
      // Find any temporary processing entries that map to this entry ID and remove them
      const processingEntriesToRemove: string[] = [];
      
      const allProcessingEntries = processingStateManager.getProcessingEntries();
      allProcessingEntries.forEach(entry => {
        if (entry.entryId === entryId) {
          processingEntriesToRemove.push(entry.tempId);
        }
      });
      
      // Remove any temporary entries that are for this entry
      if (processingEntriesToRemove.length > 0) {
        console.log(`[JournalEntriesList] Removing ${processingEntriesToRemove.length} processing entries for deleted entry ${entryId}`);
        processingEntriesToRemove.forEach(tempId => {
          processingStateManager.removeEntry(tempId);
        });
      }
      
      // Call the parent component's delete handler
      await onDeleteEntry(entryId);
      
      console.log(`[JournalEntriesList] Delete handler completed for entry: ${entryId}`);
      
      // Reset the recovering state after a short delay
      setTimeout(() => {
        console.log('[JournalEntriesList] Resetting recovery state after deletion');
        setRecoveringFromDelete(false);
      }, 300);
      
      // Force update any component that needs to know about deleted entries
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
  
  // Improved filtering for processing IDs with much more conservative logic
  const filteredProcessingIds = activeProcessingIds.filter(tempId => {
    // Skip if we've already seen this tempId in this render cycle
    if (renderedTempIdsRef.current.has(tempId)) {
      return false;
    }
    
    // Always keep if entry is transitioning
    if (transitioningEntries.has(tempId)) {
      console.log(`[JournalEntriesList] Keeping processing card for transitioning entry ${tempId}`);
      renderedTempIdsRef.current.add(tempId);
      return true;
    }
    
    // Check if this tempId already exists in the real entries list
    const alreadyInEntries = entries.some(entry => entry.tempId === tempId);
    if (alreadyInEntries) {
      // Be more conservative - require multiple DOM checks before removing
      const realEntryCard = document.querySelector(`[data-temp-id="${tempId}"][data-processing="false"]`);
      const realEntryCardAlt = document.querySelector(`[data-entry-id]:not([data-loading-skeleton="true"])`);
      const realEntryCardAlt2 = document.querySelector(`.journal-entry-card:not(.processing-card)[data-temp-id="${tempId}"]`);
      
      // Only remove if we can find the real entry card with multiple selectors
      if (realEntryCard && realEntryCardAlt && document.querySelector(`[data-temp-id="${tempId}"]`)) {
        console.log(`[JournalEntriesList] Real entry card confirmed rendered for tempId ${tempId}, can skip processing card`);
        return false;
      } else {
        console.log(`[JournalEntriesList] Real entry exists but not fully rendered yet for tempId ${tempId}, keeping processing card`);
        renderedTempIdsRef.current.add(tempId);
        return true;
      }
    }
    
    // Skip if this processing entry is older than 90 seconds (very stale)
    const entry = processingStateManager.getEntryById(tempId);
    if (entry && (Date.now() - entry.startTime > 90000)) {
      console.log(`[JournalEntriesList] Skipping very stale processing card for tempId ${tempId} (age: ${Date.now() - entry.startTime}ms)`);
      processingStateManager.removeEntry(tempId);
      return false;
    }
    
    // Add to our tracking set and include in the filtered list
    renderedTempIdsRef.current.add(tempId);
    return true;
  });
  
  console.log(`[JournalEntriesList] Rendering with: entries=${filteredEntries.length || 0} (after filtering deleted), activeProcessingIds=${activeProcessingIds.length}, filteredProcessingIds=${filteredProcessingIds.length}, transitioning=${transitioningEntries.size}`);

  // Determine what content to show based on filtered entries, loading state, and processing state
  const shouldShowEmpty = !filteredEntries.length && !isLoading && filteredProcessingIds.length === 0 && !recoveringFromDelete && transitioningEntries.size === 0;
  const shouldShowEntries = filteredEntries.length > 0 || filteredProcessingIds.length > 0 || recoveringFromDelete || transitioningEntries.size > 0;
  
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
          {filteredEntries.map((entry) => {
            // Calculate processing state more accurately
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
