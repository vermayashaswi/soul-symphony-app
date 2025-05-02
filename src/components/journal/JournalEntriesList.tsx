import React, { useState, useEffect, useRef } from 'react';
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
  // Track entries that have been added to the UI to prevent duplicates
  const [renderedTempIds, setRenderedTempIds] = useState<Set<string>>(new Set());
  // Track active processing entries currently shown in the UI
  const [activeProcessingEntries, setActiveProcessingEntries] = useState<string[]>([]);
  // Track visibility state of processing cards for debugging
  const [processingCardsVisible, setProcessingCardsVisible] = useState<boolean>(false);
  // Add a delay before hiding processing entries to ensure smooth UI transitions
  const [pendingHideEntries, setPendingHideEntries] = useState<Set<string>>(new Set());
  // Store timestamps for when processing entries appear, to enforce minimum visibility
  const processingEntryTimestampsRef = useRef<Map<string, number>>(new Map());
  
  // DEBUG logging for initial state
  console.log(`[JournalEntriesList] Initialize with: processingEntries=${JSON.stringify(processingEntries)}`);
  
  // Process and filter the processing entries to show
  useEffect(() => {
    if (processingEntries && processingEntries.length > 0) {
      console.log(`[JournalEntriesList] Processing entries changed: ${processingEntries.length} entries: ${JSON.stringify(processingEntries)}`);
      
      // Get entries that appear in both lists (real entries with tempId)
      const entriesTempIds = new Set(entries
        .filter(entry => entry.tempId)
        .map(entry => entry.tempId as string));
        
      console.log(`[JournalEntriesList] Entries with tempIDs: ${[...entriesTempIds].join(', ')}`);
      
      // IMPORTANT FIX: Less aggressive filtering - only filter out entries that exist
      // in the main entries list AND have been in the processed state for at least 2 seconds
      const now = Date.now();
      
      // Find which ones should be actively shown
      const activeEntries = processingEntries.filter(tempId => {
        // Check if this entry is in main entries list
        const inEntriesList = entriesTempIds.has(tempId);
        
        // Check if it's been explicitly marked as processed
        const isProcessed = processedTempIds.has(tempId);
        
        // Check if it's been rendered already
        const isRendered = renderedTempIds.has(tempId);
        
        // Check if it's pending hide (transitioning out)
        const isPendingHide = pendingHideEntries.has(tempId);
        
        // Track when we first saw this processing entry for minimum visibility time
        if (!processingEntryTimestampsRef.current.has(tempId)) {
          processingEntryTimestampsRef.current.set(tempId, now);
          console.log(`[JournalEntriesList] Setting first timestamp for ${tempId}`);
        }
        
        // Calculate how long this entry has been visible
        const entryFirstSeen = processingEntryTimestampsRef.current.get(tempId) || now;
        const visibleDuration = now - entryFirstSeen;
        
        // IMPORTANT: Ensure minimum visibility time of 2 seconds
        const hasBeenVisibleLongEnough = visibleDuration > 2000;
        
        // DEBUG log the decision factors
        console.log(`[JournalEntriesList] Entry ${tempId}: inEntriesList=${inEntriesList}, isProcessed=${isProcessed}, isRendered=${isRendered}, isPendingHide=${isPendingHide}, visibleDuration=${visibleDuration}ms`);
        
        // Don't show if it's in the entries list AND it's been visible long enough AND it's processed
        if (inEntriesList && isProcessed && hasBeenVisibleLongEnough) {
          console.log(`[JournalEntriesList] Filtering out ${tempId} - already in entries and processed`);
          return false;
        }
        
        // Don't show if we've explicitly marked it as processed AND it's been visible long enough
        if (isProcessed && hasBeenVisibleLongEnough) {
          console.log(`[JournalEntriesList] Filtering out ${tempId} - already processed`);
          return false;
        }
        
        // Otherwise, show the processing card
        return true;
      });
      
      console.log(`[JournalEntriesList] Active processing entries: ${activeEntries.length} of ${processingEntries.length} total`);
      
      // IMPORTANT: Update visibility flag
      setProcessingCardsVisible(activeEntries.length > 0);
      
      setActiveProcessingEntries(activeEntries);
    } else {
      setActiveProcessingEntries([]);
      setProcessingCardsVisible(false);
    }
  }, [processingEntries, entries, processedTempIds, renderedTempIds, pendingHideEntries]);
  
  // Update processed temp IDs when processed entry IDs change
  useEffect(() => {
    if (processingEntries.length > 0) {
      const tempIdsInEntries = new Set(entries
        .filter(entry => entry.tempId)
        .map(entry => entry.tempId as string));
        
      // Add temp IDs that now appear in entries to processedTempIds
      if (tempIdsInEntries.size > 0) {
        console.log(`[JournalEntriesList] Found tempIds in entries: ${[...tempIdsInEntries].join(', ')}`);
        
        setProcessedTempIds(prev => {
          const newSet = new Set(prev);
          tempIdsInEntries.forEach(id => newSet.add(id));
          return newSet;
        });
        
        // Also add these to renderedTempIds to ensure we don't show duplicates
        setRenderedTempIds(prev => {
          const newSet = new Set(prev);
          tempIdsInEntries.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    }
  }, [entries, processingEntries]);
  
  // Listen for processing completion events
  useEffect(() => {
    const handleProcessingCompleted = (event: CustomEvent) => {
      if (event.detail && event.detail.tempId) {
        const { tempId } = event.detail;
        
        console.log(`[JournalEntriesList] Processing completed for tempId: ${tempId}`);
        
        // Instead of immediately removing, add to pending hide for a gradual transition
        setPendingHideEntries(prev => {
          const newSet = new Set(prev);
          newSet.add(tempId);
          return newSet;
        });
        
        // After a delay, mark as processed
        setTimeout(() => {
          // Mark this temp ID as processed
          setProcessedTempIds(prev => {
            const newSet = new Set(prev);
            newSet.add(tempId);
            return newSet;
          });
          
          // Also add to rendered to prevent duplicates
          setRenderedTempIds(prev => {
            const newSet = new Set(prev);
            newSet.add(tempId);
            return newSet;
          });
          
          // Also update active processing entries
          setActiveProcessingEntries(prev => prev.filter(id => id !== tempId));
        }, 1000);
      }
    };
    
    // Listen for content ready events which indicate a processing entry has been completed
    const handleContentReady = (event: CustomEvent) => {
      // Get the tempId from the event if available
      const tempId = event.detail?.tempId;
      
      if (tempId) {
        console.log(`[JournalEntriesList] Content ready for tempId: ${tempId}`);
        
        // First put in pending hide
        setPendingHideEntries(prev => {
          const newSet = new Set(prev);
          newSet.add(tempId);
          return newSet;
        });
        
        // After a delay, mark this specific tempId as processed
        setTimeout(() => {
          setProcessedTempIds(prev => {
            const newSet = new Set(prev);
            newSet.add(tempId);
            return newSet;
          });
          
          // Also update active processing entries
          setActiveProcessingEntries(prev => prev.filter(id => id !== tempId));
        }, 1000);
      }
      
      // Force a refresh of the processed entries list
      setRenderedTempIds(prev => new Set(prev));
    };
    
    // Listen for force removal events
    const handleForceRemove = (event: CustomEvent) => {
      const tempId = event.detail?.tempId;
      
      if (tempId) {
        console.log(`[JournalEntriesList] Force removal for tempId: ${tempId}`);
        
        // Mark this specific tempId as processed
        setProcessedTempIds(prev => {
          const newSet = new Set(prev);
          newSet.add(tempId);
          return newSet;
        });
        
        // Also update active processing entries
        setActiveProcessingEntries(prev => prev.filter(id => id !== tempId));
      }
    };
    
    window.addEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
    window.addEventListener('entryContentReady', handleContentReady as EventListener);
    window.addEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
    
    return () => {
      window.removeEventListener('processingEntryCompleted', handleProcessingCompleted as EventListener);
      window.removeEventListener('entryContentReady', handleContentReady as EventListener);
      window.removeEventListener('forceRemoveProcessingCard', handleForceRemove as EventListener);
    };
  }, []);
  
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

  // When entries or processing entries change, ensure we have a clean set of rendered IDs
  useEffect(() => {
    if (entries.length > 0 || processingEntries.length > 0) {
      // Find all tempIds that exist in entries
      const entryTempIds = new Set(
        entries.filter(entry => entry.tempId).map(entry => entry.tempId as string)
      );
      
      // Update rendered temp IDs - add any that are in entries
      setRenderedTempIds(prev => {
        const newSet = new Set(prev);
        entryTempIds.forEach(id => newSet.add(id));
        
        // Also mark any that are in processedEntryIds as rendered
        processingEntries.forEach(tempId => {
          if (processedTempIds.has(tempId)) {
            newSet.add(tempId);
          }
        });
        
        return newSet;
      });
    }
  }, [entries, processingEntries, processedEntryIds, processedTempIds]);

  // DEBUG logging for rendered state
  console.log(`[JournalEntriesList] Rendering with: entries=${entries?.length || 0}, loading=${loading}, hasEntries=${hasEntries}, isLoading=${isLoading}, processingEntries=${processingEntries.length}, activeProcessingEntries=${activeProcessingEntries.length}, processingCardsVisible=${processingCardsVisible}, renderedTempIds=${[...renderedTempIds].join(',')}, processedTempIds=${[...processedTempIds].join(',')}`);

  return (
    <div className="journal-entries-list" id="journal-entries-container">
      <JournalEntriesHeader onStartRecording={onStartRecording} />

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            <TranslatableText text="Loading journal entries..." />
          </p>
        </div>
      ) : hasEntries || activeProcessingEntries.length > 0 ? (
        <div className="grid gap-4" data-entries-count={entries.length}>
          {/* IMPROVED: More prominent debugging for processing cards */}
          {activeProcessingEntries.length > 0 && (
            <div data-processing-cards-container="true" className="processing-cards-container">
              {activeProcessingEntries.map((tempId) => {
                console.log(`[JournalEntriesList] Rendering processing card for: ${tempId}`);
                
                // Track this tempId as being rendered
                if (!renderedTempIds.has(tempId)) {
                  setRenderedTempIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(tempId);
                    return newSet;
                  });
                }
                
                return (
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
                );
              })}
            </div>
          )}
          
          {/* If processing entries are not appearing, try a loading skeleton */}
          {processingEntries.length > 0 && activeProcessingEntries.length === 0 && !processingCardsVisible && (
            <JournalEntryLoadingSkeleton count={1} tempId={processingEntries[0]} />
          )}
          
          {/* Then display regular entries */}
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id || entry.tempId || Math.random()}
              entry={{
                ...entry,
                content: entry.content || entry["refined text"] || entry["transcription text"] || ""
              }}
              processing={processingEntries.includes(entry.tempId) && !processedTempIds.has(entry.tempId)}
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
