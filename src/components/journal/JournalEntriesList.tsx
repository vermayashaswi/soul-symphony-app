
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
  // Track entries that have been added to the UI to prevent duplicates
  const [renderedTempIds, setRenderedTempIds] = useState<Set<string>>(new Set());
  // Track active processing entries currently shown in the UI
  const [activeProcessingEntries, setActiveProcessingEntries] = useState<string[]>([]);
  
  // Process and filter the processing entries to show
  useEffect(() => {
    if (processingEntries && processingEntries.length > 0) {
      // Filter out processing entries that have already been completed or rendered as real entries
      const entriesTempIds = new Set(entries
        .filter(entry => entry.tempId)
        .map(entry => entry.tempId as string));
        
      // Find which ones should be actively shown
      const activeEntries = processingEntries.filter(tempId => {
        // Don't show if it's already rendered as a real entry
        if (entriesTempIds.has(tempId)) {
          return false;
        }
        // Don't show if it's marked as processed
        if (processedTempIds.has(tempId)) {
          return false;
        }
        return true;
      });
      
      console.log(`[JournalEntriesList] Active processing entries: ${activeEntries.length} of ${processingEntries.length} total`);
      setActiveProcessingEntries(activeEntries);
    } else {
      setActiveProcessingEntries([]);
    }
  }, [processingEntries, entries, processedTempIds]);
  
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
        
        // Log for debugging
        console.log(`[JournalEntriesList] Processing completed for tempId: ${tempId}`);
        
        // Also update active processing entries
        setActiveProcessingEntries(prev => prev.filter(id => id !== tempId));
      }
    };
    
    // Listen for content ready events which indicate a processing entry has been completed
    const handleContentReady = (event: CustomEvent) => {
      // Get the tempId from the event if available
      const tempId = event.detail?.tempId;
      
      if (tempId) {
        // Mark this specific tempId as processed
        setProcessedTempIds(prev => {
          const newSet = new Set(prev);
          newSet.add(tempId);
          return newSet;
        });
        
        // Also update active processing entries
        setActiveProcessingEntries(prev => prev.filter(id => id !== tempId));
      }
      
      // Force a refresh of the processed entries list
      setRenderedTempIds(prev => new Set(prev));
    };
    
    // Listen for force removal events
    const handleForceRemove = (event: CustomEvent) => {
      const tempId = event.detail?.tempId;
      
      if (tempId) {
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
  console.log(`[JournalEntriesList] Rendering with: entries=${entries?.length || 0}, loading=${loading}, hasEntries=${hasEntries}, isLoading=${isLoading}, processingEntries=${processingEntries.length}, activeProcessingEntries=${activeProcessingEntries.length}, renderedTempIds=${[...renderedTempIds].join(',')}, processedTempIds=${[...processedTempIds].join(',')}`);

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
          {/* Display processing entry cards first with better tracking */}
          {activeProcessingEntries.length > 0 && activeProcessingEntries.map((tempId) => {
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
